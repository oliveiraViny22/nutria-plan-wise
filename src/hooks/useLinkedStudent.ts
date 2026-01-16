import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

/**
 * Hook to check if current user is a student linked to a professional
 * Linked students have read-only access
 */
export function useLinkedStudent() {
  const { profile } = useAuth();
  const { isStudent } = useUserRole();

  // A linked student is someone with role=student AND professional_id set
  const isLinkedStudent = isStudent && !!profile?.professional_id;

  return {
    isLinkedStudent,
    professionalId: profile?.professional_id || null,
  };
}
