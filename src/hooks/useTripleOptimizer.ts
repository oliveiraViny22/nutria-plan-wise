// =====================================================
// OTIMIZADOR TRIPLO: Contratos → IA → Rápido
// =====================================================
// Pipeline de 3 fases que combina o melhor de cada abordagem:
// 1. CONTRATOS: Valida estrutura nutricional por refeição
// 2. IA: Toma decisões contextuais sobre quantidades
// 3. RÁPIDO: Ajuste fino (±10g) para precisão matemática
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCategoryLimits } from '@/lib/optimizer-limits';

// =====================================================
// CONTRATOS NUTRICIONAIS
// =====================================================

const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

const CONTRACT = {
  CALORIE_TOLERANCE_PERCENT: 5,
  MAX_FAT_PERCENT_OF_CALORIES: 30,
  MIN_PROTEIN_MAIN_MEAL_GRAMS: 20,
  MIN_PROTEIN_SNACK_GRAMS: 5,
  MIN_CARBS_PERCENT: 90,
  MIN_PROTEIN_PERCENT: 95,
} as const;

const MAIN_MEALS = ['lunch', 'dinner', 'almoço', 'jantar', 'almoco'];
const SNACK_MEALS = ['morning_snack', 'afternoon_snack', 'lanche_manha', 'lanche_tarde', 'lanche'];

// =====================================================
// INTERFACES
// =====================================================

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodItem {
  id: string;
  meal_option_food_id: string;
  meal_id: string;
  meal_name: string;
  name: string;
  quantity_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string;
}

interface MealTotals {
  meal_id: string;
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ContractViolation {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

interface PhaseResult {
  name: string;
  totals: MacroTargets;
  violations: ContractViolation[];
  changes: FoodChange[];
}

interface FoodChange {
  meal_option_food_id: string;
  food_name: string;
  meal_name: string;
  old_quantity: number;
  new_quantity: number;
}

export interface TripleOptimizationPreview {
  planId: string;
  targets: MacroTargets;
  before: MacroTargets;
  phases: PhaseResult[];
  final: MacroTargets;
  allChanges: FoodChange[];
  violationsBefore: ContractViolation[];
  violationsAfter: ContractViolation[];
}

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
  carbs_floor: 90,
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
// FUNÇÕES AUXILIARES
// =====================================================

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

function calcMealTotals(foods: FoodItem[], quantities: Map<string, number>): MealTotals[] {
  const mealMap = new Map<string, MealTotals>();
  for (const food of foods) {
    const qty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
    const macros = calcMacros(food, qty);
    if (!mealMap.has(food.meal_id)) {
      mealMap.set(food.meal_id, {
        meal_id: food.meal_id,
        meal_name: food.meal_name,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    }
    const meal = mealMap.get(food.meal_id)!;
    meal.calories += macros.calories;
    meal.protein += macros.protein;
    meal.carbs += macros.carbs;
    meal.fat += macros.fat;
  }
  return Array.from(mealMap.values());
}

function checkContractViolations(
  totals: MacroTargets,
  targets: MacroTargets,
  mealTotals: MealTotals[]
): ContractViolation[] {
  const violations: ContractViolation[] = [];
  
  const caloriePercent = targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0;
  if (Math.abs(caloriePercent - 100) > CONTRACT.CALORIE_TOLERANCE_PERCENT) {
    violations.push({
      code: 'CAL_OUT_OF_RANGE',
      message: `Calorias: ${Math.round(totals.calories)} kcal (${caloriePercent.toFixed(1)}%)`,
      severity: 'error',
    });
  }
  
  const proteinPercent = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0;
  if (proteinPercent < CONTRACT.MIN_PROTEIN_PERCENT) {
    violations.push({
      code: 'PROTEIN_BELOW_MIN',
      message: `Proteína: ${Math.round(totals.protein)}g (${proteinPercent.toFixed(1)}%)`,
      severity: 'error',
    });
  }
  
  const carbsPercent = targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0;
  if (carbsPercent < CONTRACT.MIN_CARBS_PERCENT) {
    violations.push({
      code: 'CARBS_BELOW_MIN',
      message: `Carboidratos: ${Math.round(totals.carbs)}g (${carbsPercent.toFixed(1)}%)`,
      severity: 'warning',
    });
  }
  
  const fatCalories = totals.fat * KCAL_PER_GRAM.fat;
  const fatPercentOfCalories = totals.calories > 0 ? (fatCalories / totals.calories) * 100 : 0;
  if (fatPercentOfCalories > CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
    violations.push({
      code: 'FAT_EXCEEDS_MAX',
      message: `Gordura: ${fatPercentOfCalories.toFixed(1)}% das calorias`,
      severity: 'error',
    });
  }
  
  for (const meal of mealTotals) {
    const normalizedName = meal.meal_name.toLowerCase();
    const isMainMeal = MAIN_MEALS.some(m => normalizedName.includes(m));
    const isSnack = SNACK_MEALS.some(m => normalizedName.includes(m));
    
    if (isMainMeal && meal.protein < CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
      violations.push({
        code: 'MEAL_PROTEIN_LOW',
        message: `${meal.meal_name}: ${Math.round(meal.protein)}g prot (mín: ${CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS}g)`,
        severity: 'warning',
      });
    } else if (isSnack && meal.protein < CONTRACT.MIN_PROTEIN_SNACK_GRAMS) {
      violations.push({
        code: 'SNACK_PROTEIN_LOW',
        message: `${meal.meal_name}: ${Math.round(meal.protein)}g prot (mín: ${CONTRACT.MIN_PROTEIN_SNACK_GRAMS}g)`,
        severity: 'warning',
      });
    }
  }
  
  return violations;
}

// =====================================================
// FASE 3: AJUSTE RÁPIDO (±10g)
// =====================================================

function quickRefine(
  foods: FoodItem[],
  quantities: Map<string, number>,
  targets: MacroTargets,
  settings: OptimizerSettings,
  maxDelta: number = 10
): Map<string, number> {
  const result = new Map(quantities);
  const originalQuantities = new Map(quantities);
  
  const calcError = (current: MacroTargets): number => {
    const calError = Math.abs(current.calories - targets.calories) / targets.calories;
    const protError = Math.abs(current.protein - targets.protein) / targets.protein;
    const carbError = Math.abs(current.carbs - targets.carbs) / targets.carbs;
    const fatError = Math.abs(current.fat - targets.fat) / targets.fat;
    
    return (
      calError * settings.calories_weight +
      protError * settings.protein_weight +
      carbError * settings.carbs_weight +
      fatError * settings.fat_weight
    );
  };
  
  let currentError = calcError(calcTotalMacros(foods, result));
  const stepSizes = [5, 2, 1];
  
  for (const stepSize of stepSizes) {
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < 100) {
      improved = false;
      iterations++;
      
      for (const food of foods) {
        const currentQty = result.get(food.meal_option_food_id) || food.quantity_grams;
        const originalQty = originalQuantities.get(food.meal_option_food_id) || food.quantity_grams;
        const limits = getCategoryLimits(food.category);
        
        // Limitar variação ao maxDelta
        const minAllowed = Math.max(limits.min, originalQty - maxDelta);
        const maxAllowed = Math.min(limits.max, originalQty + maxDelta);
        
        if (currentQty + stepSize <= maxAllowed) {
          result.set(food.meal_option_food_id, currentQty + stepSize);
          const newError = calcError(calcTotalMacros(foods, result));
          if (newError < currentError) {
            currentError = newError;
            improved = true;
            continue;
          }
        }
        
        if (currentQty - stepSize >= minAllowed) {
          result.set(food.meal_option_food_id, currentQty - stepSize);
          const newError = calcError(calcTotalMacros(foods, result));
          if (newError < currentError) {
            currentError = newError;
            improved = true;
            continue;
          }
        }
        
        result.set(food.meal_option_food_id, currentQty);
      }
    }
  }
  
  // Arredondar
  for (const [id, qty] of result.entries()) {
    result.set(id, Math.round(qty));
  }
  
  return result;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useTripleOptimizer() {
  const [phase, setPhase] = useState<{ name: string; progress: number; message: string }>({
    name: 'idle',
    progress: 0,
    message: '',
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<TripleOptimizationPreview | null>(null);
  const [settings, setSettings] = useState<OptimizerSettings>(DEFAULT_SETTINGS);

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
        }
      } catch (err) {
        console.error('[TripleOptimizer] Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  const generatePreview = useCallback(async (planId: string, targets: MacroTargets, objective: string) => {
    setIsOptimizing(true);
    setPreview(null);
    
    try {
      // ========== BUSCAR DADOS ==========
      setPhase({ name: 'loading', progress: 5, message: 'Carregando dados...' });
      
      const { data: meals } = await supabase
        .from('meals')
        .select('id, name')
        .eq('diet_plan_id', planId);
      
      if (!meals?.length) throw new Error('Nenhuma refeição encontrada');
      
      const mealIds = meals.map(m => m.id);
      const mealNameMap = new Map(meals.map(m => [m.id, m.name]));
      
      const { data: options } = await supabase
        .from('meal_options')
        .select('id, meal_id')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (!options?.length) throw new Error('Nenhuma opção encontrada');
      
      const optionIds = options.map(o => o.id);
      const optionToMealMap = new Map(options.map(o => [o.id, o.meal_id]));
      
      const { data: optionFoods } = await supabase
        .from('meal_option_foods')
        .select(`
          id,
          meal_option_id,
          quantity_grams,
          food:foods(id, name, calories, protein, carbs, fat, serving_size, category)
        `)
        .in('meal_option_id', optionIds);
      
      if (!optionFoods?.length) throw new Error('Nenhum alimento encontrado');
      
      // Parse foods
      const foods: FoodItem[] = optionFoods.map(of => {
        const food = of.food as any;
        const servingSize = (food.serving_size || '100g').toLowerCase();
        let baseGrams = 100;
        const gramsMatch = servingSize.match(/(\d+)\s*(g|ml)/);
        if (gramsMatch) baseGrams = parseInt(gramsMatch[1], 10);
        if (baseGrams <= 0) baseGrams = 100;
        
        const mealId = optionToMealMap.get(of.meal_option_id) || '';
        
        return {
          id: food.id,
          meal_option_food_id: of.id,
          meal_id: mealId,
          meal_name: mealNameMap.get(mealId) || '',
          name: food.name,
          quantity_grams: of.quantity_grams,
          calories_per_100g: (food.calories / baseGrams) * 100,
          protein_per_100g: (food.protein / baseGrams) * 100,
          carbs_per_100g: (food.carbs / baseGrams) * 100,
          fat_per_100g: (food.fat / baseGrams) * 100,
          category: food.category || '',
        };
      });
      
      const originalQuantities = new Map<string, number>();
      for (const f of foods) {
        originalQuantities.set(f.meal_option_food_id, f.quantity_grams);
      }
      
      const before = calcTotalMacros(foods, originalQuantities);
      const mealTotalsBefore = calcMealTotals(foods, originalQuantities);
      const violationsBefore = checkContractViolations(before, targets, mealTotalsBefore);
      
      const phases: PhaseResult[] = [];
      let currentQuantities = new Map(originalQuantities);
      
      // ========== FASE 1: CONTRATOS (Validação) ==========
      setPhase({ name: 'contracts', progress: 20, message: 'Fase 1: Validando contratos...' });
      
      // Nesta fase, apenas validamos - não alteramos
      const contractsPhase: PhaseResult = {
        name: 'Contratos',
        totals: calcTotalMacros(foods, currentQuantities),
        violations: checkContractViolations(
          calcTotalMacros(foods, currentQuantities),
          targets,
          calcMealTotals(foods, currentQuantities)
        ),
        changes: [],
      };
      phases.push(contractsPhase);
      console.log('[Triple] Fase 1 - Contratos: validação concluída');
      
      // ========== FASE 2: IA ==========
      setPhase({ name: 'ai', progress: 40, message: 'Fase 2: IA ajustando quantidades...' });
      
      const aiResponse = await supabase.functions.invoke('ai-rebalance', {
        body: { planId, targets, goal: objective },
      });
      
      if (aiResponse.error) {
        console.error('[Triple] AI Error:', aiResponse.error);
        throw new Error(`IA falhou: ${aiResponse.error.message}`);
      }
      
      // NOVO v5.1: Verificar se o plano é estruturalmente inválido
      if (aiResponse.data?.status === 'structurally_invalid') {
        const structuralIssue = aiResponse.data.structural_issue;
        console.error('[Triple] Plano estruturalmente inválido:', structuralIssue);
        
        // Mensagem amigável para o usuário
        const reason = structuralIssue?.reason || 'Excesso de gordura proveniente de fontes mistas';
        const fatPercent = structuralIssue?.fat_percent || 'N/A';
        const action = structuralIssue?.action || 'Regenerar plano com fontes proteicas mais magras';
        
        throw new Error(
          `🚫 Plano não pode ser otimizado\n\n` +
          `Problema: ${reason}\n` +
          `Gordura atual: ${fatPercent}% da meta\n\n` +
          `Solução: ${action}`
        );
      }
      
      // A IA já aplicou as mudanças no banco - buscar novos valores
      const { data: updatedFoods } = await supabase
        .from('meal_option_foods')
        .select('id, quantity_grams')
        .in('meal_option_id', optionIds);
      
      if (updatedFoods) {
        for (const uf of updatedFoods) {
          currentQuantities.set(uf.id, uf.quantity_grams);
        }
      }
      
      // Atualizar foods com novas quantidades
      for (const f of foods) {
        f.quantity_grams = currentQuantities.get(f.meal_option_food_id) || f.quantity_grams;
      }
      
      const aiChanges: FoodChange[] = (aiResponse.data?.food_changes || []).map((c: any) => ({
        meal_option_food_id: c.food_id,
        food_name: c.food_name,
        meal_name: '',
        old_quantity: c.original_grams,
        new_quantity: c.new_grams,
      }));
      
      const afterAI = calcTotalMacros(foods, currentQuantities);
      const aiPhase: PhaseResult = {
        name: 'IA',
        totals: {
          calories: Math.round(afterAI.calories),
          protein: Math.round(afterAI.protein),
          carbs: Math.round(afterAI.carbs),
          fat: Math.round(afterAI.fat),
        },
        violations: checkContractViolations(
          afterAI,
          targets,
          calcMealTotals(foods, currentQuantities)
        ),
        changes: aiChanges,
      };
      phases.push(aiPhase);
      console.log('[Triple] Fase 2 - IA: concluída com', aiChanges.length, 'alterações');
      
      // ========== FASE 3: AJUSTE RÁPIDO ==========
      setPhase({ name: 'quick', progress: 70, message: 'Fase 3: Ajuste fino (±10g)...' });
      
      const refinedQuantities = quickRefine(foods, currentQuantities, targets, settings, 10);
      
      const quickChanges: FoodChange[] = [];
      for (const food of foods) {
        const oldQty = currentQuantities.get(food.meal_option_food_id) || food.quantity_grams;
        const newQty = refinedQuantities.get(food.meal_option_food_id) || oldQty;
        if (Math.abs(newQty - oldQty) >= 1) {
          quickChanges.push({
            meal_option_food_id: food.meal_option_food_id,
            food_name: food.name,
            meal_name: food.meal_name,
            old_quantity: oldQty,
            new_quantity: newQty,
          });
        }
      }
      
      const afterQuick = calcTotalMacros(foods, refinedQuantities);
      const quickPhase: PhaseResult = {
        name: 'Rápido',
        totals: {
          calories: Math.round(afterQuick.calories),
          protein: Math.round(afterQuick.protein),
          carbs: Math.round(afterQuick.carbs),
          fat: Math.round(afterQuick.fat),
        },
        violations: checkContractViolations(
          afterQuick,
          targets,
          calcMealTotals(foods, refinedQuantities)
        ),
        changes: quickChanges,
      };
      phases.push(quickPhase);
      console.log('[Triple] Fase 3 - Rápido: concluída com', quickChanges.length, 'ajustes');
      
      // ========== RESULTADO FINAL ==========
      setPhase({ name: 'complete', progress: 100, message: 'Pipeline concluído!' });
      
      const allChanges = [...aiChanges, ...quickChanges];
      
      const previewResult: TripleOptimizationPreview = {
        planId,
        targets,
        before: {
          calories: Math.round(before.calories),
          protein: Math.round(before.protein),
          carbs: Math.round(before.carbs),
          fat: Math.round(before.fat),
        },
        phases,
        final: quickPhase.totals,
        allChanges,
        violationsBefore,
        violationsAfter: quickPhase.violations,
      };
      
      setPreview(previewResult);
      return previewResult;
      
    } catch (error: any) {
      console.error('[Triple] Error:', error);
      setPhase({ name: 'error', progress: 0, message: error.message });
      
      // Mensagem especial para plano estruturalmente inválido
      if (error.message?.includes('Plano não pode ser otimizado')) {
        toast.error('Plano precisa ser regenerado', {
          description: 'A composição atual tem excesso de gordura que não pode ser corrigido por ajustes. Gere um novo plano para aplicar as novas regras de proteínas magras.',
          duration: 10000,
        });
      } else {
        toast.error('Erro na otimização', {
          description: error.message,
          duration: 5000,
        });
      }
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [settings]);

  const applyPreview = useCallback(async () => {
    if (!preview) return null;
    
    // Apenas os ajustes rápidos precisam ser aplicados (IA já aplicou)
    const quickChanges = preview.phases.find(p => p.name === 'Rápido')?.changes || [];
    
    if (quickChanges.length === 0) {
      toast.info('Nenhum ajuste adicional para aplicar');
      return preview;
    }

    setIsApplying(true);
    
    try {
      for (const change of quickChanges) {
        await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.new_quantity })
          .eq('id', change.meal_option_food_id);
      }
      
      // Recalcular totais das opções e do plano
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', preview.planId);
      
      if (meals) {
        const mealIds = meals.map(m => m.id);
        
        const { data: options } = await supabase
          .from('meal_options')
          .select('id')
          .in('meal_id', mealIds)
          .eq('option_number', 1);
        
        if (options) {
          for (const opt of options) {
            const { data: foods } = await supabase
              .from('meal_option_foods')
              .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
              .eq('meal_option_id', opt.id);
            
            if (foods) {
              let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
              for (const f of foods) {
                const food = f.food as any;
                const servingSize = (food.serving_size || '100g').toLowerCase();
                let baseGrams = 100;
                const match = servingSize.match(/(\d+)\s*(g|ml)/);
                if (match) baseGrams = parseInt(match[1], 10);
                if (baseGrams <= 0) baseGrams = 100;
                
                const mult = f.quantity_grams / baseGrams;
                totals.calories += Math.round(food.calories * mult);
                totals.protein += Math.round(food.protein * mult);
                totals.carbs += Math.round(food.carbs * mult);
                totals.fat += Math.round(food.fat * mult);
              }
              
              await supabase
                .from('meal_options')
                .update({
                  total_calories: totals.calories,
                  total_protein: totals.protein,
                  total_carbs: totals.carbs,
                  total_fat: totals.fat,
                })
                .eq('id', opt.id);
            }
          }
          
          // Atualizar plano
          const { data: allOpts } = await supabase
            .from('meal_options')
            .select('total_calories, total_protein, total_carbs, total_fat')
            .in('meal_id', mealIds)
            .eq('option_number', 1);
          
          if (allOpts) {
            const planTotals = allOpts.reduce(
              (acc, o) => ({
                calories: acc.calories + (o.total_calories || 0),
                protein: acc.protein + (o.total_protein || 0),
                carbs: acc.carbs + (o.total_carbs || 0),
                fat: acc.fat + (o.total_fat || 0),
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
      }
      
      toast.success(`Otimização tripla aplicada! ${preview.allChanges.length} ajustes no total.`);
      setPreview(null);
      return preview;
      
    } catch (error: any) {
      console.error('[Triple] Apply error:', error);
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
    setPhase({ name: 'idle', progress: 0, message: '' });
  }, []);

  return {
    phase,
    isOptimizing,
    isApplying,
    preview,
    generatePreview,
    applyPreview,
    cancelPreview,
    reset,
  };
}
