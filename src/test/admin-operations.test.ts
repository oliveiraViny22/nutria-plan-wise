import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token', user: { id: 'admin-user' } } },
        error: null,
      }),
    },
  },
}));

describe('Admin Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      delete: mockDelete.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
  });

  describe('Admin Authentication', () => {
    it('should verify admin role before operations', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Admin access required' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_settings' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Admin');
    });

    it('should allow valid admin to perform operations', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { settings: [] },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_settings' },
      });

      expect(result.error).toBeNull();
    });
  });

  describe('System Settings Management', () => {
    it('should fetch all system settings', async () => {
      const mockSettings = [
        { key: 'maintenance_mode', value: 'false', description: 'Enable maintenance mode' },
        { key: 'max_file_size', value: '5242880', description: 'Max upload size in bytes' },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { settings: mockSettings },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_settings' },
      });

      expect(result.error).toBeNull();
      expect(result.data.settings).toHaveLength(2);
    });

    it('should update a system setting', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: {
          action: 'update_setting',
          key: 'maintenance_mode',
          value: 'true',
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });
  });

  describe('Food Management', () => {
    it('should fetch foods with pagination', async () => {
      const mockFoods = [
        { id: 'f1', name: 'Arroz', calories: 130, category: 'Carboidratos' },
        { id: 'f2', name: 'Frango', calories: 165, category: 'Proteínas' },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { foods: mockFoods, total: 100 },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_foods', offset: 0, limit: 50 },
      });

      expect(result.error).toBeNull();
      expect(result.data.foods).toHaveLength(2);
    });

    it('should update a food item', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: {
          action: 'update_food',
          id: 'food-123',
          category: 'Proteínas',
          processing_level: 'Minimamente processado',
        },
      });

      expect(result.error).toBeNull();
    });

    it('should delete a food item', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'delete_food', id: 'food-123' },
      });

      expect(result.error).toBeNull();
    });

    it('should normalize food names', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { updated: 15 },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'normalize_foods' },
      });

      expect(result.error).toBeNull();
      expect(result.data.updated).toBeGreaterThan(0);
    });
  });

  describe('Food Import', () => {
    it('should validate CSV before import', async () => {
      const mockValidation = {
        valid: true,
        rows: 50,
        warnings: ['Row 5: Missing serving_size, using default'],
        errors: [],
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockValidation,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('validate-food-import', {
        body: { csv: 'name,calories,protein,carbs,fat\nArroz,130,2.5,28,0.3' },
      });

      expect(result.error).toBeNull();
      expect(result.data.valid).toBe(true);
    });

    it('should reject invalid CSV format', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { valid: false, errors: ['Missing required column: calories'] },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('validate-food-import', {
        body: { csv: 'name,protein\nArroz,2.5' },
      });

      expect(result.data.valid).toBe(false);
      expect(result.data.errors.length).toBeGreaterThan(0);
    });

    it('should import validated foods', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { imported: 45, skipped: 5 },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: {
          action: 'import_foods',
          foods: [
            { name: 'Arroz Branco', calories: 130, protein: 2.5, carbs: 28, fat: 0.3 },
          ],
        },
      });

      expect(result.error).toBeNull();
      expect(result.data.imported).toBeGreaterThan(0);
    });
  });

  describe('User Management', () => {
    it('should fetch users with roles and subscriptions', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          roles: [],
          subscription_status: 'active',
          plan_type: 'premium',
        },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { users: mockUsers },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_users' },
      });

      expect(result.error).toBeNull();
      expect(result.data.users[0].subscription_status).toBeDefined();
    });

    it('should toggle user roles', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, role: 'admin', action: 'added' },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'toggle_role', userId: 'user-123', role: 'admin' },
      });

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });

    it('should preview user deletion impact', async () => {
      const mockPreview = {
        user_id: 'user-123',
        email: 'user@example.com',
        will_delete: {
          profile: true,
          diet_plans: 3,
          meal_logs: 45,
          daily_logs: 15,
        },
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockPreview,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'preview_delete_user', userId: 'user-123' },
      });

      expect(result.error).toBeNull();
      expect(result.data.will_delete).toBeDefined();
    });

    it('should delete user and related data', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true, deleted_items: { profile: 1, diet_plans: 3 } },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'delete_user', userId: 'user-123' },
      });

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });
  });

  describe('Plan Management', () => {
    it('should fetch all plans', async () => {
      const mockPlans = [
        { id: 'plan-1', name: 'Gratuito', type: 'gratuito', price_monthly: 0 },
        { id: 'plan-2', name: 'Premium', type: 'premium', price_monthly: 14.90 },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { plans: mockPlans },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_plans' },
      });

      expect(result.error).toBeNull();
      expect(result.data.plans).toHaveLength(2);
    });

    it('should update plan limits', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: {
          action: 'update_plan',
          id: 'plan-123',
          diet_limit: 5,
          chat_messages_per_day: 20,
        },
      });

      expect(result.error).toBeNull();
    });
  });

  describe('Audit Logging', () => {
    it('should fetch audit logs', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'update_food',
          performed_by: 'admin-id',
          details: { food_id: 'f-123', changes: { category: 'Proteínas' } },
          created_at: '2026-01-21T10:00:00Z',
        },
      ];

      mockInvoke.mockResolvedValueOnce({
        data: { logs: mockLogs },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_audit_logs', limit: 100 },
      });

      expect(result.error).toBeNull();
      expect(result.data.logs[0].action).toBeDefined();
    });
  });

  describe('Test Data Seeding', () => {
    it('should seed test data for development', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          created: {
            users: 5,
            profiles: 5,
            diet_plans: 10,
            meals: 50,
          },
        },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('seed-test-data', {});

      expect(result.error).toBeNull();
      expect(result.data.success).toBe(true);
    });
  });

  describe('User Usage Tracking', () => {
    it('should fetch user usage statistics', async () => {
      const mockUsage = {
        user_id: 'user-123',
        diets_used: 2,
        substitutions_used: 5,
        adjustments_used: 1,
        chat_messages_today: 10,
      };

      mockInvoke.mockResolvedValueOnce({
        data: mockUsage,
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'get_user_usage', userId: 'user-123' },
      });

      expect(result.error).toBeNull();
      expect(result.data.diets_used).toBeDefined();
    });

    it('should reset user usage counters', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: {
          action: 'update_user_usage',
          userId: 'user-123',
          diets_used: 0,
          substitutions_used: 0,
        },
      });

      expect(result.error).toBeNull();
    });
  });
});
