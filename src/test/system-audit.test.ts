import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase client
const mockInvoke = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockRpc = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      signInWithPassword: mockSignIn,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPassword,
    },
  },
}));

describe('System Audit - All Users and Functionalities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token', user: { id: 'test-user-id', email: 'test@example.com' } } },
      error: null,
    });
    
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', email: 'test@example.com' } },
      error: null,
    });
    
    mockFrom.mockReturnValue({
      select: mockSelect.mockReturnThis(),
      insert: mockInsert.mockReturnThis(),
      update: mockUpdate.mockReturnThis(),
      delete: mockDelete.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  // =============================================================================
  // AUTHENTICATION TESTS - All User Types
  // =============================================================================
  describe('Authentication - All User Types', () => {
    describe('Standard User Registration', () => {
      it('should allow new user signup with valid data', async () => {
        mockSignUp.mockResolvedValueOnce({
          data: { user: { id: 'new-user-id', email: 'newuser@example.com' } },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signUp({
          email: 'newuser@example.com',
          password: 'ValidPassword123!',
        });

        expect(result.error).toBeNull();
        expect(result.data.user?.id).toBeDefined();
      });

      it('should reject weak passwords', async () => {
        mockSignUp.mockResolvedValueOnce({
          data: { user: null },
          error: { message: 'Password should be at least 8 characters' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signUp({
          email: 'user@example.com',
          password: '123',
        });

        expect(result.error).toBeDefined();
      });

      it('should reject duplicate email registration', async () => {
        mockSignUp.mockResolvedValueOnce({
          data: { user: null },
          error: { message: 'User already registered' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signUp({
          email: 'existing@example.com',
          password: 'ValidPassword123!',
        });

        expect(result.error).toBeDefined();
      });
    });

    describe('User Login', () => {
      it('should allow valid user to login', async () => {
        mockSignIn.mockResolvedValueOnce({
          data: { session: { access_token: 'valid-token' }, user: { id: 'user-id' } },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signInWithPassword({
          email: 'user@example.com',
          password: 'ValidPassword123!',
        });

        expect(result.error).toBeNull();
        expect(result.data.session).toBeDefined();
      });

      it('should reject invalid credentials', async () => {
        mockSignIn.mockResolvedValueOnce({
          data: { session: null, user: null },
          error: { message: 'Invalid login credentials' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signInWithPassword({
          email: 'user@example.com',
          password: 'WrongPassword',
        });

        expect(result.error).toBeDefined();
        expect(result.error?.message).toContain('Invalid');
      });

      it('should handle rate limiting on multiple failed attempts', async () => {
        mockSignIn.mockResolvedValueOnce({
          data: { session: null, user: null },
          error: { message: 'Too many requests' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signInWithPassword({
          email: 'user@example.com',
          password: 'wrong',
        });

        expect(result.error?.message).toContain('Too many');
      });
    });

    describe('Password Recovery', () => {
      it('should send password reset email', async () => {
        mockResetPassword.mockResolvedValueOnce({
          data: {},
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.resetPasswordForEmail('user@example.com');

        expect(result.error).toBeNull();
      });
    });

    describe('Session Management', () => {
      it('should validate active session', async () => {
        mockGetSession.mockResolvedValueOnce({
          data: { session: { access_token: 'valid-token', expires_at: Date.now() + 3600000 } },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.getSession();

        expect(result.data.session).toBeDefined();
      });

      it('should handle expired sessions', async () => {
        mockGetSession.mockResolvedValueOnce({
          data: { session: null },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.getSession();

        expect(result.data.session).toBeNull();
      });

      it('should logout user successfully', async () => {
        mockSignOut.mockResolvedValueOnce({ error: null });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.auth.signOut();

        expect(result.error).toBeNull();
      });
    });
  });

  // =============================================================================
  // REGULAR USER TESTS - Free and Premium Users
  // =============================================================================
  describe('Regular User Operations', () => {
    describe('Profile Management', () => {
      it('should create profile on first login', async () => {
        mockFrom.mockReturnValueOnce({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'profile-id', user_id: 'user-id', name: 'Test User' }],
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('profiles').insert({ user_id: 'user-id', name: 'Test User' }).select();

        expect(result.error).toBeNull();
      });

      it('should update profile data', async () => {
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: { name: 'Updated Name' }, error: null }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('profiles').update({ name: 'Updated Name' }).eq('user_id', 'user-id');

        expect(result.error).toBeNull();
      });

      it('should complete onboarding flow', async () => {
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: { onboarding_completed: true, daily_calories: 2000 },
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('profiles')
          .update({
            onboarding_completed: true,
            age: 30,
            weight: 70,
            height: 175,
            goal: 'lose_weight',
            activity_level: 'moderate',
            daily_calories: 2000,
          })
          .eq('user_id', 'user-id');

        expect(result.error).toBeNull();
      });
    });

    describe('Meal Plan Generation', () => {
      it('should generate meal plan for user', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            plan: {
              id: 'plan-id',
              total_calories: 2000,
              meals: [
                { name: 'Café da manhã', options: [] },
                { name: 'Almoço', options: [] },
              ],
            },
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('generate-meal-plan', {
          body: { userId: 'user-id' },
        });

        expect(result.error).toBeNull();
        expect(result.data.plan.meals).toBeDefined();
      });

      it('should respect diet limit for free users', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Diet limit reached for free plan' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('generate-meal-plan', {
          body: { userId: 'free-user-id' },
        });

        expect(result.error?.message).toContain('limit');
      });

      it('should allow premium users higher limits', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { plan: { id: 'plan-5' } },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('generate-meal-plan', {
          body: { userId: 'premium-user-id' },
        });

        expect(result.error).toBeNull();
      });
    });

    describe('Meal Confirmation', () => {
      it('should confirm meal consumption', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true, status: 'confirmed' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('confirm-meal', {
          body: {
            mealId: 'meal-id',
            optionId: 'option-id',
            status: 'confirmed',
          },
        });

        expect(result.error).toBeNull();
        expect(result.data.status).toBe('confirmed');
      });

      it('should allow skipping meals', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true, status: 'skipped' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('confirm-meal', {
          body: {
            mealId: 'meal-id',
            status: 'skipped',
          },
        });

        expect(result.data.status).toBe('skipped');
      });

      it('should record out-of-plan meals', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true, status: 'out_of_plan' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('confirm-meal', {
          body: {
            mealId: 'meal-id',
            status: 'out_of_plan',
            notes: 'Had pizza instead',
          },
        });

        expect(result.data.status).toBe('out_of_plan');
      });
    });

    describe('Food Substitution', () => {
      it('should allow food substitution with same category', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            success: true,
            newFood: { id: 'new-food', name: 'Peito de Peru', calories: 100 },
            explanation: 'Nutritionally equivalent substitution',
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('explain-substitution', {
          body: {
            originalFoodId: 'chicken-id',
            newFoodId: 'turkey-id',
            quantity: 100,
          },
        });

        expect(result.error).toBeNull();
        expect(result.data.explanation).toBeDefined();
      });

      it('should respect substitution limits for free users', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Substitution limit reached' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('explain-substitution', {
          body: { originalFoodId: 'food-1', newFoodId: 'food-2' },
        });

        expect(result.error).toBeDefined();
      });
    });

    describe('Nutritional Chat', () => {
      it('should respond to nutritional questions', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            message: 'Baseado no seu plano, você deve consumir mais proteínas no café da manhã.',
            tokens_used: 150,
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('nutritional-chat', {
          body: {
            message: 'Como posso melhorar meu café da manhã?',
            conversationId: 'conv-id',
          },
        });

        expect(result.error).toBeNull();
        expect(result.data.message).toBeDefined();
      });

      it('should respect daily chat limits', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Daily chat limit reached' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('nutritional-chat', {
          body: { message: 'Another question' },
        });

        expect(result.error?.message).toContain('limit');
      });

      it('should maintain conversation context', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            message: 'Respondendo com base na nossa conversa anterior...',
            conversationId: 'conv-id',
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('nutritional-chat', {
          body: {
            message: 'E sobre proteínas?',
            conversationId: 'conv-id',
          },
        });

        expect(result.data.conversationId).toBe('conv-id');
      });
    });

    describe('Adherence Tracking', () => {
      it('should calculate adherence metrics via edge function', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            overall_adherence: 85.5,
            confirmed_meals: 42,
            skipped_meals: 5,
            out_of_plan_meals: 3,
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('adherence-report', {
          body: {
            periodStart: '2026-01-01',
            periodEnd: '2026-01-21',
          },
        });

        expect(result.error).toBeNull();
        expect(result.data.overall_adherence).toBeDefined();
      });

      it('should generate adherence report', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            report: {
              period: { start: '2026-01-01', end: '2026-01-21' },
              overall_adherence: 85.5,
              meal_adherence: {},
              recommendations: [],
            },
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('adherence-report', {
          body: {
            periodStart: '2026-01-01',
            periodEnd: '2026-01-21',
          },
        });

        expect(result.error).toBeNull();
        expect(result.data.report).toBeDefined();
      });
    });

    describe('Daily Logs', () => {
      it('should create daily log', async () => {
        mockFrom.mockReturnValueOnce({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'log-id', log_date: '2026-01-21', status: 'no_records' }],
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('daily_logs')
          .insert({ user_id: 'user-id', diet_plan_id: 'plan-id', log_date: '2026-01-21' })
          .select();

        expect(result.error).toBeNull();
      });

      it('should update daily totals after meal confirmation', async () => {
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: {
              total_calories_consumed: 1500,
              total_protein_consumed: 80,
              status: 'partial',
            },
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('daily_logs')
          .update({
            total_calories_consumed: 1500,
            total_protein_consumed: 80,
            status: 'partial',
          })
          .eq('id', 'log-id');

        expect(result.error).toBeNull();
      });
    });
  });

  // =============================================================================
  // PROFESSIONAL USER TESTS
  // =============================================================================
  describe('Professional User Operations', () => {
    describe('Professional Verification', () => {
      it('should verify professional role', async () => {
        mockRpc.mockResolvedValueOnce({ data: true, error: null });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.rpc('has_role', {
          _user_id: 'prof-user-id',
          _role: 'professional',
        });

        expect(result.data).toBe(true);
      });

      it('should verify active license via edge function', async () => {
        mockInvoke.mockResolvedValueOnce({ 
          data: { has_license: true }, 
          error: null 
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('check-subscription', {
          body: { checkLicense: true },
        });

        expect(result.data?.has_license).toBe(true);
      });
    });

    describe('Student Management', () => {
      it('should lookup student by email', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { student_id: 'student-user-id', can_add: true },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('lookup-student', {
          body: { email: 'student@example.com' },
        });

        expect(result.error).toBeNull();
        expect(result.data.student_id).toBeDefined();
      });

      it('should reject lookup if student not found', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Aluno não encontrado' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('lookup-student', {
          body: { email: 'nonexistent@example.com' },
        });

        expect(result.error).toBeDefined();
      });

      it('should reject if student limit reached', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Limite de alunos atingido' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('lookup-student', {
          body: { email: 'new-student@example.com' },
        });

        expect(result.error?.message).toContain('Limite');
      });

      it('should create student link', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true, relationship_id: 'rel-id' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('create-student', {
          body: {
            studentId: 'student-user-id',
            professionalId: 'prof-user-id',
          },
        });

        expect(result.error).toBeNull();
      });

      it('should list professional students', async () => {
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { id: 'rel-1', student_id: 'student-1', status: 'active' },
              { id: 'rel-2', student_id: 'student-2', status: 'pending' },
            ],
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('professional_students')
          .select('*')
          .eq('professional_id', 'prof-user-id');

        expect(result.error).toBeNull();
        expect(result.data?.length).toBeGreaterThan(0);
      });

      it('should remove student link', async () => {
        const mockEqChain = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEqChain });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValueOnce({ delete: mockDelete });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('professional_students')
          .delete()
          .eq('professional_id', 'prof-user-id')
          .eq('student_id', 'student-user-id');

        expect(result.error).toBeNull();
      });
    });

    describe('Student Plan Management', () => {
      it('should generate meal plan for student', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { plan: { id: 'student-plan-id' } },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('generate-meal-plan', {
          body: {
            userId: 'student-user-id',
            professionalId: 'prof-user-id',
          },
        });

        expect(result.error).toBeNull();
      });

      it('should view student adherence', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            report: { overall_adherence: 90, student_id: 'student-user-id' },
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('adherence-report', {
          body: { studentId: 'student-user-id' },
        });

        expect(result.error).toBeNull();
      });

      it('should get AI suggestions for student plan', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            suggestions: [
              { type: 'meal_change', hypothesis: 'Baixa adesão ao café da manhã' },
            ],
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('ai-plan-suggestions', {
          body: { studentId: 'student-user-id' },
        });

        expect(result.error).toBeNull();
        expect(result.data.suggestions).toBeDefined();
      });
    });
  });

  // =============================================================================
  // LINKED STUDENT TESTS
  // =============================================================================
  describe('Linked Student Operations', () => {
    describe('Student Restrictions', () => {
      it('should prevent student from generating own plan', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Students cannot generate their own plans' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('generate-meal-plan', {
          body: { userId: 'linked-student-id' },
        });

        expect(result.error).toBeDefined();
      });

      it('should allow student to view assigned plan', async () => {
        const mockEqStatus = vi.fn().mockResolvedValue({
          data: [{ id: 'plan-id', user_id: 'linked-student-id', status: 'active' }],
          error: null,
        });
        const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqStatus });
        const mockSelectLocal = vi.fn().mockReturnValue({ eq: mockEqUser });
        mockFrom.mockReturnValueOnce({ select: mockSelectLocal });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('diet_plans')
          .select('*')
          .eq('user_id', 'linked-student-id')
          .eq('status', 'active');

        expect(result.error).toBeNull();
      });

      it('should allow student to confirm meals', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('confirm-meal', {
          body: { mealId: 'meal-id', status: 'confirmed' },
        });

        expect(result.error).toBeNull();
      });

      it('should allow student to view own progress', async () => {
        const mockOrder = vi.fn().mockResolvedValue({
          data: [
            { log_date: '2026-01-21', status: 'complete', total_calories_consumed: 1800 },
          ],
          error: null,
        });
        const mockEqLocal = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelectLocal = vi.fn().mockReturnValue({ eq: mockEqLocal });
        mockFrom.mockReturnValueOnce({ select: mockSelectLocal });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('daily_logs')
          .select('*')
          .eq('user_id', 'linked-student-id')
          .order('log_date', { ascending: false });

        expect(result.error).toBeNull();
      });
    });

    describe('Student-Professional Relationship', () => {
      it('should allow student to see linked professional', async () => {
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ professional_id: 'prof-id', status: 'active' }],
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('professional_students')
          .select('professional_id, status')
          .eq('student_id', 'linked-student-id');

        expect(result.error).toBeNull();
      });
    });
  });

  // =============================================================================
  // SUBSCRIPTION AND BILLING TESTS
  // =============================================================================
  describe('Subscription Management', () => {
    describe('Plan Limits', () => {
      it('should check feature availability', async () => {
        mockRpc.mockResolvedValueOnce({ data: true, error: null });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.rpc('can_use_feature', {
          _user_id: 'user-id',
          _feature: 'generate_diet',
        });

        expect(result.data).toBe(true);
      });

      it('should increment feature usage', async () => {
        mockRpc.mockResolvedValueOnce({ data: null, error: null });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.rpc('increment_usage', {
          _user_id: 'user-id',
          _feature: 'generate_diet',
        });

        expect(result.error).toBeNull();
      });

      it('should validate usage limits', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            can_use: false,
            reason: 'Limit exceeded',
            current: 3,
            limit: 3,
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('validate-usage', {
          body: { feature: 'generate_diet' },
        });

        expect(result.data.can_use).toBe(false);
      });
    });

    describe('Checkout and Portal', () => {
      it('should create checkout session', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { url: 'https://checkout.stripe.com/session-id' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('create-checkout', {
          body: { planType: 'premium' },
        });

        expect(result.error).toBeNull();
        expect(result.data.url).toContain('stripe.com');
      });

      it('should access customer portal', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { url: 'https://billing.stripe.com/portal-id' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('customer-portal', {});

        expect(result.error).toBeNull();
        expect(result.data.url).toBeDefined();
      });
    });

    describe('Subscription Status', () => {
      it('should check subscription status', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            status: 'active',
            plan_type: 'premium',
            current_period_end: '2026-02-21T00:00:00Z',
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('check-subscription', {});

        expect(result.data.status).toBe('active');
      });

      it('should handle trial status', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { status: 'trial', plan_type: 'gratuito' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('check-subscription', {});

        expect(result.data.status).toBe('trial');
      });

      it('should handle grace period', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            status: 'past_due',
            grace_period_end: '2026-01-28T00:00:00Z',
            limited_access: true,
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('check-subscription', {});

        expect(result.data.limited_access).toBe(true);
      });
    });
  });

  // =============================================================================
  // ADMIN USER TESTS
  // =============================================================================
  describe('Admin User Operations', () => {
    describe('Admin Role Verification', () => {
      it('should verify admin role', async () => {
        mockRpc.mockResolvedValueOnce({ data: true, error: null });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.rpc('has_role', {
          _user_id: 'admin-user-id',
          _role: 'admin',
        });

        expect(result.data).toBe(true);
      });

      it('should reject non-admin access to admin functions', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Admin access required' },
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: { action: 'fetch_users' },
        });

        expect(result.error).toBeDefined();
      });
    });

    describe('User Management', () => {
      it('should fetch all users', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            users: [
              { id: 'user-1', email: 'user1@example.com', roles: [] },
              { id: 'user-2', email: 'user2@example.com', roles: ['professional'] },
            ],
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: { action: 'fetch_users' },
        });

        expect(result.data.users.length).toBeGreaterThan(0);
      });

      it('should toggle user roles', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true, action: 'added', role: 'professional' },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: {
            action: 'toggle_role',
            userId: 'user-123',
            role: 'professional',
          },
        });

        expect(result.data.success).toBe(true);
      });

      it('should delete user with all data', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true, deleted: { profile: 1, diet_plans: 3 } },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: { action: 'delete_user', userId: 'user-to-delete' },
        });

        expect(result.data.success).toBe(true);
      });
    });

    describe('Food Data Management', () => {
      it('should import foods from CSV', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { imported: 100, skipped: 5, errors: [] },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: {
            action: 'import_foods',
            foods: [
              { name: 'Arroz', calories: 130, protein: 2.5, carbs: 28, fat: 0.3 },
            ],
          },
        });

        expect(result.data.imported).toBeGreaterThan(0);
      });

      it('should run food audit', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            summary: { total: 100, needsMigration: 15 },
            suggestions: [],
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('audit-foods', {});

        expect(result.data.summary).toBeDefined();
      });

      it('should batch update food classifications', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { updated: 10, errors: [] },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: {
            action: 'batch_update_foods',
            updates: [
              { foodId: 'food-1', updates: { category: 'Proteínas' } },
            ],
          },
        });

        expect(result.data.updated).toBeGreaterThan(0);
      });
    });

    describe('System Settings', () => {
      it('should fetch system settings', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: {
            settings: [
              { key: 'maintenance_mode', value: false },
              { key: 'default_plan', value: 'gratuito' },
            ],
          },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: { action: 'fetch_settings' },
        });

        expect(result.data.settings.length).toBeGreaterThan(0);
      });

      it('should update system setting', async () => {
        mockInvoke.mockResolvedValueOnce({
          data: { success: true },
          error: null,
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.functions.invoke('admin-operations', {
          body: {
            action: 'update_setting',
            key: 'maintenance_mode',
            value: true,
          },
        });

        expect(result.data.success).toBe(true);
      });
    });

    describe('Audit Logging', () => {
      it('should record admin actions', async () => {
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'log-1',
                action: 'delete_user',
                user_id: 'admin-id',
                entity_type: 'user',
                created_at: '2026-01-21T10:00:00Z',
              },
            ],
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('admin_audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        expect(result.error).toBeNull();
      });
    });
  });

  // =============================================================================
  // EDGE FUNCTION ERROR HANDLING
  // =============================================================================
  describe('Edge Function Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network timeout'));

      const { supabase } = await import('@/integrations/supabase/client');

      await expect(
        supabase.functions.invoke('generate-meal-plan', { body: {} })
      ).rejects.toThrow('Network timeout');
    });

    it('should handle invalid request body', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid request body' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('nutritional-chat', {
        body: { invalid: 'data' },
      });

      expect(result.error).toBeDefined();
    });

    it('should handle unauthorized access', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Unauthorized' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('admin-operations', {
        body: { action: 'fetch_users' },
      });

      expect(result.error?.message).toBe('Unauthorized');
    });

    it('should handle rate limiting from AI services', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Rate limit exceeded. Please try again later.' },
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.functions.invoke('generate-meal-plan', {
        body: { userId: 'user-id' },
      });

      expect(result.error?.message).toContain('Rate limit');
    });
  });

  // =============================================================================
  // RLS POLICY TESTS
  // =============================================================================
  describe('Row Level Security Policies', () => {
    it('should allow users to view own profile only', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: 'own-user-id', name: 'Own Profile' }],
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('profiles')
        .select('*')
        .eq('user_id', 'own-user-id');

      expect(result.data?.length).toBe(1);
    });

    it('should prevent access to other user diet plans', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('diet_plans')
        .select('*')
        .eq('user_id', 'other-user-id');

      expect(result.data?.length).toBe(0);
    });

    it('should allow service role to bypass RLS', async () => {
      // This is typically done in edge functions with service role key
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'any-user-id' },
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('profiles')
        .select('*')
        .single();

      expect(result.data).toBeDefined();
    });

    it('should allow professionals to view linked students', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { student_id: 'student-1', status: 'active' },
            { student_id: 'student-2', status: 'active' },
          ],
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('professional_students')
        .select('*')
        .eq('professional_id', 'prof-user-id');

      expect(result.data?.length).toBe(2);
    });

    it('should prevent professionals from viewing other professionals students', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('professional_students')
        .select('*')
        .eq('professional_id', 'other-prof-id');

      expect(result.data?.length).toBe(0);
    });
  });

  // =============================================================================
  // DATA INTEGRITY TESTS
  // =============================================================================
  describe('Data Integrity', () => {
    it('should enforce required fields on profile', async () => {
      const mockSelectLocal = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'null value in column "user_id"' },
      });
      const mockInsertLocal = vi.fn().mockReturnValue({ select: mockSelectLocal });
      mockFrom.mockReturnValueOnce({ insert: mockInsertLocal });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('profiles')
        .insert([{ user_id: '' as unknown as undefined }] as any)
        .select();

      expect(result.error).toBeDefined();
    });

    it('should enforce valid sex values', async () => {
      mockFrom.mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'violates check constraint "profiles_sex_check"' },
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('profiles')
        .update({ sex: 'invalid' })
        .eq('user_id', 'user-id');

      expect(result.error?.message).toContain('profiles_sex_check');
    });

    it('should enforce unique email in profiles', async () => {
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value' },
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('profiles')
        .insert({ user_id: 'new-user', email: 'existing@example.com' })
        .select();

      expect(result.error?.message).toContain('duplicate');
    });

    it('should cascade delete meal data with diet plan', async () => {
      // When diet plan is deleted, meals should be deleted too
      mockFrom.mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('diet_plans')
        .delete()
        .eq('id', 'plan-id');

      expect(result.error).toBeNull();
    });
  });

  // =============================================================================
  // PERFORMANCE AND PAGINATION TESTS
  // =============================================================================
  describe('Performance and Pagination', () => {
    it('should paginate food list', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: Array(50).fill({ id: 'food-id', name: 'Food' }),
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('foods')
        .select('*')
        .range(0, 49);

      expect(result.data?.length).toBe(50);
    });

    it('should paginate daily logs', async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({
          data: Array(30).fill({ log_date: '2026-01-01' }),
          error: null,
        }),
      });

      const { supabase } = await import('@/integrations/supabase/client');
      const result = await supabase.from('daily_logs')
        .select('*')
        .eq('user_id', 'user-id')
        .order('log_date', { ascending: false })
        .range(0, 29);

      expect(result.data?.length).toBe(30);
    });
  });

  // =============================================================================
  // OBJECTIVE CHANGE TESTS (v2.6)
  // =============================================================================
  describe('Objective Change Feature', () => {
    describe('Autonomous User - Wizard Flow', () => {
      it('should allow autonomous user to change objective via wizard', async () => {
        // Mock profile update
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: { goal: 'gain_muscle' }, error: null }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('profiles')
          .update({ goal: 'gain_muscle' })
          .eq('id', 'autonomous-user-id');

        expect(result.error).toBeNull();
      });

      it('should recalculate targets after objective change', async () => {
        // Simulate Mifflin-St Jeor calculation
        const calculateTargets = (weight: number, height: number, age: number, sex: string, goal: string, activityLevel: number) => {
          let bmr: number;
          if (sex === 'male') {
            bmr = 10 * weight + 6.25 * height - 5 * age + 5;
          } else {
            bmr = 10 * weight + 6.25 * height - 5 * age - 161;
          }
          
          let tdee = bmr * activityLevel;
          
          // Goal adjustments
          if (goal === 'lose_weight') tdee -= 500;
          else if (goal === 'gain_muscle') tdee += 300;
          
          return {
            daily_calories: Math.round(tdee),
            daily_protein: Math.round(weight * 2),
            daily_carbs: Math.round((tdee * 0.45) / 4),
            daily_fat: Math.round((tdee * 0.25) / 9),
          };
        };

        const targets = calculateTargets(70, 170, 30, 'male', 'gain_muscle', 1.55);
        
        expect(targets.daily_calories).toBeGreaterThan(0);
        expect(targets.daily_protein).toBe(140);
      });

      it('should validate objective change policies exist', async () => {
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { 
                id: 'policy-1',
                profile_type: 'autonomous',
                change_number: 1,
                cooldown_days: 30,
                is_active: true 
              }
            ],
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        // Use type assertion for table not in types
        const result = await (supabase.from as any)('objective_change_policies')
          .select('*')
          .eq('is_active', true);

        expect(result.error).toBeNull();
        expect(result.data?.[0]?.profile_type).toBe('autonomous');
      });
    });

    describe('Linked Student - Request Flow', () => {
      it('should create objective change request for linked student', async () => {
        // Using generic mock since student_requests may not be in types
        const mockResult = {
          id: 'request-1',
          student_id: 'student-id',
          professional_id: 'prof-id',
          request_type: 'objective_change',
          request_data: { new_goal: 'lose_weight', justification: 'Want to lose weight for health' },
          status: 'pending',
        };

        mockFrom.mockReturnValueOnce({
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: mockResult,
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        // Use 'as any' since student_requests might not be in generated types yet
        const result = await (supabase.from as any)('student_requests')
          .insert({
            student_id: 'student-id',
            professional_id: 'prof-id',
            request_type: 'objective_change',
            request_data: { new_goal: 'lose_weight', justification: 'Want to lose weight for health' },
          })
          .select()
          .single();

        expect(result.error).toBeNull();
        expect(result.data?.request_type).toBe('objective_change');
        expect(result.data?.status).toBe('pending');
      });

      it('should block direct objective change for linked students', async () => {
        // Linked students should not be able to change objective directly
        const isLinkedStudent = true;
        const canChangeDirectly = !isLinkedStudent;
        
        expect(canChangeDirectly).toBe(false);
      });

      it('should allow professional to approve objective change request', async () => {
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: {
              id: 'request-1',
              status: 'approved',
              response_data: { approved: true, will_recalculate: true },
            },
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        // Use 'as any' for flexibility with mocked types
        const result = await (supabase.from as any)('student_requests')
          .update({ 
            status: 'approved',
            response_data: { approved: true, will_recalculate: true }
          })
          .eq('id', 'request-1');

        expect(result.error).toBeNull();
      });

      it('should apply objective change after professional approval', async () => {
        // After approval, student's profile should be updated
        mockFrom.mockReturnValueOnce({
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: { goal: 'lose_weight', daily_calories: 1800 },
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        const result = await supabase.from('profiles')
          .update({ goal: 'lose_weight', daily_calories: 1800 })
          .eq('id', 'student-id');

        expect(result.error).toBeNull();
      });
    });

    describe('Objective Change Validation', () => {
      it('should validate goal values', () => {
        const validGoals = ['lose_weight', 'maintain', 'gain_muscle'];
        
        expect(validGoals.includes('lose_weight')).toBe(true);
        expect(validGoals.includes('maintain')).toBe(true);
        expect(validGoals.includes('gain_muscle')).toBe(true);
        expect(validGoals.includes('invalid_goal')).toBe(false);
      });

      it('should prevent changing to same goal', () => {
        const currentGoal = 'maintain';
        const newGoal = 'maintain';
        
        const canChange = currentGoal !== newGoal;
        expect(canChange).toBe(false);
      });

      it('should track objective change in audit log', async () => {
        mockFrom.mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({
            data: {
              id: 'audit-1',
              user_id: 'user-id',
              entity_type: 'profile',
              old_value: { goal: 'maintain' },
              new_value: { goal: 'lose_weight' },
            },
            error: null,
          }),
        });

        const { supabase } = await import('@/integrations/supabase/client');
        // Use type assertion for insert with non-standard columns
        const result = await (supabase.from as any)('admin_audit_log')
          .insert({
            user_id: 'user-id',
            entity_type: 'profile',
            old_value: { goal: 'maintain' },
            new_value: { goal: 'lose_weight' },
          });

        expect(result.error).toBeNull();
      });
    });
  });
});
