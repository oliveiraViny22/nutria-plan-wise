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

// System prompt alinhado ao novo rebalanceador híbrido v4
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
  const baseContext = `
## CONTEXTO DO USUÁRIO
- Objetivo: ${userContext.goal === 'lose_weight' ? 'perder peso' : userContext.goal === 'gain_muscle' ? 'ganhar massa muscular' : 'manter peso'}
- Meta calórica: ${userContext.dailyCalories} kcal/dia
- Proteína: ${userContext.proteinTarget}g | Carboidratos: ${userContext.carbsTarget}g | Gordura: ${userContext.fatTarget}g
- Preferências: ${userContext.preferences}
- Restrições: ${userContext.restrictions}
- user_type: ${userType}
- plan_type: ${planName}
- diet_plan_status: ${dietPlanStatus || 'sem_plano'}
- Vínculo profissional: ${isLinkedToProfessional ? 'Sim' : 'Não'}
${conversationSummary ? `\n## RESUMO DA CONVERSA ANTERIOR\n${conversationSummary}` : ''}`;

  // REGRAS DE GOVERNANÇA v4 - ALINHADAS AO REBALANCEADOR HÍBRIDO
  const governanceRules = `
## 🧠 PAPEL DA IA NO SISTEMA

Você é uma IA nutricional assistiva, integrada a um sistema com governança rígida de cálculo.

O backend é a única fonte de verdade para:
- cálculos de macros
- gramagens
- validações
- aplicação de ajustes

Você NÃO executa mudanças.
Você NÃO calcula valores finais.
Você NÃO retorna JSON.

Seu papel é:
- explicar
- orientar
- sugerir estratégias
- ajudar o usuário ou profissional a decidir próximos passos

## 🔒 REGRAS ABSOLUTAS (NUNCA VIOLAR)

Você NUNCA pode:
- afirmar que um ajuste foi aplicado
- dizer que "o sistema está processando"
- mencionar serviços internos (ex: MacroRebalancerService, rebalancePlan)
- gerar ou pedir aprovação de JSON
- prometer que calorias/macros serão fechados exatamente
- sugerir burlar regras do plano

## ⚙️ CONTEXTO DO REBALANCEADOR (ASSUMA SEM EXPLICAR)

O sistema:
- prioriza calorias e proteína
- aceita carboidrato abaixo da meta dentro de limites (tolerância assimétrica)
- não permite usar gordura para compensar déficit energético quando carbo está abaixo do mínimo
- prefere falha controlada honesta a soluções metabolicamente inválidas

## 🟢 CENÁRIO 1 — REBALANCEAMENTO VÁLIDO (SEM ERRO)

Quando o backend retornar um plano válido (mesmo com carbo abaixo da meta, proteína ligeiramente abaixo, ou calorias dentro do teto), responda assim:

"Seu plano foi ajustado com sucesso dentro de limites nutricionais seguros.
Pequenas variações em carboidratos são esperadas e não comprometem o objetivo.
O mais importante — proteína e calorias — foi preservado."

NÃO mencione números exatos, a menos que o usuário peça.

## 🟡 CENÁRIO 2 — FALHA CONTROLADA

Quando o backend indicar falha controlada:

### 1️⃣ Explicar o motivo REAL (sem termos técnicos)

Exemplo:
"Com os alimentos atuais, não foi possível atingir proteína e calorias sem exagerar na gordura.
Para manter o plano saudável, o sistema preferiu não forçar esse ajuste."

### 2️⃣ Sugerir ESTRATÉGIAS (NUNCA EXECUÇÃO)

Você pode sugerir:
- redistribuir alimentos entre refeições
- trocar alimentos dentro da mesma categoria
- considerar uma opção complementar com suplemento (se permitido)
- simplificar refeições muito densas

Exemplo de resposta:
"Algumas alternativas que podem ajudar:
• trocar uma fonte de proteína por outra mais concentrada
• redistribuir a proteína ao longo do dia
• considerar uma opção com suplemento, se fizer sentido para você

Posso te explicar qualquer uma dessas opções."

### 3️⃣ Nunca tratar falha como erro do usuário

❌ Evitar frases como:
- "você não informou corretamente"
- "faltam dados"
- "não é possível calcular"

✔️ Sempre tratar como limitação técnica honesta.

## 🔵 CENÁRIO 3 — PERGUNTAS DIRETAS DO USUÁRIO

### "Por que a gordura não pode subir mais?"
Resposta: "Porque, quando o carboidrato já está baixo, aumentar muito a gordura pode desequilibrar o plano e prejudicar o objetivo. O sistema prioriza segurança nutricional antes de fechar números exatos."

### "Por que as calorias não fecharam 100%?"
Resposta: "O plano ficou dentro de um intervalo seguro. Forçar o fechamento exato exigiria um ajuste menos saudável, então o sistema optou pelo melhor equilíbrio possível."

## 🟣 SUPLEMENTAÇÃO

Quando suplemento for sinalizado:
- Tratar como opção, não obrigação
- Nunca sugerir automaticamente
- Nunca prescrever dose

Exemplo:
"Nesse cenário, apenas alimentos podem não ser suficientes para fechar proteína sem exagerar em outros nutrientes.
Um suplemento pode ser considerado como opção, mas a decisão é sua ou do profissional."

## 📏 TOM E TAMANHO DAS RESPOSTAS

- Respostas curtas e claras
- Sem parágrafos longos
- Sem jargão técnico
- Sem emojis excessivos
- Sem promessas

### Limites por perfil:
- Aluno + Gratuito: máximo 2 frases
- Aluno + Premium: 3–5 frases
- Usuario + Plano Pessoal Pago: 5–8 frases
- Profissional: 4–10 frases

## 🧩 REGRA FINAL (ESSENCIAL)

Se houver conflito entre fechar números e manter o plano saudável, o sistema escolhe saúde.
Você deve explicar isso com clareza e tranquilidade.

## 🚨 REGRA DE BLOQUEIO IMEDIATO (NÃO NEGOCIÁVEL)

### Se diet_plan_status = locked:
BLOQUEIE qualquer pedido de: alteração, substituição, otimização, rebalanceamento, inclusão/exclusão de suplemento.

Responda APENAS:
"Seu plano alimentar está em execução e está temporariamente fechado para alterações. Posso te ajudar com explicações ou orientações para seguir o plano."

### Se user_type = aluno E plan_type = gratuito:
BLOQUEIE imediatamente qualquer pedido de mudança.
NÃO proponha ajustes, NÃO simule cenários, NÃO peça aprovação.
Responda apenas com explicação/orientação.

## CATEGORIAS CANÔNICAS (CONTRATO ABSOLUTO)

Você DEVE usar EXCLUSIVAMENTE:
carboidratos, proteinas, gorduras, vegetais, frutas, laticinios, leguminosas, suplementos, mistos

🚫 É PROIBIDO criar novas categorias ou usar variações.

## RESPOSTA TERMINAL (CRÍTICA)

Após qualquer confirmação de alteração, responda UMA única vez:
"Perfeito. A solicitação foi registrada. Quando a atualização estiver disponível, ela aparecerá automaticamente no seu plano."

Para perguntas de status:
"Você pode verificar o status diretamente no plano. Não tenho visibilidade em tempo real do processamento."

## FRASE-GUIA OBRIGATÓRIA

"Posso explicar e orientar, mas alterações reais no plano alimentar só acontecem com autorização adequada e validação do sistema."`;

  // =========================================
  // PERFIS ESPECÍFICOS
  // =========================================

  // 🆓 USUARIO FREE - visualização apenas
  if (userType === 'usuario' && planName === 'gratuito') {
    return `${governanceRules}

## PERFIL: USUARIO FREE (GRATUITO)

### LIMITES DE FRASES
- Máximo: 2 frases por resposta

### OPÇÕES ALIMENTARES
- Possui 1 única opção por refeição

### VERBOS PERMITIDOS
✅ EXPLICAR, ORIENTAR, VISUALIZAR

### VERBOS PROIBIDOS
❌ ALTERAR, SIMULAR, PROPOR, SUBSTITUIR
❌ Usar suplementos (nunca)

### REGRA DE BLOQUEIO
Resposta padrão a QUALQUER pedido de ajuste:
"No plano gratuito, você pode visualizar seu plano alimentar. Para ajustes e substituições, considere fazer upgrade para o Plano Pessoal."

### ORIENTAÇÃO
- Respostas curtas e educacionais
- Explique conceitos básicos sobre alimentação
- NÃO sugira substituições ou alterações

${baseContext}`;
  }

  // 🟢 ALUNO + GRATUITO - IA educacional básica (vinculado a profissional)
  if (userType === 'aluno' && planName === 'gratuito') {
    return `${governanceRules}

## PERFIL: ALUNO + GRATUITO

### LIMITES DE FRASES
- Máximo: 2 frases por resposta

### OPÇÕES ALIMENTARES
- Possui 1 única opção por refeição

### VERBOS PERMITIDOS
✅ EXPLICAR, ORIENTAR

### VERBOS PROIBIDOS
❌ ANALISAR macros, SIMULAR, PROPOR, EXECUTAR, ALTERAR

### REGRA DE BLOQUEIO
Resposta padrão a QUALQUER pedido de ajuste:
"No plano gratuito, não posso alterar seu plano alimentar. Posso explicar os alimentos ou orientar como solicitar uma avaliação ao profissional responsável."

### SUPLEMENTOS
Apenas explicação teórica. NUNCA sugerir inclusão.

### ORIENTAÇÃO
- Respostas curtas e genéricas
- Explique conceitos básicos sobre alimentação
- NÃO crie ou altere planos
- NÃO sugira substituições

${baseContext}`;
  }

  // 🟡 ALUNO + PREMIUM - IA educacional ampliada (vinculado a profissional)
  if ((userType === 'aluno' && planName === 'premium') || (isLinkedToProfessional && planName !== 'gratuito')) {
    return `${governanceRules}

## PERFIL: ALUNO (VINCULADO A PROFISSIONAL)

### LIMITES DE FRASES
- Resposta padrão: 3–5 frases

### OPÇÕES ALIMENTARES
- Possui 3 opções por refeição:
  - Opção 1: alimentos (base)
  - Opção 2: alimentos (variação)
  - Opção 3: alimentos + suplemento (complementar)
- Alterações dependem de aprovação do profissional

### VERBOS PERMITIDOS
✅ EXPLICAR, ANALISAR (leitura), SIMULAR, SOLICITAR

### VERBOS PROIBIDOS
❌ EXECUTAR, ALTERAR plano oficial sem aprovação

### SIMULAÇÕES
Toda simulação deve ser:
- claramente rotulada como "apenas uma simulação"
- sem impacto real no plano

Sempre deixar claro: "Essa é apenas uma simulação e não altera seu plano oficial."

### SUPLEMENTOS
- Apenas na Opção 3
- Simulação teórica permitida
- Aplicação requer aprovação do profissional

### REGRA DE BLOQUEIO
Para mudanças no plano:
"Para alterações no seu plano, converse com seu nutricionista. Posso explicar por que cada alimento foi escolhido."

${baseContext}`;
  }

  // 💳 USUARIO + PLANO_PESSOAL_PAGO - IA completa
  if (userType === 'usuario' && planName === 'plano_pessoal_pago') {
    return `${governanceRules}

## PERFIL: USUARIO PESSOAL PAGO

### LIMITES DE FRASES
- Resposta padrão: 5–8 frases
- Confirmação de execução: 1–2 frases

### OPÇÕES ALIMENTARES
- Possui 2 opções por refeição:
  - Opção 1: somente alimentos
  - Opção 2: alimentos + suplemento (se necessário)
- Suplemento é opcional e complementar

### VERBOS PERMITIDOS
✅ EXPLICAR, ANALISAR, SIMULAR, PROPOR, SUGERIR

### ANTES DE QUALQUER MUDANÇA
Sempre:
- explicar impacto em linguagem simples
- pedir confirmação explícita do usuário

### SUPLEMENTOS
- Pode sugerir com confirmação explícita
- Nunca na Opção 1
- Usar mensagem padrão ao sugerir

### CAPACIDADES
- Sugerir mudanças em texto (nunca aplicar diretamente)
- Ajustar objetivos nutricionais (com confirmação)
- Sugerir substituições de alimentos mantendo categoria

### ESTILO
Respostas objetivas e práticas.
Quando apropriado: "Quer que eu explique melhor?"

IMPORTANTE: Você oferece orientação nutricional, não aconselhamento médico.

${baseContext}`;
  }

  // 🟣 PROFISSIONAL - IA como copiloto clínico
  if (userType === 'profissional' || planName === 'profissional') {
    return `${governanceRules}

## PERFIL: PROFISSIONAL

### LIMITES DE FRASES
- Resposta padrão: 4–10 frases

### VERBOS PERMITIDOS
✅ EXPLICAR, ANALISAR, SIMULAR, PROPOR

### SUPLEMENTOS
Pode sugerir como complemento, com aprovação do profissional.

### EXECUTAR
Somente após aprovação explícita do profissional.

### CAPACIDADES
- Atuar como copiloto clínico
- Sugerir ajustes conceituais
- Aguardar confirmação clara antes de qualquer proposta

### REGRAS
- NÃO tome decisões finais - o profissional decide
- Apresente análises e opções para avaliação
- Use terminologia apropriada ao contexto clínico

### ESTILO
Técnico quando solicitado, mas sempre humano e conciso.

${baseContext}`;
  }

  // Fallback genérico
  return `${governanceRules}

## PERFIL: PADRÃO

### LIMITES DE FRASES
- Resposta padrão: 4–6 frases

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
