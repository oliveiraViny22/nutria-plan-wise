// =====================================================
// REBALANCER TYPES - TIPOS E CONSTANTES DO REBALANCEADOR
// =====================================================
// Tipos unificados para todo o sistema de rebalanceamento.
// FONTE ÚNICA DE VERDADE para tipos do rebalanceador.
// =====================================================

import { KCAL_PER_GRAM, REBALANCER_CONTRACT } from '../nutrition-contracts';

// Re-export para uso externo
export { KCAL_PER_GRAM, REBALANCER_CONTRACT };

// =====================================================
// TIPOS BASE
// =====================================================

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface MacroDeltas {
  protein: number;  // positivo = déficit, negativo = excesso
  carbs: number;
  fat: number;
  calories: number;
}

export interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string | null;
  servingGrams: number;
}

export interface PlanItem {
  id: string;
  mealId: string;
  mealName: string;
  optionId: string;
  optionNumber: number;
  food: FoodItem;
  quantityGrams: number;
  isActive: boolean;
}

export interface DietPlan {
  id: string;
  items: PlanItem[];
  version: number;
}

// =====================================================
// CLASSIFICAÇÃO DE ESTADO (CHECKLIST ITEM 1)
// =====================================================

/**
 * Estado de cada macro em relação à meta.
 */
export type MacroState = 'deficit' | 'excess' | 'on_target';

/**
 * Classificação global do estado do plano.
 */
export interface GlobalMacroState {
  protein: MacroState;
  carbs: MacroState;
  fat: MacroState;
  calories: MacroState;
}

// =====================================================
// ESTRATÉGIA ÚNICA (CHECKLIST ITEM 2)
// =====================================================

/**
 * Estratégia de rebalanceamento.
 * REGRA: Uma única estratégia por execução.
 */
export type RebalanceStrategy =
  | 'PROTEIN_PRIMARY'      // Proteína é o macro mais distante
  | 'CARB_PRIMARY'         // Carboidrato é o macro mais distante
  | 'FAT_PRIMARY'          // Gordura é o macro mais distante (raro)
  | 'CALORIE_CONSTRAINED'  // Calorias são o limitante principal
  | 'STRUCTURALLY_BLOCKED'; // Bloqueio estrutural detectado

/**
 * Contexto da estratégia escolhida.
 */
export interface StrategyContext {
  strategy: RebalanceStrategy;
  reason: string;
  primaryDeficit: number;
  calorieImpact: number;
}

// =====================================================
// PLANO DE DELTAS (CHECKLIST ITEM 3)
// =====================================================

/**
 * Deltas planejados antes de execução.
 * REGRA: Calcular antes de ajustar qualquer alimento.
 */
export interface PlannedDeltas {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  isViable: boolean;
  reason?: string;
}

// =====================================================
// AJUSTES DE QUANTIDADE
// =====================================================

export interface QuantityAdjustment {
  itemId: string;
  mealId: string;
  mealName: string;
  optionId: string;
  foodId: string;
  foodName: string;
  originalGrams: number;
  newGrams: number;
  reason: string;
}

// =====================================================
// RESULTADO DO REBALANCEAMENTO
// =====================================================

/**
 * Status do plano após rebalanceamento.
 * APENAS 3 estados finais possíveis.
 */
export type RebalanceStatus = 
  | 'balanced'           // Plano já está dentro das metas
  | 'adjusted'           // Ajustes aplicados, resultado válido
  | 'blocked_structural'; // Estrutura impede rebalanceamento

export interface StructuralValidation {
  isValid: boolean;
  errors: string[];
}

/**
 * Resultado completo do rebalanceamento.
 * Inclui snapshot para debug e QA.
 */
export interface RebalanceResult {
  status: RebalanceStatus;
  plan?: DietPlan;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros?: MacroTargets;
  adjustments: QuantityAdjustment[];
  reason?: string;
  validationDetails?: StructuralValidation;
  
  // Snapshot para debug/QA (checklist item 2)
  strategyContext?: StrategyContext;
  plannedDeltas?: PlannedDeltas;
}

// =====================================================
// TOLERÂNCIAS (CHECKLIST ITEM 5)
// =====================================================

/**
 * Tolerâncias para validação final.
 * Valores baseados no checklist técnico.
 */
export const VALIDATION_TOLERANCES = {
  /** Calorias: ±2% */
  CALORIE_PERCENT: 2,
  
  /** Proteína: ≥97% da meta */
  PROTEIN_MIN_PERCENT: 97,
  
  /** Gordura: ±5g */
  FAT_GRAMS: 5,
  
  /** Carboidrato baixo: mín 95% */
  CARBS_MIN_PERCENT: 95,
  
  /** Carboidrato alto: máx 105% */
  CARBS_MAX_PERCENT: 105,
} as const;

// =====================================================
// FUNÇÕES AUXILIARES PURAS
// =====================================================

/**
 * Filtra apenas a primeira opção de cada refeição.
 * IMPORTANTE: As opções são alternativas (o usuário escolhe uma),
 * não devem ser somadas todas juntas.
 */
export function getFirstOptionItems(items: PlanItem[]): PlanItem[] {
  // Agrupar por refeição
  const itemsByMeal = new Map<string, PlanItem[]>();
  
  for (const item of items) {
    if (!item.isActive) continue;
    const existing = itemsByMeal.get(item.mealId) || [];
    existing.push(item);
    itemsByMeal.set(item.mealId, existing);
  }
  
  const result: PlanItem[] = [];
  
  // Para cada refeição, pegar apenas os itens da primeira opção
  for (const mealItems of itemsByMeal.values()) {
    const minOption = Math.min(...mealItems.map(i => i.optionNumber));
    const firstOptionItems = mealItems.filter(i => i.optionNumber === minOption);
    result.push(...firstOptionItems);
  }
  
  return result;
}

/**
 * Calcula nutrientes para uma quantidade em gramas.
 */
export function calculateNutrients(food: FoodItem, grams: number): MacroTargets {
  const multiplier = grams / food.servingGrams;
  return {
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
    calories: food.calories * multiplier,
  };
}

/**
 * Soma macros de todos os itens ativos.
 * IMPORTANTE: Considera apenas a primeira opção de cada refeição para evitar
 * somar múltiplas opções (que são alternativas, não adições).
 */
export function sumMacros(items: PlanItem[]): MacroTargets {
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let calories = 0;
  
  // Agrupar por refeição e pegar apenas a primeira opção de cada
  const itemsByMeal = new Map<string, PlanItem[]>();
  
  for (const item of items) {
    if (!item.isActive) continue;
    const existing = itemsByMeal.get(item.mealId) || [];
    existing.push(item);
    itemsByMeal.set(item.mealId, existing);
  }
  
  // Para cada refeição, somar apenas os itens da primeira opção
  for (const mealItems of itemsByMeal.values()) {
    // Encontrar a menor option number (primeira opção)
    const minOption = Math.min(...mealItems.map(i => i.optionNumber));
    const firstOptionItems = mealItems.filter(i => i.optionNumber === minOption);
    
    for (const item of firstOptionItems) {
      const nutrients = calculateNutrients(item.food, item.quantityGrams);
      protein += nutrients.protein;
      carbs += nutrients.carbs;
      fat += nutrients.fat;
      calories += nutrients.calories;
    }
  }
  
  return { protein, carbs, fat, calories };
}

/**
 * Arredonda macros para inteiros.
 */
export function roundMacros(macros: MacroTargets): MacroTargets {
  return {
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    calories: Math.round(macros.calories),
  };
}

/**
 * Calcula deltas entre atual e meta.
 */
export function calculateDeltas(current: MacroTargets, target: MacroTargets): MacroDeltas {
  return {
    protein: target.protein - current.protein,
    carbs: target.carbs - current.carbs,
    fat: target.fat - current.fat,
    calories: target.calories - current.calories,
  };
}

/**
 * Classifica o estado de um macro.
 */
export function classifyDelta(current: number, target: number): MacroState {
  const diff = current - target;
  // Considera ±2g como "on_target" para evitar micro-ajustes
  if (Math.abs(diff) <= 2) return 'on_target';
  return diff < 0 ? 'deficit' : 'excess';
}

/**
 * Classifica o estado global do plano.
 */
export function classifyGlobalState(current: MacroTargets, target: MacroTargets): GlobalMacroState {
  return {
    protein: classifyDelta(current.protein, target.protein),
    carbs: classifyDelta(current.carbs, target.carbs),
    fat: classifyDelta(current.fat, target.fat),
    calories: classifyDelta(current.calories, target.calories),
  };
}
