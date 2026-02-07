// =====================================================
// DIAGNÓSTICOS E OBSERVABILIDADE - NUTRIAPLAN
// =====================================================
// Enums e tipos para rastreabilidade de estados internos.
// ADICIONA visibilidade sem alterar comportamento funcional.
// =====================================================

// =====================================================
// GERADOR v5.17 - ESTADOS DE GERAÇÃO
// =====================================================

/**
 * Estado do processo de geração do plano.
 * Indica se a geração prosseguiu normalmente ou entrou em modo de fallback.
 */
export enum GenerationState {
  /** Geração normal, sem intervenções de emergência */
  NORMAL = "NORMAL",
  /** Detectado travamento calórico (calorias < 88% e proteína > 98%) */
  STALL_DETECTED = "STALL_DETECTED",
  /** Injeção agressiva de carboidratos ativada após detecção de stall */
  FORCED_CARB_INJECTION = "FORCED_CARB_INJECTION",
}

/**
 * Status do limite aplicado a um alimento.
 * Indica se o limite de categoria foi expandido durante a geração.
 */
export enum LimitStatus {
  /** Limite normal da categoria aplicado */
  NORMAL = "NORMAL",
  /** Limite expandido (ex: +50% para bulk com alta demanda) */
  EXPANDED = "EXPANDED",
}

/**
 * Diagnóstico de geração para cada alimento ajustado.
 */
export interface FoodGenerationDiagnostic {
  foodId: string;
  foodName: string;
  originalGrams: number;
  finalGrams: number;
  limitStatus: LimitStatus;
  /** Limite normal da categoria (max) */
  categoryLimitNormal: number;
  /** Limite expandido aplicado (se houver) */
  categoryLimitExpanded?: number;
}

/**
 * Resultado de diagnóstico do gerador.
 */
export interface GeneratorDiagnostics {
  /** Estado final da geração */
  generationState: GenerationState;
  /** Se houve expansão de limites de categoria */
  limitsExpanded: boolean;
  /** Se houve injeção agressiva de carboidratos */
  carbInjectionApplied: boolean;
  /** Se houve fallback por travamento calórico */
  stallFallbackTriggered: boolean;
  /** Quantidade de carboidratos injetados (gramas) */
  carbsInjectedGrams: number;
  /** Alimentos com limites expandidos */
  expandedLimitFoods: FoodGenerationDiagnostic[];
  /** Iterações de escalonamento realizadas */
  scaleIterations: number;
  /** Percentual calórico pós-escala (antes do fallback) */
  postScaleCaloriePercent: number;
  /** Percentual proteico pós-escala */
  postScaleProteinPercent: number;
}

// =====================================================
// REBALANCEADOR v2 - MOTIVOS DE FALHA ESTRUTURAL
// =====================================================

/**
 * Motivo tipado para falha estrutural do rebalanceador.
 * Permite diagnóstico preciso da causa raiz.
 */
export enum StructuralFailureReason {
  /** Gordura implícita de fontes mistas não corrigível */
  IMPLICIT_FAT_OVERLOAD = "IMPLICIT_FAT_OVERLOAD",
  /** Déficit de carboidratos não resolvível com alimentos disponíveis */
  CARB_DEFICIT_UNRESOLVABLE = "CARB_DEFICIT_UNRESOLVABLE",
  /** Excesso calórico severo (>110%) não corrigível */
  CALORIC_OVERFLOW = "CALORIC_OVERFLOW",
  /** Proteína travada em limite que impede correção de outros macros */
  PROTEIN_CONSTRAINT_LOCK = "PROTEIN_CONSTRAINT_LOCK",
  /** Limite de categoria impede ajuste necessário */
  CATEGORY_LIMIT_LOCK = "CATEGORY_LIMIT_LOCK",
  /** Gordura acima de 120% (hard fail absoluto) */
  FAT_HARD_FAIL = "FAT_HARD_FAIL",
  /** Normalização era obrigatória mas não foi aplicada */
  NORMALIZATION_NOT_APPLIED = "NORMALIZATION_NOT_APPLIED",
}

/**
 * Status do refinamento final (±1g).
 */
export enum RefinementStatus {
  /** Convergiu para solução ótima */
  CONVERGED = "CONVERGED",
  /** Parou em mínimo local (não consegue melhorar) */
  LOCAL_MINIMUM = "LOCAL_MINIMUM",
  /** Parou por atingir limite de categoria */
  STOPPED_BY_LIMIT = "STOPPED_BY_LIMIT",
  /** Parou por atingir máximo de iterações */
  MAX_ITERATIONS_REACHED = "MAX_ITERATIONS_REACHED",
}

/**
 * Diagnóstico de normalização.
 */
export interface NormalizationDiagnostic {
  /** Se a normalização era obrigatória (g10Status === "ALLOW_REBALANCE") */
  normalizationRequired: boolean;
  /** Se a normalização foi de fato aplicada */
  normalizationApplied: boolean;
  /** Percentual de gordura antes da normalização */
  fatPercentBefore: number;
  /** Percentual de gordura após normalização */
  fatPercentAfter: number;
  /** Alimentos ajustados na normalização */
  adjustedFoods: Array<{
    foodId: string;
    foodName: string;
    gramsReduced: number;
    fatRemoved: number;
  }>;
}

/**
 * Resultado de diagnóstico do rebalanceador.
 */
export interface RebalancerDiagnostics {
  /** Motivo tipado se falha estrutural */
  structuralFailureReason?: StructuralFailureReason;
  /** Status do refinamento final */
  refinementStatus: RefinementStatus;
  /** Diagnóstico da normalização */
  normalization: NormalizationDiagnostic;
  /** Iterações totais do pipeline */
  totalIterations: number;
  /** Tempo de convergência em ms */
  convergenceTimeMs: number;
  /** Opções de refeição processadas */
  optionsProcessed: number;
  /** Retries automáticos executados em opções que falharam (v2.4) */
  retriesPerformed?: number;
  /** Diagnóstico de equalização calórica entre opções (v2.5) */
  calorieEqualization?: {
    /** Número de opções ajustadas */
    optionsAdjusted: number;
    /** Warnings de equalização */
    warnings: string[];
    /** Detalhes dos ajustes aplicados */
    adjustments: Array<{
      optionNumber: number;
      originalCalories: number;
      newCalories: number;
      scaleFactor: number;
    }>;
  };
  /** Diagnóstico de balanceamento de gordura entre opções (v2.7) */
  fatBalancing?: {
    /** Número de opções ajustadas */
    optionsAdjusted: number;
    /** Warnings de balanceamento */
    warnings: string[];
    /** Detalhes dos ajustes aplicados */
    adjustments: Array<{
      optionNumber: number;
      originalFat: number;
      newFat: number;
      reductions: Array<{
        foodId: string;
        foodName: string;
        oldQty: number;
        newQty: number;
      }>;
    }>;
  };
  /** Diagnóstico de boost de gordura - injeção de azeite (v2.8) */
  fatBoost?: {
    /** Número de opções que receberam boost */
    optionsBoosted: number;
    /** Warnings de boost */
    warnings: string[];
    /** Injeções de azeite aplicadas */
    injections: Array<{
      optionNumber: number;
      mealName: string;
      mealId: string;
      optionId: string;
      foodId: string;
      foodName: string;
      grams: number;
      fatAdded: number;
    }>;
  };
}

// =====================================================
// CONTRATO DE OUTPUT DO GERADOR (VALIDAÇÃO DEFENSIVA)
// =====================================================

/**
 * Contrato de output do gerador para validação defensiva.
 * O rebalanceador pode verificar se o plano recebido atende os mínimos.
 * 
 * IMPORTANTE: Este contrato NÃO altera comportamento.
 * É apenas uma proteção contra refactors futuros que possam
 * quebrar os pressupostos do rebalanceador.
 */
export const GENERATOR_OUTPUT_CONTRACT = {
  /** Calorias mínimas do plano gerado (% da meta) */
  CALORIES_MIN_PERCENT: 85,
  /** Proteína mínima do plano gerado (% da meta) */
  PROTEIN_MIN_PERCENT: 95,
  /** Gordura máxima como % das calorias totais */
  FAT_MAX_PERCENT_OF_CALORIES: 30,
  /** Carboidratos mínimos para cut/maintain (% da meta) */
  CARBS_MIN_PERCENT_DEFAULT: 90,
  /** Carboidratos mínimos para bulk (% da meta) */
  CARBS_MIN_PERCENT_BULK: 80,
} as const;

/**
 * Resultado da validação do contrato de input do rebalanceador.
 */
export interface GeneratorContractValidation {
  /** Se o plano atende o contrato */
  meetsContract: boolean;
  /** Violações encontradas (se houver) */
  violations: string[];
  /** Métricas do plano recebido */
  metrics: {
    caloriesPercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercentOfCalories: number;
  };
}

/**
 * Valida se um plano recebido atende o contrato de output do gerador.
 * Usado pelo rebalanceador como validação defensiva no início do processamento.
 * 
 * @param totals - Totais do plano recebido
 * @param targets - Metas nutricionais do perfil
 * @param objective - Objetivo do perfil (cut/maintain/bulk)
 * @returns Resultado da validação com violações detalhadas
 */
export function validateGeneratorOutputContract(
  totals: { calories: number; protein: number; carbs: number; fat: number },
  targets: { calories: number; protein: number; carbs: number; fat: number },
  objective: "cut" | "maintain" | "bulk" = "maintain"
): GeneratorContractValidation {
  const violations: string[] = [];
  
  const caloriesPercent = targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0;
  const proteinPercent = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0;
  const carbsPercent = targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0;
  
  // Fat as % of total calories
  const fatCalories = totals.fat * 9;
  const fatPercentOfCalories = totals.calories > 0 ? (fatCalories / totals.calories) * 100 : 0;
  
  // Validate calories
  if (caloriesPercent < GENERATOR_OUTPUT_CONTRACT.CALORIES_MIN_PERCENT) {
    violations.push(
      `Calorias abaixo do contrato: ${caloriesPercent.toFixed(1)}% < ${GENERATOR_OUTPUT_CONTRACT.CALORIES_MIN_PERCENT}%`
    );
  }
  
  // Validate protein
  if (proteinPercent < GENERATOR_OUTPUT_CONTRACT.PROTEIN_MIN_PERCENT) {
    violations.push(
      `Proteína abaixo do contrato: ${proteinPercent.toFixed(1)}% < ${GENERATOR_OUTPUT_CONTRACT.PROTEIN_MIN_PERCENT}%`
    );
  }
  
  // Validate carbs by objective
  const carbsMinThreshold = objective === "bulk" 
    ? GENERATOR_OUTPUT_CONTRACT.CARBS_MIN_PERCENT_BULK 
    : GENERATOR_OUTPUT_CONTRACT.CARBS_MIN_PERCENT_DEFAULT;
  
  if (carbsPercent < carbsMinThreshold) {
    violations.push(
      `Carboidratos abaixo do contrato (${objective}): ${carbsPercent.toFixed(1)}% < ${carbsMinThreshold}%`
    );
  }
  
  // Validate fat % of calories
  if (fatPercentOfCalories > GENERATOR_OUTPUT_CONTRACT.FAT_MAX_PERCENT_OF_CALORIES) {
    violations.push(
      `Gordura acima do contrato: ${fatPercentOfCalories.toFixed(1)}% das calorias > ${GENERATOR_OUTPUT_CONTRACT.FAT_MAX_PERCENT_OF_CALORIES}%`
    );
  }
  
  return {
    meetsContract: violations.length === 0,
    violations,
    metrics: {
      caloriesPercent: Math.round(caloriesPercent * 10) / 10,
      proteinPercent: Math.round(proteinPercent * 10) / 10,
      carbsPercent: Math.round(carbsPercent * 10) / 10,
      fatPercentOfCalories: Math.round(fatPercentOfCalories * 10) / 10,
    },
  };
}

// =====================================================
// FACTORY FUNCTIONS
// =====================================================

/**
 * Cria diagnóstico inicial do gerador (estado NORMAL).
 */
export function createInitialGeneratorDiagnostics(): GeneratorDiagnostics {
  return {
    generationState: GenerationState.NORMAL,
    limitsExpanded: false,
    carbInjectionApplied: false,
    stallFallbackTriggered: false,
    carbsInjectedGrams: 0,
    expandedLimitFoods: [],
    scaleIterations: 0,
    postScaleCaloriePercent: 0,
    postScaleProteinPercent: 0,
  };
}

/**
 * Cria diagnóstico inicial do rebalanceador.
 */
export function createInitialRebalancerDiagnostics(): RebalancerDiagnostics {
  return {
    refinementStatus: RefinementStatus.CONVERGED,
    normalization: {
      normalizationRequired: false,
      normalizationApplied: false,
      fatPercentBefore: 0,
      fatPercentAfter: 0,
      adjustedFoods: [],
    },
    totalIterations: 0,
    convergenceTimeMs: 0,
    optionsProcessed: 0,
  };
}
