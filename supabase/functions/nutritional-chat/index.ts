import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CHAT_HISTORY_LENGTH = 50;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[NUTRITIONAL-CHAT] ${step}${detailsStr}`);
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

    // Validate chat usage limit
    const { data: canUse } = await supabase.rpc('can_use_feature', {
      _user_id: user.id,
      _feature: 'chat',
    });

    if (!canUse) {
      const { data: planInfo } = await supabase.rpc('get_user_plan', { _user_id: user.id });
      const errorMsg = planInfo?.[0]?.has_chat 
        ? `Você atingiu o limite de ${planInfo?.[0]?.chat_messages_per_day || 0} mensagens diárias.`
        : 'O chat não está disponível no seu plano atual.';
      
      return createErrorResponse(
        errorMsg,
        403,
        corsHeaders,
        { upgradeRequired: true }
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

    const systemPrompt = `Você é um assistente nutricional educacional. Responda perguntas sobre alimentação saudável de forma clara e acessível. 
Contexto do usuário:
- Objetivo: ${goal === 'lose_weight' ? 'perder peso' : goal === 'gain_muscle' ? 'ganhar massa muscular' : 'manter peso'}
- Meta calórica: ${dailyCalories} kcal/dia
- Proteína: ${proteinTarget}g | Carboidratos: ${carbsTarget}g | Gordura: ${fatTarget}g
- Preferências: ${preferences}
- Restrições: ${restrictions}

IMPORTANTE: Você oferece educação nutricional, não aconselhamento médico. Sugira consultar um profissional para casos específicos.`;

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

    return createSuccessResponse({ message: data.choices[0].message.content }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
