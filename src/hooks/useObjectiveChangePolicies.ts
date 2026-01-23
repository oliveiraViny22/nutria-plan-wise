import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ObjectiveChangePolicy {
  id: string;
  profile_type: string;
  change_number: number;
  cooldown_days: number;
  created_at: string;
  updated_at: string;
}

export function useObjectiveChangePolicies() {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<ObjectiveChangePolicy[]>([]);

  const fetchPolicies = useCallback(async (): Promise<ObjectiveChangePolicy[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('objective_change_policies')
        .select('*')
        .order('profile_type')
        .order('change_number');

      if (error) throw error;

      setPolicies(data || []);
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar políticas:', error);
      toast.error('Erro ao carregar políticas de cooldown');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createPolicy = useCallback(async (
    profileType: string,
    changeNumber: number,
    cooldownDays: number
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('objective_change_policies')
        .insert({
          profile_type: profileType,
          change_number: changeNumber,
          cooldown_days: cooldownDays,
        });

      if (error) throw error;

      toast.success('Política criada com sucesso');
      await fetchPolicies();
      return true;
    } catch (error: any) {
      console.error('Erro ao criar política:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma política para este perfil e número de alteração');
      } else {
        toast.error('Erro ao criar política');
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies]);

  const updatePolicy = useCallback(async (
    id: string,
    cooldownDays: number
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('objective_change_policies')
        .update({ cooldown_days: cooldownDays })
        .eq('id', id);

      if (error) throw error;

      toast.success('Política atualizada');
      await fetchPolicies();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar política:', error);
      toast.error('Erro ao atualizar política');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies]);

  const deletePolicy = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('objective_change_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Política removida');
      await fetchPolicies();
      return true;
    } catch (error) {
      console.error('Erro ao remover política:', error);
      toast.error('Erro ao remover política');
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return {
    loading,
    policies,
    fetchPolicies,
    createPolicy,
    updatePolicy,
    deletePolicy,
  };
}
