// =====================================================
// OPTIMIZER ENGINE - Core optimization logic
// =====================================================
// Separated for maintainability and testability
// =====================================================

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface FoodItem {
  id: string;
  meal_option_food_id: string;
  meal_option_id: string;
  option_number: number;
  name: string;
  quantity_grams: number;
  // Macros per 100g
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string;
}

export interface OptimizerSettings {
  protein_floor: number;
  protein_ceiling: number;
  carbs_floor: number;
  carbs_ceiling: number;
  fat_floor: number;
  fat_ceiling: number;
  calories_tolerance: number;
  protein_weight: number;
  carbs_weight: number;
  fat_weight: number;
  calories_weight: number;
}

export const DEFAULT_SETTINGS: OptimizerSettings = {
  protein_floor: 95,
  protein_ceiling: 120,
  carbs_floor: 80,
  carbs_ceiling: 120,
  fat_floor: 80,
  fat_ceiling: 120,
  calories_tolerance: 5,
  protein_weight: 3.0,
  carbs_weight: 1.0,
  fat_weight: 1.0,
  calories_weight: 1.5,
};

// Min/max constraints for quantities
const MIN_GRAMS = 10;
const MAX_GRAMS = 600;

/**
 * Calculate macros for a given quantity
 */
export function calcMacros(food: FoodItem, grams: number): MacroTargets {
  const multiplier = grams / 100;
  return {
    calories: food.calories_per_100g * multiplier,
    protein: food.protein_per_100g * multiplier,
    carbs: food.carbs_per_100g * multiplier,
    fat: food.fat_per_100g * multiplier,
  };
}

/**
 * OPTIMIZED: Incremental macro calculation
 * Instead of recalculating all foods, we maintain a running total
 * and only add/subtract the delta when a single food changes
 */
export function calcIncrementalMacroDelta(
  food: FoodItem,
  oldGrams: number,
  newGrams: number
): MacroTargets {
  const oldMacros = calcMacros(food, oldGrams);
  const newMacros = calcMacros(food, newGrams);
  return {
    calories: newMacros.calories - oldMacros.calories,
    protein: newMacros.protein - oldMacros.protein,
    carbs: newMacros.carbs - oldMacros.carbs,
    fat: newMacros.fat - oldMacros.fat,
  };
}

/**
 * Calculate total macros for all foods (used for initial calculation)
 */
export function calcTotalMacros(foods: FoodItem[], quantities: Map<string, number>): MacroTargets {
  let total: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const food of foods) {
    const qty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
    const macros = calcMacros(food, qty);
    total.calories += macros.calories;
    total.protein += macros.protein;
    total.carbs += macros.carbs;
    total.fat += macros.fat;
  }
  
  return total;
}

/**
 * Calculate error/distance from targets with floor penalties
 */
export function calcError(
  current: MacroTargets, 
  targets: MacroTargets,
  settings: OptimizerSettings
): number {
  const calError = Math.abs(current.calories - targets.calories) / targets.calories;
  
  const calcMacroError = (current: number, target: number, floor: number): number => {
    const ratio = current / target;
    const floorRatio = floor / 100;
    
    if (ratio < floorRatio) {
      return (floorRatio - ratio) * 100 + Math.abs(1 - ratio);
    }
    return Math.abs(current - target) / target;
  };
  
  const protError = calcMacroError(current.protein, targets.protein, settings.protein_floor);
  const carbError = calcMacroError(current.carbs, targets.carbs, settings.carbs_floor);
  const fatError = calcMacroError(current.fat, targets.fat, settings.fat_floor);
  
  return (
    calError * settings.calories_weight + 
    protError * settings.protein_weight + 
    carbError * settings.carbs_weight + 
    fatError * settings.fat_weight
  );
}

/**
 * OPTIMIZED: Gradient descent with incremental calculations
 * Uses running totals instead of recalculating all macros each iteration
 */
export function optimizeQuantities(
  foods: FoodItem[],
  targets: MacroTargets,
  settings: OptimizerSettings,
  maxIterations: number = 800
): Map<string, number> {
  // Start with current quantities
  const quantities = new Map<string, number>();
  for (const food of foods) {
    quantities.set(food.meal_option_food_id, food.quantity_grams);
  }
  
  // Calculate initial totals once
  let currentMacros = calcTotalMacros(foods, quantities);
  let currentError = calcError(currentMacros, targets, settings);
  
  // Adaptive step sizes - start large, refine
  const stepSizes = [40, 15, 5, 2, 1];
  const iterationsPerStep = Math.floor(maxIterations / stepSizes.length);
  
  for (const stepSize of stepSizes) {
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < iterationsPerStep) {
      improved = false;
      iterations++;
      
      for (const food of foods) {
        const currentQty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
        
        // Try increasing - use incremental calculation
        const increasedQty = Math.min(currentQty + stepSize, MAX_GRAMS);
        if (increasedQty !== currentQty) {
          const delta = calcIncrementalMacroDelta(food, currentQty, increasedQty);
          const testMacros: MacroTargets = {
            calories: currentMacros.calories + delta.calories,
            protein: currentMacros.protein + delta.protein,
            carbs: currentMacros.carbs + delta.carbs,
            fat: currentMacros.fat + delta.fat,
          };
          const testError = calcError(testMacros, targets, settings);
          
          if (testError < currentError) {
            quantities.set(food.meal_option_food_id, increasedQty);
            currentMacros = testMacros;
            currentError = testError;
            improved = true;
            continue;
          }
        }
        
        // Try decreasing - use incremental calculation
        const decreasedQty = Math.max(currentQty - stepSize, MIN_GRAMS);
        if (decreasedQty !== currentQty) {
          const delta = calcIncrementalMacroDelta(food, currentQty, decreasedQty);
          const testMacros: MacroTargets = {
            calories: currentMacros.calories + delta.calories,
            protein: currentMacros.protein + delta.protein,
            carbs: currentMacros.carbs + delta.carbs,
            fat: currentMacros.fat + delta.fat,
          };
          const testError = calcError(testMacros, targets, settings);
          
          if (testError < currentError) {
            quantities.set(food.meal_option_food_id, decreasedQty);
            currentMacros = testMacros;
            currentError = testError;
            improved = true;
            continue;
          }
        }
      }
    }
  }
  
  // Round to nearest integer
  for (const [id, qty] of quantities.entries()) {
    quantities.set(id, Math.round(qty));
  }
  
  return quantities;
}

/**
 * Parse serving_size string to get base grams for macro calculation
 */
export function parseServingSize(servingSize: string): number {
  const normalized = (servingSize || '100g').toLowerCase();
  
  // Try direct grams/ml match: "100g", "150ml"
  const gramsMatch = normalized.match(/(\d+)\s*(g|ml)/);
  if (gramsMatch) {
    const val = parseInt(gramsMatch[1], 10);
    if (val > 0 && !isNaN(val)) return val;
  }
  
  // Try parenthesized match: "1 unidade (50g)"
  const parenMatch = normalized.match(/\((\d+)\s*(g|ml)\)/);
  if (parenMatch) {
    const val = parseInt(parenMatch[1], 10);
    if (val > 0 && !isNaN(val)) return val;
  }
  
  return 100; // Default fallback
}

/**
 * Group foods by option number for multi-option optimization
 */
export function groupFoodsByOption(foods: FoodItem[]): Map<number, FoodItem[]> {
  const grouped = new Map<number, FoodItem[]>();
  
  for (const food of foods) {
    const optNum = food.option_number;
    if (!grouped.has(optNum)) {
      grouped.set(optNum, []);
    }
    grouped.get(optNum)!.push(food);
  }
  
  return grouped;
}
