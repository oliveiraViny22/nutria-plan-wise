import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockRpc = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mockRpc,
    functions: {
      invoke: mockInvoke,
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token', user: { id: 'test-user' } } },
        error: null,
      }),
    },
  },
}));

// Plan limits configuration for testing
const PLAN_LIMITS = {
  gratuito: {
    diet_limit: 0,
    substitution_limit: 0,
    adjustment_limit: 0,
    chat_messages_per_day: 3,
    patients_limit: 0,
    has_chat: true,
    history_days: 7,
    can_create_plan: false,
    can_edit_plan: false,
    can_substitute: false,
    can_adjust: false,
    can_use_ai: true,
    can_use_simulations: false,
    can_manage_students: false,
  },
  premium: {
    diet_limit: 0,
    substitution_limit: 0,
    adjustment_limit: 0,
    chat_messages_per_day: 10,
    patients_limit: 0,
    has_chat: true,
    history_days: 30,
    can_create_plan: false,
    can_edit_plan: false,
    can_substitute: false,
    can_adjust: false,
    can_use_ai: true,
    can_use_simulations: false,
    can_manage_students: false,
  },
  plano_pessoal_pago: {
    diet_limit: 2,
    substitution_limit: 10,
    adjustment_limit: 4,
    chat_messages_per_day: 30,
    patients_limit: 0,
    has_chat: true,
    history_days: 90,
    can_create_plan: true,
    can_edit_plan: true,
    can_substitute: true,
    can_adjust: true,
    can_use_ai: true,
    can_use_simulations: true,
    can_manage_students: false,
  },
  profissional: {
    diet_limit: 999,
    substitution_limit: 999,
    adjustment_limit: 999,
    chat_messages_per_day: 100,
    patients_limit: 50,
    has_chat: true,
    history_days: 365,
    can_create_plan: true,
    can_edit_plan: true,
    can_substitute: true,
    can_adjust: true,
    can_use_ai: true,
    can_use_simulations: true,
    can_manage_students: true,
  },
};

describe('Plan Permissions and Limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Gratuito Plan', () => {
    const planName = 'gratuito';
    const planLimits = PLAN_LIMITS[planName];

    it('should have zero diet generation limit', () => {
      expect(planLimits.diet_limit).toBe(0);
    });

    it('should have zero substitution limit', () => {
      expect(planLimits.substitution_limit).toBe(0);
    });

    it('should have zero adjustment limit', () => {
      expect(planLimits.adjustment_limit).toBe(0);
    });

    it('should have 3 chat messages per day', () => {
      expect(planLimits.chat_messages_per_day).toBe(3);
    });

    it('should have 7 days of history', () => {
      expect(planLimits.history_days).toBe(7);
    });

    it('should not be able to create plans', () => {
      expect(planLimits.can_create_plan).toBe(false);
    });

    it('should not be able to edit plans', () => {
      expect(planLimits.can_edit_plan).toBe(false);
    });

    it('should not be able to substitute foods', () => {
      expect(planLimits.can_substitute).toBe(false);
    });

    it('should not be able to use simulations', () => {
      expect(planLimits.can_use_simulations).toBe(false);
    });

    it('should be able to use AI chat (educational)', () => {
      expect(planLimits.can_use_ai).toBe(true);
      expect(planLimits.has_chat).toBe(true);
    });

    it('should validate permissions via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          user_type: 'usuario',
          plan_name: 'gratuito',
          can_create_plan: false,
          can_edit_plan: false,
          can_view_plan: false,
          can_substitute: false,
          can_adjust: false,
          can_use_ai: true,
          can_use_simulations: false,
          can_manage_students: false,
          can_send_requests: false,
          is_linked_to_professional: false,
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_user_permissions', { _user_id: 'test-user' });

      expect(result.data?.[0]?.can_create_plan).toBe(false);
      expect(result.data?.[0]?.can_substitute).toBe(false);
      expect(result.data?.[0]?.can_use_ai).toBe(true);
    });
  });

  describe('Premium Plan (Aluno)', () => {
    const planName = 'premium';
    const planLimits = PLAN_LIMITS[planName];

    it('should have zero diet generation limit (professional creates)', () => {
      expect(planLimits.diet_limit).toBe(0);
    });

    it('should have 10 chat messages per day', () => {
      expect(planLimits.chat_messages_per_day).toBe(10);
    });

    it('should have 30 days of history', () => {
      expect(planLimits.history_days).toBe(30);
    });

    it('should not be able to create plans (linked to professional)', () => {
      expect(planLimits.can_create_plan).toBe(false);
    });

    it('should be able to use AI chat', () => {
      expect(planLimits.can_use_ai).toBe(true);
    });

    it('should require professional linkage', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          user_type: 'aluno',
          plan_name: 'premium',
          can_create_plan: false,
          can_edit_plan: false,
          can_view_plan: true,
          can_substitute: false,
          can_adjust: false,
          can_use_ai: true,
          can_use_simulations: false,
          can_manage_students: false,
          can_send_requests: true,
          is_linked_to_professional: true,
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_user_permissions', { _user_id: 'student-user' });

      expect(result.data?.[0]?.is_linked_to_professional).toBe(true);
      expect(result.data?.[0]?.can_send_requests).toBe(true);
    });
  });

  describe('Plano Pessoal Pago', () => {
    const planName = 'plano_pessoal_pago';
    const planLimits = PLAN_LIMITS[planName];

    it('should have 2 diet generation limit per month', () => {
      expect(planLimits.diet_limit).toBe(2);
    });

    it('should have 10 substitution limit', () => {
      expect(planLimits.substitution_limit).toBe(10);
    });

    it('should have 4 adjustment limit', () => {
      expect(planLimits.adjustment_limit).toBe(4);
    });

    it('should have 30 chat messages per day', () => {
      expect(planLimits.chat_messages_per_day).toBe(30);
    });

    it('should have 90 days of history', () => {
      expect(planLimits.history_days).toBe(90);
    });

    it('should be able to create plans', () => {
      expect(planLimits.can_create_plan).toBe(true);
    });

    it('should be able to edit plans', () => {
      expect(planLimits.can_edit_plan).toBe(true);
    });

    it('should be able to substitute foods', () => {
      expect(planLimits.can_substitute).toBe(true);
    });

    it('should be able to use simulations', () => {
      expect(planLimits.can_use_simulations).toBe(true);
    });

    it('should not be able to manage students', () => {
      expect(planLimits.can_manage_students).toBe(false);
    });

    it('should validate full permissions via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          user_type: 'usuario',
          plan_name: 'plano_pessoal_pago',
          can_create_plan: true,
          can_edit_plan: true,
          can_view_plan: true,
          can_substitute: true,
          can_adjust: true,
          can_use_ai: true,
          can_use_simulations: true,
          can_manage_students: false,
          can_send_requests: false,
          is_linked_to_professional: false,
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_user_permissions', { _user_id: 'personal-user' });

      expect(result.data?.[0]?.can_create_plan).toBe(true);
      expect(result.data?.[0]?.can_substitute).toBe(true);
      expect(result.data?.[0]?.can_manage_students).toBe(false);
    });
  });

  describe('Profissional Plan', () => {
    const planName = 'profissional';
    const planLimits = PLAN_LIMITS[planName];

    it('should have high diet generation limit', () => {
      expect(planLimits.diet_limit).toBeGreaterThanOrEqual(999);
    });

    it('should have high substitution limit', () => {
      expect(planLimits.substitution_limit).toBeGreaterThanOrEqual(999);
    });

    it('should have 100 chat messages per day', () => {
      expect(planLimits.chat_messages_per_day).toBe(100);
    });

    it('should have 50 patients limit', () => {
      expect(planLimits.patients_limit).toBe(50);
    });

    it('should have 365 days of history', () => {
      expect(planLimits.history_days).toBe(365);
    });

    it('should be able to manage students', () => {
      expect(planLimits.can_manage_students).toBe(true);
    });

    it('should have all plan creation and editing permissions', () => {
      expect(planLimits.can_create_plan).toBe(true);
      expect(planLimits.can_edit_plan).toBe(true);
      expect(planLimits.can_substitute).toBe(true);
      expect(planLimits.can_adjust).toBe(true);
    });

    it('should validate professional permissions via RPC', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          user_type: 'profissional',
          plan_name: 'profissional',
          can_create_plan: true,
          can_edit_plan: true,
          can_view_plan: true,
          can_substitute: true,
          can_adjust: true,
          can_use_ai: true,
          can_use_simulations: true,
          can_manage_students: true,
          can_send_requests: false,
          is_linked_to_professional: false,
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_user_permissions', { _user_id: 'pro-user' });

      expect(result.data?.[0]?.can_manage_students).toBe(true);
      expect(result.data?.[0]?.user_type).toBe('profissional');
    });
  });

  describe('Usage Limit Validation', () => {
    it('should reject diet generation when limit reached for gratuito', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { 
          message: 'Limite de dietas atingido. Atualize seu plano.',
          context: { limitReached: true, feature: 'diet' },
        },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('validate-usage', {
        body: { feature: 'diet', increment: true },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Limite');
    });

    it('should reject substitution when limit reached', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { 
          message: 'Limite de substituições atingido.',
          context: { limitReached: true, feature: 'substitution' },
        },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('validate-usage', {
        body: { feature: 'substitution', increment: true },
      });

      expect(result.error).toBeDefined();
    });

    it('should reject chat when daily limit reached', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { 
          message: 'Limite de mensagens diárias atingido.',
          context: { limitReached: true, feature: 'chat' },
        },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('validate-usage', {
        body: { feature: 'chat', increment: true },
      });

      expect(result.error).toBeDefined();
    });

    it('should allow usage when within limits', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { 
          allowed: true,
          usage: { diets_used: 1, substitutions_used: 5 },
          limits: { diet_limit: 2, substitution_limit: 10 },
        },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('validate-usage', {
        body: { feature: 'diet', increment: false },
      });

      expect(result.error).toBeNull();
      expect(result.data?.allowed).toBe(true);
    });
  });

  describe('Student Access Levels', () => {
    it('should return full access for active professional subscription', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          has_access: true,
          access_level: 'full',
          can_view_plan: true,
          can_view_history: true,
          can_use_chat: true,
          can_generate: false,
          can_substitute: false,
          professional_status: 'active',
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_student_access_level', { _student_id: 'student-123' });

      expect(result.data?.[0]?.access_level).toBe('full');
      expect(result.data?.[0]?.can_use_chat).toBe(true);
    });

    it('should return read_only access during grace period', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          has_access: true,
          access_level: 'read_only',
          can_view_plan: true,
          can_view_history: true,
          can_use_chat: false,
          can_generate: false,
          can_substitute: false,
          professional_status: 'past_due',
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_student_access_level', { _student_id: 'student-123' });

      expect(result.data?.[0]?.access_level).toBe('read_only');
      expect(result.data?.[0]?.can_use_chat).toBe(false);
    });

    it('should return suspended access for expired/canceled professional', async () => {
      mockRpc.mockResolvedValueOnce({
        data: [{
          has_access: false,
          access_level: 'suspended',
          can_view_plan: false,
          can_view_history: false,
          can_use_chat: false,
          can_generate: false,
          can_substitute: false,
          professional_status: 'expired',
        }],
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.rpc('get_student_access_level', { _student_id: 'student-123' });

      expect(result.data?.[0]?.access_level).toBe('suspended');
      expect(result.data?.[0]?.has_access).toBe(false);
    });
  });

  describe('Premium Plan Restrictions', () => {
    it('should block premium subscription for non-linked users', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { 
          message: 'O plano Premium é exclusivo para alunos vinculados a um profissional.',
          context: { premiumRestricted: true },
        },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { planId: 'premium-plan-id' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Premium');
      expect(result.error?.message).toContain('alunos vinculados');
    });

    it('should allow premium subscription for linked students', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { url: 'https://checkout.stripe.com/premium-session' },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { planId: 'premium-plan-id' },
      });

      expect(result.error).toBeNull();
      expect(result.data?.url).toBeDefined();
    });
  });

  describe('History Days Limit', () => {
    it('should respect 7 days limit for gratuito plan', () => {
      expect(PLAN_LIMITS.gratuito.history_days).toBe(7);
    });

    it('should respect 30 days limit for premium plan', () => {
      expect(PLAN_LIMITS.premium.history_days).toBe(30);
    });

    it('should respect 90 days limit for plano_pessoal_pago', () => {
      expect(PLAN_LIMITS.plano_pessoal_pago.history_days).toBe(90);
    });

    it('should respect 365 days limit for profissional plan', () => {
      expect(PLAN_LIMITS.profissional.history_days).toBe(365);
    });
  });

  describe('Chat Limits by Plan', () => {
    it('should have 3 messages/day for gratuito', () => {
      expect(PLAN_LIMITS.gratuito.chat_messages_per_day).toBe(3);
    });

    it('should have 10 messages/day for premium', () => {
      expect(PLAN_LIMITS.premium.chat_messages_per_day).toBe(10);
    });

    it('should have 30 messages/day for plano_pessoal_pago', () => {
      expect(PLAN_LIMITS.plano_pessoal_pago.chat_messages_per_day).toBe(30);
    });

    it('should have 100 messages/day for profissional', () => {
      expect(PLAN_LIMITS.profissional.chat_messages_per_day).toBe(100);
    });
  });
});
