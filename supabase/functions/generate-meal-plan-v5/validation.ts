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
 * Calcula totais de macros para uma lista de opções.
 */
function calculateOptionTotals(options: MealResult[]): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const meal of options) {
    totalCals += meal.totals.calories;
    totalProt += meal.totals.protein;
    totalCarbs += meal.totals.carbs;
    totalFat += meal.totals.fat;
  }
  return {
    calories: Math.round(totalCals),
    protein: Math.round(totalProt * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
  };
}

/**
 * Valida uma opção específica contra os contratos nutricionais.
 */
function validateSingleOption(
  mealsWithOptions: MealWithOptions[],
  optionIndex: number,
  targets: MacroTargets
): { warnings: string[]; metrics: ReturnType<typeof validateGeneratedPlan>['metrics'] } {
  const warnings: string[] = [];
  const optionNum = optionIndex + 1;
  
  // Coletar refeições para esta opção
  const meals: MealResult[] = [];
  for (const mealData of mealsWithOptions) {
    const option = mealData.options[optionIndex];
    if (option) {
      meals.push(option);
    }
  }
  
  if (meals.length === 0) {
    return { warnings: [], metrics: { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, caloriePercent: 0, proteinPercent: 0, carbsPercent: 0, fatPercentOfCals: 0 } };
  }
  
  // Calcular totais
  const totals = calculateOptionTotals(meals);
  
  // Coletar proteína por refeição e índices de refeições principais
  const mealProteinValues: number[] = [];
  const mainMealIndices: number[] = [];
  
  for (let i = 0; i < mealsWithOptions.length; i++) {
    const mealData = mealsWithOptions[i];
    const option = mealData.options[optionIndex];
    if (option) {
      mealProteinValues.push(option.totals.protein);
      if (MAIN_MEALS.includes(mealData.mealType)) {
        mainMealIndices.push(i);
      }
    }
  }
  
  // Validar contra contratos
  const contractValidation = validateGeneratedPlan(
    totals,
    targets,
    mealProteinValues,
    mainMealIndices
  );
  
  // Converter erros em warnings com prefixo de opção
  for (const error of contractValidation.errors) {
    if (optionIndex === 0) {
      // Opção 1: manter mensagem original
      warnings.push(error);
    } else {
      // Opções 2/3: adicionar prefixo
      const prefix = `[OPT${optionNum}] `;
      warnings.push(prefix + error);
    }
  }
  
  return {
    warnings,
    metrics: contractValidation.metrics,
  };
}

/**
 * Valida contratos nutricionais do plano.
 * TODAS as opções são validadas com os mesmos contratos.
 */
export function validateNutritionalContracts(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets
): NutritionalValidation {
  const errors: string[] = [];
  const allWarnings: string[] = [];
  let primaryMetrics: ReturnType<typeof validateGeneratedPlan>['metrics'] | null = null;
  
  // Determinar quantas opções existem (usar a primeira refeição como referência)
  const maxOptions = mealsWithOptions.reduce(
    (max, m) => Math.max(max, m.options.length),
    0
  );
  
  logDebug(`Validando ${maxOptions} opção(ões) contra contratos nutricionais`);
  
  // Validar cada opção
  for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
    const { warnings, metrics } = validateSingleOption(mealsWithOptions, optIdx, targets);
    
    // Guardar métricas da opção principal (1)
    if (optIdx === 0) {
      primaryMetrics = metrics;
    }
    
    allWarnings.push(...warnings);
    
    // Log de validação por opção
    if (warnings.length > 0) {
      logDebug(`Opção ${optIdx + 1}: ${warnings.length} aviso(s)`, {
        calories: metrics.totalCalories,
        caloriePercent: metrics.caloriePercent,
        proteinPercent: metrics.proteinPercent,
      });
    }
  }
  
  // Validação estrutural adicional para opções 2/3
  for (const mealData of mealsWithOptions) {
    for (let optIdx = 1; optIdx < mealData.options.length; optIdx++) {
      const option = mealData.options[optIdx];
      const optionNum = optIdx + 1;
      
      // Validar estrutura do almoço/jantar
      if (mealData.mealType === "lunch" || mealData.mealType === "dinner") {
        const categories = new Set(option.foods.map((f) => (f.food.category || "").toLowerCase()));
        
        if (!categories.has("carboidratos")) {
          allWarnings.push(`[OPT${optionNum}] ${option.meal_name}: sem carboidrato base`);
        }
        if (!categories.has("proteinas")) {
          allWarnings.push(`[OPT${optionNum}] ${option.meal_name}: sem proteína principal`);
        }
      }
      
      // Validar café da manhã
      if (mealData.mealType === "breakfast") {
        const hasProteinSource = option.foods.some((f) => {
          const cat = (f.food.category || "").toLowerCase();
          return cat === "proteinas" || cat === "laticinios";
        });
        if (!hasProteinSource) {
          allWarnings.push(`[OPT${optionNum}] ${option.meal_name}: sem fonte de proteína`);
        }
      }
    }
  }

  return {
    valid: true, // Gerador sempre passa - rebalanceador corrige se necessário
    errors,
    warnings: allWarnings,
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
