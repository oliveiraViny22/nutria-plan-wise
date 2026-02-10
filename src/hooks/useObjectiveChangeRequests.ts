import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ObjectiveChangeRequest {
  id: string;
  student_id: string;
  professional_id: string;
  current_goal: string;
  requested_goal: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
  professional_response: string | null;
  created_at: string;
  updated_at: string;
}

type RawRequest = {
  id: string;
  student_id: string;
  professional_id: string;
  current_goal: string;
  requested_goal: string;
  justification: string;
  status: string;
  professional_response: string | null;
  created_at: string;
  updated_at: string;
};

function mapToRequest(raw: RawRequest): ObjectiveChangeRequest {
  return {
    ...raw,
    status: raw.status as 'pending' | 'approved' | 'rejected',
  };
}

export function useObjectiveChangeRequests() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<ObjectiveChangeRequest[]>([]);

  // Para alunos: criar solicitação
  const createRequest = useCallback(async (
    professionalId: string,
    currentGoal: string,
    requestedGoal: string,
    justification: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('objective_change_requests')
        .insert({
          student_id: user.id,
          professional_id: professionalId,
          current_goal: currentGoal,
          requested_goal: requestedGoal,
          justification,
        });

      if (error) throw error;

      toast.success('Solicitação enviada ao profissional');
      return true;
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error('Erro ao enviar solicitação');
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Para alunos: buscar próprias solicitações
  const fetchStudentRequests = useCallback(async (): Promise<ObjectiveChangeRequest[]> => {
    if (!user?.id) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('objective_change_requests')
        .select('*')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(mapToRequest);
      setRequests(mapped);
      return mapped;
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Para profissionais: buscar solicitações de alunos
  const fetchProfessionalRequests = useCallback(async (): Promise<ObjectiveChangeRequest[]> => {
    if (!user?.id) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('objective_change_requests')
        .select('*')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(mapToRequest);
      setRequests(mapped);
      return mapped;
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Para profissionais: responder solicitação
  const respondToRequest = useCallback(async (
    requestId: string,
    status: 'approved' | 'rejected',
    response?: string
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // First, update the request status
      const { data: request, error: fetchError } = await supabase
        .from('objective_change_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('objective_change_requests')
        .update({
          status,
          professional_response: response || null,
        })
        .eq('id', requestId);

      if (error) throw error;

      // If approved, apply the objective change to the student's profile
      if (status === 'approved' && request) {
        const { error: applyError } = await supabase
          .rpc('apply_objective_change', {
            _user_id: request.student_id,
            _new_goal: request.requested_goal,
            _keep_plan_active: false,
          });

        if (applyError) {
          console.error('Error applying objective change, rolling back approval:', applyError);
          // Rollback: revert status to pending since the change failed
          await supabase
            .from('objective_change_requests')
            .update({ status: 'pending', professional_response: null })
            .eq('id', requestId);
          
          toast.error('Erro ao aplicar alteração de objetivo. A solicitação voltou para pendente.');
          return false;
        }
      }

      toast.success(status === 'approved' 
        ? 'Solicitação aprovada - objetivo do aluno será alterado' 
        : 'Solicitação rejeitada'
      );
      return true;
    } catch (error) {
      console.error('Erro ao responder solicitação:', error);
      toast.error('Erro ao responder solicitação');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Buscar solicitação pendente do aluno
  const getPendingRequest = useCallback(async (): Promise<ObjectiveChangeRequest | null> => {
    if (!user?.id) return null;

    try {
      const { data, error } = await supabase
        .from('objective_change_requests')
        .select('*')
        .eq('student_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? mapToRequest(data) : null;
    } catch (error) {
      console.error('Erro ao buscar solicitação pendente:', error);
      return null;
    }
  }, [user?.id]);

  return {
    loading,
    requests,
    createRequest,
    fetchStudentRequests,
    fetchProfessionalRequests,
    respondToRequest,
    getPendingRequest,
  };
}
