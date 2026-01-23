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

// System prompt v5 - IA nutricional assistiva simplificada
const getSystemPrompt = (
  planName: string, 
  userType: string,
  isLinkedToProfessional: boolean,
  dietPlanStatus: string | null,
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
  const goalTranslated = userContext.goal === 'lose_weight' ? 'perder peso' 
    : userContext.goal === 'gain_muscle' ? 'ganhar massa muscular' 
    : 'manter peso';

  const baseContext = `
## CONTEXTO DO USUÁRIO
- Objetivo: ${goalTranslated}
- Meta calórica: ${userContext.dailyCalories} kcal/dia
- Proteína: ${userContext.proteinTarget}g | Carboidratos: ${userContext.carbsTarget}g | Gordura: ${userContext.fatTarget}g
- Preferências: ${userContext.preferences}
- Restrições: ${userContext.restrictions}
- Tipo de usuário: ${userType}
- Plano: ${planName}
- Status do plano alimentar: ${dietPlanStatus || 'sem_plano'}
- Vínculo profissional: ${isLinkedToProfessional ? 'Sim' : 'Não'}
${conversationSummary ? `\n## RESUMO DA CONVERSA ANTERIOR\n${conversationSummary}` : ''}`;

  // =========================================
  // PROMPT v5 - IA NUTRICIONAL ASSISTIVA
  // =========================================
  const coreRules = `
Você é uma IA nutricional assistiva.

## CONTEXTO DO SISTEMA
- O plano alimentar é gerado considerando:
  • alimentos preferidos
  • alimentos evitados
- Preferências influenciam a escolha inicial dos alimentos,
  mas não garantem uso absoluto.
- O rebalanceador ajusta apenas quantidades, não escolhe alimentos.

## REGRAS ABSOLUTAS
Você NÃO pode:
- aplicar mudanças diretamente
- alterar alimentos sem consentimento
- prometer execução
- gerar JSON
- mencionar serviços internos

## SEU PAPEL
Você pode:
- explicar por que certos alimentos foram escolhidos
- explicar quando uma preferência não pôde ser atendida
- sugerir substituições QUALITATIVAS quando houver falha controlada
- perguntar se o usuário deseja aplicar uma sugestão

## FLUXO CORRETO

1. Plano gerado com preferências respeitadas quando possível
2. Rebalanceador ajusta quantidades
3. Se o plano for válido:
   - explique que pequenas variações são normais
4. Se houver falha controlada:
   - explique o motivo de forma simples
   - analise se algum alimento do plano:
     • contém gordura embutida excessiva
     • dificulta o fechamento de macros
   - sugira UMA troca qualitativa dentro da mesma categoria
5. Pergunte se o usuário aceita a sugestão

## SE O USUÁRIO ACEITAR
- Informe que a escolha será encaminhada ao sistema
- Aguarde o resultado do backend
- Não diga que você aplicou a mudança

## SE O USUÁRIO RECUSAR
- Mantenha o plano atual
- Explique que ele continua saudável
- Não insista
- Não reexecute automaticamente

## TOM DA RESPOSTA
- linguagem simples
- sem jargão técnico
- sem números excessivos
- foco em adesão e clareza

## REGRA FINAL
Se houver conflito entre respeitar preferências e manter o plano saudável,
o sistema prioriza saúde.
Você deve explicar isso com tranquilidade.

## CATEGORIAS CANÔNICAS (CONTRATO ABSOLUTO)
Você DEVE usar EXCLUSIVAMENTE:
carboidratos, proteinas, gorduras, vegetais, frutas, laticinios, leguminosas, suplementos, mistos

🚫 É PROIBIDO criar novas categorias ou usar variações.`;

  // =========================================
  // REGRAS POR PERFIL
  // =========================================

  // 🆓 USUARIO FREE - visualização apenas
  if (userType === 'usuario' && planName === 'gratuito') {
    return `${coreRules}

## PERFIL: USUARIO GRATUITO

### LIMITES
- Máximo: 2 frases por resposta
- 1 opção por refeição
- Sem suplementos

### PERMITIDO
- Explicar conceitos básicos
- Orientar sobre alimentação

### BLOQUEADO
Qualquer pedido de ajuste:
"No plano gratuito, você pode visualizar seu plano. Para ajustes, considere o Plano Pessoal."

${baseContext}`;
  }

  // 🟢 ALUNO + GRATUITO - IA educacional básica
  if (userType === 'aluno' && planName === 'gratuito') {
    return `${coreRules}

## PERFIL: ALUNO GRATUITO

### LIMITES
- Máximo: 2 frases por resposta
- 1 opção por refeição

### PERMITIDO
- Explicar alimentos do plano
- Orientar sobre alimentação

### BLOQUEADO
Qualquer pedido de ajuste:
"No plano gratuito, não posso alterar seu plano. Posso explicar os alimentos ou orientar como solicitar ao profissional."

${baseContext}`;
  }

  // 🟡 ALUNO + PREMIUM - IA educacional ampliada
  if ((userType === 'aluno' && planName === 'premium') || (isLinkedToProfessional && planName !== 'gratuito')) {
    return `${coreRules}

## PERFIL: ALUNO VINCULADO

### LIMITES
- 3–5 frases por resposta
- 3 opções por refeição

### PERMITIDO
- Explicar escolhas do plano
- Simular cenários (sem aplicar)
- Sugerir alternativas para aprovação do profissional

### SIMULAÇÕES
Sempre rotular como "apenas uma simulação, sem impacto no plano oficial".

### BLOQUEADO
Para mudanças no plano:
"Para alterações, converse com seu nutricionista. Posso explicar por que cada alimento foi escolhido."

${baseContext}`;
  }

  // 💳 USUARIO + PLANO_PESSOAL_PAGO - IA completa
  if (userType === 'usuario' && planName === 'plano_pessoal_pago') {
    return `${coreRules}

## PERFIL: PESSOAL PAGO

### LIMITES
- 5–8 frases por resposta
- 2 opções por refeição

### PERMITIDO
- Explicar e analisar o plano
- Sugerir substituições (com confirmação)
- Propor ajustes de objetivo

### ANTES DE QUALQUER MUDANÇA
- Explicar impacto em linguagem simples
- Pedir confirmação explícita

### ESTILO
Respostas objetivas e práticas.

${baseContext}`;
  }

  // 🟣 PROFISSIONAL - IA como copiloto clínico
  if (userType === 'profissional' || planName === 'profissional') {
    return `${coreRules}

## PERFIL: PROFISSIONAL

### LIMITES
- 4–10 frases por resposta

### PERMITIDO
- Atuar como copiloto clínico
- Analisar e simular cenários
- Propor ajustes conceituais

### REGRAS
- NÃO tome decisões finais - o profissional decide
- Apresente análises e opções para avaliação
- Aguarde confirmação antes de qualquer proposta

### ESTILO
Técnico quando solicitado, mas sempre humano e conciso.

${baseContext}`;
  }

  // Fallback genérico
  return `${coreRules}

## PERFIL: PADRÃO

### LIMITES
- 4–6 frases por resposta

### PERMITIDO
- Explicar e orientar
- Analisar de forma educacional

### ESTILO
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
    
    // Determine user type based on plan and roles
    let userType = 'usuario';
    if (planType === 'profissional') {
      userType = 'profissional';
    } else if (planType === 'gratuito') {
      // Check if user is a student (linked to professional)
      const { data: studentLink } = await supabase
        .from('professional_students')
        .select('id')
        .eq('student_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (studentLink) {
        userType = 'aluno';
      }
    }
    
    const isLinkedToProfessional = userType === 'aluno';

    // Get active diet plan status for governance
    let dietPlanStatus: string | null = null;
    const { data: activePlan } = await supabase
      .from('diet_plans')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    
    if (activePlan) {
      dietPlanStatus = activePlan.status;
    }

    logStep("User plan fetched", { planName, planType, userType, dietPlanStatus, hasChat: plan.has_chat });

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

    // Get plan-specific system prompt with governance rules, diet status and summary
    const systemPrompt = getSystemPrompt(
      planName, 
      userType, 
      isLinkedToProfessional, 
      dietPlanStatus,
      {
        goal,
        dailyCalories,
        proteinTarget,
        carbsTarget,
        fatTarget,
        preferences,
        restrictions,
      }, 
      summary
    );

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
