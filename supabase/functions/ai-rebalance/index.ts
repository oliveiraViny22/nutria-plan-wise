// ============================================
// REBALANCEADOR AUTOMÁTICO NUTRIAPLAN v2
// ============================================
// Implementação conforme especificação:
// - Validação por objetivo (cut/maintain/bulk)
// - Pipeline de 4 etapas (ordem fixa)
// - Máximo de 3 ciclos de correção
// - Formato JSON estruturado
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  KCAL_PER_GRAM,
  REBALANCER_CONTRACT,
} from "../_shared/nutrition-contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TIPOS
// ============================================

type Objective = "cut" | "maintain" | "bulk";

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

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

interface FoodWithMeta extends MealOptionFood {
  mealName: string;
  mealId: string;
  optionId: string;
}

interface Adjustment {
  nutrient: "calories" | "protein" | "carbs" | "fat";
  action: "increase" | "decrease";
  delta: string;
}

interface RebalanceResult {
  status: "valid" | "valid_with_alert" | "error";
  objective: Objective;
  iterations: number;
  final_totals: MacroTargets;
  adjustments: Adjustment[];
  food_changes?: Array<{
    food_id: string;
    food_name: string;
    original_grams: number;
    new_grams: number;
  }>;
}

// ============================================
// REGRAS POR OBJETIVO (ESPECIFICAÇÃO)
// ============================================

interface ObjectiveRules {
  calories: { min: number; max: number };
  protein: { min: number };
  carbs?: { min: number };
  fat?: { max: number };
}

const OBJECTIVE_RULES: Record<Objective, ObjectiveRules> = {
  cut: {
    calories: { min: 90, max: 100 },
    protein: { min: 95 },
    fat: { max: 110 },
  },
  maintain: {
    calories: { min: 95, max: 105 },
    protein: { min: 85 },
  },
  bulk: {
    calories: { min: 95, max: 105 },
    protein: { min: 90 },
    carbs: { min: 85 },
    fat: { max: 130 },
  },
};

// ============================================
// LIMITES DE QUANTIDADE POR CATEGORIA
// ============================================

const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  proteinas: { min: 30, max: 350 },
  carboidratos: { min: 40, max: 400 },
  leguminosas: { min: 40, max: 200 },
  vegetais: { min: 30, max: 250 },
  frutas: { min: 50, max: 300 },
  laticinios: { min: 30, max: 300 },
  gorduras: { min: 5, max: 40 },
  oleaginosas: { min: 10, max: 50 },
};

function getCategoryLimits(category: string | null): { min: number; max: number } {
  const cat = (category || "").toLowerCase();
  return CATEGORY_LIMITS[cat] || { min: 20, max: 400 };
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  return 100;
}

function getFoodContributionPer100g(food: MealOptionFood["food"]): MacroTargets {
  const servingGrams = parseServingGrams(food.serving_size);
  return {
    calories: (food.calories / servingGrams) * 100,
    protein: (food.protein / servingGrams) * 100,
    carbs: (food.carbs / servingGrams) * 100,
    fat: (food.fat / servingGrams) * 100,
  };
}

function calculateTotals(
  foods: FoodWithMeta[],
  quantities: Map<string, number>
): MacroTargets {
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
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

function calculatePercents(
  totals: MacroTargets,
  targets: MacroTargets
): { calories: number; protein: number; carbs: number; fat: number } {
  return {
    calories: targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 100,
    protein: targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 100,
    carbs: targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 100,
    fat: targets.fat > 0 ? (totals.fat / targets.fat) * 100 : 100,
  };
}

// ============================================
// VALIDAÇÃO DO PLANO (REGRAS HARD)
// ============================================

function validatePlan(
  totals: MacroTargets,
  targets: MacroTargets,
  objective: Objective
): { valid: boolean; errors: string[] } {
  const rules = OBJECTIVE_RULES[objective];
  const percents = calculatePercents(totals, targets);
  const errors: string[] = [];

  // CALORIAS - regra HARD (fora = plano INVÁLIDO)
  if (percents.calories < rules.calories.min || percents.calories > rules.calories.max) {
    errors.push(
      `Calorias em ${percents.calories.toFixed(1)}% - fora do range [${rules.calories.min}%, ${rules.calories.max}%]`
    );
  }

  // PROTEÍNA - mínimo obrigatório
  if (percents.protein < rules.protein.min) {
    errors.push(
      `Proteína em ${percents.protein.toFixed(1)}% - abaixo do mínimo ${rules.protein.min}%`
    );
  }

  // CARBOIDRATOS - apenas para bulk
  if (rules.carbs && percents.carbs < rules.carbs.min) {
    errors.push(
      `Carboidratos em ${percents.carbs.toFixed(1)}% - abaixo do mínimo ${rules.carbs.min}%`
    );
  }

  // GORDURA - máximo
  if (rules.fat && percents.fat > rules.fat.max) {
    errors.push(
      `Gordura em ${percents.fat.toFixed(1)}% - acima do máximo ${rules.fat.max}%`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// PIPELINE DE CORREÇÃO (4 ETAPAS)
// ============================================

function runCorrectionPipeline(
  foods: FoodWithMeta[],
  quantities: Map<string, number>,
  targets: MacroTargets,
  objective: Objective,
  maxCycles: number = 3
): { quantities: Map<string, number>; adjustments: Adjustment[]; iterations: number; converged: boolean } {
  const adjustments: Adjustment[] = [];
  let iterations = 0;

  // Pré-calcular contribuições por 100g
  const contributions = new Map<string, MacroTargets>();
  for (const food of foods) {
    contributions.set(food.id, getFoodContributionPer100g(food.food));
  }

  // Categorizar alimentos
  const proteinFoods = foods.filter(f => {
    const c = contributions.get(f.id)!;
    return c.protein >= 15;
  }).sort((a, b) => {
    const cA = contributions.get(a.id)!;
    const cB = contributions.get(b.id)!;
    // Ratio proteína/gordura (maior = melhor para cortar)
    const ratioA = cA.fat > 0 ? cA.protein / cA.fat : cA.protein * 10;
    const ratioB = cB.fat > 0 ? cB.protein / cB.fat : cB.protein * 10;
    return ratioB - ratioA;
  });

  const carbFoods = foods.filter(f => {
    const c = contributions.get(f.id)!;
    return c.carbs >= 20;
  }).sort((a, b) => {
    const cA = contributions.get(a.id)!;
    const cB = contributions.get(b.id)!;
    return cB.carbs - cA.carbs;
  });

  const fatFoods = foods.filter(f => {
    const c = contributions.get(f.id)!;
    const cat = (f.food.category || "").toLowerCase();
    return c.fat >= 10 || cat === "gorduras" || cat === "oleaginosas";
  }).sort((a, b) => {
    const cA = contributions.get(a.id)!;
    const cB = contributions.get(b.id)!;
    return cB.fat - cA.fat;
  });

  const rules = OBJECTIVE_RULES[objective];

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    iterations = cycle + 1;
    const before = calculateTotals(foods, quantities);
    const validation = validatePlan(before, targets, objective);

    if (validation.valid) {
      console.log(`Plano válido após ${iterations} ciclo(s)`);
      return { quantities, adjustments, iterations, converged: true };
    }

    console.log(`Ciclo ${iterations}: ${validation.errors.join("; ")}`);

    const percents = calculatePercents(before, targets);

    // ==========================================
    // ETAPA 1: CALORIAS
    // ==========================================
    const caloriesDiff = before.calories - targets.calories;
    const caloriesPercent = percents.calories;

    if (caloriesPercent < rules.calories.min || caloriesPercent > rules.calories.max) {
      const needDecrease = caloriesPercent > rules.calories.max;
      const targetCaloriesPercent = needDecrease ? rules.calories.max : rules.calories.min;
      const targetCalories = targets.calories * (targetCaloriesPercent / 100);
      const caloriesToAdjust = before.calories - targetCalories;

      if (Math.abs(caloriesToAdjust) > 10) {
        // Prioridade: 1. Gordura, 2. Carboidrato, 3. Proteína (só se excedente)
        const foodsToAdjust = needDecrease
          ? [...fatFoods, ...carbFoods]
          : [...carbFoods, ...proteinFoods];

        let remainingCals = Math.abs(caloriesToAdjust);

        for (const food of foodsToAdjust) {
          if (remainingCals <= 10) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.calories <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          // Calcular gramas necessários
          const gramsForCals = (remainingCals * 100) / contrib.calories;
          let gramsToChange = Math.min(gramsForCals, needDecrease ? currentGrams - limits.min : limits.max - currentGrams);

          if (gramsToChange < 5) continue;

          const newGrams = needDecrease
            ? Math.max(limits.min, currentGrams - gramsToChange)
            : Math.min(limits.max, currentGrams + gramsToChange);

          const actualChange = Math.abs(newGrams - currentGrams);
          const calsChanged = (actualChange / 100) * contrib.calories;

          quantities.set(food.id, Math.round(newGrams));
          remainingCals -= calsChanged;
        }

        adjustments.push({
          nutrient: "calories",
          action: needDecrease ? "decrease" : "increase",
          delta: `${needDecrease ? "-" : "+"}${Math.round(Math.abs(caloriesToAdjust))}kcal`,
        });
      }
    }

    // Recalcular após ajuste de calorias
    const afterCalories = calculateTotals(foods, quantities);
    const afterCaloriesPercents = calculatePercents(afterCalories, targets);

    // ==========================================
    // ETAPA 2: PROTEÍNA
    // ==========================================
    if (afterCaloriesPercents.protein < rules.protein.min) {
      const proteinTarget = (targets.protein * rules.protein.min / 100);
      let remainingProtein = proteinTarget - afterCalories.protein;
      const initialProteinNeeded = remainingProtein;

      if (remainingProtein > 1) {
        for (const food of proteinFoods) {
          if (remainingProtein <= 1) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.protein <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          const gramsNeeded = (remainingProtein * 100) / contrib.protein;
          const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams);

          if (gramsToAdd < 5) continue;

          // Para CUT: não adicionar calorias
          if (objective === "cut") {
            const calsToAdd = (gramsToAdd / 100) * contrib.calories;
            if (calsToAdd > 50) continue; // Limitar impacto calórico
          }

          const newGrams = Math.min(limits.max, currentGrams + gramsToAdd);
          const actualGramsAdded = newGrams - currentGrams;
          quantities.set(food.id, Math.round(newGrams));

          const proteinAdded = (actualGramsAdded / 100) * contrib.protein;
          remainingProtein -= proteinAdded;
          console.log(`Etapa 2: +${Math.round(actualGramsAdded)}g ${food.food.name} (+${proteinAdded.toFixed(1)}g prot)`);
        }

        adjustments.push({
          nutrient: "protein",
          action: "increase",
          delta: `+${Math.round(initialProteinNeeded)}g`,
        });
      }
    }

    // Recalcular após proteína
    const afterProtein = calculateTotals(foods, quantities);
    const afterProteinPercents = calculatePercents(afterProtein, targets);

    // ==========================================
    // ETAPA 3: CARBOIDRATOS (apenas bulk)
    // ==========================================
    if (rules.carbs && afterProteinPercents.carbs < rules.carbs.min) {
      const carbsNeeded = (targets.carbs * rules.carbs.min / 100) - afterProtein.carbs;

      if (carbsNeeded > 5) {
        for (const food of carbFoods) {
          if (carbsNeeded <= 0) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.carbs <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          const gramsNeeded = (carbsNeeded * 100) / contrib.carbs;
          const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams);

          if (gramsToAdd < 10) continue;

          const newGrams = Math.min(limits.max, currentGrams + gramsToAdd);
          quantities.set(food.id, Math.round(newGrams));
        }

        adjustments.push({
          nutrient: "carbs",
          action: "increase",
          delta: `+${Math.round(carbsNeeded)}g`,
        });
      }
    }

    // Recalcular após carbs
    const afterCarbs = calculateTotals(foods, quantities);
    const afterCarbsPercents = calculatePercents(afterCarbs, targets);

    // ==========================================
    // ETAPA 4: GORDURA (reduzir se acima do máx)
    // ==========================================
    if (rules.fat && afterCarbsPercents.fat > rules.fat.max) {
      const fatTarget = (targets.fat * rules.fat.max / 100);
      let remainingFatExcess = afterCarbs.fat - fatTarget;
      const initialFatExcess = remainingFatExcess;

      if (remainingFatExcess > 1) {
        for (const food of fatFoods) {
          if (remainingFatExcess <= 1) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.fat <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          const gramsNeeded = (remainingFatExcess * 100) / contrib.fat;
          const gramsToRemove = Math.min(gramsNeeded, currentGrams - limits.min);

          if (gramsToRemove < 2) continue;

          // Nunca zerar gordura
          const newGrams = Math.max(limits.min, currentGrams - gramsToRemove);
          const actualGramsRemoved = currentGrams - newGrams;
          quantities.set(food.id, Math.round(newGrams));

          const fatRemoved = (actualGramsRemoved / 100) * contrib.fat;
          remainingFatExcess -= fatRemoved;
          console.log(`Etapa 4: -${Math.round(actualGramsRemoved)}g ${food.food.name} (-${fatRemoved.toFixed(1)}g fat)`);
        }

        adjustments.push({
          nutrient: "fat",
          action: "decrease",
          delta: `-${Math.round(initialFatExcess)}g`,
        });
      }
    }
  }

  return { quantities, adjustments, iterations, converged: false };
}

// ============================================
// MAPEAR GOAL DO USUÁRIO PARA OBJECTIVE
// ============================================

function mapGoalToObjective(goal: string | undefined): Objective {
  if (!goal) return "maintain";
  const g = goal.toLowerCase();
  if (g.includes("lose") || g.includes("cut") || g.includes("emag")) return "cut";
  if (g.includes("gain") || g.includes("bulk") || g.includes("massa") || g.includes("muscle")) return "bulk";
  return "maintain";
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

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

    // Mapear objetivo
    const objective = mapGoalToObjective(goal);
    console.log(`Objetivo: ${objective} (goal recebido: ${goal})`);

    // Buscar refeições
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

    // Coletar todos os alimentos
    const allFoods: FoodWithMeta[] = [];
    const initialQuantities = new Map<string, number>();

    for (const meal of typedMeals) {
      const firstOption = meal.meal_options.find((o) => o.option_number === 1);
      if (firstOption) {
        for (const food of firstOption.meal_option_foods) {
          allFoods.push({
            ...food,
            mealName: meal.name,
            mealId: meal.id,
            optionId: firstOption.id,
          });
          initialQuantities.set(food.id, food.quantity_grams);
        }
      }
    }

    // Calcular totais atuais
    const currentTotals = calculateTotals(allFoods, initialQuantities);
    console.log(`Totais atuais: ${JSON.stringify(currentTotals)}`);
    console.log(`Metas: ${JSON.stringify(targets)}`);

    // Validar plano atual
    const initialValidation = validatePlan(currentTotals, targets, objective);

    if (initialValidation.valid) {
      // Plano já válido
      const result: RebalanceResult = {
        status: "valid",
        objective,
        iterations: 0,
        final_totals: currentTotals,
        adjustments: [],
      };

      console.log("Plano já está válido, nenhum ajuste necessário");

      return new Response(JSON.stringify({
        success: true,
        alreadyOptimized: true,
        result,
        currentMacros: currentTotals,
        targetMacros: targets,
        message: `Seu plano já está dentro dos limites para ${objective === "cut" ? "emagrecimento" : objective === "bulk" ? "ganho de massa" : "manutenção"}.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Criar cópia do mapa inicial (o pipeline modifica in-place)
    const workingQuantities = new Map(initialQuantities);
    
    // Executar pipeline de correção
    const { quantities: finalQuantities, adjustments, iterations, converged } =
      runCorrectionPipeline(allFoods, workingQuantities, targets, objective, 3);

    // Calcular totais finais
    const finalTotals = calculateTotals(allFoods, finalQuantities);
    const finalValidation = validatePlan(finalTotals, targets, objective);

    console.log(`Totais finais: ${JSON.stringify(finalTotals)}`);
    console.log(`Converged: ${converged}, Iterações: ${iterations}`);

    // Determinar status
    let status: "valid" | "valid_with_alert" | "error";
    if (finalValidation.valid) {
      status = "valid";
    } else if (converged) {
      status = "valid_with_alert";
    } else {
      status = "error";
    }

    // Montar mudanças de alimentos
    const foodChanges: Array<{
      food_id: string;
      food_name: string;
      original_grams: number;
      new_grams: number;
    }> = [];

    console.log(`Comparando quantidades (${allFoods.length} alimentos):`);
    for (const food of allFoods) {
      const original = initialQuantities.get(food.id) || food.quantity_grams;
      const final = finalQuantities.get(food.id) || food.quantity_grams;
      const diff = Math.abs(final - original);

      if (diff >= 1) {
        console.log(`  ${food.food.name}: ${original}g → ${final}g (diff: ${diff})`);
      }

      if (diff >= 3) {
        foodChanges.push({
          food_id: food.food_id,
          food_name: food.food.name,
          original_grams: original,
          new_grams: Math.round(final),
        });
      }
    }
    console.log(`Total food_changes: ${foodChanges.length}`);

    const result: RebalanceResult = {
      status,
      objective,
      iterations,
      final_totals: finalTotals,
      adjustments,
      food_changes: foodChanges,
    };

    // Retornar no formato esperado pelo frontend
    return new Response(JSON.stringify({
      success: status !== "error",
      result,
      currentMacros: currentTotals,
      targetMacros: targets,
      proposedMacros: finalTotals,
      adjustments: foodChanges.map((fc) => ({
        mealOptionFoodId: allFoods.find((f) => f.food_id === fc.food_id)?.id,
        mealId: allFoods.find((f) => f.food_id === fc.food_id)?.mealId,
        mealOptionId: allFoods.find((f) => f.food_id === fc.food_id)?.optionId,
        mealName: allFoods.find((f) => f.food_id === fc.food_id)?.mealName,
        foodName: fc.food_name,
        foodId: fc.food_id,
        originalGrams: fc.original_grams,
        newGrams: fc.new_grams,
        reason: `Ajuste para ${objective === "cut" ? "emagrecimento" : objective === "bulk" ? "ganho de massa" : "manutenção"}`,
      })),
      explanation: status === "error"
        ? `Não foi possível atingir as metas em ${iterations} ciclos. Verifique se as metas são realistas para os alimentos disponíveis.`
        : `Plano ajustado em ${iterations} ciclo(s) para ${objective === "cut" ? "emagrecimento" : objective === "bulk" ? "ganho de massa" : "manutenção"}.`,
      warnings: status === "error"
        ? finalValidation.errors
        : status === "valid_with_alert"
        ? ["Plano próximo das metas, mas com pequenos desvios"]
        : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Rebalance error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
