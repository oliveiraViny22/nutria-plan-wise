// =====================================================
// OTIMIZADOR BRUTO - TESTE SEM RESTRIÇÕES
// =====================================================
// Ajusta quantidades de alimentos para atingir metas exatas
// de calorias e macros. IGNORA todas as regras/limites.
// =====================================================

import { useState, useCallback, useEffect } from 'react';
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

export interface OptimizationPreview {
  planId: string;
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

interface OptimizationResult {
  success: boolean;
  planId: string;
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

const DEFAULT_SETTINGS: OptimizerSettings = {
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
 * IMPORTANT: Uses configurable floors - going below adds massive penalty
 */
function calcError(
  current: MacroTargets, 
  targets: MacroTargets,
  settings: OptimizerSettings
): number {
  const calError = Math.abs(current.calories - targets.calories) / targets.calories;
  const carbError = Math.abs(current.carbs - targets.carbs) / targets.carbs;
  const fatError = Math.abs(current.fat - targets.fat) / targets.fat;
  
  // Helper function to calculate error with floor penalty
  const calcMacroError = (current: number, target: number, floor: number): number => {
    const ratio = current / target;
    const floorRatio = floor / 100;
    
    if (ratio < floorRatio) {
      // Massive penalty for going below floor - makes it essentially impossible
      return (floorRatio - ratio) * 100 + Math.abs(1 - ratio);
    }
    // Normal error calculation above floor
    return Math.abs(current - target) / target;
  };
  
  const protError = calcMacroError(current.protein, targets.protein, settings.protein_floor);
  const carbFloorError = calcMacroError(current.carbs, targets.carbs, settings.carbs_floor);
  const fatFloorError = calcMacroError(current.fat, targets.fat, settings.fat_floor);
  
  // Use floor-aware errors for carbs and fat too
  const finalCarbError = Math.max(carbError, carbFloorError);
  const finalFatError = Math.max(fatError, fatFloorError);
  
  // Weighted error using configurable weights
  return (
    calError * settings.calories_weight + 
    protError * settings.protein_weight + 
    finalCarbError * settings.carbs_weight + 
    finalFatError * settings.fat_weight
  );
}

/**
 * Brute-force optimizer using gradient descent-like approach
 * Uses configurable settings for floors/ceilings and weights
 */
function optimizeQuantities(
  foods: FoodItem[],
  targets: MacroTargets,
  settings: OptimizerSettings,
  maxIterations: number = 1000
): Map<string, number> {
  // Start with current quantities
  const quantities = new Map<string, number>();
  for (const food of foods) {
    quantities.set(food.meal_option_food_id, food.quantity_grams);
  }
  
  let currentError = calcError(calcTotalMacros(foods, quantities), targets, settings);
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
        const increasedError = calcError(calcTotalMacros(foods, quantities), targets, settings);
        
        if (increasedError < currentError) {
          currentError = increasedError;
          improved = true;
          continue;
        }
        
        // Try decreasing
        const decreasedQty = Math.max(currentQty - stepSize, MIN_GRAMS);
        quantities.set(food.meal_option_food_id, decreasedQty);
        const decreasedError = calcError(calcTotalMacros(foods, quantities), targets, settings);
        
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
  const [isApplying, setIsApplying] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [preview, setPreview] = useState<OptimizationPreview | null>(null);
  const [settings, setSettings] = useState<OptimizerSettings>(DEFAULT_SETTINGS);

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'optimizer_macro_settings')
          .maybeSingle();

        if (!error && data?.value) {
          setSettings({ ...DEFAULT_SETTINGS, ...(data.value as object) });
          console.log('[BruteForce] Loaded settings from DB:', data.value);
        }
      } catch (err) {
        console.error('[BruteForce] Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Preview optimization without applying changes to database
  const generatePreview = useCallback(async (planId: string, targets: MacroTargets) => {
    setIsOptimizing(true);
    setPreview(null);
    
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
        .eq('option_number', 1);
      
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
        const servingSize = (food.serving_size || '100g').toLowerCase();
        
        let baseGrams = 100;
        const gramsMatch = servingSize.match(/(\d+)\s*(g|ml)/);
        if (gramsMatch) {
          baseGrams = parseInt(gramsMatch[1], 10);
        } else {
          const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/);
          if (parenMatch) {
            baseGrams = parseInt(parenMatch[1], 10);
          } else if (servingSize.match(/^\d+\s+(unidade|fatia|colher|xícara|copo)/)) {
            baseGrams = 100;
          }
        }
        
        if (baseGrams <= 0 || isNaN(baseGrams)) {
          baseGrams = 100;
        }
        
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
      
      // 6. Run optimization with loaded settings
      console.log('[BruteForce] Generating preview...');
      console.log('[BruteForce] Settings:', settings);
      console.log('[BruteForce] Targets:', targets);
      console.log('[BruteForce] Before:', beforeMacros);
      
      const optimizedQuantities = optimizeQuantities(foods, targets, settings);
      const afterMacros = calcTotalMacros(foods, optimizedQuantities);
      
      console.log('[BruteForce] After:', afterMacros);
      console.log('[BruteForce] Deltas:', {
        calories: afterMacros.calories - targets.calories,
        protein: afterMacros.protein - targets.protein,
        carbs: afterMacros.carbs - targets.carbs,
        fat: afterMacros.fat - targets.fat,
      });
      
      // 7. Calculate changes
      const changes: OptimizationPreview['changes'] = [];
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
      
      const previewResult: OptimizationPreview = {
        planId,
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
      
      setPreview(previewResult);
      return previewResult;
    } catch (error: any) {
      console.error('[BruteForce] Preview error:', error);
      toast.error('Erro ao gerar prévia: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [settings]);

  // Apply the previewed optimization to the database
  const applyPreview = useCallback(async () => {
    if (!preview || preview.changes.length === 0) {
      toast.info('Nenhuma alteração para aplicar');
      return null;
    }

    setIsApplying(true);
    
    try {
      console.log('[BruteForce] Applying preview changes...');
      
      // 1. Apply changes to database
      for (const change of preview.changes) {
        const { error: updateError } = await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.new_quantity })
          .eq('id', change.meal_option_food_id);
        
        if (updateError) {
          console.error('[BruteForce] Update error:', updateError);
        }
      }
      
      // 2. Get meal IDs for this plan
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', preview.planId);
      
      if (!meals) throw new Error('Não foi possível buscar refeições');
      
      const mealIds = meals.map(m => m.id);
      
      // 3. Get option IDs
      const { data: options } = await supabase
        .from('meal_options')
        .select('id')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (!options) throw new Error('Não foi possível buscar opções');
      
      const optionIds = options.map(o => o.id);
      
      // 4. Recalculate option totals
      for (const optionId of optionIds) {
        const { data: optFoods } = await supabase
          .from('meal_option_foods')
          .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
          .eq('meal_option_id', optionId);
        
        if (optFoods) {
          let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          for (const of_ of optFoods) {
            const food = of_.food as any;
            const servingSize = (food.serving_size || '100g').toLowerCase();
            
            let baseGrams = 100;
            const gramsMatch = servingSize.match(/(\d+)\s*(g|ml)/);
            if (gramsMatch) {
              baseGrams = parseInt(gramsMatch[1], 10);
            } else {
              const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/);
              if (parenMatch) {
                baseGrams = parseInt(parenMatch[1], 10);
              }
            }
            if (baseGrams <= 0 || isNaN(baseGrams)) baseGrams = 100;
            
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
      
      // 5. Update diet_plan totals
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
          .eq('id', preview.planId);
      }
      
      const optimizationResult: OptimizationResult = {
        success: true,
        planId: preview.planId,
        changes: preview.changes,
        before: preview.before,
        after: preview.after,
        targets: preview.targets,
      };
      
      setResult(optimizationResult);
      setPreview(null);
      
      toast.success(
        `Otimização aplicada! ${preview.changes.length} alimentos ajustados.`,
        { duration: 5000 }
      );
      
      return optimizationResult;
    } catch (error: any) {
      console.error('[BruteForce] Apply error:', error);
      toast.error('Erro ao aplicar: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsApplying(false);
    }
  }, [preview]);

  // Cancel/clear preview
  const cancelPreview = useCallback(() => {
    setPreview(null);
  }, []);

  // Undo optimization - restore original quantities
  const undo = useCallback(async () => {
    if (!result || result.changes.length === 0) {
      toast.info('Nada para desfazer');
      return false;
    }

    setIsUndoing(true);
    try {
      console.log('[BruteForce] Undoing optimization...');
      
      // 1. Restore original quantities for each changed food
      for (const change of result.changes) {
        const { error } = await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.old_quantity })
          .eq('id', change.meal_option_food_id);
        
        if (error) {
          console.error('[BruteForce] Undo error:', error);
        }
      }

      // 2. Get meal IDs for this plan to recalculate totals
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', result.planId);
      
      if (meals) {
        const mealIds = meals.map(m => m.id);
        
        // 3. Get all meal options
        const { data: options } = await supabase
          .from('meal_options')
          .select('id')
          .in('meal_id', mealIds)
          .eq('option_number', 1);
        
        if (options) {
          // 4. Recalculate each option's totals
          for (const option of options) {
            const { data: optFoods } = await supabase
              .from('meal_option_foods')
              .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
              .eq('meal_option_id', option.id);
            
            if (optFoods) {
              let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
              for (const of_ of optFoods) {
                const food = of_.food as any;
                const servingSize = (food.serving_size || '100g').toLowerCase();
                
                let baseGrams = 100;
                const gramsMatch = servingSize.match(/(\d+)\s*(g|ml)/);
                if (gramsMatch) {
                  baseGrams = parseInt(gramsMatch[1], 10);
                } else {
                  const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/);
                  if (parenMatch) {
                    baseGrams = parseInt(parenMatch[1], 10);
                  }
                }
                if (baseGrams <= 0 || isNaN(baseGrams)) baseGrams = 100;
                
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
                .eq('id', option.id);
            }
          }
          
          // 5. Update diet_plan totals
          const { data: allOptions } = await supabase
            .from('meal_options')
            .select('total_calories, total_protein, total_carbs, total_fat')
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
              .eq('id', result.planId);
          }
        }
      }

      toast.success('Otimização desfeita com sucesso!');
      setResult(null);
      return true;
    } catch (error: any) {
      console.error('[BruteForce] Undo error:', error);
      toast.error('Erro ao desfazer: ' + (error.message || 'Erro desconhecido'));
      return false;
    } finally {
      setIsUndoing(false);
    }
  }, [result]);

  return {
    isOptimizing,
    isApplying,
    isUndoing,
    result,
    preview,
    generatePreview,
    applyPreview,
    cancelPreview,
    undo,
  };
}
