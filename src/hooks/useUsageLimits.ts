import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

// Limite especial que indica acesso ilimitado (retornado pelo banco para admins)
const UNLIMITED_LIMIT = 999999;

export interface UsageLimits {
  diets: { used: number; limit: number; remaining: number; isUnlimited: boolean };
  substitutions: { used: number; limit: number; remaining: number; isUnlimited: boolean };
  adjustments: { used: number; limit: number; remaining: number; isUnlimited: boolean };
  chat: { used: number; limit: number; remaining: number; isUnlimited: boolean };
}

export interface UsageLimitsResult {
  usage: UsageLimits | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  canUse: (feature: 'diet' | 'substitution' | 'adjustment' | 'chat') => boolean;
  isLimitReached: (feature: 'diet' | 'substitution' | 'adjustment' | 'chat') => boolean;
  isAdmin: boolean;
}

export function useUsageLimits(): UsageLimitsResult {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [usage, setUsage] = useState<UsageLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user?.id) {
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get user usage and plan info
      const [usageResult, planResult] = await Promise.all([
        supabase
          .from('user_usage')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase.rpc('get_user_plan', { _user_id: user.id }),
      ]);

      const usageData = usageResult.data;
      const planData = planResult.data?.[0];

      if (planData) {
        const dietLimit = planData.diet_limit || 0;
        const substitutionLimit = planData.substitution_limit || 0;
        const adjustmentLimit = planData.adjustment_limit || 0;
        const chatLimit = planData.chat_messages_per_day || 0;

        const dietsUsed = usageData?.diets_used || 0;
        const substitutionsUsed = usageData?.substitutions_used || 0;
        const adjustmentsUsed = usageData?.adjustments_used || 0;
        const chatUsed = usageData?.chat_messages_today || 0;

        // Check if limits indicate unlimited access (admin)
        const isDietUnlimited = dietLimit >= UNLIMITED_LIMIT;
        const isSubstitutionUnlimited = substitutionLimit >= UNLIMITED_LIMIT;
        const isAdjustmentUnlimited = adjustmentLimit >= UNLIMITED_LIMIT;
        const isChatUnlimited = chatLimit >= UNLIMITED_LIMIT;

        setUsage({
          diets: {
            used: dietsUsed,
            limit: dietLimit,
            remaining: isDietUnlimited ? UNLIMITED_LIMIT : Math.max(0, dietLimit - dietsUsed),
            isUnlimited: isDietUnlimited,
          },
          substitutions: {
            used: substitutionsUsed,
            limit: substitutionLimit,
            remaining: isSubstitutionUnlimited ? UNLIMITED_LIMIT : Math.max(0, substitutionLimit - substitutionsUsed),
            isUnlimited: isSubstitutionUnlimited,
          },
          adjustments: {
            used: adjustmentsUsed,
            limit: adjustmentLimit,
            remaining: isAdjustmentUnlimited ? UNLIMITED_LIMIT : Math.max(0, adjustmentLimit - adjustmentsUsed),
            isUnlimited: isAdjustmentUnlimited,
          },
          chat: {
            used: chatUsed,
            limit: chatLimit,
            remaining: isChatUnlimited ? UNLIMITED_LIMIT : Math.max(0, chatLimit - chatUsed),
            isUnlimited: isChatUnlimited,
          },
        });
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching usage limits:', err);
      setError('Erro ao carregar limites de uso');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const canUse = useCallback(
    (feature: 'diet' | 'substitution' | 'adjustment' | 'chat') => {
      if (!usage) return false;
      
      switch (feature) {
        case 'diet':
          return usage.diets.isUnlimited || usage.diets.remaining > 0;
        case 'substitution':
          return usage.substitutions.isUnlimited || usage.substitutions.remaining > 0;
        case 'adjustment':
          return usage.adjustments.isUnlimited || usage.adjustments.remaining > 0;
        case 'chat':
          return usage.chat.isUnlimited || usage.chat.remaining > 0;
        default:
          return false;
      }
    },
    [usage]
  );

  const isLimitReached = useCallback(
    (feature: 'diet' | 'substitution' | 'adjustment' | 'chat') => {
      if (!usage) return false;
      
      switch (feature) {
        case 'diet':
          return !usage.diets.isUnlimited && usage.diets.remaining <= 0;
        case 'substitution':
          return !usage.substitutions.isUnlimited && usage.substitutions.remaining <= 0;
        case 'adjustment':
          return !usage.adjustments.isUnlimited && usage.adjustments.remaining <= 0;
        case 'chat':
          return !usage.chat.isUnlimited && usage.chat.remaining <= 0;
        default:
          return false;
      }
    },
    [usage]
  );

  return {
    usage,
    loading,
    error,
    refresh: fetchUsage,
    canUse,
    isLimitReached,
    isAdmin,
  };
}
