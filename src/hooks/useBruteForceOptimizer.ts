// =====================================================
// OTIMIZADOR BRUTO - TESTE SEM RESTRIÇÕES
// =====================================================
// Ajusta quantidades de alimentos para atingir metas exatas
// de calorias e macros. IGNORA todas as regras/limites.
// =====================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodItem {
  id: string;
  meal_option_food_id: string;
  name: string;
  quantity_grams: number;
  // Macros per 100g
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string;
}

interface OptimizationResult {
  success: boolean;
  changes: Array<{
    meal_option_food_id: string;
    food_name: string;
    old_quantity: number;
    new_quantity: number;
  }>;
  before: MacroTargets;
  after: MacroTargets;
  targets: MacroTargets;
}

const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

// Min/max constraints for quantities
const MIN_GRAMS = 10;
const MAX_GRAMS = 600;

/**
 * Calculate macros for a given quantity
 */
function calcMacros(food: FoodItem, grams: number): MacroTargets {
  const multiplier = grams / 100;
  return {
    calories: food.calories_per_100g * multiplier,
    protein: food.protein_per_100g * multiplier,
    carbs: food.carbs_per_100g * multiplier,
    fat: food.fat_per_100g * multiplier,
  };
}

/**
 * Calculate total macros for all foods
 */
function calcTotalMacros(foods: FoodItem[], quantities: Map<string, number>): MacroTargets {
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
 * Calculate error/distance from targets
 */
function calcError(current: MacroTargets, targets: MacroTargets): number {
  const calError = Math.abs(current.calories - targets.calories) / targets.calories;
  const protError = Math.abs(current.protein - targets.protein) / targets.protein;
  const carbError = Math.abs(current.carbs - targets.carbs) / targets.carbs;
  const fatError = Math.abs(current.fat - targets.fat) / targets.fat;
  
  // Weighted error: prioritize calories and protein
  return calError * 2 + protError * 1.5 + carbError * 1 + fatError * 1;
}

/**
 * Brute-force optimizer using gradient descent-like approach
 * Ignores ALL rules except min/max quantity constraints
 */
function optimizeQuantities(
  foods: FoodItem[],
  targets: MacroTargets,
  maxIterations: number = 1000
): Map<string, number> {
  // Start with current quantities
  const quantities = new Map<string, number>();
  for (const food of foods) {
    quantities.set(food.meal_option_food_id, food.quantity_grams);
  }
  
  let currentError = calcError(calcTotalMacros(foods, quantities), targets);
  const stepSizes = [50, 20, 10, 5, 2, 1];
  
  for (const stepSize of stepSizes) {
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < maxIterations / stepSizes.length) {
      improved = false;
      iterations++;
      
      for (const food of foods) {
        const currentQty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
        
        // Try increasing
        const increasedQty = Math.min(currentQty + stepSize, MAX_GRAMS);
        quantities.set(food.meal_option_food_id, increasedQty);
        const increasedError = calcError(calcTotalMacros(foods, quantities), targets);
        
        if (increasedError < currentError) {
          currentError = increasedError;
          improved = true;
          continue;
        }
        
        // Try decreasing
        const decreasedQty = Math.max(currentQty - stepSize, MIN_GRAMS);
        quantities.set(food.meal_option_food_id, decreasedQty);
        const decreasedError = calcError(calcTotalMacros(foods, quantities), targets);
        
        if (decreasedError < currentError) {
          currentError = decreasedError;
          improved = true;
          continue;
        }
        
        // Revert to original
        quantities.set(food.meal_option_food_id, currentQty);
      }
    }
  }
  
  // Round to nearest integer
  for (const [id, qty] of quantities.entries()) {
    quantities.set(id, Math.round(qty));
  }
  
  return quantities;
}

export function useBruteForceOptimizer() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  const optimize = useCallback(async (planId: string, targets: MacroTargets) => {
    setIsOptimizing(true);
    setResult(null);
    
    try {
      // 1. Fetch all meal options and foods for this plan
      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', planId);
      
      if (mealsError) throw mealsError;
      if (!meals || meals.length === 0) {
        toast.error('Nenhuma refeição encontrada no plano');
        return null;
      }
      
      const mealIds = meals.map(m => m.id);
      
      // 2. Fetch all meal options
      const { data: options, error: optionsError } = await supabase
        .from('meal_options')
        .select('id, option_number')
        .in('meal_id', mealIds)
        .eq('option_number', 1); // Only option 1 for simplicity
      
      if (optionsError) throw optionsError;
      if (!options || options.length === 0) {
        toast.error('Nenhuma opção de refeição encontrada');
        return null;
      }
      
      const optionIds = options.map(o => o.id);
      
      // 3. Fetch all foods in these options
      const { data: optionFoods, error: foodsError } = await supabase
        .from('meal_option_foods')
        .select(`
          id,
          quantity_grams,
          food:foods(id, name, calories, protein, carbs, fat, serving_size, category)
        `)
        .in('meal_option_id', optionIds);
      
      if (foodsError) throw foodsError;
      if (!optionFoods || optionFoods.length === 0) {
        toast.error('Nenhum alimento encontrado nas opções');
        return null;
      }
      
      // 4. Parse serving_size to get base grams and convert to per-100g
      const foods: FoodItem[] = optionFoods.map(of => {
        const food = of.food as any;
        const servingSize = food.serving_size || '100g';
        const baseGrams = parseInt(servingSize.match(/(\d+)/)?.[1] || '100', 10);
        
        return {
          id: food.id,
          meal_option_food_id: of.id,
          name: food.name,
          quantity_grams: of.quantity_grams,
          calories_per_100g: (food.calories / baseGrams) * 100,
          protein_per_100g: (food.protein / baseGrams) * 100,
          carbs_per_100g: (food.carbs / baseGrams) * 100,
          fat_per_100g: (food.fat / baseGrams) * 100,
          category: food.category,
        };
      });
      
      // 5. Calculate before macros
      const beforeQuantities = new Map<string, number>();
      for (const f of foods) {
        beforeQuantities.set(f.meal_option_food_id, f.quantity_grams);
      }
      const beforeMacros = calcTotalMacros(foods, beforeQuantities);
      
      // 6. Run optimization
      console.log('[BruteForce] Starting optimization...');
      console.log('[BruteForce] Targets:', targets);
      console.log('[BruteForce] Before:', beforeMacros);
      
      const optimizedQuantities = optimizeQuantities(foods, targets);
      const afterMacros = calcTotalMacros(foods, optimizedQuantities);
      
      console.log('[BruteForce] After:', afterMacros);
      
      // 7. Calculate changes
      const changes: OptimizationResult['changes'] = [];
      for (const food of foods) {
        const oldQty = food.quantity_grams;
        const newQty = optimizedQuantities.get(food.meal_option_food_id) || oldQty;
        
        if (Math.abs(newQty - oldQty) >= 1) {
          changes.push({
            meal_option_food_id: food.meal_option_food_id,
            food_name: food.name,
            old_quantity: oldQty,
            new_quantity: newQty,
          });
        }
      }
      
      // 8. Apply changes to database
      for (const change of changes) {
        const { error: updateError } = await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.new_quantity })
          .eq('id', change.meal_option_food_id);
        
        if (updateError) {
          console.error('[BruteForce] Update error:', updateError);
        }
      }
      
      // 9. Recalculate option totals
      for (const optionId of optionIds) {
        const { data: optFoods } = await supabase
          .from('meal_option_foods')
          .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
          .eq('meal_option_id', optionId);
        
        if (optFoods) {
          let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          for (const of_ of optFoods) {
            const food = of_.food as any;
            const baseGrams = parseInt((food.serving_size || '100g').match(/(\d+)/)?.[1] || '100', 10);
            const multiplier = of_.quantity_grams / baseGrams;
            totals.calories += Math.round(food.calories * multiplier);
            totals.protein += Math.round(food.protein * multiplier);
            totals.carbs += Math.round(food.carbs * multiplier);
            totals.fat += Math.round(food.fat * multiplier);
          }
          
          await supabase
            .from('meal_options')
            .update({
              total_calories: totals.calories,
              total_protein: totals.protein,
              total_carbs: totals.carbs,
              total_fat: totals.fat,
            })
            .eq('id', optionId);
        }
      }
      
      // 10. Update diet_plan totals
      const { data: allOptions } = await supabase
        .from('meal_options')
        .select('total_calories, total_protein, total_carbs, total_fat, option_number')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (allOptions) {
        const planTotals = allOptions.reduce(
          (acc, opt) => ({
            calories: acc.calories + (opt.total_calories || 0),
            protein: acc.protein + (opt.total_protein || 0),
            carbs: acc.carbs + (opt.total_carbs || 0),
            fat: acc.fat + (opt.total_fat || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        
        await supabase
          .from('diet_plans')
          .update({
            total_calories: planTotals.calories,
            total_protein: planTotals.protein,
            total_carbs: planTotals.carbs,
            total_fat: planTotals.fat,
          })
          .eq('id', planId);
      }
      
      const optimizationResult: OptimizationResult = {
        success: true,
        changes,
        before: {
          calories: Math.round(beforeMacros.calories),
          protein: Math.round(beforeMacros.protein),
          carbs: Math.round(beforeMacros.carbs),
          fat: Math.round(beforeMacros.fat),
        },
        after: {
          calories: Math.round(afterMacros.calories),
          protein: Math.round(afterMacros.protein),
          carbs: Math.round(afterMacros.carbs),
          fat: Math.round(afterMacros.fat),
        },
        targets,
      };
      
      setResult(optimizationResult);
      
      toast.success(
        `Otimização concluída! ${changes.length} alimentos ajustados.`,
        { duration: 5000 }
      );
      
      return optimizationResult;
    } catch (error: any) {
      console.error('[BruteForce] Error:', error);
      toast.error('Erro na otimização: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, []);

  return {
    isOptimizing,
    result,
    optimize,
  };
}
