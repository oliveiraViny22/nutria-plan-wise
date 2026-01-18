import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CachedUserData {
  roles: string[];
  hasActiveLicense: boolean;
  permissions: {
    user_type: string;
    plan_name: string;
    can_create_plan: boolean;
    can_edit_plan: boolean;
    can_view_plan: boolean;
    can_substitute: boolean;
    can_adjust: boolean;
    can_use_ai: boolean;
    can_use_simulations: boolean;
    can_manage_students: boolean;
    can_send_requests: boolean;
    is_linked_to_professional: boolean;
  } | null;
}

const CACHE_TTL = 60000; // 1 minute cache

let globalCache: CachedUserData | null = null;
let globalCacheTime = 0;
let globalUserId: string | null = null;
let fetchPromise: Promise<CachedUserData> | null = null;

/**
 * Consolidated hook that fetches user roles, license, and permissions in a single batch
 * Reduces 3 separate queries to 1 batched operation with caching
 */
export function useCachedUserData() {
  const { user, profile, loading: authLoading } = useAuth();
  const [data, setData] = useState<CachedUserData | null>(globalCache);
  const [loading, setLoading] = useState(!globalCache);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (): Promise<CachedUserData> => {
    if (!user) {
      return {
        roles: [],
        hasActiveLicense: false,
        permissions: null,
      };
    }

    // Check cache validity
    const now = Date.now();
    if (globalCache && globalUserId === user.id && now - globalCacheTime < CACHE_TTL) {
      return globalCache;
    }

    // Dedupe concurrent requests
    if (fetchPromise && globalUserId === user.id) {
      return fetchPromise;
    }

    fetchPromise = (async () => {
      try {
        // Batch all queries in parallel
        const [rolesResult, licenseResult, permissionsResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id),
          supabase
            .from('professional_licenses')
            .select('expires_at')
            .eq('user_id', user.id)
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle(),
          supabase.rpc('get_user_permissions', { _user_id: user.id }),
        ]);

        const roles = (rolesResult.data || []).map(r => r.role);
        const hasActiveLicense = !!licenseResult.data?.expires_at;
        
        let permissions = null;
        if (permissionsResult.data && permissionsResult.data.length > 0) {
          const p = permissionsResult.data[0];
          permissions = {
            user_type: p.user_type,
            plan_name: p.plan_name,
            can_create_plan: p.can_create_plan,
            can_edit_plan: p.can_edit_plan,
            can_view_plan: p.can_view_plan,
            can_substitute: p.can_substitute,
            can_adjust: p.can_adjust,
            can_use_ai: p.can_use_ai,
            can_use_simulations: p.can_use_simulations,
            can_manage_students: p.can_manage_students,
            can_send_requests: p.can_send_requests,
            is_linked_to_professional: p.is_linked_to_professional,
          };
        }

        const result: CachedUserData = {
          roles,
          hasActiveLicense,
          permissions,
        };

        // Update cache
        globalCache = result;
        globalCacheTime = Date.now();
        globalUserId = user.id;

        return result;
      } finally {
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    
    if (authLoading) return;
    
    if (!user) {
      setData({ roles: [], hasActiveLicense: false, permissions: null });
      setLoading(false);
      return;
    }

    // Use cache if available
    if (globalCache && globalUserId === user.id && Date.now() - globalCacheTime < CACHE_TTL) {
      setData(globalCache);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchData().then(result => {
      if (mountedRef.current) {
        setData(result);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [user, authLoading, fetchData]);

  const refresh = useCallback(async () => {
    globalCache = null;
    globalCacheTime = 0;
    setLoading(true);
    const result = await fetchData();
    if (mountedRef.current) {
      setData(result);
      setLoading(false);
    }
  }, [fetchData]);

  const invalidateCache = useCallback(() => {
    globalCache = null;
    globalCacheTime = 0;
  }, []);

  // Derive convenience properties
  const roles = data?.roles || [];
  const isProfessional = roles.includes('professional');
  const isStudent = roles.includes('student');
  const isAdmin = roles.includes('admin');
  const isLinkedStudent = isStudent && !!profile?.professional_id;

  return {
    roles,
    isProfessional,
    isStudent,
    isAdmin,
    isLinkedStudent,
    hasActiveLicense: data?.hasActiveLicense || false,
    permissions: data?.permissions,
    loading: authLoading || loading,
    refresh,
    invalidateCache,
  };
}

// Export cache invalidation for use after mutations
export function invalidateUserDataCache() {
  globalCache = null;
  globalCacheTime = 0;
}
