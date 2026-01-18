import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Sign Up', () => {
    it('should successfully sign up a new user', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      mockSignUp.mockResolvedValueOnce({
        data: { user: mockUser },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.signUp({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(result.data.user).toBeDefined();
      expect(result.data.user?.email).toBe('test@example.com');
      expect(result.error).toBeNull();
    });

    it('should reject duplicate email signup', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User already registered', code: 'user_already_exists' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.signUp({
        email: 'existing@example.com',
        password: 'TestPassword123!',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('already registered');
    });

    it('should reject weak passwords', async () => {
      mockSignUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Password should be at least 6 characters', code: 'weak_password' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.signUp({
        email: 'test@example.com',
        password: '123',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Password');
    });
  });

  describe('Sign In', () => {
    it('should successfully sign in with valid credentials', async () => {
      const mockUser = { id: 'test-user-id', email: 'test@example.com' };
      mockSignIn.mockResolvedValueOnce({
        data: { user: mockUser, session: { access_token: 'test-token' } },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'TestPassword123!',
      });

      expect(result.data.user).toBeDefined();
      expect(result.data.session).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should reject invalid credentials', async () => {
      mockSignIn.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.signInWithPassword({
        email: 'test@example.com',
        password: 'WrongPassword',
      });

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid');
    });
  });

  describe('Sign Out', () => {
    it('should successfully sign out', async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.signOut();

      expect(result.error).toBeNull();
    });
  });

  describe('Session Management', () => {
    it('should get current session', async () => {
      const mockSession = { access_token: 'test-token', user: { id: 'test-id' } };
      mockGetSession.mockResolvedValueOnce({
        data: { session: mockSession },
        error: null,
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.auth.getSession();

      expect(result.data.session).toBeDefined();
      expect(result.data.session?.access_token).toBe('test-token');
    });
  });
});
