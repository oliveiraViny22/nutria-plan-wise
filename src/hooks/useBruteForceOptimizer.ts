// =====================================================
// OTIMIZADOR BRUTO V2 - Suporta Múltiplas Opções
// =====================================================
// Ajusta quantidades de alimentos para atingir metas exatas
// de calorias e macros em TODAS as opções (1, 2, 3).
// Usa cálculos incrementais para melhor performance.
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  MacroTargets,
  FoodItem,
  OptimizerSettings,
  DEFAULT_SETTINGS,
  calcTotalMacros,
  optimizeQuantities,
  parseServingSize,
  groupFoodsByOption,
} from '@/lib/optimizer-engine';

export type { MacroTargets, OptimizerSettings };

export interface OptimizationChange {
  meal_option_food_id: string;
  meal_option_id: string;
  option_number: number;
  food_name: string;
  old_quantity: number;
  new_quantity: number;
}

export interface OptionResult {
  option_number: number;
  changes: OptimizationChange[];
  before: MacroTargets;
  after: MacroTargets;
}

export interface OptimizationPreview {
  planId: string;
  options: OptionResult[];
  // Aggregated for backwards compatibility
  changes: OptimizationChange[];
  before: MacroTargets;
  after: MacroTargets;
  targets: MacroTargets;
}

interface OptimizationResult {
  success: boolean;
  planId: string;
  options: OptionResult[];
  changes: OptimizationChange[];
  before: MacroTargets;
  after: MacroTargets;
  targets: MacroTargets;
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
    
    const startTime = performance.now();
    
    try {
      // 1. Fetch all meals for this plan
      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select('id, name')
        .eq('diet_plan_id', planId);
      
      if (mealsError) throw mealsError;
      if (!meals || meals.length === 0) {
        toast.error('Nenhuma refeição encontrada no plano');
        return null;
      }
      
      const mealIds = meals.map(m => m.id);
      
      // 2. Fetch ALL meal options (1, 2, and 3)
      const { data: options, error: optionsError } = await supabase
        .from('meal_options')
        .select('id, option_number, meal_id')
        .in('meal_id', mealIds)
        .order('option_number');
      
      if (optionsError) throw optionsError;
      if (!options || options.length === 0) {
        toast.error('Nenhuma opção de refeição encontrada');
        return null;
      }
      
      const optionIds = options.map(o => o.id);
      
      // 3. Fetch all foods in ALL options
      const { data: optionFoods, error: foodsError } = await supabase
        .from('meal_option_foods')
        .select(`
          id,
          meal_option_id,
          quantity_grams,
          food:foods(id, name, calories, protein, carbs, fat, serving_size, category)
        `)
        .in('meal_option_id', optionIds);
      
      if (foodsError) throw foodsError;
      if (!optionFoods || optionFoods.length === 0) {
        toast.error('Nenhum alimento encontrado nas opções');
        return null;
      }
      
      // 4. Create option lookup map
      const optionLookup = new Map(options.map(o => [o.id, o.option_number]));
      
      // 5. Parse all foods with per-100g macros
      const foods: FoodItem[] = optionFoods.map(of => {
        const food = of.food as any;
        const baseGrams = parseServingSize(food.serving_size);
        const optionNumber = optionLookup.get(of.meal_option_id) || 1;
        
        return {
          id: food.id,
          meal_option_food_id: of.id,
          meal_option_id: of.meal_option_id,
          option_number: optionNumber,
          name: food.name,
          quantity_grams: of.quantity_grams,
          calories_per_100g: (food.calories / baseGrams) * 100,
          protein_per_100g: (food.protein / baseGrams) * 100,
          carbs_per_100g: (food.carbs / baseGrams) * 100,
          fat_per_100g: (food.fat / baseGrams) * 100,
          category: food.category,
        };
      });
      
      // 6. Group by option and optimize each independently
      const groupedFoods = groupFoodsByOption(foods);
      const optionResults: OptionResult[] = [];
      const allChanges: OptimizationChange[] = [];
      
      // Aggregate before/after for backwards compatibility (using option 1 as reference)
      let aggregatedBefore: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      let aggregatedAfter: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      
      console.log('[BruteForce] Optimizing', groupedFoods.size, 'option groups...');
      
      for (const [optionNum, optionFoods] of groupedFoods.entries()) {
        // Calculate before macros
        const beforeQuantities = new Map<string, number>();
        for (const f of optionFoods) {
          beforeQuantities.set(f.meal_option_food_id, f.quantity_grams);
        }
        const beforeMacros = calcTotalMacros(optionFoods, beforeQuantities);
        
        // Run optimization
        const optimizedQuantities = optimizeQuantities(optionFoods, targets, settings);
        const afterMacros = calcTotalMacros(optionFoods, optimizedQuantities);
        
        // Calculate changes for this option
        const changes: OptimizationChange[] = [];
        for (const food of optionFoods) {
          const oldQty = food.quantity_grams;
          const newQty = optimizedQuantities.get(food.meal_option_food_id) || oldQty;
          
          if (Math.abs(newQty - oldQty) >= 1) {
            changes.push({
              meal_option_food_id: food.meal_option_food_id,
              meal_option_id: food.meal_option_id,
              option_number: optionNum,
              food_name: food.name,
              old_quantity: oldQty,
              new_quantity: newQty,
            });
          }
        }
        
        optionResults.push({
          option_number: optionNum,
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
        });
        
        allChanges.push(...changes);
        
        // Use option 1 for aggregated values
        if (optionNum === 1) {
          aggregatedBefore = {
            calories: Math.round(beforeMacros.calories),
            protein: Math.round(beforeMacros.protein),
            carbs: Math.round(beforeMacros.carbs),
            fat: Math.round(beforeMacros.fat),
          };
          aggregatedAfter = {
            calories: Math.round(afterMacros.calories),
            protein: Math.round(afterMacros.protein),
            carbs: Math.round(afterMacros.carbs),
            fat: Math.round(afterMacros.fat),
          };
        }
      }
      
      const duration = Math.round(performance.now() - startTime);
      console.log(`[BruteForce] Optimization completed in ${duration}ms`);
      console.log('[BruteForce] Total changes:', allChanges.length);
      
      const previewResult: OptimizationPreview = {
        planId,
        options: optionResults.sort((a, b) => a.option_number - b.option_number),
        changes: allChanges,
        before: aggregatedBefore,
        after: aggregatedAfter,
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
      console.log('[BruteForce] Applying', preview.changes.length, 'changes via batch update...');
      const startTime = performance.now();
      
      // 1. BATCH UPDATE: Update all foods in a single query using Promise.all
      // Group changes by small batches for optimal performance
      const BATCH_SIZE = 50;
      const batches: OptimizationChange[][] = [];
      for (let i = 0; i < preview.changes.length; i += BATCH_SIZE) {
        batches.push(preview.changes.slice(i, i + BATCH_SIZE));
      }
      
      await Promise.all(batches.map(async (batch) => {
        // Use individual updates in parallel within each batch
        await Promise.all(batch.map(change => 
          supabase
            .from('meal_option_foods')
            .update({ quantity_grams: change.new_quantity })
            .eq('id', change.meal_option_food_id)
        ));
      }));
      
      const updateTime = Math.round(performance.now() - startTime);
      console.log(`[BruteForce] Batch update completed in ${updateTime}ms`);
      
      // 2. Get all affected option IDs
      const affectedOptionIds = [...new Set(preview.changes.map(c => c.meal_option_id))];
      
      // 3. Recalculate totals for all affected options in PARALLEL
      const recalcStart = performance.now();
      
      await Promise.all(affectedOptionIds.map(async (optionId) => {
        const { data: optFoods } = await supabase
          .from('meal_option_foods')
          .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
          .eq('meal_option_id', optionId);
        
        if (optFoods) {
          let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          for (const of_ of optFoods) {
            const food = of_.food as any;
            const baseGrams = parseServingSize(food.serving_size);
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
      }));
      
      const recalcTime = Math.round(performance.now() - recalcStart);
      console.log(`[BruteForce] Totals recalculation completed in ${recalcTime}ms`);
      
      // 4. Update diet_plan totals (using option 1 values)
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', preview.planId);
      
      if (meals) {
        const mealIds = meals.map(m => m.id);
        
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
            .eq('id', preview.planId);
        }
      }
      
      const totalTime = Math.round(performance.now() - startTime);
      console.log(`[BruteForce] Total apply time: ${totalTime}ms`);
      
      const optimizationResult: OptimizationResult = {
        success: true,
        planId: preview.planId,
        options: preview.options,
        changes: preview.changes,
        before: preview.before,
        after: preview.after,
        targets: preview.targets,
      };
      
      setResult(optimizationResult);
      setPreview(null);
      
      const optionCount = preview.options.filter(o => o.changes.length > 0).length;
      toast.success(
        `Otimização aplicada em ${totalTime}ms! ${preview.changes.length} ajustes em ${optionCount} opção(ões).`,
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
      console.log('[BruteForce] Undoing', result.changes.length, 'changes via batch...');
      const startTime = performance.now();
      
      // 1. BATCH RESTORE: Restore original quantities in parallel
      const BATCH_SIZE = 50;
      const batches: OptimizationChange[][] = [];
      for (let i = 0; i < result.changes.length; i += BATCH_SIZE) {
        batches.push(result.changes.slice(i, i + BATCH_SIZE));
      }
      
      await Promise.all(batches.map(async (batch) => {
        await Promise.all(batch.map(change =>
          supabase
            .from('meal_option_foods')
            .update({ quantity_grams: change.old_quantity })
            .eq('id', change.meal_option_food_id)
        ));
      }));

      // 2. Recalculate affected options in PARALLEL
      const affectedOptionIds = [...new Set(result.changes.map(c => c.meal_option_id))];
      
      await Promise.all(affectedOptionIds.map(async (optionId) => {
        const { data: optFoods } = await supabase
          .from('meal_option_foods')
          .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
          .eq('meal_option_id', optionId);
        
        if (optFoods) {
          let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          for (const of_ of optFoods) {
            const food = of_.food as any;
            const baseGrams = parseServingSize(food.serving_size);
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
      }));

      // 3. Update diet_plan totals
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', result.planId);
      
      if (meals) {
        const mealIds = meals.map(m => m.id);
        
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

      const totalTime = Math.round(performance.now() - startTime);
      console.log(`[BruteForce] Undo completed in ${totalTime}ms`);

      toast.success(`Otimização desfeita em ${totalTime}ms!`);
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
