import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionInfo, Plan } from '@/lib/subscription-types';

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    // Wait for auth to finish loading before determining user state
    if (authLoading) return;

    if (!user) {
      setSubscriptionInfo(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ensureFreshSession = async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = data.session;
      const expiresAtMs = (session?.expires_at ?? 0) * 1000;

      // Refresh if expiring soon (or already expired)
      if (!expiresAtMs || expiresAtMs - Date.now() < 30_000) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
      }
    };

    const invokeCheck = async () => {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      return data as SubscriptionInfo;
    };

    try {
      setLoading(true);
      await ensureFreshSession();

      const data = await invokeCheck();
      setSubscriptionInfo(data);
      setError(null);
    } catch (err: any) {
      // One retry on 401 (often caused by an expired access token)
      const status = err?.context?.status;
      if (status === 401) {
        try {
          await supabase.auth.refreshSession();
          const data = await invokeCheck();
          setSubscriptionInfo(data);
          setError(null);
          return;
        } catch {
          // fallthrough to generic error handler
        }
      }

      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      setSubscriptionInfo(null);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (error) throw error;
      
      // Type cast since DB types might not match perfectly
      setPlans((data || []) as unknown as Plan[]);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  }, []);

  // Fetch plans immediately (public data)
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Fetch subscription only after auth is determined
  useEffect(() => {
    if (!authLoading) {
      fetchSubscription();
    }
  }, [authLoading, fetchSubscription]);

  // Refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(fetchSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, fetchSubscription]);

  const createCheckout = async (planId: string, _billingCycle?: string) => {
    try {
      // Always use monthly - ignore billing cycle parameter
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId },
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      throw err;
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening portal:', err);
      throw err;
    }
  };

  const validateUsage = async (feature: 'diet' | 'substitution' | 'adjustment' | 'chat', increment = false) => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-usage', {
        body: { feature, increment },
      });

      if (error) throw error;
      
      return data;
    } catch (err: any) {
      if (err?.context?.status === 403) {
        return err.context.json ? await err.context.json() : { allowed: false, upgradeRequired: true };
      }
      throw err;
    }
  };

  // Combined loading state - includes auth loading
  const isLoading = authLoading || loading;

  return {
    subscriptionInfo,
    plans,
    loading: isLoading,
    error,
    refresh: fetchSubscription,
    createCheckout,
    openCustomerPortal,
    validateUsage,
    // Convenience getters
    isSubscribed: subscriptionInfo?.subscribed ?? false,
    currentPlan: subscriptionInfo?.plan ?? null,
    usage: subscriptionInfo?.usage ?? null,
    accountType: subscriptionInfo?.accountType ?? 'personal',
    isLinkedToProfessional: subscriptionInfo?.isLinkedToProfessional ?? false,
  };
}
