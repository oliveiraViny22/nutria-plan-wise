import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNetworkStatus } from './useNetworkStatus';
import {
  queueMealConfirmation,
  getPendingConfirmations,
  getPendingCount,
  removePendingConfirmation,
  updatePendingConfirmation,
  updateSyncStatus,
  getSyncStatus,
  isOnline,
  PendingMealConfirmation,
  SyncStatus,
} from '@/lib/offline-sync';
import { toast } from 'sonner';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

export interface UseOfflineSyncResult {
  syncStatus: SyncStatus;
  pendingCount: number;
  isSyncing: boolean;
  confirmMeal: (
    userId: string,
    mealId: string,
    optionId: string | null,
    status: 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed',
    logDate?: string
  ) => Promise<{ success: boolean; isOffline: boolean }>;
  syncNow: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook for offline-capable meal confirmation with background sync
 */
export function useOfflineSync(): UseOfflineSyncResult {
  const { isOnline: networkOnline } = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingCount: 0,
    isSyncing: false,
    lastSyncAt: null,
    lastError: null,
  });
  
  const isSyncingRef = useRef(false);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Refresh the sync status from IndexedDB
   */
  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, []);

  /**
   * Sync a single pending confirmation to the server
   */
  const syncConfirmation = useCallback(async (
    confirmation: PendingMealConfirmation
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('confirm_meal_consumption', {
        _user_id: confirmation.userId,
        _meal_id: confirmation.mealId,
        _option_id: confirmation.optionId,
        _status: confirmation.status,
        _log_date: confirmation.logDate,
      });

      if (error) throw error;

      // Success - remove from pending queue
      await removePendingConfirmation(confirmation.id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Update retry count and error
      await updatePendingConfirmation(confirmation.id, {
        retryCount: confirmation.retryCount + 1,
        lastError: errorMessage,
      });

      // Remove if max retries exceeded
      if (confirmation.retryCount + 1 >= MAX_RETRIES) {
        console.error(`Max retries exceeded for confirmation ${confirmation.id}`, error);
        await removePendingConfirmation(confirmation.id);
        toast.error('Falha ao sincronizar refeição. Tente novamente.');
      }

      return false;
    }
  }, []);

  /**
   * Sync all pending confirmations
   */
  const syncNow = useCallback(async () => {
    if (isSyncingRef.current || !isOnline()) return;

    isSyncingRef.current = true;
    await updateSyncStatus({ isSyncing: true });
    await refreshStatus();

    try {
      const pending = await getPendingConfirmations();
      
      if (pending.length === 0) {
        await updateSyncStatus({ 
          isSyncing: false, 
          lastSyncAt: Date.now(),
          lastError: null 
        });
        await refreshStatus();
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // Sort by timestamp (oldest first) to preserve order
      const sorted = [...pending].sort((a, b) => a.timestamp - b.timestamp);

      for (const confirmation of sorted) {
        const success = await syncConfirmation(confirmation);
        if (success) {
          successCount++;
        } else {
          failCount++;
          // Wait before retrying next to avoid hammering the server
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }

      await updateSyncStatus({
        isSyncing: false,
        lastSyncAt: Date.now(),
        lastError: failCount > 0 ? `${failCount} falha(s) ao sincronizar` : null,
      });

      if (successCount > 0 && failCount === 0) {
        toast.success(`${successCount} registro(s) sincronizado(s)`);
      } else if (successCount > 0 && failCount > 0) {
        toast.warning(`${successCount} sincronizado(s), ${failCount} pendente(s)`);
      }

      await refreshStatus();
    } catch (error) {
      console.error('Sync failed:', error);
      await updateSyncStatus({
        isSyncing: false,
        lastError: error instanceof Error ? error.message : 'Erro ao sincronizar',
      });
      await refreshStatus();
    } finally {
      isSyncingRef.current = false;
    }
  }, [syncConfirmation, refreshStatus]);

  /**
   * Confirm a meal - saves locally first, then syncs if online
   */
  const confirmMeal = useCallback(async (
    userId: string,
    mealId: string,
    optionId: string | null,
    status: 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed',
    logDate?: string
  ): Promise<{ success: boolean; isOffline: boolean }> => {
    const date = logDate || new Date().toISOString().split('T')[0];
    
    // Always save to local queue first (offline-first approach)
    await queueMealConfirmation(userId, mealId, optionId, status, date);
    await refreshStatus();

    if (!networkOnline) {
      toast.info('Salvo offline. Será sincronizado quando reconectar.');
      return { success: true, isOffline: true };
    }

    // If online, try to sync immediately
    try {
      const { data, error } = await supabase.rpc('confirm_meal_consumption', {
        _user_id: userId,
        _meal_id: mealId,
        _option_id: optionId,
        _status: status,
        _log_date: date,
      });

      if (error) throw error;

      // Success - remove from pending queue
      const pendingKey = `${mealId}-${date}`;
      await removePendingConfirmation(pendingKey);
      await refreshStatus();

      return { success: true, isOffline: false };
    } catch (error) {
      console.error('Failed to sync meal confirmation:', error);
      // Keep in queue for later sync
      toast.info('Salvo localmente. Tentaremos sincronizar em breve.');
      return { success: true, isOffline: true };
    }
  }, [networkOnline, refreshStatus]);

  // Initial status load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (networkOnline) {
      // Delay sync slightly to ensure network is stable
      syncTimeoutRef.current = setTimeout(() => {
        syncNow();
      }, 1000);
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [networkOnline, syncNow]);

  // Listen for visibility changes to sync when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isOnline()) {
        syncNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [syncNow]);

  return {
    syncStatus,
    pendingCount: syncStatus.pendingCount,
    isSyncing: syncStatus.isSyncing,
    confirmMeal,
    syncNow,
    refreshStatus,
  };
}
