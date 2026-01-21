import { describe, it, expect } from 'vitest';
import {
  rebalancePlan,
  sumMacros,
  calculateDeltas,
  isWithinTolerance,
  assertAllCategoriesAreCanonical,
  GovernanceError,
  DietPlan,
  MacroTargets,
  PlanItem,
  FoodItem,
} from '@/lib/rebalancer-core';

// =====================================================
// HELPERS PARA CRIAR DADOS DE TESTE
// =====================================================

function createFood(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: 'food-1',
    name: 'Frango Grelhado',
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
  return {
    id: 'plan-1',
    items,
    version: 1,
  };
}

// =====================================================
// TESTES UNITÁRIOS OBRIGATÓRIOS
// =====================================================

describe('Rebalancer Core - Regras Canônicas', () => {
  describe('Teste 1: Plano já balanceado → não muda', () => {
    it('deve retornar plano sem ajustes quando já está dentro da tolerância', () => {
      const proteinFood = createFood({
        id: 'protein-1',
        name: 'Frango',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        category: 'proteinas',
      });

      const carbFood = createFood({
        id: 'carb-1',
        name: 'Arroz',
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        category: 'carboidratos',
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 200 }),
        createPlanItem({ id: 'item-2', food: carbFood, quantityGrams: 150 }),
      ];

      const plan = createPlan(items);
      
      // Calcular macros atuais para usar como meta
      const currentMacros = sumMacros(items);
      const target: MacroTargets = {
        protein: Math.round(currentMacros.protein),
        carbs: Math.round(currentMacros.carbs),
        fat: Math.round(currentMacros.fat),
        calories: Math.round(currentMacros.calories),
      };

      const result = rebalancePlan(plan, target);

      expect(result.adjustments).toHaveLength(0);
      expect(result.isValid).toBe(true);
      expect(result.supplementNeeds).toHaveLength(0);
    });
  });

  describe('Teste 2: Proteína insuficiente → aumenta porções', () => {
    it('deve aumentar porções de alimentos proteicos quando há déficit de proteína', () => {
      const proteinFood = createFood({
        id: 'protein-1',
        name: 'Frango',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        category: 'proteinas',
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 100 }),
      ];

      const plan = createPlan(items);
      
      // Meta com mais proteína do que o atual
      const target: MacroTargets = {
        protein: 60, // Atual é ~31g
        carbs: 0,
        fat: 5,
        calories: 300,
      };

      const result = rebalancePlan(plan, target);

      expect(result.adjustments.length).toBeGreaterThan(0);
      
      const proteinAdjustment = result.adjustments.find(a => a.foodId === 'protein-1');
      expect(proteinAdjustment).toBeDefined();
      expect(proteinAdjustment!.newGrams).toBeGreaterThan(proteinAdjustment!.originalGrams);
    });
  });

  describe('Teste 3: Excesso calórico → reduz gordura', () => {
    it('deve reduzir porções de alimentos gordurosos quando há excesso', () => {
      const fatFood = createFood({
        id: 'fat-1',
        name: 'Azeite',
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        category: 'gorduras',
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: fatFood, quantityGrams: 50 }),
      ];

      const plan = createPlan(items);
      
      // Meta com menos gordura do que o atual
      const target: MacroTargets = {
        protein: 0,
        carbs: 0,
        fat: 20, // Atual é 50g
        calories: 200,
      };

      const result = rebalancePlan(plan, target);

      expect(result.adjustments.length).toBeGreaterThan(0);
      
      const fatAdjustment = result.adjustments.find(a => a.foodId === 'fat-1');
      expect(fatAdjustment).toBeDefined();
      expect(fatAdjustment!.newGrams).toBeLessThan(fatAdjustment!.originalGrams);
    });
  });

  describe('Teste 4: Suplemento bloqueado → sinaliza sem adicionar', () => {
    it('deve sinalizar necessidade de suplemento sem adicionar automaticamente', () => {
      const proteinFood = createFood({
        id: 'protein-1',
        name: 'Frango',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        category: 'proteinas',
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 50 }),
      ];

      const plan = createPlan(items);
      
      // Meta com muito mais proteína do que possível com o alimento atual
      const target: MacroTargets = {
        protein: 100, // Atual é ~15.5g, máximo ajustável ~23g
        carbs: 0,
        fat: 5,
        calories: 400,
      };

      const result = rebalancePlan(plan, target, { allowSupplements: true });

      // Deve ter sinalizado necessidade de suplemento
      expect(result.supplementNeeds.length).toBeGreaterThan(0);
      
      const proteinNeed = result.supplementNeeds.find(s => s.type === 'protein');
      expect(proteinNeed).toBeDefined();
      expect(proteinNeed!.deficitGrams).toBeGreaterThan(0);
    });

    it('não deve sinalizar suplementos quando allowSupplements é false', () => {
      const proteinFood = createFood({
        id: 'protein-1',
        name: 'Frango',
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        category: 'proteinas',
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 50 }),
      ];

      const plan = createPlan(items);
      
      const target: MacroTargets = {
        protein: 100,
        carbs: 0,
        fat: 5,
        calories: 400,
      };

      const result = rebalancePlan(plan, target, { allowSupplements: false });

      expect(result.supplementNeeds).toHaveLength(0);
    });
  });

  describe('Teste 5: Categoria inválida → erro', () => {
    it('deve lançar GovernanceError quando detecta categoria não canônica', () => {
      const invalidFood = createFood({
        id: 'invalid-1',
        name: 'Alimento Inválido',
        category: 'proteinas_animais', // Categoria inválida!
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: invalidFood }),
      ];

      const plan = createPlan(items);
      
      const target: MacroTargets = {
        protein: 50,
        carbs: 100,
        fat: 30,
        calories: 1000,
      };

      expect(() => rebalancePlan(plan, target)).toThrow(GovernanceError);
    });

    it('deve aceitar categorias canônicas válidas', () => {
      const validFood = createFood({
        id: 'valid-1',
        name: 'Frango',
        category: 'proteinas', // Categoria válida
      });

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food: validFood }),
      ];

      const plan = createPlan(items);
      
      const currentMacros = sumMacros(items);
      const target: MacroTargets = {
        protein: Math.round(currentMacros.protein),
        carbs: Math.round(currentMacros.carbs),
        fat: Math.round(currentMacros.fat),
        calories: Math.round(currentMacros.calories),
      };

      expect(() => rebalancePlan(plan, target)).not.toThrow();
    });
  });

  describe('Teste 6: Itens inativos são ignorados', () => {
    it('deve ignorar itens com isActive = false no cálculo', () => {
      const food = createFood();

      const items: PlanItem[] = [
        createPlanItem({ id: 'item-1', food, quantityGrams: 100, isActive: true }),
        createPlanItem({ id: 'item-2', food, quantityGrams: 100, isActive: false }),
      ];

      const plan = createPlan(items);
      
      // Meta que considera apenas o item ativo
      const target: MacroTargets = {
        protein: 31, // Apenas 1 item de 100g
        carbs: 0,
        fat: 3.6,
        calories: 165,
      };

      const result = rebalancePlan(plan, target);

      expect(result.adjustments).toHaveLength(0);
      expect(result.currentMacros.protein).toBeCloseTo(31, 0);
    });
  });
});

describe('Funções auxiliares', () => {
  describe('sumMacros', () => {
    it('deve somar corretamente os macros de múltiplos itens', () => {
      const items: PlanItem[] = [
        createPlanItem({
          id: 'item-1',
          food: createFood({ protein: 30, carbs: 0, fat: 5, calories: 170 }),
          quantityGrams: 100,
        }),
        createPlanItem({
          id: 'item-2',
          food: createFood({ protein: 3, carbs: 30, fat: 0, calories: 130 }),
          quantityGrams: 100,
        }),
      ];

      const result = sumMacros(items);

      expect(result.protein).toBeCloseTo(33, 0);
      expect(result.carbs).toBeCloseTo(30, 0);
      expect(result.fat).toBeCloseTo(5, 0);
      expect(result.calories).toBeCloseTo(300, 0);
    });
  });

  describe('calculateDeltas', () => {
    it('deve calcular déficits corretamente (positivo = precisa adicionar)', () => {
      const current: MacroTargets = { protein: 50, carbs: 100, fat: 30, calories: 900 };
      const target: MacroTargets = { protein: 100, carbs: 200, fat: 50, calories: 1800 };

      const deltas = calculateDeltas(current, target);

      expect(deltas.protein).toBe(50);
      expect(deltas.carbs).toBe(100);
      expect(deltas.fat).toBe(20);
      expect(deltas.calories).toBe(900);
    });

    it('deve calcular excessos corretamente (negativo = precisa reduzir)', () => {
      const current: MacroTargets = { protein: 100, carbs: 200, fat: 50, calories: 1800 };
      const target: MacroTargets = { protein: 50, carbs: 100, fat: 30, calories: 900 };

      const deltas = calculateDeltas(current, target);

      expect(deltas.protein).toBe(-50);
      expect(deltas.carbs).toBe(-100);
      expect(deltas.fat).toBe(-20);
      expect(deltas.calories).toBe(-900);
    });
  });

  describe('isWithinTolerance', () => {
    it('deve retornar true quando todos os macros estão dentro da tolerância', () => {
      const current: MacroTargets = { protein: 100, carbs: 200, fat: 50, calories: 1800 };
      const target: MacroTargets = { protein: 101, carbs: 202, fat: 50.5, calories: 1810 };

      expect(isWithinTolerance(current, target, 2)).toBe(true);
    });

    it('deve retornar false quando algum macro está fora da tolerância', () => {
      const current: MacroTargets = { protein: 100, carbs: 200, fat: 50, calories: 1800 };
      const target: MacroTargets = { protein: 120, carbs: 200, fat: 50, calories: 1800 };

      expect(isWithinTolerance(current, target, 2)).toBe(false);
    });
  });

  describe('assertAllCategoriesAreCanonical', () => {
    it('deve passar quando todas as categorias são válidas', () => {
      const items: PlanItem[] = [
        createPlanItem({ food: createFood({ category: 'proteinas' }) }),
        createPlanItem({ food: createFood({ category: 'carboidratos' }) }),
        createPlanItem({ food: createFood({ category: 'gorduras' }) }),
      ];

      expect(() => assertAllCategoriesAreCanonical(items)).not.toThrow();
    });

    it('deve aceitar categoria null', () => {
      const items: PlanItem[] = [
        createPlanItem({ food: createFood({ category: null }) }),
      ];

      expect(() => assertAllCategoriesAreCanonical(items)).not.toThrow();
    });

    it('deve lançar erro para categoria inválida', () => {
      const items: PlanItem[] = [
        createPlanItem({ food: createFood({ category: 'hortalicas_folhosas' }) }),
      ];

      expect(() => assertAllCategoriesAreCanonical(items)).toThrow(GovernanceError);
    });
  });
});

describe('Ordem de ajuste', () => {
  it('deve ajustar proteínas antes de carboidratos e gorduras', () => {
    const proteinFood = createFood({
      id: 'protein-1',
      protein: 30,
      carbs: 0,
      fat: 0,
      calories: 120,
      category: 'proteinas',
    });
    
    const carbFood = createFood({
      id: 'carb-1',
      protein: 0,
      carbs: 30,
      fat: 0,
      calories: 120,
      category: 'carboidratos',
    });

    const items: PlanItem[] = [
      createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 100 }),
      createPlanItem({ id: 'item-2', food: carbFood, quantityGrams: 100 }),
    ];

    const plan = createPlan(items);
    
    // Meta com mais de tudo
    const target: MacroTargets = {
      protein: 50, // Precisa adicionar proteína
      carbs: 50,   // Precisa adicionar carb
      fat: 5,
      calories: 400,
    };

    const result = rebalancePlan(plan, target);

    // Deve ter ajustes para proteína e carb
    const proteinAdjIndex = result.adjustments.findIndex(a => a.foodId === 'protein-1');
    const carbAdjIndex = result.adjustments.findIndex(a => a.foodId === 'carb-1');

    // Proteína deve vir antes de carboidrato
    if (proteinAdjIndex !== -1 && carbAdjIndex !== -1) {
      expect(proteinAdjIndex).toBeLessThan(carbAdjIndex);
    }
  });
});

describe('Imutabilidade', () => {
  it('não deve mutar o plano original', () => {
    const food = createFood();
    const items: PlanItem[] = [
      createPlanItem({ id: 'item-1', food, quantityGrams: 100 }),
    ];

    const plan = createPlan(items);
    const originalQuantity = plan.items[0].quantityGrams;
    
    const target: MacroTargets = {
      protein: 60,
      carbs: 0,
      fat: 10,
      calories: 300,
    };

    rebalancePlan(plan, target);

    // O plano original não deve ter sido modificado
    expect(plan.items[0].quantityGrams).toBe(originalQuantity);
  });

  it('deve incrementar a versão do snapshot', () => {
    const food = createFood();
    const items: PlanItem[] = [
      createPlanItem({ id: 'item-1', food, quantityGrams: 100 }),
    ];

    const plan = createPlan(items);
    plan.version = 5;
    
    const target: MacroTargets = {
      protein: 60,
      carbs: 0,
      fat: 10,
      calories: 300,
    };

    const result = rebalancePlan(plan, target);

    expect(result.version).toBe(6);
  });
});
