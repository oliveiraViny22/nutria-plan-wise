import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export function useUnreadAlerts() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const { isProfessional } = useUserRole();

  const fetchUnreadCount = async () => {
    if (!session?.user?.id || !isProfessional) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

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
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('unread-alerts-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'adherence_alerts',
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, isProfessional]);

  return { unreadCount, loading, refetch: fetchUnreadCount };
}
