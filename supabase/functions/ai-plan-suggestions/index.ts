import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AISuggestion {
  suggestion_type: string;
  hypothesis: string;
  rationale: string;
  proposed_changes: any;
}

const SUGGESTION_TYPES = {
  ADD_OPTION: "Adicionar nova opção equivalente",
  REMOVE_OPTION: "Remover opção não utilizada",
  SIMPLIFY_OPTION: "Simplificar opção complexa",
  ADJUST_SCHEDULE: "Ajustar horários das refeições",
  REDUCE_MEALS: "Reduzir número de refeições",
  REORGANIZE_MEALS: "Reorganizar distribuição calórica",
  CONTEXTUAL_OPTION: "Criar opção contextual",
};

// Mapeamento de nomes técnicos para nomes legíveis em português
const MEAL_NAMES_PT: Record<string, string> = {
  breakfast: "Café da Manhã",
  morning_snack: "Lanche da Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche da Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

// Função para traduzir nome da refeição
function translateMealName(mealName: string): string {
  return MEAL_NAMES_PT[mealName] || mealName;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
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
    const { studentId, dietPlanId } = body;

    // Verify professional access
    if (studentId) {
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

    // Get active diet plan
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
        return new Response(JSON.stringify({ error: "Nenhum plano ativo" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      planId = activePlan.id;
    }

    // Get adherence metrics for the last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: metrics } = await supabase.rpc("calculate_adherence_metrics", {
      _user_id: targetUserId,
      _diet_plan_id: planId,
      _period_start: startDate,
      _period_end: endDate,
    });

    // Get meals with options and their usage
    const { data: meals } = await supabase
      .from("meals")
      .select(`
        id,
        name,
        total_calories,
        meal_options (
          id,
          option_number,
          name,
          total_calories,
          total_protein,
          total_carbs,
          total_fat
        )
      `)
      .eq("diet_plan_id", planId);

    // Get meal logs for pattern analysis
    const { data: mealLogs } = await supabase
      .from("meal_logs")
      .select(`
        meal_id,
        status,
        confirmed_option_id,
        confirmed_at,
        daily_log:daily_logs!inner (
          log_date,
          user_id,
          diet_plan_id
        )
      `)
      .eq("daily_log.user_id", targetUserId)
      .eq("daily_log.diet_plan_id", planId);

    // Analyze patterns and generate suggestions
    const suggestions: AISuggestion[] = [];

    if (meals && mealLogs) {
      for (const meal of meals) {
        const mealLogEntries = mealLogs.filter(ml => ml.meal_id === meal.id);
        const confirmedLogs = mealLogEntries.filter(ml => 
          ml.status === 'CONFIRMADA' || ml.status === 'CONFIRMADA_TARDIA'
        );
        const skippedLogs = mealLogEntries.filter(ml => ml.status === 'PULADA');
        const outOfPlanLogs = mealLogEntries.filter(ml => ml.status === 'FORA_DO_PLANO');

        // Check for consistently skipped meals
        const mealNamePt = translateMealName(meal.name);
        
        if (skippedLogs.length > mealLogEntries.length * 0.5) {
          suggestions.push({
            suggestion_type: "REDUCE_MEALS",
            hypothesis: `${mealNamePt} é pulada em mais de 50% dos dias`,
            rationale: `A refeição ${mealNamePt} foi pulada ${skippedLogs.length} vezes em ${mealLogEntries.length} registros. ` +
              `Isso pode indicar que o horário não é conveniente ou que a refeição não se encaixa na rotina do paciente.`,
            proposed_changes: {
              action: "remove_meal",
              meal_name: mealNamePt,
              redistribute_calories: true,
            },
          });
        }

        // Check for options that are never used
        if (meal.meal_options && meal.meal_options.length > 1) {
          const optionUsage: Record<string, number> = {};
          for (const log of confirmedLogs) {
            if (log.confirmed_option_id) {
              optionUsage[log.confirmed_option_id] = (optionUsage[log.confirmed_option_id] || 0) + 1;
            }
          }

          for (const option of meal.meal_options) {
            if (!optionUsage[option.id] && confirmedLogs.length > 5) {
              suggestions.push({
                suggestion_type: "REMOVE_OPTION",
                hypothesis: `Opção ${option.option_number} de ${mealNamePt} nunca é selecionada`,
                rationale: `Após ${confirmedLogs.length} confirmações, a ${option.name || `Opção ${option.option_number}`} nunca foi escolhida. ` +
                  `Isso sugere que essa opção não atende às preferências ou rotina do paciente.`,
                proposed_changes: {
                  action: "remove_option",
                  meal_name: mealNamePt,
                  option_number: option.option_number,
                },
              });
            }
          }

          // Check if only one option is used (need more variety?)
          const usedOptions = Object.keys(optionUsage).length;
          if (usedOptions === 1 && meal.meal_options.length < 3 && confirmedLogs.length > 10) {
            suggestions.push({
              suggestion_type: "ADD_OPTION",
              hypothesis: `Apenas uma opção é usada para ${mealNamePt}`,
              rationale: `O paciente sempre escolhe a mesma opção. Adicionar uma nova alternativa pode ` +
                `aumentar a flexibilidade sem comprometer a adesão.`,
              proposed_changes: {
                action: "add_option",
                meal_name: mealNamePt,
                base_option: Object.keys(optionUsage)[0],
              },
            });
          }
        }

        // Check for high out-of-plan rate
        if (outOfPlanLogs.length > mealLogEntries.length * 0.3 && mealLogEntries.length > 5) {
          suggestions.push({
            suggestion_type: "CONTEXTUAL_OPTION",
            hypothesis: `${mealNamePt} frequentemente substituída por alimentos fora do plano`,
            rationale: `Em ${Math.round(outOfPlanLogs.length / mealLogEntries.length * 100)}% das vezes, ` +
              `o paciente opta por alimentos fora do plano. Considere adicionar uma opção mais flexível ou prática.`,
            proposed_changes: {
              action: "add_contextual_option",
              meal_name: mealNamePt,
              context: "practical_alternative",
            },
          });
        }
      }
    }

    // Overall adherence suggestions
    if (metrics) {
      const adherenceRate = metrics.adherence_rate || 0;

      if (adherenceRate < 40) {
        suggestions.push({
          suggestion_type: "SIMPLIFY_OPTION",
          hypothesis: "Adesão geral muito baixa sugere plano complexo demais",
          rationale: `Com taxa de adesão de apenas ${Math.round(adherenceRate)}%, ` +
            `o plano pode estar muito distante da realidade do paciente. ` +
            `Considere simplificar drasticamente, começando com menos refeições e opções mais simples.`,
          proposed_changes: {
            action: "simplify_all",
            target_meals: 3,
            target_options_per_meal: 1,
          },
        });
      }

      if (metrics.meals_late > metrics.meals_confirmed * 0.3) {
        suggestions.push({
          suggestion_type: "ADJUST_SCHEDULE",
          hypothesis: "Muitas confirmações tardias indicam horários inadequados",
          rationale: `${metrics.meals_late} refeições foram confirmadas tardiamente. ` +
            `Isso pode indicar que os horários das refeições não estão alinhados com a rotina do paciente.`,
          proposed_changes: {
            action: "review_schedule",
            late_confirmation_rate: Math.round(metrics.meals_late / (metrics.meals_confirmed + metrics.meals_late) * 100),
          },
        });
      }
    }

    // Save suggestions to database
    for (const suggestion of suggestions) {
      await supabase
        .from("ai_suggestions")
        .insert({
          user_id: targetUserId,
          diet_plan_id: planId,
          suggestion_type: suggestion.suggestion_type,
          hypothesis: suggestion.hypothesis,
          rationale: suggestion.rationale,
          proposed_changes: suggestion.proposed_changes,
          adherence_data_used: metrics || {},
          status: "PENDING",
        });
    }

    // If AI is available, enhance suggestions with more detailed analysis
    if (lovableApiKey && suggestions.length > 0) {
      try {
        const prompt = `Analise os seguintes padrões de adesão a um plano alimentar e refine as sugestões:

Dados de adesão:
${JSON.stringify(metrics, null, 2)}

Sugestões geradas:
${suggestions.map(s => `- ${s.hypothesis}: ${s.rationale}`).join('\n')}

Forneça refinamentos ou sugestões adicionais baseados nos dados. 
IMPORTANTE: Não emita juízos morais sobre o paciente. Foque apenas em padrões estruturais.
Responda em português brasileiro.`;

        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é um nutricionista analítico que fornece sugestões técnicas baseadas em dados. Nunca julgue o paciente. Foque em padrões estruturais." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiInsights = aiData.choices?.[0]?.message?.content;
          if (aiInsights) {
            suggestions.push({
              suggestion_type: "REORGANIZE_MEALS",
              hypothesis: "Análise complementar da IA",
              rationale: aiInsights,
              proposed_changes: { action: "ai_insights", details: aiInsights },
            });
          }
        }
      } catch (aiError) {
        console.error("AI enhancement error:", aiError);
      }
    }

    return new Response(JSON.stringify({
      suggestions,
      adherence_summary: metrics,
      plan_id: planId,
      period: { start: startDate, end: endDate },
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
