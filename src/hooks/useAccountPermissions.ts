import { useCallback } from 'react';
import { useCachedUserData } from './useCachedUserData';

export interface AccountPermissions {
  loading: boolean;
  error: string | null;
  plan_name: string;
  can_create_plan: boolean;
  can_edit_plan: boolean;
  can_view_plan: boolean;
  can_substitute: boolean;
  can_adjust: boolean;
  can_use_chat: boolean;
  can_manage_students: boolean;
  meal_options_limit: number;
  refresh: () => Promise<void>;
  getBlockMessage: (action: string) => string;
}

/**
 * Hook for account permissions - simplified for v2 schema
 */
export function useAccountPermissions(): AccountPermissions {
  const { planInfo, loading, refresh, isProfessional } = useCachedUserData();

  const can_create_plan = planInfo ? planInfo.diet_limit > 0 : false;
  const can_substitute = planInfo ? planInfo.substitution_limit > 0 : false;
  const can_adjust = planInfo ? planInfo.adjustment_limit > 0 : false;

  const getBlockMessage = useCallback((action: string) => {
    if (!planInfo || planInfo.plan_type === 'gratuito') {
      return `Faça upgrade para o plano Pessoal Pago para ${action}.`;
    }
    return `Essa ação não está disponível no seu plano atual.`;
  }, [planInfo]);

  return {
    loading,
    error: null,
    plan_name: planInfo?.plan_name || 'gratuito',
    can_create_plan,
    can_edit_plan: !!planInfo,
    can_view_plan: !!planInfo,
    can_substitute,
    can_adjust,
    can_use_chat: planInfo?.has_chat || false,
    can_manage_students: isProfessional,
    meal_options_limit: planInfo?.meal_options_limit ?? 1,
    refresh,
    getBlockMessage,
  };
}
