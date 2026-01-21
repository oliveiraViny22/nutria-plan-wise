import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_MESSAGES = 20; // Sliding window size
const SUMMARIZE_THRESHOLD = 15; // Summarize when history exceeds this
const RATE_LIMIT_WINDOW_MS = 2000; // 2 seconds between messages
const MAX_SUMMARY_LENGTH = 500;

// deno-lint-ignore no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NUTRITIONAL-CHAT] ${step}${detailsStr}`);
};

// Mensagens de limite por plano
const LIMIT_MESSAGES: Record<string, string> = {
  gratuito: "Você atingiu o limite diário do plano gratuito. Amanhã poderá continuar ou fazer upgrade para usar a IA com mais liberdade.",
  premium: "Você atingiu o limite diário do seu plano. Amanhã a conversa será liberada novamente. Para ter autonomia total, conheça o Plano Pessoal.",
  plano_pessoal_pago: "Você atingiu o limite diário de mensagens. O limite será renovado automaticamente amanhã.",
  profissional: "Você atingiu o limite diário da IA. O acesso será renovado amanhã.",
};

// System prompt completo com governança
const getSystemPrompt = (
  planName: string, 
  userType: string,
  isLinkedToProfessional: boolean,
  userContext: {
    goal: string;
    dailyCalories: number;
    proteinTarget: number;
    carbsTarget: number;
    fatTarget: number;
    preferences: string;
    restrictions: string;
  },
  conversationSummary?: string
): string => {
  const baseContext = `
## CONTEXTO DO USUÁRIO
- Objetivo: ${userContext.goal === 'lose_weight' ? 'perder peso' : userContext.goal === 'gain_muscle' ? 'ganhar massa muscular' : 'manter peso'}
- Meta calórica: ${userContext.dailyCalories} kcal/dia
- Proteína: ${userContext.proteinTarget}g | Carboidratos: ${userContext.carbsTarget}g | Gordura: ${userContext.fatTarget}g
- Preferências: ${userContext.preferences}
- Restrições: ${userContext.restrictions}
- user_type: ${userType}
- plan_type: ${planName}
- Vínculo profissional: ${isLinkedToProfessional ? 'Sim' : 'Não'}
${conversationSummary ? `\n## RESUMO DA CONVERSA ANTERIOR\n${conversationSummary}` : ''}`;

  const governanceRules = `
## CONTEXTO GERAL (OBRIGATÓRIO)

Você é uma IA nutricional integrada a um sistema clínico com governança.
Você NÃO é autônoma e NÃO toma decisões finais.

Você NUNCA deve:
- ignorar vínculo profissional
- alterar plano sem autorização explícita
- fechar calorias ou macros
- persistir dados
- agir fora das permissões do perfil

Toda alteração nutricional real obrigatoriamente passa pelo backend e pelo MacroRebalancerService.

## CONTROLE DE VERBOSIDADE (REGRA GLOBAL)

- Responda sempre de forma concisa por padrão
- Nunca exceda o limite de frases definido para o perfil e tipo de resposta
- Só aprofunde se o usuário pedir explicitamente
- Frase = período finalizado por ponto. Bullets com verbo contam como frases.

## GATILHOS DE EXPANSÃO

Você SÓ pode ultrapassar os limites de frases se detectar explicitamente:
- "explique melhor"
- "detalhe"
- "aprofundar"
- "por quê?"
- "quero entender mais"

Após gatilho:
- Pode dobrar o limite de frases
- Nunca ultrapassar 20 frases
- Manter clareza e objetividade

## FORMATO DE PROPOSTA DE AJUSTE (OBRIGATÓRIO)

Sempre retornar apenas JSON, sem aplicar mudanças:

{
  "action": "update_diet_plan",
  "target_student": "email@aluno.com",
  "adjustment_type": "food_substitution | portion_adjustment | macro_redistribution",
  "summary": "Descrição clara e curta do ajuste",
  "strategy": "onde e como compensar",
  "requires_approval": true
}

❌ Não incluir números detalhados
❌ Não executar
❌ Não persistir

## BOTÃO "OTIMIZAR PLANO PARA ATINGIR MACROS"

Ao ser acionado:
- NÃO criar estratégias
- NÃO sugerir alimentos
- NÃO gerar propostas

O fluxo é: snapshot do plano → MacroRebalancerService.rebalance() → validação → persistência.
Você apenas explica o processo, respeitando os limites de frases.

## ALIMENTOS NÃO EXISTENTES NO BANCO

Se um alimento não existir:
- Informar o usuário
- Oferecer criar alimento estimado
- Prosseguir somente após confirmação
- O alimento criado deve ser marcado como: origin = ia_estimated

## TOM E SEGURANÇA

- Linguagem clara
- Profissional
- Previsível
- Sem promessas clínicas
- Sem textos longos por padrão

Frase-guia obrigatória:
"Posso explicar, simular e propor ajustes, mas alterações reais só acontecem com autorização adequada e validação do sistema."

## REGRA FINAL ABSOLUTA

Se houver qualquer dúvida sobre:
- permissão
- impacto clínico
- consistência nutricional

➡️ Bloqueie a ação
➡️ Explique o motivo
➡️ Ofereça o próximo passo correto

Sempre respeitando os limites de frases.`;

  // ALUNO + GRATUITO - IA educacional básica
  if ((userType === 'aluno' && planName === 'gratuito') || (!planName && !userType)) {
    return `${governanceRules}

## PERFIL: ALUNO + GRATUITO

### LIMITES DE FRASES
- Resposta padrão: 2-4 frases
- Explicação: 2-3 frases
- Orientação de adesão: 2-4 frases

### VERBOS PERMITIDOS
✅ EXPLICAR, ORIENTAR

### VERBOS PROIBIDOS
❌ ANALISAR macros, SIMULAR, PROPOR, EXECUTAR

### REGRA DE BLOQUEIO
Resposta padrão a pedido de ajuste:
"Não posso alterar seu plano alimentar. Posso ajudar a criar uma solicitação ao seu profissional."

### ORIENTAÇÃO
- Forneça APENAS respostas curtas e genéricas
- Explique conceitos básicos sobre alimentação saudável
- NÃO crie planos alimentares
- NÃO ajuste macros ou calorias
- NÃO sugira substituições específicas
- Limite-se a educação nutricional básica

${baseContext}`;
  }

  // ALUNO + PREMIUM - IA educacional ampliada
  if ((userType === 'aluno' && planName === 'premium') || isLinkedToProfessional) {
    return `${governanceRules}

## PERFIL: ALUNO + PREMIUM

### LIMITES DE FRASES
- Resposta padrão: 4-6 frases
- Explicação: 4-5 frases
- Orientação de adesão: 2-4 frases

### VERBOS PERMITIDOS
✅ EXPLICAR, ANALISAR (leitura), SIMULAR

### VERBOS PROIBIDOS
❌ EXECUTAR, alterar plano oficial

### SIMULAÇÕES
Toda simulação deve ser:
- claramente rotulada como simulação
- paralela
- sem impacto real

### REGRA DE BLOQUEIO
Quando perguntado sobre mudanças no plano:
"Para alterações no seu plano, converse com seu nutricionista. Posso explicar por que cada alimento foi escolhido."

### ORIENTAÇÃO
- Sempre reforce a importância do plano do profissional
- Explique a lógica e função dos alimentos no plano
- NÃO prescreva ou altere o plano alimentar
- NÃO sugira substituições diretas
- Incentive o aluno a consultar seu nutricionista para mudanças

${baseContext}`;
  }

  // USUARIO + PLANO_PESSOAL_PAGO - IA completa
  if (userType === 'usuario' && planName === 'plano_pessoal_pago') {
    return `${governanceRules}

## PERFIL: USUARIO + PLANO_PESSOAL_PAGO

### LIMITES DE FRASES
- Resposta padrão: 5-8 frases
- Explicação: 5-6 frases
- Orientação de adesão: 2-4 frases
- Confirmação de execução: 1-2 frases
- Resposta após execução: 2-3 frases

### VERBOS PERMITIDOS
✅ EXPLICAR, ANALISAR, SIMULAR, PROPOR, EXECUTAR

### ANTES DE EXECUTAR
Solicitar confirmação explícita do usuário.

### CAPACIDADES
- Crie e edite planos alimentares completos
- Ajuste objetivos nutricionais
- Recalcule macros e calorias conforme solicitado
- Sugira substituições de alimentos
- Forneça orientação nutricional detalhada

### ESTILO
Respostas objetivas e práticas. Quando apropriado, ofereça: "Quer que eu explique melhor?"

IMPORTANTE: Você oferece orientação nutricional, não aconselhamento médico.

${baseContext}`;
  }

  // PROFISSIONAL - IA como assistente clínica
  if (userType === 'profissional' || planName === 'profissional') {
    return `${governanceRules}

## PERFIL: PROFISSIONAL

### LIMITES DE FRASES
- Resposta padrão: 6-10 frases
- Explicação: 6-8 frases
- Orientação de adesão: 2-4 frases
- Confirmação de execução: 1-2 frases
- Resposta após execução: 2-3 frases

### VERBOS PERMITIDOS
✅ EXPLICAR, ANALISAR, SIMULAR, PROPOR

### EXECUTAR
Somente após aprovação explícita do profissional.

### FLUXO OBRIGATÓRIO
1. IA PROPÕE (JSON)
2. Profissional aprova
3. Sistema executa

### CAPACIDADES
- Forneça respostas técnicas e analíticas
- Auxilie com cálculos nutricionais complexos
- Sugira abordagens terapêuticas nutricionais
- Analise dados e tendências

### REGRAS
- NÃO tome decisões finais - o profissional decide
- Apresente análises e opções para o profissional avaliar
- Use terminologia técnica apropriada

### ESTILO
Técnico, analítico e conciso. Apresente dados e opções.

${baseContext}`;
  }

  // Fallback genérico (plano_pessoal_pago sem user_type ou outros casos)
  return `${governanceRules}

## PERFIL: PADRÃO

### LIMITES DE FRASES
- Resposta padrão: 4-6 frases
- Explicação: 4-5 frases

### VERBOS PERMITIDOS
✅ EXPLICAR, ORIENTAR, ANALISAR (leitura)

### VERBOS PROIBIDOS
❌ EXECUTAR sem confirmação

### ORIENTAÇÃO
Responda de forma educacional e objetiva.

${baseContext}`;
};

// Summarize conversation for context compression
async function summarizeConversation(
  messages: Array<{ role: string; content: string }>,
  apiKey: string
): Promise<string> {
  if (messages.length < 5) return '';
  
  const conversationText = messages
    .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
    .join('\n');
  
  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { 
            role: "system", 
            content: "Resuma esta conversa nutricional em no máximo 3 frases, destacando: tópicos discutidos, decisões tomadas, e contexto importante para continuidade. Seja objetivo."
          },
          { role: "user", content: conversationText }
        ],
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content || '';
      return summary.substring(0, MAX_SUMMARY_LENGTH);
    }
  } catch (error) {
    logStep("Summarization failed", { error: getErrorForLogging(error) });
  }
  
  return '';
}

// Rate limit check using database
async function checkRateLimit(
  supabase: AnySupabaseClient,
  userId: string
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const now = Date.now();
  
  // Check last message timestamp from chat_messages
  const { data: lastMessage } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('user_id', userId)
    .eq('role', 'user')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (lastMessage?.created_at) {
    const lastMessageTime = new Date(lastMessage.created_at as string).getTime();
    const timeSinceLastMessage = now - lastMessageTime;
    
    if (timeSinceLastMessage < RATE_LIMIT_WINDOW_MS) {
      return { 
        allowed: false, 
        retryAfterMs: RATE_LIMIT_WINDOW_MS - timeSinceLastMessage 
      };
    }
  }
  
  return { allowed: true };
}

// Persist chat message
async function persistMessage(
  supabase: AnySupabaseClient,
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  await supabase.from('chat_messages').insert({
    user_id: userId,
    role,
    content: content.substring(0, MAX_MESSAGE_LENGTH * 2),
  } as Record<string, unknown>);
}

// Load conversation history with sliding window
async function loadConversationHistory(
  supabase: AnySupabaseClient,
  userId: string,
  apiKey: string
): Promise<{ messages: Array<{ role: string; content: string }>; summary?: string }> {
  const { data: allMessages } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  
  if (!allMessages || allMessages.length === 0) {
    return { messages: [] };
  }
  
  // Type assertion for messages
  const typedMessages = allMessages as Array<{ role: string; content: string; created_at: string }>;
  
  // If within window, return all
  if (typedMessages.length <= MAX_CONTEXT_MESSAGES) {
    return { 
      messages: typedMessages.map(m => ({ role: m.role, content: m.content }))
    };
  }
  
  // Need to summarize older messages
  const oldMessages = typedMessages.slice(0, -MAX_CONTEXT_MESSAGES);
  const recentMessages = typedMessages.slice(-MAX_CONTEXT_MESSAGES);
  
  // Summarize old messages if threshold exceeded
  let summary: string | undefined;
  if (oldMessages.length >= SUMMARIZE_THRESHOLD) {
    summary = await summarizeConversation(
      oldMessages.map(m => ({ role: m.role, content: m.content })),
      apiKey
    );
    logStep("Conversation summarized", { oldCount: oldMessages.length, summaryLength: summary.length });
  }
  
  return {
    messages: recentMessages.map(m => ({ role: m.role, content: m.content })),
    summary,
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!validate.isObject(body)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const { message, profile } = body as { 
      message: unknown; 
      profile: unknown; 
    };
    
    // Validate message
    if (!validate.isNonEmptyString(message)) {
      logStep("Invalid message: not a string");
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!validate.maxLength(message, MAX_MESSAGE_LENGTH)) {
      logStep("Message too long", { length: message.length, max: MAX_MESSAGE_LENGTH });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    logStep("Request validated", { messageLength: message.length });
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      logStep("Auth failed");
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }
    
    logStep("User authenticated", { userId: user.id });

    // Check rate limit
    const rateLimitResult = await checkRateLimit(supabase, user.id);
    if (!rateLimitResult.allowed) {
      logStep("Rate limited", { retryAfterMs: rateLimitResult.retryAfterMs });
      return createErrorResponse(
        `Aguarde ${Math.ceil((rateLimitResult.retryAfterMs || 2000) / 1000)} segundos antes de enviar outra mensagem.`,
        429,
        corsHeaders,
        { retryAfterMs: rateLimitResult.retryAfterMs }
      );
    }

    // Get user plan info using v2 RPC
    const { data: planData } = await supabase.rpc('get_user_plan', { _user_id: user.id });
    const plan = planData?.[0] || { 
      plan_name: 'Gratuito', 
      plan_type: 'gratuito', 
      has_chat: true,
      chat_messages_per_day: 3,
    };
    const planName = plan.plan_name?.toLowerCase() || 'gratuito';
    const planType = plan.plan_type || 'gratuito';
    
    // Determine user type based on plan
    const userType = planType === 'profissional' ? 'profissional' : 'usuario';
    const isLinkedToProfessional = false; // V2: professional features dormant

    logStep("User plan fetched", { planName, planType, userType, hasChat: plan.has_chat });

    // Check if chat is available for this plan
    if (!plan.has_chat) {
      return createErrorResponse(
        "O chat não está disponível no seu plano atual.",
        403,
        corsHeaders,
        { upgradeRequired: true, planName }
      );
    }

    // Validate chat usage limit using v2 RPC
    const { data: usageData } = await supabase.rpc('get_usage_info', {
      _user_id: user.id,
      _feature: 'chat',
    });
    
    const usageInfo = usageData?.[0];
    
    if (usageInfo && !usageInfo.allowed) {
      const limitMessage = LIMIT_MESSAGES[planType] || LIMIT_MESSAGES.gratuito;
      
      return createErrorResponse(
        limitMessage,
        403,
        corsHeaders,
        { 
          upgradeRequired: true,
          currentUsage: usageInfo.current_usage,
          maxLimit: usageInfo.max_limit,
          planName
        }
      );
    }

    // Safely extract profile data with defaults
    const safeProfile = validate.isObject(profile) ? profile as Record<string, unknown> : {};
    const goal = validate.isString(safeProfile.goal) ? safeProfile.goal : 'maintain';
    const dailyCalories = validate.isPositiveNumber(safeProfile.daily_calories) ? safeProfile.daily_calories : 2000;
    const proteinTarget = validate.isPositiveNumber(safeProfile.protein_target) ? safeProfile.protein_target : 150;
    const carbsTarget = validate.isPositiveNumber(safeProfile.carbs_target) ? safeProfile.carbs_target : 250;
    const fatTarget = validate.isPositiveNumber(safeProfile.fat_target) ? safeProfile.fat_target : 65;
    const preferences = validate.isArray(safeProfile.preferences) 
      ? (safeProfile.preferences as unknown[]).filter(validate.isString).slice(0, 10).join(", ")
      : "Nenhuma";
    const restrictions = validate.isArray(safeProfile.restrictions)
      ? (safeProfile.restrictions as unknown[]).filter(validate.isString).slice(0, 10).join(", ")
      : "Nenhuma";

    // Load conversation history with sliding window and summarization
    const { messages: historyMessages, summary } = await loadConversationHistory(
      supabase, 
      user.id, 
      LOVABLE_API_KEY || ''
    );
    
    logStep("Conversation history loaded", { 
      historyCount: historyMessages.length,
      hasSummary: Boolean(summary),
    });

    // Persist user message
    await persistMessage(supabase, user.id, 'user', message);

    // Get plan-specific system prompt with governance rules and summary
    const systemPrompt = getSystemPrompt(planName, userType, isLinkedToProfessional, {
      goal,
      dailyCalories,
      proteinTarget,
      carbsTarget,
      fatTarget,
      preferences,
      restrictions,
    }, summary);

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return createErrorResponse(CLIENT_ERRORS.RATE_LIMIT, 429, corsHeaders);
      }
      if (response.status === 402) {
        return createErrorResponse(CLIENT_ERRORS.PAYMENT_REQUIRED, 402, corsHeaders);
      }
      logStep("AI API error", { status: response.status });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    // Persist assistant response
    await persistMessage(supabase, user.id, 'assistant', assistantMessage);

    // Increment chat usage after successful response
    await supabase.rpc('increment_usage', {
      _user_id: user.id,
      _feature: 'chat',
    });

    // Get updated usage for response
    const { data: updatedUsageData } = await supabase.rpc('get_usage_info', {
      _user_id: user.id,
      _feature: 'chat',
    });
    const updatedUsage = updatedUsageData?.[0];

    return createSuccessResponse({ 
      message: assistantMessage,
      usage: {
        current: updatedUsage?.current_usage || 0,
        limit: updatedUsage?.max_limit || 0,
      },
      planName,
      userType,
      contextInfo: {
        historyLoaded: historyMessages.length,
        summarized: Boolean(summary),
      },
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
