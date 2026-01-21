import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  is_sensitive: boolean;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

interface UseRealtimeSettingsOptions {
  onSettingChange?: (setting: SystemSetting) => void;
  onSettingInsert?: (setting: SystemSetting) => void;
  onSettingDelete?: (oldSetting: SystemSetting) => void;
  showNotifications?: boolean;
}

export function useRealtimeSettings(options: UseRealtimeSettingsOptions = {}) {
  const { toast } = useToast();
  const { 
    onSettingChange, 
    onSettingInsert, 
    onSettingDelete,
    showNotifications = true 
  } = options;

  useEffect(() => {
    const channel = supabase
      .channel('system-settings-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          const newSetting = payload.new as SystemSetting;
          console.log('[Realtime] Setting updated:', newSetting.key);
          
          onSettingChange?.(newSetting);
          
          if (showNotifications) {
            toast({
              title: 'Configuração atualizada',
              description: `"${newSetting.key}" foi modificada.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          const newSetting = payload.new as SystemSetting;
          console.log('[Realtime] Setting inserted:', newSetting.key);
          
          onSettingInsert?.(newSetting);
          
          if (showNotifications) {
            toast({
              title: 'Nova configuração',
              description: `"${newSetting.key}" foi adicionada.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'system_settings',
        },
        (payload) => {
          const oldSetting = payload.old as SystemSetting;
          console.log('[Realtime] Setting deleted:', oldSetting.key);
          
          onSettingDelete?.(oldSetting);
          
          if (showNotifications) {
            toast({
              title: 'Configuração removida',
              description: `Uma configuração foi removida.`,
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Settings subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from settings channel');
      supabase.removeChannel(channel);
    };
  }, [onSettingChange, onSettingInsert, onSettingDelete, showNotifications, toast]);
}
