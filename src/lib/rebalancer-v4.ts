// =====================================================
// REBALANCER V4 - AJUSTE DE QUANTIDADES PARA METAS
// =====================================================
// 
// CONTRATO:
// - Ajusta QUANTIDADES de alimentos para atingir metas EXATAS
// - Garante calorias e macros diários sem tolerância
// - Mantém estrutura do plano (não troca alimentos)
//
// REGRAS:
// - SEM tolerâncias: valores devem ser exatos
// - Ordem de ajuste: Proteína → Carboidrato → Gordura → Calorias
// - NUNCA troca alimentos ou adiciona suplementos
// =====================================================

import {
  KCAL_PER_GRAM,
  REBALANCER_CONTRACT,
} from './nutrition-contracts';

import {
  CANONICAL_CATEGORIES,
  FoodCategory,
  isValidCategory,
} from './food-categories';

// =====================================================
// TIPOS
// =====================================================

export interface MacroTargets {
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
  reason: string;
}

/**
 * Status do plano após rebalanceamento.
 * APENAS 3 estados possíveis conforme contrato.
 */
export type RebalanceStatus = 
  | 'balanced'           // Plano já está dentro das metas
  | 'adjusted'           // Ajustes aplicados, resultado válido
  | 'blocked_structural'; // Estrutura impede rebalanceamento

export interface StructuralValidation {
  isValid: boolean;
  errors: string[];
}

export interface RebalanceResult {
  status: RebalanceStatus;
  plan?: DietPlan;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros?: MacroTargets;
  adjustments: QuantityAdjustment[];
  reason?: string;
  validationDetails?: StructuralValidation;
}

// =====================================================
// CONSTANTES DE CONTEXTO DE REFEIÇÃO
// =====================================================

const MAIN_MEALS = ['almoço', 'jantar'];
const BREAKFAST_NAMES = ['café da manhã', 'cafe da manha', 'desjejum'];
const SNACK_NAMES = ['lanche da manhã', 'lanche da tarde', 'ceia'];

// Categorias proteicas reais (excluindo suplementos)
const PROTEIN_CATEGORIES: FoodCategory[] = ['proteinas', 'leguminosas', 'laticinios'];

// Categorias base de carboidrato
const CARB_BASE_CATEGORIES: FoodCategory[] = ['carboidratos', 'leguminosas'];

// Categorias de gordura pura
const FAT_CATEGORIES: FoodCategory[] = ['gorduras'];

// =====================================================
// FUNÇÕES DE CÁLCULO PURAS
// =====================================================

function calculateNutrients(food: FoodItem, grams: number): MacroTargets {
  const multiplier = grams / food.servingGrams;
  return {
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
    calories: food.calories * multiplier,
  };
}

function sumMacros(items: PlanItem[]): MacroTargets {
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

function roundMacros(macros: MacroTargets): MacroTargets {
  return {
    protein: Math.round(macros.protein),
    carbs: Math.round(macros.carbs),
    fat: Math.round(macros.fat),
    calories: Math.round(macros.calories),
  };
}

function fatPercentOfCalories(fatGrams: number, totalCalories: number): number {
  if (totalCalories <= 0) return 0;
  const fatCalories = fatGrams * KCAL_PER_GRAM.fat;
  return (fatCalories / totalCalories) * 100;
}

// =====================================================
// VERIFICAÇÃO DE METAS (SEM TOLERÂNCIA)
// =====================================================

function isCaloriesOnTarget(current: number, target: number): boolean {
  if (target === 0) return current === 0;
  // Valor exato (arredondado)
  return Math.round(current) === Math.round(target);
}

function isProteinOnTarget(current: number, target: number): boolean {
  if (target === 0) return current === 0;
  return Math.round(current) === Math.round(target);
}

function isCarbsOnTarget(current: number, target: number): boolean {
  if (target === 0) return current === 0;
  return Math.round(current) === Math.round(target);
}

function isFatOnTarget(current: number, target: number): boolean {
  return Math.round(current) === Math.round(target);
}

function isOnTarget(current: MacroTargets, target: MacroTargets): boolean {
  return (
    isCaloriesOnTarget(current.calories, target.calories) &&
    isProteinOnTarget(current.protein, target.protein) &&
    isCarbsOnTarget(current.carbs, target.carbs) &&
    isFatOnTarget(current.fat, target.fat)
  );
}

// =====================================================
// PRÉ-VALIDAÇÃO ESTRUTURAL (OBRIGATÓRIA)
// =====================================================

function normalizeMealName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isProteinCategory(category: string | null): boolean {
  if (!category) return false;
  return PROTEIN_CATEGORIES.includes(category.toLowerCase() as FoodCategory);
}

function isCarbBaseCategory(category: string | null): boolean {
  if (!category) return false;
  return CARB_BASE_CATEGORIES.includes(category.toLowerCase() as FoodCategory);
}

function isFatCategory(category: string | null): boolean {
  if (!category) return false;
  return FAT_CATEGORIES.includes(category.toLowerCase() as FoodCategory);
}

/**
 * Agrupa itens ativos por refeição
 */
function groupByMeal(items: PlanItem[]): Map<string, PlanItem[]> {
  const meals = new Map<string, PlanItem[]>();
  
  for (const item of items) {
    if (!item.isActive) continue;
    const key = item.mealId;
    if (!meals.has(key)) {
      meals.set(key, []);
    }
    meals.get(key)!.push(item);
  }
  
  return meals;
}

/**
 * REGRA 1: Proteína em todas as refeições
 * Cada refeição deve conter ao menos 1 alimento proteico real
 */
function validateProteinDistribution(items: PlanItem[]): StructuralValidation {
  const errors: string[] = [];
  const meals = groupByMeal(items);
  
  for (const [mealId, mealItems] of meals) {
    const mealName = mealItems[0]?.mealName || 'Refeição';
    
    // Calcular proteína total da refeição
    let mealProtein = 0;
    let hasProteinFood = false;
    
    for (const item of mealItems) {
      const nutrients = calculateNutrients(item.food, item.quantityGrams);
      mealProtein += nutrients.protein;
      
      if (isProteinCategory(item.food.category)) {
        hasProteinFood = true;
      }
    }
    
    // Refeições principais precisam de fonte proteica real
    const normalizedName = normalizeMealName(mealName);
    const isMainMeal = MAIN_MEALS.some(m => normalizedName.includes(m));
    
    if (isMainMeal && !hasProteinFood) {
      errors.push(`${mealName}: refeição principal sem fonte proteica real`);
    }
    
    // Todas as refeições precisam de pelo menos 5g de proteína
    if (mealProtein < 5) {
      errors.push(`${mealName}: proteína insuficiente (${mealProtein.toFixed(1)}g, mín: 5g)`);
    }
  }
  
  // Verificar concentração em poucas refeições
  const mealCount = meals.size;
  if (mealCount >= 3) {
    const proteinByMeal: { name: string; protein: number }[] = [];
    let totalProtein = 0;
    
    for (const [, mealItems] of meals) {
      const mealName = mealItems[0]?.mealName || 'Refeição';
      let mealProtein = 0;
      for (const item of mealItems) {
        mealProtein += calculateNutrients(item.food, item.quantityGrams).protein;
      }
      proteinByMeal.push({ name: mealName, protein: mealProtein });
      totalProtein += mealProtein;
    }
    
    // Se mais de 70% da proteína está em 1 refeição, bloquear
    for (const meal of proteinByMeal) {
      if (totalProtein > 0 && (meal.protein / totalProtein) > 0.7) {
        errors.push(`Proteína concentrada: ${meal.name} tem ${((meal.protein / totalProtein) * 100).toFixed(0)}% do total`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 2: Carboidrato base suficiente
 * Soma total de carbo ≥ 90% da meta
 */
function validateCarbBase(items: PlanItem[], target: MacroTargets): StructuralValidation {
  const errors: string[] = [];
  const current = sumMacros(items);
  
  const carbPercent = target.carbs > 0 ? (current.carbs / target.carbs) * 100 : 100;
  
  if (carbPercent < 90) {
    errors.push(
      `Carboidrato insuficiente: ${Math.round(current.carbs)}g ` +
      `(${carbPercent.toFixed(0)}% da meta, mín: 90%)`
    );
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 3: Gordura não dominante
 * Gordura ≤ 30% das calorias totais
 */
function validateFatNotDominant(items: PlanItem[]): StructuralValidation {
  const errors: string[] = [];
  const current = sumMacros(items);
  
  const fatPercent = fatPercentOfCalories(current.fat, current.calories);
  
  if (fatPercent > 30) {
    errors.push(
      `Gordura dominante: ${fatPercent.toFixed(1)}% das calorias (máx: 30%)`
    );
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 4: Contexto da refeição
 * - Café da manhã não pode conter óleo isolado
 * - Refeições principais não podem ter suplementos como base
 * - Lanches não podem ser compostos apenas por gordura
 */
function validateMealContext(items: PlanItem[]): StructuralValidation {
  const errors: string[] = [];
  const meals = groupByMeal(items);
  
  for (const [, mealItems] of meals) {
    const mealName = mealItems[0]?.mealName || 'Refeição';
    const normalizedName = normalizeMealName(mealName);
    
    // Café da manhã: verificar óleo isolado
    if (BREAKFAST_NAMES.some(b => normalizedName.includes(b.replace(/ /g, '')))) {
      const hasIsolatedOil = mealItems.some(item => {
        const foodName = item.food.name.toLowerCase();
        return (foodName.includes('óleo') || foodName.includes('oleo')) &&
               isFatCategory(item.food.category);
      });
      
      if (hasIsolatedOil) {
        errors.push(`${mealName}: café da manhã não pode conter óleo isolado`);
      }
    }
    
    // Refeições principais: verificar suplementos como base
    const isMainMeal = MAIN_MEALS.some(m => normalizedName.includes(m));
    if (isMainMeal) {
      const totalCalories = mealItems.reduce((sum, item) => 
        sum + calculateNutrients(item.food, item.quantityGrams).calories, 0);
      
      const supplementCalories = mealItems
        .filter(item => item.food.category?.toLowerCase() === 'suplementos')
        .reduce((sum, item) => 
          sum + calculateNutrients(item.food, item.quantityGrams).calories, 0);
      
      if (totalCalories > 0 && (supplementCalories / totalCalories) > 0.5) {
        errors.push(`${mealName}: refeição principal não pode ter suplementos como base`);
      }
    }
    
    // Lanches: verificar se são apenas gordura
    const isSnack = SNACK_NAMES.some(s => normalizedName.includes(s.replace(/ /g, '')));
    if (isSnack) {
      const allFat = mealItems.every(item => isFatCategory(item.food.category));
      if (allFat && mealItems.length > 0) {
        errors.push(`${mealName}: lanche não pode ser composto apenas por gordura`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * Executa TODAS as validações estruturais.
 * Se qualquer uma falhar, retorna bloqueio.
 */
function validateStructure(
  items: PlanItem[],
  target: MacroTargets
): StructuralValidation {
  const allErrors: string[] = [];
  
  const validations = [
    validateProteinDistribution(items),
    validateCarbBase(items, target),
    validateFatNotDominant(items),
    validateMealContext(items),
  ];
  
  for (const validation of validations) {
    allErrors.push(...validation.errors);
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

// =====================================================
// AJUSTES DE QUANTIDADE (ORDEM FIXA)
// =====================================================

interface AdjustmentContext {
  items: PlanItem[];
  adjustments: QuantityAdjustment[];
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
}

/**
 * Filtra itens por macro dominante
 */
function filterByDominantMacro(items: PlanItem[], macro: 'protein' | 'carbs' | 'fat'): PlanItem[] {
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
 * Aplica ajuste e retorna a estrutura de ajuste
 */
function createAdjustment(
  item: PlanItem,
  newGrams: number,
  reason: string
): QuantityAdjustment {
  return {
    itemId: item.id,
    mealId: item.mealId,
    mealName: item.mealName,
    optionId: item.optionId,
    foodId: item.food.id,
    foodName: item.food.name,
    originalGrams: item.quantityGrams,
    newGrams: Math.max(REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS, Math.round(newGrams)),
    reason,
  };
}

/**
 * 1️⃣ AJUSTE DE PROTEÍNA
 * - Ajustar alimentos proteicos para alcançar meta
 * - Pode aumentar OU reduzir quantidades
 * - Compensar calorias adicionais reduzindo carboidratos
 */
function adjustProtein(ctx: AdjustmentContext): QuantityAdjustment[] {
  const adjustments: QuantityAdjustment[] = [];
  const proteinDelta = ctx.targetMacros.protein - ctx.currentMacros.protein;
  
  // Se já atingiu a meta, não ajustar
  if (isProteinOnTarget(ctx.currentMacros.protein, ctx.targetMacros.protein)) {
    return [];
  }
  
  // Filtrar alimentos proteicos (excluindo suplementos)
  const proteinItems = ctx.items
    .filter(item => item.isActive)
    .filter(item => item.food.category?.toLowerCase() !== 'suplementos')
    .filter(item => {
      // Itens com mais de 15% de proteína por caloria
      const proteinCals = item.food.protein * KCAL_PER_GRAM.protein;
      const totalCals = item.food.calories;
      return totalCals > 0 && (proteinCals / totalCals) > 0.15;
    })
    .sort((a, b) => {
      // Priorizar por densidade proteica (gramas de proteína por 100g de alimento)
      const densityA = (a.food.protein / a.food.servingGrams) * 100;
      const densityB = (b.food.protein / b.food.servingGrams) * 100;
      return densityB - densityA;
    });
  
  const isIncrease = proteinDelta > 0;
  let remaining = Math.abs(proteinDelta);
  
  for (const item of proteinItems) {
    if (remaining <= 2) break;
    
    const proteinPer100g = (item.food.protein / item.food.servingGrams) * 100;
    if (proteinPer100g === 0) continue;
    
    // Calcular gramas necessárias para ajustar
    const gramsNeeded = (remaining / proteinPer100g) * 100;
    const maxAdjustment = item.quantityGrams * (REBALANCER_CONTRACT.MAX_ADJUSTMENT_PERCENT / 100);
    
    let newGrams: number;
    if (isIncrease) {
      const actualGramsToAdd = Math.min(gramsNeeded, maxAdjustment);
      newGrams = Math.min(
        item.quantityGrams + actualGramsToAdd,
        REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS
      );
    } else {
      const actualGramsToRemove = Math.min(gramsNeeded, item.quantityGrams - REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS);
      newGrams = Math.max(
        item.quantityGrams - actualGramsToRemove,
        REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS
      );
    }
    
    if (Math.abs(newGrams - item.quantityGrams) > 1) {
      const adjustedProtein = Math.abs((newGrams - item.quantityGrams) / item.food.servingGrams) * item.food.protein;
      remaining -= adjustedProtein;
      
      adjustments.push(createAdjustment(
        item,
        newGrams,
        isIncrease ? `Aumentar proteína (+${adjustedProtein.toFixed(1)}g)` : `Reduzir proteína (-${adjustedProtein.toFixed(1)}g)`
      ));
    }
  }
  
  // COMPENSAÇÃO: Se aumentou proteína, reduzir carboidrato para manter calorias
  if (adjustments.length > 0 && isIncrease) {
    const addedCalories = adjustments.reduce((sum, adj) => {
      const item = ctx.items.find(i => i.id === adj.itemId)!;
      const caloriesAdded = ((adj.newGrams - adj.originalGrams) / item.food.servingGrams) * item.food.calories;
      return sum + caloriesAdded;
    }, 0);
    
    if (addedCalories > 30) {
      // Encontrar carboidratos para reduzir
      const carbItems = ctx.items
        .filter(item => item.isActive)
        .filter(item => !adjustments.some(a => a.itemId === item.id))
        .filter(item => {
          const carbCals = item.food.carbs * KCAL_PER_GRAM.carbs;
          return item.food.calories > 0 && (carbCals / item.food.calories) > 0.4;
        })
        .sort((a, b) => b.quantityGrams - a.quantityGrams);
      
      let caloriesToCompensate = addedCalories * 0.7; // Compensar 70% das calorias adicionadas
      
      for (const item of carbItems) {
        if (caloriesToCompensate <= 0) break;
        
        const caloriesPer100g = (item.food.calories / item.food.servingGrams) * 100;
        const gramsToRemove = (caloriesToCompensate / caloriesPer100g) * 100;
        const minGrams = REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS;
        const maxReduction = item.quantityGrams - minGrams;
        
        if (maxReduction > 5) {
          const actualReduction = Math.min(gramsToRemove, maxReduction * 0.5);
          const newGrams = item.quantityGrams - actualReduction;
          const compensatedCalories = (actualReduction / item.food.servingGrams) * item.food.calories;
          
          caloriesToCompensate -= compensatedCalories;
          
          adjustments.push(createAdjustment(
            item,
            newGrams,
            `Compensar calorias (-${compensatedCalories.toFixed(0)} kcal)`
          ));
        }
      }
    }
  }
  
  return adjustments;
}

/**
 * 2️⃣ AJUSTE DE CARBOIDRATO
 * - Ajustar para alcançar meta de carboidratos
 * - Pode aumentar ou reduzir conforme necessidade
 */
function adjustCarbs(
  ctx: AdjustmentContext,
  fatAlreadyIncreased: boolean
): QuantityAdjustment[] {
  const adjustments: QuantityAdjustment[] = [];
  const carbsDelta = ctx.targetMacros.carbs - ctx.currentMacros.carbs;
  
  // Se já atingiu a meta, não ajustar
  if (isCarbsOnTarget(ctx.currentMacros.carbs, ctx.targetMacros.carbs)) {
    return [];
  }
  
  // Encontrar alimentos ricos em carboidratos
  const carbItems = ctx.items
    .filter(item => item.isActive)
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .filter(item => {
      const carbCals = item.food.carbs * KCAL_PER_GRAM.carbs;
      return item.food.calories > 0 && (carbCals / item.food.calories) > 0.35;
    })
    .sort((a, b) => {
      // Priorizar por densidade de carboidrato
      const densityA = (a.food.carbs / a.food.servingGrams) * 100;
      const densityB = (b.food.carbs / b.food.servingGrams) * 100;
      return densityB - densityA;
    });
  
  let remaining = Math.abs(carbsDelta);
  const isIncrease = carbsDelta > 0;
  
  // REGRA: Se gordura já aumentou, limitar aumento de carbo
  const maxCarbIncrease = fatAlreadyIncreased ? remaining * 0.5 : remaining;
  if (isIncrease) {
    remaining = Math.min(remaining, maxCarbIncrease);
  }
  
  for (const item of carbItems) {
    if (remaining <= 3) break;
    
    const carbsPer100g = (item.food.carbs / item.food.servingGrams) * 100;
    if (carbsPer100g === 0) continue;
    
    const gramsNeeded = (remaining / carbsPer100g) * 100;
    
    let newGrams: number;
    if (isIncrease) {
      const maxAdjustment = item.quantityGrams * (REBALANCER_CONTRACT.MAX_ADJUSTMENT_PERCENT / 100);
      newGrams = Math.min(
        item.quantityGrams + Math.min(gramsNeeded, maxAdjustment),
        REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS
      );
    } else {
      newGrams = Math.max(
        item.quantityGrams - gramsNeeded,
        REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS
      );
    }
    
    if (Math.abs(newGrams - item.quantityGrams) > 2) {
      const adjustedCarbs = Math.abs((newGrams - item.quantityGrams) / item.food.servingGrams) * item.food.carbs;
      remaining -= adjustedCarbs;
      
      adjustments.push(createAdjustment(
        item,
        newGrams,
        isIncrease ? `Aumentar carbo (+${adjustedCarbs.toFixed(1)}g)` : `Reduzir carbo (-${adjustedCarbs.toFixed(1)}g)`
      ));
    }
  }
  
  return adjustments;
}

/**
 * 3️⃣ AJUSTE DE GORDURA
 * - Ajustar para alcançar meta exata de gordura
 */
function adjustFat(ctx: AdjustmentContext): QuantityAdjustment[] {
  const adjustments: QuantityAdjustment[] = [];
  const fatDelta = ctx.targetMacros.fat - ctx.currentMacros.fat;
  
  // Se já atingiu a meta, não ajustar
  if (isFatOnTarget(ctx.currentMacros.fat, ctx.targetMacros.fat)) {
    return [];
  }
  
  const fatItems = ctx.items
    .filter(item => item.isActive)
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .filter(item => {
      const fatCals = item.food.fat * KCAL_PER_GRAM.fat;
      return item.food.calories > 0 && (fatCals / item.food.calories) > 0.25;
    })
    .sort((a, b) => {
      const densityA = (a.food.fat / a.food.servingGrams) * 100;
      const densityB = (b.food.fat / b.food.servingGrams) * 100;
      return densityB - densityA;
    });
  
  const isIncrease = fatDelta > 0;
  let remaining = Math.abs(fatDelta);
  
  for (const item of fatItems) {
    if (remaining <= 1) break;
    
    const fatPer100g = (item.food.fat / item.food.servingGrams) * 100;
    if (fatPer100g === 0) continue;
    
    const gramsNeeded = (remaining / fatPer100g) * 100;
    
    let newGrams: number;
    if (isIncrease) {
      const maxAdd = item.quantityGrams * 0.5; // Máximo 50% de aumento para gordura
      newGrams = Math.min(
        item.quantityGrams + Math.min(gramsNeeded, maxAdd),
        REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS
      );
    } else {
      newGrams = Math.max(
        item.quantityGrams - gramsNeeded,
        REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS
      );
    }
    
    if (Math.abs(newGrams - item.quantityGrams) > 1) {
      const adjustedFat = Math.abs((newGrams - item.quantityGrams) / item.food.servingGrams) * item.food.fat;
      remaining -= adjustedFat;
      
      adjustments.push(createAdjustment(
        item,
        newGrams,
        isIncrease ? `Aumentar gordura (+${adjustedFat.toFixed(1)}g)` : `Reduzir gordura (-${adjustedFat.toFixed(1)}g)`
      ));
    }
  }
  
  return adjustments;
}

/**
 * 4️⃣ AJUSTE FINAL DE CALORIAS
 * - Ajusta todos os alimentos proporcionalmente para alcançar meta calórica
 */
function adjustCalories(ctx: AdjustmentContext): QuantityAdjustment[] {
  const adjustments: QuantityAdjustment[] = [];
  const calorieDelta = ctx.targetMacros.calories - ctx.currentMacros.calories;
  
  // Se já atingiu a meta, não ajustar
  if (isCaloriesOnTarget(ctx.currentMacros.calories, ctx.targetMacros.calories)) {
    return [];
  }
  
  // Calcular fator de ajuste proporcional
  const adjustmentFactor = ctx.targetMacros.calories / ctx.currentMacros.calories;
  const isIncrease = calorieDelta > 0;
  
  // Ajustar alimentos que ainda não foram modificados
  const availableItems = ctx.items
    .filter(item => item.isActive)
    .filter(item => !ctx.adjustments.some(a => a.itemId === item.id))
    .sort((a, b) => b.quantityGrams - a.quantityGrams); // Priorizar maiores quantidades
  
  let remainingCalories = Math.abs(calorieDelta);
  
  for (const item of availableItems) {
    if (remainingCalories <= 20) break;
    
    const currentCalories = (item.quantityGrams / item.food.servingGrams) * item.food.calories;
    const targetItemCalories = currentCalories * adjustmentFactor;
    const targetGrams = (targetItemCalories / item.food.calories) * item.food.servingGrams;
    
    // Limitar ajuste por item
    const maxChange = item.quantityGrams * 0.3; // Máximo 30% de mudança por item
    let newGrams: number;
    
    if (isIncrease) {
      newGrams = Math.min(
        item.quantityGrams + Math.min(targetGrams - item.quantityGrams, maxChange),
        REBALANCER_CONTRACT.MAX_QUANTITY_GRAMS
      );
    } else {
      newGrams = Math.max(
        item.quantityGrams - Math.min(item.quantityGrams - targetGrams, maxChange),
        REBALANCER_CONTRACT.MIN_QUANTITY_GRAMS
      );
    }
    
    if (Math.abs(newGrams - item.quantityGrams) > 3) {
      const calorieChange = Math.abs((newGrams - item.quantityGrams) / item.food.servingGrams) * item.food.calories;
      remainingCalories -= calorieChange;
      
      adjustments.push(createAdjustment(
        item,
        newGrams,
        isIncrease ? `Ajuste calórico (+${calorieChange.toFixed(0)} kcal)` : `Ajuste calórico (-${calorieChange.toFixed(0)} kcal)`
      ));
    }
  }
  
  return adjustments;
}

// =====================================================
// FUNÇÃO PRINCIPAL DE REBALANCEAMENTO
// =====================================================

/**
 * Aplica ajustes aos itens do plano e retorna cópia com novos valores.
 */
function applyAdjustmentsToItems(
  items: PlanItem[],
  adjustments: QuantityAdjustment[]
): PlanItem[] {
  return items.map(item => {
    const adjustment = adjustments.find(a => a.itemId === item.id);
    if (adjustment) {
      return { ...item, quantityGrams: adjustment.newGrams };
    }
    return { ...item };
  });
}

/**
 * REBALANCE PLAN V4
 * 
 * Ajusta quantidades de alimentos para alcançar metas calóricas e de macros.
 * 
 * Contrato:
 * 1. Validação estrutural básica
 * 2. Se já dentro das metas → balanced
 * 3. Ajustes na ordem: Proteína → Carboidrato → Gordura → Calorias
 * 4. Retorna ajustes propostos para aprovação do usuário
 */
export function rebalancePlanV4(
  plan: DietPlan,
  targetMacros: MacroTargets
): RebalanceResult {
  const activeItems = plan.items.filter(item => item.isActive);
  
  // Calcular macros atuais
  const currentMacros = sumMacros(activeItems);
  
  // ========================================
  // ETAPA 1: PRÉ-VALIDAÇÃO ESTRUTURAL
  // ========================================
  
  const structuralValidation = validateStructure(activeItems, targetMacros);
  
  if (!structuralValidation.isValid) {
    return {
      status: 'blocked_structural',
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      adjustments: [],
      reason: structuralValidation.errors.join('; '),
      validationDetails: structuralValidation,
    };
  }
  
  // ========================================
  // ETAPA 2: VERIFICAR SE JÁ ESTÁ BALANCEADO
  // ========================================
  
  if (isOnTarget(currentMacros, targetMacros)) {
    return {
      status: 'balanced',
      plan: { ...plan, version: plan.version + 1 },
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      proposedMacros: roundMacros(currentMacros),
      adjustments: [],
    };
  }
  
  // ========================================
  // ETAPA 3: APLICAR AJUSTES NA ORDEM FIXA
  // ========================================
  
  let workingItems = [...activeItems];
  const allAdjustments: QuantityAdjustment[] = [];
  
  // 1️⃣ PROTEÍNA
  const proteinAdjustments = adjustProtein({
    items: workingItems,
    adjustments: allAdjustments,
    currentMacros: sumMacros(workingItems),
    targetMacros,
  });
  allAdjustments.push(...proteinAdjustments);
  workingItems = applyAdjustmentsToItems(workingItems, proteinAdjustments);
  
  // 2️⃣ CARBOIDRATO
  const fatIncreased = allAdjustments.some(a => {
    const item = activeItems.find(i => i.id === a.itemId);
    return item && isFatCategory(item.food.category) && a.newGrams > a.originalGrams;
  });
  
  const carbAdjustments = adjustCarbs(
    {
      items: workingItems,
      adjustments: allAdjustments,
      currentMacros: sumMacros(workingItems),
      targetMacros,
    },
    fatIncreased
  );
  allAdjustments.push(...carbAdjustments);
  workingItems = applyAdjustmentsToItems(workingItems, carbAdjustments);
  
  // 3️⃣ GORDURA
  const fatAdjustments = adjustFat({
    items: workingItems,
    adjustments: allAdjustments,
    currentMacros: sumMacros(workingItems),
    targetMacros,
  });
  allAdjustments.push(...fatAdjustments);
  workingItems = applyAdjustmentsToItems(workingItems, fatAdjustments);
  
  // 4️⃣ AJUSTE FINAL DE CALORIAS (se necessário)
  const calorieAdjustments = adjustCalories({
    items: workingItems,
    adjustments: allAdjustments,
    currentMacros: sumMacros(workingItems),
    targetMacros,
  });
  allAdjustments.push(...calorieAdjustments);
  workingItems = applyAdjustmentsToItems(workingItems, calorieAdjustments);
  
  // ========================================
  // ETAPA 4: VERIFICAR RESULTADO FINAL
  // ========================================
  
  const proposedMacros = sumMacros(workingItems);
  
  // Sucesso: retornar como ajustado se houve ajustes ou já atingiu as metas
  if (isOnTarget(proposedMacros, targetMacros) || allAdjustments.length > 0) {
    const newPlan: DietPlan = {
      ...plan,
      items: workingItems,
      version: plan.version + 1,
    };
    
    return {
      status: allAdjustments.length > 0 ? 'adjusted' : 'balanced',
      plan: newPlan,
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      proposedMacros: roundMacros(proposedMacros),
      adjustments: allAdjustments,
    };
  }
  
  // ========================================
  // ETAPA 5: BLOQUEIO SE NÃO FECHOU
  // ========================================
  
  // Gerar mensagem explicativa
  const problems: string[] = [];
  
  if (!isCaloriesOnTarget(proposedMacros.calories, targetMacros.calories)) {
    const diff = proposedMacros.calories - targetMacros.calories;
    problems.push(`Calorias: ${diff > 0 ? '+' : ''}${Math.round(diff)} kcal (meta: ${targetMacros.calories})`);
  }
  
  if (!isProteinOnTarget(proposedMacros.protein, targetMacros.protein)) {
    const diff = proposedMacros.protein - targetMacros.protein;
    problems.push(`Proteína: ${diff > 0 ? '+' : ''}${Math.round(diff)}g (meta: ${targetMacros.protein}g)`);
  }
  
  if (!isCarbsOnTarget(proposedMacros.carbs, targetMacros.carbs)) {
    const diff = proposedMacros.carbs - targetMacros.carbs;
    problems.push(`Carboidrato: ${diff > 0 ? '+' : ''}${Math.round(diff)}g (meta: ${targetMacros.carbs}g)`);
  }
  
  if (!isFatOnTarget(proposedMacros.fat, targetMacros.fat)) {
    const diff = proposedMacros.fat - targetMacros.fat;
    problems.push(`Gordura: ${diff > 0 ? '+' : ''}${Math.round(diff)}g (meta: ${targetMacros.fat}g)`);
  }
  
  return {
    status: 'blocked_structural',
    currentMacros: roundMacros(currentMacros),
    targetMacros: roundMacros(targetMacros),
    proposedMacros: roundMacros(proposedMacros),
    adjustments: allAdjustments,
    reason: `Não foi possível ajustar as quantidades para atingir as metas: ${problems.join('; ')}`,
  };
}

// =====================================================
// EXPORTS AUXILIARES
// =====================================================

export { sumMacros, roundMacros, isOnTarget };
