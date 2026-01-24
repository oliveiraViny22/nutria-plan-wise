// =====================================================
// CONTRATOS NUTRICIONAIS - FONTE ÚNICA DE VERDADE
// =====================================================
// Este módulo define TODOS os contratos e constantes
// que governam o sistema de nutrição.
// 
// REGRA: Qualquer mudança aqui afeta todo o sistema.
// =====================================================

// =====================================================
// CONSTANTES ENERGÉTICAS (IMUTÁVEIS)
// =====================================================

export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

// =====================================================
// CONTRATOS DO GERADOR
// =====================================================

export const GENERATOR_CONTRACT = {
  /** Tolerância calórica: plano deve estar dentro de ±10% */
  CALORIE_TOLERANCE_PERCENT: 10,
  
  /** Tolerância de gordura: máximo 30% das calorias totais */
  MAX_FAT_PERCENT_OF_CALORIES: 30,
  
  /** Proteína mínima em gramas por refeição principal */
  MIN_PROTEIN_MAIN_MEAL_GRAMS: 20,
  
  /** Proteína mínima em gramas por lanche */
  MIN_PROTEIN_SNACK_GRAMS: 5,
  
  /** Carboidrato mínimo: 90% da meta (base energética) */
  MIN_CARBS_PERCENT: 90,
  
  /** Proteína mínima global: 95% da meta */
  MIN_PROTEIN_PERCENT: 95,
} as const;

// =====================================================
// CONTRATOS DO REBALANCEADOR
// =====================================================

export const REBALANCER_CONTRACT = {
  /** SEM tolerância calórica: deve atingir a meta exata */
  CALORIE_TOLERANCE_PERCENT: 0,
  
  /** SEM tolerância de proteína: deve atingir a meta exata */
  PROTEIN_TOLERANCE_PERCENT: 0,
  
  /** SEM tolerância de carboidrato para baixo */
  CARBS_MIN_TOLERANCE_PERCENT: 0,
  
  /** SEM tolerância de carboidrato para cima */
  CARBS_MAX_TOLERANCE_PERCENT: 0,
  
  /** SEM tolerância de gordura: deve atingir a meta exata */
  FAT_TOLERANCE_GRAMS: 0,
  
  /** Máximo ajuste por alimento: 100% (dobrar ou zerar) */
  MAX_ADJUSTMENT_PERCENT: 100,
  
  /** Quantidade mínima: 5g */
  MIN_QUANTITY_GRAMS: 5,
  
  /** Quantidade máxima por item: 600g */
  MAX_QUANTITY_GRAMS: 600,
} as const;

// =====================================================
// CONTRATOS DA IA
// =====================================================

export const AI_CONTRACT = {
  /** IA NUNCA executa ajustes - apenas explica falhas */
  CAN_EXECUTE: false,
  
  /** IA pode sugerir estratégias */
  CAN_SUGGEST_STRATEGIES: true,
  
  /** IA NUNCA calcula valores numéricos finais */
  CAN_CALCULATE_FINAL_VALUES: false,
} as const;

// =====================================================
// TIPOS COMPARTILHADOS
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

// =====================================================
// FUNÇÕES DE CÁLCULO PURAS
// =====================================================

/**
 * Converte macros para calorias.
 * CONTRATO NUTRICIONAL INVIOLÁVEL.
 */
export function macrosToCalories(macros: Partial<MacroTargets>): number {
  return (
    (macros.protein || 0) * KCAL_PER_GRAM.protein +
    (macros.carbs || 0) * KCAL_PER_GRAM.carbs +
    (macros.fat || 0) * KCAL_PER_GRAM.fat
  );
}

/**
 * Calcula deltas entre atual e meta.
 * Positivo = déficit (precisa adicionar)
 * Negativo = excesso (precisa reduzir)
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
 * Calcula percentual de gordura em relação às calorias.
 */
export function fatPercentOfCalories(fatGrams: number, totalCalories: number): number {
  if (totalCalories <= 0) return 0;
  const fatCalories = fatGrams * KCAL_PER_GRAM.fat;
  return (fatCalories / totalCalories) * 100;
}

// =====================================================
// VALIDAÇÕES DO GERADOR
// =====================================================

export interface GeneratorValidationResult {
  isValid: boolean;
  errors: string[];
  metrics: {
    caloriePercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercent: number;
  };
}

/**
 * Valida se um plano gerado atende TODOS os contratos.
 * Se retornar false, o plano NÃO pode ser salvo.
 */
export function validateGeneratedPlan(
  totals: MacroTargets,
  targets: MacroTargets,
  mealProteinValues: number[],
  mainMealIndices: number[]
): GeneratorValidationResult {
  const errors: string[] = [];
  
  const caloriePercent = (totals.calories / targets.calories) * 100;
  const proteinPercent = (totals.protein / targets.protein) * 100;
  const carbsPercent = (totals.carbs / targets.carbs) * 100;
  const fatPercent = fatPercentOfCalories(totals.fat, totals.calories);
  
  // CONTRATO 1: Calorias dentro de ±10%
  if (Math.abs(caloriePercent - 100) > GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT) {
    errors.push(
      `Calorias fora da tolerância: ${Math.round(totals.calories)} kcal ` +
      `(${caloriePercent.toFixed(1)}% da meta, limite: ±${GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT}%)`
    );
  }
  
  // CONTRATO 2: Proteína em todas as refeições principais
  for (const idx of mainMealIndices) {
    const protein = mealProteinValues[idx];
    if (protein < GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
      errors.push(
        `Refeição ${idx + 1} sem proteína suficiente: ${protein.toFixed(1)}g ` +
        `(mínimo: ${GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS}g)`
      );
    }
  }
  
  // CONTRATO 3: Carboidratos como base energética (≥90%)
  if (carbsPercent < GENERATOR_CONTRACT.MIN_CARBS_PERCENT) {
    errors.push(
      `Carboidratos insuficientes: ${Math.round(totals.carbs)}g ` +
      `(${carbsPercent.toFixed(1)}% da meta, mínimo: ${GENERATOR_CONTRACT.MIN_CARBS_PERCENT}%)`
    );
  }
  
  // CONTRATO 4: Gordura ≤30% das calorias
  if (fatPercent > GENERATOR_CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
    errors.push(
      `Gordura excessiva: ${fatPercent.toFixed(1)}% das calorias ` +
      `(máximo: ${GENERATOR_CONTRACT.MAX_FAT_PERCENT_OF_CALORIES}%)`
    );
  }
  
  // CONTRATO 5: Proteína total ≥95%
  if (proteinPercent < GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT) {
    errors.push(
      `Proteína total insuficiente: ${Math.round(totals.protein)}g ` +
      `(${proteinPercent.toFixed(1)}% da meta, mínimo: ${GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT}%)`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    metrics: { caloriePercent, proteinPercent, carbsPercent, fatPercent },
  };
}

// =====================================================
// VALIDAÇÕES DO REBALANCEADOR
// =====================================================

export interface RebalancerValidationResult {
  isValid: boolean;
  calorieOK: boolean;
  proteinOK: boolean;
  carbsOK: boolean;
  fatOK: boolean;
  errors: string[];
}

/**
 * Valida se macros propostos atingem as metas EXATAS.
 * ESSENCIAL: Esta é a validação FINAL - sem tolerâncias.
 */
export function validateRebalancedMacros(
  proposed: MacroTargets,
  target: MacroTargets
): RebalancerValidationResult {
  const errors: string[] = [];
  
  // Calorias: valor exato
  const calorieOK = Math.round(proposed.calories) === Math.round(target.calories);
  if (!calorieOK) {
    const diff = proposed.calories - target.calories;
    errors.push(
      `Calorias: ${Math.round(proposed.calories)} vs ${target.calories} ` +
      `(diferença: ${diff > 0 ? '+' : ''}${Math.round(diff)} kcal)`
    );
  }
  
  // Proteína: valor exato
  const proteinOK = Math.round(proposed.protein) === Math.round(target.protein);
  if (!proteinOK) {
    const diff = proposed.protein - target.protein;
    errors.push(
      `Proteína: ${Math.round(proposed.protein)}g vs ${target.protein}g ` +
      `(diferença: ${diff > 0 ? '+' : ''}${Math.round(diff)}g)`
    );
  }
  
  // Carboidrato: valor exato
  const carbsOK = Math.round(proposed.carbs) === Math.round(target.carbs);
  if (!carbsOK) {
    const diff = proposed.carbs - target.carbs;
    errors.push(
      `Carboidratos: ${Math.round(proposed.carbs)}g vs ${target.carbs}g ` +
      `(diferença: ${diff > 0 ? '+' : ''}${Math.round(diff)}g)`
    );
  }
  
  // Gordura: valor exato
  const fatOK = Math.round(proposed.fat) === Math.round(target.fat);
  if (!fatOK) {
    const diff = proposed.fat - target.fat;
    errors.push(
      `Gordura: ${Math.round(proposed.fat)}g vs ${target.fat}g ` +
      `(diferença: ${diff > 0 ? '+' : ''}${Math.round(diff)}g)`
    );
  }
  
  return {
    isValid: calorieOK && proteinOK && carbsOK && fatOK,
    calorieOK,
    proteinOK,
    carbsOK,
    fatOK,
    errors,
  };
}

/**
 * Verifica se um plano já está na meta exata.
 * CRÍTICO: Não confundir "já otimizado" com "não otimizável".
 */
export function isPlanAlreadyOptimized(
  current: MacroTargets,
  target: MacroTargets
): boolean {
  return (
    Math.round(current.calories) === Math.round(target.calories) &&
    Math.round(current.protein) === Math.round(target.protein) &&
    Math.round(current.carbs) === Math.round(target.carbs) &&
    Math.round(current.fat) === Math.round(target.fat)
  );
}
