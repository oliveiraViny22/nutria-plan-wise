// =====================================================
// ESCALA CALÓRICA E PROTEICA
// =====================================================

import type { Food, FoodSelection, MealResult, MealWithOptions, MacroTotals, MacroTargets, ScaleResult } from "./types.ts";
import { CATEGORY_SCALE_LIMITS, DEFAULT_SCALE_LIMITS, MAIN_MEALS, SNACK_MEALS } from "./constants/index.ts";
import { applyUnitConversion } from "./unit-conversion.ts";
import { logInfo, logDebug } from "./logger.ts";
import { GENERATOR_CONTRACT } from "../_shared/nutrition-contracts.ts";

/**
 * Obtém limites de escala para um alimento baseado na categoria.
 */
export function getScaleLimitsForFood(food: Food): { min: number; max: number } {
  const category = (food.category || "").toLowerCase();
  return CATEGORY_SCALE_LIMITS[category] || DEFAULT_SCALE_LIMITS;
}

/**
 * Calcula totais de uma lista de refeições (usa primeira opção de cada).
 */
export function calculatePlanTotals(mealsWithOptions: MealWithOptions[]): MacroTotals {
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const mealData of mealsWithOptions) {
    if (mealData.options[0]) {
      totalCals += mealData.options[0].totals.calories;
      totalProt += mealData.options[0].totals.protein;
      totalCarbs += mealData.options[0].totals.carbs;
      totalFat += mealData.options[0].totals.fat;
    }
  }
  return {
    calories: Math.round(totalCals),
    protein: Math.round(totalProt * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
  };
}

/**
 * Recalcula totais de uma opção de refeição.
 */
export function recalculateOptionTotals(option: MealResult): void {
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const sel of option.foods) {
    const mult = sel.quantity_grams / 100;
    totalCals += sel.food.calories * mult;
    totalProt += sel.food.protein * mult;
    totalCarbs += sel.food.carbs * mult;
    totalFat += sel.food.fat * mult;
  }
  option.totals = {
    calories: Math.round(totalCals),
    protein: Math.round(totalProt * 10) / 10,
    carbs: Math.round(totalCarbs * 10) / 10,
    fat: Math.round(totalFat * 10) / 10,
  };
}

/**
 * Verifica e ajusta proteína mínima por refeição.
 * Retorna true se algum ajuste foi feito.
 */
function ensureMinimumProtein(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets
): boolean {
  let adjusted = false;
  
  for (const mealData of mealsWithOptions) {
    for (const option of mealData.options) {
      const isMainMeal = MAIN_MEALS.includes(mealData.mealType);
      const minProtein = isMainMeal 
        ? GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS 
        : GENERATOR_CONTRACT.MIN_PROTEIN_SNACK_GRAMS;
      
      if (option.totals.protein < minProtein) {
        // Encontrar alimento proteico para aumentar
        const proteinFoods = option.foods.filter(f => {
          const cat = (f.food.category || "").toLowerCase();
          return cat === "proteinas" || cat === "laticinios";
        });
        
        if (proteinFoods.length > 0) {
          // Ordenar por densidade proteica (maior primeiro)
          proteinFoods.sort((a, b) => b.food.protein - a.food.protein);
          const target = proteinFoods[0];
          
          // Calcular quanto precisa aumentar
          const proteinDeficit = minProtein - option.totals.protein;
          const proteinPer100g = target.food.protein;
          const gramsNeeded = (proteinDeficit / proteinPer100g) * 100;
          
          const limits = getScaleLimitsForFood(target.food);
          let newGrams = target.quantity_grams + gramsNeeded;
          newGrams = Math.max(limits.min, Math.min(limits.max, newGrams));
          newGrams = Math.round(newGrams / 5) * 5;
          
          if (newGrams > target.quantity_grams) {
            const conversion = applyUnitConversion(target.food, newGrams);
            target.quantity_grams = conversion.calculated_grams;
            target.display_quantity = conversion.display_quantity;
            target.display_unit = conversion.display_unit;
            
            recalculateOptionTotals(option);
            adjusted = true;
            
            logDebug(`Proteína ajustada em ${option.meal_name}`, {
              food: target.food.name,
              newGrams,
              newProtein: option.totals.protein
            });
          }
        }
      }
    }
  }
  
  return adjusted;
}

/**
 * Ajuste fino: incrementa/decrementa porções de alimentos
 * de alta densidade calórica para atingir a meta.
 */
function applyFineAdjustment(
  mealsWithOptions: MealWithOptions[],
  targetCalories: number,
  currentCalories: number
): boolean {
  const deficit = targetCalories - currentCalories;
  if (Math.abs(deficit) < 20) return false;
  
  const needMore = deficit > 0;
  const INCREMENT = 10;
  
  const foodsWithMeta: Array<{
    food: FoodSelection;
    option: MealResult;
    caloriesPerGram: number;
  }> = [];
  
  for (const mealData of mealsWithOptions) {
    for (const option of mealData.options) {
      for (const foodSel of option.foods) {
        foodsWithMeta.push({
          food: foodSel,
          option,
          caloriesPerGram: foodSel.food.calories / 100,
        });
      }
    }
  }
  
  foodsWithMeta.sort((a, b) => 
    needMore 
      ? b.caloriesPerGram - a.caloriesPerGram 
      : a.caloriesPerGram - b.caloriesPerGram
  );
  
  let remaining = Math.abs(deficit);
  let adjusted = false;
  
  for (const { food, option, caloriesPerGram } of foodsWithMeta) {
    if (remaining <= 0) break;
    
    const limits = getScaleLimitsForFood(food.food);
    const currentGrams = food.quantity_grams;
    const gramsNeeded = remaining / caloriesPerGram;
    const maxAdjust = Math.min(gramsNeeded, INCREMENT * 3);
    
    let newGrams = needMore
      ? Math.min(limits.max, currentGrams + maxAdjust)
      : Math.max(limits.min, currentGrams - maxAdjust);
    
    newGrams = Math.round(newGrams / 5) * 5;
    
    if (Math.abs(newGrams - currentGrams) >= 5) {
      const calorieChange = Math.abs(newGrams - currentGrams) * caloriesPerGram;
      remaining -= calorieChange;
      
      const conversion = applyUnitConversion(food.food, newGrams);
      food.quantity_grams = conversion.calculated_grams;
      food.display_quantity = conversion.display_quantity;
      food.display_unit = conversion.display_unit;
      
      adjusted = true;
      recalculateOptionTotals(option);
    }
  }
  
  return adjusted;
}

/**
 * Ajusta proporcionalmente todas as porções para atingir a meta calórica.
 * MELHORIA: Também garante proteína mínima por refeição.
 */
export function scaleToCalorieTarget(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets
): ScaleResult {
  const MAX_ITERATIONS = 5;
  const TOLERANCE_PERCENT = GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT;
  
  const beforeTotals = calculatePlanTotals(mealsWithOptions);
  
  // Se já está dentro da tolerância, verificar apenas proteína
  const initialDiff = Math.abs((beforeTotals.calories - targets.calories) / targets.calories * 100);
  if (initialDiff <= TOLERANCE_PERCENT) {
    const proteinAdjusted = ensureMinimumProtein(mealsWithOptions, targets);
    const afterTotals = calculatePlanTotals(mealsWithOptions);
    
    logInfo("Plano já está dentro da tolerância", { 
      currentCals: beforeTotals.calories, 
      targetCalories: targets.calories, 
      diffPercent: initialDiff.toFixed(1),
      proteinAdjusted
    });
    
    return {
      scaledMeals: mealsWithOptions.map(m => m.options[0]),
      scaleFactor: 1,
      beforeTotals,
      afterTotals,
      iterations: 0,
      converged: true,
      proteinAdjusted,
    };
  }
  
  let iteration = 0;
  let converged = false;
  let lastScaleFactor = 1;
  
  while (iteration < MAX_ITERATIONS && !converged) {
    const currentTotals = calculatePlanTotals(mealsWithOptions);
    const diffPercent = Math.abs((currentTotals.calories - targets.calories) / targets.calories * 100);
    
    if (diffPercent <= TOLERANCE_PERCENT) {
      converged = true;
      break;
    }
    
    const scaleFactor = targets.calories / currentTotals.calories;
    lastScaleFactor = scaleFactor;
    
    logDebug(`Iteração ${iteration + 1}`, { 
      currentCals: currentTotals.calories, 
      targetCalories: targets.calories, 
      scaleFactor: scaleFactor.toFixed(3),
    });
    
    for (const mealData of mealsWithOptions) {
      for (const option of mealData.options) {
        for (const foodSel of option.foods) {
          const limits = getScaleLimitsForFood(foodSel.food);
          let newGrams = foodSel.quantity_grams * scaleFactor;
          
          newGrams = Math.max(limits.min, Math.min(limits.max, newGrams));
          newGrams = Math.round(newGrams / 5) * 5;
          if (newGrams < limits.min) newGrams = limits.min;
          
          const conversion = applyUnitConversion(foodSel.food, newGrams);
          
          foodSel.quantity_grams = conversion.calculated_grams;
          foodSel.display_quantity = conversion.display_quantity;
          foodSel.display_unit = conversion.display_unit;
        }
        
        recalculateOptionTotals(option);
      }
    }
    
    iteration++;
  }
  
  let afterTotals = calculatePlanTotals(mealsWithOptions);
  let finalDiff = Math.abs((afterTotals.calories - targets.calories) / targets.calories * 100);
  converged = finalDiff <= TOLERANCE_PERCENT;
  
  // Ajuste fino se não convergiu
  if (!converged && iteration >= MAX_ITERATIONS) {
    logDebug("Iniciando ajuste fino direcionado");
    if (applyFineAdjustment(mealsWithOptions, targets.calories, afterTotals.calories)) {
      afterTotals = calculatePlanTotals(mealsWithOptions);
      finalDiff = Math.abs((afterTotals.calories - targets.calories) / targets.calories * 100);
      converged = finalDiff <= TOLERANCE_PERCENT;
    }
  }
  
  // MELHORIA: Garantir proteína mínima por refeição
  const proteinAdjusted = ensureMinimumProtein(mealsWithOptions, targets);
  if (proteinAdjusted) {
    afterTotals = calculatePlanTotals(mealsWithOptions);
  }
  
  logInfo("Ajuste iterativo concluído", { 
    before: beforeTotals.calories, 
    after: afterTotals.calories,
    target: targets.calories,
    iterations: iteration,
    converged,
    proteinAdjusted
  });
  
  return {
    scaledMeals: mealsWithOptions.map(m => m.options[0]),
    scaleFactor: lastScaleFactor,
    beforeTotals,
    afterTotals,
    iterations: iteration,
    converged,
    proteinAdjusted,
  };
}
