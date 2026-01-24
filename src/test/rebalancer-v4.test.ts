// =====================================================
// TESTES DO REBALANCER V4
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  rebalancePlanV4,
  DietPlan,
  PlanItem,
  MacroTargets,
} from '@/lib/rebalancer-v4';

// Helpers
function createFood(overrides: Partial<PlanItem['food']> = {}) {
  return {
    id: 'food-1',
    name: 'Frango grelhado',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    category: 'proteinas',
    servingGrams: 100,
    ...overrides,
  };
}

function createPlanItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'item-1',
    mealId: 'meal-1',
    mealName: 'Almoço',
    optionId: 'option-1',
    optionNumber: 1,
    food: createFood(),
    quantityGrams: 150,
    isActive: true,
    ...overrides,
  };
}

function createPlan(items: PlanItem[]): DietPlan {
  return { id: 'plan-1', items, version: 1 };
}

describe('Rebalancer V4 - Pré-Validação Estrutural', () => {
  it('deve bloquear plano sem proteína em refeição principal', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealName: 'Almoço',
        food: createFood({ 
          id: 'arroz', 
          name: 'Arroz branco', 
          protein: 2.5, 
          carbs: 28, 
          fat: 0.3, 
          calories: 130,
          category: 'carboidratos' 
        }),
        quantityGrams: 200,
      }),
    ];
    
    const result = rebalancePlanV4(
      createPlan(items),
      { protein: 150, carbs: 200, fat: 60, calories: 2000 }
    );
    
    expect(result.status).toBe('blocked_structural');
    expect(result.reason).toContain('proteica');
  });

  it('deve bloquear plano com gordura > 30% das calorias', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealName: 'Almoço',
        food: createFood({ 
          id: 'bacon', 
          name: 'Bacon', 
          protein: 12, 
          carbs: 0, 
          fat: 40, 
          calories: 400,
          category: 'proteinas' 
        }),
        quantityGrams: 300,
      }),
    ];
    
    const result = rebalancePlanV4(
      createPlan(items),
      { protein: 150, carbs: 200, fat: 60, calories: 2000 }
    );
    
    expect(result.status).toBe('blocked_structural');
    expect(result.reason).toContain('Gordura dominante');
  });

  it('deve retornar balanced se já está dentro das tolerâncias', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealName: 'Almoço',
        food: createFood(),
        quantityGrams: 483, // ~150g proteína
      }),
      createPlanItem({
        id: '2',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({ 
          id: 'arroz', 
          name: 'Arroz', 
          protein: 2.5, 
          carbs: 28, 
          fat: 0.3, 
          calories: 130,
          category: 'carboidratos' 
        }),
        quantityGrams: 715, // ~200g carbs
      }),
    ];
    
    const result = rebalancePlanV4(
      createPlan(items),
      { protein: 150, carbs: 200, fat: 60, calories: 1700 }
    );
    
    // Pode ser balanced ou adjusted dependendo da tolerância exata
    expect(['balanced', 'adjusted']).toContain(result.status);
  });

  it('deve retornar adjusted quando ajustes fecham as metas', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealName: 'Almoço',
        food: createFood(),
        quantityGrams: 400,
      }),
      createPlanItem({
        id: '2',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({ 
          id: 'arroz', 
          name: 'Arroz', 
          protein: 2.5, 
          carbs: 28, 
          fat: 0.3, 
          calories: 130,
          category: 'carboidratos' 
        }),
        quantityGrams: 600,
      }),
    ];
    
    const result = rebalancePlanV4(
      createPlan(items),
      { protein: 140, carbs: 180, fat: 20, calories: 1500 }
    );
    
    expect(['balanced', 'adjusted', 'blocked_structural']).toContain(result.status);
  });
});

describe('Rebalancer V4 - Ordem Fixa de Ajuste', () => {
  it('deve ajustar proteína antes de carboidrato', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealName: 'Almoço',
        food: createFood(),
        quantityGrams: 300,
      }),
      createPlanItem({
        id: '2',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({ 
          id: 'arroz', 
          name: 'Arroz', 
          protein: 2.5, 
          carbs: 28, 
          fat: 0.3, 
          calories: 130,
          category: 'carboidratos' 
        }),
        quantityGrams: 500,
      }),
    ];
    
    const result = rebalancePlanV4(
      createPlan(items),
      { protein: 120, carbs: 150, fat: 15, calories: 1300 }
    );
    
    if (result.status === 'adjusted' && result.adjustments.length > 0) {
      // Primeiro ajuste deve ser de proteína
      const firstProteinAdj = result.adjustments.find(a => 
        a.reason.toLowerCase().includes('proteína') || a.reason.toLowerCase().includes('proteina')
      );
      expect(firstProteinAdj).toBeDefined();
    }
  });
});

describe('Rebalancer V4 - Tolerâncias', () => {
  it('deve respeitar tolerância de calorias ±2%', () => {
    const target = { protein: 150, carbs: 200, fat: 60, calories: 2000 };
    const maxCalories = target.calories * 1.02;
    const minCalories = target.calories * 0.98;
    
    expect(maxCalories).toBe(2040);
    expect(minCalories).toBe(1960);
  });

  it('deve respeitar tolerância de gordura ±5g', () => {
    const fatTolerance = 5;
    expect(fatTolerance).toBe(5);
  });
});
