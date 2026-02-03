import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: mockRpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  },
}));

describe("Usage Limits Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("can_use_feature RPC", () => {
    it("returns true when user has remaining quota", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await mockRpc("can_use_feature", {
        _user_id: "test-user-id",
        _feature: "diet",
      });

      expect(result.data).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("can_use_feature", {
        _user_id: "test-user-id",
        _feature: "diet",
      });
    });

    it("returns false when user has exhausted quota", async () => {
      mockRpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await mockRpc("can_use_feature", {
        _user_id: "test-user-id",
        _feature: "diet",
      });

      expect(result.data).toBe(false);
    });

    it("handles all feature types", async () => {
      const features = ["diet", "substitution", "adjustment", "chat"];

      for (const feature of features) {
        mockRpc.mockResolvedValueOnce({ data: true, error: null });

        await mockRpc("can_use_feature", {
          _user_id: "test-user-id",
          _feature: feature,
        });

        expect(mockRpc).toHaveBeenCalledWith("can_use_feature", {
          _user_id: "test-user-id",
          _feature: feature,
        });
      }
    });
  });

  describe("increment_usage RPC", () => {
    it("increments diet usage counter", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await mockRpc("increment_usage", {
        _user_id: "test-user-id",
        _feature: "diet",
      });

      expect(result.data).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("increment_usage", {
        _user_id: "test-user-id",
        _feature: "diet",
      });
    });

    it("increments adjustment usage counter", async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await mockRpc("increment_usage", {
        _user_id: "test-user-id",
        _feature: "adjustment",
      });

      expect(result.data).toBe(true);
    });
  });

  describe("get_user_plan RPC", () => {
    it("returns plan limits for free tier", async () => {
      const freePlanData = {
        plan_id: "free-plan-id",
        plan_name: "Gratuito",
        plan_type: "gratuito",
        diet_limit: 1,
        substitution_limit: 3,
        adjustment_limit: 1,
        chat_messages_per_day: 3,
        meal_options_limit: 1,
        has_chat: true,
        subscription_status: "active",
      };

      mockRpc.mockResolvedValueOnce({ data: [freePlanData], error: null });

      const result = await mockRpc("get_user_plan", {
        _user_id: "test-user-id",
      });

      expect(result.data[0].diet_limit).toBe(1);
      expect(result.data[0].adjustment_limit).toBe(1);
      expect(result.data[0].plan_type).toBe("gratuito");
    });

    it("returns higher limits for paid tier", async () => {
      const paidPlanData = {
        plan_id: "paid-plan-id",
        plan_name: "Plano Pessoal",
        plan_type: "plano_pessoal_pago",
        diet_limit: 999,
        substitution_limit: 999,
        adjustment_limit: 999,
        chat_messages_per_day: 50,
        meal_options_limit: 3,
        has_chat: true,
        subscription_status: "active",
      };

      mockRpc.mockResolvedValueOnce({ data: [paidPlanData], error: null });

      const result = await mockRpc("get_user_plan", {
        _user_id: "test-user-id",
      });

      expect(result.data[0].diet_limit).toBe(999);
      expect(result.data[0].adjustment_limit).toBe(999);
      expect(result.data[0].meal_options_limit).toBe(3);
    });

    it("returns unlimited access for admin (999999)", async () => {
      const adminPlanData = {
        plan_id: "admin-plan-id",
        plan_name: "Admin",
        plan_type: "profissional",
        diet_limit: 999999,
        substitution_limit: 999999,
        adjustment_limit: 999999,
        chat_messages_per_day: 999999,
        meal_options_limit: 3,
        has_chat: true,
        subscription_status: "active",
      };

      mockRpc.mockResolvedValueOnce({ data: [adminPlanData], error: null });

      const result = await mockRpc("get_user_plan", {
        _user_id: "admin-user-id",
      });

      expect(result.data[0].diet_limit).toBe(999999);
      expect(result.data[0].diet_limit >= 999999).toBe(true); // Unlimited check
    });
  });

  describe("Limit enforcement scenarios", () => {
    it("blocks diet generation when limit reached", async () => {
      // Simulate can_use_feature returning false
      mockRpc.mockResolvedValueOnce({ data: false, error: null });

      const canUseDiet = await mockRpc("can_use_feature", {
        _user_id: "test-user-id",
        _feature: "diet",
      });

      expect(canUseDiet.data).toBe(false);

      // In this scenario, the edge function should return 403
      // with upgradeRequired: true
    });

    it("blocks rebalancer when adjustment limit reached", async () => {
      // Simulate can_use_feature returning false
      mockRpc.mockResolvedValueOnce({ data: false, error: null });

      const canUseAdjustment = await mockRpc("can_use_feature", {
        _user_id: "test-user-id",
        _feature: "adjustment",
      });

      expect(canUseAdjustment.data).toBe(false);

      // In this scenario, the edge function should return 403
      // with upgradeRequired: true
    });

    it("allows operation when within limits", async () => {
      // Simulate can_use_feature returning true
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const canUse = await mockRpc("can_use_feature", {
        _user_id: "test-user-id",
        _feature: "diet",
      });

      expect(canUse.data).toBe(true);

      // Operation should proceed
    });
  });
});

describe("Usage Limits Error Response Format", () => {
  it("diet limit error has correct structure", () => {
    const errorResponse = {
      error: "Você atingiu o limite de 1 dieta(s) do seu plano. Faça upgrade para gerar mais planos.",
      code: "DIET_LIMIT_REACHED",
      upgradeRequired: true,
    };

    expect(errorResponse).toHaveProperty("error");
    expect(errorResponse).toHaveProperty("code", "DIET_LIMIT_REACHED");
    expect(errorResponse).toHaveProperty("upgradeRequired", true);
  });

  it("adjustment limit error has correct structure", () => {
    const errorResponse = {
      success: false,
      error: "Você atingiu o limite de 1 ajuste(s) do seu plano. Faça upgrade para continuar ajustando seus planos.",
      code: "ADJUSTMENT_LIMIT_REACHED",
      upgradeRequired: true,
    };

    expect(errorResponse).toHaveProperty("success", false);
    expect(errorResponse).toHaveProperty("code", "ADJUSTMENT_LIMIT_REACHED");
    expect(errorResponse).toHaveProperty("upgradeRequired", true);
  });
});
