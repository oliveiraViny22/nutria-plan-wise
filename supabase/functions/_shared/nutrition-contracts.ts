// =====================================================
// CONTRATOS NUTRICIONAIS - EDGE FUNCTION
// =====================================================
// Contratos compartilhados entre gerador e rebalanceador.
// FONTE ÚNICA DE VERDADE para regras nutricionais.
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
// CONTRATOS DO REBALANCEADOR (SEM TOLERÂNCIAS)
// =====================================================

export const REBALANCER_CONTRACT = {
  /** SEM tolerância: deve atingir meta exata */
  CALORIE_TOLERANCE_PERCENT: 0,
  PROTEIN_TOLERANCE_PERCENT: 0,
  CARBS_TOLERANCE_PERCENT: 0,
  FAT_TOLERANCE_GRAMS: 0,
  
  /** Limites de quantidade */
  MIN_QUANTITY_GRAMS: 5,
  MAX_QUANTITY_GRAMS: 600,
} as const;

// =====================================================
// TIPOS
// =====================================================

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

// =====================================================
// FUNÇÕES DE CÁLCULO
// =====================================================

/**
 * Calcula percentual de gordura em relação às calorias.
 */
export function fatPercentOfCalories(fatGrams: number, totalCalories: number): number {
  if (totalCalories <= 0) return 0;
  const fatCalories = fatGrams * KCAL_PER_GRAM.fat;
  return (fatCalories / totalCalories) * 100;
}

// =====================================================
// VALIDAÇÃO DO GERADOR
// =====================================================

export interface GeneratorValidationResult {
  isValid: boolean;
  errors: string[];
  metrics: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    caloriePercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercentOfCals: number;
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
  
  const caloriePercent = targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0;
  const proteinPercent = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0;
  const carbsPercent = targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0;
  const fatPercentOfCals = fatPercentOfCalories(totals.fat, totals.calories);
  
  // CONTRATO 1: Calorias dentro de ±10%
  const calorieDiff = Math.abs(caloriePercent - 100);
  if (calorieDiff > GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT) {
    errors.push(
      `[G0] Calorias fora da tolerância: ${Math.round(totals.calories)} kcal ` +
      `(${caloriePercent.toFixed(1)}% da meta, limite: ±${GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT}%)`
    );
  }
  
  // CONTRATO 2: Proteína em todas as refeições principais
  for (const idx of mainMealIndices) {
    const protein = mealProteinValues[idx] || 0;
    if (protein < GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
      errors.push(
        `[G1] Refeição ${idx + 1} sem proteína suficiente: ${protein.toFixed(1)}g ` +
        `(mínimo: ${GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS}g)`
      );
    }
  }
  
  // CONTRATO 3: Carboidratos como base energética (≥90%)
  if (carbsPercent < GENERATOR_CONTRACT.MIN_CARBS_PERCENT) {
    errors.push(
      `[G7] Carboidratos insuficientes: ${Math.round(totals.carbs)}g ` +
      `(${carbsPercent.toFixed(1)}% da meta, mínimo: ${GENERATOR_CONTRACT.MIN_CARBS_PERCENT}%)`
    );
  }
  
  // CONTRATO 4: Gordura ≤30% das calorias
  if (fatPercentOfCals > GENERATOR_CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
    errors.push(
      `[G4] Gordura excessiva: ${fatPercentOfCals.toFixed(1)}% das calorias ` +
      `(máximo: ${GENERATOR_CONTRACT.MAX_FAT_PERCENT_OF_CALORIES}%)`
    );
  }
  
  // CONTRATO 5: Proteína total ≥95%
  if (proteinPercent < GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT) {
    errors.push(
      `[G1] Proteína total insuficiente: ${Math.round(totals.protein)}g ` +
      `(${proteinPercent.toFixed(1)}% da meta, mínimo: ${GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT}%)`
    );
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    metrics: {
      totalCalories: Math.round(totals.calories),
      totalProtein: Math.round(totals.protein),
      totalCarbs: Math.round(totals.carbs),
      totalFat: Math.round(totals.fat),
      caloriePercent: Math.round(caloriePercent * 10) / 10,
      proteinPercent: Math.round(proteinPercent * 10) / 10,
      carbsPercent: Math.round(carbsPercent * 10) / 10,
      fatPercentOfCals: Math.round(fatPercentOfCals * 10) / 10,
    },
  };
}
