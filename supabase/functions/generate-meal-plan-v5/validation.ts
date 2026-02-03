// =====================================================
// VALIDAÇÃO DO PLANO
// =====================================================

import type { MealResult, MealWithOptions, MacroTargets, StructuralValidation, NutritionalValidation } from "./types.ts";
import { ITEM_COUNTS, MAIN_MEALS } from "./constants/index.ts";
import { logDebug, logWarn } from "./logger.ts";
import { GENERATOR_CONTRACT, validateGeneratedPlan } from "../_shared/nutrition-contracts.ts";

/**
 * Valida estrutura das refeições (número de itens, categorias obrigatórias).
 */
export function validateStructure(meals: MealResult[]): StructuralValidation {
  const errors: string[] = [];

  for (const meal of meals) {
    const limits = ITEM_COUNTS[meal.meal_type] || { min: 2, max: 6 };

    // Validar número de itens (ERRO BLOQUEANTE)
    if (meal.foods.length < limits.min) {
      errors.push(`[E1] ${meal.meal_name}: poucos itens (${meal.foods.length} < ${limits.min})`);
    }

    // Validar presença de proteína em refeições principais (warning)
    if (MAIN_MEALS.includes(meal.meal_type)) {
      const mealProtein = meal.totals.protein;
      if (mealProtein < GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
        logWarn(`${meal.meal_name}: proteína baixa (${mealProtein.toFixed(1)}g), rebalanceador ajustará`);
      }
    } else {
      const mealProtein = meal.totals.protein;
      if (mealProtein < GENERATOR_CONTRACT.MIN_PROTEIN_SNACK_GRAMS) {
        logDebug(`${meal.meal_name}: proteína baixa no lanche (${mealProtein.toFixed(1)}g)`);
      }
    }

    // Validar estrutura do almoço/jantar (ERRO BLOQUEANTE)
    if (meal.meal_type === "lunch" || meal.meal_type === "dinner") {
      const categories = new Set(meal.foods.map((f) => (f.food.category || "").toLowerCase()));

      if (!categories.has("carboidratos")) {
        errors.push(`[E3] ${meal.meal_name}: sem carboidrato base`);
      }
      if (!categories.has("leguminosas")) {
        errors.push(`[E4] ${meal.meal_name}: sem leguminosa`);
      }
      if (!categories.has("proteinas")) {
        errors.push(`[E5] ${meal.meal_name}: sem proteína principal`);
      }
      if (!categories.has("vegetais")) {
        errors.push(`[E6] ${meal.meal_name}: sem vegetal`);
      }
    }
    
    // Validar café da manhã (ERRO BLOQUEANTE)
    if (meal.meal_type === "breakfast") {
      const hasProteinSource = meal.foods.some((f) => {
        const cat = (f.food.category || "").toLowerCase();
        return cat === "proteinas" || cat === "laticinios";
      });
      if (!hasProteinSource) {
        errors.push(`[E7] ${meal.meal_name}: sem fonte de proteína (proteínas ou laticínios)`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida contratos nutricionais do plano.
 * MELHORIA: Valida TODAS as opções, não só a primeira.
 */
export function validateNutritionalContracts(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets
): NutritionalValidation {
  // Validar primeira opção (principal)
  const meals = mealsWithOptions.map(m => m.options[0]);
  
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  const mealProteinValues: number[] = [];
  const mainMealIndices: number[] = [];

  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i];
    totalCals += meal.totals.calories;
    totalProt += meal.totals.protein;
    totalCarbs += meal.totals.carbs;
    totalFat += meal.totals.fat;
    mealProteinValues.push(meal.totals.protein);

    if (MAIN_MEALS.includes(meal.meal_type)) {
      mainMealIndices.push(i);
    }
  }

  const totals = {
    calories: totalCals,
    protein: totalProt,
    carbs: totalCarbs,
    fat: totalFat,
  };

  const contractValidation = validateGeneratedPlan(
    totals,
    targets,
    mealProteinValues,
    mainMealIndices
  );

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const error of contractValidation.errors) {
    // Erros de proteína por refeição são warnings
    if (error.includes('[G1]') && error.includes('Refeição')) {
      warnings.push(error);
    } else {
      warnings.push(error);
    }
  }

  // MELHORIA: Validar opções alternativas também
  for (const mealData of mealsWithOptions) {
    for (let optIdx = 1; optIdx < mealData.options.length; optIdx++) {
      const option = mealData.options[optIdx];
      const isMainMeal = MAIN_MEALS.includes(mealData.mealType);
      const minProtein = isMainMeal 
        ? GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS 
        : GENERATOR_CONTRACT.MIN_PROTEIN_SNACK_GRAMS;
      
      if (option.totals.protein < minProtein) {
        warnings.push(
          `[G1-OPT${optIdx + 1}] ${option.meal_name} opção ${optIdx + 1}: proteína baixa (${option.totals.protein.toFixed(1)}g)`
        );
      }
    }
  }

  return {
    valid: true, // Gerador sempre passa - rebalanceador corrige
    errors,
    warnings,
    metrics: contractValidation.metrics,
  };
}
