// =====================================================
// REBALANCER CORE - CAMADA DE DOMÍNIO PURA
// =====================================================
// Este módulo contém a lógica PURA do rebalanceador.
// 
// REGRAS INVIOLÁVEIS:
// 1. NÃO depende de React, hooks, ou qualquer framework
// 2. NÃO faz chamadas ao banco de dados
// 3. NÃO usa IA para decisões
// 4. Recebe dados puros, retorna snapshot imutável
// 5. Apenas CALCULA - não decide o que comer
// =====================================================

import {
  CANONICAL_CATEGORIES,
  FoodCategory,
  isValidCategory,
} from './food-categories';

// =====================================================
// TIPOS E INTERFACES
// =====================================================

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface MacroDeltas {
  protein: number;
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
  servingGrams: number; // Gramas base para cálculo (normalmente 100g)
}

export interface PlanItem {
  id: string;           // ID do meal_option_food
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

export interface RebalanceSnapshot {
  planId: string;
  version: number;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros: MacroTargets;
  adjustments: QuantityAdjustment[];
  supplementNeeds: SupplementNeed[];
  isValid: boolean;
  validationErrors: string[];
}

export interface RebalanceOptions {
  tolerancePercent?: number;       // Tolerância para considerar "já balanceado" (default: 2%)
  maxAdjustmentPercent?: number;   // Máximo ajuste por alimento (default: 50%)
  minQuantityGrams?: number;       // Quantidade mínima permitida (default: 10g)
  allowSupplements?: boolean;      // Se deve sinalizar necessidade de suplementos
}

// =====================================================
// CLASSE DE ERRO DE GOVERNANÇA
// =====================================================

export class GovernanceError extends Error {
  constructor(message: string) {
    super(`[GOVERNANÇA] ${message}`);
    this.name = 'GovernanceError';
  }
}

// =====================================================
// FUNÇÕES DE VALIDAÇÃO
// =====================================================

/**
 * Valida que todos os itens usam categorias canônicas.
 * ESSENCIAL para prevenir regressão de categorias.
 */
export function assertAllCategoriesAreCanonical(items: PlanItem[]): void {
  for (const item of items) {
    const category = item.food.category?.toLowerCase();
    if (category && !CANONICAL_CATEGORIES.includes(category as FoodCategory)) {
      throw new GovernanceError(
        `Categoria inválida detectada: "${item.food.category}" no alimento "${item.food.name}". ` +
        `Categorias válidas: ${CANONICAL_CATEGORIES.join(', ')}`
      );
    }
  }
}

/**
 * Valida que nenhuma quantidade é negativa ou abaixo do mínimo.
 */
export function validateQuantities(
  adjustments: QuantityAdjustment[],
  minGrams: number
): string[] {
  const errors: string[] = [];
  
  for (const adj of adjustments) {
    if (adj.newGrams < 0) {
      errors.push(`Quantidade negativa para ${adj.foodName}: ${adj.newGrams}g`);
    }
    if (adj.newGrams > 0 && adj.newGrams < minGrams) {
      errors.push(`Quantidade abaixo do mínimo (${minGrams}g) para ${adj.foodName}: ${adj.newGrams}g`);
    }
  }
  
  return errors;
}

/**
 * Valida que os macros propostos estão dentro da tolerância.
 */
export function validateMacrosWithinTolerance(
  proposed: MacroTargets,
  target: MacroTargets,
  tolerancePercent: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const checkTolerance = (
    name: string,
    proposed: number,
    target: number,
    tolerance: number
  ) => {
    if (target === 0) return;
    const diff = Math.abs(proposed - target);
    const diffPercent = (diff / target) * 100;
    if (diffPercent > tolerance) {
      errors.push(`${name}: ${proposed.toFixed(0)} vs meta ${target} (${diffPercent.toFixed(1)}% de diferença)`);
    }
  };
  
  checkTolerance('Proteína', proposed.protein, target.protein, tolerancePercent);
  checkTolerance('Carboidrato', proposed.carbs, target.carbs, tolerancePercent);
  checkTolerance('Gordura', proposed.fat, target.fat, tolerancePercent);
  checkTolerance('Calorias', proposed.calories, target.calories, tolerancePercent);
  
  return { isValid: errors.length === 0, errors };
}

// =====================================================
// FUNÇÕES DE CÁLCULO PURAS
// =====================================================

/**
 * Calcula nutrientes para uma quantidade em gramas.
 * Assume que os valores do alimento são por servingGrams (normalmente 100g).
 */
export function calculateNutrients(food: FoodItem, grams: number): MacroDeltas {
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
 * Trabalha com float, sem arredondamento.
 */
export function sumMacros(items: PlanItem[]): MacroTargets {
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let calories = 0;
  
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
 * Calcula os deltas entre o atual e a meta.
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
 * Verifica se os macros já estão dentro da tolerância.
 */
export function isWithinTolerance(
  current: MacroTargets,
  target: MacroTargets,
  tolerancePercent: number
): boolean {
  const check = (current: number, target: number): boolean => {
    if (target === 0) return current === 0;
    const diffPercent = Math.abs((current - target) / target) * 100;
    return diffPercent <= tolerancePercent;
  };
  
  return (
    check(current.protein, target.protein) &&
    check(current.carbs, target.carbs) &&
    check(current.fat, target.fat) &&
    check(current.calories, target.calories)
  );
}

// =====================================================
// FUNÇÕES DE AJUSTE POR CATEGORIA
// =====================================================

/**
 * Filtra itens por categoria de macronutriente dominante.
 */
export function filterByDominantMacro(
  items: PlanItem[],
  macro: 'protein' | 'carbs' | 'fat'
): PlanItem[] {
  return items.filter(item => {
    const food = item.food;
    switch (macro) {
      case 'protein':
        return food.protein > food.carbs && food.protein > food.fat;
      case 'carbs':
        return food.carbs > food.protein && food.carbs > food.fat;
      case 'fat':
        return food.fat > food.protein && food.fat > food.carbs;
    }
  });
}

/**
 * Filtra itens por categoria canônica.
 */
export function filterByCategory(items: PlanItem[], category: FoodCategory): PlanItem[] {
  return items.filter(item => 
    item.food.category?.toLowerCase() === category && item.isActive
  );
}

/**
 * Ajusta itens para cobrir um déficit de macro específico.
 * Retorna o déficit restante e os ajustes feitos.
 */
export function adjustForDeficit(
  items: PlanItem[],
  deficit: number,
  macroKey: 'protein' | 'carbs' | 'fat',
  options: Required<RebalanceOptions>
): { remainingDeficit: number; adjustments: QuantityAdjustment[] } {
  if (deficit <= 0 || items.length === 0) {
    return { remainingDeficit: deficit, adjustments: [] };
  }
  
  const adjustments: QuantityAdjustment[] = [];
  let remaining = deficit;
  
  // Ordenar por densidade do macro (maior primeiro)
  const sorted = [...items].sort((a, b) => {
    const densityA = a.food[macroKey] / a.food.servingGrams;
    const densityB = b.food[macroKey] / b.food.servingGrams;
    return densityB - densityA;
  });
  
  for (const item of sorted) {
    if (remaining <= 0) break;
    
    const food = item.food;
    const currentQty = item.quantityGrams;
    const maxIncrease = currentQty * options.maxAdjustmentPercent;
    
    // Calcular quantos gramas são necessários para cobrir o déficit
    const macroPer100g = (food[macroKey] / food.servingGrams) * 100;
    if (macroPer100g === 0) continue;
    
    const gramsNeeded = (remaining / macroPer100g) * 100;
    const actualIncrease = Math.min(gramsNeeded, maxIncrease);
    
    if (actualIncrease < 5) continue; // Ignorar ajustes muito pequenos
    
    const newQty = Math.round(currentQty + actualIncrease);
    const macroGain = (actualIncrease / food.servingGrams) * food[macroKey];
    
    remaining -= macroGain;
    
    const oldNutrients = calculateNutrients(food, currentQty);
    const newNutrients = calculateNutrients(food, newQty);
    
    adjustments.push({
      itemId: item.id,
      mealId: item.mealId,
      mealName: item.mealName,
      optionId: item.optionId,
      foodId: food.id,
      foodName: food.name,
      originalGrams: currentQty,
      newGrams: newQty,
      macroDelta: {
        protein: newNutrients.protein - oldNutrients.protein,
        carbs: newNutrients.carbs - oldNutrients.carbs,
        fat: newNutrients.fat - oldNutrients.fat,
        calories: newNutrients.calories - oldNutrients.calories,
      },
      reason: `Aumentar ${macroKey === 'protein' ? 'proteína' : macroKey === 'carbs' ? 'carboidrato' : 'gordura'} em ${macroGain.toFixed(1)}g`,
    });
  }
  
  return { remainingDeficit: Math.max(0, remaining), adjustments };
}

/**
 * Reduz itens para corrigir um excesso de macro específico.
 * Retorna o excesso restante e os ajustes feitos.
 */
export function adjustForExcess(
  items: PlanItem[],
  excess: number,
  macroKey: 'protein' | 'carbs' | 'fat',
  options: Required<RebalanceOptions>,
  existingAdjustments: QuantityAdjustment[]
): { remainingExcess: number; adjustments: QuantityAdjustment[] } {
  if (excess <= 0 || items.length === 0) {
    return { remainingExcess: excess, adjustments: [] };
  }
  
  const adjustments: QuantityAdjustment[] = [];
  let remaining = excess;
  
  // Ordenar por densidade do macro (menor primeiro - priorizar reduzir os menos densos)
  const sorted = [...items].sort((a, b) => {
    const densityA = a.food[macroKey] / a.food.servingGrams;
    const densityB = b.food[macroKey] / b.food.servingGrams;
    return densityA - densityB;
  });
  
  for (const item of sorted) {
    if (remaining <= 0) break;
    
    // Não ajustar o mesmo item duas vezes
    if (existingAdjustments.some(a => a.itemId === item.id)) continue;
    
    const food = item.food;
    const currentQty = item.quantityGrams;
    const maxDecrease = currentQty * 0.3; // Máximo 30% de redução
    
    const macroPer100g = (food[macroKey] / food.servingGrams) * 100;
    if (macroPer100g === 0) continue;
    
    const gramsToReduce = (remaining / macroPer100g) * 100;
    const actualDecrease = Math.min(gramsToReduce, maxDecrease);
    
    if (actualDecrease < 5) continue;
    
    const newQty = Math.max(options.minQuantityGrams, Math.round(currentQty - actualDecrease));
    const actualReduction = currentQty - newQty;
    const macroLoss = (actualReduction / food.servingGrams) * food[macroKey];
    
    remaining -= macroLoss;
    
    const oldNutrients = calculateNutrients(food, currentQty);
    const newNutrients = calculateNutrients(food, newQty);
    
    adjustments.push({
      itemId: item.id,
      mealId: item.mealId,
      mealName: item.mealName,
      optionId: item.optionId,
      foodId: food.id,
      foodName: food.name,
      originalGrams: currentQty,
      newGrams: newQty,
      macroDelta: {
        protein: newNutrients.protein - oldNutrients.protein,
        carbs: newNutrients.carbs - oldNutrients.carbs,
        fat: newNutrients.fat - oldNutrients.fat,
        calories: newNutrients.calories - oldNutrients.calories,
      },
      reason: `Reduzir ${macroKey === 'protein' ? 'proteína' : macroKey === 'carbs' ? 'carboidrato' : 'gordura'} em ${macroLoss.toFixed(1)}g`,
    });
  }
  
  return { remainingExcess: Math.max(0, remaining), adjustments };
}

// =====================================================
// FUNÇÃO PRINCIPAL DO REBALANCEADOR
// =====================================================

const DEFAULT_OPTIONS: Required<RebalanceOptions> = {
  tolerancePercent: 2,
  maxAdjustmentPercent: 0.5,
  minQuantityGrams: 10,
  allowSupplements: false,
};

/**
 * FUNÇÃO PRINCIPAL: Rebalanceia um plano alimentar.
 * 
 * REGRAS:
 * - Não escolhe alimentos novos
 * - Não muda categorias
 * - Não cria suplementos (apenas sinaliza necessidade)
 * - Ajusta porções
 * - Redistribui macros
 * - Valida consistência
 * 
 * ORDEM DE AJUSTE (FIXA):
 * 1. Proteínas (estrutural)
 * 2. Carboidratos (flexível)
 * 3. Gorduras (ajuste fino calórico)
 */
export function rebalancePlan(
  plan: DietPlan,
  target: MacroTargets,
  options: RebalanceOptions = {}
): RebalanceSnapshot {
  const opts: Required<RebalanceOptions> = { ...DEFAULT_OPTIONS, ...options };
  
  // ===== PASSO 1: NORMALIZAÇÃO INICIAL =====
  const activeItems = plan.items.filter(item => item.isActive);
  
  // Validar categorias canônicas - ESSENCIAL
  assertAllCategoriesAreCanonical(activeItems);
  
  // Usar apenas a primeira opção de cada refeição para cálculo
  // (as opções são equivalentes nutricionalmente)
  const firstOptionItems = activeItems.filter(item => item.optionNumber === 1);
  
  // ===== PASSO 2: CALCULAR ESTADO ATUAL =====
  const currentMacros = sumMacros(firstOptionItems);
  
  // ===== PASSO 3: CALCULAR DELTAS =====
  const deltas = calculateDeltas(currentMacros, target);
  
  // Se já está dentro da tolerância, retornar sem mudanças
  if (isWithinTolerance(currentMacros, target, opts.tolerancePercent)) {
    return {
      planId: plan.id,
      version: plan.version,
      currentMacros,
      targetMacros: target,
      proposedMacros: currentMacros,
      adjustments: [],
      supplementNeeds: [],
      isValid: true,
      validationErrors: [],
    };
  }
  
  // ===== PASSO 4-6: AJUSTE POR CATEGORIA (ORDEM FIXA) =====
  const allAdjustments: QuantityAdjustment[] = [];
  
  // Filtrar alimentos por macro dominante (excluindo suplementos)
  const proteinItems = filterByDominantMacro(firstOptionItems, 'protein')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos');
  const carbItems = filterByDominantMacro(firstOptionItems, 'carbs')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos');
  const fatItems = filterByDominantMacro(firstOptionItems, 'fat')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos');
  
  // 1. PROTEÍNAS (primeira prioridade)
  let proteinDeficit = deltas.protein;
  if (proteinDeficit > 0) {
    const result = adjustForDeficit(proteinItems, proteinDeficit, 'protein', opts);
    proteinDeficit = result.remainingDeficit;
    allAdjustments.push(...result.adjustments);
  } else if (proteinDeficit < 0) {
    const result = adjustForExcess(proteinItems, -proteinDeficit, 'protein', opts, allAdjustments);
    proteinDeficit = -result.remainingExcess;
    allAdjustments.push(...result.adjustments);
  }
  
  // 2. CARBOIDRATOS (segunda prioridade)
  let carbsDeficit = deltas.carbs;
  if (carbsDeficit > 0) {
    const result = adjustForDeficit(carbItems, carbsDeficit, 'carbs', opts);
    carbsDeficit = result.remainingDeficit;
    allAdjustments.push(...result.adjustments);
  } else if (carbsDeficit < 0) {
    const result = adjustForExcess(carbItems, -carbsDeficit, 'carbs', opts, allAdjustments);
    carbsDeficit = -result.remainingExcess;
    allAdjustments.push(...result.adjustments);
  }
  
  // 3. GORDURAS (terceira prioridade - ajuste fino)
  let fatDeficit = deltas.fat;
  if (fatDeficit > 0) {
    const result = adjustForDeficit(fatItems, fatDeficit, 'fat', opts);
    fatDeficit = result.remainingDeficit;
    allAdjustments.push(...result.adjustments);
  } else if (fatDeficit < 0) {
    const result = adjustForExcess(fatItems, -fatDeficit, 'fat', opts, allAdjustments);
    fatDeficit = -result.remainingExcess;
    allAdjustments.push(...result.adjustments);
  }
  
  // ===== PASSO 7: SINALIZAR NECESSIDADE DE SUPLEMENTOS =====
  const supplementNeeds: SupplementNeed[] = [];
  
  if (opts.allowSupplements) {
    if (proteinDeficit > 5) {
      supplementNeeds.push({
        type: 'protein',
        deficitGrams: Math.round(proteinDeficit),
        message: `Déficit de ${Math.round(proteinDeficit)}g de proteína não pode ser coberto apenas com alimentos.`,
      });
    }
    if (carbsDeficit > 10) {
      supplementNeeds.push({
        type: 'carbs',
        deficitGrams: Math.round(carbsDeficit),
        message: `Déficit de ${Math.round(carbsDeficit)}g de carboidrato não pode ser coberto apenas com alimentos.`,
      });
    }
    if (fatDeficit > 5) {
      supplementNeeds.push({
        type: 'fat',
        deficitGrams: Math.round(fatDeficit),
        message: `Déficit de ${Math.round(fatDeficit)}g de gordura não pode ser coberto apenas com alimentos.`,
      });
    }
  }
  
  // ===== PASSO 8: CALCULAR MACROS PROPOSTOS =====
  let proposedMacros = { ...currentMacros };
  for (const adj of allAdjustments) {
    proposedMacros.protein += adj.macroDelta.protein;
    proposedMacros.carbs += adj.macroDelta.carbs;
    proposedMacros.fat += adj.macroDelta.fat;
    proposedMacros.calories += adj.macroDelta.calories;
  }
  
  // Arredondar apenas no final
  proposedMacros = {
    protein: Math.round(proposedMacros.protein),
    carbs: Math.round(proposedMacros.carbs),
    fat: Math.round(proposedMacros.fat),
    calories: Math.round(proposedMacros.calories),
  };
  
  // ===== PASSO 9: VALIDAÇÃO FINAL =====
  const validationErrors: string[] = [];
  
  // Validar quantidades
  const quantityErrors = validateQuantities(allAdjustments, opts.minQuantityGrams);
  validationErrors.push(...quantityErrors);
  
  // Validar tolerância final (com tolerância mais ampla de 10%)
  const toleranceCheck = validateMacrosWithinTolerance(proposedMacros, target, 10);
  if (!toleranceCheck.isValid) {
    validationErrors.push(...toleranceCheck.errors);
  }
  
  // ===== PASSO 10: RETORNAR SNAPSHOT IMUTÁVEL =====
  return {
    planId: plan.id,
    version: plan.version + 1,
    currentMacros: {
      protein: Math.round(currentMacros.protein),
      carbs: Math.round(currentMacros.carbs),
      fat: Math.round(currentMacros.fat),
      calories: Math.round(currentMacros.calories),
    },
    targetMacros: target,
    proposedMacros,
    adjustments: allAdjustments,
    supplementNeeds,
    isValid: validationErrors.length === 0,
    validationErrors,
  };
}

// =====================================================
// FUNÇÕES UTILITÁRIAS PARA PROPAGAÇÃO
// =====================================================

/**
 * Propaga ajustes da primeira opção para as demais opções equivalentes.
 * Mantém proporcionalidade entre opções.
 */
export function propagateAdjustmentsToOptions(
  adjustments: QuantityAdjustment[],
  allItems: PlanItem[]
): QuantityAdjustment[] {
  const propagated: QuantityAdjustment[] = [...adjustments];
  
  for (const adj of adjustments) {
    // Encontrar o item original
    const originalItem = allItems.find(item => item.id === adj.itemId);
    if (!originalItem) continue;
    
    // Calcular a proporção de mudança
    const changeRatio = adj.newGrams / adj.originalGrams;
    
    // Encontrar itens equivalentes (mesmo alimento, mesma refeição, opções diferentes)
    const equivalentItems = allItems.filter(item =>
      item.mealId === originalItem.mealId &&
      item.food.id === originalItem.food.id &&
      item.optionNumber !== originalItem.optionNumber
    );
    
    for (const eqItem of equivalentItems) {
      const newGrams = Math.round(eqItem.quantityGrams * changeRatio);
      const oldNutrients = calculateNutrients(eqItem.food, eqItem.quantityGrams);
      const newNutrients = calculateNutrients(eqItem.food, newGrams);
      
      propagated.push({
        itemId: eqItem.id,
        mealId: eqItem.mealId,
        mealName: eqItem.mealName,
        optionId: eqItem.optionId,
        foodId: eqItem.food.id,
        foodName: eqItem.food.name,
        originalGrams: eqItem.quantityGrams,
        newGrams,
        macroDelta: {
          protein: newNutrients.protein - oldNutrients.protein,
          carbs: newNutrients.carbs - oldNutrients.carbs,
          fat: newNutrients.fat - oldNutrients.fat,
          calories: newNutrients.calories - oldNutrients.calories,
        },
        reason: `Propagar ajuste da opção ${originalItem.optionNumber}`,
      });
    }
  }
  
  return propagated;
}
