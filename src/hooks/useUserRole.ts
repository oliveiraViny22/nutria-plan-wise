import { useAuth } from '@/contexts/AuthContext';
import { useCachedUserData } from './useCachedUserData';
import { AccountType } from '@/lib/types';

export type AppRole = 'admin' | 'professional' | 'student';

interface UserRoleData {
  roles: AppRole[];
  isProfessional: boolean;
  isStudent: boolean;
  isAdmin: boolean;
  hasActiveLicense: boolean;
  accountType: AccountType;
  loading: boolean;
}

/**
 * Hook to get user role data - now uses cached consolidated fetch
 */
export function useUserRole(): UserRoleData {
  const { profile } = useAuth();
  const { roles, isProfessional, isStudent, isAdmin, hasActiveLicense, loading } = useCachedUserData();

  // Derive account type from profile
  const accountType: AccountType = (profile?.account_type as AccountType) || 'plano_pessoal';

  return {
    roles: roles as AppRole[],
    isProfessional,
    isStudent,
    isAdmin,
    hasActiveLicense,
    accountType,
    loading,
  };
}
