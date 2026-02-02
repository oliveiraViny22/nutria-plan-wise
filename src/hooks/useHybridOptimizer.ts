// =====================================================
// OTIMIZADOR HÍBRIDO - IA + BRUTE FORCE
// =====================================================
// Pipeline de 2 fases:
// 1. IA (ai-rebalance): Decisões nutricionais contextuais
// 2. Brute Force: Ajuste fino para precisão matemática
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCategoryLimits } from '@/lib/optimizer-limits';

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface HybridPhase {
  name: 'idle' | 'ai' | 'bruteforce' | 'complete' | 'error';
  progress: number;
  message: string;
}

interface FoodChange {
  food_id?: string;
  meal_option_food_id?: string;
  food_name: string;
  old_quantity: number;
  new_quantity: number;
}

export interface HybridOptimizationResult {
  success: boolean;
  planId: string;
  before: MacroTargets;
  afterAI: MacroTargets;
  afterBruteForce: MacroTargets;
  targets: MacroTargets;
  aiChanges: FoodChange[];
  bruteForceChanges: FoodChange[];
}

export interface HybridPreview {
  planId: string;
  targets: MacroTargets;
  before: MacroTargets;
  afterAI: MacroTargets;
  afterBruteForce: MacroTargets;
  aiChanges: FoodChange[];
  bruteForceChanges: FoodChange[];
}

// =====================================================
// OPTIMIZER SETTINGS (carregadas do banco)
// =====================================================

interface OptimizerSettings {
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


// =====================================================
// BRUTE FORCE ENGINE (inline para evitar dependência)
// =====================================================

interface FoodItem {
  id: string;
  meal_option_food_id: string;
  name: string;
  quantity_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string;
}

function calcMacros(food: FoodItem, grams: number): MacroTargets {
  const multiplier = grams / 100;
  return {
    calories: food.calories_per_100g * multiplier,
    protein: food.protein_per_100g * multiplier,
    carbs: food.carbs_per_100g * multiplier,
    fat: food.fat_per_100g * multiplier,
  };
}

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

function calcError(
  current: MacroTargets, 
  targets: MacroTargets,
  settings: OptimizerSettings
): number {
  const calError = Math.abs(current.calories - targets.calories) / targets.calories;
  const carbError = Math.abs(current.carbs - targets.carbs) / targets.carbs;
  const fatError = Math.abs(current.fat - targets.fat) / targets.fat;
  
  const calcMacroError = (current: number, target: number, floor: number): number => {
    const ratio = current / target;
    const floorRatio = floor / 100;
    
    if (ratio < floorRatio) {
      return (floorRatio - ratio) * 100 + Math.abs(1 - ratio);
    }
    return Math.abs(current - target) / target;
  };
  
  const protError = calcMacroError(current.protein, targets.protein, settings.protein_floor);
  const carbFloorError = calcMacroError(current.carbs, targets.carbs, settings.carbs_floor);
  const fatFloorError = calcMacroError(current.fat, targets.fat, settings.fat_floor);
  
  const finalCarbError = Math.max(carbError, carbFloorError);
  const finalFatError = Math.max(fatError, fatFloorError);
  
  return (
    calError * settings.calories_weight + 
    protError * settings.protein_weight + 
    finalCarbError * settings.carbs_weight + 
    finalFatError * settings.fat_weight
  );
}

/**
 * Otimiza quantidades com ajuste LEVE (±10g máx por alimento).
 * Projetado para refinar decisões da IA sem alterações drásticas.
 */
function optimizeQuantities(
  foods: FoodItem[],
  targets: MacroTargets,
  settings: OptimizerSettings,
  maxIterations: number = 500,
  maxDeltaPerFood: number = 10 // Limite máximo de variação por alimento
): Map<string, number> {
  const quantities = new Map<string, number>();
  const originalQuantities = new Map<string, number>();
  
  for (const food of foods) {
    quantities.set(food.meal_option_food_id, food.quantity_grams);
    originalQuantities.set(food.meal_option_food_id, food.quantity_grams);
  }
  
  let currentError = calcError(calcTotalMacros(foods, quantities), targets, settings);
  
  // Apenas passos pequenos (1-5g) para ajuste leve
  const stepSizes = [5, 2, 1];
  
  for (const stepSize of stepSizes) {
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < maxIterations / stepSizes.length) {
      improved = false;
      iterations++;
      
      for (const food of foods) {
        const currentQty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
        const originalQty = originalQuantities.get(food.meal_option_food_id) || food.quantity_grams;
        const limits = getCategoryLimits(food.category);
        
        // Limitar variação máxima em relação ao original da IA
        const minAllowed = Math.max(limits.min, originalQty - maxDeltaPerFood);
        const maxAllowed = Math.min(limits.max, originalQty + maxDeltaPerFood);
        
        // Tentar aumentar
        if (currentQty + stepSize <= maxAllowed) {
          const increasedQty = currentQty + stepSize;
          quantities.set(food.meal_option_food_id, increasedQty);
          const increasedError = calcError(calcTotalMacros(foods, quantities), targets, settings);
          
          if (increasedError < currentError) {
            currentError = increasedError;
            improved = true;
            continue;
          }
        }
        
        // Tentar diminuir
        if (currentQty - stepSize >= minAllowed) {
          const decreasedQty = currentQty - stepSize;
          quantities.set(food.meal_option_food_id, decreasedQty);
          const decreasedError = calcError(calcTotalMacros(foods, quantities), targets, settings);
          
          if (decreasedError < currentError) {
            currentError = decreasedError;
            improved = true;
            continue;
          }
        }
        
        // Restaurar se nenhuma melhoria
        quantities.set(food.meal_option_food_id, currentQty);
      }
    }
  }
  
  // Arredondar valores finais
  for (const [id, qty] of quantities.entries()) {
    quantities.set(id, Math.round(qty));
  }
  
  return quantities;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useHybridOptimizer() {
  const [phase, setPhase] = useState<HybridPhase>({
    name: 'idle',
    progress: 0,
    message: '',
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<HybridPreview | null>(null);
  const [result, setResult] = useState<HybridOptimizationResult | null>(null);
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
          console.log('[Hybrid] Loaded settings from DB:', data.value);
        }
      } catch (err) {
        console.error('[Hybrid] Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  // Gerar prévia híbrida (IA + Brute Force simulado)
  const generatePreview = useCallback(async (planId: string, targets: MacroTargets, objective: string) => {
    setIsOptimizing(true);
    setPreview(null);
    
    try {
      // ========== FASE 1: IA ==========
      setPhase({ name: 'ai', progress: 0, message: 'Analisando com IA...' });
      
      console.log('[Hybrid] Fase 1: Chamando AI-Rebalance...');
      
      const aiResponse = await supabase.functions.invoke('ai-rebalance', {
        body: { 
          planId: planId, 
          targets: targets,
          goal: objective 
        },
      });
      
      if (aiResponse.error) {
        throw new Error(`AI Rebalance falhou: ${aiResponse.error.message}`);
      }
      
      const aiResult = aiResponse.data;
      console.log('[Hybrid] AI Result:', aiResult);
      
      setPhase({ name: 'ai', progress: 50, message: 'IA concluída, preparando ajuste fino...' });
      
      // Extrair alterações da IA
      const aiChanges: FoodChange[] = (aiResult.food_changes || []).map((c: any) => ({
        food_id: c.food_id,
        food_name: c.food_name,
        old_quantity: c.original_grams,
        new_quantity: c.new_grams,
      }));
      
      const afterAI: MacroTargets = aiResult.final_totals || targets;
      
      // ========== FASE 2: BRUTE FORCE (simulação) ==========
      setPhase({ name: 'bruteforce', progress: 60, message: 'Ajustando precisão matemática...' });
      
      // Buscar dados atualizados após a IA
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', planId);
      
      if (!meals || meals.length === 0) {
        throw new Error('Nenhuma refeição encontrada');
      }
      
      const mealIds = meals.map(m => m.id);
      
      const { data: options } = await supabase
        .from('meal_options')
        .select('id')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (!options || options.length === 0) {
        throw new Error('Nenhuma opção de refeição encontrada');
      }
      
      const optionIds = options.map(o => o.id);
      
      const { data: optionFoods } = await supabase
        .from('meal_option_foods')
        .select(`
          id,
          quantity_grams,
          food:foods(id, name, calories, protein, carbs, fat, serving_size, category)
        `)
        .in('meal_option_id', optionIds);
      
      if (!optionFoods || optionFoods.length === 0) {
        throw new Error('Nenhum alimento encontrado');
      }
      
      // Parse foods para o formato do brute force
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
          }
        }
        if (baseGrams <= 0 || isNaN(baseGrams)) baseGrams = 100;
        
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
      
      setPhase({ name: 'bruteforce', progress: 80, message: 'Calculando quantidades ótimas...' });
      
      // Rodar otimização brute force
      const optimizedQuantities = optimizeQuantities(foods, targets, settings);
      const afterBruteForce = calcTotalMacros(foods, optimizedQuantities);
      
      // Calcular before (estado atual do banco, pós-IA)
      const beforeQuantities = new Map<string, number>();
      for (const f of foods) {
        beforeQuantities.set(f.meal_option_food_id, f.quantity_grams);
      }
      const before = calcTotalMacros(foods, beforeQuantities);
      
      // Gerar lista de alterações do brute force
      const bruteForceChanges: FoodChange[] = [];
      for (const food of foods) {
        const oldQty = food.quantity_grams;
        const newQty = optimizedQuantities.get(food.meal_option_food_id) || oldQty;
        
        if (Math.abs(newQty - oldQty) >= 1) {
          bruteForceChanges.push({
            meal_option_food_id: food.meal_option_food_id,
            food_name: food.name,
            old_quantity: oldQty,
            new_quantity: newQty,
          });
        }
      }
      
      setPhase({ name: 'complete', progress: 100, message: 'Prévia pronta!' });
      
      const previewResult: HybridPreview = {
        planId,
        targets,
        before: {
          calories: Math.round(before.calories),
          protein: Math.round(before.protein),
          carbs: Math.round(before.carbs),
          fat: Math.round(before.fat),
        },
        afterAI: {
          calories: Math.round(afterAI.calories),
          protein: Math.round(afterAI.protein),
          carbs: Math.round(afterAI.carbs),
          fat: Math.round(afterAI.fat),
        },
        afterBruteForce: {
          calories: Math.round(afterBruteForce.calories),
          protein: Math.round(afterBruteForce.protein),
          carbs: Math.round(afterBruteForce.carbs),
          fat: Math.round(afterBruteForce.fat),
        },
        aiChanges,
        bruteForceChanges,
      };
      
      setPreview(previewResult);
      console.log('[Hybrid] Preview:', previewResult);
      
      return previewResult;
    } catch (error: any) {
      console.error('[Hybrid] Error:', error);
      setPhase({ name: 'error', progress: 0, message: error.message });
      toast.error('Erro na otimização híbrida: ' + error.message);
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [settings]);

  // Aplicar alterações do brute force (a IA já foi aplicada)
  const applyPreview = useCallback(async () => {
    if (!preview || preview.bruteForceChanges.length === 0) {
      toast.info('Nenhuma alteração adicional para aplicar');
      return null;
    }

    setIsApplying(true);
    
    try {
      console.log('[Hybrid] Applying brute force changes...');
      
      // Aplicar alterações no banco
      for (const change of preview.bruteForceChanges) {
        const { error } = await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.new_quantity })
          .eq('id', change.meal_option_food_id);
        
        if (error) {
          console.error('[Hybrid] Update error:', error);
        }
      }
      
      // Recalcular totais das opções
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', preview.planId);
      
      if (!meals) throw new Error('Não foi possível buscar refeições');
      
      const mealIds = meals.map(m => m.id);
      
      const { data: options } = await supabase
        .from('meal_options')
        .select('id')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (!options) throw new Error('Não foi possível buscar opções');
      
      const optionIds = options.map(o => o.id);
      
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
      
      // Atualizar totais do plano
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
      
      const optimizationResult: HybridOptimizationResult = {
        success: true,
        planId: preview.planId,
        before: preview.before,
        afterAI: preview.afterAI,
        afterBruteForce: preview.afterBruteForce,
        targets: preview.targets,
        aiChanges: preview.aiChanges,
        bruteForceChanges: preview.bruteForceChanges,
      };
      
      setResult(optimizationResult);
      setPreview(null);
      
      toast.success(
        `Otimização híbrida concluída! ${preview.aiChanges.length + preview.bruteForceChanges.length} ajustes aplicados.`,
        { duration: 5000 }
      );
      
      return optimizationResult;
    } catch (error: any) {
      console.error('[Hybrid] Apply error:', error);
      toast.error('Erro ao aplicar: ' + error.message);
      return null;
    } finally {
      setIsApplying(false);
    }
  }, [preview]);

  const cancelPreview = useCallback(() => {
    setPreview(null);
    setPhase({ name: 'idle', progress: 0, message: '' });
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setPhase({ name: 'idle', progress: 0, message: '' });
  }, []);

  return {
    phase,
    isOptimizing,
    isApplying,
    preview,
    result,
    generatePreview,
    applyPreview,
    cancelPreview,
    reset,
  };
}
