// =====================================================
// PRÉ-VALIDAÇÃO ESTRUTURAL (CHECKLIST ITEM 1)
// =====================================================
// Valida estrutura do plano ANTES de qualquer ajuste.
// Se falhar aqui, NÃO tenta ajustar depois.
// =====================================================

import {
  PlanItem,
  MacroTargets,
  StructuralValidation,
  calculateNutrients,
  sumMacros,
  KCAL_PER_GRAM,
} from './types';

import { FoodCategory } from '../food-categories';

// =====================================================
// CONSTANTES DE CONTEXTO
// =====================================================

const MAIN_MEALS = ['almoço', 'jantar'];
const BREAKFAST_NAMES = ['café da manhã', 'cafe da manha', 'desjejum'];
const SNACK_NAMES = ['lanche da manhã', 'lanche da tarde', 'ceia'];

const PROTEIN_CATEGORIES: FoodCategory[] = ['proteinas', 'leguminosas', 'laticinios'];
const FAT_CATEGORIES: FoodCategory[] = ['gorduras'];

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function normalizeMealName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isProteinCategory(category: string | null): boolean {
  if (!category) return false;
  return PROTEIN_CATEGORIES.includes(category.toLowerCase() as FoodCategory);
}

function isFatCategory(category: string | null): boolean {
  if (!category) return false;
  return FAT_CATEGORIES.includes(category.toLowerCase() as FoodCategory);
}

function groupByMeal(items: PlanItem[]): Map<string, PlanItem[]> {
  const meals = new Map<string, PlanItem[]>();
  
  for (const item of items) {
    if (!item.isActive) continue;
    if (!meals.has(item.mealId)) {
      meals.set(item.mealId, []);
    }
    meals.get(item.mealId)!.push(item);
  }
  
  return meals;
}

// =====================================================
// VALIDAÇÕES ESTRUTURAIS
// =====================================================

/**
 * REGRA 1: Proteína em todas as refeições principais.
 */
function validateProteinDistribution(items: PlanItem[]): StructuralValidation {
  const errors: string[] = [];
  const meals = groupByMeal(items);
  
  for (const [, mealItems] of meals) {
    const mealName = mealItems[0]?.mealName || 'Refeição';
    const normalizedName = normalizeMealName(mealName);
    const isMainMeal = MAIN_MEALS.some(m => normalizedName.includes(m));
    
    // Calcular proteína total e verificar fonte proteica
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
    if (isMainMeal && !hasProteinFood) {
      errors.push(`${mealName}: refeição principal sem fonte proteica real`);
    }
    
    // Todas as refeições precisam de pelo menos 5g de proteína
    if (mealProtein < 5) {
      errors.push(`${mealName}: proteína insuficiente (${mealProtein.toFixed(1)}g, mín: 5g)`);
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 2: Carboidrato base suficiente (≥90% da meta).
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
 * REGRA 3: Gordura não dominante (≤30% das calorias).
 */
function validateFatNotDominant(items: PlanItem[]): StructuralValidation {
  const errors: string[] = [];
  const current = sumMacros(items);
  const fatCalories = current.fat * KCAL_PER_GRAM.fat;
  const fatPercent = current.calories > 0 ? (fatCalories / current.calories) * 100 : 0;
  
  if (fatPercent > 30) {
    errors.push(
      `Gordura dominante: ${fatPercent.toFixed(1)}% das calorias (máx: 30%)`
    );
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 4: Contexto da refeição.
 */
function validateMealContext(items: PlanItem[]): StructuralValidation {
  const errors: string[] = [];
  const meals = groupByMeal(items);
  
  for (const [, mealItems] of meals) {
    const mealName = mealItems[0]?.mealName || 'Refeição';
    const normalizedName = normalizeMealName(mealName);
    
    // Café da manhã: sem óleo isolado
    const isBreakfast = BREAKFAST_NAMES.some(b => normalizedName.includes(normalizeMealName(b)));
    if (isBreakfast) {
      const hasIsolatedOil = mealItems.some(item => {
        const foodName = item.food.name.toLowerCase();
        return (foodName.includes('óleo') || foodName.includes('oleo')) &&
               isFatCategory(item.food.category);
      });
      if (hasIsolatedOil) {
        errors.push(`${mealName}: café da manhã não pode conter óleo isolado`);
      }
    }
    
    // Refeições principais: sem suplementos como base
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
    
    // Lanches: não podem ser apenas gordura
    const isSnack = SNACK_NAMES.some(s => normalizedName.includes(normalizeMealName(s)));
    if (isSnack && mealItems.length > 0) {
      const allFat = mealItems.every(item => isFatCategory(item.food.category));
      if (allFat) {
        errors.push(`${mealName}: lanche não pode ser composto apenas por gordura`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 5: Viabilidade calórica.
 * Verifica se as calorias estão em um range ajustável.
 */
function validateCalorieViability(items: PlanItem[], target: MacroTargets): StructuralValidation {
  const errors: string[] = [];
  const current = sumMacros(items);
  
  // Calcular range possível de calorias
  let minPossibleCalories = 0;
  let maxPossibleCalories = 0;
  
  for (const item of items) {
    if (!item.isActive) continue;
    
    const minGrams = 5; // Mínimo absoluto
    const maxGrams = 600; // Máximo absoluto
    
    const minCalories = (minGrams / item.food.servingGrams) * item.food.calories;
    const maxCalories = (maxGrams / item.food.servingGrams) * item.food.calories;
    
    minPossibleCalories += minCalories;
    maxPossibleCalories += maxCalories;
  }
  
  // Verificar se a meta está dentro do range possível
  if (target.calories < minPossibleCalories) {
    errors.push(
      `Meta calórica inatingível: ${target.calories} kcal < mínimo possível ${Math.round(minPossibleCalories)} kcal`
    );
  }
  
  if (target.calories > maxPossibleCalories) {
    errors.push(
      `Meta calórica inatingível: ${target.calories} kcal > máximo possível ${Math.round(maxPossibleCalories)} kcal`
    );
  }
  
  return { isValid: errors.length === 0, errors };
}

/**
 * REGRA 6: Conflito carb+gordura.
 * Se ambos precisam subir, é bloqueio estrutural.
 */
function validateNoCarbFatConflict(current: MacroTargets, target: MacroTargets): StructuralValidation {
  const errors: string[] = [];
  
  const carbsDelta = target.carbs - current.carbs;
  const fatDelta = target.fat - current.fat;
  
  // Se ambos precisam subir significativamente
  if (carbsDelta > 10 && fatDelta > 5) {
    errors.push(
      `Conflito estrutural: carboidrato (+${Math.round(carbsDelta)}g) e ` +
      `gordura (+${Math.round(fatDelta)}g) não podem aumentar simultaneamente`
    );
  }
  
  return { isValid: errors.length === 0, errors };
}

// =====================================================
// FUNÇÃO PRINCIPAL DE PRÉ-VALIDAÇÃO
// =====================================================

/**
 * Executa TODAS as validações estruturais.
 * Se qualquer uma falhar, retorna bloqueio.
 * 
 * REGRA: Se falhar aqui → não tenta ajustar depois.
 */
export function preValidateStructure(
  items: PlanItem[],
  target: MacroTargets
): StructuralValidation {
  const activeItems = items.filter(i => i.isActive);
  const current = sumMacros(activeItems);
  
  const validations = [
    validateProteinDistribution(activeItems),
    validateCarbBase(activeItems, target),
    validateFatNotDominant(activeItems),
    validateMealContext(activeItems),
    validateCalorieViability(activeItems, target),
    validateNoCarbFatConflict(current, target),
  ];
  
  const allErrors: string[] = [];
  for (const validation of validations) {
    allErrors.push(...validation.errors);
  }
  
  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}
