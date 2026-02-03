import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger('explain-substitution');

// Validate food object structure
function isValidFood(food: unknown): food is { name: string; calories: number; protein: number; carbs: number; fat: number } {
  if (!validate.isObject(food)) return false;
  const f = food as Record<string, unknown>;
  return (
    validate.isNonEmptyString(f.name) &&
    validate.maxLength(f.name, 100) &&
    validate.isNumber(f.calories) &&
    validate.isNumber(f.protein) &&
    validate.isNumber(f.carbs) &&
    validate.isNumber(f.fat)
  );
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info("Function started");
    
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
    
    const { originalFood, newFood, userGoal, dailyCalories } = body as {
      originalFood: unknown;
      newFood: unknown;
      userGoal: unknown;
      dailyCalories: unknown;
    };
    
    // Validate food objects
    if (!isValidFood(originalFood)) {
      log.warn("Invalid originalFood", { originalFood });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!isValidFood(newFood)) {
      log.warn("Invalid newFood", { newFood });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    // Validate userGoal
    const validGoals = ['lose_weight', 'gain_muscle', 'maintain'];
    const safeUserGoal = validate.isEnum(userGoal, validGoals) ? userGoal : 'maintain';
    
    // Validate dailyCalories
    const safeDailyCalories = validate.isInRange(dailyCalories, 500, 10000) ? dailyCalories : 2000;
    
    log.info("Request validated", { originalFood: originalFood.name, newFood: newFood.name });
    
    // Validate usage limits
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      log.warn("Auth failed", { error: userError?.message });
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }
    
    const userId = userData.user.id;
    log.info("User authenticated", { userId });
    
    // Check usage limits
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: canUse, error: canUseError } = await supabaseAdmin.rpc('can_use_feature', {
      _user_id: userId,
      _feature: 'substitution'
    });
    
    if (canUseError || !canUse) {
      log.info("Usage limit reached");
      // IMPORTANT: return 200 so the client can handle gracefully without triggering a hard runtime error
      return createSuccessResponse(
        {
          allowed: false,
          upgradeRequired: true,
          error: CLIENT_ERRORS.USAGE_LIMIT,
          explanation: null,
        },
        corsHeaders,
        200,
      );
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    // Calculate nutritional differences for context
    const calDiff = newFood.calories - originalFood.calories;
    const protDiff = newFood.protein - originalFood.protein;
    const carbsDiff = newFood.carbs - originalFood.carbs;
    const fatDiff = newFood.fat - originalFood.fat;
    
    const goalText = safeUserGoal === 'lose_weight' ? 'perda de peso' : 
                     safeUserGoal === 'gain_muscle' ? 'ganho de massa muscular' : 'manutenção do peso';

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `Você é um nutricionista que explica substituições alimentares de forma clara e profissional.

REGRAS OBRIGATÓRIAS:
- NÃO mencione categorias de alimentos (ex: "proteína animal", "carboidrato complexo")
- NÃO use termos técnicos nutricionais
- Foque APENAS no impacto nutricional direto: calorias, proteína, carboidratos e gordura
- Use linguagem simples e direta
- Limite a resposta a 2-3 frases curtas
- Seja objetivo e orientado à decisão do usuário` 
          },
          { 
            role: "user", 
            content: `Substituição: "${originalFood.name}" por "${newFood.name}".

Impacto nutricional:
- Calorias: ${calDiff > 0 ? '+' : ''}${calDiff}kcal
- Proteína: ${protDiff > 0 ? '+' : ''}${protDiff}g
- Carboidratos: ${carbsDiff > 0 ? '+' : ''}${carbsDiff}g
- Gordura: ${fatDiff > 0 ? '+' : ''}${fatDiff}g

Objetivo do paciente: ${goalText}
Meta diária: ${safeDailyCalories}kcal

Explique brevemente se essa troca é adequada para o objetivo, focando nos números.` 
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return createErrorResponse(CLIENT_ERRORS.RATE_LIMIT, 429, corsHeaders);
      }
      if (response.status === 402) {
        return createErrorResponse(CLIENT_ERRORS.PAYMENT_REQUIRED, 402, corsHeaders);
      }
      log.error("AI API error", { status: response.status });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    const data = await response.json();
    
    // Increment usage after successful response
    await supabaseAdmin.rpc('increment_usage', {
      _user_id: userId,
      _feature: 'substitution'
    });

    return createSuccessResponse({ explanation: data.choices[0].message.content }, corsHeaders);
  } catch (error) {
    log.error("Unexpected error", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
