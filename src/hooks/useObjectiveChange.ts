import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ObjectiveChangeEligibility {
  can_change: boolean;
  locked_until: string | null;
  next_cooldown_days: number | null;
  change_count: number;
  reason: string;
}

export interface ObjectiveChangeResult {
  success: boolean;
  message?: string;
  error?: string;
  new_goal?: string;
  previous_change_count?: number;
  next_locked_until?: string;
  cooldown_days?: number;
}

export function useObjectiveChange() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<ObjectiveChangeEligibility | null>(null);

  const checkEligibility = useCallback(async (): Promise<ObjectiveChangeEligibility | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('check_objective_change_eligibility', { _user_id: user.id });

      if (error) throw error;

      const result = data?.[0] || null;
      setEligibility(result);
      return result;
    } catch (error) {
      console.error('Erro ao verificar elegibilidade:', error);
      toast.error('Erro ao verificar permissão de alteração');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const applyObjectiveChange = useCallback(async (newGoal: string): Promise<ObjectiveChangeResult | null> => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('apply_objective_change', { 
          _user_id: user.id,
          _new_goal: newGoal
        });

      if (error) throw error;

      const result = data as unknown as ObjectiveChangeResult;
      
      if (result.success) {
        toast.success(result.message || 'Objetivo alterado com sucesso!');
        await checkEligibility();
      } else {
        toast.error(result.error || 'Não foi possível alterar o objetivo');
      }

      return result;
    } catch (error) {
      console.error('Erro ao alterar objetivo:', error);
      toast.error('Erro ao alterar objetivo');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, checkEligibility]);

  const getRemainingDays = useCallback((): number | null => {
    if (!eligibility?.locked_until) return null;
    
    const lockedUntil = new Date(eligibility.locked_until);
    const now = new Date();
    const diffTime = lockedUntil.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  }, [eligibility]);

  return {
    loading,
    eligibility,
    checkEligibility,
    applyObjectiveChange,
    getRemainingDays,
  };
}
