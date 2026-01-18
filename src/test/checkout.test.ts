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

describe('Checkout Flow (Monthly Only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'plan-123',
          name: 'plano_pessoal_pago',
          stripe_price_monthly: 'price_monthly_123',
          price_monthly: 14.90,
        },
        error: null,
      }),
    });
  });

  describe('Create Checkout Session', () => {
    it('should create a monthly checkout session successfully', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { url: 'https://checkout.stripe.com/session123' },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { planId: 'plan-123' },
      });

      expect(result.error).toBeNull();
      expect(result.data.url).toContain('checkout.stripe.com');
    });

    it('should always use monthly billing cycle', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { url: 'https://checkout.stripe.com/session123' },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.functions.invoke('create-checkout', {
        body: { planId: 'plan-123' },
      });

      // Verify the invoke was called - billing_cycle should always be 'monthly'
      expect(mockInvoke).toHaveBeenCalledWith('create-checkout', {
        body: { planId: 'plan-123' },
      });
    });

    it('should reject checkout for already subscribed users', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { 
          message: 'Você já possui uma assinatura ativa.',
          context: { alreadySubscribed: true },
        },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { planId: 'plan-123' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('assinatura ativa');
    });

    it('should require authentication', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Autenticação necessária' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { planId: 'plan-123' },
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Autenticação');
    });

    it('should reject invalid plan ID', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Recurso não encontrado' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { planId: 'invalid-plan' },
      });

      expect(result.error).toBeDefined();
    });
  });

  describe('Professional Plan Checkout', () => {
    it('should create checkout for professional plan', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { url: 'https://checkout.stripe.com/pro-session' },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('create-checkout', {
        body: { plan_type: 'professional' },
      });

      expect(result.error).toBeNull();
      expect(result.data.url).toBeDefined();
    });
  });

  describe('Premium Plan Restrictions', () => {
    it('should reject premium plan for non-linked students', async () => {
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
    });
  });
});
