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

    console.log("Starting adherence alert check...");

    // Get all active alert configurations
    const { data: configs, error: configError } = await supabase
      .from("adherence_alert_configs")
      .select("*")
      .eq("is_active", true);

    if (configError) {
      console.error("Error fetching configs:", configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log("No active alert configurations found");
      return new Response(JSON.stringify({ message: "No active configurations", alerts_created: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${configs.length} active configurations`);

    let alertsCreated = 0;

    for (const config of configs) {
      console.log(`Processing config for professional: ${config.professional_id}`);

      // Get all active students for this professional
      const { data: students, error: studentsError } = await supabase
        .from("professional_students")
        .select(`
          student_id,
          profiles!professional_students_student_id_fkey (
            name,
            user_id
          )
        `)
        .eq("professional_id", config.professional_id)
        .eq("status", "active");

      if (studentsError) {
        console.error("Error fetching students:", studentsError);
        continue;
      }

      if (!students || students.length === 0) {
        console.log("No active students for this professional");
        continue;
      }

      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - config.check_period_days);

      const periodStartStr = periodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      for (const studentLink of students) {
        const studentId = studentLink.student_id;
        const studentName = (studentLink.profiles as any)?.name || "Aluno";

        // Get active diet plan for student
        const { data: dietPlan } = await supabase
          .from("diet_plans")
          .select("id")
          .eq("user_id", studentId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!dietPlan) {
          console.log(`No active diet plan for student ${studentId}`);
          continue;
        }

        // Calculate adherence metrics
        const { data: metrics, error: metricsError } = await supabase.rpc(
          "calculate_adherence_metrics",
          {
            _user_id: studentId,
            _diet_plan_id: dietPlan.id,
            _period_start: periodStartStr,
            _period_end: periodEndStr,
          }
        );

        if (metricsError) {
          console.error(`Error calculating metrics for ${studentId}:`, metricsError);
          continue;
        }

        const adherenceRate = Math.round(metrics?.adherence_rate || 0);
        console.log(`Student ${studentId} adherence: ${adherenceRate}%`);

        // Check if we need to create an alert
        let alertType: string | null = null;
        let threshold = 0;
        let message = "";

        if (adherenceRate < config.threshold_low && config.notify_on_low) {
          alertType = "low";
          threshold = config.threshold_low;
          message = `${studentName} está com adesão crítica de ${adherenceRate}% nos últimos ${config.check_period_days} dias (limite: ${threshold}%).`;
        } else if (adherenceRate < config.threshold_warning && adherenceRate >= config.threshold_low && config.notify_on_warning) {
          alertType = "warning";
          threshold = config.threshold_warning;
          message = `${studentName} está com adesão de atenção: ${adherenceRate}% nos últimos ${config.check_period_days} dias (limite: ${threshold}%).`;
        }

        if (alertType) {
          // Check if we already have a similar unread alert in the last 24h
          const oneDayAgo = new Date();
          oneDayAgo.setHours(oneDayAgo.getHours() - 24);

          const { data: existingAlert } = await supabase
            .from("adherence_alerts")
            .select("id")
            .eq("professional_id", config.professional_id)
            .eq("student_id", studentId)
            .eq("alert_type", alertType)
            .eq("is_read", false)
            .gte("created_at", oneDayAgo.toISOString())
            .maybeSingle();

          if (!existingAlert) {
            // Create new alert
            const { error: insertError } = await supabase
              .from("adherence_alerts")
              .insert({
                professional_id: config.professional_id,
                student_id: studentId,
                diet_plan_id: dietPlan.id,
                alert_type: alertType,
                adherence_rate: adherenceRate,
                threshold_used: threshold,
                period_start: periodStartStr,
                period_end: periodEndStr,
                message,
              });

            if (insertError) {
              console.error("Error creating alert:", insertError);
            } else {
              alertsCreated++;
              console.log(`Alert created for student ${studentId}: ${alertType}`);
            }
          } else {
            console.log(`Similar alert already exists for student ${studentId}`);
          }
        }

        // Check for recovery (went from low/warning to good)
        if (adherenceRate >= config.threshold_warning) {
          // Check if there was a recent low/warning alert
          const threeDaysAgo = new Date();
          threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

          const { data: previousAlert } = await supabase
            .from("adherence_alerts")
            .select("id, alert_type")
            .eq("professional_id", config.professional_id)
            .eq("student_id", studentId)
            .in("alert_type", ["low", "warning"])
            .gte("created_at", threeDaysAgo.toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (previousAlert) {
            // Check if we already sent a recovery alert
            const { data: existingRecovery } = await supabase
              .from("adherence_alerts")
              .select("id")
              .eq("professional_id", config.professional_id)
              .eq("student_id", studentId)
              .eq("alert_type", "recovered")
              .gte("created_at", previousAlert.id)
              .maybeSingle();

            if (!existingRecovery) {
              const { error: insertError } = await supabase
                .from("adherence_alerts")
                .insert({
                  professional_id: config.professional_id,
                  student_id: studentId,
                  diet_plan_id: dietPlan.id,
                  alert_type: "recovered",
                  adherence_rate: adherenceRate,
                  threshold_used: config.threshold_warning,
                  period_start: periodStartStr,
                  period_end: periodEndStr,
                  message: `${studentName} recuperou a adesão para ${adherenceRate}% nos últimos ${config.check_period_days} dias. 🎉`,
                });

              if (!insertError) {
                alertsCreated++;
                console.log(`Recovery alert created for student ${studentId}`);
              }
            }
          }
        }
      }
    }

    console.log(`Alert check complete. Created ${alertsCreated} alerts.`);

    return new Response(JSON.stringify({ 
      success: true, 
      alerts_created: alertsCreated,
      configs_processed: configs.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in check-adherence-alerts:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
