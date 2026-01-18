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

describe('Meal Plan Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Generate Meal Plan', () => {
    it('should generate a meal plan successfully', async () => {
      const mockMealPlan = {
        id: 'plan-123',
        meals: [
          { name: 'Café da Manhã', total_calories: 400, foods: [] },
          { name: 'Almoço', total_calories: 600, foods: [] },
          { name: 'Jantar', total_calories: 500, foods: [] },
        ],
        total_calories: 1500,
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          userId: 'test-user',
          preferences: [],
          restrictions: [],
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.meals).toBeDefined();
      expect(result.data.meals.length).toBeGreaterThan(0);
    });

    it('should respect user dietary preferences', async () => {
      const mockMealPlan = {
        id: 'plan-456',
        meals: [{ name: 'Almoço', foods: [{ name: 'Tofu Grelhado' }] }],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          userId: 'test-user',
          preferences: ['vegetariano'],
          restrictions: ['carne'],
        },
      });

      expect(result.error).toBeNull();
      expect(result.data).toBeDefined();
    });

    it('should require authentication', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Autenticação necessária' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: { userId: 'test-user' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Autenticação');
    });

    it('should check usage limits', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Limite de uso atingido' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: { userId: 'test-user' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Limite');
    });

    it('should handle intelligent food selection without 50-food limit', async () => {
      const mockMealPlan = {
        id: 'plan-789',
        meals: [
          { name: 'Café da Manhã', foods: new Array(5).fill({ name: 'Food' }) },
          { name: 'Lanche', foods: new Array(3).fill({ name: 'Food' }) },
          { name: 'Almoço', foods: new Array(6).fill({ name: 'Food' }) },
          { name: 'Jantar', foods: new Array(5).fill({ name: 'Food' }) },
        ],
        total_foods_used: 80, // More than old 50 limit
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockMealPlan,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          userId: 'test-user',
          goal: 'gain_muscle',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.meals).toBeDefined();
    });
  });

  describe('Plan Validation', () => {
    it('should validate required profile data', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Perfil incompleto. Complete o onboarding primeiro.' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: { userId: 'incomplete-user' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Perfil');
    });
  });
});
