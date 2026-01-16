import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const VALID_FEATURES = ['diet', 'substitution', 'adjustment', 'chat'] as const;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-USAGE] ${step}${detailsStr}`);
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
    
    const { feature, increment } = body as { feature: unknown; increment: unknown };
    
    // Validate feature
    if (!validate.isEnum(feature, [...VALID_FEATURES])) {
      logStep("Invalid feature", { feature });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    // Validate increment (optional, defaults to false)
    const shouldIncrement = increment === true;
    
    logStep("Request validated", { feature, increment: shouldIncrement });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Auth failed", { error: userError?.message });
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Check if can use feature
    const { data: canUse, error: checkError } = await supabaseAdmin.rpc('can_use_feature', {
      _user_id: userId,
      _feature: feature,
    });

    if (checkError) {
      logStep("Error checking feature", { error: checkError.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    logStep("Feature check result", { feature, canUse });

    if (!canUse) {
      // Get plan info for error message
      const { data: planInfo } = await supabaseAdmin.rpc('get_user_plan', { _user_id: userId });
      
      const limitMessages: Record<string, string> = {
        diet: `Você atingiu o limite de ${planInfo?.[0]?.diet_limit || 0} dietas do seu plano.`,
        substitution: `Você atingiu o limite de ${planInfo?.[0]?.substitution_limit || 0} substituições do seu plano.`,
        adjustment: `Você atingiu o limite de ${planInfo?.[0]?.adjustment_limit || 0} ajustes do seu plano.`,
        chat: planInfo?.[0]?.has_chat 
          ? `Você atingiu o limite de ${planInfo?.[0]?.chat_messages_per_day || 0} mensagens diárias.`
          : 'O chat não está disponível no seu plano atual.',
      };

      return createErrorResponse(
        limitMessages[feature],
        403,
        corsHeaders,
        { allowed: false, upgradeRequired: true }
      );
    }

    // Increment usage if requested
    if (shouldIncrement) {
      const { error: incError } = await supabaseAdmin.rpc('increment_usage', {
        _user_id: userId,
        _feature: feature,
      });

      if (incError) {
        logStep("Error incrementing usage", { error: incError.message });
      } else {
        logStep("Usage incremented", { feature });
      }
    }

    // Get current usage
    const { data: usage } = await supabaseAdmin
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: planInfo } = await supabaseAdmin.rpc('get_user_plan', { _user_id: userId });

    return createSuccessResponse({
      allowed: true,
      usage: {
        diets: { used: usage?.diets_used || 0, limit: planInfo?.[0]?.diet_limit || 0 },
        substitutions: { used: usage?.substitutions_used || 0, limit: planInfo?.[0]?.substitution_limit || 0 },
        adjustments: { used: usage?.adjustments_used || 0, limit: planInfo?.[0]?.adjustment_limit || 0 },
        chatToday: { used: usage?.chat_messages_today || 0, limit: planInfo?.[0]?.chat_messages_per_day || 0 },
      },
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
