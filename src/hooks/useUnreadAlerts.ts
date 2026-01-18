import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export function useUnreadAlerts() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const { isProfessional, loading: roleLoading } = useUserRole();
  
  // Prevent multiple fetches with ref
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const FETCH_DEBOUNCE_MS = 2000; // Minimum time between fetches

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

    // Only professionals see alerts
    if (!session?.user?.id || !isProfessional) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    try {
      const { count, error } = await supabase
        .from('adherence_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', session.user.id)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread alerts:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [session?.user?.id, isProfessional, roleLoading]);

  useEffect(() => {
    // Wait for role to load before fetching
    if (roleLoading) return;

    fetchUnreadCount();

    // Only subscribe if user is a professional
    if (!isProfessional || !session?.user?.id) return;

    // Subscribe to realtime updates with filter for this professional
    const channel = supabase
      .channel(`unread-alerts-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'adherence_alerts',
          filter: `professional_id=eq.${session.user.id}`,
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, isProfessional, roleLoading, fetchUnreadCount]);

  return { unreadCount, loading, refetch: fetchUnreadCount };
}
