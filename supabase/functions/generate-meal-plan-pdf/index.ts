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
  morning_snack: "Lanche Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

const TIPS: Record<string, string[]> = {
  lose_weight: [
    "Priorize proteínas para saciedade",
    "Beba 2L de água/dia",
    "Vegetais verdes à vontade",
  ],
  maintain: [
    "Mantenha horários consistentes",
    "Varie frutas e vegetais",
    "Proteínas preservam massa muscular",
  ],
  gain_muscle: [
    "Distribua proteínas ao longo do dia",
    "Carboidratos complexos = energia",
    "Proteína pós-treino em 2h",
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

  // Calculate density for font sizing
  const mealCount = meals.length;
  const optionCount = meals.reduce((acc, m) => acc + (m.options?.length || 0), 0);
  const foodRowCount = meals.reduce(
    (acc, m) => acc + (m.options || []).reduce((acc2, opt) => acc2 + (opt.foods?.length || 0), 0),
    0
  );

  // Adaptive font size based on content density
  const densityScore = foodRowCount + optionCount * 2 + mealCount * 4;
  
  let baseFontPt = 8;
  let tableFontPt = 7;
  let mealGapPx = 8;
  let cellPadPx = 3;
  
  if (densityScore > 100) {
    baseFontPt = 6.5;
    tableFontPt = 6;
    mealGapPx = 4;
    cellPadPx = 2;
  } else if (densityScore > 80) {
    baseFontPt = 7;
    tableFontPt = 6.5;
    mealGapPx = 5;
    cellPadPx = 2;
  } else if (densityScore > 60) {
    baseFontPt = 7.5;
    tableFontPt = 6.5;
    mealGapPx = 6;
    cellPadPx = 3;
  }

  // Generate meals HTML
  const mealsHtml = meals
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((meal) => {
      const mealLabel = MEAL_LABELS[meal.name] || meal.name;
      const optionsHtml = meal.options
        .map((opt) => {
          const foodsHtml = opt.foods
            .map((f) => `<tr><td>${f.name}</td><td class="tc">${f.quantity}</td><td class="tr">${f.calories}</td><td class="tr">${f.protein}g</td><td class="tr">${f.carbs}g</td><td class="tr">${f.fat}g</td></tr>`)
            .join("");

          return `
            <div class="opt">
              ${meal.options.length > 1 ? `<div class="opt-label">Opção ${opt.option_number}</div>` : ''}
              <table class="foods">
                <thead><tr><th style="width:38%">Alimento</th><th style="width:17%" class="tc">Qtd</th><th style="width:11%" class="tr">Kcal</th><th style="width:11%" class="tr">P</th><th style="width:11%" class="tr">C</th><th style="width:11%" class="tr">G</th></tr></thead>
                <tbody>${foodsHtml}</tbody>
              </table>
            </div>`;
        })
        .join("");

      return `
        <div class="meal">
          <div class="meal-hdr"><span>${mealLabel}</span><span class="kcal">${meal.total_calories || 0} kcal</span></div>
          <div class="meal-body">${optionsHtml}</div>
        </div>`;
    })
    .join("");

  const tipsHtml = tips.map((tip, i) => `${i + 1}. ${tip}`).join(" · ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { 
      size: 210mm 297mm; 
      margin: 0; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { 
      width: 210mm; 
      height: 297mm; 
      margin: 0; 
      padding: 0;
    }
    body { 
      font-family: 'Segoe UI', -apple-system, sans-serif;
      font-size: ${baseFontPt}pt;
      line-height: 1.25;
      color: #1f2937;
      background: #fff;
      display: flex;
      justify-content: center;
      align-items: stretch;
    }
    .page {
      width: 190mm;
      height: 287mm;
      margin: 5mm auto;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding-bottom: 6px; 
      margin-bottom: 8px; 
      border-bottom: 2px solid #3b82f6;
      flex-shrink: 0;
    }
    .header h1 { font-size: 16pt; font-weight: 700; }
    .header .meta { text-align: right; font-size: ${baseFontPt}pt; color: #6b7280; }
    .header .brand { font-weight: 600; color: #3b82f6; }
    
    .profile { 
      display: flex; 
      gap: 8px; 
      margin-bottom: 10px;
      flex-shrink: 0;
    }
    .profile-card { 
      flex: 1; 
      background: #f8fafc; 
      border-radius: 6px; 
      padding: 8px 10px; 
      border: 1px solid #e2e8f0; 
    }
    .profile-label { 
      font-size: ${baseFontPt - 1}pt; 
      color: #6b7280; 
      text-transform: uppercase; 
      letter-spacing: 0.03em; 
      font-weight: 600; 
      margin-bottom: 4px; 
    }
    .profile-content { 
      font-size: ${baseFontPt}pt; 
      display: flex; 
      flex-wrap: wrap; 
      gap: 4px; 
      align-items: center; 
    }
    .profile-content .name { font-weight: 700; font-size: ${baseFontPt + 1}pt; }
    .profile-content .sep { color: #cbd5e1; }
    .goal-badge { 
      background: #3b82f6; 
      color: #fff; 
      padding: 3px 8px; 
      border-radius: 12px; 
      font-size: ${baseFontPt - 0.5}pt; 
      font-weight: 600; 
      margin-top: 4px; 
      display: inline-block; 
    }
    .macro-value { font-size: 20pt; font-weight: 800; color: #f59e0b; }
    .macro-unit { font-size: ${baseFontPt + 1}pt; color: #6b7280; }
    .macros { display: flex; gap: 10px; font-size: ${baseFontPt}pt; margin-top: 4px; }
    .macros span { font-weight: 700; }
    .macros .p { color: #3b82f6; }
    .macros .c { color: #eab308; }
    .macros .g { color: #f97316; }
    
    .meals-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .meals-title { 
      font-size: ${baseFontPt + 2}pt; 
      font-weight: 700; 
      margin: 0 0 6px 0; 
      padding-bottom: 4px; 
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
    }
    .meals-grid { 
      flex: 1;
      display: flex; 
      flex-direction: column; 
      gap: ${mealGapPx}px;
      justify-content: space-between;
    }
    .meal { 
      border-radius: 6px; 
      overflow: hidden; 
      border: 1px solid #e2e8f0;
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .meal-hdr { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      background: linear-gradient(135deg, #3b82f6, #2563eb); 
      color: #fff; 
      padding: 5px 10px; 
      font-size: ${baseFontPt + 1}pt; 
      font-weight: 700;
      flex-shrink: 0;
    }
    .meal-hdr .kcal { 
      font-size: ${baseFontPt}pt; 
      background: rgba(255,255,255,0.2); 
      padding: 2px 8px; 
      border-radius: 10px; 
      font-weight: 600; 
    }
    .meal-body { 
      padding: 6px 8px; 
      background: #fff;
      flex: 1;
    }
    .opt { margin-bottom: 4px; }
    .opt:last-child { margin-bottom: 0; }
    .opt-label { font-size: ${tableFontPt}pt; color: #6b7280; font-weight: 600; margin-bottom: 3px; }
    
    .foods { 
      width: 100%; 
      border-collapse: collapse; 
      font-size: ${tableFontPt}pt; 
      table-layout: fixed; 
    }
    .foods thead tr { background: #f1f5f9; }
    .foods th { 
      padding: ${cellPadPx}px 4px; 
      text-align: left; 
      font-weight: 600; 
      font-size: ${tableFontPt - 0.5}pt; 
      text-transform: uppercase; 
    }
    .foods td { 
      padding: ${cellPadPx}px 4px; 
      border-bottom: 1px solid #f1f5f9; 
    }
    .tc { text-align: center; }
    .tr { text-align: right; }
    
    .tips { 
      background: #fffbeb; 
      border-radius: 6px; 
      padding: 6px 10px; 
      border-left: 3px solid #f59e0b; 
      margin-top: 10px;
      flex-shrink: 0;
    }
    .tips-title { font-weight: 700; color: #92400e; font-size: ${baseFontPt}pt; margin-bottom: 3px; }
    .tips-content { font-size: ${baseFontPt - 0.5}pt; color: #78350f; line-height: 1.4; }
    
    .footer { 
      text-align: center; 
      padding-top: 8px; 
      margin-top: 10px;
      border-top: 1px solid #e2e8f0; 
      font-size: ${baseFontPt - 1}pt; 
      color: #9ca3af;
      flex-shrink: 0;
    }
    
    @media print {
      html, body { width: 210mm; height: 297mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>🥗 Plano Alimentar</h1>
      <div class="meta">${generatedAt}<br><span class="brand">NutriAI</span></div>
    </div>
    
    <div class="profile">
      <div class="profile-card">
        <div class="profile-label">👤 Paciente</div>
        <div class="profile-content">
          <span class="name">${profile.name || "—"}</span>
          <span class="sep">•</span>
          <span>${profile.age ? `${profile.age} anos` : "—"}</span>
          <span class="sep">•</span>
          <span>${profile.weight ? `${profile.weight} kg` : "—"}</span>
          <span class="sep">•</span>
          <span>${profile.height ? `${profile.height} cm` : "—"}</span>
        </div>
        <span class="goal-badge">${goalLabel}</span>
      </div>
      
      <div class="profile-card">
        <div class="profile-label">🎯 Metas Diárias</div>
        <div><span class="macro-value">${plan.total_calories}</span> <span class="macro-unit">kcal</span></div>
        <div class="macros">
          <span class="p">${plan.total_protein}g P</span>
          <span class="c">${plan.total_carbs}g C</span>
          <span class="g">${plan.total_fat}g G</span>
        </div>
      </div>
    </div>
    
    <div class="meals-section">
      <div class="meals-title">🍽️ Refeições</div>
      <div class="meals-grid">${mealsHtml}</div>
    </div>
    
    <div class="tips">
      <div class="tips-title">💡 Dicas</div>
      <div class="tips-content">${tipsHtml}</div>
    </div>
    
    <div class="footer"><strong>NutriAI</strong> · nutria-plan-wise.lovable.app · Consulte sempre um nutricionista</div>
  </div>
</body>
</html>`;
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
