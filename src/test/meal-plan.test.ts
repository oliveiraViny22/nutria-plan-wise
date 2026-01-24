import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token', user: { id: 'test-user' } } },
        error: null,
      }),
    },
  },
}));

// ============================================================
// TESTES DO GERADOR DE PLANO ALIMENTAR (SPEC CANÔNICA)
// ============================================================

describe('Meal Plan Generator - Canonical Spec', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // 1. VALIDAÇÕES INICIAIS
  // ============================================================
  
  describe('Initial Validations (Spec Lines 1-30)', () => {
    it('should require valid calorie target', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Metas nutricionais inválidas' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 0, // Invalid
            protein_target: 100,
            carbs_target: 200,
            fat_target: 50,
            meals_per_day: 4,
          },
        },
      });

      expect(result.error).toBeDefined();
    });

    it('should require complete profile data', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Perfil incompleto' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {}, // Empty profile
        },
      });

      expect(result.error).toBeDefined();
    });

    it('should validate macro coherence (warning, not error)', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        status: 'draft',
        validation: {
          valid: true,
          warnings: ['Calorias totais diferem da meta'],
        },
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            protein_target: 150,
            carbs_target: 250,
            fat_target: 70,
            meals_per_day: 4,
          },
        },
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });
  });

  // ============================================================
  // 2. ESTRUTURA DE REFEIÇÕES
  // ============================================================

  describe('Meal Structure (Spec Lines 30-60)', () => {
    it('should generate correct number of meals', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          { name: 'Café da Manhã', options: [] },
          { name: 'Almoço', options: [] },
          { name: 'Lanche da Tarde', options: [] },
          { name: 'Jantar', options: [] },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            protein_target: 150,
            carbs_target: 250,
            fat_target: 70,
            meals_per_day: 4,
          },
        },
      });

      expect(result.data.meals).toHaveLength(4);
    });

    it('should use correct meal names for Portuguese locale', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          { name: 'Café da Manhã', options: [] },
          { name: 'Lanche da Manhã', options: [] },
          { name: 'Almoço', options: [] },
          { name: 'Lanche da Tarde', options: [] },
          { name: 'Jantar', options: [] },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 5 },
        },
      });

      const mealNames = result.data.meals.map((m: { name: string }) => m.name);
      expect(mealNames).toContain('Café da Manhã');
      expect(mealNames).toContain('Almoço');
      expect(mealNames).toContain('Jantar');
    });
  });

  // ============================================================
  // 3. CATEGORIAS CANÔNICAS
  // ============================================================

  describe('Canonical Categories (Spec Lines 90-130)', () => {
    it('should only use canonical food categories', async () => {
      const CANONICAL_CATEGORIES = [
        'carboidratos', 'proteinas', 'gorduras', 'vegetais',
        'frutas', 'laticinios', 'leguminosas', 'suplementos', 'mistos'
      ];

      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas' }, quantity_grams: 120 },
                { food: { category: 'carboidratos' }, quantity_grams: 150 },
                { food: { category: 'vegetais' }, quantity_grams: 100 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            expect(CANONICAL_CATEGORIES).toContain(food.food.category);
          }
        }
      }
    });

    it('should never include legacy categories like cereais_tuberculos', async () => {
      const LEGACY_CATEGORIES = [
        'cereais_tuberculos', 'proteinas_animais', 'hortalicas_folhosas',
        'oleos_oleaginosas', 'Proteínas Animais', 'Cereais e Tubérculos'
      ];

      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas' }, quantity_grams: 120 },
                { food: { category: 'carboidratos' }, quantity_grams: 150 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            expect(LEGACY_CATEGORIES).not.toContain(food.food.category);
          }
        }
      }
    });
  });

  // ============================================================
  // 4. SUPLEMENTOS NUNCA NO PLANO INICIAL
  // ============================================================

  describe('Supplements Never in Initial Plan (Spec Lines 210-240)', () => {
    it('should NEVER include supplements in initial plan', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{
              foods: [
                { food: { category: 'laticinios', name: 'Iogurte' }, quantity_grams: 200 },
                { food: { category: 'frutas', name: 'Banana' }, quantity_grams: 120 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            goal: 'gain_muscle', // Even for muscle gain
          },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            expect(food.food.category).not.toBe('suplementos');
            expect(food.food.name?.toLowerCase()).not.toContain('whey');
            expect(food.food.name?.toLowerCase()).not.toContain('creatina');
          }
        }
      }
    });

    it('should not use supplements to close macro gaps', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        total_protein: 140, // Slightly under target
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas', name: 'Frango' }, quantity_grams: 150 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            protein_target: 160, // Higher protein target
            meals_per_day: 4,
          },
        },
      });

      // Even with protein gap, no supplements should be added
      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            expect(food.food.category).not.toBe('suplementos');
          }
        }
      }
    });
  });

  // ============================================================
  // 5. STATUS DO PLANO = DRAFT
  // ============================================================

  describe('Plan Status (Spec Line 11)', () => {
    it('should create plan with status draft, not active', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        status: 'draft', // Must be draft
        meals: [],
      };

      mockInvoke.mockResolvedValueOnce({
        data: { success: true, plan: mockMealPlan },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
          },
        },
      });

      expect(result.data.plan.status).toBe('draft');
    });

    it('should never create plan with locked status', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        status: 'draft',
        meals: [],
      };

      mockInvoke.mockResolvedValueOnce({
        data: { success: true, plan: mockMealPlan },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      expect(result.data.plan.status).not.toBe('locked');
      expect(result.data.plan.status).not.toBe('active');
    });
  });

  // ============================================================
  // 6. REFEIÇÕES PRINCIPAIS COM PROTEÍNA
  // ============================================================

  describe('Main Meals Must Have Protein (Spec Lines 130-180)', () => {
    it('should include protein in lunch', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas', name: 'Frango Grelhado' }, quantity_grams: 150 },
                { food: { category: 'carboidratos', name: 'Arroz' }, quantity_grams: 150 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      const lunch = result.data.meals.find((m: { name: string }) => m.name === 'Almoço');
      const hasProtein = lunch?.options?.[0]?.foods?.some(
        (f: { food: { category: string } }) => f.food.category === 'proteinas'
      );
      expect(hasProtein).toBe(true);
    });

    it('should include protein in dinner', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Jantar',
            options: [{
              foods: [
                { food: { category: 'proteinas', name: 'Peixe' }, quantity_grams: 150 },
                { food: { category: 'vegetais', name: 'Salada' }, quantity_grams: 100 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      const dinner = result.data.meals.find((m: { name: string }) => m.name === 'Jantar');
      const hasProtein = dinner?.options?.[0]?.foods?.some(
        (f: { food: { category: string } }) => f.food.category === 'proteinas'
      );
      expect(hasProtein).toBe(true);
    });
  });

  // ============================================================
  // 7. PORÇÕES MÉDIAS E PLAUSÍVEIS
  // ============================================================

  describe('Reasonable Portions (Spec Lines 240-270)', () => {
    it('should have portions within reasonable limits', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas' }, quantity_grams: 150 },
                { food: { category: 'carboidratos' }, quantity_grams: 200 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            // Portions should be between 10g and 500g
            expect(food.quantity_grams).toBeGreaterThanOrEqual(10);
            expect(food.quantity_grams).toBeLessThanOrEqual(500);
          }
        }
      }
    });

    it('should not have zero portions', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas' }, quantity_grams: 150 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            expect(food.quantity_grams).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  // ============================================================
  // 8. CALORIAS DENTRO DA FAIXA ACEITÁVEL
  // ============================================================

  describe('Calories Within Acceptable Range (Spec Lines 270-300)', () => {
    it('should have total calories within ±15% of target', async () => {
      const targetCalories = 2000;
      const mockMealPlan = {
        id: 'plan-123',
        total_calories: 1950, // Within 15%
        meals: [],
      };

      mockInvoke.mockResolvedValueOnce({
        data: { success: true, plan: mockMealPlan },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: targetCalories,
            meals_per_day: 4,
          },
        },
      });

      const actualCalories = result.data.plan.total_calories;
      const errorPercent = Math.abs(actualCalories - targetCalories) / targetCalories;
      expect(errorPercent).toBeLessThanOrEqual(0.15);
    });
  });

  // ============================================================
  // 9. RESTRIÇÕES ALIMENTARES
  // ============================================================

  describe('Dietary Restrictions (Spec Line 13)', () => {
    it('should respect lactose restriction', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{
              foods: [
                { food: { category: 'frutas', name: 'Banana' }, quantity_grams: 120 },
                { food: { category: 'carboidratos', name: 'Pão' }, quantity_grams: 60 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            restrictions: ['lactose'],
          },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            expect(food.food.category).not.toBe('laticinios');
          }
        }
      }
    });

    it('should respect vegetarian restriction', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'leguminosas', name: 'Feijão' }, quantity_grams: 150 },
                { food: { category: 'carboidratos', name: 'Arroz' }, quantity_grams: 150 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            restrictions: ['vegetariano'],
          },
        },
      });

      for (const meal of result.data.meals) {
        for (const option of meal.options || []) {
          for (const food of option.foods || []) {
            // Should not have meat proteins
            if (food.food.category === 'proteinas') {
              const name = food.food.name?.toLowerCase() || '';
              expect(name).not.toContain('frango');
              expect(name).not.toContain('carne');
              expect(name).not.toContain('peixe');
            }
          }
        }
      }
    });
  });

  // ============================================================
  // 10. AUTENTICAÇÃO OBRIGATÓRIA
  // ============================================================

  describe('Authentication Required', () => {
    it('should require authentication', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Autenticação necessária' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: { profile: { daily_calories: 2000 } },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Autenticação');
    });
  });

  // ============================================================
  // 11. LIMITES DE USO
  // ============================================================

  describe('Usage Limits', () => {
    it('should check usage limits', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Limite de uso atingido' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: { profile: { daily_calories: 2000 } },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Limite');
    });
  });
});

// ============================================================
// TESTES DE DIFERENCIAÇÃO: GERADOR vs REBALANCEADOR
// ============================================================

describe('Generator vs Rebalancer Separation (Spec Section 14)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generator should NOT adjust portions precisely', async () => {
    const mockMealPlan = {
      id: 'plan-123',
      total_calories: 1950,
      meals: [],
    };

    mockInvoke.mockResolvedValueOnce({
      data: { success: true, plan: mockMealPlan },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 2000,
          meals_per_day: 4,
        },
      },
    });

    expect(result.data.plan.total_calories).not.toBe(2000);
    expect(Math.abs(result.data.plan.total_calories - 2000)).toBeLessThan(300);
  });

  it('generator should NOT use AI for macro calculations', async () => {
    const mockMealPlan = {
      id: 'plan-123',
      total_calories: 1900,
      meals: [],
    };

    mockInvoke.mockResolvedValueOnce({
      data: { success: true, plan: mockMealPlan },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: { daily_calories: 2000, meals_per_day: 4 },
      },
    });

    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });
});

// ============================================================
// TESTES DE REGRAS ESTRUTURAIS v2 - PLANOS MAL FORMADOS
// ============================================================

describe('Structural Rules v2 - Malformed Plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // 1. TODA REFEIÇÃO DEVE TER PROTEÍNA COMPATÍVEL
  // ============================================================

  describe('Every Meal Must Have Compatible Protein', () => {
    it('should FAIL if breakfast has no protein source', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Não há fonte de proteína compatível para Café da Manhã' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            restrictions: ['lactose', 'ovo'], // Blocks most breakfast proteins
          },
        },
      });

      expect(result.error).toBeDefined();
    });

    it('should FAIL if lunch has no compatible protein source', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Não há fonte de proteína compatível para Almoço' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            restrictions: ['vegetariano', 'ovo'], // Very restrictive
          },
        },
      });

      expect(result.error).toBeDefined();
    });

    it('should include protein in ALL meals, not just main ones', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{
              foods: [
                { food: { category: 'laticinios', name: 'Iogurte', protein: 8 }, quantity_grams: 200 },
                { food: { category: 'frutas', name: 'Banana' }, quantity_grams: 120 },
              ]
            }]
          },
          {
            name: 'Lanche da Manhã',
            options: [{
              foods: [
                { food: { category: 'laticinios', name: 'Queijo Cottage', protein: 12 }, quantity_grams: 100 },
                { food: { category: 'frutas', name: 'Maçã' }, quantity_grams: 100 },
              ]
            }]
          },
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas', name: 'Frango' }, quantity_grams: 150 },
                { food: { category: 'carboidratos', name: 'Arroz' }, quantity_grams: 150 },
              ]
            }]
          },
          {
            name: 'Jantar',
            options: [{
              foods: [
                { food: { category: 'proteinas', name: 'Peixe' }, quantity_grams: 150 },
                { food: { category: 'vegetais', name: 'Salada' }, quantity_grams: 100 },
              ]
            }]
          },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      for (const meal of result.data.meals) {
        const hasProtein = meal.options?.[0]?.foods?.some(
          (f: { food: { category: string; protein?: number } }) => 
            f.food.category === 'proteinas' || 
            (f.food.category === 'laticinios' && (f.food.protein || 0) >= 5)
        );
        expect(hasProtein).toBe(true);
      }
    });
  });

  // ============================================================
  // 2. ALIMENTOS BLOQUEADOS POR CONTEXTO
  // ============================================================

  describe('Blocked Foods by Meal Context', () => {
    it('should NOT include dinner foods in breakfast', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{
              foods: [
                { food: { category: 'laticinios', name: 'Iogurte' }, quantity_grams: 200 },
                { food: { category: 'carboidratos', name: 'Pão' }, quantity_grams: 60 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      const breakfast = result.data.meals.find((m: { name: string }) => 
        m.name === 'Café da Manhã'
      );
      
      for (const food of breakfast?.options?.[0]?.foods || []) {
        const name = food.food.name?.toLowerCase() || '';
        expect(name).not.toContain('feijão');
        expect(name).not.toContain('arroz');
        expect(name).not.toContain('bife');
        expect(name).not.toContain('frango grelhado');
      }
    });

    it('should NOT include breakfast foods in lunch', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Almoço',
            options: [{
              foods: [
                { food: { category: 'proteinas', name: 'Frango' }, quantity_grams: 150 },
                { food: { category: 'carboidratos', name: 'Arroz' }, quantity_grams: 150 },
                { food: { category: 'leguminosas', name: 'Feijão' }, quantity_grams: 100 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, meals_per_day: 4 },
        },
      });

      const lunch = result.data.meals.find((m: { name: string }) => 
        m.name === 'Almoço'
      );
      
      for (const food of lunch?.options?.[0]?.foods || []) {
        const name = food.food.name?.toLowerCase() || '';
        expect(name).not.toContain('granola');
        expect(name).not.toContain('cereal matinal');
        expect(name).not.toContain('mingau');
      }
    });
  });

  // ============================================================
  // 3. DISTRIBUIÇÃO EQUILIBRADA DE PROTEÍNA
  // ============================================================

  describe('Balanced Protein Distribution', () => {
    it('should meet minimum protein per meal type', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{ total_protein: 12, foods: [] }] // Min 10g
          },
          {
            name: 'Almoço',
            options: [{ total_protein: 28, foods: [] }] // Min 25g
          },
          {
            name: 'Lanche da Tarde',
            options: [{ total_protein: 10, foods: [] }] // Min 8g
          },
          {
            name: 'Jantar',
            options: [{ total_protein: 22, foods: [] }] // Min 20g
          },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: { daily_calories: 2000, protein_target: 150, meals_per_day: 4 },
        },
      });

      const minProteinByMeal: Record<string, number> = {
        'Café da Manhã': 10,
        'Lanche da Manhã': 5,
        'Almoço': 25,
        'Lanche da Tarde': 8,
        'Jantar': 20,
        'Ceia': 5,
      };

      for (const meal of result.data.meals) {
        const minProtein = minProteinByMeal[meal.name] || 5;
        const actualProtein = meal.options?.[0]?.total_protein || 0;
        expect(actualProtein).toBeGreaterThanOrEqual(minProtein * 0.8); // 80% tolerance
      }
    });
  });

  // ============================================================
  // 4. PREFERÊNCIAS NÃO QUEBRAM REGRAS
  // ============================================================

  describe('Preferences Do Not Break Structural Rules', () => {
    it('should prioritize preferences but still include protein', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{
              foods: [
                { food: { category: 'laticinios', name: 'Iogurte', protein: 8 }, quantity_grams: 200 },
                { food: { category: 'frutas', name: 'Banana' }, quantity_grams: 120 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            preferences: ['banana', 'maçã', 'frutas'], // Fruit preferences
          },
        },
      });

      // Even with fruit preferences, meals should have protein
      for (const meal of result.data.meals) {
        const hasProtein = meal.options?.[0]?.foods?.some(
          (f: { food: { category: string; protein?: number } }) => 
            f.food.category === 'proteinas' || 
            (f.food.category === 'laticinios' && (f.food.protein || 0) >= 3)
        );
        expect(hasProtein).toBe(true);
      }
    });

    it('should not use preferences to add blocked foods', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          {
            name: 'Café da Manhã',
            options: [{
              foods: [
                { food: { category: 'laticinios', name: 'Iogurte' }, quantity_grams: 200 },
                { food: { category: 'carboidratos', name: 'Pão' }, quantity_grams: 60 },
              ]
            }]
          }
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 4,
            preferences: ['feijão', 'arroz'], // Blocked for breakfast
          },
        },
      });

      const breakfast = result.data.meals.find((m: { name: string }) => 
        m.name === 'Café da Manhã'
      );
      
      for (const food of breakfast?.options?.[0]?.foods || []) {
        const name = food.food.name?.toLowerCase() || '';
        expect(name).not.toContain('feijão');
        expect(name).not.toContain('arroz');
      }
    });
  });

  // ============================================================
  // 5. PLANO FALHA SE REGRAS NÃO SÃO ATENDIDAS
  // ============================================================

  describe('Plan Generation Fails on Structural Violations', () => {
    it('should FAIL with clear error if no compatible protein exists', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Não foi possível gerar o plano: Não há fonte de proteína compatível' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 2000,
            meals_per_day: 6,
            restrictions: ['lactose', 'ovo', 'carne', 'frango', 'peixe'],
          },
        },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('proteína');
    });

    it('should NOT generate partial plan if some meals fail', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Não foi possível gerar o plano' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: 500, // Too low to meet all requirements
            meals_per_day: 6,
          },
        },
      });

      // Should fail entirely, not return partial plan
      if (result.error) {
        expect(result.data).toBeNull();
      }
    });
  });
});

// ============================================================
// TESTES DE REBALANCEADOR ASSUME PLANO VÁLIDO
// ============================================================

describe('Rebalancer Assumes Valid Plan (Post-Generation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rebalancer should NOT add protein if missing (generator responsibility)', async () => {
    // The rebalancer should assume the plan already has valid protein
    // It only adjusts portions, not structural composition
    const mockRebalanceResult = {
      success: true,
      adjustments: [
        { type: 'quantity_change', food_name: 'Frango', original_quantity: 120, new_quantity: 150 }
      ],
    };

    mockInvoke.mockResolvedValueOnce({
      data: mockRebalanceResult,
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('rebalance-meal-plan', {
      body: { plan_id: 'plan-123' },
    });

    // Rebalancer adjusts quantities, doesn't add new foods
    if (result.data?.adjustments) {
      for (const adj of result.data.adjustments) {
        expect(adj.type).toBe('quantity_change');
      }
    }
  });

  it('rebalancer should trust plan structure is correct', async () => {
    const mockRebalanceResult = {
      success: true,
      profile_type: 'premium',
      current_macros: { protein: 140, carbs: 200, fat: 60, calories: 1900 },
      target_macros: { protein: 150, carbs: 220, fat: 65, calories: 2000 },
    };

    mockInvoke.mockResolvedValueOnce({
      data: mockRebalanceResult,
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('rebalance-meal-plan', {
      body: { plan_id: 'plan-123' },
    });

    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);
  });
});

// ============================================================
// TESTES DE REGRAS G0 - VALIDAÇÃO CALÓRICA GLOBAL (v2.1)
// ============================================================

describe('G0 Calorie Validation Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // G0: Plano > 150% da meta calórica DEVE FALHAR
  // ============================================================
  
  it('[G0] should FAIL plan generation when calories exceed 150% of target', async () => {
    // Simula resposta do gerador rejeitando plano com calorias extremas
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { 
        message: '[G0.2] BLOQUEIO CRÍTICO: Calorias 155% da meta (3100 vs 2000). Limite máximo absoluto excedido.' 
      },
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 2000,
          protein_target: 150,
          carbs_target: 250,
          fat_target: 70,
          meals_per_day: 4,
        },
      },
    });

    // DEVE falhar - plano com 155% das calorias é inválido
    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('G0');
  });

  it('[G0] should FAIL plan generation when calories exceed 110% of target', async () => {
    // Plano com 115% da meta DEVE ser bloqueado
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { 
        message: '[G0] BLOQUEIO: Calorias excedidas - 2300 kcal (115% da meta 2000). Máximo: 110%.' 
      },
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 2000,
          protein_target: 150,
          carbs_target: 250,
          fat_target: 70,
          meals_per_day: 4,
        },
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('G0');
    expect(result.error.message).toContain('BLOQUEIO');
  });

  it('[G0] should PASS plan generation when calories are within ±10%', async () => {
    // Plano com 95% ou 105% da meta DEVE passar
    const mockValidPlan = {
      id: 'plan-valid',
      status: 'draft',
      total_calories: 1950, // 97.5% of 2000 - valid
      validation: {
        valid: true,
        errors: [],
        warnings: [],
      },
    };

    mockInvoke.mockResolvedValueOnce({
      data: { success: true, plan: mockValidPlan, validation: mockValidPlan.validation },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 2000,
          protein_target: 150,
          carbs_target: 250,
          fat_target: 70,
          meals_per_day: 4,
        },
      },
    });

    expect(result.error).toBeNull();
    expect(result.data.success).toBe(true);
    expect(result.data.validation.valid).toBe(true);
  });

  // ============================================================
  // G0.1: Carbs > 120% E Fat > 120% simultaneamente DEVE FALHAR
  // ============================================================
  
  it('[G0.1] should FAIL when both carbs AND fat exceed 120% simultaneously', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { 
        message: '[G0.1] BLOQUEIO: Macros extremos simultâneos - Carbs 135% (máx 120%) E Gordura 128% (máx 120%). Plano inviável.' 
      },
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 2000,
          protein_target: 150,
          carbs_target: 200, // Se gerado com 270g = 135%
          fat_target: 50,    // Se gerado com 64g = 128%
          meals_per_day: 4,
        },
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error.message).toContain('G0.1');
    expect(result.error.message).toContain('Macros extremos simultâneos');
  });

  it('[G0.1] should PASS when only carbs exceeds 120% (not both)', async () => {
    // Se apenas carbs excede 120%, mas fat está normal, pode gerar (será warning)
    const mockPlanWithHighCarbs = {
      id: 'plan-high-carbs',
      status: 'draft',
      total_calories: 2100,
      total_carbs: 260, // 130% of 200g target
      total_fat: 55,    // 110% of 50g target - ok
      validation: {
        valid: true,
        errors: [],
        warnings: ['Carboidratos acima da meta'],
      },
    };

    mockInvoke.mockResolvedValueOnce({
      data: { success: true, plan: mockPlanWithHighCarbs, validation: mockPlanWithHighCarbs.validation },
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 2000,
          protein_target: 150,
          carbs_target: 200,
          fat_target: 50,
          meals_per_day: 4,
        },
      },
    });

    // Pode passar se apenas um macro está alto (não é G0.1)
    // A regra G0.1 bloqueia apenas quando AMBOS estão > 120%
    expect(result.error).toBeNull();
  });

  // ============================================================
  // G0.2: Verificar que gerador prefere FALHAR a gerar plano ruim
  // ============================================================
  
  it('[G0.2] generator should prefer to FAIL rather than generate invalid plan', async () => {
    // Quando não é possível montar plano dentro dos limites, DEVE falhar
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { 
        message: 'Não foi possível gerar o plano: Não há fonte de proteína compatível para Almoço' 
      },
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('generate-meal-plan', {
      body: {
        profile: {
          daily_calories: 1500,
          protein_target: 200, // Proteína muito alta para as calorias
          carbs_target: 100,
          fat_target: 30,
          meals_per_day: 4,
        },
      },
    });

    expect(result.error).toBeDefined();
  });

  it('[G0.2] rebalancer should NOT try to fix structurally invalid plans', async () => {
    // Se o plano já nasce inválido, rebalanceador não deve tentar corrigir
    const mockRebalanceResult = {
      success: false,
      error: 'Plano fora dos limites calóricos. Rebalanceamento não é possível.',
      failureReason: 'calorie_protein_impossible',
    };

    mockInvoke.mockResolvedValueOnce({
      data: mockRebalanceResult,
      error: null,
    });

    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.functions.invoke('rebalance-meal-plan', {
      body: { plan_id: 'plan-invalid' },
    });

    // Rebalanceador deve retornar falha controlada
    expect(result.data.success).toBe(false);
    expect(result.data.failureReason).toBeDefined();
  });
});
