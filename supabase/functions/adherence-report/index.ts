import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdherenceReport {
  executive_summary: string;
  overall_adherence: {
    rate: number;
    days_tracked: number;
    total_days: number;
  };
  meal_adherence: Record<string, {
    rate: number;
    confirmed: number;
    total: number;
    most_selected_option: string | null;
  }>;
  option_comparison: Record<string, {
    option_number: number;
    times_selected: number;
    percentage: number;
  }[]>;
  exception_states: {
    skipped: number;
    out_of_plan: number;
    late_confirmed: number;
    total_exceptions: number;
  };
  recommendations: string[];
  period: {
    start: string;
    end: string;
  };
}

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
      studentId, 
      dietPlanId,
      periodStart,
      periodEnd 
    } = body;

    // Verify professional access if viewing student data
    if (studentId && studentId !== user.id) {
      const { data: studentLink } = await supabase
        .from("professional_students")
        .select("id")
        .eq("professional_id", user.id)
        .eq("student_id", studentId)
        .eq("status", "active")
        .single();

      if (!studentLink) {
        return new Response(JSON.stringify({ error: "Sem permissão" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const targetUserId = studentId || user.id;
    const startDate = periodStart || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = periodEnd || new Date().toISOString().split('T')[0];

    // Get active diet plan if not specified
    let planId = dietPlanId;
    if (!planId) {
      const { data: activePlan } = await supabase
        .from("diet_plans")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!activePlan) {
        return new Response(JSON.stringify({ error: "Nenhum plano ativo encontrado" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      planId = activePlan.id;
    }

    // Calculate adherence metrics using the database function
    const { data: metrics, error: metricsError } = await supabase.rpc(
      "calculate_adherence_metrics",
      {
        _user_id: targetUserId,
        _diet_plan_id: planId,
        _period_start: startDate,
        _period_end: endDate,
      }
    );

    if (metricsError) {
      console.error("Error calculating metrics:", metricsError);
      return new Response(JSON.stringify({ error: "Erro ao calcular métricas" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get daily logs for detailed analysis
    const { data: dailyLogs } = await supabase
      .from("daily_logs")
      .select(`
        *,
        meal_logs (
          *,
          meal:meals (name),
          confirmed_option:meal_options (option_number, name)
        )
      `)
      .eq("user_id", targetUserId)
      .eq("diet_plan_id", planId)
      .gte("log_date", startDate)
      .lte("log_date", endDate)
      .order("log_date", { ascending: false });

    // Get meals with options for the plan
    const { data: meals } = await supabase
      .from("meals")
      .select(`
        id,
        name,
        meal_options (
          id,
          option_number,
          name
        )
      `)
      .eq("diet_plan_id", planId);

    // Build meal adherence data
    const mealAdherence: Record<string, any> = {};
    const optionComparison: Record<string, any[]> = {};

    if (meals) {
      for (const meal of meals) {
        const mealLogs = dailyLogs?.flatMap(dl => 
          dl.meal_logs?.filter((ml: any) => ml.meal?.name === meal.name) || []
        ) || [];

        const confirmed = mealLogs.filter((ml: any) => 
          ml.status === 'CONFIRMADA' || ml.status === 'CONFIRMADA_TARDIA'
        ).length;

        const total = mealLogs.length;

        // Count option selections
        const optionCounts: Record<number, number> = {};
        for (const log of mealLogs) {
          if (log.confirmed_option?.option_number) {
            optionCounts[log.confirmed_option.option_number] = 
              (optionCounts[log.confirmed_option.option_number] || 0) + 1;
          }
        }

        const mostSelectedOption = Object.entries(optionCounts)
          .sort(([, a], [, b]) => b - a)[0];

        mealAdherence[meal.name] = {
          rate: total > 0 ? Math.round(confirmed / total * 100) : 0,
          confirmed,
          total,
          most_selected_option: mostSelectedOption ? `Opção ${mostSelectedOption[0]}` : null,
        };

        // Option comparison
        if (meal.meal_options && meal.meal_options.length > 0) {
          optionComparison[meal.name] = meal.meal_options.map((opt: any) => ({
            option_number: opt.option_number,
            times_selected: optionCounts[opt.option_number] || 0,
            percentage: confirmed > 0 
              ? Math.round((optionCounts[opt.option_number] || 0) / confirmed * 100) 
              : 0,
          }));
        }
      }
    }

    // Count exception states
    const exceptionStates = {
      skipped: metrics?.meals_skipped || 0,
      out_of_plan: metrics?.meals_out_of_plan || 0,
      late_confirmed: metrics?.meals_late || 0,
      total_exceptions: (metrics?.meals_skipped || 0) + 
                       (metrics?.meals_out_of_plan || 0) + 
                       (metrics?.meals_late || 0),
    };

    // Generate recommendations based on data
    const recommendations: string[] = [];
    const adherenceRate = metrics?.adherence_rate || 0;

    if (adherenceRate < 50) {
      recommendations.push("Adesão abaixo de 50%. Considere simplificar as refeições ou revisar os horários.");
    } else if (adherenceRate < 70) {
      recommendations.push("Adesão moderada. Identifique as refeições mais difíceis de seguir.");
    } else if (adherenceRate >= 90) {
      recommendations.push("Excelente adesão! O plano está bem ajustado às rotinas do paciente.");
    }

    if (exceptionStates.skipped > exceptionStates.out_of_plan * 2) {
      recommendations.push("Muitas refeições puladas. Verifique se os horários estão adequados.");
    }

    if (exceptionStates.out_of_plan > 5) {
      recommendations.push("Refeições fora do plano frequentes. Considere adicionar opções mais flexíveis.");
    }

    if (exceptionStates.late_confirmed > 3) {
      recommendations.push("Confirmações tardias frequentes. Lembre o paciente de registrar no momento.");
    }

    // Check for consistently unused options
    for (const [mealName, options] of Object.entries(optionComparison)) {
      const unusedOptions = options.filter((opt: any) => opt.percentage === 0);
      if (unusedOptions.length > 0) {
        recommendations.push(`${mealName}: Opção(ões) ${unusedOptions.map((o: any) => o.option_number).join(', ')} nunca utilizada(s). Considere remover ou substituir.`);
      }
    }

    // Build executive summary
    const totalDays = metrics?.total_days || 0;
    const daysWithRecords = metrics?.days_with_records || 0;
    const executiveSummary = `No período de ${startDate} a ${endDate} (${totalDays} dias), ` +
      `o paciente registrou consumo em ${daysWithRecords} dias (${Math.round(daysWithRecords / totalDays * 100)}%). ` +
      `A taxa de adesão geral foi de ${Math.round(adherenceRate)}%. ` +
      `Foram registradas ${exceptionStates.total_exceptions} exceções ` +
      `(${exceptionStates.skipped} refeições puladas, ${exceptionStates.out_of_plan} fora do plano, ` +
      `${exceptionStates.late_confirmed} confirmações tardias).`;

    const report: AdherenceReport = {
      executive_summary: executiveSummary,
      overall_adherence: {
        rate: Math.round(adherenceRate),
        days_tracked: daysWithRecords,
        total_days: totalDays,
      },
      meal_adherence: mealAdherence,
      option_comparison: optionComparison,
      exception_states: exceptionStates,
      recommendations,
      period: {
        start: startDate,
        end: endDate,
      },
    };

    return new Response(JSON.stringify(report), {
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
