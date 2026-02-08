import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Types for offline operations
export interface PendingMealConfirmation {
  id: string;
  userId: string;
  mealId: string;
  optionId: string | null;
  status: 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed';
  logDate: string;
  timestamp: number; // For last-write-wins resolution
  retryCount: number;
  lastError?: string;
}

export interface SyncStatus {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

// IndexedDB Schema
interface OfflineDBSchema extends DBSchema {
  'pending-confirmations': {
    key: string;
    value: PendingMealConfirmation;
    indexes: {
      'by-timestamp': number;
      'by-meal': string;
    };
  };
  'sync-status': {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

const DB_NAME = 'nutriplan-offline';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;

/**
 * Get or create the IndexedDB instance
 */
async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending confirmations store
      if (!db.objectStoreNames.contains('pending-confirmations')) {
        const store = db.createObjectStore('pending-confirmations', { keyPath: 'id' });
        store.createIndex('by-timestamp', 'timestamp');
        store.createIndex('by-meal', 'mealId');
      }

      // Sync status store
      if (!db.objectStoreNames.contains('sync-status')) {
        db.createObjectStore('sync-status', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

/**
 * Generate a unique ID for pending operations
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Add a meal confirmation to the pending queue
 * Uses "last write wins" - overwrites any existing pending operation for the same meal/date
 */
export async function queueMealConfirmation(
  userId: string,
  mealId: string,
  optionId: string | null,
  status: PendingMealConfirmation['status'],
  logDate: string
): Promise<string> {
  const db = await getDB();
  
  // Check for existing pending operation for same meal/date
  const existingKey = `${mealId}-${logDate}`;
  const existing = await db.get('pending-confirmations', existingKey);
  
  const confirmation: PendingMealConfirmation = {
    id: existingKey, // Use meal+date as key for deduplication
    userId,
    mealId,
    optionId,
    status,
    logDate,
    timestamp: Date.now(),
    retryCount: existing?.retryCount || 0,
  };

  await db.put('pending-confirmations', confirmation);
  
  return confirmation.id;
}

/**
 * Get all pending confirmations
 */
export async function getPendingConfirmations(): Promise<PendingMealConfirmation[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending-confirmations', 'by-timestamp');
}

/**
 * Get pending count
 */
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count('pending-confirmations');
}

/**
 * Remove a confirmation from the pending queue
 */
export async function removePendingConfirmation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending-confirmations', id);
}

/**
 * Update a pending confirmation (e.g., increment retry count, add error)
 */
export async function updatePendingConfirmation(
  id: string,
  updates: Partial<PendingMealConfirmation>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('pending-confirmations', id);
  
  if (existing) {
    await db.put('pending-confirmations', { ...existing, ...updates });
  }
}

/**
 * Clear all pending confirmations (e.g., after successful sync)
 */
export async function clearAllPending(): Promise<void> {
  const db = await getDB();
  await db.clear('pending-confirmations');
}

/**
 * Get sync status metadata
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const db = await getDB();
  const pendingCount = await db.count('pending-confirmations');
  const lastSyncRecord = await db.get('sync-status', 'lastSyncAt');
  const isSyncingRecord = await db.get('sync-status', 'isSyncing');
  const lastErrorRecord = await db.get('sync-status', 'lastError');

  return {
    pendingCount,
    isSyncing: (isSyncingRecord?.value as boolean) || false,
    lastSyncAt: (lastSyncRecord?.value as number) || null,
    lastError: (lastErrorRecord?.value as string) || null,
  };
}

/**
 * Update sync status
 */
export async function updateSyncStatus(updates: Partial<SyncStatus>): Promise<void> {
  const db = await getDB();

  if (updates.isSyncing !== undefined) {
    await db.put('sync-status', { key: 'isSyncing', value: updates.isSyncing });
  }
  if (updates.lastSyncAt !== undefined) {
    await db.put('sync-status', { key: 'lastSyncAt', value: updates.lastSyncAt });
  }
  if (updates.lastError !== undefined) {
    await db.put('sync-status', { key: 'lastError', value: updates.lastError });
  }
}

/**
 * Check if we're online and can sync
 */
export function isOnline(): boolean {
  return navigator.onLine;
}
