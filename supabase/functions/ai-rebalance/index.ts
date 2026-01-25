import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealOptionFood {
  id: string;
  meal_option_id: string;
  food_id: string;
  quantity_grams: number;
  food: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string | null;
    category: string | null;
  };
}

interface MealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  meal_option_foods: MealOptionFood[];
}

interface Meal {
  id: string;
  name: string;
  meal_options: MealOption[];
}

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AdjustmentProposal {
  mealOptionFoodId: string;
  mealId: string;
  mealOptionId: string;
  mealName: string;
  foodName: string;
  foodId: string;
  originalGrams: number;
  newGrams: number;
  reason: string;
}

interface AIRebalanceResponse {
  success: boolean;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros: MacroTargets;
  adjustments: AdjustmentProposal[];
  explanation: string;
  warnings: string[];
}

type UserGoal = 'gain_muscle' | 'lose_weight' | 'maintain';

interface GoalTolerances {
  calories: { ideal: [number, number]; acceptable: [number, number]; warning: string };
  protein: { ideal: [number, number]; minimum: number; warning: string };
  carbs: { acceptable: [number, number] };
  fat: { acceptable: [number, number]; minWarning: string };
}

const GOAL_TOLERANCES: Record<UserGoal, GoalTolerances> = {
  gain_muscle: {
    calories: { 
      ideal: [98, 102], 
      acceptable: [95, 105],
      warning: "Abaixo de 95% compromete ganho muscular; acima de 105% favorece acúmulo de gordura"
    },
    protein: { 
      ideal: [100, 105], 
      minimum: 95,
      warning: "Proteína NUNCA pode ficar abaixo de 90% para hipertrofia"
    },
    carbs: { acceptable: [90, 110] },
    fat: { 
      acceptable: [85, 110],
      minWarning: "Gordura não pode cair abaixo do piso fisiológico"
    }
  },
  lose_weight: {
    calories: { 
      ideal: [90, 92], 
      acceptable: [88, 94],
      warning: "Abaixo de 88% causa perda de massa muscular; acima de 95% impede emagrecimento"
    },
    protein: { 
      ideal: [100, 105], 
      minimum: 95,
      warning: "Em cutting, proteína é CRÍTICA - não existe margem para baixo"
    },
    carbs: { acceptable: [80, 100] },
    fat: { 
      acceptable: [80, 100],
      minWarning: "Gordura deve respeitar piso mínimo fisiológico"
    }
  },
  maintain: {
    calories: { 
      ideal: [98, 102], 
      acceptable: [95, 105],
      warning: "Manutenção é tolerante, mas evitar desvios extremos"
    },
    protein: { 
      ideal: [95, 100], 
      minimum: 90,
      warning: "Proteína pode variar um pouco sem grande impacto"
    },
    carbs: { acceptable: [85, 115] },
    fat: { 
      acceptable: [80, 120],
      minWarning: "Gordura é flexível, mas não pode faltar demais"
    }
  }
};

function getGoalContext(goal: UserGoal): string {
  const tolerances = GOAL_TOLERANCES[goal];
  const goalNames: Record<UserGoal, string> = {
    gain_muscle: 'GANHO DE MASSA (hipertrofia/bulking)',
    lose_weight: 'EMAGRECIMENTO (cutting)',
    maintain: 'MANUTENÇÃO'
  };

  return `
## OBJETIVO DO USUÁRIO: ${goalNames[goal]}

### MARGENS DE TOLERÂNCIA PARA ESTE OBJETIVO:

🔢 CALORIAS:
- Faixa IDEAL: ${tolerances.calories.ideal[0]}–${tolerances.calories.ideal[1]}% da meta
- Faixa ACEITÁVEL: ${tolerances.calories.acceptable[0]}–${tolerances.calories.acceptable[1]}%
- ⚠️ ${tolerances.calories.warning}

🥩 PROTEÍNA:
- Faixa IDEAL: ${tolerances.protein.ideal[0]}–${tolerances.protein.ideal[1]}% da meta
- MÍNIMO ABSOLUTO: ${tolerances.protein.minimum}%
- ⚠️ ${tolerances.protein.warning}

🍚 CARBOIDRATOS:
- Margem ACEITÁVEL: ${tolerances.carbs.acceptable[0]}–${tolerances.carbs.acceptable[1]}%

🥑 GORDURAS:
- Margem ACEITÁVEL: ${tolerances.fat.acceptable[0]}–${tolerances.fat.acceptable[1]}%
- ⚠️ ${tolerances.fat.minWarning}

### PRIORIDADE DE AJUSTE PARA ${goalNames[goal].toUpperCase()}:
${goal === 'gain_muscle' ? `
1. CALORIAS devem estar entre 98-102% (CRÍTICO para síntese proteica)
2. PROTEÍNA deve atingir 100% (fundamento da hipertrofia)
3. CARBOIDRATOS fornecem energia para treino - manter acima de 90%
4. GORDURAS são flexíveis desde que não caiam demais` : ''}
${goal === 'lose_weight' ? `
1. PROTEÍNA é PRIORIDADE #1 - manter 100%+ para preservar massa magra
2. CALORIAS devem ficar em déficit controlado (90-92% ideal)
3. GORDURAS manter no mínimo fisiológico
4. CARBOIDRATOS são os mais flexíveis para reduzir` : ''}
${goal === 'maintain' ? `
1. CALORIAS próximas de 100% (margem ampla de 95-105%)
2. PROTEÍNA acima de 95% para manter massa
3. CARBOIDRATOS e GORDURAS são muito flexíveis` : ''}
`;
}

/**
 * Extrai o peso base em gramas do serving_size.
 * Os macros no banco são sempre "por porção" onde a porção é definida em serving_size.
 * Se serving_size = "100g", então calories/protein/carbs/fat são por 100g.
 * Se serving_size = "1 unidade (50g)", então são por 50g.
 */
function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  // Prioriza formato "(XXg)" ou "(XXml)"
  const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  // Fallback para "XXg" ou "XXml"
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  return 100;
}

/**
 * Calcula macros totais a partir dos alimentos.
 * IMPORTANTE: Os valores de macros no banco são POR PORÇÃO (serving_size).
 * Para obter o valor real, multiplicamos por (quantity_grams / serving_grams).
 */
function calculateMacros(foods: MealOptionFood[]): MacroTargets {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  
  for (const mof of foods) {
    const servingGrams = parseServingGrams(mof.food.serving_size);
    const ratio = mof.quantity_grams / servingGrams;
    
    calories += mof.food.calories * ratio;
    protein += mof.food.protein * ratio;
    carbs += mof.food.carbs * ratio;
    fat += mof.food.fat * ratio;
  }
  
  return {
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

/**
 * Calcula o percentual de atingimento de cada macro
 */
function calculateAccuracy(current: MacroTargets, target: MacroTargets): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  average: number;
  minAccuracy: number;
} {
  const caloriesAcc = target.calories > 0 ? (current.calories / target.calories) * 100 : 100;
  const proteinAcc = target.protein > 0 ? (current.protein / target.protein) * 100 : 100;
  const carbsAcc = target.carbs > 0 ? (current.carbs / target.carbs) * 100 : 100;
  const fatAcc = target.fat > 0 ? (current.fat / target.fat) * 100 : 100;
  
  return {
    calories: Math.round(caloriesAcc * 10) / 10,
    protein: Math.round(proteinAcc * 10) / 10,
    carbs: Math.round(carbsAcc * 10) / 10,
    fat: Math.round(fatAcc * 10) / 10,
    average: Math.round(((caloriesAcc + proteinAcc + carbsAcc + fatAcc) / 4) * 10) / 10,
    minAccuracy: Math.min(caloriesAcc, proteinAcc, carbsAcc, fatAcc),
  };
}

/**
 * Calcula contribuição de um alimento por 100g
 */
function getFoodContribution(food: MealOptionFood["food"]): MacroTargets {
  const servingGrams = parseServingGrams(food.serving_size);
  return {
    calories: (food.calories / servingGrams) * 100,
    protein: (food.protein / servingGrams) * 100,
    carbs: (food.carbs / servingGrams) * 100,
    fat: (food.fat / servingGrams) * 100,
  };
}

interface FoodWithMeta extends MealOptionFood {
  mealName: string;
  mealId: string;
  optionId: string;
}

/**
 * REFINAMENTO MATEMÁTICO DETERMINÍSTICO
 * Ajusta as porções para atingir 99.8%+ de cada meta
 */
function refineAdjustmentsToTarget(
  foods: FoodWithMeta[],
  currentQuantities: Map<string, number>,
  targets: MacroTargets,
  maxIterations: number = 20
): Map<string, number> {
  const quantities = new Map(currentQuantities);
  const TARGET_ACCURACY = 99.8;
  const MAX_ACCURACY = 100.2;
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Calcular macros atuais
    const currentMacros = calculateMacrosFromMap(foods, quantities);
    const accuracy = calculateAccuracy(currentMacros, targets);
    
    // Verificar se já atingiu a precisão desejada
    if (accuracy.minAccuracy >= TARGET_ACCURACY && accuracy.minAccuracy <= MAX_ACCURACY) {
      console.log(`Refinamento concluído na iteração ${iteration + 1}: ${accuracy.minAccuracy.toFixed(1)}%`);
      break;
    }
    
    // Identificar o macro mais distante da meta
    const deficits = [
      { macro: 'calories' as const, diff: targets.calories - currentMacros.calories, acc: accuracy.calories },
      { macro: 'protein' as const, diff: targets.protein - currentMacros.protein, acc: accuracy.protein },
      { macro: 'carbs' as const, diff: targets.carbs - currentMacros.carbs, acc: accuracy.carbs },
      { macro: 'fat' as const, diff: targets.fat - currentMacros.fat, acc: accuracy.fat },
    ];
    
    // Ordenar por maior distância da meta (99.8-100.2%)
    deficits.sort((a, b) => {
      const aDistance = Math.min(Math.abs(a.acc - TARGET_ACCURACY), Math.abs(a.acc - MAX_ACCURACY));
      const bDistance = Math.min(Math.abs(b.acc - TARGET_ACCURACY), Math.abs(b.acc - MAX_ACCURACY));
      return bDistance - aDistance;
    });
    
    const mainDeficit = deficits[0];
    
    // Se já está muito próximo, parar
    if (Math.abs(mainDeficit.diff) < 0.5) {
      console.log(`Refinamento concluído: diferença mínima atingida`);
      break;
    }
    
    // Encontrar o melhor alimento para ajustar este macro
    let bestFood: FoodWithMeta | null = null;
    let bestGramsChange = 0;
    let bestImpactScore = Infinity;
    
    for (const food of foods) {
      const contribution = getFoodContribution(food.food);
      const macroValue = contribution[mainDeficit.macro];
      
      if (macroValue <= 0) continue;
      
      // Calcular quantos gramas precisamos mudar
      const gramsNeeded = (mainDeficit.diff * 100) / macroValue;
      const currentGrams = quantities.get(food.id) || food.quantity_grams;
      const newGrams = currentGrams + gramsNeeded;
      
      // Validar limites
      if (newGrams < 15 || newGrams > 450) continue;
      
      // Calcular impacto nos outros macros
      let impactScore = 0;
      for (const otherDeficit of deficits) {
        if (otherDeficit.macro === mainDeficit.macro) continue;
        const otherContribution = contribution[otherDeficit.macro];
        const otherChange = (gramsNeeded / 100) * otherContribution;
        // Penalizar se o ajuste piora outro macro
        if ((otherDeficit.diff > 0 && otherChange < 0) || (otherDeficit.diff < 0 && otherChange > 0)) {
          impactScore += Math.abs(otherChange) * 2;
        } else {
          impactScore -= Math.abs(otherChange) * 0.5; // Bonus se ajuda outro macro
        }
      }
      
      if (impactScore < bestImpactScore) {
        bestFood = food;
        bestGramsChange = gramsNeeded;
        bestImpactScore = impactScore;
      }
    }
    
    if (bestFood) {
      const currentGrams = quantities.get(bestFood.id) || bestFood.quantity_grams;
      const newGrams = Math.round(Math.max(15, Math.min(450, currentGrams + bestGramsChange)));
      quantities.set(bestFood.id, newGrams);
    } else {
      // Sem alimento ideal, tentar ajuste proporcional em todos
      const scaleFactor = mainDeficit.diff > 0 ? 1.02 : 0.98;
      for (const food of foods) {
        const contribution = getFoodContribution(food.food);
        if (contribution[mainDeficit.macro] > 0) {
          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const newGrams = Math.round(Math.max(15, Math.min(450, currentGrams * scaleFactor)));
          quantities.set(food.id, newGrams);
        }
      }
    }
  }
  
  return quantities;
}

function calculateMacrosFromMap(foods: FoodWithMeta[], quantities: Map<string, number>): MacroTargets {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  
  for (const food of foods) {
    const grams = quantities.get(food.id) || food.quantity_grams;
    const servingGrams = parseServingGrams(food.food.serving_size);
    const ratio = grams / servingGrams;
    
    calories += food.food.calories * ratio;
    protein += food.food.protein * ratio;
    carbs += food.food.carbs * ratio;
    fat += food.food.fat * ratio;
  }
  
  return {
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId, targets, goal } = await req.json();

    if (!planId || !targets) {
      return new Response(
        JSON.stringify({ error: "planId and targets are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar refeições com opções e alimentos
    const { data: meals, error: mealsError } = await supabase
      .from("meals")
      .select(`
        id,
        name,
        meal_options (
          id,
          meal_id,
          option_number,
          name,
          meal_option_foods (
            id,
            meal_option_id,
            food_id,
            quantity_grams,
            food:foods (
              id,
              name,
              calories,
              protein,
              carbs,
              fat,
              serving_size,
              category
            )
          )
        )
      `)
      .eq("diet_plan_id", planId)
      .order("sort_order");

    if (mealsError) throw mealsError;

    const typedMeals = meals as unknown as Meal[];

    // Coletar todos os alimentos da primeira opção de cada refeição
    const allFoods: MealOptionFood[] = [];
    const allFoodsWithMeta: FoodWithMeta[] = [];
    const mealContexts: { mealId: string; mealName: string; optionId: string; foods: MealOptionFood[] }[] = [];

    for (const meal of typedMeals) {
      const firstOption = meal.meal_options.find(o => o.option_number === 1);
      if (firstOption) {
        mealContexts.push({
          mealId: meal.id,
          mealName: meal.name,
          optionId: firstOption.id,
          foods: firstOption.meal_option_foods,
        });
        allFoods.push(...firstOption.meal_option_foods);
        // Adicionar metadados para refinamento
        for (const food of firstOption.meal_option_foods) {
          allFoodsWithMeta.push({
            ...food,
            mealName: meal.name,
            mealId: meal.id,
            optionId: firstOption.id,
          });
        }
      }
    }

    // Calcular macros atuais
    const currentMacros = calculateMacros(allFoods);

    // ========================================
    // VERIFICAÇÃO: Plano já está otimizado?
    // ========================================
    // Determinar objetivo do usuário para pegar as tolerâncias corretas
    const userGoalCheck: UserGoal = goal || 'maintain';
    const tolerances = GOAL_TOLERANCES[userGoalCheck];
    
    // Calcular percentuais atuais para verificação
    const currentCaloriesPercent = (currentMacros.calories / targets.calories) * 100;
    const currentProteinPercent = (currentMacros.protein / targets.protein) * 100;
    const currentCarbsPercent = (currentMacros.carbs / targets.carbs) * 100;
    const currentFatPercent = (currentMacros.fat / targets.fat) * 100;
    
    // Verificar se todos os macros estão dentro da faixa aceitável
    const caloriesInRange = currentCaloriesPercent >= tolerances.calories.acceptable[0] && 
                           currentCaloriesPercent <= tolerances.calories.acceptable[1];
    const proteinInRange = currentProteinPercent >= tolerances.protein.minimum;
    const carbsInRange = currentCarbsPercent >= tolerances.carbs.acceptable[0] && 
                        currentCarbsPercent <= tolerances.carbs.acceptable[1];
    const fatInRange = currentFatPercent >= tolerances.fat.acceptable[0] && 
                      currentFatPercent <= tolerances.fat.acceptable[1];
    
    const allInAcceptableRange = caloriesInRange && proteinInRange && carbsInRange && fatInRange;
    
    if (allInAcceptableRange) {
      console.log(`Plano já otimizado: Cal ${currentCaloriesPercent.toFixed(1)}%, Prot ${currentProteinPercent.toFixed(1)}%, Carb ${currentCarbsPercent.toFixed(1)}%, Fat ${currentFatPercent.toFixed(1)}%`);
      
      // Construir mensagem amigável com os percentuais
      const goalNames: Record<UserGoal, string> = {
        gain_muscle: 'ganho de massa',
        lose_weight: 'emagrecimento',
        maintain: 'manutenção'
      };
      
      const buildOptimizedMessage = () => {
        const parts: string[] = [];
        parts.push(`Calorias: ${Math.round(currentCaloriesPercent)}%`);
        parts.push(`Proteína: ${Math.round(currentProteinPercent)}%`);
        parts.push(`Carboidratos: ${Math.round(currentCarbsPercent)}%`);
        parts.push(`Gordura: ${Math.round(currentFatPercent)}%`);
        return parts.join(', ');
      };
      
      return new Response(JSON.stringify({
        success: true,
        alreadyOptimized: true,
        currentMacros: {
          calories: Math.round(currentMacros.calories),
          protein: Math.round(currentMacros.protein),
          carbs: Math.round(currentMacros.carbs),
          fat: Math.round(currentMacros.fat),
        },
        targetMacros: targets,
        currentPercentages: {
          calories: Math.round(currentCaloriesPercent),
          protein: Math.round(currentProteinPercent),
          carbs: Math.round(currentCarbsPercent),
          fat: Math.round(currentFatPercent),
        },
        message: `Seu plano já está excelente para ${goalNames[userGoalCheck]}! Você está em ${buildOptimizedMessage()} da meta.`,
        warning: `Não há necessidade de otimizar novamente. Rebalancear um plano que já está dentro das metas pode desestabilizá-lo e atrapalhar seus resultados. Confie no processo e siga o plano atual!`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Preparar contexto para a IA
    const mealDetails = mealContexts.map(ctx => ({
      mealName: ctx.mealName,
      foods: ctx.foods.map(f => {
        const servingGrams = parseServingGrams(f.food.serving_size);
        return {
          id: f.id,
          name: f.food.name,
          grams: f.quantity_grams,
          // Normalizar para por 100g para que a IA faça cálculos consistentes
          per100g: {
            calories: Math.round((f.food.calories / servingGrams) * 100),
            protein: Math.round(((f.food.protein / servingGrams) * 100) * 10) / 10,
            carbs: Math.round(((f.food.carbs / servingGrams) * 100) * 10) / 10,
            fat: Math.round(((f.food.fat / servingGrams) * 100) * 10) / 10,
          },
          category: f.food.category,
          servingSize: f.food.serving_size,
        };
      }),
    }));

    // Determinar objetivo do usuário (default: maintain se não fornecido)
    const userGoal: UserGoal = goal || 'maintain';
    const goalContext = getGoalContext(userGoal);
    
    // Calcular percentuais atuais
    const caloriesPercent = Math.round((currentMacros.calories / targets.calories) * 100);
    const proteinPercent = Math.round((currentMacros.protein / targets.protein) * 100);
    const carbsPercent = Math.round((currentMacros.carbs / targets.carbs) * 100);
    const fatPercent = Math.round((currentMacros.fat / targets.fat) * 100);

    const systemPrompt = `Você é um nutricionista MATEMÁTICO expert em ajuste de planos alimentares. Sua especialidade é calcular ajustes EXATOS de porções para atingir metas nutricionais com PRECISÃO DE 99%+.

VOCÊ DEVE FAZER CÁLCULOS MATEMÁTICOS PRECISOS:
1. Calcule a diferença exata entre macros atuais e metas
2. Para cada macro fora da faixa, calcule EXATAMENTE quantos gramas de cada alimento ajustar
3. Use a fórmula: gramas_adicionais = (diferença_macro * 100) / (macro_por_100g_do_alimento)
4. Considere o impacto cruzado: ajustar proteína também afeta calorias/gordura

REGRAS CRÍTICAS:
1. O OBJETIVO É ATINGIR 99-101% DE CADA META - não 95%, não 105%, mas 99-101%
2. Faça múltiplos ajustes simultâneos se necessário para equilibrar todos os macros
3. Priorize alimentos com maior concentração do macro que precisa ajustar
4. Mantenha proporções razoáveis (mínimo 20g, máximo 400g por alimento)
5. Se um ajuste prejudica outro macro, compense com outro alimento
6. Para proteína: carnes, ovos, laticínios, leguminosas
7. Para carboidratos: arroz, batata, pães, frutas
8. Para gordura: azeite, castanhas, queijos
9. VALIDE seus cálculos antes de responder - some os macros propostos e confirme que atingem 99%+`;

    const userPrompt = `TAREFA: Calcular ajustes EXATOS para atingir 99-101% de cada meta nutricional.

${goalContext}

═══════════════════════════════════════════════════════════
METAS (100% = objetivo)
═══════════════════════════════════════════════════════════
• Calorias: ${targets.calories} kcal
• Proteína: ${targets.protein}g  
• Carboidratos: ${targets.carbs}g
• Gordura: ${targets.fat}g

═══════════════════════════════════════════════════════════
SITUAÇÃO ATUAL (precisa chegar a 99-101%)
═══════════════════════════════════════════════════════════
• Calorias: ${currentMacros.calories} kcal (${caloriesPercent}%) → FALTAM ${targets.calories - currentMacros.calories} kcal
• Proteína: ${currentMacros.protein}g (${proteinPercent}%) → FALTAM ${targets.protein - currentMacros.protein}g
• Carboidratos: ${currentMacros.carbs}g (${carbsPercent}%) → FALTAM ${targets.carbs - currentMacros.carbs}g
• Gordura: ${currentMacros.fat}g (${fatPercent}%) → FALTAM ${targets.fat - currentMacros.fat}g

═══════════════════════════════════════════════════════════
ALIMENTOS DISPONÍVEIS (valores por 100g)
═══════════════════════════════════════════════════════════
${JSON.stringify(mealDetails, null, 2)}

═══════════════════════════════════════════════════════════
INSTRUÇÕES DE CÁLCULO
═══════════════════════════════════════════════════════════
1. Para cada macro fora de 99-101%, identifique os melhores alimentos para ajustar
2. Calcule: gramas_necessários = (diferença * 100) / macro_por_100g
3. Distribua o ajuste entre múltiplos alimentos se necessário
4. VERIFIQUE: some todos os macros após ajustes e confirme 99-101%
5. Se um ajuste desbalanceia outro macro, adicione ajuste compensatório

EXEMPLO DE CÁLCULO:
- Faltam 20g de proteína
- Frango tem 31g proteína/100g
- Gramas necessários = (20 * 100) / 31 = 64.5g → arredondar para 65g

RETORNE JSON:
{
  "adjustments": [
    {
      "foodItemId": "id do meal_option_food",
      "newGrams": número calculado,
      "reason": "Adicionar Xg para +Yg proteína (cálculo: ...)"
    }
  ],
  "explanation": "Resumo: após ajustes, macros ficam em X% cal, Y% prot, Z% carb, W% fat",
  "warnings": ["avisos se algum macro não atingiu 99%"]
}`;

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_adjustments",
              description: "Propõe ajustes de porções para o plano alimentar",
              parameters: {
                type: "object",
                properties: {
                  adjustments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        foodItemId: { type: "string" },
                        newGrams: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["foodItemId", "newGrams", "reason"],
                    },
                  },
                  explanation: { type: "string" },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["adjustments", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_adjustments" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    
    // Extrair resultado do tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const aiResult = JSON.parse(toolCall.function.arguments);

    // Criar mapa de quantidades iniciais (baseado na IA)
    const aiQuantities = new Map<string, number>();
    for (const food of allFoodsWithMeta) {
      const adj = aiResult.adjustments?.find((a: { foodItemId: string }) => a.foodItemId === food.id);
      if (adj) {
        aiQuantities.set(food.id, Math.round(Math.max(15, Math.min(450, adj.newGrams))));
      } else {
        aiQuantities.set(food.id, food.quantity_grams);
      }
    }

    // Verificar precisão da proposta da IA
    const aiProposedMacros = calculateMacrosFromMap(allFoodsWithMeta, aiQuantities);
    const aiAccuracy = calculateAccuracy(aiProposedMacros, targets);
    
    console.log(`IA propôs: Cal ${aiAccuracy.calories.toFixed(1)}%, Prot ${aiAccuracy.protein.toFixed(1)}%, Carb ${aiAccuracy.carbs.toFixed(1)}%, Fat ${aiAccuracy.fat.toFixed(1)}%`);
    
    // REFINAMENTO MATEMÁTICO: Se a IA não atingiu 99.8%, refinar deterministicamente
    const TARGET_MIN = 99.5;
    const TARGET_MAX = 100.5;
    let finalQuantities = aiQuantities;
    let refinementApplied = false;
    
    if (aiAccuracy.minAccuracy < TARGET_MIN || aiAccuracy.minAccuracy > TARGET_MAX) {
      console.log(`Aplicando refinamento matemático (accuracy atual: ${aiAccuracy.minAccuracy.toFixed(1)}%)`);
      finalQuantities = refineAdjustmentsToTarget(allFoodsWithMeta, aiQuantities, targets, 25);
      refinementApplied = true;
    }

    // Mapear ajustes finais
    const adjustments: AdjustmentProposal[] = [];
    
    for (const food of allFoodsWithMeta) {
      const finalGrams = finalQuantities.get(food.id) || food.quantity_grams;
      
      // Só incluir se houve mudança significativa (>= 3g)
      if (Math.abs(finalGrams - food.quantity_grams) >= 3) {
        const aiAdj = aiResult.adjustments?.find((a: { foodItemId: string; reason?: string }) => a.foodItemId === food.id);
        const isIncrease = finalGrams > food.quantity_grams;
        const diff = Math.round(finalGrams - food.quantity_grams);
        
        // Gerar razão sem mencionar porcentagens técnicas
        let reason = '';
        if (aiAdj?.reason) {
          // Limpar razão da IA para remover detalhes técnicos
          reason = aiAdj.reason
            .replace(/\d+\.?\d*%/g, '') // Remove porcentagens
            .replace(/para atingir \d+/gi, '')
            .replace(/cálculo:.*$/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
          // Se ficou vazia após limpeza, gerar uma nova
          if (reason.length < 10) {
            reason = `${isIncrease ? 'Aumentar' : 'Reduzir'} porção em ${Math.abs(diff)}g`;
          }
        } else {
          reason = `${isIncrease ? 'Aumentar' : 'Reduzir'} porção em ${Math.abs(diff)}g`;
        }
        
        adjustments.push({
          mealOptionFoodId: food.id,
          mealId: food.mealId,
          mealOptionId: food.optionId,
          mealName: food.mealName,
          foodName: food.food.name,
          foodId: food.food_id,
          originalGrams: food.quantity_grams,
          newGrams: Math.round(finalGrams),
          reason,
        });
      }
    }

    // Calcular macros propostos finais
    const proposedMacros = calculateMacrosFromMap(allFoodsWithMeta, finalQuantities);
    const finalAccuracy = calculateAccuracy(proposedMacros, targets);
    
    console.log(`Final: Cal ${finalAccuracy.calories.toFixed(1)}%, Prot ${finalAccuracy.protein.toFixed(1)}%, Carb ${finalAccuracy.carbs.toFixed(1)}%, Fat ${finalAccuracy.fat.toFixed(1)}%`);

    // Construir explicação amigável com validação de limites
    const buildFriendlyExplanation = () => {
      const goalNames: Record<UserGoal, string> = {
        gain_muscle: 'ganho de massa',
        lose_weight: 'emagrecimento',
        maintain: 'manutenção'
      };
      
      // Verificar se os macros propostos estão dentro dos limites aceitáveis
      const proposedCalPercent = Math.round((proposedMacros.calories / targets.calories) * 100);
      const proposedProtPercent = Math.round((proposedMacros.protein / targets.protein) * 100);
      const proposedCarbsPercent = Math.round((proposedMacros.carbs / targets.carbs) * 100);
      const proposedFatPercent = Math.round((proposedMacros.fat / targets.fat) * 100);
      
      const calInRange = proposedCalPercent >= tolerances.calories.acceptable[0] && 
                         proposedCalPercent <= tolerances.calories.acceptable[1];
      const protInRange = proposedProtPercent >= tolerances.protein.minimum;
      const carbsInRange = proposedCarbsPercent >= tolerances.carbs.acceptable[0] && 
                          proposedCarbsPercent <= tolerances.carbs.acceptable[1];
      const fatInRange = proposedFatPercent >= tolerances.fat.acceptable[0] && 
                        proposedFatPercent <= tolerances.fat.acceptable[1];
      
      const allWithinLimits = calInRange && protInRange && carbsInRange && fatInRange;
      
      // Gerar explicação baseada nos alimentos ajustados
      const increases = adjustments.filter(adj => adj.newGrams > adj.originalGrams);
      const decreases = adjustments.filter(adj => adj.newGrams < adj.originalGrams);
      
      let adjustmentSummary = '';
      if (increases.length > 0 && decreases.length > 0) {
        const increaseNames = increases.slice(0, 2).map(a => a.foodName).join(' e ');
        const decreaseNames = decreases.slice(0, 2).map(a => a.foodName).join(' e ');
        adjustmentSummary = `Aumentamos ${increaseNames} e reduzimos ${decreaseNames}`;
      } else if (increases.length > 0) {
        const names = increases.slice(0, 3).map(a => a.foodName).join(', ');
        adjustmentSummary = `Aumentamos as porções de ${names}`;
      } else if (decreases.length > 0) {
        const names = decreases.slice(0, 3).map(a => a.foodName).join(', ');
        adjustmentSummary = `Reduzimos as porções de ${names}`;
      }
      
      // Construir explicação com validação de limites
      if (adjustments.length === 0) {
        return 'Seu plano já está bem equilibrado. Não foram necessários ajustes significativos.';
      }
      
      let explanation = adjustmentSummary + '. ';
      
      if (allWithinLimits) {
        explanation += `Com esses ajustes, seu plano fica dentro dos limites recomendados para ${goalNames[userGoal]}: `;
        explanation += `calorias em ${proposedCalPercent}% da meta (faixa aceitável: ${tolerances.calories.acceptable[0]}-${tolerances.calories.acceptable[1]}%), `;
        explanation += `proteína em ${proposedProtPercent}% (mínimo: ${tolerances.protein.minimum}%).`;
      } else {
        const issues: string[] = [];
        if (!calInRange) issues.push(`calorias (${proposedCalPercent}%)`);
        if (!protInRange) issues.push(`proteína (${proposedProtPercent}%)`);
        if (!carbsInRange) issues.push(`carboidratos (${proposedCarbsPercent}%)`);
        if (!fatInRange) issues.push(`gordura (${proposedFatPercent}%)`);
        
        explanation += `A maioria dos macros está adequada, mas ${issues.join(' e ')} `;
        explanation += `podem precisar de ajuste manual para otimizar ainda mais seu plano para ${goalNames[userGoal]}.`;
      }
      
      return explanation;
    };
    
    const explanation = buildFriendlyExplanation();

    // Warnings
    const warnings: string[] = aiResult.warnings || [];
    if (finalAccuracy.minAccuracy < 99) {
      warnings.push(`Atenção: Precisão de ${finalAccuracy.minAccuracy.toFixed(1)}% em um dos macros. Considere ajustar manualmente.`);
    }

    const response: AIRebalanceResponse = {
      success: true,
      currentMacros: {
        calories: Math.round(currentMacros.calories),
        protein: Math.round(currentMacros.protein),
        carbs: Math.round(currentMacros.carbs),
        fat: Math.round(currentMacros.fat),
      },
      targetMacros: targets,
      proposedMacros: {
        calories: Math.round(proposedMacros.calories),
        protein: Math.round(proposedMacros.protein),
        carbs: Math.round(proposedMacros.carbs),
        fat: Math.round(proposedMacros.fat),
      },
      adjustments,
      explanation,
      warnings,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Rebalance error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro interno ao processar rebalanceamento" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
