import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CachedUserData {
  roles: string[];
  planInfo: {
    plan_id: string | null;
    plan_name: string | null;
    plan_type: string | null;
    subscription_status: string | null;
    diet_limit: number;
    substitution_limit: number;
    adjustment_limit: number;
    chat_messages_per_day: number;
    has_chat: boolean;
  } | null;
}

const CACHE_TTL = 60000; // 1 minute cache

let globalCache: CachedUserData | null = null;
let globalCacheTime = 0;
let globalUserId: string | null = null;
let fetchPromise: Promise<CachedUserData> | null = null;

/**
 * Consolidated hook that fetches user roles and plan info in a single batch
 * Uses v2 schema - no professional_licenses or get_user_permissions
 */
export function useCachedUserData() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<CachedUserData | null>(globalCache);
  const [loading, setLoading] = useState(!globalCache);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (): Promise<CachedUserData> => {
    if (!user) {
      return {
        roles: [],
        planInfo: null,
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
        // Batch queries in parallel - v2 schema
        const [rolesResult, planResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id),
          supabase.rpc('get_user_plan', { _user_id: user.id }),
        ]);

        const roles = (rolesResult.data || []).map(r => r.role);
        
        let planInfo = null;
        if (planResult.data && planResult.data.length > 0) {
          const p = planResult.data[0];
          planInfo = {
            plan_id: p.plan_id,
            plan_name: p.plan_name,
            plan_type: p.plan_type,
            subscription_status: p.subscription_status,
            diet_limit: p.diet_limit,
            substitution_limit: p.substitution_limit,
            adjustment_limit: p.adjustment_limit,
            chat_messages_per_day: p.chat_messages_per_day,
            has_chat: p.has_chat,
          };
        }

        const result: CachedUserData = {
          roles,
          planInfo,
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
      setData({ roles: [], planInfo: null });
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

  // Derive convenience properties from roles
  const roles = data?.roles || [];
  const isProfessional = roles.includes('professional');
  const isStudent = roles.includes('user') && !roles.includes('professional') && !roles.includes('admin');
  const isAdmin = roles.includes('admin');
  // In v2, linked students are determined by checking if they have an active subscription
  // managed by a professional - this is handled differently now
  const isLinkedStudent = false; // Simplified for v2

  return {
    roles,
    isProfessional,
    isStudent,
    isAdmin,
    isLinkedStudent,
    planInfo: data?.planInfo,
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
