import { useCachedUserData } from './useCachedUserData';

export type AppRole = 'admin' | 'professional' | 'user';

interface UserRoleData {
  roles: AppRole[];
  isProfessional: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  loading: boolean;
}

/**
 * Hook to get user role data - simplified for v2 schema
 */
export function useUserRole(): UserRoleData {
  const { roles, isProfessional, isStudent, isAdmin, loading } = useCachedUserData();

  return {
    roles: roles as AppRole[],
    isProfessional,
    isStudent,
    isAdmin,
    loading,
  };
}
