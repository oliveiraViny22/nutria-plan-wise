import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type UserProfile = 'free' | 'premium' | 'usuario_pessoal_pago' | 'profissional_vinculado';

export type AdherenceLevel = 'high' | 'medium' | 'low' | 'no_data';

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface Adjustment {
  type: 'quantity_change' | 'food_substitution' | 'meal_redistribution' | 'supplement_addition';
  meal_id: string;
  meal_name: string;
  option_id: string;
  food_id?: string;
  food_name?: string;
  original_quantity?: number;
  new_quantity?: number;
  new_food_id?: string;
  new_food_name?: string;
  reason: string;
}

/**
 * Governança de rebalanceamento baseada em adesão.
 * Determina se o rebalanceador pode ser usado e quais estratégias são permitidas.
 */
export interface AdherenceGovernance {
  /** Se o rebalanceador pode ser usado */
  can_rebalance: boolean;
  /** Nível de adesão calculado */
  adherence_level: AdherenceLevel;
  /** Taxa de adesão em percentual */
  adherence_rate: number;
  /** Estratégias permitidas para este nível */
  allowed_strategies: string[];
  /** Estratégias bloqueadas para este nível */
  blocked_strategies: string[];
  /** Motivo do bloqueio (se houver) */
  block_reason?: string;
  /** Mensagem para o usuário */
  user_message: string;
  /** Dias de dados analisados */
  period_days: number;
  /** Total de refeições no período */
  total_meals: number;
}

export interface RebalanceResult {
  success: boolean;
  profile_type: UserProfile;
  adjustments: Adjustment[];
  current_macros: MacroTargets;
  proposed_macros: MacroTargets;
  target_macros: MacroTargets;
  justification: string;
  adherence_impact: string;
  warnings: string[];
  requires_approval: boolean;
  execution_blocked: boolean;
  block_reason?: string;
  /** Governança baseada em adesão */
  adherence_governance: AdherenceGovernance;
}

export function useRebalancer() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RebalanceResult | null>(null);

  const calculateRebalance = async (
    planId: string,
    targetUserId?: string
  ): Promise<RebalanceResult | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rebalance-meal-plan', {
        body: {
          plan_id: planId,
          target_user_id: targetUserId,
          execute: false
        }
      });

      if (error) {
        console.error('Rebalance error:', error);
        toast.error('Erro ao calcular rebalanceamento');
        return null;
      }

      setResult(data);
      return data;
    } catch (error) {
      console.error('Rebalance error:', error);
      toast.error('Erro ao calcular rebalanceamento');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const applyRebalance = async (
    planId: string,
    targetUserId?: string
  ): Promise<boolean> => {
    if (!result || result.execution_blocked) {
      toast.error(result?.block_reason || 'Execução bloqueada');
      return false;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rebalance-meal-plan', {
        body: {
          plan_id: planId,
          target_user_id: targetUserId,
          execute: true
        }
      });

      if (error) {
        console.error('Apply rebalance error:', error);
        toast.error('Erro ao aplicar rebalanceamento');
        return false;
      }

      if (data.success) {
        toast.success('Plano rebalanceado com sucesso!');
        setResult(null);
        return true;
      } else {
        toast.error(data.block_reason || 'Erro ao aplicar rebalanceamento');
        return false;
      }
    } catch (error) {
      console.error('Apply rebalance error:', error);
      toast.error('Erro ao aplicar rebalanceamento');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearResult = () => {
    setResult(null);
  };

  const getProfileLabel = (profileType: UserProfile): string => {
    const labels: Record<UserProfile, string> = {
      free: 'Gratuito',
      premium: 'Premium',
      usuario_pessoal_pago: 'Plano Pessoal',
      profissional_vinculado: 'Profissional'
    };
    return labels[profileType] || profileType;
  };

  const getProfileColor = (profileType: UserProfile): string => {
    const colors: Record<UserProfile, string> = {
      free: 'text-muted-foreground',
      premium: 'text-amber-500',
      usuario_pessoal_pago: 'text-primary',
      profissional_vinculado: 'text-blue-500'
    };
    return colors[profileType] || 'text-foreground';
  };

  const getAdherenceLevelLabel = (level: AdherenceLevel): string => {
    const labels: Record<AdherenceLevel, string> = {
      high: 'Alta',
      medium: 'Moderada',
      low: 'Baixa',
      no_data: 'Sem dados'
    };
    return labels[level] || level;
  };

  const getAdherenceLevelColor = (level: AdherenceLevel): string => {
    const colors: Record<AdherenceLevel, string> = {
      high: 'text-green-500',
      medium: 'text-amber-500',
      low: 'text-red-500',
      no_data: 'text-muted-foreground'
    };
    return colors[level] || 'text-foreground';
  };

  /** Verifica se o rebalanceamento está bloqueado por governança de adesão */
  const isBlockedByAdherence = result?.adherence_governance 
    ? !result.adherence_governance.can_rebalance 
    : false;

  return {
    loading,
    result,
    calculateRebalance,
    applyRebalance,
    clearResult,
    getProfileLabel,
    getProfileColor,
    getAdherenceLevelLabel,
    getAdherenceLevelColor,
    isBlockedByAdherence
  };
}
