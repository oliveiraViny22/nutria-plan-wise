import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StudentAccessLevel {
  hasAccess: boolean;
  accessLevel: 'full' | 'read_only' | 'suspended';
  canViewPlan: boolean;
  canViewHistory: boolean;
  canUseChat: boolean;
  canGenerate: boolean;
  canSubstitute: boolean;
  professionalStatus: string | null;
  isLinkedStudent: boolean;
}

const DEFAULT_ACCESS: StudentAccessLevel = {
  hasAccess: true,
  accessLevel: 'full',
  canViewPlan: true,
  canViewHistory: true,
  canUseChat: true,
  canGenerate: true,
  canSubstitute: true,
  professionalStatus: null,
  isLinkedStudent: false,
};

export function useStudentAccess() {
  const { user, profile, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<StudentAccessLevel>(DEFAULT_ACCESS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccessLevel() {
      // Wait for auth to finish loading first
      if (authLoading) {
        return;
      }
      
      if (!user) {
        setAccess(DEFAULT_ACCESS);
        setLoading(false);
        return;
      }

      // Check if user is linked to a professional
      const isLinkedStudent = Boolean(profile?.professional_id);

      if (!isLinkedStudent) {
        // Not a linked student - full access based on their own subscription
        setAccess({
          ...DEFAULT_ACCESS,
          isLinkedStudent: false,
        });
        setLoading(false);
        return;
      }

      try {
        // Call database function to get access level
        const { data, error } = await supabase
          .rpc('get_student_access_level', { _student_id: user.id });

        if (error) {
          console.error('Error fetching student access level:', error);
          // Default to read-only on error for safety
          setAccess({
            hasAccess: true,
            accessLevel: 'read_only',
            canViewPlan: true,
            canViewHistory: true,
            canUseChat: false,
            canGenerate: false,
            canSubstitute: false,
            professionalStatus: 'unknown',
            isLinkedStudent: true,
          });
        } else if (data && data.length > 0) {
          const result = data[0];
          setAccess({
            hasAccess: result.has_access,
            accessLevel: result.access_level as 'full' | 'read_only' | 'suspended',
            canViewPlan: result.can_view_plan,
            canViewHistory: result.can_view_history,
            canUseChat: result.can_use_chat,
            canGenerate: result.can_generate,
            canSubstitute: result.can_substitute,
            professionalStatus: result.professional_status,
            isLinkedStudent: true,
          });
        } else {
          // No data returned - assume suspended
          setAccess({
            hasAccess: false,
            accessLevel: 'suspended',
            canViewPlan: false,
            canViewHistory: false,
            canUseChat: false,
            canGenerate: false,
            canSubstitute: false,
            professionalStatus: 'suspended',
            isLinkedStudent: true,
          });
        }
      } catch (error) {
        console.error('Error in useStudentAccess:', error);
        setAccess({
          ...DEFAULT_ACCESS,
          isLinkedStudent: true,
          accessLevel: 'read_only',
          canUseChat: false,
          canGenerate: false,
          canSubstitute: false,
        });
      }

      setLoading(false);
    }

    fetchAccessLevel();
  }, [user, profile?.professional_id, authLoading]);

  return { ...access, loading };
}
