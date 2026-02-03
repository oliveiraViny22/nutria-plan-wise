// ============================================
// REBALANCEADOR AUTOMÁTICO NUTRIAPLAN v2
// ============================================
// Implementação conforme especificação:
// - Validação por objetivo (cut/maintain/bulk)
// - Pipeline de 4 etapas (ordem fixa)
// - Máximo de 3 ciclos de correção
// - Formato JSON estruturado
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  KCAL_PER_GRAM,
  REBALANCER_CONTRACT,
} from "../_shared/nutrition-contracts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TIPOS
// ============================================

type Objective = "cut" | "maintain" | "bulk";
type G10Status = "PASS" | "ALLOW_REBALANCE";

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface G10Metadata {
  g10Status: G10Status;
  implicitFatRatio: number;
  implicitFatWarning?: string;
}

interface MealOptionFood {
  id: string;
  meal_option_id: string;
  food_id: string;
  quantity_grams: number;
  food: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string | null;
    category: string | null;
  };
}

interface MealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  meal_option_foods: MealOptionFood[];
}

interface Meal {
  id: string;
  name: string;
  meal_options: MealOption[];
}

interface FoodWithMeta extends MealOptionFood {
  mealName: string;
  mealId: string;
  optionId: string;
}

interface Adjustment {
  nutrient: "calories" | "protein" | "carbs" | "fat" | "structure";
  action: "increase" | "decrease" | "implicit_reduction" | "warning";
  delta: string;
}

interface RebalanceResult {
  status: "valid" | "valid_with_alert" | "error" | "structurally_invalid";
  objective: Objective;
  iterations: number;
  final_totals: MacroTargets;
  adjustments: Adjustment[];
  structural_issue?: {
    reason: string;
    fat_percent: number;
    calories_percent: number;
    action: string;
  };
  food_changes?: Array<{
    food_id: string;
    food_name: string;
    original_grams: number;
    new_grams: number;
  }>;
  // NOVO: Metadados G-10
  meta?: {
    g10Status: G10Status;
    implicitFatRatio: number;
    normalizationApplied: boolean;
  };
}

// ============================================
// CONFIGURAÇÕES DO ADMIN (carregadas do DB)
// ============================================

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

const DEFAULT_OPTIMIZER_SETTINGS: OptimizerSettings = {
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

// Variável global para configurações carregadas
let loadedSettings: OptimizerSettings | null = null;

async function loadOptimizerSettings(supabase: any): Promise<OptimizerSettings> {
  if (loadedSettings) return loadedSettings;

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'optimizer_macro_settings')
      .maybeSingle();

    if (error) {
      console.warn('Erro ao carregar configurações do otimizador:', error.message);
      return DEFAULT_OPTIMIZER_SETTINGS;
    }

    if (data?.value) {
      loadedSettings = { ...DEFAULT_OPTIMIZER_SETTINGS, ...(data.value as object) };
      console.log('Configurações do otimizador carregadas do admin:', JSON.stringify(loadedSettings));
      return loadedSettings;
    }
  } catch (e) {
    console.warn('Falha ao carregar configurações:', e);
  }

  return DEFAULT_OPTIMIZER_SETTINGS;
}

// ============================================
// REGRAS POR OBJETIVO (DINÂMICAS)
// ============================================

interface ObjectiveRules {
  calories: { min: number; max: number };
  protein: { min: number };
  carbs?: { min: number };
  fat?: { max: number };
}

function getObjectiveRules(objective: Objective, settings: OptimizerSettings): ObjectiveRules {
  // Usar configurações do admin para definir regras por objetivo
  switch (objective) {
    case "cut":
      return {
        calories: { min: 100 - settings.calories_tolerance, max: 100 },
        protein: { min: settings.protein_floor },
        fat: { max: settings.fat_ceiling },
      };
    case "bulk":
      return {
        calories: { min: 100 - settings.calories_tolerance, max: 100 + settings.calories_tolerance },
        protein: { min: Math.max(settings.protein_floor - 5, 85) }, // Bulk pode ter piso um pouco menor
        carbs: { min: settings.carbs_floor },
        fat: { max: settings.fat_ceiling + 10 }, // Bulk permite mais gordura
      };
    case "maintain":
    default:
      return {
        calories: { min: 100 - settings.calories_tolerance, max: 100 + settings.calories_tolerance },
        protein: { min: Math.max(settings.protein_floor - 10, 80) },
      };
  }
}

// ============================================
// LIMITES DE QUANTIDADE POR CATEGORIA
// ============================================

const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  proteinas: { min: 30, max: 350 },
  carboidratos: { min: 40, max: 400 },
  leguminosas: { min: 40, max: 200 },
  vegetais: { min: 30, max: 250 },
  frutas: { min: 30, max: 150 },
  laticinios: { min: 30, max: 300 },
  gorduras: { min: 5, max: 30 },
  oleaginosas: { min: 10, max: 40 },
  azeite: { min: 5, max: 20 },
  figo: { min: 20, max: 80 },
};

function getCategoryLimits(category: string | null): { min: number; max: number } {
  const cat = (category || "").toLowerCase();
  return CATEGORY_LIMITS[cat] || { min: 20, max: 400 };
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  return 100;
}

function getFoodContributionPer100g(food: MealOptionFood["food"]): MacroTargets {
  const servingGrams = parseServingGrams(food.serving_size);
  return {
    calories: (food.calories / servingGrams) * 100,
    protein: (food.protein / servingGrams) * 100,
    carbs: (food.carbs / servingGrams) * 100,
    fat: (food.fat / servingGrams) * 100,
  };
}

function calculateTotals(
  foods: FoodWithMeta[],
  quantities: Map<string, number>
): MacroTargets {
  let calories = 0, protein = 0, carbs = 0, fat = 0;

  for (const food of foods) {
    const grams = quantities.get(food.id) || food.quantity_grams;
    const servingGrams = parseServingGrams(food.food.serving_size);
    const ratio = grams / servingGrams;

    calories += food.food.calories * ratio;
    protein += food.food.protein * ratio;
    carbs += food.food.carbs * ratio;
    fat += food.food.fat * ratio;
  }

  return {
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

function calculatePercents(
  totals: MacroTargets,
  targets: MacroTargets
): { calories: number; protein: number; carbs: number; fat: number } {
  return {
    calories: targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 100,
    protein: targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 100,
    carbs: targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 100,
    fat: targets.fat > 0 ? (totals.fat / targets.fat) * 100 : 100,
  };
}

// ============================================
// VALIDAÇÃO DO PLANO (REGRAS HARD)
// ============================================

function validatePlan(
  totals: MacroTargets,
  targets: MacroTargets,
  objective: Objective,
  settings: OptimizerSettings
): { valid: boolean; errors: string[] } {
  const rules = getObjectiveRules(objective, settings);
  const percents = calculatePercents(totals, targets);
  const errors: string[] = [];

  // CALORIAS - regra HARD (fora = plano INVÁLIDO)
  if (percents.calories < rules.calories.min || percents.calories > rules.calories.max) {
    errors.push(
      `Calorias em ${percents.calories.toFixed(1)}% - fora do range [${rules.calories.min}%, ${rules.calories.max}%]`
    );
  }

  // PROTEÍNA - mínimo obrigatório
  if (percents.protein < rules.protein.min) {
    errors.push(
      `Proteína em ${percents.protein.toFixed(1)}% - abaixo do mínimo ${rules.protein.min}%`
    );
  }

  // CARBOIDRATOS - apenas para bulk
  if (rules.carbs && percents.carbs < rules.carbs.min) {
    errors.push(
      `Carboidratos em ${percents.carbs.toFixed(1)}% - abaixo do mínimo ${rules.carbs.min}%`
    );
  }

  // GORDURA - máximo
  if (rules.fat && percents.fat > rules.fat.max) {
    errors.push(
      `Gordura em ${percents.fat.toFixed(1)}% - acima do máximo ${rules.fat.max}%`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// PIPELINE DE CORREÇÃO (4 ETAPAS)
// ============================================

// ============================================
// REFINAMENTO FINAL (±1g precision)
// ============================================

function runFinalRefinement(
  foods: FoodWithMeta[],
  quantities: Map<string, number>,
  targets: MacroTargets,
  contributions: Map<string, MacroTargets>,
  maxIterations: number = 200
): { quantities: Map<string, number>; iterations: number; converged: boolean } {
  // ============================================
  // RANGE HARD: CONVERGÊNCIA MULTI-OBJETIVO
  // ============================================
  // Ajusta TODOS os macros simultaneamente usando gradiente descendente
  const PRECISION = {
    calories: 5,   // ±5 kcal
    protein: 1,    // ±1g
    carbs: 1,      // ±1g
    fat: 1,        // ±1g
  };

  // Pesos para priorização (proteína é mais importante)
  const WEIGHTS = {
    calories: 1.0,
    protein: 3.0,  // Proteína tem peso 3x
    carbs: 1.0,
    fat: 1.0,
  };

  let iterations = 0;
  let lastError = Infinity;
  let stuckCounter = 0;

  for (let i = 0; i < maxIterations; i++) {
    iterations = i + 1;
    const totals = calculateTotals(foods, quantities);

    const errors = {
      calories: totals.calories - targets.calories,
      protein: totals.protein - targets.protein,
      carbs: totals.carbs - targets.carbs,
      fat: totals.fat - targets.fat,
    };

    // Verificar convergência HARD
    const converged = 
      Math.abs(errors.calories) <= PRECISION.calories &&
      Math.abs(errors.protein) <= PRECISION.protein &&
      Math.abs(errors.carbs) <= PRECISION.carbs &&
      Math.abs(errors.fat) <= PRECISION.fat;

    if (converged) {
      console.log(`[HARD] Convergência completa em ${iterations} iterações`);
      console.log(`[HARD] Finais: cal=${totals.calories}, prot=${totals.protein}g, carb=${totals.carbs}g, fat=${totals.fat}g`);
      return { quantities, iterations, converged: true };
    }

    // Calcular erro total ponderado
    const totalError = 
      Math.abs(errors.calories) / targets.calories * WEIGHTS.calories +
      Math.abs(errors.protein) / targets.protein * WEIGHTS.protein +
      Math.abs(errors.carbs) / targets.carbs * WEIGHTS.carbs +
      Math.abs(errors.fat) / targets.fat * WEIGHTS.fat;

    // Detectar se estamos presos
    if (Math.abs(totalError - lastError) < 0.0001) {
      stuckCounter++;
      if (stuckCounter > 10) {
        console.log(`[HARD] Algoritmo preso após ${iterations} iterações`);
        break;
      }
    } else {
      stuckCounter = 0;
    }
    lastError = totalError;

    // ============================================
    // ENCONTRAR MELHOR ALIMENTO PARA AJUSTAR
    // ============================================
    // Usar score multi-objetivo: qual alimento reduz mais o erro total?
    
    let bestFood: FoodWithMeta | null = null;
    let bestDelta = 0;
    let bestScoreImprovement = 0;

    const proteinDeficit = errors.protein < -PRECISION.protein;
    const proteinIsProtected = errors.protein <= 2;

    for (const food of foods) {
      const contrib = contributions.get(food.id);
      if (!contrib) continue;

      const currentGrams = quantities.get(food.id) || food.quantity_grams;
      const limits = getCategoryLimits(food.food.category);
      const isProteinFood = contrib.protein >= 15;

      // Testar +1g a +5g e -1g a -5g
      for (const delta of [-5, -3, -1, 1, 3, 5]) {
        const newGrams = currentGrams + delta;
        
        // Verificar limites
        if (newGrams < limits.min || newGrams > limits.max) continue;

        // PROTEÇÃO: não reduzir alimentos proteicos se proteína está protegida
        if (delta < 0 && isProteinFood && proteinIsProtected) continue;
        if (delta < 0 && isProteinFood && proteinDeficit) continue;

        // Calcular novos macros com este delta
        const newErrors = {
          calories: errors.calories + (delta / 100) * contrib.calories,
          protein: errors.protein + (delta / 100) * contrib.protein,
          carbs: errors.carbs + (delta / 100) * contrib.carbs,
          fat: errors.fat + (delta / 100) * contrib.fat,
        };

        // Calcular novo erro total
        const newTotalError = 
          Math.abs(newErrors.calories) / targets.calories * WEIGHTS.calories +
          Math.abs(newErrors.protein) / targets.protein * WEIGHTS.protein +
          Math.abs(newErrors.carbs) / targets.carbs * WEIGHTS.carbs +
          Math.abs(newErrors.fat) / targets.fat * WEIGHTS.fat;

        const improvement = totalError - newTotalError;

        // Bônus para ajustes que melhoram proteína quando em déficit
        let adjustedImprovement = improvement;
        if (proteinDeficit && delta > 0 && contrib.protein > 10) {
          adjustedImprovement *= 1.5; // 50% bônus
        }

        if (adjustedImprovement > bestScoreImprovement) {
          bestScoreImprovement = adjustedImprovement;
          bestFood = food;
          bestDelta = delta;
        }
      }
    }

    if (!bestFood || bestScoreImprovement <= 0) {
      console.log(`[HARD] Sem melhoria possível após ${iterations} iterações`);
      break;
    }

    // Aplicar melhor ajuste
    const currentGrams = quantities.get(bestFood.id) || bestFood.quantity_grams;
    quantities.set(bestFood.id, Math.round(currentGrams + bestDelta));
  }

  // Log final
  const finalTotals = calculateTotals(foods, quantities);
  console.log(`[HARD] Finais após ${iterations} iterações: cal=${finalTotals.calories}, prot=${finalTotals.protein}g, carb=${finalTotals.carbs}g, fat=${finalTotals.fat}g`);
  console.log(`[HARD] Metas: cal=${targets.calories}, prot=${targets.protein}g, carb=${targets.carbs}g, fat=${targets.fat}g`);
  
  return { quantities, iterations, converged: false };
}

interface CorrectionPipelineResult {
  quantities: Map<string, number>;
  adjustments: Adjustment[];
  iterations: number;
  converged: boolean;
  normalizationApplied: boolean;
  structurallyInvalid?: {
    reason: string;
    fat_percent: number;
    calories_percent: number;
    action: string;
  };
}

function runCorrectionPipeline(
  foods: FoodWithMeta[],
  quantities: Map<string, number>,
  targets: MacroTargets,
  objective: Objective,
  settings: OptimizerSettings,
  g10Metadata: G10Metadata,
  maxCycles: number = 3
): CorrectionPipelineResult {
  const adjustments: Adjustment[] = [];
  let iterations = 0;
  let normalizationApplied = false;

  // Pré-calcular contribuições por 100g
  const contributions = new Map<string, MacroTargets>();
  for (const food of foods) {
    contributions.set(food.id, getFoodContributionPer100g(food.food));
  }

  // Categorizar alimentos
  const proteinFoods = foods.filter(f => {
    const c = contributions.get(f.id)!;
    return c.protein >= 15;
  }).sort((a, b) => {
    const cA = contributions.get(a.id)!;
    const cB = contributions.get(b.id)!;
    // Ratio proteína/gordura (maior = melhor para cortar)
    const ratioA = cA.fat > 0 ? cA.protein / cA.fat : cA.protein * 10;
    const ratioB = cB.fat > 0 ? cB.protein / cB.fat : cB.protein * 10;
    return ratioB - ratioA;
  });

  const carbFoods = foods.filter(f => {
    const c = contributions.get(f.id)!;
    return c.carbs >= 20;
  }).sort((a, b) => {
    const cA = contributions.get(a.id)!;
    const cB = contributions.get(b.id)!;
    return cB.carbs - cA.carbs;
  });

  const fatFoods = foods.filter(f => {
    const c = contributions.get(f.id)!;
    const cat = (f.food.category || "").toLowerCase();
    return c.fat >= 10 || cat === "gorduras" || cat === "oleaginosas";
  }).sort((a, b) => {
    const cA = contributions.get(a.id)!;
    const cB = contributions.get(b.id)!;
    return cB.fat - cA.fat;
  });

  const rules = getObjectiveRules(objective, settings);

  for (let cycle = 0; cycle < maxCycles; cycle++) {
    iterations = cycle + 1;
    const before = calculateTotals(foods, quantities);
    const validation = validatePlan(before, targets, objective, settings);

    if (validation.valid) {
      console.log(`Plano válido após ${iterations} ciclo(s)`);
      return { quantities, adjustments, iterations, converged: true, normalizationApplied };
    }

    console.log(`Ciclo ${iterations}: ${validation.errors.join("; ")}`);

    const percents = calculatePercents(before, targets);

    // ==========================================
    // ETAPA 1: CALORIAS
    // ==========================================
    const caloriesDiff = before.calories - targets.calories;
    const caloriesPercent = percents.calories;

    if (caloriesPercent < rules.calories.min || caloriesPercent > rules.calories.max) {
      const needDecrease = caloriesPercent > rules.calories.max;
      const targetCaloriesPercent = needDecrease ? rules.calories.max : rules.calories.min;
      const targetCalories = targets.calories * (targetCaloriesPercent / 100);
      const caloriesToAdjust = before.calories - targetCalories;

      if (Math.abs(caloriesToAdjust) > 10) {
        // ============================================
        // REGRA CRÍTICA: NUNCA REDUZIR PROTEÍNA PARA CORTAR CALORIAS
        // ============================================
        // Prioridade para REDUZIR: 1. Gordura, 2. Carboidrato (NUNCA proteína)
        // Prioridade para AUMENTAR: 1. Carboidrato, 2. Proteína
        const foodsToAdjust = needDecrease
          ? [...fatFoods, ...carbFoods] // NUNCA inclui proteinFoods na redução
          : [...carbFoods, ...proteinFoods];

        let remainingCals = Math.abs(caloriesToAdjust);

        for (const food of foodsToAdjust) {
          if (remainingCals <= 10) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.calories <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);
          
          // ============================================
          // PROTEÇÃO DE PROTEÍNA - SE PRECISAR DIMINUIR CALORIAS
          // ============================================
          if (needDecrease && contrib.protein >= 15) {
            console.log(`[CALORIAS] Pulando ${food.food.name} (alimento proteico protegido)`);
            continue; // NUNCA reduzir alimento proteico para cortar calorias
          }

          // Calcular gramas necessários
          const gramsForCals = (remainingCals * 100) / contrib.calories;
          let gramsToChange = Math.min(gramsForCals, needDecrease ? currentGrams - limits.min : limits.max - currentGrams);

          if (gramsToChange < 5) continue;

          const newGrams = needDecrease
            ? Math.max(limits.min, currentGrams - gramsToChange)
            : Math.min(limits.max, currentGrams + gramsToChange);

          const actualChange = Math.abs(newGrams - currentGrams);
          const calsChanged = (actualChange / 100) * contrib.calories;

          quantities.set(food.id, Math.round(newGrams));
          remainingCals -= calsChanged;
          console.log(`[CALORIAS] ${needDecrease ? '-' : '+'}${Math.round(actualChange)}g ${food.food.name} (${needDecrease ? '-' : '+'}${Math.round(calsChanged)}kcal)`);
        }

        adjustments.push({
          nutrient: "calories",
          action: needDecrease ? "decrease" : "increase",
          delta: `${needDecrease ? "-" : "+"}${Math.round(Math.abs(caloriesToAdjust))}kcal`,
        });
      }
    }

    // Recalcular após ajuste de calorias
    const afterCalories = calculateTotals(foods, quantities);
    const afterCaloriesPercents = calculatePercents(afterCalories, targets);

    // ==========================================
    // ETAPA 2: PROTEÍNA
    // ==========================================
    if (afterCaloriesPercents.protein < rules.protein.min) {
      const proteinTarget = (targets.protein * rules.protein.min / 100);
      let remainingProtein = proteinTarget - afterCalories.protein;
      const initialProteinNeeded = remainingProtein;

      if (remainingProtein > 1) {
        for (const food of proteinFoods) {
          if (remainingProtein <= 1) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.protein <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          const gramsNeeded = (remainingProtein * 100) / contrib.protein;
          const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams);

          if (gramsToAdd < 5) continue;

          // Para CUT: não adicionar calorias
          if (objective === "cut") {
            const calsToAdd = (gramsToAdd / 100) * contrib.calories;
            if (calsToAdd > 50) continue; // Limitar impacto calórico
          }

          const newGrams = Math.min(limits.max, currentGrams + gramsToAdd);
          const actualGramsAdded = newGrams - currentGrams;
          quantities.set(food.id, Math.round(newGrams));

          const proteinAdded = (actualGramsAdded / 100) * contrib.protein;
          remainingProtein -= proteinAdded;
          console.log(`Etapa 2: +${Math.round(actualGramsAdded)}g ${food.food.name} (+${proteinAdded.toFixed(1)}g prot)`);
        }

        adjustments.push({
          nutrient: "protein",
          action: "increase",
          delta: `+${Math.round(initialProteinNeeded)}g`,
        });
      }
    }

    // Recalcular após proteína
    const afterProtein = calculateTotals(foods, quantities);
    const afterProteinPercents = calculatePercents(afterProtein, targets);

    // ==========================================
    // ETAPA 3: CARBOIDRATOS (apenas bulk)
    // ==========================================
    if (rules.carbs && afterProteinPercents.carbs < rules.carbs.min) {
      const carbsNeeded = (targets.carbs * rules.carbs.min / 100) - afterProtein.carbs;

      if (carbsNeeded > 5) {
        for (const food of carbFoods) {
          if (carbsNeeded <= 0) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.carbs <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          const gramsNeeded = (carbsNeeded * 100) / contrib.carbs;
          const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams);

          if (gramsToAdd < 10) continue;

          const newGrams = Math.min(limits.max, currentGrams + gramsToAdd);
          quantities.set(food.id, Math.round(newGrams));
        }

        adjustments.push({
          nutrient: "carbs",
          action: "increase",
          delta: `+${Math.round(carbsNeeded)}g`,
        });
      }
    }

    // Recalcular após carbs
    const afterCarbs = calculateTotals(foods, quantities);
    const afterCarbsPercents = calculatePercents(afterCarbs, targets);

    // ==========================================
    // ETAPA 4: GORDURA (reduzir se acima do máx)
    // ==========================================
    // REGRA CRÍTICA: Apenas reduzir gorduras PURAS (azeite, castanhas, óleos)
    // NUNCA reduzir alimentos que são fontes de proteína
    if (rules.fat && afterCarbsPercents.fat > rules.fat.max) {
      const fatTarget = (targets.fat * rules.fat.max / 100);
      let remainingFatExcess = afterCarbs.fat - fatTarget;
      const initialFatExcess = remainingFatExcess;

      if (remainingFatExcess > 1) {
        // Filtrar apenas gorduras puras (não fontes de proteína)
        const pureFatFoods = fatFoods.filter(f => {
          const contrib = contributions.get(f.id)!;
          // Gordura pura = baixa proteína (<10g/100g) e alta gordura (>20g/100g)
          const isPureFat = contrib.protein < 10 && contrib.fat > 20;
          const cat = (f.food.category || "").toLowerCase();
          const isFatCategory = cat.includes("gordura") || cat.includes("oleaginosa") || cat.includes("azeite") || cat.includes("óleo");
          return isPureFat || isFatCategory;
        });

        for (const food of pureFatFoods) {
          if (remainingFatExcess <= 1) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.fat <= 0) continue;
          
          // ============================================
          // PROTEÇÃO DE PROTEÍNA - REGRA CRÍTICA
          // ============================================
          // NUNCA reduzir alimentos com proteína significativa
          if (contrib.protein >= 10) {
            console.log(`[GORDURA] Protegendo ${food.food.name} (${contrib.protein.toFixed(1)}g prot/100g)`);
            continue;
          }

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);

          const gramsNeeded = (remainingFatExcess * 100) / contrib.fat;
          const gramsToRemove = Math.min(gramsNeeded, currentGrams - limits.min);

          if (gramsToRemove < 2) continue;

          // Nunca zerar gordura
          const newGrams = Math.max(limits.min, currentGrams - gramsToRemove);
          const actualGramsRemoved = currentGrams - newGrams;
          quantities.set(food.id, Math.round(newGrams));

          const fatRemoved = (actualGramsRemoved / 100) * contrib.fat;
          remainingFatExcess -= fatRemoved;
          console.log(`Etapa 4: -${Math.round(actualGramsRemoved)}g ${food.food.name} (-${fatRemoved.toFixed(1)}g fat) [gordura pura]`);
        }

        if (initialFatExcess > 1) {
          adjustments.push({
            nutrient: "fat",
            action: "decrease",
            delta: `-${Math.round(initialFatExcess - remainingFatExcess)}g`,
          });
        }
      }
    }

    // ==========================================
    // ETAPA 4.5: NORMALIZAÇÃO DE GORDURA IMPLÍCITA
    // ==========================================
    // Corrige excesso de gordura proveniente de fontes mistas (proteína + gordura)
    // ANTES de qualquer tentativa de adicionar gordura (Etapa 5).
    // Esta etapa NUNCA adiciona gordura - apenas reduz ou substitui.
    //
    // REGRA G-10 PROGRESSIVA:
    // - Se g10Status === "ALLOW_REBALANCE", esta etapa é OBRIGATÓRIA
    // - Deve normalizar antes de qualquer validação
    
    const preNormalizationTotals = calculateTotals(foods, quantities);
    const preNormalizationPercents = calculatePercents(preNormalizationTotals, targets);
    
    // Condição para executar: 
    // 1. g10Status === "ALLOW_REBALANCE" (OBRIGATÓRIO)
    // 2. OU condições antigas (fat > 110%, calories > 105%, ou gordura moderadamente alta)
    const isG10AllowRebalance = g10Metadata.g10Status === "ALLOW_REBALANCE";
    const shouldRunNormalization = 
      isG10AllowRebalance ||
      preNormalizationPercents.fat > 110 || 
      preNormalizationPercents.calories > 105 ||
      (preNormalizationPercents.protein >= 95 && 
       preNormalizationPercents.carbs >= 90 && 
       preNormalizationPercents.carbs <= 110 &&
       preNormalizationPercents.fat > 100);
    
    if (shouldRunNormalization) {
      normalizationApplied = true;
      console.log(`[ETAPA 4.5] Iniciando normalização de gordura implícita`);
      console.log(`[ETAPA 4.5] G-10 Status: ${g10Metadata.g10Status}, Ratio: ${g10Metadata.implicitFatRatio}`);
      console.log(`[ETAPA 4.5] Estado atual: Gordura ${preNormalizationPercents.fat.toFixed(1)}%, Calorias ${preNormalizationPercents.calories.toFixed(1)}%`);
      console.log(`[ETAPA 4.5] Iniciando normalização de gordura implícita`);
      console.log(`[ETAPA 4.5] Estado atual: Gordura ${preNormalizationPercents.fat.toFixed(1)}%, Calorias ${preNormalizationPercents.calories.toFixed(1)}%`);
      
      // Identificar fontes mistas de alta densidade lipídica
      // Critério: ≥8g gordura/100g E ≥15g proteína/100g
      const mixedFatSources = foods.filter(f => {
        const contrib = contributions.get(f.id)!;
        return contrib.fat >= 8 && contrib.protein >= 15;
      });
      
      console.log(`[ETAPA 4.5] Fontes mistas identificadas: ${mixedFatSources.length}`);
      
      if (mixedFatSources.length > 0) {
        // Ordenar por densidade de gordura (maior primeiro)
        mixedFatSources.sort((a, b) => {
          const contribA = contributions.get(a.id)!;
          const contribB = contributions.get(b.id)!;
          return contribB.fat - contribA.fat;
        });
        
        // Calcular excesso de gordura a corrigir
        const fatExcessGrams = preNormalizationTotals.fat - targets.fat;
        let remainingExcess = fatExcessGrams;
        
        // ESTRATÉGIA A: Redução de porção (preservando proteína mínima)
        for (const food of mixedFatSources) {
          if (remainingExcess <= 2) break;
          
          const contrib = contributions.get(food.id)!;
          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);
          
          // Calcular quanto podemos reduzir mantendo proteína
          // Usar limite mínimo ou 60% da quantidade atual (o que for maior)
          const minToKeep = Math.max(limits.min, currentGrams * 0.6);
          const maxReduction = currentGrams - minToKeep;
          
          if (maxReduction < 5) continue;
          
          // Calcular redução necessária para remover gordura
          const fatPerGram = contrib.fat / 100;
          const proteinPerGram = contrib.protein / 100;
          const gramsToRemoveForFat = remainingExcess / fatPerGram;
          const actualReduction = Math.min(gramsToRemoveForFat, maxReduction);
          
          if (actualReduction < 5) continue;
          
          // Verificar se proteína total não cairá abaixo de 95%
          const proteinLost = actualReduction * proteinPerGram;
          const newProteinTotal = preNormalizationTotals.protein - proteinLost;
          const newProteinPercent = (newProteinTotal / targets.protein) * 100;
          
          if (newProteinPercent < 95) {
            console.log(`[ETAPA 4.5] Pulando ${food.food.name} - reduziria proteína para ${newProteinPercent.toFixed(1)}%`);
            continue;
          }
          
          const newGrams = Math.round(currentGrams - actualReduction);
          quantities.set(food.id, newGrams);
          
          const fatRemoved = actualReduction * fatPerGram;
          remainingExcess -= fatRemoved;
          
          console.log(`[ETAPA 4.5] Estratégia A: -${Math.round(actualReduction)}g ${food.food.name} (-${fatRemoved.toFixed(1)}g gordura, -${(actualReduction * proteinPerGram).toFixed(1)}g proteína)`);
          
          adjustments.push({
            nutrient: "fat",
            action: "implicit_reduction",
            delta: `-${Math.round(actualReduction)}g ${food.food.name}`,
          });
        }
        
        // Recalcular após ajustes
        const afterNormalization = calculateTotals(foods, quantities);
        const afterNormPercents = calculatePercents(afterNormalization, targets);
        
        console.log(`[ETAPA 4.5] Resultado: Gordura ${afterNormPercents.fat.toFixed(1)}%, Calorias ${afterNormPercents.calories.toFixed(1)}%`);
        
        // VALIDAÇÃO CRÍTICA: Se ainda excede limites, INTERROMPER FLUXO
        if (afterNormPercents.fat > 110 || afterNormPercents.calories > 105) {
          console.error(`[ETAPA 4.5] ❌ STRUCTURALLY_INVALID - Fluxo interrompido`);
          console.error(`[ETAPA 4.5] Gordura: ${afterNormPercents.fat.toFixed(1)}% (limite: 110%)`);
          console.error(`[ETAPA 4.5] Calorias: ${afterNormPercents.calories.toFixed(1)}% (limite: 105%)`);
          console.error(`[ETAPA 4.5] ACTION: Regenerar plano com fontes proteicas mais magras`);
          
          // RETORNAR IMEDIATAMENTE - NÃO VALIDAR, NÃO EXIBIR COMO GERADO
          return {
            quantities,
            adjustments,
            iterations,
            converged: false,
            normalizationApplied: true,
            structurallyInvalid: {
              reason: "Excesso de gordura proveniente de fontes mistas (proteína + gordura)",
              fat_percent: Math.round(afterNormPercents.fat * 10) / 10,
              calories_percent: Math.round(afterNormPercents.calories * 10) / 10,
              action: "Regenerar plano com fontes proteicas mais magras (ex: peito de frango, tilápia, clara de ovo)",
            },
          };
        }
      } else {
        console.log(`[ETAPA 4.5] Nenhuma fonte mista encontrada - prosseguindo`);
      }
    } else {
      console.log(`[ETAPA 4.5] Condições não atingidas - pulando normalização`);
    }

    // ==========================================
    // ETAPA 5: ADIÇÃO DE GORDURA (CONDICIONAL)
    // ==========================================
    // Gordura SÓ pode ser adicionada se TODAS as condições forem atendidas:
    // - g10Status NÃO é "ALLOW_REBALANCE" (bloqueado quando há excesso moderado)
    // - Proteína ≥ 95% da meta
    // - Carboidratos entre 90% e 110% da meta
    // - Calorias totais <= 95% da meta
    // - Não há mais ajuste possível em proteína ou carbs
    //
    // REGRA G-10: Quando g10Status === "ALLOW_REBALANCE", esta etapa é BLOQUEADA
    // O plano não pode ter gordura adicionada até que a normalização resolva o excesso.
    
    const afterFatReduction = calculateTotals(foods, quantities);
    const afterFatPercents = calculatePercents(afterFatReduction, targets);

    // BLOQUEIO G-10: Se status é ALLOW_REBALANCE, não adicionar gordura
    if (g10Metadata.g10Status === "ALLOW_REBALANCE") {
      console.log(`[ETAPA 5] ⛔ BLOQUEADA - g10Status é ALLOW_REBALANCE`);
      console.log(`[ETAPA 5] Gordura atual: ${afterFatPercents.fat.toFixed(1)}%, Calorias: ${afterFatPercents.calories.toFixed(1)}%`);
      // Pular diretamente para próxima iteração ou saída
    } else {
      const proteinOk = afterFatPercents.protein >= 95;
      const carbsOk = afterFatPercents.carbs >= 90 && afterFatPercents.carbs <= 110;
      const caloriesLow = afterFatPercents.calories <= 95;

      if (proteinOk && carbsOk && caloriesLow) {
      const caloricDeficit = targets.calories - afterFatReduction.calories;
      const fatNeeded = Math.round(caloricDeficit / 9); // 9 kcal por grama de gordura
      
      console.log(`[ETAPA 5] Condições atendidas - déficit calórico: ${caloricDeficit.toFixed(0)}kcal, gordura necessária: ${fatNeeded}g`);
      
      // REGRA: Se gordura necessária > 30% das calorias totais, plano inválido
      const fatCaloriesPercent = (fatNeeded * 9) / targets.calories * 100;
      if (fatCaloriesPercent > 30) {
        console.warn(`[ETAPA 5] Gordura necessária (${fatCaloriesPercent.toFixed(1)}%) > 30% - plano deve ser regenerado`);
        // Não adicionar gordura excessiva - deixar para o refinamento final
      } else if (fatNeeded > 3) {
        // Encontrar fonte de gordura pura para adicionar
        // Prioridade: alimentos já no plano da categoria gorduras/oleaginosas
        const pureFatFoods = fatFoods.filter(f => {
          const contrib = contributions.get(f.id)!;
          // Gordura pura = alta gordura (>30g/100g) e baixa proteína (<5g/100g)
          return contrib.fat > 30 && contrib.protein < 5;
        });

        let remainingFatToAdd = fatNeeded;

        for (const food of pureFatFoods) {
          if (remainingFatToAdd <= 1) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.fat <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          const limits = getCategoryLimits(food.food.category);
          
          // Limitar adição (máx +15g por alimento para manter porções realistas)
          const gramsNeeded = (remainingFatToAdd * 100) / contrib.fat;
          const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams, 15);

          if (gramsToAdd < 2) continue;

          const newGrams = Math.min(limits.max, currentGrams + gramsToAdd);
          const actualGramsAdded = newGrams - currentGrams;
          quantities.set(food.id, Math.round(newGrams));

          const fatAdded = (actualGramsAdded / 100) * contrib.fat;
          remainingFatToAdd -= fatAdded;
          console.log(`[ETAPA 5] +${Math.round(actualGramsAdded)}g ${food.food.name} (+${fatAdded.toFixed(1)}g gordura)`);
        }

        if (fatNeeded - remainingFatToAdd > 1) {
          adjustments.push({
            nutrient: "fat",
            action: "increase",
            delta: `+${Math.round(fatNeeded - remainingFatToAdd)}g`,
          });
        }
      }
      } else {
        if (!proteinOk) {
          console.log(`[ETAPA 5] Proteína insuficiente (${afterFatPercents.protein.toFixed(1)}% < 95%) - não adicionar gordura`);
        }
        if (!carbsOk) {
          console.log(`[ETAPA 5] Carboidratos fora do range (${afterFatPercents.carbs.toFixed(1)}%) - não adicionar gordura`);
        }
        if (!caloriesLow) {
          console.log(`[ETAPA 5] Calorias não estão baixas (${afterFatPercents.calories.toFixed(1)}%) - não adicionar gordura`);
        }
      }
    } // Fim do else (g10Status !== "ALLOW_REBALANCE")
  }

  return { quantities, adjustments, iterations, converged: false, normalizationApplied };
}

// ============================================
// MAPEAR GOAL DO USUÁRIO PARA OBJECTIVE
// ============================================

function mapGoalToObjective(goal: string | undefined): Objective {
  if (!goal) return "maintain";
  const g = goal.toLowerCase();
  if (g.includes("lose") || g.includes("cut") || g.includes("emag")) return "cut";
  if (g.includes("gain") || g.includes("bulk") || g.includes("massa") || g.includes("muscle")) return "bulk";
  return "maintain";
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId, targets, goal, g10_status, implicit_fat_ratio, implicit_fat_warning } = await req.json();

    if (!planId || !targets) {
      return new Response(
        JSON.stringify({ error: "planId and targets are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Carregar configurações do admin
    const settings = await loadOptimizerSettings(supabase);

    // Mapear objetivo
    const objective = mapGoalToObjective(goal);
    
    // Construir metadados G-10 (default para PASS se não fornecido)
    const g10Metadata: G10Metadata = {
      g10Status: (g10_status as G10Status) || "PASS",
      implicitFatRatio: implicit_fat_ratio || 0,
      implicitFatWarning: implicit_fat_warning,
    };
    
    console.log(`Objetivo: ${objective} (goal recebido: ${goal})`);
    console.log(`G-10 Metadata: status=${g10Metadata.g10Status}, ratio=${g10Metadata.implicitFatRatio}`);
    console.log(`Usando settings: prot_floor=${settings.protein_floor}%, cal_tol=${settings.calories_tolerance}%`);

    // Buscar refeições
    const { data: meals, error: mealsError } = await supabase
      .from("meals")
      .select(`
        id,
        name,
        meal_options (
          id,
          meal_id,
          option_number,
          name,
          meal_option_foods (
            id,
            meal_option_id,
            food_id,
            quantity_grams,
            food:foods (
              id,
              name,
              calories,
              protein,
              carbs,
              fat,
              serving_size,
              category
            )
          )
        )
      `)
      .eq("diet_plan_id", planId)
      .order("sort_order");

    if (mealsError) throw mealsError;

    const typedMeals = meals as unknown as Meal[];

    // ============================================
    // PROCESSAR TODAS AS OPÇÕES (1, 2, 3)
    // ============================================
    
    interface OptionResult {
      optionNumber: number;
      foods: FoodWithMeta[];
      initialQuantities: Map<string, number>;
      finalQuantities: Map<string, number>;
      finalTotals: MacroTargets;
      adjustments: Adjustment[];
      iterations: number;
      converged: boolean;
      normalizationApplied: boolean;
      foodChanges: Array<{
        food_id: string;
        food_name: string;
        original_grams: number;
        new_grams: number;
        mealOptionFoodId: string;
        mealId: string;
        mealOptionId: string;
        mealName: string;
      }>;
    }

    const optionResults: OptionResult[] = [];
    
    // Processar opções 1, 2 e 3
    for (const optionNumber of [1, 2, 3]) {
      const optionFoods: FoodWithMeta[] = [];
      const optionInitialQuantities = new Map<string, number>();

      for (const meal of typedMeals) {
        const option = meal.meal_options.find((o) => o.option_number === optionNumber);
        if (option) {
          for (const food of option.meal_option_foods) {
            optionFoods.push({
              ...food,
              mealName: meal.name,
              mealId: meal.id,
              optionId: option.id,
            });
            optionInitialQuantities.set(food.id, food.quantity_grams);
          }
        }
      }

      // Pular se não há alimentos nesta opção
      if (optionFoods.length === 0) {
        console.log(`Opção ${optionNumber}: sem alimentos, pulando`);
        continue;
      }

      console.log(`\n=== Processando Opção ${optionNumber} (${optionFoods.length} alimentos) ===`);

      // Calcular totais atuais desta opção
      const optionCurrentTotals = calculateTotals(optionFoods, optionInitialQuantities);
      console.log(`Opção ${optionNumber} - Totais atuais: ${JSON.stringify(optionCurrentTotals)}`);

      // Validar plano atual
      const optionValidation = validatePlan(optionCurrentTotals, targets, objective, settings);

      if (optionValidation.valid) {
        console.log(`Opção ${optionNumber} já está válida`);
        optionResults.push({
          optionNumber,
          foods: optionFoods,
          initialQuantities: optionInitialQuantities,
          finalQuantities: optionInitialQuantities,
          finalTotals: optionCurrentTotals,
          adjustments: [],
          iterations: 0,
          converged: true,
          normalizationApplied: false,
          foodChanges: [],
        });
        continue;
      }

      // Criar cópia do mapa inicial
      const workingQuantities = new Map(optionInitialQuantities);

      // FASE 1: Pipeline de correção macro (4 etapas + 4.5)
      const pipelineResult = runCorrectionPipeline(
        optionFoods, 
        workingQuantities, 
        targets, 
        objective,
        settings,
        g10Metadata,
        3
      );

      // VERIFICAR INVALIDAÇÃO ESTRUTURAL DA ETAPA 4.5
      if (pipelineResult.structurallyInvalid) {
        console.error(`Opção ${optionNumber}: STRUCTURALLY_INVALID detectado`);
        
        // Calcular totais finais para retorno
        const invalidTotals = calculateTotals(optionFoods, pipelineResult.quantities);
        
        return new Response(
          JSON.stringify({
            status: "structurally_invalid",
            objective,
            iterations: pipelineResult.iterations,
            final_totals: {
              calories: Math.round(invalidTotals.calories),
              protein: Math.round(invalidTotals.protein),
              carbs: Math.round(invalidTotals.carbs),
              fat: Math.round(invalidTotals.fat),
            },
            adjustments: pipelineResult.adjustments,
            structural_issue: pipelineResult.structurallyInvalid,
            food_changes: [],
          }),
          {
            status: 200, // 200 para que o frontend possa processar a resposta
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // FASE 2: Refinamento final para precisão ±1g
      // Pré-calcular contribuições
      const contributions = new Map<string, MacroTargets>();
      for (const food of optionFoods) {
        contributions.set(food.id, getFoodContributionPer100g(food.food));
      }

      // FASE 2: Refinamento final para precisão hard (±1g, ±5kcal)
      const refinementResult = runFinalRefinement(
        optionFoods,
        pipelineResult.quantities,
        targets,
        contributions,
        150 // Mais iterações para garantir range hard
      );

      // Calcular totais finais
      const optionFinalTotals = calculateTotals(optionFoods, refinementResult.quantities);
      const totalIterations = pipelineResult.iterations + refinementResult.iterations;
      
      console.log(`Opção ${optionNumber} - Totais finais: ${JSON.stringify(optionFinalTotals)}`);
      console.log(`Opção ${optionNumber} - Iterações: ${totalIterations} (pipeline: ${pipelineResult.iterations}, refinamento: ${refinementResult.iterations})`);

      // Montar mudanças de alimentos
      const optionFoodChanges: OptionResult['foodChanges'] = [];

      for (const food of optionFoods) {
        const original = optionInitialQuantities.get(food.id) || food.quantity_grams;
        const final = refinementResult.quantities.get(food.id) || food.quantity_grams;
        const diff = Math.abs(final - original);

        if (diff >= 1) {
          console.log(`  ${food.food.name}: ${original}g → ${final}g (diff: ${diff})`);
        }

        if (diff >= 1) { // Mudança: reportar todas as diferenças >= 1g
          optionFoodChanges.push({
            food_id: food.food_id,
            food_name: food.food.name,
            original_grams: original,
            new_grams: Math.round(final),
            mealOptionFoodId: food.id,
            mealId: food.mealId,
            mealOptionId: food.optionId,
            mealName: food.mealName,
          });
        }
      }

      optionResults.push({
        optionNumber,
        foods: optionFoods,
        initialQuantities: optionInitialQuantities,
        finalQuantities: refinementResult.quantities,
        finalTotals: optionFinalTotals,
        adjustments: pipelineResult.adjustments,
        iterations: totalIterations,
        converged: refinementResult.converged,
        normalizationApplied: pipelineResult.normalizationApplied,
        foodChanges: optionFoodChanges,
      });
    }

    // Se nenhuma opção foi processada
    if (optionResults.length === 0) {
      throw new Error("Nenhuma opção de refeição encontrada no plano");
    }

    // Usar opção 1 como referência principal para compatibilidade
    const primaryResult = optionResults.find(r => r.optionNumber === 1) || optionResults[0];
    
    // Verificar convergência de todas as opções
    const allConverged = optionResults.every(r => r.converged);
    const anyConverged = optionResults.some(r => r.converged);

    // Determinar status baseado em todas as opções
    const primaryValidation = validatePlan(primaryResult.finalTotals, targets, objective, settings);
    let status: "valid" | "valid_with_alert" | "error";
    if (primaryValidation.valid && allConverged) {
      status = "valid";
    } else if (anyConverged) {
      status = "valid_with_alert";
    } else {
      status = "error";
    }

    // Calcular totais iniciais para compatibilidade
    const currentTotals = calculateTotals(primaryResult.foods, primaryResult.initialQuantities);

    // Combinar todas as mudanças de todas as opções
    const allFoodChanges = optionResults.flatMap(r => r.foodChanges);
    const totalIterations = Math.max(...optionResults.map(r => r.iterations));

    // Verificar se normalization foi aplicada em alguma opção
    const anyNormalizationApplied = optionResults.some(r => r.normalizationApplied);

    const result: RebalanceResult = {
      status,
      objective,
      iterations: totalIterations,
      final_totals: primaryResult.finalTotals,
      adjustments: primaryResult.adjustments,
      food_changes: allFoodChanges.map(fc => ({
        food_id: fc.food_id,
        food_name: fc.food_name,
        original_grams: fc.original_grams,
        new_grams: fc.new_grams,
      })),
      // NOVO: Metadados G-10
      meta: {
        g10Status: g10Metadata.g10Status,
        implicitFatRatio: g10Metadata.implicitFatRatio,
        normalizationApplied: anyNormalizationApplied,
      },
    };

    // Log de resumo
    console.log(`\n=== RESUMO ===`);
    console.log(`G-10 Status: ${g10Metadata.g10Status}, Normalization Applied: ${anyNormalizationApplied}`);
    for (const opt of optionResults) {
      const calDiff = Math.abs(opt.finalTotals.calories - targets.calories);
      const protDiff = Math.abs(opt.finalTotals.protein - targets.protein);
      console.log(`Opção ${opt.optionNumber}: Cal ±${calDiff.toFixed(0)}kcal, Prot ±${protDiff.toFixed(1)}g, Convergiu: ${opt.converged}, Norm: ${opt.normalizationApplied}`);
    }

    // Retornar no formato esperado pelo frontend
    return new Response(JSON.stringify({
      success: status !== "error",
      result,
      currentMacros: currentTotals,
      targetMacros: targets,
      proposedMacros: primaryResult.finalTotals,
      // NOVO: Metadados G-10 no nível raiz para fácil acesso
      g10Meta: {
        g10Status: g10Metadata.g10Status,
        implicitFatRatio: g10Metadata.implicitFatRatio,
        normalizationApplied: anyNormalizationApplied,
      },
      // Incluir resultados de todas as opções
      optionResults: optionResults.map(opt => ({
        optionNumber: opt.optionNumber,
        converged: opt.converged,
        iterations: opt.iterations,
        finalTotals: opt.finalTotals,
        foodChanges: opt.foodChanges.length,
        normalizationApplied: opt.normalizationApplied,
      })),
      adjustments: allFoodChanges.map((fc) => ({
        mealOptionFoodId: fc.mealOptionFoodId,
        mealId: fc.mealId,
        mealOptionId: fc.mealOptionId,
        mealName: fc.mealName,
        foodName: fc.food_name,
        foodId: fc.food_id,
        originalGrams: fc.original_grams,
        newGrams: fc.new_grams,
        reason: `Ajuste para ${objective === "cut" ? "emagrecimento" : objective === "bulk" ? "ganho de massa" : "manutenção"}`,
      })),
      explanation: status === "error"
        ? `Não foi possível atingir as metas. Verifique se as metas são realistas para os alimentos disponíveis.`
        : `Plano ajustado em ${totalIterations} iteração(ões) para ${objective === "cut" ? "emagrecimento" : objective === "bulk" ? "ganho de massa" : "manutenção"}. ${optionResults.length} opção(ões) processada(s).${anyNormalizationApplied ? ' Normalização de gordura implícita aplicada.' : ''}`,
      warnings: status === "error"
        ? primaryValidation.errors
        : status === "valid_with_alert"
        ? optionResults.filter(r => !r.converged).map(r => `Opção ${r.optionNumber} não convergiu completamente`)
        : [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Rebalance error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
