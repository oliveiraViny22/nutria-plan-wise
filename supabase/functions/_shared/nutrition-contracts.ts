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
  /** Tolerância calórica padrão: plano deve estar dentro de ±10% */
  CALORIE_TOLERANCE_PERCENT: 10,
  
  /** Tolerância calórica para bulk de alta caloria (>3000 kcal): ±20% */
  CALORIE_TOLERANCE_PERCENT_BULK_HIGH: 20,
  
  /** Limite de calorias para considerar "bulk de alta caloria" */
  HIGH_CALORIE_BULK_THRESHOLD: 3000,
  
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
  
  /** 
   * Tolerância máxima de variância calórica entre opções de uma mesma refeição.
   * Todas as opções devem ter calorias dentro de ±5% da média.
   */
  MAX_OPTION_CALORIE_VARIANCE_PERCENT: 5,
} as const;

// =====================================================
// CONTRATOS DO REBALANCEADOR (TOLERÂNCIAS REAIS v2)
// =====================================================
// Alinhado com VALIDATION_CONSTANTS em ai-rebalance/index.ts

export const REBALANCER_CONTRACT = {
  /** Tolerância calórica: 95-105% (5% margem) */
  CALORIE_MIN_PERCENT: 95,
  CALORIE_MAX_PERCENT: 105,
  
  /** Proteína mínima: 95% para cut, 90% para outros */
  PROTEIN_MIN_PERCENT_CUT: 95,
  PROTEIN_MIN_PERCENT_DEFAULT: 90,
  
  /** Carboidratos mínimos: 90% (80% para bulk) */
  CARBS_MIN_PERCENT: 90,
  CARBS_MIN_PERCENT_BULK: 80,
  
  /** Gordura: 110% padrão, 115% tolerância clínica */
  FAT_MAX_PERCENT_STANDARD: 110,
  FAT_MAX_PERCENT_TOLERANCE: 115,
  FAT_HARD_FAIL_PERCENT: 120,
  
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

// Tipo de objetivo para validação específica
export type GeneratorObjective = "cut" | "maintain" | "bulk";

// Mapeamento de goal do perfil para objetivo do gerador
export function mapGoalToObjective(goal: string | null | undefined): GeneratorObjective {
  switch ((goal || "").toLowerCase()) {
    case "lose_weight":
    case "emagrecer":
      return "cut";
    case "gain_muscle":
    case "ganhar_massa":
      return "bulk";
    default:
      return "maintain";
  }
}

// Limites de carboidratos por objetivo no gerador
const GENERATOR_CARBS_MIN_BY_OBJECTIVE: Record<GeneratorObjective, number> = {
  cut: 90,      // 90%
  maintain: 90, // 90%
  bulk: 80,     // 80% - Bulk tem piso menor de carbs
};

/**
 * Valida se um plano gerado atende TODOS os contratos.
 * Se retornar false, o plano NÃO pode ser salvo.
 * 
 * @param objective - Objetivo do perfil (cut/maintain/bulk) para ajuste de carboidratos
 */
export function validateGeneratedPlan(
  totals: MacroTargets,
  targets: MacroTargets,
  mealProteinValues: number[],
  mainMealIndices: number[],
  objective: GeneratorObjective = "maintain"
): GeneratorValidationResult {
  const errors: string[] = [];
  
  const caloriePercent = targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0;
  const proteinPercent = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0;
  const carbsPercent = targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0;
  const fatPercentOfCals = fatPercentOfCalories(totals.fat, totals.calories);
  
  // Obter limite de carbs baseado no objetivo
  const carbsMinThreshold = GENERATOR_CARBS_MIN_BY_OBJECTIVE[objective];
  
  // Tolerância calórica: relaxada para bulk de alta caloria
  const isHighCalorieBulk = objective === "bulk" && targets.calories >= GENERATOR_CONTRACT.HIGH_CALORIE_BULK_THRESHOLD;
  const calorieTolerance = isHighCalorieBulk 
    ? GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT_BULK_HIGH 
    : GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT;
  
  // Tolerância de 0.05% para evitar falsos negativos por arredondamento de ponto flutuante
  const VALIDATION_EPSILON = 0.05;
  
  // CONTRATO 1: Calorias dentro da tolerância (dinâmica por objetivo)
  const calorieDiff = Math.abs(caloriePercent - 100);
  if (calorieDiff > calorieTolerance + VALIDATION_EPSILON) {
    errors.push(
      `[G0] Calorias fora da tolerância: ${Math.round(totals.calories)} kcal ` +
      `(${caloriePercent.toFixed(1)}% da meta, limite: ±${calorieTolerance}%${isHighCalorieBulk ? ' [bulk alta caloria]' : ''})`
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
  
  // CONTRATO 3: Carboidratos como base energética (threshold baseado no objetivo)
  if (carbsPercent < carbsMinThreshold - VALIDATION_EPSILON) {
    errors.push(
      `[G7] Carboidratos insuficientes: ${Math.round(totals.carbs)}g ` +
      `(${carbsPercent.toFixed(1)}% da meta, mínimo: ${carbsMinThreshold}% para ${objective})`
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
  if (proteinPercent < GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT - VALIDATION_EPSILON) {
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
