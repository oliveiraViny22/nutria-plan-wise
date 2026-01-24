// =====================================================
// REBALANCEADOR v3 - IMPLEMENTAÇÃO LIMPA
// =====================================================
// Este módulo implementa o rebalanceador do ZERO
// seguindo estritamente os contratos definidos.
//
// REGRAS INVIOLÁVEIS:
// 1. Ajusta APENAS quantidades
// 2. Tolerância calórica: ±2%
// 3. Ordem de ajuste: proteína → carboidrato → gordura
// 4. NUNCA marca plano inválido como otimizado
// 5. NÃO usa IA para cálculos
// =====================================================

import {
  KCAL_PER_GRAM,
  REBALANCER_CONTRACT,
  MacroTargets,
  MacroDeltas,
  macrosToCalories,
  calculateDeltas,
  validateRebalancedMacros,
  isPlanAlreadyOptimized,
} from './nutrition-contracts';

import {
  CANONICAL_CATEGORIES,
  FoodCategory,
  isValidCategory,
} from './food-categories';

// =====================================================
// TIPOS DO REBALANCEADOR
// =====================================================

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

export interface QuantityAdjustment {
  itemId: string;
  mealId: string;
  mealName: string;
  optionId: string;
  foodId: string;
  foodName: string;
  originalGrams: number;
  newGrams: number;
  macroDelta: MacroDeltas;
  reason: string;
}

export interface SupplementNeed {
  type: 'protein' | 'carbs' | 'fat';
  deficitGrams: number;
  message: string;
}

/**
 * Status do plano após rebalanceamento.
 */
export type PlanStatus = 
  | 'already_balanced'      // Plano já está dentro das metas
  | 'optimized'             // Ajustes aplicados, resultado válido
  | 'partially_optimized'   // Ajustes aplicados, mas fora de tolerância
  | 'not_optimizable';      // Impossível otimizar com alimentos disponíveis

export interface RebalanceResult {
  planId: string;
  version: number;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros: MacroTargets;
  adjustments: QuantityAdjustment[];
  supplementNeeds: SupplementNeed[];
  isValid: boolean;
  validationErrors: string[];
  planStatus: PlanStatus;
  statusMessage: string;
}

export interface RebalanceOptions {
  maxAdjustmentPercent?: number;
  minQuantityGrams?: number;
  maxQuantityGrams?: number;
  allowSupplements?: boolean;
}

// =====================================================
// FUNÇÕES DE CÁLCULO
// =====================================================

/**
 * Calcula nutrientes para uma quantidade em gramas.
 */
function calculateNutrients(food: FoodItem, grams: number): MacroDeltas {
  const multiplier = grams / food.servingGrams;
  return {
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
    calories: food.calories * multiplier,
  };
}

/**
 * Soma os macros de todos os itens ativos.
 */
function sumMacros(items: PlanItem[]): MacroTargets {
  let protein = 0, carbs = 0, fat = 0, calories = 0;
  
  for (const item of items) {
    if (!item.isActive) continue;
    const nutrients = calculateNutrients(item.food, item.quantityGrams);
    protein += nutrients.protein;
    carbs += nutrients.carbs;
    fat += nutrients.fat;
    calories += nutrients.calories;
  }
  
  return { protein, carbs, fat, calories };
}

/**
 * Identifica o macro dominante de um alimento.
 */
function getDominantMacro(food: FoodItem): 'protein' | 'carbs' | 'fat' {
  const proteinCal = food.protein * KCAL_PER_GRAM.protein;
  const carbsCal = food.carbs * KCAL_PER_GRAM.carbs;
  const fatCal = food.fat * KCAL_PER_GRAM.fat;
  
  if (proteinCal >= carbsCal && proteinCal >= fatCal) return 'protein';
  if (carbsCal >= proteinCal && carbsCal >= fatCal) return 'carbs';
  return 'fat';
}

/**
 * Filtra itens por macro dominante.
 */
function filterByDominantMacro(
  items: PlanItem[],
  macro: 'protein' | 'carbs' | 'fat'
): PlanItem[] {
  return items.filter(item => 
    item.isActive && getDominantMacro(item.food) === macro
  );
}

// =====================================================
// AJUSTADORES (ORDEM FIXA)
// =====================================================

interface AdjustmentContext {
  items: PlanItem[];
  adjustments: Map<string, QuantityAdjustment>;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  options: Required<RebalanceOptions>;
}

/**
 * Cria ajuste e atualiza contexto.
 */
function applyAdjustment(
  ctx: AdjustmentContext,
  item: PlanItem,
  newGrams: number,
  reason: string
): void {
  const oldGrams = item.quantityGrams;
  const oldNutrients = calculateNutrients(item.food, oldGrams);
  const newNutrients = calculateNutrients(item.food, newGrams);
  
  const delta: MacroDeltas = {
    protein: newNutrients.protein - oldNutrients.protein,
    carbs: newNutrients.carbs - oldNutrients.carbs,
    fat: newNutrients.fat - oldNutrients.fat,
    calories: newNutrients.calories - oldNutrients.calories,
  };
  
  // Atualiza macros correntes
  ctx.currentMacros.protein += delta.protein;
  ctx.currentMacros.carbs += delta.carbs;
  ctx.currentMacros.fat += delta.fat;
  ctx.currentMacros.calories += delta.calories;
  
  // Atualiza quantidade no item
  item.quantityGrams = newGrams;
  
  // Registra ajuste
  ctx.adjustments.set(item.id, {
    itemId: item.id,
    mealId: item.mealId,
    mealName: item.mealName,
    optionId: item.optionId,
    foodId: item.food.id,
    foodName: item.food.name,
    originalGrams: oldGrams,
    newGrams: newGrams,
    macroDelta: delta,
    reason,
  });
}

/**
 * Calcula gramas necessários para atingir delta de um macro.
 */
function gramsForDelta(
  food: FoodItem,
  macro: 'protein' | 'carbs' | 'fat',
  deltaGrams: number
): number {
  const macroPerGram = food[macro] / food.servingGrams;
  if (macroPerGram <= 0) return 0;
  return deltaGrams / macroPerGram;
}

/**
 * Limita quantidade respeitando min/max e ajuste máximo.
 */
function clampQuantity(
  newGrams: number,
  originalGrams: number,
  options: Required<RebalanceOptions>
): number {
  // Limite absoluto
  let clamped = Math.max(options.minQuantityGrams, Math.min(options.maxQuantityGrams, newGrams));
  
  // Limite de ajuste percentual
  const maxChange = originalGrams * (options.maxAdjustmentPercent / 100);
  const minGrams = Math.max(options.minQuantityGrams, originalGrams - maxChange);
  const maxGrams = Math.min(options.maxQuantityGrams, originalGrams + maxChange);
  
  clamped = Math.max(minGrams, Math.min(maxGrams, clamped));
  
  // Arredondar para 5g
  return Math.round(clamped / 5) * 5;
}

/**
 * PASSO 1: Ajusta proteína.
 * Prioridade máxima - ajusta primeiro.
 */
function adjustProtein(ctx: AdjustmentContext): void {
  const delta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
  
  // Tolerância de 2%
  const tolerance = ctx.targetMacros.protein * (REBALANCER_CONTRACT.PROTEIN_TOLERANCE_PERCENT / 100);
  if (Math.abs(delta.protein) <= tolerance) return;
  
  const proteinItems = filterByDominantMacro(ctx.items, 'protein');
  if (proteinItems.length === 0) return;
  
  // Distribuir ajuste entre itens
  const adjustmentPerItem = delta.protein / proteinItems.length;
  
  for (const item of proteinItems) {
    const currentDelta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
    if (Math.abs(currentDelta.protein) <= tolerance) break;
    
    const gramsNeeded = gramsForDelta(item.food, 'protein', adjustmentPerItem);
    const newGrams = clampQuantity(
      item.quantityGrams + gramsNeeded,
      item.quantityGrams,
      ctx.options
    );
    
    if (newGrams !== item.quantityGrams) {
      applyAdjustment(ctx, item, newGrams, 'Ajuste de proteína');
    }
  }
}

/**
 * PASSO 2: Ajusta carboidrato.
 * Compensa calorias após ajuste de proteína.
 */
function adjustCarbs(ctx: AdjustmentContext): void {
  const delta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
  
  // Tolerância assimétrica: -8% a +5%
  const minTolerance = ctx.targetMacros.carbs * (REBALANCER_CONTRACT.CARBS_MIN_TOLERANCE_PERCENT / 100);
  const maxTolerance = ctx.targetMacros.carbs * (REBALANCER_CONTRACT.CARBS_MAX_TOLERANCE_PERCENT / 100);
  
  if (delta.carbs >= -minTolerance && delta.carbs <= maxTolerance) return;
  
  const carbItems = filterByDominantMacro(ctx.items, 'carbs');
  if (carbItems.length === 0) return;
  
  // REGRA: Carbs pode ceder para viabilizar proteína
  // Se calorias estão acima, prioriza reduzir carbs
  const calorieDelta = calculateDeltas(ctx.currentMacros, ctx.targetMacros).calories;
  
  let targetAdjustment = delta.carbs;
  
  // Se calorias estão excedendo e carbs pode ceder, reduzir carbs
  if (calorieDelta < 0 && delta.carbs > -minTolerance) {
    // Quanto de carbs precisamos reduzir para compensar calorias
    const carbsToReduceForCalories = Math.abs(calorieDelta) / KCAL_PER_GRAM.carbs;
    targetAdjustment = Math.min(delta.carbs, -carbsToReduceForCalories);
  }
  
  for (const item of carbItems) {
    const currentDelta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
    if (currentDelta.carbs >= -minTolerance && currentDelta.carbs <= maxTolerance) break;
    
    const gramsNeeded = gramsForDelta(item.food, 'carbs', targetAdjustment / carbItems.length);
    const newGrams = clampQuantity(
      item.quantityGrams + gramsNeeded,
      item.quantityGrams,
      ctx.options
    );
    
    if (newGrams !== item.quantityGrams) {
      applyAdjustment(ctx, item, newGrams, 'Ajuste de carboidrato');
    }
  }
}

/**
 * PASSO 3: Ajusta gordura (fine-tuning).
 * Último ajuste - apenas para calorias finais.
 */
function adjustFat(ctx: AdjustmentContext): void {
  const delta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
  
  // Tolerância de ±5g absoluto
  if (Math.abs(delta.fat) <= REBALANCER_CONTRACT.FAT_TOLERANCE_GRAMS) return;
  
  // REGRA: Gordura só pode aumentar se carbs não estiver abaixo do mínimo
  const carbsMinLimit = ctx.targetMacros.carbs * (1 - REBALANCER_CONTRACT.CARBS_MIN_TOLERANCE_PERCENT / 100);
  if (delta.fat < 0 && ctx.currentMacros.carbs < carbsMinLimit) {
    // Não pode aumentar gordura - carbs já está baixo
    return;
  }
  
  const fatItems = filterByDominantMacro(ctx.items, 'fat');
  if (fatItems.length === 0) return;
  
  for (const item of fatItems) {
    const currentDelta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
    if (Math.abs(currentDelta.fat) <= REBALANCER_CONTRACT.FAT_TOLERANCE_GRAMS) break;
    
    const gramsNeeded = gramsForDelta(item.food, 'fat', delta.fat / fatItems.length);
    const newGrams = clampQuantity(
      item.quantityGrams + gramsNeeded,
      item.quantityGrams,
      ctx.options
    );
    
    if (newGrams !== item.quantityGrams) {
      applyAdjustment(ctx, item, newGrams, 'Ajuste fino de gordura');
    }
  }
}

/**
 * PASSO 4: Ajuste calórico final.
 * Usa qualquer alimento disponível para atingir meta calórica.
 */
function adjustCalories(ctx: AdjustmentContext): void {
  const delta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
  const tolerance = ctx.targetMacros.calories * (REBALANCER_CONTRACT.CALORIE_TOLERANCE_PERCENT / 100);
  
  if (Math.abs(delta.calories) <= tolerance) return;
  
  // Ordenar itens por densidade calórica (maior primeiro para reduzir, menor para aumentar)
  const sortedItems = [...ctx.items]
    .filter(i => i.isActive)
    .sort((a, b) => {
      const aDensity = a.food.calories / a.food.servingGrams;
      const bDensity = b.food.calories / b.food.servingGrams;
      return delta.calories > 0 ? aDensity - bDensity : bDensity - aDensity;
    });
  
  for (const item of sortedItems) {
    const currentDelta = calculateDeltas(ctx.currentMacros, ctx.targetMacros);
    if (Math.abs(currentDelta.calories) <= tolerance) break;
    
    const caloriesPerGram = item.food.calories / item.food.servingGrams;
    if (caloriesPerGram <= 0) continue;
    
    const gramsNeeded = currentDelta.calories / caloriesPerGram;
    const newGrams = clampQuantity(
      item.quantityGrams + gramsNeeded,
      item.quantityGrams,
      ctx.options
    );
    
    if (newGrams !== item.quantityGrams) {
      applyAdjustment(ctx, item, newGrams, 'Ajuste calórico');
    }
  }
}

// =====================================================
// DETECÇÃO DE SUPLEMENTOS
// =====================================================

function detectSupplementNeeds(
  currentMacros: MacroTargets,
  targetMacros: MacroTargets
): SupplementNeed[] {
  const needs: SupplementNeed[] = [];
  const delta = calculateDeltas(currentMacros, targetMacros);
  
  // Proteína: se déficit > 10g após todos os ajustes
  if (delta.protein > 10) {
    needs.push({
      type: 'protein',
      deficitGrams: Math.round(delta.protein),
      message: `Considere suplementar com ${Math.round(delta.protein)}g de proteína`,
    });
  }
  
  return needs;
}

// =====================================================
// FUNÇÃO PRINCIPAL
// =====================================================

const DEFAULT_OPTIONS: Required<RebalanceOptions> = {
  maxAdjustmentPercent: REBALANCER_CONTRACT.MAX_ADJUSTMENT_PERCENT,
  minQuantityGrams: REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS,
  maxQuantityGrams: REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS,
  allowSupplements: true,
};

/**
 * Rebalanceia um plano alimentar.
 * 
 * CONTRATO:
 * 1. Ajusta APENAS quantidades
 * 2. Ordem: proteína → carboidrato → gordura → calorias
 * 3. Tolerância calórica: ±2%
 * 4. NUNCA marca plano inválido como otimizado
 */
export function rebalancePlan(
  plan: DietPlan,
  targetMacros: MacroTargets,
  options?: RebalanceOptions
): RebalanceResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Clonar itens para não mutar original
  const items = plan.items.map(item => ({
    ...item,
    food: { ...item.food },
  }));
  
  // Calcular macros iniciais
  const initialMacros = sumMacros(items);
  
  // Verificar se já está otimizado
  if (isPlanAlreadyOptimized(initialMacros, targetMacros)) {
    return {
      planId: plan.id,
      version: plan.version,
      currentMacros: initialMacros,
      targetMacros,
      proposedMacros: initialMacros,
      adjustments: [],
      supplementNeeds: [],
      isValid: true,
      validationErrors: [],
      planStatus: 'already_balanced',
      statusMessage: 'Plano já está otimizado!',
    };
  }
  
  // Contexto de ajuste
  const ctx: AdjustmentContext = {
    items,
    adjustments: new Map(),
    currentMacros: { ...initialMacros },
    targetMacros,
    options: opts,
  };
  
  // EXECUTAR AJUSTES NA ORDEM CORRETA
  adjustProtein(ctx);
  adjustCarbs(ctx);
  adjustFat(ctx);
  adjustCalories(ctx);
  
  // Calcular macros finais
  const proposedMacros = sumMacros(items);
  
  // Validar resultado
  const validation = validateRebalancedMacros(proposedMacros, targetMacros);
  
  // Detectar necessidade de suplementos
  const supplementNeeds = opts.allowSupplements 
    ? detectSupplementNeeds(proposedMacros, targetMacros)
    : [];
  
  // Determinar status
  let planStatus: PlanStatus;
  let statusMessage: string;
  
  if (validation.isValid) {
    planStatus = 'optimized';
    statusMessage = 'Plano otimizado com sucesso!';
  } else if (ctx.adjustments.size > 0) {
    planStatus = 'partially_optimized';
    statusMessage = 'Ajustes parciais aplicados, mas metas não foram totalmente atingidas.';
  } else {
    planStatus = 'not_optimizable';
    statusMessage = 'Não foi possível otimizar com os alimentos disponíveis.';
  }
  
  return {
    planId: plan.id,
    version: plan.version + 1,
    currentMacros: initialMacros,
    targetMacros,
    proposedMacros: roundMacros(proposedMacros),
    adjustments: Array.from(ctx.adjustments.values()),
    supplementNeeds,
    isValid: validation.isValid,
    validationErrors: validation.errors,
    planStatus,
    statusMessage,
  };
}

/**
 * Propaga ajustes para opções equivalentes.
 */
export function propagateAdjustmentsToOptions(
  adjustments: QuantityAdjustment[],
  allItems: PlanItem[]
): QuantityAdjustment[] {
  const allAdjustments: QuantityAdjustment[] = [...adjustments];
  
  for (const adj of adjustments) {
    // Encontrar item original
    const originalItem = allItems.find(i => i.id === adj.itemId);
    if (!originalItem) continue;
    
    // Encontrar itens equivalentes (mesmo alimento em outras opções)
    const equivalentItems = allItems.filter(i =>
      i.id !== adj.itemId &&
      i.mealId === adj.mealId &&
      i.food.id === adj.foodId &&
      i.optionNumber !== originalItem.optionNumber
    );
    
    // Criar ajustes equivalentes
    for (const equivItem of equivalentItems) {
      // Calcular proporção de ajuste
      const ratio = adj.newGrams / adj.originalGrams;
      const equivNewGrams = Math.round(equivItem.quantityGrams * ratio);
      
      if (equivNewGrams !== equivItem.quantityGrams) {
        const equivOldNutrients = calculateNutrients(equivItem.food, equivItem.quantityGrams);
        const equivNewNutrients = calculateNutrients(equivItem.food, equivNewGrams);
        
        allAdjustments.push({
          itemId: equivItem.id,
          mealId: equivItem.mealId,
          mealName: equivItem.mealName,
          optionId: equivItem.optionId,
          foodId: equivItem.food.id,
          foodName: equivItem.food.name,
          originalGrams: equivItem.quantityGrams,
          newGrams: equivNewGrams,
          macroDelta: {
            protein: equivNewNutrients.protein - equivOldNutrients.protein,
            carbs: equivNewNutrients.carbs - equivOldNutrients.carbs,
            fat: equivNewNutrients.fat - equivOldNutrients.fat,
            calories: equivNewNutrients.calories - equivOldNutrients.calories,
          },
          reason: 'Propagação para opção equivalente',
        });
      }
    }
  }
  
  return allAdjustments;
}

/**
 * Arredonda macros para exibição.
 */
function roundMacros(macros: MacroTargets): MacroTargets {
  return {
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    calories: Math.round(macros.calories),
  };
}

// Re-exports
export type { MacroTargets, MacroDeltas } from './nutrition-contracts';
