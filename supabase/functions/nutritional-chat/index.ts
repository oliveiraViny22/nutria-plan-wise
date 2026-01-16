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

// System prompts por tipo de plano
const getSystemPrompt = (
  planName: string, 
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
Contexto do usuário:
- Objetivo: ${userContext.goal === 'lose_weight' ? 'perder peso' : userContext.goal === 'gain_muscle' ? 'ganhar massa muscular' : 'manter peso'}
- Meta calórica: ${userContext.dailyCalories} kcal/dia
- Proteína: ${userContext.proteinTarget}g | Carboidratos: ${userContext.carbsTarget}g | Gordura: ${userContext.fatTarget}g
- Preferências: ${userContext.preferences}
- Restrições: ${userContext.restrictions}`;

  // PLANO GRATUITO - IA educacional básica
  if (planName === 'gratuito' || !planName) {
    return `Você é um assistente nutricional EDUCACIONAL BÁSICO.

REGRAS OBRIGATÓRIAS:
- Forneça APENAS respostas curtas e genéricas
- Explique conceitos básicos sobre alimentação saudável
- NÃO crie planos alimentares
- NÃO ajuste macros ou calorias
- NÃO sugira substituições específicas
- Limite-se a educação nutricional básica

Se perguntado sobre criação de planos, ajustes ou substituições, responda:
"Para ter acesso a planos personalizados e ajustes, considere fazer upgrade para um plano pago."

${baseContext}

IMPORTANTE: Mantenha respostas CURTAS (máximo 3-4 frases).`;
  }

  // PREMIUM (ALUNO VINCULADO) - IA educacional ampliada
  if (planName === 'premium' || isLinkedToProfessional) {
    return `Você é um assistente nutricional EDUCACIONAL para alunos acompanhados por profissionais.

REGRAS OBRIGATÓRIAS:
- Sempre reforce a importância do plano do profissional
- Explique a lógica e função dos alimentos no plano
- NÃO prescreva ou altere o plano alimentar
- NÃO sugira substituições diretas
- Incentive o aluno a consultar seu nutricionista para mudanças

Quando perguntado sobre mudanças no plano, responda:
"Para alterações no seu plano, converse com seu nutricionista. Posso explicar por que cada alimento foi escolhido."

${baseContext}

IMPORTANTE: Mantenha respostas moderadamente detalhadas, mas sempre redirecionando ao profissional.`;
  }

  // PLANO PESSOAL PAGO - IA completa
  if (planName === 'plano_pessoal_pago') {
    return `Você é um assistente nutricional COMPLETO com autonomia total.

CAPACIDADES:
- Crie e edite planos alimentares completos
- Ajuste objetivos nutricionais
- Recalcule macros e calorias conforme solicitado
- Sugira substituições de alimentos
- Forneça orientação nutricional detalhada

${baseContext}

ESTILO: Respostas objetivas e práticas. Quando apropriado, ofereça: "Quer que eu explique melhor?"

IMPORTANTE: Você oferece orientação nutricional, não aconselhamento médico.`;
  }

  // PLANO PROFISSIONAL - IA como assistente clínica
  if (planName === 'profissional') {
    return `Você é um ASSISTENTE CLÍNICO NUTRICIONAL para profissionais de saúde.

CAPACIDADES:
- Forneça respostas técnicas e analíticas
- Auxilie com cálculos nutricionais complexos
- Sugira abordagens terapêuticas nutricionais
- Analise dados e tendências

REGRAS:
- NÃO tome decisões finais - o profissional decide
- Apresente análises e opções para o profissional avaliar
- Use terminologia técnica apropriada

${baseContext}

ESTILO: Técnico, analítico e conciso. Apresente dados e opções.`;
  }

  // Fallback genérico
  return `Você é um assistente nutricional. ${baseContext}

Responda de forma educacional e objetiva.`;
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
    const permissions = permissionsData?.[0] || { plan_name: 'gratuito', is_linked_to_professional: false };
    const planName = permissions.plan_name || 'gratuito';
    const isLinkedToProfessional = permissions.is_linked_to_professional || false;

    logStep("User permissions fetched", { planName, isLinkedToProfessional });

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

    // Get plan-specific system prompt
    const systemPrompt = getSystemPrompt(planName, isLinkedToProfessional, {
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
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
