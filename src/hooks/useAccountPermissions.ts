import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCachedUserData } from './useCachedUserData';
import { CommercialPlan, UserPermissions } from '@/lib/types';

export interface AccountPermissions extends UserPermissions {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getBlockMessage: (action: string) => string;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  plan_name: 'gratuito',
  can_create_plan: false,
  can_edit_plan: false,
  can_view_plan: true,
  can_substitute: false,
  can_adjust: false,
  can_use_ai: false,
  can_use_simulations: false,
  can_manage_students: false,
  can_send_requests: false,
  is_linked_to_professional: false,
};

/**
 * Hook for account permissions - now uses cached consolidated fetch
 * Updated for v2 schema (removed user_type, professional_id)
 */
export function useAccountPermissions(): AccountPermissions {
  const { permissions, loading, refresh } = useCachedUserData();

  // Use cached permissions or fallback
  const activePermissions = permissions ? {
    plan_name: permissions.plan_name as CommercialPlan,
    can_create_plan: permissions.can_create_plan,
    can_edit_plan: permissions.can_edit_plan,
    can_view_plan: permissions.can_view_plan,
    can_substitute: permissions.can_substitute,
    can_adjust: permissions.can_adjust,
    can_use_ai: permissions.can_use_ai,
    can_use_simulations: permissions.can_use_simulations,
    can_manage_students: permissions.can_manage_students,
    can_send_requests: permissions.can_send_requests,
    is_linked_to_professional: permissions.is_linked_to_professional,
  } : DEFAULT_PERMISSIONS;

  const getBlockMessage = useCallback((action: string) => {
    if (activePermissions.is_linked_to_professional) {
      return `Você não pode ${action}. Envie uma solicitação ao seu nutricionista.`;
    }
    
    if (activePermissions.plan_name === 'gratuito') {
      return `Faça upgrade para o plano Pessoal Pago para ${action}.`;
    }
    
    return `Essa ação não está disponível no seu plano atual.`;
  }, [activePermissions]);

  return {
    ...activePermissions,
    loading,
    error: null,
    refresh,
    getBlockMessage,
  };
}
