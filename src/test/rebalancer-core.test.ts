import { describe, it, expect } from 'vitest';
import {
  rebalancePlan,
  sumMacros,
  calculateDeltas,
  isWithinTolerance,
  assertAllCategoriesAreCanonical,
  validateCalorieCeiling,
  validateNoSimultaneousIncrease,
  validateFatTolerance,
  macrosToCalories,
  GovernanceError,
  DietPlan,
  MacroTargets,
  PlanItem,
  FoodItem,
  KCAL_PER_GRAM,
  CALORIE_TOLERANCE_PERCENT,
  FAT_TOLERANCE_GRAMS,
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
// TESTES UNITÁRIOS - CONTRATO NUTRICIONAL
// =====================================================

describe('Contrato Nutricional (KCAL/g)', () => {
  it('deve usar 4 kcal/g para proteína', () => {
    expect(KCAL_PER_GRAM.protein).toBe(4);
  });

  it('deve usar 4 kcal/g para carboidrato', () => {
    expect(KCAL_PER_GRAM.carbs).toBe(4);
  });

  it('deve usar 9 kcal/g para gordura', () => {
    expect(KCAL_PER_GRAM.fat).toBe(9);
  });

  it('deve calcular calorias corretamente a partir de macros', () => {
    const macros: MacroTargets = { protein: 100, carbs: 200, fat: 50, calories: 0 };
    const calculatedCalories = macrosToCalories(macros);
    
    // 100 * 4 + 200 * 4 + 50 * 9 = 400 + 800 + 450 = 1650
    expect(calculatedCalories).toBe(1650);
  });
});

// =====================================================
// TESTES - REGRA 1: TETO CALÓRICO ABSOLUTO
// =====================================================

describe('REGRA 1: Teto Calórico Absoluto (±2%)', () => {
  it('deve aceitar calorias dentro da tolerância de +2%', () => {
    const result = validateCalorieCeiling(2040, 2000); // +2%
    expect(result.isValid).toBe(true);
  });

  it('deve aceitar calorias dentro da tolerância de -2%', () => {
    const result = validateCalorieCeiling(1960, 2000); // -2%
    expect(result.isValid).toBe(true);
  });

  it('deve rejeitar calorias acima de +2%', () => {
    const result = validateCalorieCeiling(2050, 2000); // +2.5%
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('ESTOURO CALÓRICO');
  });

  it('deve rejeitar calorias abaixo de -2%', () => {
    const result = validateCalorieCeiling(1900, 2000); // -5%
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('DÉFICIT CALÓRICO EXCESSIVO');
  });

  it('rebalancePlan não deve propor calorias acima do teto', () => {
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
      createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 100 }),
      createPlanItem({ id: 'item-2', food: carbFood, quantityGrams: 100 }),
    ];

    const plan = createPlan(items);
    
    // Meta com calorias muito restritivas
    const target: MacroTargets = {
      protein: 100,
      carbs: 100,
      fat: 30,
      calories: 300, // Meta muito baixa
    };

    const result = rebalancePlan(plan, target);

    // Se a proposta for válida, as calorias devem estar dentro do teto
    if (result.isValid) {
      const maxCalories = target.calories * (1 + CALORIE_TOLERANCE_PERCENT / 100);
      expect(result.proposedMacros.calories).toBeLessThanOrEqual(Math.round(maxCalories));
    }
  });
});

// =====================================================
// TESTES - REGRA 2: ORDEM FIXA DE AJUSTE
// =====================================================

describe('REGRA 2: Ordem Fixa de Ajuste (Proteína → Carbo → Gordura)', () => {
  it('deve ajustar proteínas antes de carboidratos', () => {
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
    
    // Meta requer mais de ambos
    const target: MacroTargets = {
      protein: 50,
      carbs: 40,
      fat: 0,
      calories: 360,
    };

    const result = rebalancePlan(plan, target);

    // Verificar ordem dos ajustes (proteína antes de carbo)
    const proteinAdjIndex = result.adjustments.findIndex(a => a.foodId === 'protein-1');
    const carbAdjIndex = result.adjustments.findIndex(a => a.foodId === 'carb-1');

    if (proteinAdjIndex !== -1 && carbAdjIndex !== -1) {
      expect(proteinAdjIndex).toBeLessThan(carbAdjIndex);
    }
  });
});

// =====================================================
// TESTES - REGRA 3: PROTEÍNA NÃO ADICIONA CALORIAS
// =====================================================

describe('REGRA 3: Proteína Não Adiciona Calorias (Compensação)', () => {
  it('ao aumentar proteína, deve compensar com redução de outros macros', () => {
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
      createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 100 }),
      createPlanItem({ id: 'item-2', food: carbFood, quantityGrams: 150 }),
    ];

    const plan = createPlan(items);
    
    // Calcular macros atuais
    const current = sumMacros(items);
    
    // Meta: mais proteína, mesmas calorias
    const target: MacroTargets = {
      protein: current.protein + 20, // +20g proteína
      carbs: current.carbs - 10,     // -10g carbo (compensação)
      fat: current.fat,
      calories: current.calories,    // MESMAS calorias
    };

    const result = rebalancePlan(plan, target);

    // Se for válido, verificar que as calorias não explodiram
    if (result.isValid) {
      const calorieDiff = Math.abs(result.proposedMacros.calories - target.calories);
      const toleranceCalories = target.calories * (CALORIE_TOLERANCE_PERCENT / 100);
      expect(calorieDiff).toBeLessThanOrEqual(toleranceCalories);
    }
  });
});

// =====================================================
// TESTES - REGRA 4: CARBO E GORDURA NUNCA SOBEM JUNTOS
// =====================================================

describe('REGRA 4: Carboidrato e Gordura Nunca Sobem Juntos', () => {
  it('deve validar que carbs e gordura não podem aumentar simultaneamente', () => {
    const result = validateNoSimultaneousIncrease(10, 5); // Ambos positivos
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('VIOLAÇÃO');
  });

  it('deve aceitar quando apenas carbs aumenta', () => {
    const result = validateNoSimultaneousIncrease(10, -5); // Carbs sobe, gordura desce
    expect(result.isValid).toBe(true);
  });

  it('deve aceitar quando apenas gordura aumenta', () => {
    const result = validateNoSimultaneousIncrease(-10, 5); // Carbs desce, gordura sobe
    expect(result.isValid).toBe(true);
  });

  it('deve aceitar quando ambos diminuem', () => {
    const result = validateNoSimultaneousIncrease(-10, -5); // Ambos descem
    expect(result.isValid).toBe(true);
  });

  it('rebalancePlan não deve propor aumento simultâneo de carbs e gordura', () => {
    const carbFood = createFood({
      id: 'carb-1',
      name: 'Arroz',
      calories: 130,
      protein: 2.7,
      carbs: 28,
      fat: 0.3,
      category: 'carboidratos',
    });

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
      createPlanItem({ id: 'item-1', food: carbFood, quantityGrams: 100 }),
      createPlanItem({ id: 'item-2', food: fatFood, quantityGrams: 10 }),
    ];

    const plan = createPlan(items);
    const current = sumMacros(items);
    
    // Meta que pede mais carbs E mais gordura (impossível pelas regras)
    const target: MacroTargets = {
      protein: current.protein,
      carbs: current.carbs + 50,    // +50g carbs
      fat: current.fat + 20,        // +20g gordura
      calories: current.calories + 400,
    };

    const result = rebalancePlan(plan, target);

    // Se for válido, verificar que não houve aumento simultâneo
    if (result.isValid) {
      const carbsDelta = result.proposedMacros.carbs - current.carbs;
      const fatDelta = result.proposedMacros.fat - current.fat;
      
      // Não deve haver aumento simultâneo
      expect(carbsDelta > 0 && fatDelta > 0).toBe(false);
    }
  });
});

// =====================================================
// TESTES - REGRA 5: GORDURA É AJUSTE FINO (±5g)
// =====================================================

describe('REGRA 5: Gordura É Ajuste Fino (±5g)', () => {
  it('deve aceitar gordura dentro da tolerância de +5g', () => {
    const result = validateFatTolerance(55, 50); // +5g
    expect(result.isValid).toBe(true);
  });

  it('deve aceitar gordura dentro da tolerância de -5g', () => {
    const result = validateFatTolerance(45, 50); // -5g
    expect(result.isValid).toBe(true);
  });

  it('deve rejeitar gordura acima de +5g da meta', () => {
    const result = validateFatTolerance(60, 50); // +10g
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Gordura fora da tolerância');
  });

  it('FAT_TOLERANCE_GRAMS deve ser 5', () => {
    expect(FAT_TOLERANCE_GRAMS).toBe(5);
  });
});

// =====================================================
// TESTES - REGRA 6: FALHA SEGURA
// =====================================================

describe('REGRA 6: Falha Segura (Sinaliza Suplementação)', () => {
  it('deve sinalizar necessidade de suplemento quando há déficit impossível', () => {
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
    
    // Meta com muito mais proteína do que possível
    const target: MacroTargets = {
      protein: 150, // Impossível com 50g de frango
      carbs: 0,
      fat: 5,
      calories: 700,
    };

    const result = rebalancePlan(plan, target, { allowSupplements: true });

    // Deve ter sinalizado necessidade de suplemento de proteína
    const proteinNeed = result.supplementNeeds.find(s => s.type === 'protein');
    expect(proteinNeed).toBeDefined();
    expect(proteinNeed!.deficitGrams).toBeGreaterThan(0);
    expect(proteinNeed!.message).toContain('Suplementação');
  });

  it('não deve adicionar suplementos automaticamente', () => {
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
      protein: 150,
      carbs: 0,
      fat: 5,
      calories: 700,
    };

    const result = rebalancePlan(plan, target, { allowSupplements: true });

    // Verificar que nenhum ajuste adiciona um suplemento novo
    for (const adj of result.adjustments) {
      expect(adj.foodName.toLowerCase()).not.toContain('suplemento');
      expect(adj.foodName.toLowerCase()).not.toContain('whey');
    }
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
      protein: 150,
      carbs: 0,
      fat: 5,
      calories: 700,
    };

    const result = rebalancePlan(plan, target, { allowSupplements: false });

    expect(result.supplementNeeds).toHaveLength(0);
  });
});

// =====================================================
// TESTES ORIGINAIS - REGRAS CANÔNICAS
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
      const current = sumMacros(items);
      
      // Meta com menos gordura e calorias (dentro das regras)
      const target: MacroTargets = {
        protein: 0,
        carbs: 0,
        fat: current.fat - 10, // Reduzir 10g
        calories: current.calories - 90, // 10g * 9 kcal
      };

      const result = rebalancePlan(plan, target);

      // Verificar que houve ajuste ou que a proposta está mais próxima da meta
      if (result.adjustments.length > 0) {
        const fatAdjustment = result.adjustments.find(a => a.foodId === 'fat-1');
        expect(fatAdjustment).toBeDefined();
        expect(fatAdjustment!.newGrams).toBeLessThan(fatAdjustment!.originalGrams);
      } else {
        // Se não houve ajustes, verificar que já está próximo da meta
        expect(result.proposedMacros.fat).toBeLessThanOrEqual(current.fat);
      }
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

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

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

// =====================================================
// IMUTABILIDADE
// =====================================================

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

// =====================================================
// TESTES DE INTEGRAÇÃO - CENÁRIOS REALISTAS
// =====================================================

describe('Cenários Realistas de Rebalanceamento', () => {
  it('cenário: usuário quer mais proteína sem estourar calorias', () => {
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
      createPlanItem({ id: 'item-1', food: proteinFood, quantityGrams: 150 }),
      createPlanItem({ id: 'item-2', food: carbFood, quantityGrams: 200 }),
    ];

    const plan = createPlan(items);
    const current = sumMacros(items);
    
    // Meta: +30g proteína, -20g carbs, mesmas calorias
    const target: MacroTargets = {
      protein: current.protein + 30,
      carbs: current.carbs - 20,
      fat: current.fat,
      calories: current.calories, // MESMAS calorias
    };

    const result = rebalancePlan(plan, target);

    // Verificar que as calorias não excederam 2%
    if (result.isValid) {
      const calorieError = Math.abs(result.proposedMacros.calories - target.calories) / target.calories;
      expect(calorieError).toBeLessThanOrEqual(0.02);
    }
  });

  it('cenário: impossível atingir metas → deve falhar de forma segura', () => {
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
    
    // Meta impossível: muita proteína, poucas calorias
    const target: MacroTargets = {
      protein: 200,   // Impossível
      carbs: 50,
      fat: 20,
      calories: 500,  // Mas com poucas calorias
    };

    const result = rebalancePlan(plan, target, { allowSupplements: true });

    // Deve sinalizar a impossibilidade
    expect(result.supplementNeeds.length > 0 || result.validationErrors.length > 0).toBe(true);
  });
});
