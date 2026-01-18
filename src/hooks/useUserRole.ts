import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

export function useUserRole(): UserRoleData {
  const { user, profile, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [hasActiveLicense, setHasActiveLicense] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }
    
    if (!user) {
      setRoles([]);
      setHasActiveLicense(false);
      setLoading(false);
      return;
    }

    const fetchRolesAndLicense = async () => {
      setLoading(true);
      
      try {
        // Fetch user roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        } else {
          setRoles((rolesData || []).map(r => r.role as AppRole));
        }

        // Check for active license
        const { data: licenseData, error: licenseError } = await supabase
          .from('professional_licenses')
          .select('expires_at')
          .eq('user_id', user.id)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (licenseError) {
          console.error('Error fetching professional license:', licenseError);
        }

        if (licenseData?.expires_at) {
          const isActive = new Date(licenseData.expires_at) > new Date();
          setHasActiveLicense(isActive);
        } else {
          setHasActiveLicense(false);
        }
      } catch (error) {
        console.error('Error fetching user role data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRolesAndLicense();
  }, [user, authLoading]);

  // Derive account type from profile
  const accountType: AccountType = (profile?.account_type as AccountType) || 'plano_pessoal';

  return {
    roles,
    isProfessional: roles.includes('professional'),
    isStudent: roles.includes('student'),
    isAdmin: roles.includes('admin'),
    hasActiveLicense,
    accountType,
    loading,
  };
}
