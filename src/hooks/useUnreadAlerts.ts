import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';

export function useUnreadAlerts() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const { isProfessional, loading: roleLoading } = useUserRole();
  const { currentPlan } = useSubscription();
  
  // Prevent multiple fetches with ref
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const FETCH_DEBOUNCE_MS = 2000; // Minimum time between fetches

  // Check if user can see alerts (professionals or plano_pessoal_pago)
  const canSeeAlerts = isProfessional || currentPlan?.name === 'plano_pessoal_pago';

  const fetchUnreadCount = useCallback(async () => {
    // Skip if already fetching or if role is still loading
    if (isFetchingRef.current || roleLoading) {
      return;
    }

    // Debounce rapid calls
    const now = Date.now();
    if (now - lastFetchTimeRef.current < FETCH_DEBOUNCE_MS) {
      return;
    }

    // Only users who can see alerts should query
    if (!session?.user?.id || !canSeeAlerts) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      // For professionals: check adherence_alerts where they are the professional
      // For plano_pessoal_pago: check adherence_alerts for their own diet plans
      let query = supabase
        .from('adherence_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (isProfessional) {
        query = query.eq('professional_id', session.user.id);
      } else {
        // For personal users, check alerts where they are the student (their own alerts)
        query = query.eq('student_id', session.user.id);
      }

      const { count, error } = await query;

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread alerts:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [session?.user?.id, isProfessional, canSeeAlerts, roleLoading]);

  useEffect(() => {
    // Wait for role to load before fetching
    if (roleLoading) return;

    fetchUnreadCount();

    // Only subscribe if user can see alerts
    if (!canSeeAlerts || !session?.user?.id) return;

    // Subscribe to realtime updates with appropriate filter
    const filterColumn = isProfessional ? 'professional_id' : 'student_id';
    const channel = supabase
      .channel(`unread-alerts-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'adherence_alerts',
          filter: `${filterColumn}=eq.${session.user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, isProfessional, canSeeAlerts, roleLoading, fetchUnreadCount]);

  return { unreadCount, loading, refetch: fetchUnreadCount, canSeeAlerts };
}
