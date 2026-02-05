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
     "Combine a dieta com atividade física regular",
   ],
   maintain: [
     "Mantenha consistência nos horários das refeições",
     "Inclua variedade de frutas e vegetais coloridos",
     "Proteínas são importantes para preservar massa muscular",
     "Monitore seu peso semanalmente para ajustes finos",
   ],
   gain_muscle: [
     "Distribua proteínas ao longo do dia (0.3-0.5g/kg por refeição)",
     "Carboidratos complexos são seus aliados para energia",
     "Consuma proteína nas 2 horas pós-treino",
     "Sono de qualidade é essencial para recuperação",
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
 
   // Generate meals HTML
   const mealsHtml = meals
     .sort((a, b) => a.sort_order - b.sort_order)
     .map((meal) => {
       const mealLabel = MEAL_LABELS[meal.name] || meal.name;
       const optionsHtml = meal.options
         .map((opt) => {
           const foodsHtml = opt.foods
             .map(
               (f) => `
             <tr style="font-size: 8pt;">
               <td style="padding: 3px 6px; border-bottom: 1px solid #e5e7eb;">${f.name}</td>
               <td style="padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: center;">${f.quantity}</td>
               <td style="padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">${f.calories}</td>
               <td style="padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">${f.protein}g</td>
               <td style="padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">${f.carbs}g</td>
               <td style="padding: 3px 6px; border-bottom: 1px solid #e5e7eb; text-align: right;">${f.fat}g</td>
             </tr>
           `
             )
             .join("");
 
           return `
           <div style="margin-bottom: 8px;">
             <div style="font-size: 8pt; color: #6b7280; margin-bottom: 4px;">Opção ${opt.option_number}</div>
             <table style="width: 100%; border-collapse: collapse;">
               <thead>
                 <tr style="background: #f9fafb; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.05em;">
                   <th style="padding: 4px 6px; text-align: left; font-weight: 600;">Alimento</th>
                   <th style="padding: 4px 6px; text-align: center; font-weight: 600;">Qtd</th>
                   <th style="padding: 4px 6px; text-align: right; font-weight: 600;">Kcal</th>
                   <th style="padding: 4px 6px; text-align: right; font-weight: 600;">Prot</th>
                   <th style="padding: 4px 6px; text-align: right; font-weight: 600;">Carb</th>
                   <th style="padding: 4px 6px; text-align: right; font-weight: 600;">Gord</th>
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
         <div style="margin-bottom: 16px; page-break-inside: avoid;">
           <div style="display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 8px 12px; border-radius: 6px 6px 0 0;">
             <span style="font-weight: 600; font-size: 10pt;">${mealLabel}</span>
             <span style="font-size: 8pt; opacity: 0.9;">${meal.total_calories || 0} kcal</span>
           </div>
           <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 6px 6px; padding: 10px;">
             ${optionsHtml}
           </div>
         </div>
       `;
     })
     .join("");
 
   // Generate tips HTML
   const tipsHtml = tips
     .map(
       (tip) => `
       <li style="margin-bottom: 6px; padding-left: 8px; border-left: 2px solid #3b82f6;">${tip}</li>
     `
     )
     .join("");
 
   return `
 <!DOCTYPE html>
 <html>
 <head>
   <meta charset="UTF-8">
   <style>
     @page { 
       size: Executive; 
       margin: 15mm 12mm; 
     }
     * { box-sizing: border-box; }
     body { 
       font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
       font-size: 9pt;
       line-height: 1.4;
       color: #1f2937;
       margin: 0;
       padding: 0;
     }
   </style>
 </head>
 <body>
   <!-- Header com Logo e Dados do Usuário -->
   <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px;">
     <div>
       <h1 style="font-size: 18pt; font-weight: 700; color: #1f2937; margin: 0 0 4px 0;">
         🥗 Plano Alimentar Personalizado
       </h1>
       <p style="font-size: 9pt; color: #6b7280; margin: 0;">
         NutriAI • Seu assistente nutricional inteligente
       </p>
     </div>
     <div style="text-align: right; font-size: 8pt; color: #6b7280;">
       <p style="margin: 0;">Gerado em: ${generatedAt}</p>
     </div>
   </div>
 
   <!-- Dados do Perfil -->
   <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
     <div style="background: #f8fafc; border-radius: 8px; padding: 14px;">
       <h3 style="font-size: 10pt; font-weight: 600; color: #374151; margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
         👤 Dados Pessoais
       </h3>
       <table style="width: 100%; font-size: 9pt;">
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Nome:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${profile.name || "Não informado"}</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Idade:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${profile.age ? `${profile.age} anos` : "Não informado"}</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Peso:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${profile.weight ? `${profile.weight} kg` : "Não informado"}</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Altura:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${profile.height ? `${profile.height} cm` : "Não informado"}</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Objetivo:</td>
           <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #3b82f6;">${goalLabel}</td>
         </tr>
       </table>
     </div>
 
     <div style="background: #f8fafc; border-radius: 8px; padding: 14px;">
       <h3 style="font-size: 10pt; font-weight: 600; color: #374151; margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
         🎯 Metas Nutricionais
       </h3>
       <table style="width: 100%; font-size: 9pt;">
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Calorias Diárias:</td>
           <td style="padding: 4px 0; font-weight: 600; text-align: right; color: #f59e0b;">${plan.total_calories} kcal</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Meta de Calorias:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${targetCalories} kcal</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Balanço:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right; color: ${caloricDiff > 50 ? '#22c55e' : caloricDiff < -50 ? '#ef4444' : '#6b7280'};">
             ${caloricStatus}
           </td>
         </tr>
         <tr style="border-top: 1px solid #e5e7eb;">
           <td style="padding: 6px 0 4px 0; color: #6b7280;">Proteína:</td>
           <td style="padding: 6px 0 4px 0; font-weight: 500; text-align: right;">${plan.total_protein}g</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Carboidratos:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${plan.total_carbs}g</td>
         </tr>
         <tr>
           <td style="padding: 4px 0; color: #6b7280;">Gordura:</td>
           <td style="padding: 4px 0; font-weight: 500; text-align: right;">${plan.total_fat}g</td>
         </tr>
       </table>
     </div>
   </div>
 
   <!-- Refeições -->
   <div style="margin-bottom: 20px;">
     <h2 style="font-size: 12pt; font-weight: 600; color: #1f2937; margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
       🍽️ Refeições do Dia
     </h2>
     ${mealsHtml}
   </div>
 
   <!-- Dicas -->
   <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px; padding: 14px; page-break-inside: avoid;">
     <h3 style="font-size: 10pt; font-weight: 600; color: #92400e; margin: 0 0 10px 0; display: flex; align-items: center; gap: 6px;">
       💡 Dicas para ${goalLabel}
     </h3>
     <ul style="margin: 0; padding: 0; list-style: none; font-size: 9pt; color: #78350f;">
       ${tipsHtml}
     </ul>
   </div>
 
   <!-- Footer -->
   <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 7pt; color: #9ca3af; text-align: center;">
     <p style="margin: 0;">
       Este plano foi gerado automaticamente pelo NutriAI. Consulte um nutricionista para orientação personalizada.
     </p>
     <p style="margin: 4px 0 0 0;">
       nutria-plan-wise.lovable.app
     </p>
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