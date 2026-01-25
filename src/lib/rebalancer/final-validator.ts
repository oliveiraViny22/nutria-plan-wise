// =====================================================
// VALIDAÇÃO FINAL (CHECKLIST ITEM 5)
// =====================================================
// Valida o resultado APÓS ajustes.
// REGRA: Se inválido → falha controlada, não reexecutar.
// =====================================================

import {
  MacroTargets,
  VALIDATION_TOLERANCES,
} from './types';

// =====================================================
// TIPOS DE RESULTADO
// =====================================================

export interface FinalValidationResult {
  isValid: boolean;
  calorieOK: boolean;
  proteinOK: boolean;
  carbsOK: boolean;
  fatOK: boolean;
  errors: string[];
  metrics: {
    caloriePercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatDiff: number;
  };
}

// =====================================================
// FUNÇÕES DE VALIDAÇÃO
// =====================================================

/**
 * Valida calorias: ±2%
 */
function validateCalories(proposed: number, target: number): { ok: boolean; percent: number; error?: string } {
  const percent = target > 0 ? (proposed / target) * 100 : 100;
  const diff = Math.abs(percent - 100);
  const ok = diff <= VALIDATION_TOLERANCES.CALORIE_PERCENT;
  
  return {
    ok,
    percent,
    error: ok ? undefined : `Calorias: ${Math.round(proposed)} kcal (${percent.toFixed(1)}% da meta, tolerância: ±${VALIDATION_TOLERANCES.CALORIE_PERCENT}%)`,
  };
}

/**
 * Valida proteína: ≥97%
 */
function validateProtein(proposed: number, target: number): { ok: boolean; percent: number; error?: string } {
  const percent = target > 0 ? (proposed / target) * 100 : 100;
  const ok = percent >= VALIDATION_TOLERANCES.PROTEIN_MIN_PERCENT;
  
  return {
    ok,
    percent,
    error: ok ? undefined : `Proteína: ${Math.round(proposed)}g (${percent.toFixed(1)}% da meta, mín: ${VALIDATION_TOLERANCES.PROTEIN_MIN_PERCENT}%)`,
  };
}

/**
 * Valida carboidrato: tolerância assimétrica (95%-105%)
 */
function validateCarbs(proposed: number, target: number): { ok: boolean; percent: number; error?: string } {
  const percent = target > 0 ? (proposed / target) * 100 : 100;
  const ok = percent >= VALIDATION_TOLERANCES.CARBS_MIN_PERCENT && 
             percent <= VALIDATION_TOLERANCES.CARBS_MAX_PERCENT;
  
  return {
    ok,
    percent,
    error: ok ? undefined : `Carboidrato: ${Math.round(proposed)}g (${percent.toFixed(1)}% da meta, intervalo: ${VALIDATION_TOLERANCES.CARBS_MIN_PERCENT}%-${VALIDATION_TOLERANCES.CARBS_MAX_PERCENT}%)`,
  };
}

/**
 * Valida gordura: ±5g
 */
function validateFat(proposed: number, target: number): { ok: boolean; diff: number; error?: string } {
  const diff = proposed - target;
  const ok = Math.abs(diff) <= VALIDATION_TOLERANCES.FAT_GRAMS;
  
  return {
    ok,
    diff,
    error: ok ? undefined : `Gordura: ${Math.round(proposed)}g (${diff > 0 ? '+' : ''}${Math.round(diff)}g da meta, tolerância: ±${VALIDATION_TOLERANCES.FAT_GRAMS}g)`,
  };
}

// =====================================================
// FUNÇÃO PRINCIPAL DE VALIDAÇÃO
// =====================================================

/**
 * Valida o resultado final do rebalanceamento.
 * 
 * TOLERÂNCIAS (baseadas no checklist):
 * - Calorias: ±2%
 * - Proteína: ≥97%
 * - Carboidrato: 95%-105% (assimétrica)
 * - Gordura: ±5g
 * 
 * REGRA: Se inválido → falha controlada, não reexecutar.
 */
export function validateFinalResult(
  proposed: MacroTargets,
  target: MacroTargets
): FinalValidationResult {
  const calorieResult = validateCalories(proposed.calories, target.calories);
  const proteinResult = validateProtein(proposed.protein, target.protein);
  const carbsResult = validateCarbs(proposed.carbs, target.carbs);
  const fatResult = validateFat(proposed.fat, target.fat);
  
  const errors: string[] = [];
  if (calorieResult.error) errors.push(calorieResult.error);
  if (proteinResult.error) errors.push(proteinResult.error);
  if (carbsResult.error) errors.push(carbsResult.error);
  if (fatResult.error) errors.push(fatResult.error);
  
  return {
    isValid: calorieResult.ok && proteinResult.ok && carbsResult.ok && fatResult.ok,
    calorieOK: calorieResult.ok,
    proteinOK: proteinResult.ok,
    carbsOK: carbsResult.ok,
    fatOK: fatResult.ok,
    errors,
    metrics: {
      caloriePercent: calorieResult.percent,
      proteinPercent: proteinResult.percent,
      carbsPercent: carbsResult.percent,
      fatDiff: fatResult.diff,
    },
  };
}

/**
 * Verifica se os macros propostos estão exatamente na meta.
 * Usado para determinar status 'balanced'.
 */
export function isExactlyOnTarget(proposed: MacroTargets, target: MacroTargets): boolean {
  return (
    Math.round(proposed.calories) === Math.round(target.calories) &&
    Math.round(proposed.protein) === Math.round(target.protein) &&
    Math.round(proposed.carbs) === Math.round(target.carbs) &&
    Math.round(proposed.fat) === Math.round(target.fat)
  );
}

/**
 * Verifica se os macros estão dentro das tolerâncias aceitáveis.
 * Mais permissivo que isExactlyOnTarget, usado para status 'adjusted'.
 */
export function isWithinTolerances(proposed: MacroTargets, target: MacroTargets): boolean {
  const result = validateFinalResult(proposed, target);
  return result.isValid;
}
