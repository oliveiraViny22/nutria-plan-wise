// =====================================================
// EXECUTOR DE AJUSTES (CHECKLIST ITEM 4)
// =====================================================
// Aplica ajustes conforme o plano de deltas.
// REGRA: Uma única passada, sem recalcular estratégia.
// =====================================================

import {
  PlanItem,
  MacroTargets,
  PlannedDeltas,
  QuantityAdjustment,
  StrategyContext,
  calculateNutrients,
  KCAL_PER_GRAM,
  REBALANCER_CONTRACT,
} from './types';

import { FoodCategory } from '../food-categories';

// =====================================================
// CATEGORIZAÇÃO DE ALIMENTOS
// =====================================================

const PROTEIN_CATEGORIES: FoodCategory[] = ['proteinas', 'leguminosas', 'laticinios'];
const CARB_CATEGORIES: FoodCategory[] = ['carboidratos', 'leguminosas'];
const FAT_CATEGORIES: FoodCategory[] = ['gorduras'];

function isProteinRich(food: { protein: number; carbs: number; fat: number; calories: number }): boolean {
  const proteinCals = food.protein * KCAL_PER_GRAM.protein;
  return food.calories > 0 && (proteinCals / food.calories) > 0.25;
}

function isCarbRich(food: { protein: number; carbs: number; fat: number; calories: number }): boolean {
  const carbsCals = food.carbs * KCAL_PER_GRAM.carbs;
  return food.calories > 0 && (carbsCals / food.calories) > 0.40;
}

function isFatRich(food: { protein: number; carbs: number; fat: number; calories: number }): boolean {
  const fatCals = food.fat * KCAL_PER_GRAM.fat;
  return food.calories > 0 && (fatCals / food.calories) > 0.35;
}

// =====================================================
// FUNÇÕES DE AJUSTE
// =====================================================

interface AdjustmentResult {
  adjustment: QuantityAdjustment | null;
  actualDelta: number; // Delta real alcançado
}

/**
 * Cria um ajuste para um item específico.
 */
function createAdjustment(
  item: PlanItem,
  newGrams: number,
  reason: string
): QuantityAdjustment {
  const clampedGrams = Math.max(
    REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS,
    Math.min(REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS, Math.round(newGrams))
  );
  
  return {
    itemId: item.id,
    mealId: item.mealId,
    mealName: item.mealName,
    optionId: item.optionId,
    foodId: item.food.id,
    foodName: item.food.name,
    originalGrams: item.quantityGrams,
    newGrams: clampedGrams,
    reason,
  };
}

/**
 * Ajusta um item para contribuir com o delta de um macro.
 */
function adjustItemForMacro(
  item: PlanItem,
  targetDelta: number,
  macro: 'protein' | 'carbs' | 'fat'
): AdjustmentResult {
  const macroPer100g = (item.food[macro] / item.food.servingGrams) * 100;
  if (macroPer100g < 1) {
    return { adjustment: null, actualDelta: 0 };
  }
  
  // Calcular gramas necessárias
  const gramsNeeded = (Math.abs(targetDelta) / macroPer100g) * 100;
  const isIncrease = targetDelta > 0;
  
  // Aplicar limites de ajuste
  const maxAdjust = item.quantityGrams * (REBALANCER_CONTRACT.MAX_ADJUSTMENT_PERCENT / 100);
  
  let newGrams: number;
  if (isIncrease) {
    const toAdd = Math.min(gramsNeeded, maxAdjust);
    newGrams = item.quantityGrams + toAdd;
    newGrams = Math.min(newGrams, REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS);
  } else {
    const toRemove = Math.min(gramsNeeded, item.quantityGrams - REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS);
    newGrams = item.quantityGrams - toRemove;
    newGrams = Math.max(newGrams, REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS);
  }
  
  // Calcular delta real alcançado
  const gramsDiff = newGrams - item.quantityGrams;
  const actualDelta = (gramsDiff / item.food.servingGrams) * item.food[macro];
  
  if (Math.abs(gramsDiff) < 2) {
    return { adjustment: null, actualDelta: 0 };
  }
  
  const macroName = { protein: 'proteína', carbs: 'carboidrato', fat: 'gordura' }[macro];
  const reason = isIncrease 
    ? `Aumentar ${macroName} (+${Math.abs(actualDelta).toFixed(1)}g)`
    : `Reduzir ${macroName} (-${Math.abs(actualDelta).toFixed(1)}g)`;
  
  return {
    adjustment: createAdjustment(item, newGrams, reason),
    actualDelta,
  };
}

// =====================================================
// EXECUÇÃO POR ESTRATÉGIA
// =====================================================

/**
 * Filtra e ordena itens para ajuste de um macro específico.
 */
function getItemsForMacro(
  items: PlanItem[],
  macro: 'protein' | 'carbs' | 'fat',
  excludeIds: Set<string>
): PlanItem[] {
  const isRichFn = { protein: isProteinRich, carbs: isCarbRich, fat: isFatRich }[macro];
  
  return items
    .filter(item => item.isActive && !excludeIds.has(item.id))
    .filter(item => isRichFn(item.food))
    .sort((a, b) => {
      // Ordenar por densidade do macro (g/100g)
      const densityA = (a.food[macro] / a.food.servingGrams) * 100;
      const densityB = (b.food[macro] / b.food.servingGrams) * 100;
      return densityB - densityA;
    });
}

/**
 * Executa ajustes para um macro específico.
 */
function executeForMacro(
  items: PlanItem[],
  targetDelta: number,
  macro: 'protein' | 'carbs' | 'fat',
  excludeIds: Set<string>
): { adjustments: QuantityAdjustment[]; remaining: number } {
  const adjustments: QuantityAdjustment[] = [];
  let remaining = targetDelta;
  
  const eligibleItems = getItemsForMacro(items, macro, excludeIds);
  
  for (const item of eligibleItems) {
    if (Math.abs(remaining) < 2) break;
    
    const result = adjustItemForMacro(item, remaining, macro);
    
    if (result.adjustment) {
      adjustments.push(result.adjustment);
      remaining -= result.actualDelta;
      excludeIds.add(item.id);
    }
  }
  
  return { adjustments, remaining };
}

// =====================================================
// FUNÇÃO PRINCIPAL DE EXECUÇÃO
// =====================================================

/**
 * Executa ajustes conforme o plano de deltas.
 * 
 * REGRAS:
 * 1. Uma única passada
 * 2. Nunca recalcular estratégia durante execução
 * 3. Nunca "compensar depois"
 * 4. Seguir ordem: Proteína → Carboidrato → Gordura
 */
export function executeAdjustments(
  items: PlanItem[],
  plannedDeltas: PlannedDeltas,
  strategy: StrategyContext
): QuantityAdjustment[] {
  // Se deltas não são viáveis, não executar
  if (!plannedDeltas.isViable) {
    return [];
  }
  
  const adjustments: QuantityAdjustment[] = [];
  const excludeIds = new Set<string>();
  
  // Determinar ordem de ajuste baseada na estratégia
  let macroOrder: ('protein' | 'carbs' | 'fat')[];
  
  switch (strategy.strategy) {
    case 'PROTEIN_PRIMARY':
      macroOrder = ['protein', 'carbs', 'fat'];
      break;
    case 'CARB_PRIMARY':
      macroOrder = ['carbs', 'protein', 'fat'];
      break;
    case 'FAT_PRIMARY':
      macroOrder = ['fat', 'carbs', 'protein'];
      break;
    case 'CALORIE_CONSTRAINED':
      // Ajustar proporcionalmente - começar pelo maior delta
      const absDeltas = [
        { macro: 'protein' as const, delta: Math.abs(plannedDeltas.protein) },
        { macro: 'carbs' as const, delta: Math.abs(plannedDeltas.carbs) },
        { macro: 'fat' as const, delta: Math.abs(plannedDeltas.fat) },
      ].sort((a, b) => b.delta - a.delta);
      macroOrder = absDeltas.map(d => d.macro);
      break;
    default:
      return [];
  }
  
  // Executar na ordem determinada
  for (const macro of macroOrder) {
    const targetDelta = plannedDeltas[macro];
    if (Math.abs(targetDelta) < 2) continue;
    
    const result = executeForMacro(items, targetDelta, macro, excludeIds);
    adjustments.push(...result.adjustments);
  }
  
  return adjustments;
}

/**
 * Aplica ajustes a uma cópia dos itens.
 */
export function applyAdjustmentsToItems(
  items: PlanItem[],
  adjustments: QuantityAdjustment[]
): PlanItem[] {
  const adjustmentMap = new Map(adjustments.map(a => [a.itemId, a.newGrams]));
  
  return items.map(item => {
    const newGrams = adjustmentMap.get(item.id);
    if (newGrams !== undefined) {
      return { ...item, quantityGrams: newGrams };
    }
    return { ...item };
  });
}
