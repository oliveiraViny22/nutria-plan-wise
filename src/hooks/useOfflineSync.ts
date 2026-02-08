import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNetworkStatus } from './useNetworkStatus';
import {
  queueMealConfirmation,
  queueWeightLog,
  queueBodyMeasurement,
  getPendingConfirmations,
  getPendingWeightLogs,
  getPendingMeasurements,
  getPendingCount,
  removePendingConfirmation,
  removePendingWeightLog,
  removePendingMeasurement,
  updatePendingConfirmation,
  updatePendingWeightLog,
  updatePendingMeasurement,
  updateSyncStatus,
  getSyncStatus,
  isOnline,
  PendingMealConfirmation,
  PendingWeightLog,
  PendingBodyMeasurement,
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
  logWeight: (
    userId: string,
    weightKg: number,
    logDate?: string,
    notes?: string
  ) => Promise<{ success: boolean; isOffline: boolean }>;
  logMeasurement: (
    userId: string,
    data: {
      measurementDate?: string;
      waistCm?: number;
      hipCm?: number;
      chestCm?: number;
      armCm?: number;
      thighCm?: number;
      calfCm?: number;
      bodyFatPercent?: number;
      notes?: string;
    }
  ) => Promise<{ success: boolean; isOffline: boolean }>;
  syncNow: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

/**
 * Hook for offline-capable data sync with background sync
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

  const refreshStatus = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to get sync status:', error);
    }
  }, []);

  // ==========================================
  // SYNC INDIVIDUAL ITEMS
  // ==========================================

  const syncConfirmation = useCallback(async (
    confirmation: PendingMealConfirmation
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('confirm_meal_consumption', {
        _user_id: confirmation.userId,
        _meal_id: confirmation.mealId,
        _option_id: confirmation.optionId,
        _status: confirmation.status,
        _log_date: confirmation.logDate,
      });

      if (error) throw error;
      await removePendingConfirmation(confirmation.id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      await updatePendingConfirmation(confirmation.id, {
        retryCount: confirmation.retryCount + 1,
        lastError: errorMessage,
      });

      if (confirmation.retryCount + 1 >= MAX_RETRIES) {
        await removePendingConfirmation(confirmation.id);
        toast.error('Falha ao sincronizar refeição.');
      }
      return false;
    }
  }, []);

  const syncWeightLog = useCallback(async (
    weightLog: PendingWeightLog
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('weight_logs')
        .upsert({
          user_id: weightLog.userId,
          weight_kg: weightLog.weightKg,
          log_date: weightLog.logDate,
          notes: weightLog.notes,
        }, {
          onConflict: 'user_id,log_date',
        });

      if (error) throw error;
      await removePendingWeightLog(weightLog.id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      await updatePendingWeightLog(weightLog.id, {
        retryCount: weightLog.retryCount + 1,
        lastError: errorMessage,
      });

      if (weightLog.retryCount + 1 >= MAX_RETRIES) {
        await removePendingWeightLog(weightLog.id);
        toast.error('Falha ao sincronizar peso.');
      }
      return false;
    }
  }, []);

  const syncMeasurement = useCallback(async (
    measurement: PendingBodyMeasurement
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('body_measurements')
        .upsert({
          user_id: measurement.userId,
          measurement_date: measurement.measurementDate,
          waist_cm: measurement.waistCm,
          hip_cm: measurement.hipCm,
          chest_cm: measurement.chestCm,
          arm_cm: measurement.armCm,
          thigh_cm: measurement.thighCm,
          calf_cm: measurement.calfCm,
          body_fat_percent: measurement.bodyFatPercent,
          notes: measurement.notes,
        }, {
          onConflict: 'user_id,measurement_date',
        });

      if (error) throw error;
      await removePendingMeasurement(measurement.id);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      await updatePendingMeasurement(measurement.id, {
        retryCount: measurement.retryCount + 1,
        lastError: errorMessage,
      });

      if (measurement.retryCount + 1 >= MAX_RETRIES) {
        await removePendingMeasurement(measurement.id);
        toast.error('Falha ao sincronizar medidas.');
      }
      return false;
    }
  }, []);

  // ==========================================
  // SYNC ALL PENDING
  // ==========================================

  const syncNow = useCallback(async () => {
    if (isSyncingRef.current || !isOnline()) return;

    isSyncingRef.current = true;
    await updateSyncStatus({ isSyncing: true });
    await refreshStatus();

    try {
      const [confirmations, weightLogs, measurements] = await Promise.all([
        getPendingConfirmations(),
        getPendingWeightLogs(),
        getPendingMeasurements(),
      ]);
      
      const totalPending = confirmations.length + weightLogs.length + measurements.length;
      
      if (totalPending === 0) {
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

      // Sync confirmations
      for (const confirmation of confirmations.sort((a, b) => a.timestamp - b.timestamp)) {
        const success = await syncConfirmation(confirmation);
        success ? successCount++ : failCount++;
        if (!success) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // Sync weight logs
      for (const weightLog of weightLogs.sort((a, b) => a.timestamp - b.timestamp)) {
        const success = await syncWeightLog(weightLog);
        success ? successCount++ : failCount++;
        if (!success) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      // Sync measurements
      for (const measurement of measurements.sort((a, b) => a.timestamp - b.timestamp)) {
        const success = await syncMeasurement(measurement);
        success ? successCount++ : failCount++;
        if (!success) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }

      await updateSyncStatus({
        isSyncing: false,
        lastSyncAt: Date.now(),
        lastError: failCount > 0 ? `${failCount} falha(s)` : null,
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
  }, [syncConfirmation, syncWeightLog, syncMeasurement, refreshStatus]);

  // ==========================================
  // PUBLIC API METHODS
  // ==========================================

  const confirmMeal = useCallback(async (
    userId: string,
    mealId: string,
    optionId: string | null,
    status: 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed',
    logDate?: string
  ): Promise<{ success: boolean; isOffline: boolean }> => {
    const date = logDate || new Date().toISOString().split('T')[0];
    
    await queueMealConfirmation(userId, mealId, optionId, status, date);
    await refreshStatus();

    if (!networkOnline) {
      toast.info('Salvo offline. Será sincronizado quando reconectar.');
      return { success: true, isOffline: true };
    }

    try {
      const { error } = await supabase.rpc('confirm_meal_consumption', {
        _user_id: userId,
        _meal_id: mealId,
        _option_id: optionId,
        _status: status,
        _log_date: date,
      });

      if (error) throw error;

      const pendingKey = `${mealId}-${date}`;
      await removePendingConfirmation(pendingKey);
      await refreshStatus();

      return { success: true, isOffline: false };
    } catch (error) {
      console.error('Failed to sync meal confirmation:', error);
      toast.info('Salvo localmente. Tentaremos sincronizar em breve.');
      return { success: true, isOffline: true };
    }
  }, [networkOnline, refreshStatus]);

  const logWeight = useCallback(async (
    userId: string,
    weightKg: number,
    logDate?: string,
    notes?: string
  ): Promise<{ success: boolean; isOffline: boolean }> => {
    const date = logDate || new Date().toISOString().split('T')[0];
    
    await queueWeightLog(userId, weightKg, date, notes);
    await refreshStatus();

    if (!networkOnline) {
      toast.info('Peso salvo offline. Será sincronizado quando reconectar.');
      return { success: true, isOffline: true };
    }

    try {
      const { error } = await supabase
        .from('weight_logs')
        .upsert({
          user_id: userId,
          weight_kg: weightKg,
          log_date: date,
          notes,
        }, {
          onConflict: 'user_id,log_date',
        });

      if (error) throw error;

      const pendingKey = `weight-${userId}-${date}`;
      await removePendingWeightLog(pendingKey);
      await refreshStatus();

      return { success: true, isOffline: false };
    } catch (error) {
      console.error('Failed to sync weight log:', error);
      toast.info('Peso salvo localmente.');
      return { success: true, isOffline: true };
    }
  }, [networkOnline, refreshStatus]);

  const logMeasurement = useCallback(async (
    userId: string,
    data: {
      measurementDate?: string;
      waistCm?: number;
      hipCm?: number;
      chestCm?: number;
      armCm?: number;
      thighCm?: number;
      calfCm?: number;
      bodyFatPercent?: number;
      notes?: string;
    }
  ): Promise<{ success: boolean; isOffline: boolean }> => {
    const date = data.measurementDate || new Date().toISOString().split('T')[0];
    
    await queueBodyMeasurement({
      userId,
      measurementDate: date,
      waistCm: data.waistCm,
      hipCm: data.hipCm,
      chestCm: data.chestCm,
      armCm: data.armCm,
      thighCm: data.thighCm,
      calfCm: data.calfCm,
      bodyFatPercent: data.bodyFatPercent,
      notes: data.notes,
    });
    await refreshStatus();

    if (!networkOnline) {
      toast.info('Medidas salvas offline. Serão sincronizadas quando reconectar.');
      return { success: true, isOffline: true };
    }

    try {
      const { error } = await supabase
        .from('body_measurements')
        .upsert({
          user_id: userId,
          measurement_date: date,
          waist_cm: data.waistCm,
          hip_cm: data.hipCm,
          chest_cm: data.chestCm,
          arm_cm: data.armCm,
          thigh_cm: data.thighCm,
          calf_cm: data.calfCm,
          body_fat_percent: data.bodyFatPercent,
          notes: data.notes,
        }, {
          onConflict: 'user_id,measurement_date',
        });

      if (error) throw error;

      const pendingKey = `measurement-${userId}-${date}`;
      await removePendingMeasurement(pendingKey);
      await refreshStatus();

      return { success: true, isOffline: false };
    } catch (error) {
      console.error('Failed to sync measurement:', error);
      toast.info('Medidas salvas localmente.');
      return { success: true, isOffline: true };
    }
  }, [networkOnline, refreshStatus]);

  // ==========================================
  // EFFECTS
  // ==========================================

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (networkOnline) {
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
    logWeight,
    logMeasurement,
    syncNow,
    refreshStatus,
  };
}
