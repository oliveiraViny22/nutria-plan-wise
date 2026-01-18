import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { 
      mealId, 
      optionId, 
      status, // CONFIRMADA, PULADA, FORA_DO_PLANO
      logDate,
      notes
    } = body;

    if (!mealId || !status) {
      return new Response(JSON.stringify({ error: "mealId e status são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!['CONFIRMADA', 'PULADA', 'FORA_DO_PLANO'].includes(status)) {
      return new Response(JSON.stringify({ 
        error: "Status inválido. Use: CONFIRMADA, PULADA ou FORA_DO_PLANO" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (status === 'CONFIRMADA' && !optionId) {
      return new Response(JSON.stringify({ 
        error: "optionId é obrigatório quando status é CONFIRMADA" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use the database function to confirm meal consumption
    const { data: result, error: confirmError } = await supabase.rpc(
      "confirm_meal_consumption",
      {
        _user_id: user.id,
        _meal_id: mealId,
        _option_id: status === 'CONFIRMADA' ? optionId : null,
        _status: status,
        _log_date: logDate || new Date().toISOString().split('T')[0],
      }
    );

    if (confirmError) {
      console.error("Error confirming meal:", confirmError);
      return new Response(JSON.stringify({ error: confirmError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add notes if provided
    if (notes && result?.daily_log_id) {
      await supabase
        .from("meal_logs")
        .update({ notes })
        .eq("daily_log_id", result.daily_log_id)
        .eq("meal_id", mealId);
    }

    // Get updated daily log with all meals
    const { data: dailyLog } = await supabase
      .from("daily_logs")
      .select(`
        *,
        meal_logs (
          *,
          meal:meals (name),
          confirmed_option:meal_options (option_number, name)
        )
      `)
      .eq("id", result.daily_log_id)
      .single();

    return new Response(JSON.stringify({
      success: true,
      status: result.status,
      daily_log: dailyLog,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
