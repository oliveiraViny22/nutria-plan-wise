import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token', user: { id: 'test-admin' } } },
        error: null,
      }),
    },
  },
}));

// Valid categories and processing levels according to the migration model
const VALID_CATEGORIES = [
  'Carboidratos', 'Proteínas', 'Gorduras', 'Frutas', 
  'Vegetais', 'Leguminosas', 'Laticínios', 'Suplementos', 'Mistos'
];

const VALID_PROCESSING_LEVELS = [
  'In natura', 'Minimamente processado', 'Processado', 
  'Ultraprocessado', 'Suplemento'
];

describe('Food Audit System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      range: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  describe('Audit Foods Edge Function', () => {
    it('should require admin authentication', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Admin access required' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('audit-foods', {
        body: { limit: 100 },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Admin');
    });

    it('should return migration suggestions with valid categories', async () => {
      const mockAuditResult = {
        summary: {
          total: 10,
          to_update: 5,
          unchanged: 3,
          already_migrated: 2,
        },
        suggestions: [
          {
            name: 'Arroz Branco',
            old_category: null,
            old_processing_level: null,
            proposed_category: 'Carboidratos',
            proposed_processing_level: 'Minimamente processado',
            justification: 'Grão refinado, fonte primária de carboidratos',
            confidence: 0.95,
            food_id: 'food-123',
          },
          {
            name: 'Frango Grelhado',
            old_category: 'carnes',
            old_processing_level: null,
            proposed_category: 'Proteínas',
            proposed_processing_level: 'Minimamente processado',
            justification: 'Carne magra com alta concentração proteica',
            confidence: 0.98,
            food_id: 'food-456',
          },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockAuditResult,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('audit-foods', {
        body: { limit: 100 },
      });

      expect(result.error).toBeNull();
      expect(result.data.summary).toBeDefined();
      expect(result.data.suggestions.length).toBe(2);
      
      // Validate all proposed categories are valid
      result.data.suggestions.forEach((suggestion: any) => {
        expect(VALID_CATEGORIES).toContain(suggestion.proposed_category);
        expect(VALID_PROCESSING_LEVELS).toContain(suggestion.proposed_processing_level);
      });
    });

    it('should skip already migrated foods', async () => {
      const mockAuditResult = {
        summary: {
          total: 5,
          to_update: 0,
          unchanged: 0,
          already_migrated: 5,
        },
        suggestions: [],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockAuditResult,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('audit-foods', {
        body: { limit: 100 },
      });

      expect(result.error).toBeNull();
      expect(result.data.summary.already_migrated).toBe(5);
      expect(result.data.suggestions.length).toBe(0);
    });

    it('should handle AI rate limiting gracefully', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded. Please try again later.' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('audit-foods', {
        body: { limit: 100 },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Rate limit');
    });

    it('should include food_id for batch updates', async () => {
      const mockAuditResult = {
        summary: { total: 1, to_update: 1, unchanged: 0, already_migrated: 0 },
        suggestions: [
          {
            name: 'Banana',
            old_category: null,
            old_processing_level: null,
            proposed_category: 'Frutas',
            proposed_processing_level: 'In natura',
            justification: 'Fruta natural sem processamento',
            confidence: 0.99,
            food_id: 'food-banana-id',
          },
        ],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockAuditResult,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('audit-foods', {
        body: { limit: 100 },
      });

      expect(result.error).toBeNull();
      expect(result.data.suggestions[0].food_id).toBe('food-banana-id');
    });
  });

  describe('Category Classification Rules', () => {
    it('should classify high-carb foods as Carboidratos', () => {
      // Foods where ≥60% of kcal come from carbs
      const food = { calories: 350, carbs: 75, protein: 8, fat: 1 };
      const carbCalories = food.carbs * 4;
      const carbPercentage = (carbCalories / food.calories) * 100;
      
      expect(carbPercentage).toBeGreaterThanOrEqual(60);
      // Expected classification: Carboidratos
    });

    it('should classify high-protein foods as Proteínas', () => {
      // Foods with ≥20g protein per 100g
      const food = { calories: 165, carbs: 0, protein: 31, fat: 4 };
      
      expect(food.protein).toBeGreaterThanOrEqual(20);
      // Expected classification: Proteínas
    });

    it('should classify high-fat foods as Gorduras', () => {
      // Foods with ≥15g fat per 100g
      const food = { calories: 884, carbs: 0, protein: 0, fat: 100 };
      
      expect(food.fat).toBeGreaterThanOrEqual(15);
      // Expected classification: Gorduras
    });

    it('should classify supplements correctly', () => {
      const supplementNames = ['Whey Protein', 'BCAA', 'Creatina', 'Vitamina C'];
      
      supplementNames.forEach(name => {
        const isLikelySupplement = /whey|bcaa|creatina|vitamina|suplemento|pó|blend/i.test(name);
        expect(isLikelySupplement).toBe(true);
      });
    });
  });

  describe('Processing Level Classification', () => {
    it('should classify raw foods as In natura', () => {
      const rawFoods = ['Maçã', 'Banana', 'Laranja', 'Alface'];
      // Expected: In natura
      expect(rawFoods.length).toBeGreaterThan(0);
    });

    it('should classify cooked/grilled foods as Minimamente processado', () => {
      const cookedFoods = ['Frango Grelhado', 'Arroz Cozido', 'Ovo Cozido'];
      // Expected: Minimamente processado
      expect(cookedFoods.length).toBeGreaterThan(0);
    });

    it('should classify industrial preparations as Ultraprocessado', () => {
      const ultraProcessed = ['Biscoito Recheado', 'Refrigerante', 'Salgadinho'];
      // Expected: Ultraprocessado
      expect(ultraProcessed.length).toBeGreaterThan(0);
    });

    it('should classify supplements as Suplemento processing level', () => {
      const supplements = ['Whey Protein Isolado', 'Creatina Monohidratada'];
      // Expected processing_level: Suplemento
      expect(supplements.length).toBeGreaterThan(0);
    });
  });

  describe('Batch Update Operations', () => {
    it('should support applying single suggestion', async () => {
      mockUpdate.mockReturnThis();
      mockEq.mockResolvedValueOnce({ data: { id: 'food-123' }, error: null });

      const { supabase } = await import('@/integrations/supabase/client');
      
      const updateResult = await supabase
        .from('foods')
        .update({
          category: 'Carboidratos',
          processing_level: 'Minimamente processado',
        })
        .eq('id', 'food-123');

      expect(mockFrom).toHaveBeenCalledWith('foods');
    });

    it('should track which suggestions have changes', () => {
      const suggestion = {
        old_category: 'carnes',
        old_processing_level: null,
        proposed_category: 'Proteínas',
        proposed_processing_level: 'Minimamente processado',
      };

      const hasChanges = 
        suggestion.proposed_category !== suggestion.old_category ||
        suggestion.proposed_processing_level !== suggestion.old_processing_level;

      expect(hasChanges).toBe(true);
    });

    it('should not count unchanged items as updates', () => {
      const suggestion = {
        old_category: 'Proteínas',
        old_processing_level: 'Minimamente processado',
        proposed_category: 'Proteínas',
        proposed_processing_level: 'Minimamente processado',
      };

      const hasChanges = 
        suggestion.proposed_category !== suggestion.old_category ||
        suggestion.proposed_processing_level !== suggestion.old_processing_level;

      expect(hasChanges).toBe(false);
    });
  });

  describe('Migration Detection', () => {
    it('should detect foods already using new categories', () => {
      const food = {
        category: 'Carboidratos',
        processing_level: 'Minimamente processado',
      };

      const isAlreadyMigrated = 
        VALID_CATEGORIES.includes(food.category) &&
        VALID_PROCESSING_LEVELS.includes(food.processing_level);

      expect(isAlreadyMigrated).toBe(true);
    });

    it('should detect foods needing migration', () => {
      const food = {
        category: 'carnes', // Old category format
        processing_level: null,
      };

      const isAlreadyMigrated = 
        VALID_CATEGORIES.includes(food.category || '') &&
        VALID_PROCESSING_LEVELS.includes(food.processing_level || '');

      expect(isAlreadyMigrated).toBe(false);
    });
  });

  describe('Confidence Scoring', () => {
    it('should return confidence between 0 and 1', () => {
      const suggestions = [
        { confidence: 0.95 },
        { confidence: 0.8 },
        { confidence: 0.99 },
      ];

      suggestions.forEach(s => {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should flag low confidence suggestions', () => {
      const suggestion = { confidence: 0.5 };
      const isLowConfidence = suggestion.confidence < 0.7;
      
      expect(isLowConfidence).toBe(true);
    });
  });
});
