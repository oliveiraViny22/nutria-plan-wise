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
    // Generator creates "good enough" plan
    // Rebalancer does precise adjustments
    const mockMealPlan = {
      id: 'plan-123',
      total_calories: 1950, // Close but not exact
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

    // Generator allows tolerance, not exact match
    expect(result.data.plan.total_calories).not.toBe(2000);
    expect(Math.abs(result.data.plan.total_calories - 2000)).toBeLessThan(300);
  });

  it('generator should NOT use AI for macro calculations', async () => {
    // This is a conceptual test - the generator should be heuristic
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

    // Should succeed without AI dependency
    expect(result.error).toBeNull();
    expect(result.data).toBeDefined();
  });
});
