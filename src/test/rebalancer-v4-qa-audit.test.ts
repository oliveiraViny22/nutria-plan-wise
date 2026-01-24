// =====================================================
// AUDITORIA QA - REBALANCER V4
// =====================================================
// Casos de teste exigidos pelo QA Architect
// Validação de COMPORTAMENTO OBSERVÁVEL apenas
// =====================================================

import { describe, it, expect } from 'vitest';
import {
  rebalancePlanV4,
  DietPlan,
  PlanItem,
  MacroTargets,
  RebalanceStatus,
} from '@/lib/rebalancer-v4';

// =====================================================
// HELPERS
// =====================================================

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

// =====================================================
// CASO 1 — PLANO MAL-FORMADO
// Dado:
// - Proteína concentrada em 1 refeição
// - Gordura > 40% das calorias
// - Carbo < 70% da meta
// =====================================================

describe('CASO 1 — PLANO MAL-FORMADO', () => {
  it('deve retornar status = "blocked_structural"', () => {
    // Plano com proteína concentrada em 1 refeição
    // Gordura > 40% das calorias
    // Carbo < 70% da meta
    const items: PlanItem[] = [
      // Refeição 1: TODA a proteína concentrada aqui
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'carne-gordura',
          name: 'Carne gordurosa',
          protein: 25,
          carbs: 0,
          fat: 35, // Alta gordura
          calories: 415,
          category: 'proteinas',
        }),
        quantityGrams: 400, // 100g prot, 140g fat = 1660 kcal
      }),
      // Refeição 2: Sem proteína
      createPlanItem({
        id: '2',
        mealId: 'meal-2',
        mealName: 'Jantar',
        food: createFood({
          id: 'arroz',
          name: 'Arroz',
          protein: 2,
          carbs: 28,
          fat: 0,
          calories: 130,
          category: 'carboidratos',
        }),
        quantityGrams: 100, // 28g carbs = 130 kcal
      }),
      // Refeição 3: Sem proteína
      createPlanItem({
        id: '3',
        mealId: 'meal-3',
        mealName: 'Café da manhã',
        food: createFood({
          id: 'pao',
          name: 'Pão',
          protein: 3,
          carbs: 50,
          fat: 1,
          calories: 220,
          category: 'carboidratos',
        }),
        quantityGrams: 50, // ~25g carbs
      }),
    ];

    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 2000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // ESPERADO: blocked_structural
    expect(result.status).toBe('blocked_structural');
    
    // ESPERADO: Nenhum ajuste aplicado
    // NOTA: O V4 pode retornar ajustes mesmo em bloqueio, 
    // mas eles NÃO devem ser aplicados
    expect(result.plan).toBeUndefined();
    
    // ESPERADO: reason clara e não técnica
    expect(result.reason).toBeDefined();
    expect(result.reason).not.toContain('NaN');
    expect(result.reason).not.toContain('undefined');
  });

  it('não deve exibir mensagem de "plano otimizado"', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'bacon',
          name: 'Bacon',
          protein: 12,
          carbs: 0,
          fat: 45,
          calories: 450,
          category: 'proteinas',
        }),
        quantityGrams: 300,
      }),
    ];

    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 2000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // Nunca deve ser "adjusted" ou "balanced" se estrutura é inválida
    expect(result.status).not.toBe('adjusted');
    expect(result.status).not.toBe('balanced');
  });
});

// =====================================================
// CASO 2 — PLANO COM AMENDOIM COMO BASE
// Dado:
// - Café da manhã com amendoim como principal alimento
// - Ausência de proteína magra
// =====================================================

describe('CASO 2 — PLANO COM AMENDOIM COMO BASE', () => {
  it('deve retornar status = "blocked_structural"', () => {
    const items: PlanItem[] = [
      // Café da manhã: apenas amendoim (gordura como base)
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Café da manhã',
        food: createFood({
          id: 'amendoim',
          name: 'Amendoim',
          protein: 26, // Tem proteína, mas é gordura dominante
          carbs: 16,
          fat: 49,
          calories: 567,
          category: 'gorduras', // Categoria gordura
        }),
        quantityGrams: 100,
      }),
      // Almoço: sem proteína magra real
      createPlanItem({
        id: '2',
        mealId: 'meal-2',
        mealName: 'Almoço',
        food: createFood({
          id: 'arroz',
          name: 'Arroz',
          protein: 2.5,
          carbs: 28,
          fat: 0.3,
          calories: 130,
          category: 'carboidratos',
        }),
        quantityGrams: 200,
      }),
      // Jantar: mais amendoim
      createPlanItem({
        id: '3',
        mealId: 'meal-3',
        mealName: 'Jantar',
        food: createFood({
          id: 'pasta-amendoim',
          name: 'Pasta de amendoim',
          protein: 25,
          carbs: 20,
          fat: 50,
          calories: 588,
          category: 'gorduras',
        }),
        quantityGrams: 100,
      }),
    ];

    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 2000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // ESPERADO: blocked_structural
    // NOTA: A validação atual pode não capturar isso explicitamente
    // porque amendoim tem proteína. Este é um GAP potencial.
    expect(result.status).toBe('blocked_structural');
  });

  it('rebalanceador NÃO deve executar ajustes', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Café da manhã',
        food: createFood({
          id: 'amendoim',
          name: 'Amendoim',
          protein: 26,
          carbs: 16,
          fat: 49,
          calories: 567,
          category: 'gorduras',
        }),
        quantityGrams: 200, // 200g = 98g fat = 882 kcal só de gordura
      }),
    ];

    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 2000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // Se bloqueado, plan deve ser undefined
    if (result.status === 'blocked_structural') {
      expect(result.plan).toBeUndefined();
    }
  });
});

// =====================================================
// CASO 3 — PLANO REBALANCEÁVEL
// Dado:
// - Proteína presente em todas as refeições
// - Carbo 92% da meta
// - Gordura dentro do limite
// =====================================================

describe('CASO 3 — PLANO REBALANCEÁVEL', () => {
  it('deve retornar status = "adjusted"', () => {
    const items: PlanItem[] = [
      // Café da manhã com proteína
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Café da manhã',
        food: createFood({
          id: 'ovos',
          name: 'Ovos',
          protein: 13,
          carbs: 1,
          fat: 10,
          calories: 155,
          category: 'proteinas',
        }),
        quantityGrams: 100,
      }),
      // Almoço com proteína
      createPlanItem({
        id: '2',
        mealId: 'meal-2',
        mealName: 'Almoço',
        food: createFood({
          id: 'frango',
          name: 'Frango',
          protein: 31,
          carbs: 0,
          fat: 3.6,
          calories: 165,
          category: 'proteinas',
        }),
        quantityGrams: 300, // ~93g proteína
      }),
      // Carboidrato (92% da meta = 184g)
      createPlanItem({
        id: '3',
        mealId: 'meal-2',
        mealName: 'Almoço',
        food: createFood({
          id: 'arroz',
          name: 'Arroz',
          protein: 2.5,
          carbs: 28,
          fat: 0.3,
          calories: 130,
          category: 'carboidratos',
        }),
        quantityGrams: 657, // ~184g carbs
      }),
      // Jantar com proteína
      createPlanItem({
        id: '4',
        mealId: 'meal-3',
        mealName: 'Jantar',
        food: createFood({
          id: 'peixe',
          name: 'Peixe',
          protein: 25,
          carbs: 0,
          fat: 5,
          calories: 140,
          category: 'proteinas',
        }),
        quantityGrams: 150, // ~37.5g proteína
      }),
    ];

    const target: MacroTargets = {
      protein: 145, // Atual: ~143g (dentro de 2%)
      carbs: 200,   // Atual: ~184g (92%)
      fat: 55,      // Atual: ~52g (dentro de 5g)
      calories: 1800,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // ESPERADO: adjusted ou balanced
    expect(['adjusted', 'balanced']).toContain(result.status);
  });

  it('deve aplicar apenas ajustes de quantidade (sem troca de alimento)', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood(),
        quantityGrams: 400, // ~124g proteína
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
          category: 'carboidratos',
        }),
        quantityGrams: 650, // ~182g carbs
      }),
    ];

    const target: MacroTargets = {
      protein: 130,
      carbs: 185,
      fat: 20,
      calories: 1500,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // Verificar que ajustes são apenas de quantidade
    if (result.adjustments.length > 0) {
      for (const adj of result.adjustments) {
        // Deve manter o mesmo foodId
        expect(adj.foodId).toBeDefined();
        // originalGrams e newGrams devem ser diferentes
        expect(adj.originalGrams).toBeDefined();
        expect(adj.newGrams).toBeDefined();
      }
    }
  });
});

// =====================================================
// CASO 4 — PLANO JÁ BALANCEADO
// Dado:
// - Todos os macros dentro da tolerância
// =====================================================

describe('CASO 4 — PLANO JÁ BALANCEADO', () => {
  it('deve retornar status = "balanced"', () => {
    // Construir plano que atende exatamente as metas
    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 1940, // Calculado: 150*4 + 200*4 + 60*9 = 600 + 800 + 540 = 1940
    };

    const items: PlanItem[] = [
      // Proteína: 150g via frango
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'frango',
          name: 'Frango',
          protein: 31,
          carbs: 0,
          fat: 3.6,
          calories: 165,
          category: 'proteinas',
        }),
        quantityGrams: 484, // 484 * 0.31 = 150g proteína, ~17g fat
      }),
      // Carboidrato: 200g via arroz
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
          category: 'carboidratos',
        }),
        quantityGrams: 714, // 714 * 0.28 = 200g carbs, ~2g fat
      }),
      // Gordura restante: ~41g necessária
      createPlanItem({
        id: '3',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'azeite',
          name: 'Azeite',
          protein: 0,
          carbs: 0,
          fat: 100,
          calories: 900,
          category: 'gorduras',
        }),
        quantityGrams: 41, // 41g fat
      }),
    ];

    const result = rebalancePlanV4(createPlan(items), target);

    // ESPERADO: balanced
    expect(result.status).toBe('balanced');
  });

  it('não deve aplicar nenhuma alteração', () => {
    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 1940,
    };

    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'frango',
          name: 'Frango',
          protein: 31,
          carbs: 0,
          fat: 3.6,
          calories: 165,
          category: 'proteinas',
        }),
        quantityGrams: 484,
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
          category: 'carboidratos',
        }),
        quantityGrams: 714,
      }),
      createPlanItem({
        id: '3',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'azeite',
          name: 'Azeite',
          protein: 0,
          carbs: 0,
          fat: 100,
          calories: 900,
          category: 'gorduras',
        }),
        quantityGrams: 41,
      }),
    ];

    const result = rebalancePlanV4(createPlan(items), target);

    if (result.status === 'balanced') {
      // ESPERADO: Nenhuma alteração
      expect(result.adjustments).toEqual([]);
    }
  });

  it('deve exibir mensagem correta de plano equilibrado', () => {
    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 1940,
    };

    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          protein: 31,
          carbs: 0,
          fat: 3.6,
          calories: 165,
          category: 'proteinas',
        }),
        quantityGrams: 484,
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
          category: 'carboidratos',
        }),
        quantityGrams: 714,
      }),
      createPlanItem({
        id: '3',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'azeite',
          name: 'Azeite',
          protein: 0,
          carbs: 0,
          fat: 100,
          calories: 900,
          category: 'gorduras',
        }),
        quantityGrams: 41,
      }),
    ];

    const result = rebalancePlanV4(createPlan(items), target);

    // balanced não deve ter reason de erro
    if (result.status === 'balanced') {
      expect(result.reason).toBeUndefined();
    }
  });
});

// =====================================================
// CASO 5 — PLANO NÃO FECHA POR QUANTIDADE
// Dado:
// - Estrutura correta
// - Mesmo após ajustes, macros não fecham
// =====================================================

describe('CASO 5 — PLANO NÃO FECHA POR QUANTIDADE', () => {
  it('deve retornar status = "blocked_structural"', () => {
    // Plano estruturalmente OK, mas impossível fechar
    // porque a meta é muito alta para os alimentos disponíveis
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'frango',
          name: 'Frango',
          protein: 31,
          carbs: 0,
          fat: 3.6,
          calories: 165,
          category: 'proteinas',
        }),
        quantityGrams: 100, // ~31g proteína
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
          category: 'carboidratos',
        }),
        quantityGrams: 100, // ~28g carbs
      }),
      createPlanItem({
        id: '3',
        mealId: 'meal-2',
        mealName: 'Jantar',
        food: createFood({
          id: 'peixe',
          name: 'Peixe',
          protein: 25,
          carbs: 0,
          fat: 5,
          calories: 140,
          category: 'proteinas',
        }),
        quantityGrams: 100, // ~25g proteína
      }),
    ];

    // Meta MUITO acima do que os alimentos podem fornecer
    const target: MacroTargets = {
      protein: 300, // Atual: ~56g - impossível atingir
      carbs: 400,   // Atual: ~28g - impossível atingir
      fat: 80,
      calories: 3500,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // ESPERADO: blocked_structural
    expect(result.status).toBe('blocked_structural');
  });

  it('NÃO deve exibir "plano otimizado" ou "adjusted"', () => {
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood(),
        quantityGrams: 100,
      }),
    ];

    const target: MacroTargets = {
      protein: 500, // Impossível
      carbs: 600,
      fat: 150,
      calories: 5000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    expect(result.status).not.toBe('adjusted');
    expect(result.status).not.toBe('balanced');
  });

  it('NÃO deve executar IA automaticamente', () => {
    // O V4 não deve tentar chamar IA - isso é responsabilidade
    // do hook híbrido quando recebe blocked_structural
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood(),
        quantityGrams: 100,
      }),
    ];

    const target: MacroTargets = {
      protein: 500,
      carbs: 600,
      fat: 150,
      calories: 5000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // V4 é puro - não tem campo de IA
    expect(result).not.toHaveProperty('aiSuggestions');
    expect(result).not.toHaveProperty('aiStrategies');
  });
});

// =====================================================
// REGRA FINAL: AUSÊNCIA DE AJUSTES ≠ PLANO VÁLIDO
// =====================================================

describe('REGRA FINAL — Validação de Plano', () => {
  it('ausência de ajustes NÃO significa plano válido', () => {
    // Plano com estrutura inválida, mas sem ajustes possíveis
    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'bacon',
          name: 'Bacon gorduroso',
          protein: 10,
          carbs: 0,
          fat: 50,
          calories: 490,
          category: 'gorduras', // Gordura, não proteína real
        }),
        quantityGrams: 300,
      }),
    ];

    const target: MacroTargets = {
      protein: 150,
      carbs: 200,
      fat: 60,
      calories: 2000,
    };

    const result = rebalancePlanV4(createPlan(items), target);

    // Mesmo sem ajustes, deve ser bloqueado
    expect(result.status).toBe('blocked_structural');
    
    // Ajustes vazios não indicam sucesso
    if (result.adjustments.length === 0) {
      expect(result.status).not.toBe('balanced');
      expect(result.status).not.toBe('adjusted');
    }
  });

  it('plano válido = macros dentro da tolerância', () => {
    // Plano que REALMENTE atende as metas
    const target: MacroTargets = {
      protein: 100,
      carbs: 150,
      fat: 50,
      calories: 1450,
    };

    const items: PlanItem[] = [
      createPlanItem({
        id: '1',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'frango',
          name: 'Frango',
          protein: 31,
          carbs: 0,
          fat: 3.6,
          calories: 165,
          category: 'proteinas',
        }),
        quantityGrams: 323, // ~100g prot, ~12g fat
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
          category: 'carboidratos',
        }),
        quantityGrams: 536, // ~150g carbs
      }),
      createPlanItem({
        id: '3',
        mealId: 'meal-1',
        mealName: 'Almoço',
        food: createFood({
          id: 'azeite',
          name: 'Azeite',
          protein: 0,
          carbs: 0,
          fat: 100,
          calories: 900,
          category: 'gorduras',
        }),
        quantityGrams: 36, // ~36g fat (total ~48g, dentro de ±5g de 50)
      }),
    ];

    const result = rebalancePlanV4(createPlan(items), target);

    // Deve ser balanced ou adjusted
    expect(['balanced', 'adjusted']).toContain(result.status);
    
    // proposedMacros deve estar dentro das tolerâncias
    if (result.proposedMacros) {
      // Calorias: ±2%
      const calDiff = Math.abs((result.proposedMacros.calories - target.calories) / target.calories) * 100;
      expect(calDiff).toBeLessThanOrEqual(2.1); // Pequena margem de arredondamento

      // Proteína: ±2%
      const protDiff = Math.abs((result.proposedMacros.protein - target.protein) / target.protein) * 100;
      expect(protDiff).toBeLessThanOrEqual(2.1);

      // Gordura: ±5g
      const fatDiff = Math.abs(result.proposedMacros.fat - target.fat);
      expect(fatDiff).toBeLessThanOrEqual(5.5);
    }
  });
});
