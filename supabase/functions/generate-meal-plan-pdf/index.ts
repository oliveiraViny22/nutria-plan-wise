 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 interface ProfileData {
   name: string | null;
   age: number | null;
   weight: number | null;
   height: number | null;
   goal: string | null;
   daily_calories: number | null;
   protein_target: number | null;
   carbs_target: number | null;
   fat_target: number | null;
 }
 
 interface MealData {
   name: string;
   sort_order: number;
   total_calories: number | null;
   total_protein: number | null;
   total_carbs: number | null;
   total_fat: number | null;
   options: {
     option_number: number;
     foods: {
       name: string;
       quantity: string;
       calories: number;
       protein: number;
       carbs: number;
       fat: number;
     }[];
   }[];
 }
 
 interface PlanData {
   total_calories: number;
   total_protein: number;
   total_carbs: number;
   total_fat: number;
 }
 
 const GOAL_LABELS: Record<string, string> = {
   lose_weight: "Emagrecimento",
   maintain: "Manutenção",
   gain_muscle: "Ganho de Massa",
 };
 
 const MEAL_LABELS: Record<string, string> = {
   breakfast: "Café da Manhã",
   morning_snack: "Lanche da Manhã",
   lunch: "Almoço",
   afternoon_snack: "Lanche da Tarde",
   dinner: "Jantar",
   supper: "Ceia",
 };
 
 const TIPS: Record<string, string[]> = {
   lose_weight: [
     "Priorize proteínas em todas as refeições para manter a saciedade",
     "Beba pelo menos 2L de água por dia, especialmente antes das refeições",
     "Vegetais de folhas verdes podem ser consumidos à vontade",
     "Evite comer nas 3 horas antes de dormir",
   ],
   maintain: [
     "Mantenha consistência nos horários das refeições",
     "Inclua variedade de frutas e vegetais coloridos",
     "Proteínas são importantes para preservar massa muscular",
   ],
   gain_muscle: [
     "Distribua proteínas ao longo do dia (0.3-0.5g/kg por refeição)",
     "Carboidratos complexos são seus aliados para energia",
     "Consuma proteína nas 2 horas pós-treino",
   ],
 };
 
 function generateExecutivePdf(
   profile: ProfileData,
   plan: PlanData,
   meals: MealData[],
   generatedAt: string
 ): string {
   const goalLabel = GOAL_LABELS[profile.goal || "maintain"] || "Manutenção";
   const tips = TIPS[profile.goal || "maintain"] || TIPS.maintain;
 
   // Calculate caloric surplus/deficit
   const targetCalories = profile.daily_calories || 0;
   const planCalories = plan.total_calories || 0;
   const caloricDiff = planCalories - targetCalories;
   const caloricStatus =
     caloricDiff > 50
       ? `+${caloricDiff} kcal (superávit)`
       : caloricDiff < -50
       ? `${caloricDiff} kcal (déficit)`
       : "Dentro da meta";
 
  // Generate meals HTML - full width format
   const mealsHtml = meals
     .sort((a, b) => a.sort_order - b.sort_order)
     .map((meal) => {
       const mealLabel = MEAL_LABELS[meal.name] || meal.name;
       const optionsHtml = meal.options
         .map((opt) => {
           const foodsHtml = opt.foods
              .map(
                (f) => `
              <tr>
                 <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0;">${f.name}</td>
                 <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: center;">${f.quantity}</td>
                 <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.calories}</td>
                 <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.protein}g</td>
                 <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.carbs}g</td>
                 <td style="padding: 2px 4px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.fat}g</td>
              </tr>
            `
              )
              .join("");
 
            return `
           <div style="margin-bottom: 3px;">
             ${meal.options.length > 1 ? `<div style="font-size: 7pt; color: #6b7280; margin-bottom: 2px; font-weight: 500;">Opção ${opt.option_number}</div>` : ''}
             <table style="width: 100%; border-collapse: collapse; font-size: 7pt; table-layout: fixed;">
                <thead>
                 <tr style="background: #f1f5f9; font-size: 6pt; text-transform: uppercase; letter-spacing: 0.02em;">
                   <th style="padding: 3px 4px; text-align: left; font-weight: 600; width: 40%;">Alimento</th>
                   <th style="padding: 3px 4px; text-align: center; font-weight: 600; width: 15%;">Qtd</th>
                   <th style="padding: 3px 4px; text-align: right; font-weight: 600; width: 11%;">Kcal</th>
                   <th style="padding: 3px 4px; text-align: right; font-weight: 600; width: 11%;">P</th>
                   <th style="padding: 3px 4px; text-align: right; font-weight: 600; width: 11%;">C</th>
                   <th style="padding: 3px 4px; text-align: right; font-weight: 600; width: 11%;">G</th>
                  </tr>
                </thead>
                <tbody>
                  ${foodsHtml}
                </tbody>
              </table>
            </div>
          `;
          })
          .join("");
 
        return `
         <div style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 6px;">
           <div style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 4px 8px; border-radius: 4px 4px 0 0;">
             <span style="font-weight: 600; font-size: 8pt;">${mealLabel}</span>
             <span style="font-size: 7pt; opacity: 0.95;">${meal.total_calories || 0} kcal</span>
            </div>
           <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 4px 4px; padding: 4px; background: #ffffff;">
              ${optionsHtml}
            </div>
          </div>
        `;
      })
      .join("");
 
  // Generate tips HTML - compact inline format
   const tipsHtml = tips
    .map((tip, i) => `<span>${i + 1}. ${tip}</span>`)
    .join(" · ");
 
   return `
 <!DOCTYPE html>
 <html>
 <head>
   <meta charset="UTF-8">
    <style>
      @page { 
        size: A4; 
        margin: 6mm 8mm; 
      }
      * { box-sizing: border-box; }
      body { 
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
        font-size: 8pt;
        line-height: 1.25;
        color: #1f2937;
        margin: 0;
        padding: 0;
        background: #ffffff;
        width: 100%;
        max-height: 100vh;
        overflow: hidden;
      }
      .container {
        width: 100%;
        max-width: 100%;
        padding: 0;
      }
      .meals-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
        width: 100%;
        max-width: 580px;
        margin: 0 auto;
      }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .meals-grid { page-break-inside: auto; }
      }
    </style>
 </head>
 <body>
<div class="container">
  <!-- Header -->
  <div style="max-width: 580px; margin: 0 auto 6px auto;">
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #3b82f6; padding-bottom: 4px;">
      <h1 style="font-size: 14pt; font-weight: 700; color: #1f2937; margin: 0;">
        🥗 Plano Alimentar
      </h1>
      <div style="text-align: right; font-size: 7pt; color: #6b7280;">
        ${generatedAt} · NutriAI
      </div>
    </div>
  </div>
 
  <!-- Dados do Perfil - Inline Compacto -->
  <div style="max-width: 580px; margin: 0 auto 6px auto; display: flex; gap: 6px; font-size: 8pt;">
    <div style="flex: 1; background: #f8fafc; border-radius: 6px; padding: 6px 10px; border: 1px solid #e2e8f0;">
      <div style="font-size: 6pt; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;">👤 Perfil</div>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center; font-size: 7pt;">
        <span><strong>${profile.name || "—"}</strong></span>
        <span style="color: #cbd5e1;">|</span>
        <span>${profile.age ? `${profile.age}a` : "—"}</span>
        <span style="color: #cbd5e1;">|</span>
        <span>${profile.weight ? `${profile.weight}kg` : "—"}</span>
        <span style="color: #cbd5e1;">|</span>
        <span>${profile.height ? `${profile.height}cm` : "—"}</span>
        <span style="color: #cbd5e1;">|</span>
        <span style="color: #3b82f6; font-weight: 600;">${goalLabel}</span>
      </div>
    </div>
 
    <div style="background: #f8fafc; border-radius: 6px; padding: 6px 10px; border: 1px solid #e2e8f0;">
      <div style="font-size: 6pt; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 600;">🎯 Metas</div>
      <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 7pt;">
        <span style="font-size: 11pt; font-weight: 700; color: #f59e0b;">${plan.total_calories}<span style="font-size: 7pt; font-weight: 400;">kcal</span></span>
        <span style="color: #3b82f6; font-weight: 600;">${plan.total_protein}g P</span>
        <span style="color: #eab308; font-weight: 600;">${plan.total_carbs}g C</span>
        <span style="color: #f97316; font-weight: 600;">${plan.total_fat}g G</span>
      </div>
    </div>
  </div>
 
  <!-- Refeições -->
  <div style="margin-bottom: 6px;">
    <div style="max-width: 580px; margin: 0 auto;">
      <h2 style="font-size: 9pt; font-weight: 700; color: #1f2937; margin: 0 0 4px 0; padding-bottom: 2px; border-bottom: 1px solid #e2e8f0;">
        🍽️ Refeições do Dia
      </h2>
    </div>
    <div class="meals-grid">
      ${mealsHtml}
    </div>
  </div>
 
  <!-- Dicas -->
  <div style="max-width: 580px; margin: 0 auto;">
    <div style="background: #fffbeb; border-radius: 6px; padding: 4px 8px; border-left: 3px solid #f59e0b; font-size: 7pt; color: #78350f;">
      <strong>💡</strong> ${tipsHtml}
    </div>
  </div>
 
  <!-- Footer -->
  <div style="margin-top: 4px; padding-top: 3px; border-top: 1px solid #e2e8f0; font-size: 6pt; color: #9ca3af; text-align: center;">
    NutriAI • nutria-plan-wise.lovable.app
  </div>
</div>
 </body>
 </html>
   `;
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
     const { studentId, dietPlanId } = body;
 
     // Verify professional access if viewing student data
     let targetUserId = studentId || user.id;
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
 
     // Get profile
     const { data: profile, error: profileError } = await supabase
       .from("profiles")
       .select("name, age, weight, height, goal, daily_calories, protein_target, carbs_target, fat_target")
       .eq("user_id", targetUserId)
       .single();
 
     if (profileError || !profile) {
       return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
         status: 404,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Get diet plan
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
 
     // Get plan totals
     const { data: plan, error: planError } = await supabase
       .from("diet_plans")
       .select("total_calories, total_protein, total_carbs, total_fat")
       .eq("id", planId)
       .single();
 
     if (planError || !plan) {
       return new Response(JSON.stringify({ error: "Plano não encontrado" }), {
         status: 404,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Get meals with options and foods
     const { data: mealsData, error: mealsError } = await supabase
       .from("meals")
       .select(`
         id,
         name,
         sort_order,
         total_calories,
         total_protein,
         total_carbs,
         total_fat,
         meal_options (
           id,
           option_number,
           meal_option_foods (
             quantity_grams,
             display_quantity,
             display_unit,
             food:foods (
               name,
               calories,
               protein,
               carbs,
               fat
             )
           )
         )
       `)
       .eq("diet_plan_id", planId)
       .order("sort_order");
 
     if (mealsError) {
       console.error("Meals error:", mealsError);
       return new Response(JSON.stringify({ error: "Erro ao buscar refeições" }), {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
     }
 
     // Transform meals data
     const meals: MealData[] = (mealsData || []).map((meal: any) => ({
       name: meal.name,
       sort_order: meal.sort_order,
       total_calories: meal.total_calories,
       total_protein: meal.total_protein,
       total_carbs: meal.total_carbs,
       total_fat: meal.total_fat,
       options: (meal.meal_options || []).map((opt: any) => ({
         option_number: opt.option_number,
         foods: (opt.meal_option_foods || []).map((mof: any) => {
           const food = mof.food;
           const grams = mof.quantity_grams || 0;
           const factor = grams / 100;
           
           // Format quantity
           let quantity = `${Math.round(grams)}g`;
           if (mof.display_quantity && mof.display_unit) {
             quantity = `${mof.display_quantity} ${mof.display_unit}`;
           }
 
           return {
             name: food?.name || "Alimento",
             quantity,
             calories: Math.round((food?.calories || 0) * factor),
             protein: Math.round((food?.protein || 0) * factor),
             carbs: Math.round((food?.carbs || 0) * factor),
             fat: Math.round((food?.fat || 0) * factor),
           };
         }),
       })),
     }));
 
     const generatedAt = new Date().toLocaleDateString("pt-BR", {
       day: "2-digit",
       month: "2-digit",
       year: "numeric",
       hour: "2-digit",
       minute: "2-digit",
     });
 
     const html = generateExecutivePdf(profile, plan, meals, generatedAt);
 
     return new Response(JSON.stringify({ html }), {
       status: 200,
       headers: { ...corsHeaders, "Content-Type": "application/json" },
     });
   } catch (error: any) {
     console.error("Error generating PDF:", error);
     return new Response(
       JSON.stringify({ error: error.message || "Erro interno" }),
       {
         status: 500,
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       }
     );
   }
 });