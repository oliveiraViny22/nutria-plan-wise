// =====================================================
// OTIMIZADOR COM CONTRATOS NUTRICIONAIS
// =====================================================
// Combina precisão matemática com contratos nutricionais:
// - Mínimos proteicos por refeição (20g principais, 5g lanches)
// - Gordura máxima 30% das calorias
// - Carboidratos mínimo 90% da meta
// - Proteína mínima 95% da meta
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// CONTRATOS NUTRICIONAIS (espelhados da edge function)
// =====================================================

const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

const CONTRACT = {
  // Tolerância calórica: plano deve estar dentro de ±5%
  CALORIE_TOLERANCE_PERCENT: 5,
  // Gordura máxima: 30% das calorias totais
  MAX_FAT_PERCENT_OF_CALORIES: 30,
  // Proteína mínima por refeição principal (almoço, jantar)
  MIN_PROTEIN_MAIN_MEAL_GRAMS: 20,
  // Proteína mínima por lanche
  MIN_PROTEIN_SNACK_GRAMS: 5,
  // Carboidrato mínimo: 90% da meta
  MIN_CARBS_PERCENT: 90,
  // Proteína mínima global: 95% da meta
  MIN_PROTEIN_PERCENT: 95,
} as const;

// Refeições principais (almoço, jantar)
const MAIN_MEALS = ['lunch', 'dinner', 'almoço', 'jantar', 'almoco'];
// Lanches
const SNACK_MEALS = ['morning_snack', 'afternoon_snack', 'lanche_manha', 'lanche_tarde', 'lanche'];

// =====================================================
// LIMITES POR CATEGORIA
// =====================================================

const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  'carboidrato': { min: 40, max: 300 },
  'carboidratos': { min: 40, max: 300 },
  'grãos': { min: 40, max: 250 },
  'cereais': { min: 30, max: 200 },
  'pães': { min: 25, max: 150 },
  'massas': { min: 60, max: 250 },
  'tubérculos': { min: 50, max: 300 },
  'proteína': { min: 60, max: 250 },
  'proteínas': { min: 60, max: 250 },
  'carnes': { min: 80, max: 250 },
  'aves': { min: 80, max: 250 },
  'peixes': { min: 80, max: 250 },
  'frutos do mar': { min: 60, max: 200 },
  'ovos': { min: 50, max: 200 },
  'laticínios': { min: 30, max: 300 },
  'queijos': { min: 20, max: 100 },
  'leite': { min: 100, max: 400 },
  'iogurtes': { min: 100, max: 300 },
  'vegetais': { min: 30, max: 300 },
  'verduras': { min: 20, max: 200 },
  'legumes': { min: 40, max: 250 },
  'frutas': { min: 50, max: 300 },
  'saladas': { min: 30, max: 200 },
  'gorduras': { min: 5, max: 50 },
  'óleos': { min: 5, max: 30 },
  'oleaginosas': { min: 10, max: 60 },
  'castanhas': { min: 10, max: 50 },
  'suplementos': { min: 10, max: 100 },
  'bebidas': { min: 100, max: 500 },
  'condimentos': { min: 5, max: 30 },
};

const DEFAULT_MIN_GRAMS = 20;
const DEFAULT_MAX_GRAMS = 400;

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

export interface ContractOptimizationPreview {
  planId: string;
  changes: Array<{
    meal_option_food_id: string;
    food_name: string;
    meal_name: string;
    old_quantity: number;
    new_quantity: number;
  }>;
  before: MacroTargets;
  after: MacroTargets;
  targets: MacroTargets;
  violationsBefore: ContractViolation[];
  violationsAfter: ContractViolation[];
  mealTotalsBefore: MealTotals[];
  mealTotalsAfter: MealTotals[];
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

function getCategoryLimits(category: string): { min: number; max: number } {
  const normalizedCategory = category.toLowerCase().trim();
  if (CATEGORY_LIMITS[normalizedCategory]) {
    return CATEGORY_LIMITS[normalizedCategory];
  }
  for (const [key, limits] of Object.entries(CATEGORY_LIMITS)) {
    if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
      return limits;
    }
  }
  return { min: DEFAULT_MIN_GRAMS, max: DEFAULT_MAX_GRAMS };
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
  
  // 1. Calorias dentro de ±5%
  const caloriePercent = targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0;
  const calorieDiff = Math.abs(caloriePercent - 100);
  if (calorieDiff > CONTRACT.CALORIE_TOLERANCE_PERCENT) {
    violations.push({
      code: 'CAL_OUT_OF_RANGE',
      message: `Calorias fora da tolerância: ${Math.round(totals.calories)} kcal (${caloriePercent.toFixed(1)}% da meta)`,
      severity: 'error',
    });
  }
  
  // 2. Proteína global ≥95%
  const proteinPercent = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0;
  if (proteinPercent < CONTRACT.MIN_PROTEIN_PERCENT) {
    violations.push({
      code: 'PROTEIN_BELOW_MIN',
      message: `Proteína insuficiente: ${Math.round(totals.protein)}g (${proteinPercent.toFixed(1)}% da meta, mín: ${CONTRACT.MIN_PROTEIN_PERCENT}%)`,
      severity: 'error',
    });
  }
  
  // 3. Carboidratos ≥90%
  const carbsPercent = targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0;
  if (carbsPercent < CONTRACT.MIN_CARBS_PERCENT) {
    violations.push({
      code: 'CARBS_BELOW_MIN',
      message: `Carboidratos insuficientes: ${Math.round(totals.carbs)}g (${carbsPercent.toFixed(1)}% da meta, mín: ${CONTRACT.MIN_CARBS_PERCENT}%)`,
      severity: 'warning',
    });
  }
  
  // 4. Gordura ≤30% das calorias
  const fatCalories = totals.fat * KCAL_PER_GRAM.fat;
  const fatPercentOfCalories = totals.calories > 0 ? (fatCalories / totals.calories) * 100 : 0;
  if (fatPercentOfCalories > CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
    violations.push({
      code: 'FAT_EXCEEDS_MAX',
      message: `Gordura excessiva: ${fatPercentOfCalories.toFixed(1)}% das calorias (máx: ${CONTRACT.MAX_FAT_PERCENT_OF_CALORIES}%)`,
      severity: 'error',
    });
  }
  
  // 5. Proteína por refeição
  for (const meal of mealTotals) {
    const normalizedName = meal.meal_name.toLowerCase();
    const isMainMeal = MAIN_MEALS.some(m => normalizedName.includes(m));
    const isSnack = SNACK_MEALS.some(m => normalizedName.includes(m));
    
    if (isMainMeal && meal.protein < CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
      violations.push({
        code: 'MEAL_PROTEIN_LOW',
        message: `${meal.meal_name}: proteína insuficiente ${Math.round(meal.protein)}g (mín: ${CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS}g)`,
        severity: 'warning',
      });
    } else if (isSnack && meal.protein < CONTRACT.MIN_PROTEIN_SNACK_GRAMS) {
      violations.push({
        code: 'SNACK_PROTEIN_LOW',
        message: `${meal.meal_name}: proteína insuficiente ${Math.round(meal.protein)}g (mín: ${CONTRACT.MIN_PROTEIN_SNACK_GRAMS}g)`,
        severity: 'warning',
      });
    }
  }
  
  return violations;
}

// =====================================================
// FUNÇÃO DE ERRO COM CONTRATOS
// =====================================================

function calcErrorWithContracts(
  current: MacroTargets,
  targets: MacroTargets,
  mealTotals: MealTotals[],
  settings: OptimizerSettings
): number {
  // Erro base de macros
  const calError = Math.abs(current.calories - targets.calories) / targets.calories;
  const protError = Math.abs(current.protein - targets.protein) / targets.protein;
  const carbError = Math.abs(current.carbs - targets.carbs) / targets.carbs;
  const fatError = Math.abs(current.fat - targets.fat) / targets.fat;
  
  // Penalidades por violação de contratos
  let contractPenalty = 0;
  
  // Penalidade: proteína abaixo do piso global (95%)
  const proteinPercent = (current.protein / targets.protein) * 100;
  if (proteinPercent < CONTRACT.MIN_PROTEIN_PERCENT) {
    contractPenalty += (CONTRACT.MIN_PROTEIN_PERCENT - proteinPercent) * 0.5;
  }
  
  // Penalidade: carboidratos abaixo do piso (90%)
  const carbsPercent = (current.carbs / targets.carbs) * 100;
  if (carbsPercent < CONTRACT.MIN_CARBS_PERCENT) {
    contractPenalty += (CONTRACT.MIN_CARBS_PERCENT - carbsPercent) * 0.3;
  }
  
  // Penalidade: gordura excessiva (>30% das calorias)
  const fatCalories = current.fat * KCAL_PER_GRAM.fat;
  const fatPercentOfCalories = current.calories > 0 ? (fatCalories / current.calories) * 100 : 0;
  if (fatPercentOfCalories > CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
    contractPenalty += (fatPercentOfCalories - CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) * 0.5;
  }
  
  // Penalidade por refeição: proteína mínima
  for (const meal of mealTotals) {
    const normalizedName = meal.meal_name.toLowerCase();
    const isMainMeal = MAIN_MEALS.some(m => normalizedName.includes(m));
    const isSnack = SNACK_MEALS.some(m => normalizedName.includes(m));
    
    if (isMainMeal && meal.protein < CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
      contractPenalty += (CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS - meal.protein) * 0.2;
    } else if (isSnack && meal.protein < CONTRACT.MIN_PROTEIN_SNACK_GRAMS) {
      contractPenalty += (CONTRACT.MIN_PROTEIN_SNACK_GRAMS - meal.protein) * 0.1;
    }
  }
  
  // Erro total ponderado
  return (
    calError * settings.calories_weight +
    protError * settings.protein_weight +
    carbError * settings.carbs_weight +
    fatError * settings.fat_weight +
    contractPenalty
  );
}

// =====================================================
// OTIMIZADOR PRINCIPAL COM CONTRATOS
// =====================================================

function optimizeWithContracts(
  foods: FoodItem[],
  targets: MacroTargets,
  settings: OptimizerSettings,
  maxIterations: number = 1000
): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const food of foods) {
    quantities.set(food.meal_option_food_id, food.quantity_grams);
  }
  
  const mealTotals = calcMealTotals(foods, quantities);
  let currentError = calcErrorWithContracts(
    calcTotalMacros(foods, quantities),
    targets,
    mealTotals,
    settings
  );
  
  const stepSizes = [50, 20, 10, 5, 2, 1];
  
  for (const stepSize of stepSizes) {
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < maxIterations / stepSizes.length) {
      improved = false;
      iterations++;
      
      for (const food of foods) {
        const currentQty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
        const limits = getCategoryLimits(food.category);
        
        // Tentar aumentar
        const increasedQty = Math.min(currentQty + stepSize, limits.max);
        quantities.set(food.meal_option_food_id, increasedQty);
        const newMealTotals = calcMealTotals(foods, quantities);
        const increasedError = calcErrorWithContracts(
          calcTotalMacros(foods, quantities),
          targets,
          newMealTotals,
          settings
        );
        
        if (increasedError < currentError) {
          currentError = increasedError;
          improved = true;
          continue;
        }
        
        // Tentar diminuir
        const decreasedQty = Math.max(currentQty - stepSize, limits.min);
        quantities.set(food.meal_option_food_id, decreasedQty);
        const newMealTotals2 = calcMealTotals(foods, quantities);
        const decreasedError = calcErrorWithContracts(
          calcTotalMacros(foods, quantities),
          targets,
          newMealTotals2,
          settings
        );
        
        if (decreasedError < currentError) {
          currentError = decreasedError;
          improved = true;
          continue;
        }
        
        // Reverter
        quantities.set(food.meal_option_food_id, currentQty);
      }
    }
  }
  
  // Arredondar e garantir limites
  for (const food of foods) {
    const qty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
    const limits = getCategoryLimits(food.category);
    const clampedQty = Math.max(limits.min, Math.min(limits.max, Math.round(qty)));
    quantities.set(food.meal_option_food_id, clampedQty);
  }
  
  return quantities;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useContractOptimizer() {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<ContractOptimizationPreview | null>(null);
  const [settings, setSettings] = useState<OptimizerSettings>(DEFAULT_SETTINGS);

  // Carregar settings do banco
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
        console.error('[ContractOptimizer] Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  const generatePreview = useCallback(async (planId: string, targets: MacroTargets) => {
    setIsOptimizing(true);
    setPreview(null);
    
    try {
      // 1. Buscar refeições do plano
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
      const mealNameMap = new Map(meals.map(m => [m.id, m.name]));
      
      // 2. Buscar opções (apenas opção 1)
      const { data: options, error: optionsError } = await supabase
        .from('meal_options')
        .select('id, meal_id')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (optionsError) throw optionsError;
      if (!options || options.length === 0) {
        toast.error('Nenhuma opção de refeição encontrada');
        return null;
      }
      
      const optionIds = options.map(o => o.id);
      const optionToMealMap = new Map(options.map(o => [o.id, o.meal_id]));
      
      // 3. Buscar alimentos
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
      
      // 4. Parsear alimentos
      const foods: FoodItem[] = optionFoods.map(of => {
        const food = of.food as any;
        const servingSize = (food.serving_size || '100g').toLowerCase();
        const mealId = optionToMealMap.get(of.meal_option_id) || '';
        
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
          meal_id: mealId,
          meal_name: mealNameMap.get(mealId) || 'Refeição',
          name: food.name,
          quantity_grams: of.quantity_grams,
          calories_per_100g: (food.calories / baseGrams) * 100,
          protein_per_100g: (food.protein / baseGrams) * 100,
          carbs_per_100g: (food.carbs / baseGrams) * 100,
          fat_per_100g: (food.fat / baseGrams) * 100,
          category: food.category,
        };
      });
      
      // 5. Calcular estado ANTES
      const beforeQuantities = new Map<string, number>();
      for (const f of foods) {
        beforeQuantities.set(f.meal_option_food_id, f.quantity_grams);
      }
      const beforeMacros = calcTotalMacros(foods, beforeQuantities);
      const mealTotalsBefore = calcMealTotals(foods, beforeQuantities);
      const violationsBefore = checkContractViolations(beforeMacros, targets, mealTotalsBefore);
      
      // 6. Otimizar
      console.log('[ContractOptimizer] Gerando prévia com contratos...');
      console.log('[ContractOptimizer] Antes:', beforeMacros);
      console.log('[ContractOptimizer] Violações antes:', violationsBefore.length);
      
      const optimizedQuantities = optimizeWithContracts(foods, targets, settings);
      const afterMacros = calcTotalMacros(foods, optimizedQuantities);
      const mealTotalsAfter = calcMealTotals(foods, optimizedQuantities);
      const violationsAfter = checkContractViolations(afterMacros, targets, mealTotalsAfter);
      
      console.log('[ContractOptimizer] Depois:', afterMacros);
      console.log('[ContractOptimizer] Violações depois:', violationsAfter.length);
      
      // 7. Montar changes
      const changes: ContractOptimizationPreview['changes'] = [];
      for (const food of foods) {
        const oldQty = food.quantity_grams;
        const newQty = optimizedQuantities.get(food.meal_option_food_id) || oldQty;
        
        if (Math.abs(newQty - oldQty) >= 1) {
          changes.push({
            meal_option_food_id: food.meal_option_food_id,
            food_name: food.name,
            meal_name: food.meal_name,
            old_quantity: oldQty,
            new_quantity: newQty,
          });
        }
      }
      
      const previewResult: ContractOptimizationPreview = {
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
        violationsBefore,
        violationsAfter,
        mealTotalsBefore: mealTotalsBefore.map(m => ({
          ...m,
          calories: Math.round(m.calories),
          protein: Math.round(m.protein),
          carbs: Math.round(m.carbs),
          fat: Math.round(m.fat),
        })),
        mealTotalsAfter: mealTotalsAfter.map(m => ({
          ...m,
          calories: Math.round(m.calories),
          protein: Math.round(m.protein),
          carbs: Math.round(m.carbs),
          fat: Math.round(m.fat),
        })),
      };
      
      setPreview(previewResult);
      return previewResult;
    } catch (error: any) {
      console.error('[ContractOptimizer] Preview error:', error);
      toast.error('Erro ao gerar prévia: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsOptimizing(false);
    }
  }, [settings]);

  const applyPreview = useCallback(async () => {
    if (!preview || preview.changes.length === 0) {
      toast.info('Nenhuma alteração para aplicar');
      return null;
    }

    setIsApplying(true);
    
    try {
      console.log('[ContractOptimizer] Aplicando alterações...');
      
      // 1. Atualizar quantidades
      for (const change of preview.changes) {
        const { error: updateError } = await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.new_quantity })
          .eq('id', change.meal_option_food_id);
        
        if (updateError) {
          console.error('[ContractOptimizer] Update error:', updateError);
        }
      }
      
      // 2. Recalcular totais das opções e do plano
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
      
      // Recalcular cada opção
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
      
      toast.success(
        `Otimização aplicada! ${preview.changes.length} alimentos ajustados. Violações: ${preview.violationsBefore.length} → ${preview.violationsAfter.length}`,
        { duration: 5000 }
      );
      
      const result = { success: true, ...preview };
      setPreview(null);
      return result;
    } catch (error: any) {
      console.error('[ContractOptimizer] Apply error:', error);
      toast.error('Erro ao aplicar: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsApplying(false);
    }
  }, [preview]);

  const cancelPreview = useCallback(() => {
    setPreview(null);
  }, []);

  return {
    isOptimizing,
    isApplying,
    preview,
    generatePreview,
    applyPreview,
    cancelPreview,
  };
}
