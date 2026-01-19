import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Status mapping: frontend (legacy) -> database (v2)
const STATUS_MAP: Record<string, string> = {
  'CONFIRMADA': 'confirmed',
  'PULADA': 'skipped',
  'FORA_DO_PLANO': 'out_of_plan',
  // Direct v2 values (passthrough)
  'confirmed': 'confirmed',
  'skipped': 'skipped',
  'out_of_plan': 'out_of_plan',
  'pending': 'pending',
  'late_confirmed': 'late_confirmed',
};

const VALID_STATUSES = ['confirmed', 'skipped', 'out_of_plan', 'CONFIRMADA', 'PULADA', 'FORA_DO_PLANO'];

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
      status, // Accepts both legacy (CONFIRMADA) and v2 (confirmed) formats
      logDate,
      notes
    } = body;

    if (!mealId || !status) {
      return new Response(JSON.stringify({ error: "mealId e status são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return new Response(JSON.stringify({ 
        error: "Status inválido. Use: confirmed, skipped, out_of_plan (ou legacy: CONFIRMADA, PULADA, FORA_DO_PLANO)" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to v2 status
    const dbStatus = STATUS_MAP[status] || status;

    if ((dbStatus === 'confirmed' || dbStatus === 'late_confirmed') && !optionId) {
      return new Response(JSON.stringify({ 
        error: "optionId é obrigatório quando status é confirmed/CONFIRMADA" 
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
        _option_id: (dbStatus === 'confirmed' || dbStatus === 'late_confirmed') ? optionId : null,
        _status: dbStatus,
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
