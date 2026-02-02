// =====================================================
// OTIMIZAÇÃO DE MACROS - ESCALONAMENTO MULTI-OBJETIVO
// =====================================================
// Implementa ajustes inteligentes para atingir metas de
// proteína, carboidratos e gordura além de calorias.
// =====================================================

import type { Food, FoodSelection, MealResult, MealWithOptions, MacroTotals, MacroTargets } from "./types.ts";
import { CATEGORY_SCALE_LIMITS, DEFAULT_SCALE_LIMITS } from "./constants.ts";
import { applyUnitConversion } from "./unit-conversion.ts";
import { logInfo, logDebug } from "./logger.ts";
import { GENERATOR_CONTRACT, KCAL_PER_GRAM } from "../_shared/nutrition-contracts.ts";

// =====================================================
// CATEGORIAS POR MACRO PRINCIPAL
// =====================================================

const PROTEIN_CATEGORIES = ["proteinas", "laticinios", "leguminosas"];
const CARBS_CATEGORIES = ["carboidratos", "leguminosas", "frutas"];
const FAT_CATEGORIES = ["gorduras", "oleaginosas"];

// =====================================================
// TIPOS
// =====================================================

interface MacroDeficits {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodWithMeta {
  food: FoodSelection;
  option: MealResult;
  category: string;
  proteinDensity: number;
  carbsDensity: number;
  fatDensity: number;
  caloriesDensity: number;
}

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function getScaleLimits(food: Food): { min: number; max: number } {
  const category = (food.category || "").toLowerCase();
  return CATEGORY_SCALE_LIMITS[category] || DEFAULT_SCALE_LIMITS;
}

function calculateDeficits(current: MacroTotals, targets: MacroTargets): MacroDeficits {
  return {
    calories: targets.calories - current.calories,
    protein: targets.protein - current.protein,
    carbs: targets.carbs - current.carbs,
    fat: targets.fat - current.fat,
  };
}

function recalculateOptionTotals(option: MealResult): void {
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

function calculatePlanTotals(mealsWithOptions: MealWithOptions[]): MacroTotals {
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

function collectAllFoodsWithMeta(mealsWithOptions: MealWithOptions[]): FoodWithMeta[] {
  const foods: FoodWithMeta[] = [];
  
  for (const mealData of mealsWithOptions) {
    for (const option of mealData.options) {
      for (const foodSel of option.foods) {
        const category = (foodSel.food.category || "").toLowerCase();
        const calories = foodSel.food.calories || 1; // Evitar divisão por zero
        
        foods.push({
          food: foodSel,
          option,
          category,
          proteinDensity: foodSel.food.protein / calories,
          carbsDensity: foodSel.food.carbs / calories,
          fatDensity: foodSel.food.fat / calories,
          caloriesDensity: foodSel.food.calories / 100,
        });
      }
    }
  }
  
  return foods;
}

// =====================================================
// SOLUÇÃO 1: ESCALONAMENTO MULTI-OBJETIVO
// =====================================================

/**
 * Aplica fatores de escala diferentes por categoria de macro.
 * Proteínas são escaladas pelo ratio de proteína, etc.
 */
export function applyMultiObjectiveScaling(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets
): boolean {
  const current = calculatePlanTotals(mealsWithOptions);
  
  // Calcular ratios por macro
  const proteinRatio = targets.protein / Math.max(current.protein, 1);
  const carbsRatio = targets.carbs / Math.max(current.carbs, 1);
  const fatRatio = targets.fat / Math.max(current.fat, 1);
  
  logDebug("Ratios multi-objetivo", {
    proteinRatio: proteinRatio.toFixed(3),
    carbsRatio: carbsRatio.toFixed(3),
    fatRatio: fatRatio.toFixed(3),
  });
  
  let adjusted = false;
  
  for (const mealData of mealsWithOptions) {
    for (const option of mealData.options) {
      for (const foodSel of option.foods) {
        const category = (foodSel.food.category || "").toLowerCase();
        let scaleFactor = 1;
        
        // Determinar fator baseado na categoria principal do alimento
        if (PROTEIN_CATEGORIES.includes(category)) {
          // Proteínas: usar ratio de proteína com peso alto
          scaleFactor = proteinRatio * 0.7 + carbsRatio * 0.2 + fatRatio * 0.1;
        } else if (CARBS_CATEGORIES.includes(category) && !PROTEIN_CATEGORIES.includes(category)) {
          // Carboidratos puros: priorizar ratio de carbs
          scaleFactor = carbsRatio * 0.8 + proteinRatio * 0.1 + fatRatio * 0.1;
        } else if (FAT_CATEGORIES.includes(category)) {
          // Gorduras: usar ratio de gordura mas com cautela
          scaleFactor = fatRatio * 0.6 + carbsRatio * 0.2 + proteinRatio * 0.2;
        } else {
          // Outras categorias (vegetais, etc): escalar suavemente
          const avgRatio = (proteinRatio + carbsRatio + fatRatio) / 3;
          scaleFactor = avgRatio;
        }
        
        // Limitar o fator para evitar mudanças extremas
        scaleFactor = Math.max(0.5, Math.min(2.0, scaleFactor));
        
        const limits = getScaleLimits(foodSel.food);
        let newGrams = foodSel.quantity_grams * scaleFactor;
        newGrams = Math.max(limits.min, Math.min(limits.max, newGrams));
        newGrams = Math.round(newGrams / 5) * 5;
        
        if (Math.abs(newGrams - foodSel.quantity_grams) >= 5) {
          const conversion = applyUnitConversion(foodSel.food, newGrams);
          foodSel.quantity_grams = conversion.calculated_grams;
          foodSel.display_quantity = conversion.display_quantity;
          foodSel.display_unit = conversion.display_unit;
          adjusted = true;
        }
      }
      
      recalculateOptionTotals(option);
    }
  }
  
  if (adjusted) {
    const afterTotals = calculatePlanTotals(mealsWithOptions);
    logDebug("Após escalonamento multi-objetivo", {
      protein: `${current.protein.toFixed(1)} → ${afterTotals.protein.toFixed(1)}g`,
      carbs: `${current.carbs.toFixed(1)} → ${afterTotals.carbs.toFixed(1)}g`,
      fat: `${current.fat.toFixed(1)} → ${afterTotals.fat.toFixed(1)}g`,
    });
  }
  
  return adjusted;
}

// =====================================================
// SOLUÇÃO 2: AJUSTE FINO POR MACRO
// =====================================================

/**
 * Ajusta incrementalmente alimentos específicos para corrigir déficits de macros.
 * Prioriza alimentos com maior densidade do macro deficiente.
 */
export function applyMacroFineAdjustment(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets,
  maxIterations: number = 3
): boolean {
  const INCREMENT = 10; // gramas por ajuste
  let totalAdjusted = false;
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const current = calculatePlanTotals(mealsWithOptions);
    const deficits = calculateDeficits(current, targets);
    
    // Verificar se já está dentro das tolerâncias
    const proteinPercent = (current.protein / targets.protein) * 100;
    const carbsPercent = (current.carbs / targets.carbs) * 100;
    
    const proteinOk = proteinPercent >= GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT;
    const carbsOk = carbsPercent >= GENERATOR_CONTRACT.MIN_CARBS_PERCENT;
    
    if (proteinOk && carbsOk) {
      logDebug(`Ajuste fino concluído na iteração ${iteration + 1}`);
      break;
    }
    
    const allFoods = collectAllFoodsWithMeta(mealsWithOptions);
    let adjustedThisRound = false;
    
    // Prioridade 1: Proteína (se abaixo da meta)
    if (!proteinOk && deficits.protein > 5) {
      const proteinFoods = allFoods
        .filter(f => PROTEIN_CATEGORIES.includes(f.category))
        .sort((a, b) => b.proteinDensity - a.proteinDensity);
      
      for (const { food, option } of proteinFoods.slice(0, 2)) {
        const limits = getScaleLimits(food.food);
        const gramsToAdd = Math.min(
          INCREMENT * 2,
          limits.max - food.quantity_grams,
          (deficits.protein / food.food.protein) * 100
        );
        
        if (gramsToAdd >= 5) {
          const newGrams = Math.round((food.quantity_grams + gramsToAdd) / 5) * 5;
          const conversion = applyUnitConversion(food.food, newGrams);
          food.quantity_grams = conversion.calculated_grams;
          food.display_quantity = conversion.display_quantity;
          food.display_unit = conversion.display_unit;
          recalculateOptionTotals(option);
          adjustedThisRound = true;
          
          logDebug(`+Proteína: ${food.food.name}`, {
            added: gramsToAdd.toFixed(0),
            newGrams,
          });
        }
      }
    }
    
    // Prioridade 2: Carboidratos (se abaixo da meta)
    if (!carbsOk && deficits.carbs > 10) {
      const carbsFoods = allFoods
        .filter(f => CARBS_CATEGORIES.includes(f.category) && !PROTEIN_CATEGORIES.includes(f.category))
        .sort((a, b) => b.carbsDensity - a.carbsDensity);
      
      for (const { food, option } of carbsFoods.slice(0, 2)) {
        const limits = getScaleLimits(food.food);
        const gramsToAdd = Math.min(
          INCREMENT * 3,
          limits.max - food.quantity_grams,
          (deficits.carbs / food.food.carbs) * 100
        );
        
        if (gramsToAdd >= 5) {
          const newGrams = Math.round((food.quantity_grams + gramsToAdd) / 5) * 5;
          const conversion = applyUnitConversion(food.food, newGrams);
          food.quantity_grams = conversion.calculated_grams;
          food.display_quantity = conversion.display_quantity;
          food.display_unit = conversion.display_unit;
          recalculateOptionTotals(option);
          adjustedThisRound = true;
          
          logDebug(`+Carboidratos: ${food.food.name}`, {
            added: gramsToAdd.toFixed(0),
            newGrams,
          });
        }
      }
    }
    
    // Prioridade 3: Reduzir gordura (se acima do limite)
    const fatPercent = (current.fat * KCAL_PER_GRAM.fat / current.calories) * 100;
    if (fatPercent > GENERATOR_CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
      const fatFoods = allFoods
        .filter(f => FAT_CATEGORIES.includes(f.category))
        .sort((a, b) => b.fatDensity - a.fatDensity);
      
      for (const { food, option } of fatFoods.slice(0, 1)) {
        const limits = getScaleLimits(food.food);
        const gramsToRemove = Math.min(
          INCREMENT,
          food.quantity_grams - limits.min
        );
        
        if (gramsToRemove >= 5) {
          const newGrams = Math.round((food.quantity_grams - gramsToRemove) / 5) * 5;
          const conversion = applyUnitConversion(food.food, newGrams);
          food.quantity_grams = conversion.calculated_grams;
          food.display_quantity = conversion.display_quantity;
          food.display_unit = conversion.display_unit;
          recalculateOptionTotals(option);
          adjustedThisRound = true;
          
          logDebug(`-Gordura: ${food.food.name}`, {
            removed: gramsToRemove.toFixed(0),
            newGrams,
          });
        }
      }
    }
    
    if (adjustedThisRound) {
      totalAdjusted = true;
    } else {
      break; // Nenhum ajuste possível
    }
  }
  
  return totalAdjusted;
}

// =====================================================
// FUNÇÃO PRINCIPAL DE OTIMIZAÇÃO
// =====================================================

export interface MacroOptimizationResult {
  beforeTotals: MacroTotals;
  afterTotals: MacroTotals;
  multiObjectiveApplied: boolean;
  fineAdjustmentApplied: boolean;
  metrics: OptimizationMetrics;
}

export interface OptimizationMetrics {
  executionTimeMs: number;
  proteinImprovement: number;
  carbsImprovement: number;
  fatImprovement: number;
  totalAdjustments: number;
  timestamp: string;
}

/**
 * Aplica todas as otimizações de macro em sequência.
 * Deve ser chamada APÓS o escalonamento calórico básico.
 * Inclui métricas detalhadas para monitoramento em produção.
 */
export function optimizeMacroDistribution(
  mealsWithOptions: MealWithOptions[],
  targets: MacroTargets
): MacroOptimizationResult {
  const startTime = performance.now();
  const timestamp = new Date().toISOString();
  
  const beforeTotals = calculatePlanTotals(mealsWithOptions);
  
  // Log estruturado de início
  logInfo("🔧 [MACRO-OPT] Iniciando otimização", {
    timestamp,
    stage: "START",
    before: {
      calories: beforeTotals.calories,
      protein: beforeTotals.protein,
      carbs: beforeTotals.carbs,
      fat: beforeTotals.fat,
    },
    targets: {
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
    },
    deficits: {
      protein: `${(beforeTotals.protein / targets.protein * 100).toFixed(1)}%`,
      carbs: `${(beforeTotals.carbs / targets.carbs * 100).toFixed(1)}%`,
      fat: `${(beforeTotals.fat / targets.fat * 100).toFixed(1)}%`,
    },
    mealsCount: mealsWithOptions.length,
    foodsCount: mealsWithOptions.reduce((sum, m) => 
      sum + (m.options[0]?.foods.length || 0), 0
    ),
  });
  
  // Passo 1: Escalonamento multi-objetivo
  const step1Start = performance.now();
  const multiObjectiveApplied = applyMultiObjectiveScaling(mealsWithOptions, targets);
  const step1Time = performance.now() - step1Start;
  
  const afterStep1 = calculatePlanTotals(mealsWithOptions);
  logInfo("🔧 [MACRO-OPT] Multi-objetivo concluído", {
    timestamp,
    stage: "MULTI_OBJECTIVE",
    applied: multiObjectiveApplied,
    executionMs: step1Time.toFixed(2),
    totals: {
      protein: afterStep1.protein,
      carbs: afterStep1.carbs,
      fat: afterStep1.fat,
    },
  });
  
  // Passo 2: Ajuste fino por macro
  const step2Start = performance.now();
  const fineAdjustmentApplied = applyMacroFineAdjustment(mealsWithOptions, targets);
  const step2Time = performance.now() - step2Start;
  
  const afterTotals = calculatePlanTotals(mealsWithOptions);
  
  const totalTime = performance.now() - startTime;
  
  // Calcular melhorias percentuais
  const proteinBefore = beforeTotals.protein / targets.protein * 100;
  const proteinAfter = afterTotals.protein / targets.protein * 100;
  const carbsBefore = beforeTotals.carbs / targets.carbs * 100;
  const carbsAfter = afterTotals.carbs / targets.carbs * 100;
  const fatBefore = beforeTotals.fat / targets.fat * 100;
  const fatAfter = afterTotals.fat / targets.fat * 100;
  
  const metrics: OptimizationMetrics = {
    executionTimeMs: Math.round(totalTime * 100) / 100,
    proteinImprovement: Math.round((proteinAfter - proteinBefore) * 10) / 10,
    carbsImprovement: Math.round((carbsAfter - carbsBefore) * 10) / 10,
    fatImprovement: Math.round((fatAfter - fatBefore) * 10) / 10,
    totalAdjustments: (multiObjectiveApplied ? 1 : 0) + (fineAdjustmentApplied ? 1 : 0),
    timestamp,
  };
  
  // Log estruturado final com todas as métricas
  logInfo("✅ [MACRO-OPT] Otimização concluída", {
    timestamp,
    stage: "COMPLETE",
    executionTimeMs: metrics.executionTimeMs,
    steps: {
      multiObjective: {
        applied: multiObjectiveApplied,
        timeMs: step1Time.toFixed(2),
      },
      fineAdjustment: {
        applied: fineAdjustmentApplied,
        timeMs: step2Time.toFixed(2),
      },
    },
    before: {
      calories: beforeTotals.calories,
      protein: `${beforeTotals.protein}g (${proteinBefore.toFixed(1)}%)`,
      carbs: `${beforeTotals.carbs}g (${carbsBefore.toFixed(1)}%)`,
      fat: `${beforeTotals.fat}g (${fatBefore.toFixed(1)}%)`,
    },
    after: {
      calories: afterTotals.calories,
      protein: `${afterTotals.protein}g (${proteinAfter.toFixed(1)}%)`,
      carbs: `${afterTotals.carbs}g (${carbsAfter.toFixed(1)}%)`,
      fat: `${afterTotals.fat}g (${fatAfter.toFixed(1)}%)`,
    },
    improvements: {
      protein: `${metrics.proteinImprovement >= 0 ? '+' : ''}${metrics.proteinImprovement}pp`,
      carbs: `${metrics.carbsImprovement >= 0 ? '+' : ''}${metrics.carbsImprovement}pp`,
      fat: `${metrics.fatImprovement >= 0 ? '+' : ''}${metrics.fatImprovement}pp`,
    },
    success: proteinAfter >= 95 && carbsAfter >= 90,
  });
  
  return {
    beforeTotals,
    afterTotals,
    multiObjectiveApplied,
    fineAdjustmentApplied,
    metrics,
  };
}
