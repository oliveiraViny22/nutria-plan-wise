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
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0;">${f.name}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${f.quantity}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.calories}</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.protein}g</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.carbs}g</td>
                <td style="padding: 6px 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${f.fat}g</td>
              </tr>
            `
              )
              .join("");

            return `
           <div style="margin-bottom: 8px;">
             ${meal.options.length > 1 ? `<div style="font-size: 10pt; color: #6b7280; margin-bottom: 6px; font-weight: 600;">Opção ${opt.option_number}</div>` : ''}
             <table style="width: 100%; border-collapse: collapse; font-size: 10pt; table-layout: fixed;">
                <thead>
                 <tr style="background: #f1f5f9; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.03em;">
                   <th style="padding: 8px 10px; text-align: left; font-weight: 600; width: 38%;">Alimento</th>
                   <th style="padding: 8px 10px; text-align: center; font-weight: 600; width: 17%;">Quantidade</th>
                   <th style="padding: 8px 10px; text-align: right; font-weight: 600; width: 11%;">Kcal</th>
                   <th style="padding: 8px 10px; text-align: right; font-weight: 600; width: 11%;">Prot</th>
                   <th style="padding: 8px 10px; text-align: right; font-weight: 600; width: 11%;">Carb</th>
                   <th style="padding: 8px 10px; text-align: right; font-weight: 600; width: 11%;">Gord</th>
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
         <div style="page-break-inside: avoid; break-inside: avoid; margin-bottom: 16px; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
           <div style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; padding: 10px 16px;">
             <span style="font-weight: 700; font-size: 12pt;">${mealLabel}</span>
             <span style="font-size: 11pt; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">${meal.total_calories || 0} kcal</span>
            </div>
           <div style="border: 1px solid #e2e8f0; border-top: none; padding: 12px 16px; background: #ffffff;">
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
        margin: 10mm 15mm; 
      }
      * { box-sizing: border-box; }
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      body { 
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
        font-size: 10pt;
        line-height: 1.4;
        color: #1f2937;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        min-height: 277mm; /* A4 height minus margins */
      }
      .container {
        width: 100%;
        max-width: 180mm; /* A4 width minus margins */
        margin: 0 auto;
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .header {
        padding-bottom: 12px;
        margin-bottom: 16px;
        border-bottom: 3px solid #3b82f6;
      }
      .profile-section {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
      }
      .profile-card {
        flex: 1;
        background: linear-gradient(135deg, #f8fafc, #f1f5f9);
        border-radius: 12px;
        padding: 16px 20px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      .profile-label {
        font-size: 8pt;
        color: #6b7280;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 600;
      }
      .profile-content {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        font-size: 11pt;
      }
      .meals-section {
        flex: 1;
        margin-bottom: 20px;
      }
      .meals-title {
        font-size: 14pt;
        font-weight: 700;
        color: #1f2937;
        margin: 0 0 16px 0;
        padding-bottom: 8px;
        border-bottom: 2px solid #e2e8f0;
      }
      .meals-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }
      .tips-section {
        background: linear-gradient(135deg, #fffbeb, #fef3c7);
        border-radius: 12px;
        padding: 16px 20px;
        border-left: 4px solid #f59e0b;
        margin-bottom: 16px;
      }
      .tips-title {
        font-weight: 700;
        color: #92400e;
        margin-bottom: 8px;
        font-size: 11pt;
      }
      .tips-content {
        font-size: 10pt;
        color: #78350f;
        line-height: 1.6;
      }
      .footer {
        text-align: center;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
        font-size: 9pt;
        color: #9ca3af;
      }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h1 style="font-size: 22pt; font-weight: 700; color: #1f2937; margin: 0;">
            🥗 Plano Alimentar
          </h1>
          <div style="text-align: right; font-size: 10pt; color: #6b7280;">
            ${generatedAt}<br>
            <span style="font-weight: 600; color: #3b82f6;">NutriAI</span>
          </div>
        </div>
      </div>
     
      <!-- Profile Section -->
      <div class="profile-section">
        <div class="profile-card">
          <div class="profile-label">👤 Perfil do Paciente</div>
          <div class="profile-content">
            <span style="font-weight: 700; font-size: 13pt;">${profile.name || "—"}</span>
            <span style="color: #cbd5e1; font-size: 14pt;">•</span>
            <span>${profile.age ? `${profile.age} anos` : "—"}</span>
            <span style="color: #cbd5e1; font-size: 14pt;">•</span>
            <span>${profile.weight ? `${profile.weight} kg` : "—"}</span>
            <span style="color: #cbd5e1; font-size: 14pt;">•</span>
            <span>${profile.height ? `${profile.height} cm` : "—"}</span>
          </div>
          <div style="margin-top: 8px;">
            <span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 10pt; font-weight: 600;">
              ${goalLabel}
            </span>
          </div>
        </div>
       
        <div class="profile-card">
          <div class="profile-label">🎯 Metas Nutricionais Diárias</div>
          <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 28pt; font-weight: 800; color: #f59e0b;">${plan.total_calories}</span>
            <span style="font-size: 12pt; color: #6b7280;">kcal</span>
          </div>
          <div style="display: flex; gap: 16px; font-size: 12pt;">
            <span style="color: #3b82f6; font-weight: 700;">${plan.total_protein}g <span style="font-weight: 400; color: #6b7280;">Proteína</span></span>
            <span style="color: #eab308; font-weight: 700;">${plan.total_carbs}g <span style="font-weight: 400; color: #6b7280;">Carbos</span></span>
            <span style="color: #f97316; font-weight: 700;">${plan.total_fat}g <span style="font-weight: 400; color: #6b7280;">Gordura</span></span>
          </div>
        </div>
      </div>
     
      <!-- Meals Section -->
      <div class="meals-section">
        <h2 class="meals-title">🍽️ Refeições do Dia</h2>
        <div class="meals-grid">
          ${mealsHtml}
        </div>
      </div>
     
      <!-- Tips Section -->
      <div class="tips-section">
        <div class="tips-title">💡 Dicas para seu objetivo</div>
        <div class="tips-content">${tipsHtml}</div>
      </div>
     
      <!-- Footer -->
      <div class="footer">
        <strong>NutriAI</strong> • nutria-plan-wise.lovable.app • Consulte sempre um nutricionista para orientação personalizada
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