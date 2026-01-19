import { useCachedUserData } from './useCachedUserData';

/**
 * Hook to check if current user is a student linked to a professional
 * Simplified for v2 schema - linked students managed differently
 */
export function useLinkedStudent() {
  const { isLinkedStudent } = useCachedUserData();

  return {
    isLinkedStudent,
    professionalId: null, // v2 schema doesn't have professional_id on profiles
  };
}
