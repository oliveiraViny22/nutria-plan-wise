import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LinkedStudentInfo {
  isLinkedStudent: boolean;
  professionalId: string | null;
  professionalName: string | null;
  loading: boolean;
}

/**
 * Hook to check if current user is a student linked to a professional
 * Uses professional_students table to determine relationship
 */
export function useLinkedStudent(): LinkedStudentInfo {
  const { user } = useAuth();
  const [state, setState] = useState<LinkedStudentInfo>({
    isLinkedStudent: false,
    professionalId: null,
    professionalName: null,
    loading: true,
  });

  const fetchLinkedProfessional = useCallback(async () => {
    if (!user?.id) {
      setState({
        isLinkedStudent: false,
        professionalId: null,
        professionalName: null,
        loading: false,
      });
      return;
    }

    try {
      // Check if user is a student linked to a professional
      const { data, error } = await supabase
        .from('professional_students')
        .select(`
          professional_id,
          status,
          profiles:professional_id(name)
        `)
        .eq('student_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking linked student:', error);
        setState({
          isLinkedStudent: false,
          professionalId: null,
          professionalName: null,
          loading: false,
        });
        return;
      }

      if (data) {
        const profileData = data.profiles as unknown as { name: string | null } | null;
        setState({
          isLinkedStudent: true,
          professionalId: data.professional_id,
          professionalName: profileData?.name || null,
          loading: false,
        });
      } else {
        setState({
          isLinkedStudent: false,
          professionalId: null,
          professionalName: null,
          loading: false,
        });
      }
    } catch (error) {
      console.error('Error in useLinkedStudent:', error);
      setState({
        isLinkedStudent: false,
        professionalId: null,
        professionalName: null,
        loading: false,
      });
    }
  }, [user?.id]);

  useEffect(() => {
    fetchLinkedProfessional();
  }, [fetchLinkedProfessional]);

  return state;
}
