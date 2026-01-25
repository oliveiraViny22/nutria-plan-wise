// =====================================================
// PLANO DE DELTAS (CHECKLIST ITEM 3)
// =====================================================
// Calcula deltas ANTES de ajustar qualquer alimento.
// REGRA: Macro-first, não alimento-first.
// =====================================================

import {
  MacroTargets,
  MacroDeltas,
  PlannedDeltas,
  StrategyContext,
  calculateDeltas,
  KCAL_PER_GRAM,
  VALIDATION_TOLERANCES,
} from './types';

// =====================================================
// CÁLCULOS DE LIMITES
// =====================================================

/**
 * Calcula o delta máximo permitido para um macro
 * considerando o impacto calórico.
 */
function clampDelta(
  delta: number,
  macro: 'protein' | 'carbs' | 'fat',
  caloriesBudget: number
): number {
  const kcalPerGram = KCAL_PER_GRAM[macro];
  const maxFromCalories = caloriesBudget / kcalPerGram;
  
  if (delta > 0) {
    // Déficit: precisamos adicionar
    return Math.min(delta, Math.max(0, maxFromCalories));
  } else {
    // Excesso: precisamos reduzir
    return Math.max(delta, Math.min(0, maxFromCalories));
  }
}

/**
 * Calcula calorias esperadas a partir dos deltas de macros.
 */
function expectedCaloriesFromMacros(deltas: MacroDeltas): number {
  return (
    deltas.protein * KCAL_PER_GRAM.protein +
    deltas.carbs * KCAL_PER_GRAM.carbs +
    deltas.fat * KCAL_PER_GRAM.fat
  );
}

// =====================================================
// VALIDAÇÃO DE VIABILIDADE
// =====================================================

interface ViabilityCheck {
  isViable: boolean;
  reason?: string;
  adjustedDeltas?: MacroDeltas;
}

/**
 * Verifica se os deltas planejados são viáveis.
 */
function checkViability(
  current: MacroTargets,
  target: MacroTargets,
  plannedDeltas: MacroDeltas
): ViabilityCheck {
  const proposedCalories = current.calories + expectedCaloriesFromMacros(plannedDeltas);
  const caloriePercent = target.calories > 0 ? (proposedCalories / target.calories) * 100 : 100;
  
  // Calorias devem estar dentro de ±2%
  if (Math.abs(caloriePercent - 100) > VALIDATION_TOLERANCES.CALORIE_PERCENT) {
    return {
      isViable: false,
      reason: `Calorias fora do intervalo: ${caloriePercent.toFixed(1)}% (tolerância: ±${VALIDATION_TOLERANCES.CALORIE_PERCENT}%)`,
    };
  }
  
  // Proteína deve estar ≥97%
  const proposedProtein = current.protein + plannedDeltas.protein;
  const proteinPercent = target.protein > 0 ? (proposedProtein / target.protein) * 100 : 100;
  if (proteinPercent < VALIDATION_TOLERANCES.PROTEIN_MIN_PERCENT) {
    return {
      isViable: false,
      reason: `Proteína insuficiente: ${proteinPercent.toFixed(1)}% (mín: ${VALIDATION_TOLERANCES.PROTEIN_MIN_PERCENT}%)`,
    };
  }
  
  // Gordura deve estar dentro de ±5g
  const proposedFat = current.fat + plannedDeltas.fat;
  const fatDiff = Math.abs(proposedFat - target.fat);
  if (fatDiff > VALIDATION_TOLERANCES.FAT_GRAMS) {
    return {
      isViable: false,
      reason: `Gordura fora do intervalo: ${proposedFat.toFixed(1)}g vs ${target.fat}g (tolerância: ±${VALIDATION_TOLERANCES.FAT_GRAMS}g)`,
    };
  }
  
  return { isViable: true };
}

// =====================================================
// FUNÇÃO PRINCIPAL
// =====================================================

/**
 * Planeja os deltas ANTES de ajustar qualquer alimento.
 * 
 * REGRAS:
 * 1. Calorias dentro de ±2%
 * 2. Gordura dentro de ±5g
 * 3. Proteína ≥97% se possível
 * 4. Carboidrato dentro da tolerância assimétrica
 * 5. Se não existir conjunto viável → falha controlada
 */
export function planDeltas(
  current: MacroTargets,
  target: MacroTargets,
  strategy: StrategyContext
): PlannedDeltas {
  // Se estratégia é bloqueio estrutural, não há deltas viáveis
  if (strategy.strategy === 'STRUCTURALLY_BLOCKED') {
    return {
      protein: 0,
      carbs: 0,
      fat: 0,
      calories: 0,
      isViable: false,
      reason: strategy.reason,
    };
  }
  
  const rawDeltas = calculateDeltas(current, target);
  const caloriesBudget = target.calories - current.calories;
  
  // Planejar deltas conforme estratégia
  let plannedDeltas: MacroDeltas;
  
  switch (strategy.strategy) {
    case 'PROTEIN_PRIMARY':
      // Priorizar proteína, ajustar carbs para compensar calorias
      plannedDeltas = planProteinPrimary(rawDeltas, caloriesBudget, current, target);
      break;
      
    case 'CARB_PRIMARY':
      // Priorizar carboidrato, manter gordura estável
      plannedDeltas = planCarbPrimary(rawDeltas, caloriesBudget, current, target);
      break;
      
    case 'FAT_PRIMARY':
      // Priorizar gordura (raro), ajustar carbs
      plannedDeltas = planFatPrimary(rawDeltas, caloriesBudget, current, target);
      break;
      
    case 'CALORIE_CONSTRAINED':
      // Ajustar proporcionalmente todos os macros
      plannedDeltas = planCalorieConstrained(rawDeltas, caloriesBudget, current, target);
      break;
      
    default:
      plannedDeltas = rawDeltas;
  }
  
  // Verificar viabilidade
  const viability = checkViability(current, target, plannedDeltas);
  
  return {
    ...plannedDeltas,
    isViable: viability.isViable,
    reason: viability.reason,
  };
}

// =====================================================
// PLANEJADORES POR ESTRATÉGIA
// =====================================================

function planProteinPrimary(
  rawDeltas: MacroDeltas,
  caloriesBudget: number,
  current: MacroTargets,
  target: MacroTargets
): MacroDeltas {
  // Ajustar proteína primeiro
  const proteinDelta = clampDelta(rawDeltas.protein, 'protein', Math.abs(caloriesBudget) + 200);
  const proteinCalories = proteinDelta * KCAL_PER_GRAM.protein;
  
  // Compensar com carboidrato
  const remainingCalorieBudget = caloriesBudget - proteinCalories;
  const carbsDelta = clampDelta(
    remainingCalorieBudget / KCAL_PER_GRAM.carbs,
    'carbs',
    remainingCalorieBudget
  );
  
  // Gordura: ajuste fino apenas
  const usedCalories = proteinCalories + (carbsDelta * KCAL_PER_GRAM.carbs);
  const fatCaloriesBudget = caloriesBudget - usedCalories;
  const fatDelta = clampDelta(fatCaloriesBudget / KCAL_PER_GRAM.fat, 'fat', fatCaloriesBudget);
  
  return {
    protein: proteinDelta,
    carbs: carbsDelta,
    fat: fatDelta,
    calories: expectedCaloriesFromMacros({ protein: proteinDelta, carbs: carbsDelta, fat: fatDelta, calories: 0 }),
  };
}

function planCarbPrimary(
  rawDeltas: MacroDeltas,
  caloriesBudget: number,
  current: MacroTargets,
  target: MacroTargets
): MacroDeltas {
  // Ajustar carboidrato primeiro
  const carbsDelta = clampDelta(rawDeltas.carbs, 'carbs', Math.abs(caloriesBudget) + 200);
  const carbsCalories = carbsDelta * KCAL_PER_GRAM.carbs;
  
  // Proteína: manter estável ou ajustar levemente
  const proteinDelta = Math.min(Math.abs(rawDeltas.protein), 10) * Math.sign(rawDeltas.protein);
  const proteinCalories = proteinDelta * KCAL_PER_GRAM.protein;
  
  // Gordura: compensar o restante
  const usedCalories = carbsCalories + proteinCalories;
  const fatCaloriesBudget = caloriesBudget - usedCalories;
  const fatDelta = clampDelta(fatCaloriesBudget / KCAL_PER_GRAM.fat, 'fat', fatCaloriesBudget);
  
  return {
    protein: proteinDelta,
    carbs: carbsDelta,
    fat: fatDelta,
    calories: expectedCaloriesFromMacros({ protein: proteinDelta, carbs: carbsDelta, fat: fatDelta, calories: 0 }),
  };
}

function planFatPrimary(
  rawDeltas: MacroDeltas,
  caloriesBudget: number,
  current: MacroTargets,
  target: MacroTargets
): MacroDeltas {
  // Ajustar gordura primeiro (com limite de ±5g)
  const fatDelta = Math.max(-5, Math.min(5, rawDeltas.fat));
  const fatCalories = fatDelta * KCAL_PER_GRAM.fat;
  
  // Carboidrato: compensar
  const remainingCalorieBudget = caloriesBudget - fatCalories;
  const carbsDelta = clampDelta(
    remainingCalorieBudget / KCAL_PER_GRAM.carbs,
    'carbs',
    remainingCalorieBudget
  );
  
  // Proteína: ajuste fino
  const usedCalories = fatCalories + (carbsDelta * KCAL_PER_GRAM.carbs);
  const proteinCaloriesBudget = caloriesBudget - usedCalories;
  const proteinDelta = clampDelta(proteinCaloriesBudget / KCAL_PER_GRAM.protein, 'protein', proteinCaloriesBudget);
  
  return {
    protein: proteinDelta,
    carbs: carbsDelta,
    fat: fatDelta,
    calories: expectedCaloriesFromMacros({ protein: proteinDelta, carbs: carbsDelta, fat: fatDelta, calories: 0 }),
  };
}

function planCalorieConstrained(
  rawDeltas: MacroDeltas,
  caloriesBudget: number,
  current: MacroTargets,
  target: MacroTargets
): MacroDeltas {
  // Calcular fator de escala baseado em calorias
  const rawCaloriesDelta = expectedCaloriesFromMacros(rawDeltas);
  const scaleFactor = rawCaloriesDelta !== 0 ? caloriesBudget / rawCaloriesDelta : 1;
  const clampedScale = Math.max(0.5, Math.min(1.5, scaleFactor));
  
  return {
    protein: rawDeltas.protein * clampedScale,
    carbs: rawDeltas.carbs * clampedScale,
    fat: rawDeltas.fat * clampedScale,
    calories: caloriesBudget,
  };
}
