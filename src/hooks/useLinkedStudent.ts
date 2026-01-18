import { useAuth } from '@/contexts/AuthContext';
import { useCachedUserData } from './useCachedUserData';

/**
 * Hook to check if current user is a student linked to a professional
 * Linked students have read-only access
 * Now uses cached data to avoid redundant queries
 */
export function useLinkedStudent() {
  const { profile } = useAuth();
  const { isLinkedStudent } = useCachedUserData();

  return {
    isLinkedStudent,
    professionalId: profile?.professional_id || null,
  };
}
