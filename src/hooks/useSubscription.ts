import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SubscriptionInfo, Plan } from '@/lib/subscription-types';

export function useSubscription() {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscriptionInfo(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;
      
      setSubscriptionInfo(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  }, [user]);

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

  useEffect(() => {
    fetchSubscription();
    fetchPlans();
  }, [fetchSubscription, fetchPlans]);

  // Refresh every 60 seconds
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(fetchSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, fetchSubscription]);

  const createCheckout = async (planId: string, billingCycle: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planId, billingCycle },
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

  return {
    subscriptionInfo,
    plans,
    loading,
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
  };
}
