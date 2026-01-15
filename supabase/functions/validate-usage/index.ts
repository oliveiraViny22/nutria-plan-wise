import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VALIDATE-USAGE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    const { feature, increment = false } = await req.json();
    logStep("Request", { feature, increment });

    if (!['diet', 'substitution', 'adjustment', 'chat'].includes(feature)) {
      throw new Error("Invalid feature type");
    }

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
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Check if can use feature
    const { data: canUse, error: checkError } = await supabaseAdmin.rpc('can_use_feature', {
      _user_id: userId,
      _feature: feature,
    });

    if (checkError) {
      logStep("Error checking feature", { error: checkError });
      throw new Error("Failed to validate usage");
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

      return new Response(JSON.stringify({
        allowed: false,
        error: limitMessages[feature],
        upgradeRequired: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Increment usage if requested
    if (increment) {
      const { error: incError } = await supabaseAdmin.rpc('increment_usage', {
        _user_id: userId,
        _feature: feature,
      });

      if (incError) {
        logStep("Error incrementing usage", { error: incError });
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

    return new Response(JSON.stringify({
      allowed: true,
      usage: {
        diets: { used: usage?.diets_used || 0, limit: planInfo?.[0]?.diet_limit || 0 },
        substitutions: { used: usage?.substitutions_used || 0, limit: planInfo?.[0]?.substitution_limit || 0 },
        adjustments: { used: usage?.adjustments_used || 0, limit: planInfo?.[0]?.adjustment_limit || 0 },
        chatToday: { used: usage?.chat_messages_today || 0, limit: planInfo?.[0]?.chat_messages_per_day || 0 },
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
