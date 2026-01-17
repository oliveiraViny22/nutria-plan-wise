import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CHAT_HISTORY_LENGTH = 50;

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
  }
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
- Vínculo profissional: ${isLinkedToProfessional ? 'Sim' : 'Não'}`;

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
    
    const { message, profile, chatHistory } = body as { 
      message: unknown; 
      profile: unknown; 
      chatHistory: unknown;
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
    
    // Validate chatHistory if provided
    let validatedHistory: Array<{ role: string; content: string }> = [];
    if (chatHistory !== undefined) {
      if (!validate.isArray(chatHistory)) {
        logStep("Invalid chatHistory: not an array");
        return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
      }
      
      // Limit history length and validate entries
      validatedHistory = (chatHistory as unknown[])
        .slice(-MAX_CHAT_HISTORY_LENGTH)
        .filter((item): item is { role: string; content: string } => {
          if (!validate.isObject(item)) return false;
          const { role, content } = item as { role: unknown; content: unknown };
          return (
            validate.isEnum(role, ['user', 'assistant', 'system']) &&
            validate.isNonEmptyString(content) &&
            validate.maxLength(content, MAX_MESSAGE_LENGTH)
          );
        });
    }
    
    logStep("Request validated", { messageLength: message.length, historyLength: validatedHistory.length });
    
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

    // Get user permissions and plan info
    const { data: permissionsData } = await supabase.rpc('get_user_permissions', { _user_id: user.id });
    const permissions = permissionsData?.[0] || { plan_name: 'gratuito', is_linked_to_professional: false, user_type: 'usuario' };
    const planName = permissions.plan_name || 'gratuito';
    const userType = permissions.user_type || 'usuario';
    const isLinkedToProfessional = permissions.is_linked_to_professional || false;

    logStep("User permissions fetched", { planName, userType, isLinkedToProfessional });

    // Validate chat usage limit
    const { data: limitData } = await supabase.rpc('check_feature_limit', {
      _user_id: user.id,
      _feature: 'chat',
    });
    
    const limitInfo = limitData?.[0];
    
    if (limitInfo && !limitInfo.allowed) {
      const limitMessage = LIMIT_MESSAGES[planName] || LIMIT_MESSAGES.gratuito;
      
      return createErrorResponse(
        limitMessage,
        403,
        corsHeaders,
        { 
          upgradeRequired: true,
          currentUsage: limitInfo.current_usage,
          maxLimit: limitInfo.max_limit,
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

    // Get plan-specific system prompt with governance rules
    const systemPrompt = getSystemPrompt(planName, userType, isLinkedToProfessional, {
      goal,
      dailyCalories,
      proteinTarget,
      carbsTarget,
      fatTarget,
      preferences,
      restrictions,
    });

    const messages = [
      { role: "system", content: systemPrompt },
      ...validatedHistory,
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

    // Increment chat usage after successful response
    await supabase.rpc('increment_usage', {
      _user_id: user.id,
      _feature: 'chat',
    });

    // Get updated usage for response
    const { data: updatedLimitData } = await supabase.rpc('check_feature_limit', {
      _user_id: user.id,
      _feature: 'chat',
    });
    const updatedLimit = updatedLimitData?.[0];

    return createSuccessResponse({ 
      message: data.choices[0].message.content,
      usage: {
        current: updatedLimit?.current_usage || 0,
        limit: updatedLimit?.max_limit || 0,
      },
      planName,
      userType,
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
