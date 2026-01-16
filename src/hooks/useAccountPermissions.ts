import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { UserType, CommercialPlan, UserPermissions } from '@/lib/types';

export interface AccountPermissions extends UserPermissions {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  
  // Mensagem de bloqueio contextual
  getBlockMessage: (action: string) => string;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
  user_type: 'usuario',
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

export function useAccountPermissions(): AccountPermissions {
  const { user, profile } = useAuth();
  const [permissions, setPermissions] = useState<UserPermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(DEFAULT_PERMISSIONS);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Usar a função RPC do banco de dados
      const { data, error: rpcError } = await supabase
        .rpc('get_user_permissions', { _user_id: user.id });

      if (rpcError) {
        console.error('Error fetching permissions:', rpcError);
        // Fallback para permissões baseadas no profile
        const fallbackPermissions = getFallbackPermissions(profile);
        setPermissions(fallbackPermissions);
      } else if (data && data.length > 0) {
        const dbPermissions = data[0];
        setPermissions({
          user_type: dbPermissions.user_type as UserType,
          plan_name: dbPermissions.plan_name as CommercialPlan,
          can_create_plan: dbPermissions.can_create_plan,
          can_edit_plan: dbPermissions.can_edit_plan,
          can_view_plan: dbPermissions.can_view_plan,
          can_substitute: dbPermissions.can_substitute,
          can_adjust: dbPermissions.can_adjust,
          can_use_ai: dbPermissions.can_use_ai,
          can_use_simulations: dbPermissions.can_use_simulations,
          can_manage_students: dbPermissions.can_manage_students,
          can_send_requests: dbPermissions.can_send_requests,
          is_linked_to_professional: dbPermissions.is_linked_to_professional,
        });
      } else {
        // Fallback
        const fallbackPermissions = getFallbackPermissions(profile);
        setPermissions(fallbackPermissions);
      }
    } catch (err) {
      console.error('Error in fetchPermissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch permissions');
      const fallbackPermissions = getFallbackPermissions(profile);
      setPermissions(fallbackPermissions);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const getBlockMessage = useCallback((action: string) => {
    if (permissions.is_linked_to_professional) {
      return `Você não pode ${action}. Envie uma solicitação ao seu nutricionista.`;
    }
    
    if (permissions.plan_name === 'gratuito') {
      return `Faça upgrade para o plano Pessoal Pago para ${action}.`;
    }
    
    return `Essa ação não está disponível no seu plano atual.`;
  }, [permissions]);

  return {
    ...permissions,
    loading,
    error,
    refresh: fetchPermissions,
    getBlockMessage,
  };
}

// Função de fallback para quando o RPC falhar
function getFallbackPermissions(profile: any): UserPermissions {
  const userType = (profile?.user_type || 'usuario') as UserType;
  const isLinked = !!profile?.professional_id;
  
  // Usuários vinculados a profissionais só podem visualizar
  if (isLinked) {
    return {
      user_type: userType,
      plan_name: 'gratuito',
      can_create_plan: false,
      can_edit_plan: false,
      can_view_plan: true,
      can_substitute: false,
      can_adjust: false,
      can_use_ai: userType === 'aluno', // IA educacional para alunos
      can_use_simulations: false,
      can_manage_students: false,
      can_send_requests: userType === 'aluno',
      is_linked_to_professional: true,
    };
  }
  
  // Padrão para usuário gratuito
  return {
    user_type: userType,
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
}
