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
    const { suggestionId, action, editedChanges, reviewNotes } = body;

    if (!suggestionId || !action) {
      return new Response(JSON.stringify({ error: "suggestionId e action são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!['APPROVE', 'REJECT', 'EDIT'].includes(action)) {
      return new Response(JSON.stringify({ 
        error: "Action inválida. Use: APPROVE, REJECT ou EDIT" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the suggestion
    const { data: suggestion, error: suggestionError } = await supabase
      .from("ai_suggestions")
      .select(`
        *,
        diet_plan:diet_plans (
          id,
          user_id
        )
      `)
      .eq("id", suggestionId)
      .single();

    if (suggestionError || !suggestion) {
      return new Response(JSON.stringify({ error: "Sugestão não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify professional has access to this student
    const { data: studentLink } = await supabase
      .from("professional_students")
      .select("id")
      .eq("professional_id", user.id)
      .eq("student_id", suggestion.user_id)
      .eq("status", "active")
      .single();

    if (!studentLink) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update suggestion status
    const newStatus = action === 'APPROVE' ? 'APPROVED' : 
                      action === 'REJECT' ? 'REJECTED' : 'EDITED';

    const updateData: any = {
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
    };

    if (action === 'EDIT' && editedChanges) {
      updateData.proposed_changes = editedChanges;
    }

    const { error: updateError } = await supabase
      .from("ai_suggestions")
      .update(updateData)
      .eq("id", suggestionId);

    if (updateError) {
      console.error("Error updating suggestion:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar sugestão" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If approved, apply the changes and create new plan version
    if (action === 'APPROVE' || (action === 'EDIT' && editedChanges)) {
      const changes = action === 'EDIT' ? editedChanges : suggestion.proposed_changes;
      const planId = suggestion.diet_plan_id;

      // Get current plan version
      const { data: currentVersion } = await supabase
        .from("plan_versions")
        .select("version_number, snapshot")
        .eq("diet_plan_id", planId)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      const newVersionNumber = (currentVersion?.version_number || 0) + 1;

      // Apply changes based on suggestion type
      switch (suggestion.suggestion_type) {
        case 'REMOVE_OPTION':
          if (changes.meal_name && changes.option_number) {
            // Get meal and remove the option
            const { data: meal } = await supabase
              .from("meals")
              .select("id")
              .eq("diet_plan_id", planId)
              .eq("name", changes.meal_name)
              .single();

            if (meal) {
              await supabase
                .from("meal_options")
                .delete()
                .eq("meal_id", meal.id)
                .eq("option_number", changes.option_number);
            }
          }
          break;

        case 'REDUCE_MEALS':
          if (changes.meal_name) {
            // Deactivate the meal (soft delete by removing from options display)
            const { data: meal } = await supabase
              .from("meals")
              .select("id, total_calories")
              .eq("diet_plan_id", planId)
              .eq("name", changes.meal_name)
              .single();

            if (meal && changes.redistribute_calories) {
              // Redistribute calories to other meals
              const { data: otherMeals } = await supabase
                .from("meals")
                .select("id, total_calories")
                .eq("diet_plan_id", planId)
                .neq("name", changes.meal_name);

              if (otherMeals && otherMeals.length > 0) {
                const extraCaloriesPerMeal = Math.round(meal.total_calories / otherMeals.length);
                for (const otherMeal of otherMeals) {
                  await supabase
                    .from("meals")
                    .update({ total_calories: otherMeal.total_calories + extraCaloriesPerMeal })
                    .eq("id", otherMeal.id);
                }
              }
            }

            // Delete the meal
            await supabase
              .from("meals")
              .delete()
              .eq("id", meal?.id);
          }
          break;

        // Add more cases for other suggestion types as needed
      }

      // Get updated plan data for snapshot
      const { data: updatedMeals } = await supabase
        .from("meals")
        .select(`
          id,
          name,
          total_calories,
          total_protein,
          total_carbs,
          total_fat,
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

      // Create new plan version
      await supabase
        .from("plan_versions")
        .insert({
          diet_plan_id: planId,
          version_number: newVersionNumber,
          snapshot: { meals: updatedMeals, applied_suggestion: suggestionId },
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          notes: `Sugestão aplicada: ${suggestion.hypothesis}`,
        });

      // Update daily_logs to reference new version
      await supabase
        .from("daily_logs")
        .update({ plan_version: newVersionNumber })
        .eq("diet_plan_id", planId)
        .gte("log_date", new Date().toISOString().split('T')[0]);
    }

    return new Response(JSON.stringify({
      success: true,
      status: newStatus,
      message: action === 'APPROVE' ? 'Sugestão aprovada e aplicada' :
               action === 'REJECT' ? 'Sugestão rejeitada' :
               'Sugestão editada e aplicada',
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
