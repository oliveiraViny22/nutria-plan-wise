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
//
// CONTRATO NUTRICIONAL:
// - Proteína: 4 kcal/g
// - Carboidrato: 4 kcal/g
// - Gordura: 9 kcal/g
// - Calorias são TETO ABSOLUTO (±2%)
// =====================================================

import {
  CANONICAL_CATEGORIES,
  FoodCategory,
  isValidCategory,
} from './food-categories';

// =====================================================
// CONSTANTES ENERGÉTICAS (IMUTÁVEIS)
// =====================================================

export const KCAL_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

export const CALORIE_TOLERANCE_PERCENT = 2; // ±2% é o teto absoluto
export const FAT_TOLERANCE_GRAMS = 5; // Gordura não pode exceder meta em mais de ±5g

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
 * REGRA 1 - TETO CALÓRICO ABSOLUTO
 * Valida que as calorias propostas estão dentro de ±2% da meta.
 */
export function validateCalorieCeiling(
  proposedCalories: number,
  targetCalories: number
): { isValid: boolean; error: string | null } {
  const maxCalories = targetCalories * (1 + CALORIE_TOLERANCE_PERCENT / 100);
  const minCalories = targetCalories * (1 - CALORIE_TOLERANCE_PERCENT / 100);
  
  if (proposedCalories > maxCalories) {
    return {
      isValid: false,
      error: `ESTOURO CALÓRICO: ${Math.round(proposedCalories)} kcal excedem o teto de ${Math.round(maxCalories)} kcal (+${((proposedCalories / targetCalories - 1) * 100).toFixed(1)}%)`
    };
  }
  
  if (proposedCalories < minCalories) {
    return {
      isValid: false,
      error: `DÉFICIT CALÓRICO EXCESSIVO: ${Math.round(proposedCalories)} kcal abaixo do mínimo de ${Math.round(minCalories)} kcal`
    };
  }
  
  return { isValid: true, error: null };
}

/**
 * REGRA 4 - CARBOIDRATO E GORDURA NUNCA SOBEM JUNTOS
 * Valida que não há aumento simultâneo de carbs e gordura.
 */
export function validateNoSimultaneousIncrease(
  carbDelta: number,
  fatDelta: number
): { isValid: boolean; error: string | null } {
  if (carbDelta > 0 && fatDelta > 0) {
    return {
      isValid: false,
      error: `VIOLAÇÃO: Carboidrato (+${carbDelta.toFixed(1)}g) e gordura (+${fatDelta.toFixed(1)}g) não podem aumentar simultaneamente`
    };
  }
  return { isValid: true, error: null };
}

/**
 * REGRA 5 - GORDURA É AJUSTE FINO (±5g da meta)
 */
export function validateFatTolerance(
  proposedFat: number,
  targetFat: number
): { isValid: boolean; error: string | null } {
  const diff = proposedFat - targetFat;
  if (Math.abs(diff) > FAT_TOLERANCE_GRAMS) {
    return {
      isValid: false,
      error: `Gordura fora da tolerância: ${proposedFat.toFixed(1)}g vs meta ${targetFat}g (diferença: ${diff > 0 ? '+' : ''}${diff.toFixed(1)}g, max: ±${FAT_TOLERANCE_GRAMS}g)`
    };
  }
  return { isValid: true, error: null };
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
 * Converte macros para calorias usando o contrato nutricional.
 */
export function macrosToCalories(macros: Partial<MacroTargets>): number {
  return (
    (macros.protein || 0) * KCAL_PER_GRAM.protein +
    (macros.carbs || 0) * KCAL_PER_GRAM.carbs +
    (macros.fat || 0) * KCAL_PER_GRAM.fat
  );
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

/**
 * Calcula o "orçamento calórico" disponível após um delta de macro.
 * Usado para garantir que ajustes de proteína sejam compensados.
 */
export function calculateCalorieBudget(
  currentCalories: number,
  targetCalories: number
): number {
  const maxCalories = targetCalories * (1 + CALORIE_TOLERANCE_PERCENT / 100);
  return maxCalories - currentCalories;
}

// =====================================================
// FUNÇÕES DE FILTRAGEM POR CATEGORIA
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
 * Filtra itens que têm quantidade significativa do macro especificado.
 * Mais abrangente que filterByDominantMacro - inclui alimentos onde
 * o macro representa pelo menos 15% das calorias do alimento.
 */
export function filterBySignificantMacro(
  items: PlanItem[],
  macro: 'protein' | 'carbs' | 'fat'
): PlanItem[] {
  return items.filter(item => {
    const food = item.food;
    const totalMacroGrams = food.protein + food.carbs + food.fat;
    if (totalMacroGrams === 0) return false;
    
    // Calcular porcentagem de calorias do macro
    const macroCalories = food[macro] * KCAL_PER_GRAM[macro];
    const percentOfCalories = (macroCalories / food.calories) * 100;
    
    // Incluir se o macro representa pelo menos 15% das calorias
    // OU se tem pelo menos 3g do macro por 100g
    const macroValuePer100g = (food[macro] / food.servingGrams) * 100;
    return percentOfCalories >= 15 || macroValuePer100g >= 3;
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

// =====================================================
// ESTÁGIO 1: SOLVER ENERGÉTICO
// =====================================================

interface EnergySolverResult {
  isViable: boolean;
  targetProteinDelta: number;
  targetCarbsDelta: number;
  targetFatDelta: number;
  caloriesBudget: number;
  errors: string[];
}

/**
 * ESTÁGIO 1 - SOLVER ENERGÉTICO
 * 
 * Calcula a viabilidade matemática do rebalanceamento:
 * - Trava calorias alvo
 * - Converte metas de macros em kcal
 * - Calcula deltas energéticos
 * - Valida viabilidade matemática
 */
function solveEnergyEquation(
  current: MacroTargets,
  target: MacroTargets
): EnergySolverResult {
  const errors: string[] = [];
  
  // Calcular deltas de macros
  const proteinDelta = target.protein - current.protein;
  const carbsDelta = target.carbs - current.carbs;
  const fatDelta = target.fat - current.fat;
  
  // Calcular impacto calórico de cada delta
  const proteinCalorieImpact = proteinDelta * KCAL_PER_GRAM.protein;
  const carbsCalorieImpact = carbsDelta * KCAL_PER_GRAM.carbs;
  const fatCalorieImpact = fatDelta * KCAL_PER_GRAM.fat;
  
  // Orçamento calórico total disponível
  const maxCalories = target.calories * (1 + CALORIE_TOLERANCE_PERCENT / 100);
  const caloriesBudget = maxCalories - current.calories;
  
  // Verificar se o total de impactos cabe no orçamento
  const totalCalorieImpact = proteinCalorieImpact + carbsCalorieImpact + fatCalorieImpact;
  
  if (totalCalorieImpact > caloriesBudget * 1.5) { // Margem de 50% para ajustes
    errors.push(
      `Impacto calórico total (${Math.round(totalCalorieImpact)} kcal) excede orçamento (${Math.round(caloriesBudget)} kcal)`
    );
  }
  
  // Verificar REGRA 4: carbs e gordura não podem subir juntos
  if (carbsDelta > 0 && fatDelta > 0) {
    errors.push(
      `Carboidrato (+${carbsDelta.toFixed(0)}g) e gordura (+${fatDelta.toFixed(0)}g) não podem aumentar simultaneamente`
    );
  }
  
  return {
    isViable: errors.length === 0,
    targetProteinDelta: proteinDelta,
    targetCarbsDelta: carbsDelta,
    targetFatDelta: fatDelta,
    caloriesBudget,
    errors,
  };
}

// =====================================================
// ESTÁGIO 2: DISTRIBUIÇÃO ALIMENTAR
// =====================================================

interface AdjustmentContext {
  items: PlanItem[];
  adjustments: QuantityAdjustment[];
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  options: Required<RebalanceOptions>;
  caloriesBudget: number;
}

/**
 * Aplica um ajuste a um item e retorna o delta resultante.
 */
function applyAdjustment(
  item: PlanItem,
  newGrams: number,
  reason: string
): QuantityAdjustment {
  const oldNutrients = calculateNutrients(item.food, item.quantityGrams);
  const newNutrients = calculateNutrients(item.food, newGrams);
  
  return {
    itemId: item.id,
    mealId: item.mealId,
    mealName: item.mealName,
    optionId: item.optionId,
    foodId: item.food.id,
    foodName: item.food.name,
    originalGrams: item.quantityGrams,
    newGrams,
    macroDelta: {
      protein: newNutrients.protein - oldNutrients.protein,
      carbs: newNutrients.carbs - oldNutrients.carbs,
      fat: newNutrients.fat - oldNutrients.fat,
      calories: newNutrients.calories - oldNutrients.calories,
    },
    reason,
  };
}

/**
 * Calcula gramas para atingir um delta de macro específico.
 */
function calculateGramsForMacroDelta(
  food: FoodItem,
  currentGrams: number,
  targetMacroDelta: number,
  macroKey: 'protein' | 'carbs' | 'fat'
): number {
  const macroPer100g = (food[macroKey] / food.servingGrams) * 100;
  if (macroPer100g === 0) return currentGrams;
  
  const gramsNeeded = (targetMacroDelta / macroPer100g) * 100;
  return currentGrams + gramsNeeded;
}

/**
 * REGRA 3 - PROTEÍNA NÃO ADICIONA CALORIAS
 * 
 * Ao aumentar proteína:
 * - O sistema DEVE remover calorias equivalentes
 * - Priorizar redução de carboidratos
 * - Usar gordura apenas se carboidrato não for suficiente
 */
function adjustProteinWithCompensation(
  ctx: AdjustmentContext,
  proteinDeficit: number
): { adjustments: QuantityAdjustment[]; remainingDeficit: number } {
  const adjustments: QuantityAdjustment[] = [];
  let remaining = proteinDeficit;
  
  if (remaining <= 1) {
    return { adjustments, remainingDeficit: 0 };
  }
  
  // Filtrar alimentos proteicos (excluindo suplementos)
  const proteinItems = filterByDominantMacro(ctx.items, 'protein')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos')
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .sort((a, b) => {
      const densityA = a.food.protein / a.food.servingGrams;
      const densityB = b.food.protein / b.food.servingGrams;
      return densityB - densityA;
    });
  
  // Filtrar alimentos de carboidrato para compensação
  const carbItems = filterByDominantMacro(ctx.items, 'carbs')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos')
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .sort((a, b) => {
      const densityA = a.food.carbs / a.food.servingGrams;
      const densityB = b.food.carbs / b.food.servingGrams;
      return densityB - densityA;
    });
  
  // Calcular calorias máximas permitidas
  const currentCalories = ctx.currentMacros.calories + 
    ctx.adjustments.reduce((sum, a) => sum + a.macroDelta.calories, 0);
  const maxCalories = ctx.targetMacros.calories * (1 + CALORIE_TOLERANCE_PERCENT / 100);
  let caloriesBudget = maxCalories - currentCalories;
  
  for (const proteinItem of proteinItems) {
    if (remaining <= 1) break;
    
    const food = proteinItem.food;
    const currentQty = proteinItem.quantityGrams;
    const maxIncrease = currentQty * ctx.options.maxAdjustmentPercent;
    
    // Calcular quanto de proteína podemos adicionar
    const proteinPer100g = (food.protein / food.servingGrams) * 100;
    if (proteinPer100g === 0) continue;
    
    const gramsNeeded = (remaining / proteinPer100g) * 100;
    const actualIncrease = Math.min(gramsNeeded, maxIncrease);
    
    if (actualIncrease < 5) continue;
    
    // Calcular impacto calórico deste aumento
    const proteinAdjustment = applyAdjustment(
      proteinItem,
      Math.round(currentQty + actualIncrease),
      `Aumentar proteína em ${((actualIncrease / food.servingGrams) * food.protein).toFixed(1)}g`
    );
    
    const calorieImpact = proteinAdjustment.macroDelta.calories;
    
    // Se o aumento de proteína estoura o orçamento, compensar com carbs
    if (calorieImpact > caloriesBudget) {
      const caloriesToCompensate = calorieImpact - caloriesBudget;
      
      // Tentar compensar reduzindo carboidratos
      let compensated = 0;
      for (const carbItem of carbItems) {
        if (compensated >= caloriesToCompensate) break;
        
        const carbFood = carbItem.food;
        const carbCurrentQty = carbItem.quantityGrams;
        const maxDecrease = carbCurrentQty * 0.5; // Máximo 50% de redução
        
        const carbsPer100g = (carbFood.carbs / carbFood.servingGrams) * 100;
        if (carbsPer100g === 0) continue;
        
        const calPerGram = (carbFood.calories / carbFood.servingGrams);
        const gramsToReduce = Math.min(
          (caloriesToCompensate - compensated) / calPerGram,
          maxDecrease
        );
        
        if (gramsToReduce < 5) continue;
        
        const newQty = Math.max(ctx.options.minQuantityGrams, Math.round(carbCurrentQty - gramsToReduce));
        const actualReduction = carbCurrentQty - newQty;
        
        if (actualReduction < 1) continue;
        
        const carbAdjustment = applyAdjustment(
          carbItem,
          newQty,
          `Compensar aumento de proteína reduzindo carboidrato`
        );
        
        adjustments.push(carbAdjustment);
        compensated += Math.abs(carbAdjustment.macroDelta.calories);
      }
      
      // Se não conseguiu compensar o suficiente, não aplicar o aumento de proteína
      if (compensated < caloriesToCompensate * 0.8) { // Tolerância de 20%
        // Remover ajustes de compensação que não serão usados
        adjustments.length = adjustments.length - adjustments.filter(a => 
          a.reason.includes('Compensar aumento de proteína')
        ).length;
        continue; // Pular este item de proteína
      }
      
      caloriesBudget += compensated - calorieImpact;
    } else {
      caloriesBudget -= calorieImpact;
    }
    
    adjustments.push(proteinAdjustment);
    remaining -= proteinAdjustment.macroDelta.protein;
  }
  
  return { adjustments, remainingDeficit: Math.max(0, remaining) };
}

/**
 * Ajusta carboidratos respeitando o teto calórico.
 * REGRA 4: Não pode aumentar se gordura também aumentou.
 */
function adjustCarbsWithCalorieCeiling(
  ctx: AdjustmentContext,
  carbsDelta: number,
  fatDelta: number
): { adjustments: QuantityAdjustment[]; remainingDelta: number } {
  const adjustments: QuantityAdjustment[] = [];
  
  // Se carbsDelta > 0 (precisa adicionar) e fatDelta > 0 (gordura já aumentou)
  // NÃO PODE aumentar carbs (REGRA 4)
  if (carbsDelta > 0 && fatDelta > 0) {
    return { adjustments, remainingDelta: carbsDelta };
  }
  
  // Filtrar alimentos de carboidrato
  const carbItems = filterByDominantMacro(ctx.items, 'carbs')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos')
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .sort((a, b) => {
      const densityA = a.food.carbs / a.food.servingGrams;
      const densityB = b.food.carbs / b.food.servingGrams;
      return densityB - densityA;
    });
  
  // Calcular orçamento calórico atual
  const currentCalories = ctx.currentMacros.calories + 
    ctx.adjustments.reduce((sum, a) => sum + a.macroDelta.calories, 0);
  const maxCalories = ctx.targetMacros.calories * (1 + CALORIE_TOLERANCE_PERCENT / 100);
  let caloriesBudget = maxCalories - currentCalories;
  
  let remaining = carbsDelta;
  
  if (carbsDelta > 0) {
    // AUMENTAR carbs
    for (const item of carbItems) {
      if (remaining <= 1 || caloriesBudget <= 0) break;
      
      const food = item.food;
      const currentQty = item.quantityGrams;
      const maxIncrease = currentQty * ctx.options.maxAdjustmentPercent;
      
      const carbsPer100g = (food.carbs / food.servingGrams) * 100;
      if (carbsPer100g === 0) continue;
      
      const gramsNeeded = (remaining / carbsPer100g) * 100;
      
      // Calcular limite pelo orçamento calórico
      const calPerGram = food.calories / food.servingGrams;
      const maxGramsByCalories = caloriesBudget / calPerGram;
      
      const actualIncrease = Math.min(gramsNeeded, maxIncrease, maxGramsByCalories);
      
      if (actualIncrease < 5) continue;
      
      const adjustment = applyAdjustment(
        item,
        Math.round(currentQty + actualIncrease),
        `Aumentar carboidrato`
      );
      
      adjustments.push(adjustment);
      remaining -= adjustment.macroDelta.carbs;
      caloriesBudget -= adjustment.macroDelta.calories;
    }
  } else if (carbsDelta < 0) {
    // REDUZIR carbs
    remaining = -carbsDelta;
    for (const item of carbItems) {
      if (remaining <= 1) break;
      
      const food = item.food;
      const currentQty = item.quantityGrams;
      const maxDecrease = currentQty * 0.5;
      
      const carbsPer100g = (food.carbs / food.servingGrams) * 100;
      if (carbsPer100g === 0) continue;
      
      const gramsToReduce = (remaining / carbsPer100g) * 100;
      const actualDecrease = Math.min(gramsToReduce, maxDecrease);
      
      if (actualDecrease < 3) continue;
      
      const newQty = Math.max(ctx.options.minQuantityGrams, Math.round(currentQty - actualDecrease));
      const actualReduction = currentQty - newQty;
      
      if (actualReduction < 1) continue;
      
      const adjustment = applyAdjustment(item, newQty, `Reduzir carboidrato`);
      
      adjustments.push(adjustment);
      remaining += adjustment.macroDelta.carbs; // macroDelta.carbs é negativo
    }
    
    remaining = -remaining; // Converter de volta para delta original
  }
  
  return { adjustments, remainingDelta: Math.max(0, remaining) };
}

/**
 * REGRA 5 - GORDURA É AJUSTE FINO
 * 
 * A gordura:
 * - Serve apenas para ajuste final de calorias
 * - Não pode exceder a meta em mais de ±5g
 * - Nunca é usada para corrigir proteína
 */
function adjustFatAsFinetuning(
  ctx: AdjustmentContext,
  fatDelta: number,
  carbsDelta: number
): { adjustments: QuantityAdjustment[]; remainingDelta: number } {
  const adjustments: QuantityAdjustment[] = [];
  
  // Se fatDelta > 0 (precisa adicionar) e carbsDelta > 0 (carbs já aumentou)
  // NÃO PODE aumentar gordura (REGRA 4)
  if (fatDelta > 0 && carbsDelta > 0) {
    return { adjustments, remainingDelta: fatDelta };
  }
  
  // Limitar ajuste de gordura a ±5g (REGRA 5)
  const limitedFatDelta = Math.max(-FAT_TOLERANCE_GRAMS, Math.min(FAT_TOLERANCE_GRAMS, fatDelta));
  
  if (Math.abs(limitedFatDelta) < 1) {
    return { adjustments, remainingDelta: Math.abs(fatDelta) > FAT_TOLERANCE_GRAMS ? fatDelta : 0 };
  }
  
  // Filtrar alimentos de gordura
  const fatItems = filterByDominantMacro(ctx.items, 'fat')
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos')
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .sort((a, b) => {
      const densityA = a.food.fat / a.food.servingGrams;
      const densityB = b.food.fat / b.food.servingGrams;
      return densityB - densityA;
    });
  
  let remaining = Math.abs(limitedFatDelta);
  
  if (limitedFatDelta > 0) {
    // AUMENTAR gordura (ajuste fino)
    for (const item of fatItems) {
      if (remaining <= 0.5) break;
      
      const food = item.food;
      const currentQty = item.quantityGrams;
      const maxIncrease = currentQty * 0.3; // Máximo 30% para gordura (ajuste fino)
      
      const fatPer100g = (food.fat / food.servingGrams) * 100;
      if (fatPer100g === 0) continue;
      
      const gramsNeeded = (remaining / fatPer100g) * 100;
      const actualIncrease = Math.min(gramsNeeded, maxIncrease);
      
      if (actualIncrease < 3) continue;
      
      const adjustment = applyAdjustment(
        item,
        Math.round(currentQty + actualIncrease),
        `Ajuste fino de gordura`
      );
      
      adjustments.push(adjustment);
      remaining -= adjustment.macroDelta.fat;
    }
  } else {
    // REDUZIR gordura
    for (const item of fatItems) {
      if (remaining <= 0.5) break;
      
      const food = item.food;
      const currentQty = item.quantityGrams;
      const maxDecrease = currentQty * 0.3;
      
      const fatPer100g = (food.fat / food.servingGrams) * 100;
      if (fatPer100g === 0) continue;
      
      const gramsToReduce = (remaining / fatPer100g) * 100;
      const actualDecrease = Math.min(gramsToReduce, maxDecrease);
      
      if (actualDecrease < 2) continue;
      
      const newQty = Math.max(ctx.options.minQuantityGrams, Math.round(currentQty - actualDecrease));
      const actualReduction = currentQty - newQty;
      
      if (actualReduction < 1) continue;
      
      const adjustment = applyAdjustment(item, newQty, `Ajuste fino de gordura`);
      
      adjustments.push(adjustment);
      remaining += adjustment.macroDelta.fat; // macroDelta.fat é negativo
    }
  }
  
  return { adjustments, remainingDelta: Math.max(0, remaining) };
}

// =====================================================
// FUNÇÃO PRINCIPAL DO REBALANCEADOR
// =====================================================

const DEFAULT_OPTIONS: Required<RebalanceOptions> = {
  tolerancePercent: 2,
  maxAdjustmentPercent: 0.5, // 50% de ajuste permitido
  minQuantityGrams: 10,
  allowSupplements: false,
};

/**
 * FUNÇÃO PRINCIPAL: Rebalanceia um plano alimentar.
 * 
 * REGRAS INVIOLÁVEIS:
 * 1. TETO CALÓRICO ABSOLUTO (±2%)
 * 2. ORDEM FIXA: Proteína → Carboidrato → Gordura
 * 3. PROTEÍNA NÃO ADICIONA CALORIAS (compensação obrigatória)
 * 4. CARBO E GORDURA NUNCA SOBEM JUNTOS
 * 5. GORDURA É AJUSTE FINO (±5g)
 * 6. FALHA SEGURA (sinaliza suplementação se impossível)
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
  
  // ===== PASSO 3: VERIFICAR SE JÁ ESTÁ BALANCEADO =====
  if (isWithinTolerance(currentMacros, target, opts.tolerancePercent)) {
    return {
      planId: plan.id,
      version: plan.version,
      currentMacros: roundMacros(currentMacros),
      targetMacros: target,
      proposedMacros: roundMacros(currentMacros),
      adjustments: [],
      supplementNeeds: [],
      isValid: true,
      validationErrors: [],
    };
  }
  
  // ===== PASSO 4: SOLVER ENERGÉTICO =====
  const energyResult = solveEnergyEquation(currentMacros, target);
  
  // Se não é viável matematicamente, retornar com erro
  if (!energyResult.isViable) {
    return {
      planId: plan.id,
      version: plan.version,
      currentMacros: roundMacros(currentMacros),
      targetMacros: target,
      proposedMacros: roundMacros(currentMacros),
      adjustments: [],
      supplementNeeds: [],
      isValid: false,
      validationErrors: energyResult.errors,
    };
  }
  
  // ===== PASSO 5: DISTRIBUIÇÃO ALIMENTAR (ORDEM FIXA) =====
  const allAdjustments: QuantityAdjustment[] = [];
  
  // Contexto para ajustes
  const ctx: AdjustmentContext = {
    items: firstOptionItems,
    adjustments: allAdjustments,
    currentMacros,
    targetMacros: target,
    options: opts,
    caloriesBudget: energyResult.caloriesBudget,
  };
  
  // 1. PROTEÍNAS (primeira prioridade - com compensação calórica)
  let proteinDeficit = energyResult.targetProteinDelta;
  if (proteinDeficit > 0) {
    const proteinResult = adjustProteinWithCompensation(ctx, proteinDeficit);
    allAdjustments.push(...proteinResult.adjustments);
    proteinDeficit = proteinResult.remainingDeficit;
  } else if (proteinDeficit < 0) {
    // Reduzir proteína
    const proteinItems = filterByDominantMacro(firstOptionItems, 'protein')
      .filter(item => item.food.category?.toLowerCase() !== 'suplementos');
    
    let excess = -proteinDeficit;
    for (const item of proteinItems) {
      if (excess <= 1) break;
      
      const food = item.food;
      const currentQty = item.quantityGrams;
      const maxDecrease = currentQty * 0.4;
      
      const proteinPer100g = (food.protein / food.servingGrams) * 100;
      if (proteinPer100g === 0) continue;
      
      const gramsToReduce = (excess / proteinPer100g) * 100;
      const actualDecrease = Math.min(gramsToReduce, maxDecrease);
      
      if (actualDecrease < 5) continue;
      
      const newQty = Math.max(opts.minQuantityGrams, Math.round(currentQty - actualDecrease));
      const adjustment = applyAdjustment(item, newQty, `Reduzir proteína`);
      
      allAdjustments.push(adjustment);
      excess += adjustment.macroDelta.protein; // macroDelta.protein é negativo
    }
  }
  
  // Atualizar contexto após ajustes de proteína
  ctx.adjustments = allAdjustments;
  
  // Calcular delta de gordura realizado até agora (para REGRA 4)
  const currentFatDelta = allAdjustments.reduce((sum, a) => sum + a.macroDelta.fat, 0);
  
  // 2. CARBOIDRATOS (segunda prioridade)
  const carbsResult = adjustCarbsWithCalorieCeiling(
    ctx,
    energyResult.targetCarbsDelta,
    currentFatDelta
  );
  allAdjustments.push(...carbsResult.adjustments);
  
  // Atualizar contexto
  ctx.adjustments = allAdjustments;
  
  // Calcular delta de carbs realizado até agora (para REGRA 4)
  const currentCarbsDelta = allAdjustments.reduce((sum, a) => sum + a.macroDelta.carbs, 0);
  
  // 3. GORDURAS (terceira prioridade - ajuste fino)
  const fatResult = adjustFatAsFinetuning(
    ctx,
    energyResult.targetFatDelta,
    currentCarbsDelta
  );
  allAdjustments.push(...fatResult.adjustments);
  
  // ===== PASSO 6: CALCULAR MACROS PROPOSTOS =====
  let proposedMacros: MacroTargets = { ...currentMacros };
  for (const adj of allAdjustments) {
    proposedMacros.protein += adj.macroDelta.protein;
    proposedMacros.carbs += adj.macroDelta.carbs;
    proposedMacros.fat += adj.macroDelta.fat;
    proposedMacros.calories += adj.macroDelta.calories;
  }
  
  // ===== PASSO 7: VALIDAÇÃO FINAL =====
  const validationErrors: string[] = [];
  
  // Validar quantidades
  const quantityErrors = validateQuantities(allAdjustments, opts.minQuantityGrams);
  validationErrors.push(...quantityErrors);
  
  // REGRA 1: Validar teto calórico absoluto (±2%)
  const calorieValidation = validateCalorieCeiling(proposedMacros.calories, target.calories);
  if (!calorieValidation.isValid && calorieValidation.error) {
    validationErrors.push(calorieValidation.error);
  }
  
  // REGRA 4: Validar que carbs e gordura não subiram juntos
  const finalCarbsDelta = proposedMacros.carbs - currentMacros.carbs;
  const finalFatDelta = proposedMacros.fat - currentMacros.fat;
  const simultaneousValidation = validateNoSimultaneousIncrease(finalCarbsDelta, finalFatDelta);
  if (!simultaneousValidation.isValid && simultaneousValidation.error) {
    validationErrors.push(simultaneousValidation.error);
  }
  
  // ===== PASSO 8: SINALIZAR NECESSIDADE DE SUPLEMENTOS (REGRA 6) =====
  const supplementNeeds: SupplementNeed[] = [];
  
  if (opts.allowSupplements) {
    const finalProteinDeficit = target.protein - proposedMacros.protein;
    const finalCarbsDeficit = target.carbs - proposedMacros.carbs;
    const finalFatDeficit = target.fat - proposedMacros.fat;
    
    if (finalProteinDeficit > 5) {
      supplementNeeds.push({
        type: 'protein',
        deficitGrams: Math.round(finalProteinDeficit),
        message: `Déficit de ${Math.round(finalProteinDeficit)}g de proteína não pode ser coberto apenas com alimentos. Suplementação pode ser necessária.`,
      });
    }
    if (finalCarbsDeficit > 10) {
      supplementNeeds.push({
        type: 'carbs',
        deficitGrams: Math.round(finalCarbsDeficit),
        message: `Déficit de ${Math.round(finalCarbsDeficit)}g de carboidrato não pode ser coberto apenas com alimentos.`,
      });
    }
    if (finalFatDeficit > FAT_TOLERANCE_GRAMS) {
      supplementNeeds.push({
        type: 'fat',
        deficitGrams: Math.round(finalFatDeficit),
        message: `Déficit de ${Math.round(finalFatDeficit)}g de gordura não pode ser coberto apenas com alimentos.`,
      });
    }
  }
  
  // ===== PASSO 9: RETORNAR SNAPSHOT IMUTÁVEL =====
  return {
    planId: plan.id,
    version: plan.version + 1,
    currentMacros: roundMacros(currentMacros),
    targetMacros: target,
    proposedMacros: roundMacros(proposedMacros),
    adjustments: allAdjustments,
    supplementNeeds,
    isValid: validationErrors.length === 0,
    validationErrors,
  };
}

/**
 * Arredonda macros para inteiros.
 */
function roundMacros(macros: MacroTargets): MacroTargets {
  return {
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    calories: Math.round(macros.calories),
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
