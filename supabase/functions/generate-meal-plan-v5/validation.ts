// =====================================================
// VALIDAÇÃO DO PLANO
// =====================================================

import type { MealResult, MealWithOptions, MacroTargets, StructuralValidation, NutritionalValidation } from "./types.ts";
import { ITEM_COUNTS, MAIN_MEALS } from "./constants.ts";
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
  const errors: string[] = [];
  const warnings: string[] = [];
  let primaryMetrics = null;

  // Descobrir quantas opções existem (máximo entre todas as refeições)
  const maxOptions = Math.max(...mealsWithOptions.map(m => m.options.length));

  // Validar CADA opção separadamente
  for (let optionIdx = 0; optionIdx < maxOptions; optionIdx++) {
    let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
    const mealProteinValues: number[] = [];
    const mainMealIndices: number[] = [];
    let optionHasData = false;

    for (let mealIdx = 0; mealIdx < mealsWithOptions.length; mealIdx++) {
      const mealData = mealsWithOptions[mealIdx];
      const option = mealData.options[optionIdx];
      
      if (!option) continue; // Esta refeição não tem esta opção
      
      optionHasData = true;
      totalCals += option.totals.calories;
      totalProt += option.totals.protein;
      totalCarbs += option.totals.carbs;
      totalFat += option.totals.fat;
      mealProteinValues.push(option.totals.protein);

      if (MAIN_MEALS.includes(mealData.mealType)) {
        mainMealIndices.push(mealIdx);
      }

      // Validar proteína mínima por refeição
      const isMainMeal = MAIN_MEALS.includes(mealData.mealType);
      const minProtein = isMainMeal 
        ? GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS 
        : GENERATOR_CONTRACT.MIN_PROTEIN_SNACK_GRAMS;
      
      if (option.totals.protein < minProtein) {
        const optLabel = optionIdx === 0 ? '' : ` opção ${optionIdx + 1}`;
        warnings.push(
          `[G1-OPT${optionIdx + 1}] ${option.meal_name}${optLabel}: proteína baixa (${option.totals.protein.toFixed(1)}g < ${minProtein}g)`
        );
      }
    }

    // Pular se não há dados para esta opção
    if (!optionHasData) continue;

    const totals = {
      calories: totalCals,
      protein: totalProt,
      carbs: totalCarbs,
      fat: totalFat,
    };

    // Validar contratos gerais para esta opção
    const contractValidation = validateGeneratedPlan(
      totals,
      targets,
      mealProteinValues,
      mainMealIndices
    );

    // Guardar métricas da opção 1 como referência principal
    if (optionIdx === 0) {
      primaryMetrics = contractValidation.metrics;
    }

    // Adicionar erros/warnings com identificador de opção
    for (const error of contractValidation.errors) {
      const optLabel = optionIdx === 0 ? '' : ` [Opção ${optionIdx + 1}]`;
      warnings.push(`${error}${optLabel}`);
    }

    // Log de validação por opção
    logDebug(`Opção ${optionIdx + 1}: Cal=${totals.calories.toFixed(0)}, Prot=${totals.protein.toFixed(1)}g, Carbs=${totals.carbs.toFixed(1)}g, Fat=${totals.fat.toFixed(1)}g`);
  }

  return {
    valid: true, // Gerador sempre passa - rebalanceador corrige
    errors,
    warnings,
    metrics: primaryMetrics || {
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      caloriePercent: 0,
      proteinPercent: 0,
      carbsPercent: 0,
      fatPercentOfCals: 0,
    },
  };
}
