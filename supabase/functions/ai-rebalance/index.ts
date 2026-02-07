// ============================================
// REBALANCEADOR AUTOMÁTICO NUTRIAPLAN v2.6
// ============================================
// Implementação conforme especificação:
// - Validação por objetivo (cut/maintain/bulk)
// - Pipeline de 4 etapas (ordem fixa)
// - Máximo de 3 ciclos de correção
// - Formato JSON estruturado
// - RETRY AUTOMÁTICO para opções não convergidas (v2.4)
// - EQUALIZAÇÃO CALÓRICA entre opções (v2.5)
// - VERIFICAÇÃO UPFRONT de plano já otimizado (v2.6)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  KCAL_PER_GRAM,
  REBALANCER_CONTRACT,
  GENERATOR_CONTRACT,
} from "../_shared/nutrition-contracts.ts";
import { createLogger, logAIUsage, type RebalanceMetrics } from "../_shared/logger.ts";
import { getCorsHeaders } from "../_shared/security.ts";
import { getFeatureFlag, FLAGS } from "../_shared/feature-flags.ts";
import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from "../_shared/rate-limit.ts";
import { 
  StructuralFailureReason, 
  RefinementStatus, 
  validateGeneratorOutputContract,
  createInitialRebalancerDiagnostics,
  type RebalancerDiagnostics,
  type NormalizationDiagnostic,
} from "../_shared/diagnostics.ts";

const log = createLogger('ai-rebalance');

// ============================================
// CONSTANTES OFICIAIS DE VALIDAÇÃO (PATCH FINAL)
// ============================================

const VALIDATION_CONSTANTS = {
  // Ranges nutricionais
  CALORIES_MAX: 1.05,      // 105%
  PROTEIN_MIN: 0.95,       // 95%
  CARBS_MIN: 0.90,         // 90%
  
  // Gordura
  FAT_MAX_STANDARD: 1.10,  // 110% - regra padrão
  FAT_MAX_TOLERANCE: 1.15, // 115% - tolerância clínica final
  
  // Segurança (hard fail)
  HARD_FAIL_CALORIES: 1.10, // 110%
  HARD_FAIL_FAT: 1.20,      // 120%
};

// Status de validação final
type FinalValidationStatus = "VALIDATED" | "VALIDATED_WITH_TOLERANCE" | "STRUCTURALLY_INVALID";

interface FinalValidationResult {
  status: FinalValidationStatus;
  reason?: string;
  note?: string;
  metrics: {
    caloriePercent: number;
    proteinPercent: number;
    carbPercent: number;
    fatPercent: number;
  };
}

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
    /** Motivo tipado para falha estrutural */
    failureReason?: StructuralFailureReason;
  };
  food_changes?: Array<{
    food_id: string;
    food_name: string;
    original_grams: number;
    new_grams: number;
  }>;
  // Metadados G-10 e validação final
  meta?: {
    g10Status: G10Status;
    implicitFatRatio: number;
    normalizationApplied: boolean;
    finalValidation?: FinalValidationResult;
    /** Diagnósticos detalhados do rebalanceador */
    diagnostics?: RebalancerDiagnostics;
  };
}

// ============================================
// FUNÇÃO DE VALIDAÇÃO FINAL (ÚNICA FONTE DA VERDADE)
// ============================================

interface PlanMetadata {
  g10Status?: G10Status;
  normalizationApplied?: boolean;
  objective?: Objective; // Adicionado para validação por perfil
}

// Limites de carboidratos por objetivo
const CARBS_MIN_BY_OBJECTIVE: Record<Objective, number> = {
  cut: 0.90,      // 90%
  maintain: 0.90, // 90%
  bulk: 0.80,     // 80% - Bulk tem piso menor de carbs
};

function validateFinalPlan(
  totals: MacroTargets,
  targets: MacroTargets,
  meta?: PlanMetadata
): FinalValidationResult {
  const caloriePercent = targets.calories > 0 ? totals.calories / targets.calories : 1;
  const proteinPercent = targets.protein > 0 ? totals.protein / targets.protein : 1;
  const carbPercent = targets.carbs > 0 ? totals.carbs / targets.carbs : 1;
  const fatPercent = targets.fat > 0 ? totals.fat / targets.fat : 1;

  const g10Status = meta?.g10Status;
  const normalizationApplied = meta?.normalizationApplied === true;
  const objective = meta?.objective || "maintain"; // Default para maintain

  // Obter limite de carbs baseado no objetivo
  const carbsMinThreshold = CARBS_MIN_BY_OBJECTIVE[objective];

  const metrics = {
    caloriePercent: Math.round(caloriePercent * 1000) / 10,
    proteinPercent: Math.round(proteinPercent * 1000) / 10,
    carbPercent: Math.round(carbPercent * 1000) / 10,
    fatPercent: Math.round(fatPercent * 1000) / 10,
  };

  // 1️⃣ HARD FAIL ABSOLUTO
  if (
    caloriePercent > VALIDATION_CONSTANTS.HARD_FAIL_CALORIES ||
    fatPercent > VALIDATION_CONSTANTS.HARD_FAIL_FAT
  ) {
    console.log(`[VALIDAÇÃO FINAL] ❌ HARD FAIL - Calorias: ${metrics.caloriePercent}%, Gordura: ${metrics.fatPercent}%`);
    return {
      status: "STRUCTURALLY_INVALID",
      reason: caloriePercent > VALIDATION_CONSTANTS.HARD_FAIL_CALORIES
        ? `Excesso severo de calorias (${metrics.caloriePercent}% > ${VALIDATION_CONSTANTS.HARD_FAIL_CALORIES * 100}%)`
        : `Excesso severo de gordura (${metrics.fatPercent}% > ${VALIDATION_CONSTANTS.HARD_FAIL_FAT * 100}%)`,
      metrics,
    };
  }

  // Aplicar EPSILON para evitar falsos negativos por arredondamento
  const CARB_EPSILON = 0.0005; // 0.05%

  // 2️⃣ CASO NORMAL (G-10 PASS)
  if (g10Status === "PASS" || !g10Status) {
    if (
      caloriePercent <= VALIDATION_CONSTANTS.CALORIES_MAX &&
      proteinPercent >= VALIDATION_CONSTANTS.PROTEIN_MIN &&
      carbPercent >= carbsMinThreshold - CARB_EPSILON && // Usa threshold por objetivo + epsilon
      fatPercent <= VALIDATION_CONSTANTS.FAT_MAX_STANDARD
    ) {
      console.log(`[VALIDAÇÃO FINAL] ✅ VALIDATED (G-10 PASS, objetivo: ${objective})`);
      return { status: "VALIDATED", metrics };
    }
  }

  // 3️⃣ CASO AJUSTÁVEL (G-10 ALLOW_REBALANCE)
  if (g10Status === "ALLOW_REBALANCE") {
    if (!normalizationApplied) {
      console.log(`[VALIDAÇÃO FINAL] ❌ STRUCTURALLY_INVALID - Normalização era obrigatória`);
      return {
        status: "STRUCTURALLY_INVALID",
        reason: "Normalization was required but not applied",
        metrics,
      };
    }

    if (
      caloriePercent <= VALIDATION_CONSTANTS.CALORIES_MAX &&
      proteinPercent >= VALIDATION_CONSTANTS.PROTEIN_MIN &&
      carbPercent >= carbsMinThreshold - CARB_EPSILON && // Usa threshold por objetivo + epsilon
      fatPercent <= VALIDATION_CONSTANTS.FAT_MAX_TOLERANCE
    ) {
      const isWithTolerance = fatPercent > VALIDATION_CONSTANTS.FAT_MAX_STANDARD;
      if (isWithTolerance) {
        console.log(`[VALIDAÇÃO FINAL] ⚠️ VALIDATED_WITH_TOLERANCE - Gordura: ${metrics.fatPercent}% (objetivo: ${objective})`);
        return {
          status: "VALIDATED_WITH_TOLERANCE",
          note: `Validado sob tolerância clínica de gordura (${metrics.fatPercent}% ≤ ${VALIDATION_CONSTANTS.FAT_MAX_TOLERANCE * 100}%)`,
          metrics,
        };
      } else {
        console.log(`[VALIDAÇÃO FINAL] ✅ VALIDATED (G-10 ALLOW_REBALANCE com normalização, objetivo: ${objective})`);
        return { status: "VALIDATED", metrics };
      }
    }
  }

  // 4️⃣ FALHA PADRÃO
  const reasons: string[] = [];
  if (caloriePercent > VALIDATION_CONSTANTS.CALORIES_MAX) {
    reasons.push(`Calorias ${metrics.caloriePercent}% > ${VALIDATION_CONSTANTS.CALORIES_MAX * 100}%`);
  }
  if (proteinPercent < VALIDATION_CONSTANTS.PROTEIN_MIN) {
    reasons.push(`Proteína ${metrics.proteinPercent}% < ${VALIDATION_CONSTANTS.PROTEIN_MIN * 100}%`);
  }
  // Usar CARB_EPSILON já declarado acima
  if (carbPercent < carbsMinThreshold - CARB_EPSILON) {
    reasons.push(`Carboidratos ${metrics.carbPercent}% < ${carbsMinThreshold * 100}% (${objective})`);
  }
  if (fatPercent > VALIDATION_CONSTANTS.FAT_MAX_TOLERANCE) {
    reasons.push(`Gordura ${metrics.fatPercent}% > ${VALIDATION_CONSTANTS.FAT_MAX_TOLERANCE * 100}%`);
  }

  console.log(`[VALIDAÇÃO FINAL] ❌ STRUCTURALLY_INVALID - ${reasons.join(", ")}`);
  return {
    status: "STRUCTURALLY_INVALID",
    reason: `Final validation criteria not met: ${reasons.join("; ")}`,
    metrics,
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

// Configurações carregadas por request (sem cache global para evitar dados stale em serverless)
async function loadOptimizerSettings(supabase: any): Promise<OptimizerSettings> {
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
      const loadedSettings = { ...DEFAULT_OPTIMIZER_SETTINGS, ...(data.value as object) };
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
  // IMPORTANTE: Proteína mínima de 95% para TODOS os perfis (alinhado com gerador)
  let rules: ObjectiveRules;
  
  switch (objective) {
    case "cut":
      rules = {
        calories: { min: 90, max: 100 }, // Piso de 90% para segurança nutricional
        protein: { min: 95 }, // Alinhado com GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT
        carbs: { min: 90 }, // Carboidratos também validados para Cut
        fat: { max: settings.fat_ceiling },
      };
      break;
    case "bulk":
      rules = {
        calories: { min: 100 - settings.calories_tolerance, max: 100 + settings.calories_tolerance },
        protein: { min: 90 }, // Bulk pode ter piso um pouco menor
        carbs: { min: 80 }, // Bulk tem piso menor de carbs
        fat: { max: settings.fat_ceiling + 10 }, // Bulk permite mais gordura
      };
      break;
    case "maintain":
    default:
      rules = {
        calories: { min: 100 - settings.calories_tolerance, max: 100 + settings.calories_tolerance },
        protein: { min: 95 }, // Alinhado com GENERATOR_CONTRACT.MIN_PROTEIN_PERCENT
        carbs: { min: 90 }, // Carboidratos também validados para Maintain
        fat: { max: settings.fat_ceiling + 5 }, // Manutenção também tem limite de gordura
      };
      break;
  }
  
  return rules;
}

// ============================================
// LOGGING ESTRUTURADO POR PERFIL
// ============================================

function logProfileRules(objective: Objective, rules: ObjectiveRules, settings: OptimizerSettings): void {
  const profileNames: Record<Objective, string> = {
    cut: "EMAGRECER (Cut)",
    maintain: "MANTER (Maintain)", 
    bulk: "GANHAR MASSA (Bulk)",
  };
  
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  PERFIL NUTRICIONAL: ${profileNames[objective].padEnd(36)}   ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  REGRAS APLICADAS:                                           ║`);
  console.log(`║  ├─ Calorias: ${rules.calories.min}% - ${rules.calories.max}%`.padEnd(63) + `║`);
  console.log(`║  ├─ Proteína mín: ${rules.protein.min}%`.padEnd(63) + `║`);
  if (rules.carbs) {
    console.log(`║  ├─ Carboidratos mín: ${rules.carbs.min}%`.padEnd(63) + `║`);
  }
  if (rules.fat) {
    console.log(`║  └─ Gordura máx: ${rules.fat.max}%`.padEnd(63) + `║`);
  } else {
    console.log(`║  └─ Gordura máx: sem limite`.padEnd(63) + `║`);
  }
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  CONFIGURAÇÕES DO ADMIN:                                     ║`);
  console.log(`║  ├─ Protein Floor: ${settings.protein_floor}%`.padEnd(63) + `║`);
  console.log(`║  ├─ Protein Ceiling: ${settings.protein_ceiling}%`.padEnd(63) + `║`);
  console.log(`║  ├─ Carbs Floor: ${settings.carbs_floor}%`.padEnd(63) + `║`);
  console.log(`║  ├─ Fat Ceiling: ${settings.fat_ceiling}%`.padEnd(63) + `║`);
  console.log(`║  └─ Calories Tolerance: ±${settings.calories_tolerance}%`.padEnd(63) + `║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
}

function logPipelineStage(stage: number, name: string, before: MacroTargets, after: MacroTargets, targets: MacroTargets): void {
  const beforePercents = calculatePercents(before, targets);
  const afterPercents = calculatePercents(after, targets);
  
  const calDelta = afterPercents.calories - beforePercents.calories;
  const protDelta = afterPercents.protein - beforePercents.protein;
  const fatDelta = afterPercents.fat - beforePercents.fat;
  
  console.log(`┌─────────────────────────────────────────────────────────────┐`);
  console.log(`│ ETAPA ${stage}: ${name.padEnd(48)} │`);
  console.log(`├─────────────────────────────────────────────────────────────┤`);
  console.log(`│ Antes  → Cal: ${beforePercents.calories.toFixed(1)}%, Prot: ${beforePercents.protein.toFixed(1)}%, Fat: ${beforePercents.fat.toFixed(1)}%`.padEnd(62) + `│`);
  console.log(`│ Depois → Cal: ${afterPercents.calories.toFixed(1)}%, Prot: ${afterPercents.protein.toFixed(1)}%, Fat: ${afterPercents.fat.toFixed(1)}%`.padEnd(62) + `│`);
  console.log(`│ Delta  → Cal: ${calDelta >= 0 ? '+' : ''}${calDelta.toFixed(1)}pp, Prot: ${protDelta >= 0 ? '+' : ''}${protDelta.toFixed(1)}pp, Fat: ${fatDelta >= 0 ? '+' : ''}${fatDelta.toFixed(1)}pp`.padEnd(62) + `│`);
  console.log(`└─────────────────────────────────────────────────────────────┘`);
}

function logFinalResult(objective: Objective, totals: MacroTargets, targets: MacroTargets, iterations: number, converged: boolean): void {
  const percents = calculatePercents(totals, targets);
  const status = converged ? "✅ CONVERGIDO" : "⚠️ NÃO CONVERGIU";
  
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTADO FINAL                                             ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  Status: ${status}`.padEnd(63) + `║`);
  console.log(`║  Iterações: ${iterations}`.padEnd(63) + `║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  MACROS FINAIS:                                              ║`);
  console.log(`║  ├─ Calorias: ${totals.calories.toFixed(0)} kcal (${percents.calories.toFixed(1)}%)`.padEnd(63) + `║`);
  console.log(`║  ├─ Proteína: ${totals.protein.toFixed(1)}g (${percents.protein.toFixed(1)}%)`.padEnd(63) + `║`);
  console.log(`║  ├─ Carboidratos: ${totals.carbs.toFixed(1)}g (${percents.carbs.toFixed(1)}%)`.padEnd(63) + `║`);
  console.log(`║  └─ Gordura: ${totals.fat.toFixed(1)}g (${percents.fat.toFixed(1)}%)`.padEnd(63) + `║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
}

// ============================================
// LIMITES DE QUANTIDADE POR CATEGORIA
// Importado da fonte centralizada
// ============================================

import { getCategoryLimits, getScaleLimits } from "../_shared/category-limits.ts";

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

  // Tolerância EPSILON para evitar falsos negativos por arredondamento
  const VALIDATION_EPSILON = 0.05;

  // CALORIAS - regra HARD (fora = plano INVÁLIDO)
  if (percents.calories < rules.calories.min - VALIDATION_EPSILON || percents.calories > rules.calories.max + VALIDATION_EPSILON) {
    errors.push(
      `Calorias em ${percents.calories.toFixed(1)}% - fora do range [${rules.calories.min}%, ${rules.calories.max}%]`
    );
  }

  // PROTEÍNA - mínimo obrigatório
  if (percents.protein < rules.protein.min - VALIDATION_EPSILON) {
    errors.push(
      `Proteína em ${percents.protein.toFixed(1)}% - abaixo do mínimo ${rules.protein.min}%`
    );
  }

  // CARBOIDRATOS - para todos os perfis (threshold baseado no objetivo)
  // Cut/Maintain: 90%, Bulk: 80%
  const carbsMinThreshold = rules.carbs?.min || 90;
  if (percents.carbs < carbsMinThreshold - VALIDATION_EPSILON) {
    errors.push(
      `Carboidratos em ${percents.carbs.toFixed(1)}% - abaixo do mínimo ${carbsMinThreshold}%`
    );
  }

  // GORDURA - máximo
  if (rules.fat && percents.fat > rules.fat.max + VALIDATION_EPSILON) {
    errors.push(
      `Gordura em ${percents.fat.toFixed(1)}% - acima do máximo ${rules.fat.max}%`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// EQUALIZAÇÃO CALÓRICA ENTRE OPÇÕES (v2.5)
// Garante que opções 2 e 3 tenham ±5% de calorias da opção 1
// ============================================

interface EqualizationResult {
  adjusted: number;
  warnings: string[];
  adjustments: Array<{
    optionNumber: number;
    originalCalories: number;
    newCalories: number;
    scaleFactor: number;
  }>;
}

/**
 * Equaliza as calorias entre opções do plano.
 * Usa a Opção 1 como referência e escala as opções 2/3 proporcionalmente.
 * 
 * @param optionResults - Resultados de todas as opções processadas
 * @param targets - Metas de macros
 * @returns Resultado da equalização com ajustes aplicados
 */
function equalizeOptionCalories(
  optionResults: Array<{
    optionNumber: number;
    foods: FoodWithMeta[];
    finalQuantities: Map<string, number>;
    finalTotals: MacroTargets;
  }>,
  targets: MacroTargets
): EqualizationResult {
  const MAX_VARIANCE = GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT / 100; // 0.05
  const warnings: string[] = [];
  const adjustments: EqualizationResult['adjustments'] = [];
  let totalAdjusted = 0;

  // Encontrar opção 1 como referência
  const referenceOption = optionResults.find(r => r.optionNumber === 1);
  if (!referenceOption) {
    console.log("[EQUALIZAÇÃO] Opção 1 não encontrada, pulando equalização");
    return { adjusted: 0, warnings: [], adjustments: [] };
  }

  const referenceCalories = referenceOption.finalTotals.calories;
  if (referenceCalories <= 0) {
    console.log("[EQUALIZAÇÃO] Calorias de referência zeradas, pulando equalização");
    return { adjusted: 0, warnings: [], adjustments: [] };
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  EQUALIZAÇÃO CALÓRICA ENTRE OPÇÕES (v2.5)                     ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  Referência (Opção 1): ${referenceCalories.toFixed(0)} kcal`.padEnd(63) + `║`);
  console.log(`║  Tolerância: ±${GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT}%`.padEnd(63) + `║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  // Processar opções 2 e 3
  for (const option of optionResults) {
    if (option.optionNumber === 1) continue; // Pular referência

    const currentCalories = option.finalTotals.calories;
    const variance = Math.abs(currentCalories - referenceCalories) / referenceCalories;

    // Se já está dentro da tolerância, pular
    if (variance <= MAX_VARIANCE) {
      console.log(`[EQUALIZAÇÃO] Opção ${option.optionNumber}: ${currentCalories.toFixed(0)} kcal (${(variance * 100).toFixed(1)}% variância) ✓ OK`);
      continue;
    }

    // Calcular fator de escala
    const scaleFactor = referenceCalories / currentCalories;

    console.log(`[EQUALIZAÇÃO] Opção ${option.optionNumber}: ${currentCalories.toFixed(0)} kcal (${(variance * 100).toFixed(1)}% variância) → aplicando escala ${scaleFactor.toFixed(3)}`);

    // Aplicar escala proporcional a todos os alimentos
    for (const food of option.foods) {
      const currentQty = option.finalQuantities.get(food.id) || food.quantity_grams;
      const category = (food.food.category || "").toLowerCase();
      
      // Usar limites de categoria para clamping
      const limits = getCategoryLimitsForRebalancer(category);
      
      // Calcular nova quantidade arredondada para múltiplo de 5
      const rawNewQty = currentQty * scaleFactor;
      const newQty = Math.round(rawNewQty / 5) * 5;
      const clampedQty = Math.max(limits.min, Math.min(limits.max, newQty));
      
      option.finalQuantities.set(food.id, clampedQty);
    }

    // Recalcular totais após ajuste
    const newTotals = calculateTotals(option.foods, option.finalQuantities);
    const newVariance = Math.abs(newTotals.calories - referenceCalories) / referenceCalories;

    adjustments.push({
      optionNumber: option.optionNumber,
      originalCalories: currentCalories,
      newCalories: newTotals.calories,
      scaleFactor,
    });

    // Atualizar totais no resultado
    option.finalTotals.calories = newTotals.calories;
    option.finalTotals.protein = newTotals.protein;
    option.finalTotals.carbs = newTotals.carbs;
    option.finalTotals.fat = newTotals.fat;

    totalAdjusted++;

    if (newVariance > MAX_VARIANCE) {
      warnings.push(
        `Opção ${option.optionNumber} não pôde ser totalmente equalizada: ${newTotals.calories.toFixed(0)} kcal ` +
        `(${(newVariance * 100).toFixed(1)}% variância, máximo: ${GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT}%)`
      );
      console.log(`[EQUALIZAÇÃO] ⚠️ Opção ${option.optionNumber}: ${newTotals.calories.toFixed(0)} kcal (${(newVariance * 100).toFixed(1)}% variância) - não totalmente equalizada`);
    } else {
      console.log(`[EQUALIZAÇÃO] ✓ Opção ${option.optionNumber}: ${newTotals.calories.toFixed(0)} kcal (${(newVariance * 100).toFixed(1)}% variância) - equalizada`);
    }
  }

  if (totalAdjusted > 0) {
    console.log(`\n[EQUALIZAÇÃO] Concluído: ${totalAdjusted} opção(ões) ajustada(s)${warnings.length > 0 ? `, ${warnings.length} warning(s)` : ''}\n`);
  }

  return { adjusted: totalAdjusted, warnings, adjustments };
}

/**
 * Obtém limites de categoria para o rebalanceador.
 * Simplificado para uso no contexto do rebalanceador.
 */
function getCategoryLimitsForRebalancer(category: string): { min: number; max: number } {
  const normalizedCategory = category.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Limites padrão por categoria (alinhados com category-limits.ts)
  const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
    "proteinas": { min: 50, max: 400 },
    "carboidratos": { min: 30, max: 500 },
    "gorduras": { min: 5, max: 30 },
    "vegetais": { min: 30, max: 300 },
    "frutas": { min: 50, max: 300 },
    "laticinios": { min: 50, max: 400 },
    "leguminosas": { min: 30, max: 250 },
    "oleaginosas": { min: 10, max: 50 },
    "ovos": { min: 50, max: 200 },
    "peixes": { min: 80, max: 400 },
    "cereais": { min: 30, max: 200 },
    "tuberculos": { min: 50, max: 400 },
  };
  
  return CATEGORY_LIMITS[normalizedCategory] || { min: 20, max: 500 };
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
  maxIterations: number = 200,
  objective: Objective = "maintain" // NOVO: objetivo para pesos dinâmicos
): { quantities: Map<string, number>; iterations: number; converged: boolean; refinementStatus: RefinementStatus } {
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

  // CORREÇÃO: Pesos dinâmicos baseados no objetivo
  // Bulk prioriza carboidratos, Cut prioriza proteína
  const WEIGHTS = objective === "bulk" 
    ? { calories: 1.0, protein: 2.0, carbs: 2.5, fat: 0.5 }  // Bulk prioriza carbs
    : objective === "cut"
    ? { calories: 1.5, protein: 3.0, carbs: 1.0, fat: 0.5 }  // Cut prioriza proteína
    : { calories: 1.0, protein: 3.0, carbs: 1.0, fat: 1.0 }; // Maintain

  console.log(`[REFINAMENTO] Pesos para ${objective}: Cal=${WEIGHTS.calories}, Prot=${WEIGHTS.protein}, Carb=${WEIGHTS.carbs}, Fat=${WEIGHTS.fat}`);

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
      return { quantities, iterations, converged: true, refinementStatus: RefinementStatus.CONVERGED };
    }

    // Calcular erro total ponderado
    const totalError = 
      Math.abs(errors.calories) / targets.calories * WEIGHTS.calories +
      Math.abs(errors.protein) / targets.protein * WEIGHTS.protein +
      Math.abs(errors.carbs) / targets.carbs * WEIGHTS.carbs +
      Math.abs(errors.fat) / targets.fat * WEIGHTS.fat;

    // Detectar se estamos presos (mínimo local)
    if (Math.abs(totalError - lastError) < 0.0001) {
      stuckCounter++;
      if (stuckCounter > 10) {
        console.log(`[HARD] Algoritmo preso após ${iterations} iterações (mínimo local)`);
        return { quantities, iterations, converged: false, refinementStatus: RefinementStatus.LOCAL_MINIMUM };
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
    // CORREÇÃO: Proteção de proteína mais flexível - só proteger se déficit real
    // Antes: proteinIsProtected = errors.protein <= 2 (bloqueava ajustes com 102% de proteína)
    const proteinIsProtected = errors.protein < PRECISION.protein; // Só proteger se abaixo da meta

    for (const food of foods) {
      const contrib = contributions.get(food.id);
      if (!contrib) continue;

      const currentGrams = quantities.get(food.id) || food.quantity_grams;
      // CORREÇÃO: Usar getScaleLimits para permitir porções maiores durante refinamento
      const limits = getScaleLimits(food.food.category);
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
  
  // Se chegou ao fim do loop sem convergir, pode ter sido por limite de iterações
  return { 
    quantities, 
    iterations, 
    converged: false, 
    refinementStatus: iterations >= maxIterations ? RefinementStatus.MAX_ITERATIONS_REACHED : RefinementStatus.STOPPED_BY_LIMIT 
  };
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
    /** Motivo tipado para falha estrutural */
    failureReason?: StructuralFailureReason;
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
          // CORREÇÃO: Usar getScaleLimits para permitir porções maiores durante ajustes
          const limits = getScaleLimits(food.food.category);
          
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
          // CORREÇÃO: Usar getScaleLimits para proteínas
          const limits = getScaleLimits(food.food.category);

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
    // ETAPA 3: CARBOIDRATOS
    // ==========================================
    // CORREÇÃO: Aplicar para todos os perfis quando carbs < 90% (não apenas Bulk)
    // Para Bulk: usa rules.carbs.min (80%), para outros: 90% do target
    const carbsMinThreshold = rules.carbs?.min || 90;
    if (afterProteinPercents.carbs < carbsMinThreshold) {
      const carbsNeeded = (targets.carbs * carbsMinThreshold / 100) - afterProtein.carbs;

      if (carbsNeeded > 5) {
        let remainingCarbsNeeded = carbsNeeded;
        
        for (const food of carbFoods) {
          if (remainingCarbsNeeded <= 0) break;

          const contrib = contributions.get(food.id)!;
          if (contrib.carbs <= 0) continue;

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          // CORREÇÃO: Usar getScaleLimits para carboidratos (maior headroom para bulk)
          const limits = getScaleLimits(food.food.category);

          const gramsNeeded = (remainingCarbsNeeded * 100) / contrib.carbs;
          const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams);

          if (gramsToAdd < 10) continue;

          const newGrams = Math.min(limits.max, currentGrams + gramsToAdd);
          const actualGramsAdded = newGrams - currentGrams;
          quantities.set(food.id, Math.round(newGrams));
          
          // CORREÇÃO: Atualizar carbsNeeded a cada iteração
          const carbsAdded = (actualGramsAdded / 100) * contrib.carbs;
          remainingCarbsNeeded -= carbsAdded;
          console.log(`Etapa 3: +${Math.round(actualGramsAdded)}g ${food.food.name} (+${carbsAdded.toFixed(1)}g carbs)`);
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
          // PROTEÇÃO DE PROTEÍNA - REGRA CRÍTICA (v5.5 ATUALIZADA)
          // ============================================
          // Proteger alimentos onde proteína domina gordura
          // NÃO proteger alimentos onde gordura >= proteína (ex: oleaginosas, pastas)
          const fatDominant = contrib.fat >= contrib.protein;
          if (contrib.protein >= 10 && !fatDominant) {
            console.log(`[GORDURA] Protegendo ${food.food.name} (${contrib.protein.toFixed(1)}g prot/100g, gordura não dominante)`);
            continue;
          }
          
          // Log para alimentos com gordura dominante que serão reduzidos
          if (fatDominant && contrib.protein >= 10) {
            console.log(`[GORDURA] Não protegendo ${food.food.name} - gordura dominante (fat=${contrib.fat.toFixed(1)}g > prot=${contrib.protein.toFixed(1)}g)`);
          }

          const currentGrams = quantities.get(food.id) || food.quantity_grams;
          // Usar limites padrão para redução de gordura (não escala)
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
      
      // Identificar fontes mistas de alta densidade lipídica
      // Critério: ≥8g gordura/100g E ≥15g proteína/100g
      // v5.5: Incluir também oleaginosas/pastas onde gordura > proteína
      const mixedFatSources = foods.filter(f => {
        const contrib = contributions.get(f.id)!;
        const cat = (f.food.category || "").toLowerCase();
        
        // Fontes mistas tradicionais (proteína + gordura moderada)
        const isMixedSource = contrib.fat >= 8 && contrib.protein >= 15;
        
        // v5.5: Oleaginosas/pastas (gordura domina proteína)
        const isFatDominant = contrib.fat >= contrib.protein && contrib.fat >= 20;
        const isOleaginosa = cat === "oleaginosas" || cat.includes("oleaginosa");
        
        return isMixedSource || (isFatDominant && (isOleaginosa || contrib.protein >= 10));
      });
      
      console.log(`[ETAPA 4.5] Fontes mistas identificadas: ${mixedFatSources.length}`);
      
      if (mixedFatSources.length > 0) {
        // Ordenar por densidade de gordura (maior primeiro)
        // v5.5: Priorizar alimentos onde gordura > proteína
        mixedFatSources.sort((a, b) => {
          const contribA = contributions.get(a.id)!;
          const contribB = contributions.get(b.id)!;
          
          // Priorizar alimentos onde gordura domina
          const fatDominantA = contribA.fat >= contribA.protein ? 1 : 0;
          const fatDominantB = contribB.fat >= contribB.protein ? 1 : 0;
          
          if (fatDominantB !== fatDominantA) {
            return fatDominantB - fatDominantA; // Fat dominant primeiro
          }
          
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
          // CORREÇÃO: Usar getScaleLimits para consistência com outras etapas
          const limits = getScaleLimits(food.food.category);
          
          // v5.5: Permitir redução mais agressiva para alimentos onde gordura domina
          const fatDominant = contrib.fat >= contrib.protein;
          const minKeepRatio = fatDominant ? 0.3 : 0.6; // 30% para gordura dominante, 60% para outros
          
          // Calcular quanto podemos reduzir
          const minToKeep = Math.max(limits.min, currentGrams * minKeepRatio);
          const maxReduction = currentGrams - minToKeep;
          
          if (maxReduction < 5) continue;
          
          // Calcular redução necessária para remover gordura
          const fatPerGram = contrib.fat / 100;
          const proteinPerGram = contrib.protein / 100;
          const gramsToRemoveForFat = remainingExcess / fatPerGram;
          const actualReduction = Math.min(gramsToRemoveForFat, maxReduction);
          
          if (actualReduction < 5) continue;
          
          // v5.5: Verificação de proteína mais flexível para alimentos onde gordura domina
          const proteinLost = actualReduction * proteinPerGram;
          const newProteinTotal = preNormalizationTotals.protein - proteinLost;
          const newProteinPercent = (newProteinTotal / targets.protein) * 100;
          
          // Permitir redução se:
          // 1. Proteína fica acima de 95%
          // 2. OU gordura domina e proteína fica acima de 90%
          const minProteinThreshold = fatDominant ? 90 : 95;
          
          if (newProteinPercent < minProteinThreshold) {
            console.log(`[ETAPA 4.5] Pulando ${food.food.name} - reduziria proteína para ${newProteinPercent.toFixed(1)}% (min: ${minProteinThreshold}%)`);
            continue;
          }
          
          const newGrams = Math.round(currentGrams - actualReduction);
          quantities.set(food.id, newGrams);
          
          const fatRemoved = actualReduction * fatPerGram;
          remainingExcess -= fatRemoved;
          
          console.log(`[ETAPA 4.5] Estratégia A: -${Math.round(actualReduction)}g ${food.food.name} (-${fatRemoved.toFixed(1)}g gordura, -${(actualReduction * proteinPerGram).toFixed(1)}g proteína)${fatDominant ? ' [gordura dominante]' : ''}`);
          
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
        
        // VALIDAÇÃO CRÍTICA: Se ainda excede limites SEVEROS (tolerância clínica), INTERROMPER FLUXO
        // Usa FAT_MAX_TOLERANCE (115%) em vez de FAT_MAX_STANDARD (110%) para evitar falsos positivos
        const fatTolerancePercent = VALIDATION_CONSTANTS.FAT_MAX_TOLERANCE * 100; // 115%
        const caloriesTolerancePercent = VALIDATION_CONSTANTS.HARD_FAIL_CALORIES * 100; // 110%
        
        if (afterNormPercents.fat > fatTolerancePercent || afterNormPercents.calories > caloriesTolerancePercent) {
          console.error(`[ETAPA 4.5] ❌ STRUCTURALLY_INVALID - Fluxo interrompido`);
          console.error(`[ETAPA 4.5] Gordura: ${afterNormPercents.fat.toFixed(1)}% (limite tolerância: ${fatTolerancePercent}%)`);
          console.error(`[ETAPA 4.5] Calorias: ${afterNormPercents.calories.toFixed(1)}% (limite: ${caloriesTolerancePercent}%)`);
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
              // =====================================================
              // DIAGNÓSTICO: Motivo tipado para falha estrutural
              // =====================================================
              failureReason: afterNormPercents.fat > fatTolerancePercent 
                ? StructuralFailureReason.IMPLICIT_FAT_OVERLOAD 
                : StructuralFailureReason.CALORIC_OVERFLOW,
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
    // ETAPA 4.6: CARB-FIRST LOGIC (BULK ONLY)
    // ==========================================
    // NO BULK: Calorias extras DEVEM vir primeiro de carboidratos.
    // Gordura só pode ser usada quando carboidratos já estiverem ≥100% da meta.
    // Isso define prioridade energética, não substitui carbs ≥ 80%.
    //
    // REGRA CANÔNICA: Em bulk, quem cresce é o carbo.
    // A gordura só entra quando o carbo já fez o trabalho.
    
    const beforeCarbFirst = calculateTotals(foods, quantities);
    const beforeCarbFirstPercents = calculatePercents(beforeCarbFirst, targets);
    
    const BULK_CARB_FIRST_THRESHOLD = 100; // 100% da meta
    const BULK_CARB_MAX = 110; // Não empurrar carbs além de 110%
    
    if (objective === "bulk") {
      const caloriesPercent = beforeCarbFirstPercents.calories;
      const carbsPercent = beforeCarbFirstPercents.carbs;
      
      console.log(`[ETAPA 4.6] BULK Carb-First: Cal=${caloriesPercent.toFixed(1)}%, Carbs=${carbsPercent.toFixed(1)}%`);
      
      // CORREÇÃO: Priorizar carbs mesmo se calorias já suficientes, desde que carbs < 100%
      // Isso garante que em bulk, carboidratos sejam a fonte primária de energia
      if (carbsPercent < BULK_CARB_FIRST_THRESHOLD) {
        console.log(`[ETAPA 4.6] Aplicando carb-first: aumentando carboidratos antes de permitir gordura`);
        
        // Calcular calorias faltantes
        const targetCalories = targets.calories * 0.95; // Mínimo aceitável
        const caloriesNeeded = targetCalories - beforeCarbFirst.calories;
        
        // Calcular quanto carbs podemos adicionar sem ultrapassar 110%
        const maxCarbsGrams = targets.carbs * (BULK_CARB_MAX / 100);
        const carbsToAdd = Math.min(
          (caloriesNeeded / KCAL_PER_GRAM.carbs), // Gramas de carb para calorias necessárias
          maxCarbsGrams - beforeCarbFirst.carbs   // Margem até 110%
        );
        
        if (carbsToAdd > 5) {
          // Distribuir entre alimentos de carboidrato
          let remainingCarbsToAdd = carbsToAdd;
          
          for (const food of carbFoods) {
            if (remainingCarbsToAdd <= 2) break;
            
            const contrib = contributions.get(food.id)!;
            if (contrib.carbs <= 0) continue;
            
            const currentGrams = quantities.get(food.id) || food.quantity_grams;
            // CORREÇÃO: Usar getScaleLimits para Carb-First em Bulk
            const limits = getScaleLimits(food.food.category);
            
            // Quanto gramas adicionar para atingir os carbs desejados
            const gramsNeeded = (remainingCarbsToAdd * 100) / contrib.carbs;
            const gramsToAdd = Math.min(gramsNeeded, limits.max - currentGrams);
            
            if (gramsToAdd < 5) continue;
            
            const newGrams = Math.min(limits.max, Math.round(currentGrams + gramsToAdd));
            quantities.set(food.id, newGrams);
            
            const carbsAdded = (gramsToAdd / 100) * contrib.carbs;
            const calsAdded = (gramsToAdd / 100) * contrib.calories;
            remainingCarbsToAdd -= carbsAdded;
            
            console.log(`[ETAPA 4.6] +${Math.round(gramsToAdd)}g ${food.food.name} (+${carbsAdded.toFixed(1)}g carbs, +${Math.round(calsAdded)}kcal)`);
            
            adjustments.push({
              nutrient: "carbs",
              action: "increase",
              delta: `+${Math.round(gramsToAdd)}g ${food.food.name} (carb-first)`,
            });
          }
          
          const afterCarbFirst = calculateTotals(foods, quantities);
          const afterCarbFirstPercents = calculatePercents(afterCarbFirst, targets);
          
          console.log(`[ETAPA 4.6] Resultado: Cal=${afterCarbFirstPercents.calories.toFixed(1)}%, Carbs=${afterCarbFirstPercents.carbs.toFixed(1)}%`);
        } else {
          console.log(`[ETAPA 4.6] Pouco espaço para adicionar carbs (${carbsToAdd.toFixed(1)}g) - prosseguindo`);
        }
      } else if (caloriesPercent >= 95) {
        console.log(`[ETAPA 4.6] Calorias já suficientes (${caloriesPercent.toFixed(1)}%) - carb-first não necessário`);
      } else if (carbsPercent >= BULK_CARB_FIRST_THRESHOLD) {
        console.log(`[ETAPA 4.6] Carbs já ≥100% (${carbsPercent.toFixed(1)}%) - gordura permitida se necessário`);
      }
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
    // - BULK: Carboidratos devem estar ≥100% da meta (carb-first rule)
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
      
      // BULK CARB-FIRST: Só permite gordura se carboidratos já estiverem ≥100%
      const carbFirstOk = objective !== "bulk" || afterFatPercents.carbs >= BULK_CARB_FIRST_THRESHOLD;

      if (proteinOk && carbsOk && caloriesLow && carbFirstOk) {
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
          // Usar limites padrão para gordura (porções pequenas)
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
  const corsHeaders = getCorsHeaders(req);
  const startTime = performance.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Helper para logar métricas de rebalanceamento
  // deno-lint-ignore no-explicit-any
  const logRebalanceMetrics = async (
    supabaseClient: any,
    userId: string,
    metrics: RebalanceMetrics
  ) => {
    await logAIUsage(supabaseClient, {
      userId,
      functionName: 'ai-rebalance',
      model: 'internal/rebalancer',
      success: metrics.status !== 'error' && metrics.status !== 'structurally_invalid',
      metadata: {
        iterations: metrics.iterations,
        convergenceTimeMs: metrics.convergenceTimeMs,
        status: metrics.status,
        objective: metrics.objective,
        g10Status: metrics.g10Status,
        normalizationApplied: metrics.normalizationApplied,
        calorieDelta: metrics.calorieDelta,
        proteinDelta: metrics.proteinDelta,
        optionsProcessed: metrics.optionsProcessed,
      },
    });
  };

  try {
    log.info("Function started");
    
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

    // Obter user_id do plano para rate limiting e métricas
    const { data: planData } = await supabase
      .from("diet_plans")
      .select("user_id")
      .eq("id", planId)
      .single();
    
    const userId = planData?.user_id as string | null;

    // ============================================
    // VALIDAÇÃO DE LIMITE DE AJUSTES (REBALANCER)
    // ============================================
    if (userId) {
      const { data: canUseAdjustment } = await supabase.rpc("can_use_feature", {
        _user_id: userId,
        _feature: "adjustment",
      });

      if (!canUseAdjustment) {
        const { data: planInfo } = await supabase.rpc("get_user_plan", { _user_id: userId });
        const adjustmentLimit = planInfo?.[0]?.adjustment_limit || 0;
        
        log.warn("Adjustment limit reached", { userId, adjustmentLimit });
        return new Response(
          JSON.stringify({
            success: false,
            error: `Você atingiu o limite de ${adjustmentLimit} ajuste(s) do seu plano. Faça upgrade para continuar ajustando seus planos.`,
            code: "ADJUSTMENT_LIMIT_REACHED",
            upgradeRequired: true,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============================================
    // RATE LIMITING
    // ============================================
    if (userId) {
      const rateLimitConfig = RATE_LIMITS['ai-rebalance'];
      const rateLimitResult = await checkRateLimit(supabase, userId, rateLimitConfig);
      
      if (!rateLimitResult.allowed) {
        log.warn("Rate limit exceeded", { 
          userId, 
          remaining: rateLimitResult.remaining,
          resetAfterMs: rateLimitResult.resetAfterMs 
        });
        return createRateLimitResponse(rateLimitResult, rateLimitConfig, corsHeaders);
      }
      
      log.info("Rate limit check passed", { 
        remaining: rateLimitResult.remaining,
        currentCount: rateLimitResult.currentCount 
      });
    }


    // Carregar configurações do admin
    const settings = await loadOptimizerSettings(supabase);

    // Mapear objetivo
    const objective = mapGoalToObjective(goal);
    
    // Obter regras específicas do perfil
    const profileRules = getObjectiveRules(objective, settings);
    
    // LOG DETALHADO: Mostrar perfil e regras aplicadas
    logProfileRules(objective, profileRules, settings);
    
    // Construir metadados G-10 (default para PASS se não fornecido)
    const g10Metadata: G10Metadata = {
      g10Status: (g10_status as G10Status) || "PASS",
      implicitFatRatio: implicit_fat_ratio || 0,
      implicitFatWarning: implicit_fat_warning,
    };
    
    console.log(`[REBALANCER] Objetivo: ${objective} (goal recebido: ${goal})`);
    console.log(`[REBALANCER] G-10 Metadata: status=${g10Metadata.g10Status}, ratio=${(g10Metadata.implicitFatRatio * 100).toFixed(0)}%`);
    console.log(`[REBALANCER] Targets: Cal=${targets.calories}kcal, Prot=${targets.protein}g, Carbs=${targets.carbs}g, Fat=${targets.fat}g`);

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
      refinementStatus: RefinementStatus;
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
    
    // ============================================
    // VERIFICAÇÃO UPFRONT: PLANO JÁ VALIDADO? (v2.6)
    // Evita processamento desnecessário se todas as opções
    // já estão válidas E com equivalência calórica
    // ============================================
    
    interface UpfrontValidation {
      optionNumber: number;
      totals: MacroTargets;
      isValid: boolean;
      needsOptimization: boolean;
      foods: FoodWithMeta[];
      initialQuantities: Map<string, number>;
    }
    
    const upfrontValidations: UpfrontValidation[] = [];
    
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
      
      if (optionFoods.length === 0) continue;
      
      const optionTotals = calculateTotals(optionFoods, optionInitialQuantities);
      const validation = validatePlan(optionTotals, targets, objective, settings);
      
      // Verificar desvios para decidir se precisa otimização
      const percents = calculatePercents(optionTotals, targets);
      const OPTIMIZATION_THRESHOLD = 3;
      const needsOpt = 
        Math.abs(percents.calories - 100) > OPTIMIZATION_THRESHOLD ||
        Math.abs(percents.protein - 100) > OPTIMIZATION_THRESHOLD ||
        Math.abs(percents.carbs - 100) > OPTIMIZATION_THRESHOLD ||
        Math.abs(percents.fat - 100) > OPTIMIZATION_THRESHOLD;
      
      upfrontValidations.push({
        optionNumber,
        totals: optionTotals,
        isValid: validation.valid,
        needsOptimization: needsOpt,
        foods: optionFoods,
        initialQuantities: optionInitialQuantities,
      });
    }
    
    // Verificar equivalência calórica entre opções (±5%)
    const checkCalorieEquivalence = (): boolean => {
      if (upfrontValidations.length <= 1) return true;
      
      const referenceCalories = upfrontValidations.find(v => v.optionNumber === 1)?.totals.calories;
      if (!referenceCalories || referenceCalories <= 0) return true;
      
      const MAX_VARIANCE = GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT / 100;
      
      for (const validation of upfrontValidations) {
        if (validation.optionNumber === 1) continue;
        const variance = Math.abs(validation.totals.calories - referenceCalories) / referenceCalories;
        if (variance > MAX_VARIANCE) {
          console.log(`[UPFRONT] Opção ${validation.optionNumber} com variância calórica ${(variance * 100).toFixed(1)}% > ${GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT}%`);
          return false;
        }
      }
      return true;
    };
    
    const allOptionsValid = upfrontValidations.every(v => v.isValid);
    const noOptimizationNeeded = upfrontValidations.every(v => !v.needsOptimization);
    const hasCalorieEquivalence = checkCalorieEquivalence();
    
    // Se TUDO está validado, retornar early com alreadyOptimized
    if (allOptionsValid && noOptimizationNeeded && hasCalorieEquivalence) {
      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  PLANO JÁ OTIMIZADO - RETORNO EARLY (v2.6)                   ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
      
      const primaryTotals = upfrontValidations.find(v => v.optionNumber === 1)?.totals || targets;
      const percents = calculatePercents(primaryTotals, targets);
      
      return new Response(JSON.stringify({
        success: true,
        alreadyOptimized: true,
        currentMacros: primaryTotals,
        targetMacros: targets,
        proposedMacros: primaryTotals,
        adjustments: [],
        message: "Seu plano já está perfeitamente alinhado com suas metas nutricionais.",
        warning: "Otimizações frequentes sem alterações no plano não afetarão os resultados.",
        currentPercentages: {
          calories: Math.round(percents.calories),
          protein: Math.round(percents.protein),
          carbs: Math.round(percents.carbs),
          fat: Math.round(percents.fat),
        },
        optionValidations: upfrontValidations.map(v => ({
          optionNumber: v.optionNumber,
          status: "VALIDATED" as const,
          metrics: {
            caloriePercent: Math.round(calculatePercents(v.totals, targets).calories * 10) / 10,
            proteinPercent: Math.round(calculatePercents(v.totals, targets).protein * 10) / 10,
            carbPercent: Math.round(calculatePercents(v.totals, targets).carbs * 10) / 10,
            fatPercent: Math.round(calculatePercents(v.totals, targets).fat * 10) / 10,
          },
          isValid: true,
          isHardFail: false,
          retriesUsed: 0,
        })),
        explanation: "Todas as opções já estão validadas e com equivalência calórica.",
        warnings: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`[UPFRONT] Validação: allValid=${allOptionsValid}, noOptNeeded=${noOptimizationNeeded}, calEquiv=${hasCalorieEquivalence}`);
    console.log(`[UPFRONT] Continuando com pipeline de otimização...`);
    
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

      // Validar plano atual (tolerâncias amplas)
      const optionValidation = validatePlan(optionCurrentTotals, targets, objective, settings);
      
      // Calcular desvios absolutos das metas
      const percents = calculatePercents(optionCurrentTotals, targets);
      const calorieDelta = Math.abs(percents.calories - 100);
      const proteinDelta = Math.abs(percents.protein - 100);
      const carbsDelta = Math.abs(percents.carbs - 100);
      const fatDelta = Math.abs(percents.fat - 100);
      
      // NOVA LÓGICA: Otimizar mesmo se "válido" mas com desvios significativos
      // Threshold: Se qualquer macro desviar >3% da meta, aplicar refinamento
      const OPTIMIZATION_THRESHOLD = 3; // 3% de desvio (precisão alta)
      const needsOptimization = 
        calorieDelta > OPTIMIZATION_THRESHOLD ||
        proteinDelta > OPTIMIZATION_THRESHOLD ||
        carbsDelta > OPTIMIZATION_THRESHOLD ||
        fatDelta > OPTIMIZATION_THRESHOLD;

      if (optionValidation.valid && !needsOptimization) {
        console.log(`Opção ${optionNumber} já está válida e otimizada (desvios < ${OPTIMIZATION_THRESHOLD}%)`);
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
          refinementStatus: RefinementStatus.CONVERGED,
          foodChanges: [],
        });
        continue;
      }
      
      // Log do motivo da otimização
      if (optionValidation.valid && needsOptimization) {
        console.log(`Opção ${optionNumber} válida mas com desvios significativos - aplicando refinamento`);
        console.log(`  Desvios: Cal=${calorieDelta.toFixed(1)}%, Prot=${proteinDelta.toFixed(1)}%, Carb=${carbsDelta.toFixed(1)}%, Fat=${fatDelta.toFixed(1)}%`);
      } else {
        console.log(`Opção ${optionNumber} inválida: ${optionValidation.errors.join('; ')}`);
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
        150, // Mais iterações para garantir range hard
        objective // CORREÇÃO: Passar objetivo para pesos dinâmicos
      );

      // Calcular totais finais
      const optionFinalTotals = calculateTotals(optionFoods, refinementResult.quantities);
      const totalIterations = pipelineResult.iterations + refinementResult.iterations;
      
      // LOG DETALHADO: Resultado desta opção
      logFinalResult(objective, optionFinalTotals, targets, totalIterations, refinementResult.converged);

      // Montar mudanças de alimentos
      const optionFoodChanges: OptionResult['foodChanges'] = [];

      for (const food of optionFoods) {
        const original = optionInitialQuantities.get(food.id) || food.quantity_grams;
        const final = refinementResult.quantities.get(food.id) || food.quantity_grams;
        const diff = Math.abs(final - original);

        if (diff >= 1) {
          console.log(`  [AJUSTE] ${food.food.name}: ${original}g → ${final}g (Δ ${diff.toFixed(0)}g)`);
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
        refinementStatus: refinementResult.refinementStatus,
        foodChanges: optionFoodChanges,
      });
    }

    // Se nenhuma opção foi processada
    if (optionResults.length === 0) {
      throw new Error("Nenhuma opção de refeição encontrada no plano");
    }

    // ============================================
    // VALIDAÇÃO INDIVIDUAL POR OPÇÃO (v2.5)
    // COM RETRY ATÉ CONVERGÊNCIA TOTAL
    // ============================================
    
    // Configuração de retry "até convergência"
    const MAX_RETRIES_PER_OPTION = 10;    // Máximo de retries por opção individual
    const MAX_TOTAL_RETRIES = 15;         // Teto de segurança global
    const HARD_FAIL_FAT_THRESHOLD = 1.20; // 120% - impossível corrigir
    
    let totalRetriesPerformed = 0;
    const retriesPerOption = new Map<number, number>(); // Rastrear retries por opção
    const structurallyInvalidOptions = new Set<number>(); // Opções que não podem convergir
    
    const validateOptions = (): Array<{
      optionNumber: number;
      validation: FinalValidationResult;
      isValid: boolean;
      isHardFail: boolean;
    }> => {
      const validations: Array<{
        optionNumber: number;
        validation: FinalValidationResult;
        isValid: boolean;
        isHardFail: boolean;
      }> = [];
      
      for (const result of optionResults) {
        const validation = validateFinalPlan(
          result.finalTotals,
          targets,
          {
            g10Status: g10Metadata.g10Status,
            normalizationApplied: result.normalizationApplied,
            objective,
          }
        );
        
        // Verificar hard fail (gordura > 120%)
        const isHardFail = validation.metrics.fatPercent > HARD_FAIL_FAT_THRESHOLD * 100;
        
        console.log(`[VALIDAÇÃO] Opção ${result.optionNumber}: ${validation.status} (Cal=${validation.metrics.caloriePercent}%, Fat=${validation.metrics.fatPercent}%)${isHardFail ? ' [HARD FAIL]' : ''}`);
        
        if (isHardFail) {
          structurallyInvalidOptions.add(result.optionNumber);
        }
        
        validations.push({
          optionNumber: result.optionNumber,
          validation,
          isValid: validation.status !== "STRUCTURALLY_INVALID",
          isHardFail,
        });
      }
      return validations;
    };
    
    let optionValidations = validateOptions();
    
    // ============================================
    // RETRY ATÉ CONVERGÊNCIA TOTAL (v2.5)
    // Continua até que TODAS as opções estejam válidas
    // ou atinjam hard fail (estruturalmente impossível)
    // ============================================
    
    const retryUntilAllConverged = async () => {
      // Opções que falharam MAS podem potencialmente convergir (não são hard fail)
      const retryableOptions = optionValidations.filter(v => 
        !v.isValid && 
        !v.isHardFail && 
        !structurallyInvalidOptions.has(v.optionNumber) &&
        (retriesPerOption.get(v.optionNumber) || 0) < MAX_RETRIES_PER_OPTION
      );
      
      // Se não há mais opções para retry ou atingiu teto global, parar
      if (retryableOptions.length === 0 || totalRetriesPerformed >= MAX_TOTAL_RETRIES) {
        const hardFailCount = structurallyInvalidOptions.size;
        const exhaustedCount = optionValidations.filter(v => 
          !v.isValid && 
          (retriesPerOption.get(v.optionNumber) || 0) >= MAX_RETRIES_PER_OPTION
        ).length;
        
        if (hardFailCount > 0 || exhaustedCount > 0) {
          console.log(`\n[CONVERGÊNCIA] Finalizado com:`);
          console.log(`  - Hard fails (>120% gordura): ${hardFailCount}`);
          console.log(`  - Exauriram retries: ${exhaustedCount}`);
          console.log(`  - Total retries realizados: ${totalRetriesPerformed}`);
        }
        return;
      }
      
      console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
      console.log(`║  RETRY ${totalRetriesPerformed + 1}/${MAX_TOTAL_RETRIES} - ${retryableOptions.length} opção(ões) pendentes          ║`);
      console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
      
      for (const failedValidation of retryableOptions) {
        const optionIdx = optionResults.findIndex(r => r.optionNumber === failedValidation.optionNumber);
        if (optionIdx === -1) continue;
        
        const optionResult = optionResults[optionIdx];
        const optionFoods = optionResult.foods;
        const optionRetryCount = (retriesPerOption.get(optionResult.optionNumber) || 0) + 1;
        retriesPerOption.set(optionResult.optionNumber, optionRetryCount);
        
        console.log(`[RETRY] Opção ${optionResult.optionNumber} (tentativa ${optionRetryCount}/${MAX_RETRIES_PER_OPTION})...`);
        
        // Re-executar pipeline com as quantidades atuais como ponto de partida
        const pipelineResult = runCorrectionPipeline(
          optionFoods,
          optionResult.finalQuantities,
          targets,
          objective,
          settings,
          g10Metadata,
          3 // Max ciclos
        );
        
        // Se estruturalmente inválido, marcar como hard fail
        if (pipelineResult.structurallyInvalid) {
          console.log(`[RETRY] Opção ${optionResult.optionNumber} é estruturalmente inválida - não será mais retentada`);
          structurallyInvalidOptions.add(optionResult.optionNumber);
          continue;
        }
        
        // Re-executar refinamento com mais iterações progressivamente
        const contributions = new Map<string, MacroTargets>();
        for (const food of optionFoods) {
          contributions.set(food.id, getFoodContributionPer100g(food.food));
        }
        
        // Aumentar iterações progressivamente conforme retries
        const refinementIterations = 150 + (optionRetryCount * 50); // 200, 250, 300...
        
        const refinementResult = runFinalRefinement(
          optionFoods,
          pipelineResult.quantities,
          targets,
          contributions,
          refinementIterations,
          objective
        );
        
        // Atualizar resultado da opção
        const newFinalTotals = calculateTotals(optionFoods, refinementResult.quantities);
        const newIterations = optionResult.iterations + pipelineResult.iterations + refinementResult.iterations;
        
        // Recalcular mudanças de alimentos
        const newFoodChanges: OptionResult['foodChanges'] = [];
        for (const food of optionFoods) {
          const original = optionResult.initialQuantities.get(food.id) || food.quantity_grams;
          const final = refinementResult.quantities.get(food.id) || food.quantity_grams;
          const diff = Math.abs(final - original);
          
          if (diff >= 1) {
            newFoodChanges.push({
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
        
        // Atualizar optionResults com o novo resultado
        optionResults[optionIdx] = {
          ...optionResult,
          finalQuantities: refinementResult.quantities,
          finalTotals: newFinalTotals,
          iterations: newIterations,
          converged: refinementResult.converged,
          normalizationApplied: pipelineResult.normalizationApplied,
          refinementStatus: refinementResult.refinementStatus,
          foodChanges: newFoodChanges,
        };
        
        console.log(`[RETRY] Opção ${optionResult.optionNumber}: Cal=${Math.round(newFinalTotals.calories)}/${targets.calories}, Prot=${Math.round(newFinalTotals.protein)}/${targets.protein}g, Fat=${Math.round(newFinalTotals.fat)}/${targets.fat}g`);
      }
      
      totalRetriesPerformed++;
      
      // Re-validar todas as opções após o retry
      optionValidations = validateOptions();
      
      // Verificar se todas as opções que podem convergir já convergiram
      const stillRetryable = optionValidations.filter(v => 
        !v.isValid && 
        !v.isHardFail && 
        !structurallyInvalidOptions.has(v.optionNumber) &&
        (retriesPerOption.get(v.optionNumber) || 0) < MAX_RETRIES_PER_OPTION
      );
      
      if (stillRetryable.length > 0) {
        console.log(`[RETRY] ${stillRetryable.length} opção(ões) ainda não convergiram, continuando...`);
        await retryUntilAllConverged();
      } else {
        const validCount = optionValidations.filter(v => v.isValid).length;
        console.log(`\n[CONVERGÊNCIA] Finalizado: ${validCount}/${optionValidations.length} opções válidas após ${totalRetriesPerformed} retries totais`);
      }
    };
    
    // Executar retries até convergência total (v2.5)
    const initialFailedCount = optionValidations.filter(v => !v.isValid).length;
    if (initialFailedCount > 0) {
      await retryUntilAllConverged();
      console.log(`[RETRY] Concluído: ${totalRetriesPerformed} retry(s) executado(s)`);
      
      // Log detalhado por opção
      for (const [optNum, retries] of retriesPerOption.entries()) {
        console.log(`  - Opção ${optNum}: ${retries} retry(s)`);
      }
      if (structurallyInvalidOptions.size > 0) {
        console.log(`  - Hard fails (não recuperáveis): Opções ${Array.from(structurallyInvalidOptions).join(', ')}`);
      }
    }
    
    // ============================================
    // EQUALIZAÇÃO CALÓRICA ENTRE OPÇÕES (v2.5)
    // Garante que as opções 2 e 3 tenham ±5% de calorias da opção 1
    // ============================================
    let equalizationResult: EqualizationResult = { adjusted: 0, warnings: [], adjustments: [] };
    
    if (optionResults.length > 1) {
      equalizationResult = equalizeOptionCalories(optionResults, targets);
      
      if (equalizationResult.adjusted > 0) {
        log.info("CalorieEqualizationApplied", {
          optionsAdjusted: equalizationResult.adjusted,
          warnings: equalizationResult.warnings.length,
          adjustments: equalizationResult.adjustments,
        });
        
        // Re-validar opções após equalização
        optionValidations = validateOptions();
        console.log(`[EQUALIZAÇÃO] Re-validação após equalização concluída`);
      }
    }
    
    // Usar opção 1 como referência principal para compatibilidade
    const primaryResult = optionResults.find(r => r.optionNumber === 1) || optionResults[0];
    const primaryValidation = optionValidations.find(v => v.optionNumber === primaryResult.optionNumber)?.validation 
      || validateFinalPlan(primaryResult.finalTotals, targets, { g10Status: g10Metadata.g10Status, normalizationApplied: primaryResult.normalizationApplied, objective });
    
    console.log(`[PATCH FINAL] Resultado da validação primária: ${primaryValidation.status}`);
    console.log(`[PATCH FINAL] Métricas: Cal=${primaryValidation.metrics.caloriePercent}%, Prot=${primaryValidation.metrics.proteinPercent}%, Carb=${primaryValidation.metrics.carbPercent}%, Fat=${primaryValidation.metrics.fatPercent}%`);
    console.log(`[PATCH FINAL] Retries executados: ${totalRetriesPerformed}`);
    
    // Se TODAS as opções são estruturalmente inválidas (mesmo após retries), retornar imediatamente
    const allInvalid = optionValidations.every(v => !v.isValid);
    if (allInvalid) {
      console.log(`[PATCH FINAL] ❌ TODAS as opções STRUCTURALLY_INVALID (após ${totalRetriesPerformed} retries)`);
      return new Response(
        JSON.stringify({
          status: "structurally_invalid",
          objective,
          iterations: Math.max(...optionResults.map(r => r.iterations)),
          final_totals: primaryResult.finalTotals,
          adjustments: primaryResult.adjustments,
          structural_issue: {
            reason: primaryValidation.reason || "All options failed validation",
            fat_percent: primaryValidation.metrics.fatPercent,
            calories_percent: primaryValidation.metrics.caloriePercent,
            action: "regenerate_plan",
            retriesAttempted: totalRetriesPerformed,
            hardFailOptions: Array.from(structurallyInvalidOptions),
          },
          food_changes: [],
          finalValidation: primaryValidation,
          optionValidations: optionValidations.map(v => ({
            optionNumber: v.optionNumber,
            status: v.validation.status,
            metrics: v.validation.metrics,
            isHardFail: v.isHardFail,
            retriesUsed: retriesPerOption.get(v.optionNumber) || 0,
          })),
          meta: {
            totalRetriesPerformed,
            maxRetriesPerOption: MAX_RETRIES_PER_OPTION,
            maxTotalRetries: MAX_TOTAL_RETRIES,
            retriesPerOption: Object.fromEntries(retriesPerOption),
            hardFailOptions: Array.from(structurallyInvalidOptions),
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Verificar convergência de todas as opções
    const allConverged = optionResults.every(r => r.converged);
    const anyConverged = optionResults.some(r => r.converged);
    const allValidated = optionValidations.every(v => v.isValid);

    // Determinar status baseado na validação de TODAS as opções
    // v2.3: Considerar validação de cada opção individualmente
    let status: "valid" | "valid_with_alert" | "error";
    
    if (allValidated && allConverged) {
      // Todas as opções validadas E convergidas = válido
      status = "valid";
    } else if (allValidated) {
      // Todas validadas mas nem todas convergidas = alerta
      status = "valid_with_alert";
    } else if (optionValidations.some(v => v.isValid)) {
      // Pelo menos uma opção válida = alerta
      status = "valid_with_alert";
    } else {
      // Nenhuma opção válida = erro
      status = "error";
    }
    
    // Incluir tolerância clínica no status se aplicável
    const anyWithTolerance = optionValidations.some(v => v.validation.status === "VALIDATED_WITH_TOLERANCE");
    if (anyWithTolerance && status === "valid") {
      status = "valid_with_alert";
    }

    // Calcular totais iniciais para compatibilidade
    const currentTotals = calculateTotals(primaryResult.foods, primaryResult.initialQuantities);

    // Combinar todas as mudanças de todas as opções
    const allFoodChanges = optionResults.flatMap(r => r.foodChanges);
    const totalIterations = Math.max(...optionResults.map(r => r.iterations));

    // Verificar se normalization foi aplicada em alguma opção
    const anyNormalizationApplied = optionResults.some(r => r.normalizationApplied);

    // Determinar refinementStatus principal (usar o pior status entre todas as opções)
    const refinementStatusPriority = [
      RefinementStatus.MAX_ITERATIONS_REACHED,
      RefinementStatus.STOPPED_BY_LIMIT,
      RefinementStatus.LOCAL_MINIMUM,
      RefinementStatus.CONVERGED,
    ];
    const primaryRefinementStatus = optionResults.reduce((worst, result) => {
      const worstIndex = refinementStatusPriority.indexOf(worst);
      const currentIndex = refinementStatusPriority.indexOf(result.refinementStatus);
      return currentIndex < worstIndex ? result.refinementStatus : worst;
    }, RefinementStatus.CONVERGED);

    // Construir diagnósticos do rebalanceador (v2.5)
    const convergenceTimeMs = Math.round(performance.now() - startTime);
    const diagnostics: RebalancerDiagnostics = {
      refinementStatus: primaryRefinementStatus,
      normalization: {
        normalizationRequired: g10Metadata.g10Status === "ALLOW_REBALANCE",
        normalizationApplied: anyNormalizationApplied,
        fatPercentBefore: primaryValidation.metrics.fatPercent,
        fatPercentAfter: primaryValidation.metrics.fatPercent,
        adjustedFoods: [],
      },
      totalIterations,
      convergenceTimeMs,
      optionsProcessed: optionResults.length,
      retriesPerformed: totalRetriesPerformed,
      // v2.5: Adicionado diagnóstico de equalização calórica
      calorieEqualization: {
        optionsAdjusted: equalizationResult.adjusted,
        warnings: equalizationResult.warnings,
        adjustments: equalizationResult.adjustments,
      },
    };

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
      meta: {
        g10Status: g10Metadata.g10Status,
        implicitFatRatio: g10Metadata.implicitFatRatio,
        normalizationApplied: anyNormalizationApplied,
        finalValidation: primaryValidation,
        diagnostics,
      },
    };

    // Log de resumo com diagnósticos (v2.5)
    log.info("Rebalance complete", {
      g10Status: g10Metadata.g10Status,
      normalizationApplied: anyNormalizationApplied,
      primaryValidation: primaryValidation.status,
      allOptionsValid: allValidated,
      refinementStatus: primaryRefinementStatus,
      convergenceTimeMs,
      optionsCount: optionResults.length,
      optionStatuses: optionValidations.map(v => `Opt${v.optionNumber}:${v.validation.status}`).join(', '),
      totalRetriesPerformed,
      // v2.5: Log de equalização
      equalizationApplied: equalizationResult.adjusted > 0,
      equalizationAdjustments: equalizationResult.adjusted,
      retriesPerOption: Object.fromEntries(retriesPerOption),
    });

    // Logar métricas de rebalanceamento para análise
    if (userId) {
      if (status !== "error") {
        await supabase.rpc("increment_usage", { _user_id: userId, _feature: "adjustment" });
        log.info("Adjustment usage incremented", { userId });
      }
      
      await logRebalanceMetrics(supabase, userId, {
        iterations: totalIterations,
        convergenceTimeMs,
        status,
        objective,
        g10Status: g10Metadata.g10Status,
        normalizationApplied: anyNormalizationApplied,
        calorieDelta: Math.abs(primaryResult.finalTotals.calories - targets.calories),
        proteinDelta: Math.abs(primaryResult.finalTotals.protein - targets.protein),
        optionsProcessed: optionResults.length,
      });
    }

    // Retornar no formato esperado pelo frontend (v2.4)
    // Inclui validações individuais por opção e informações de retry
    return new Response(JSON.stringify({
      success: status !== "error",
      result,
      currentMacros: currentTotals,
      targetMacros: targets,
      proposedMacros: primaryResult.finalTotals,
      g10Meta: {
        g10Status: g10Metadata.g10Status,
        implicitFatRatio: g10Metadata.implicitFatRatio,
        normalizationApplied: anyNormalizationApplied,
      },
      finalValidation: primaryValidation,
      // v2.4: Validações individuais por opção
      optionValidations: optionValidations.map(v => ({
        optionNumber: v.optionNumber,
        status: v.validation.status,
        metrics: v.validation.metrics,
        isValid: v.isValid,
        isHardFail: v.isHardFail,
        retriesUsed: retriesPerOption.get(v.optionNumber) || 0,
      })),
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
      // v2.5: Metadados de retry expandidos
      meta: {
        totalRetriesPerformed,
        maxRetriesPerOption: MAX_RETRIES_PER_OPTION,
        maxTotalRetries: MAX_TOTAL_RETRIES,
        retriesPerOption: Object.fromEntries(retriesPerOption),
        hardFailOptions: Array.from(structurallyInvalidOptions),
        diagnostics,
      },
      explanation: allValidated
        ? `Plano ajustado com sucesso. ${optionResults.length} opção(ões) validada(s).${anyNormalizationApplied ? ' Normalização aplicada.' : ''}${totalRetriesPerformed > 0 ? ` (${totalRetriesPerformed} retry(s))` : ''}`
        : anyWithTolerance
        ? `Plano validado com tolerância clínica. ${optionValidations.filter(v => v.isValid).length}/${optionResults.length} opções válidas.${totalRetriesPerformed > 0 ? ` (${totalRetriesPerformed} retry(s))` : ''}`
        : status === "error"
        ? `Não foi possível atingir as metas após ${totalRetriesPerformed} tentativa(s). ${structurallyInvalidOptions.size > 0 ? `${structurallyInvalidOptions.size} opção(ões) são estruturalmente inválidas (gordura >120%).` : 'Verifique se as metas são realistas para os alimentos disponíveis.'}`
        : `Plano ajustado. ${optionValidations.filter(v => v.isValid).length}/${optionResults.length} opções convergidas.${totalRetriesPerformed > 0 ? ` (${totalRetriesPerformed} retry(s))` : ''}`,
      warnings: [
        ...optionValidations
          .filter(v => v.validation.status === "VALIDATED_WITH_TOLERANCE")
          .map(v => `Opção ${v.optionNumber}: tolerância clínica (gordura ${v.validation.metrics.fatPercent}%)`),
        ...optionValidations
          .filter(v => !v.isValid && !v.isHardFail)
          .map(v => `Opção ${v.optionNumber}: ${v.validation.reason || 'não convergiu'} (${retriesPerOption.get(v.optionNumber) || 0} retries)`),
        ...optionValidations
          .filter(v => v.isHardFail)
          .map(v => `Opção ${v.optionNumber}: HARD FAIL - gordura ${v.validation.metrics.fatPercent}% (irreversível)`),
        ...optionResults
          .filter(r => !r.converged && optionValidations.find(v => v.optionNumber === r.optionNumber)?.isValid)
          .map(r => `Opção ${r.optionNumber}: convergência parcial`),
        ...(totalRetriesPerformed > 0 ? [`${totalRetriesPerformed} retry(s) automático(s) executado(s)`] : []),
      ],
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
