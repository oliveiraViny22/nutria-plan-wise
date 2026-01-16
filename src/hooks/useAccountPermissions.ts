import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AccountType } from '@/lib/types';

export interface AccountPermissions {
  // Tipo de conta
  accountType: AccountType;
  
  // Permissões de visualização
  canViewPlan: boolean;
  canViewHistory: boolean;
  canViewProgress: boolean;
  
  // Permissões de edição
  canCreatePlan: boolean;
  canEditPlan: boolean;
  canAdjustMacros: boolean;
  canSubstituteFood: boolean;
  canChangeGoal: boolean;
  
  // Permissões especiais
  canSendRequests: boolean;  // Aluno pode enviar solicitações
  canUseSimulations: boolean; // Premium pode usar simulações
  canManageStudents: boolean; // Profissional pode gerenciar alunos
  canUseAIAssistant: boolean; // Tipo de IA disponível
  
  // Autonomia
  hasFullAutonomy: boolean;
  isLinkedToProfessional: boolean;
  
  // Mensagem de bloqueio
  getBlockMessage: (action: string) => string;
}

export function useAccountPermissions(): AccountPermissions {
  const { profile } = useAuth();
  
  return useMemo(() => {
    const accountType = (profile?.account_type as AccountType) || 'plano_pessoal';
    const isLinkedToProfessional = !!profile?.professional_id;
    
    // Definir permissões base por tipo de conta
    const permissions: AccountPermissions = {
      accountType,
      isLinkedToProfessional,
      
      // Todos podem visualizar
      canViewPlan: true,
      canViewHistory: true,
      canViewProgress: true,
      
      // Permissões de edição (variam por tipo)
      canCreatePlan: false,
      canEditPlan: false,
      canAdjustMacros: false,
      canSubstituteFood: false,
      canChangeGoal: false,
      
      // Permissões especiais
      canSendRequests: false,
      canUseSimulations: false,
      canManageStudents: false,
      canUseAIAssistant: false,
      
      hasFullAutonomy: false,
      
      getBlockMessage: (action: string) => {
        if (accountType === 'aluno' && isLinkedToProfessional) {
          return `Você não pode ${action}. Envie uma solicitação ao seu nutricionista.`;
        }
        return `Faça upgrade do seu plano para ${action}.`;
      },
    };
    
    switch (accountType) {
      case 'aluno':
        // Aluno vinculado a profissional - apenas visualização
        permissions.canSendRequests = isLinkedToProfessional;
        permissions.canUseAIAssistant = true; // IA educacional apenas
        break;
        
      case 'plano_pessoal':
        // Plano pessoal - autonomia total
        permissions.canCreatePlan = true;
        permissions.canEditPlan = true;
        permissions.canAdjustMacros = true;
        permissions.canSubstituteFood = true;
        permissions.canChangeGoal = true;
        permissions.canUseAIAssistant = true;
        permissions.hasFullAutonomy = true;
        break;
        
      case 'premium':
        // Premium - pode visualizar plano do profissional + simulações
        permissions.canViewPlan = true;
        permissions.canUseSimulations = true;
        permissions.canUseAIAssistant = true;
        // Não pode editar o plano oficial
        permissions.canEditPlan = false;
        break;
        
      case 'profissional':
        // Profissional - pode gerenciar tudo
        permissions.canCreatePlan = true;
        permissions.canEditPlan = true;
        permissions.canAdjustMacros = true;
        permissions.canSubstituteFood = true;
        permissions.canChangeGoal = true;
        permissions.canManageStudents = true;
        permissions.canUseAIAssistant = true;
        permissions.hasFullAutonomy = true;
        break;
    }
    
    // Bloqueio por vínculo profissional (sobrescreve tudo)
    if (isLinkedToProfessional && accountType !== 'profissional') {
      permissions.canCreatePlan = false;
      permissions.canEditPlan = false;
      permissions.canAdjustMacros = false;
      permissions.canSubstituteFood = false;
      permissions.canChangeGoal = false;
      permissions.hasFullAutonomy = false;
    }
    
    return permissions;
  }, [profile?.account_type, profile?.professional_id]);
}
