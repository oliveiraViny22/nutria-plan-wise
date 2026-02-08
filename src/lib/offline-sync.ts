import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ==========================================
// TYPES FOR OFFLINE OPERATIONS
// ==========================================

export interface PendingMealConfirmation {
  id: string;
  userId: string;
  mealId: string;
  optionId: string | null;
  status: 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed';
  logDate: string;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface PendingWeightLog {
  id: string;
  userId: string;
  weightKg: number;
  logDate: string;
  notes?: string;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface PendingBodyMeasurement {
  id: string;
  userId: string;
  measurementDate: string;
  waistCm?: number;
  hipCm?: number;
  chestCm?: number;
  armCm?: number;
  thighCm?: number;
  calfCm?: number;
  bodyFatPercent?: number;
  notes?: string;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface CachedProfile {
  userId: string;
  name: string | null;
  email: string | null;
  weight: number | null;
  height: number | null;
  age: number | null;
  sex: string | null;
  goal: string | null;
  activityLevel: string | null;
  dailyCalories: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  cachedAt: number;
}

export interface CachedDietPlan {
  id: string;
  userId: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  status: string;
  isSaved: boolean;
  cachedAt: number;
}

export interface CachedMeal {
  id: string;
  dietPlanId: string;
  name: string;
  sortOrder: number;
  totalCalories: number | null;
  totalProtein: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  cachedAt: number;
}

export interface CachedMealOption {
  id: string;
  mealId: string;
  optionNumber: number;
  name: string | null;
  totalCalories: number | null;
  totalProtein: number | null;
  totalCarbs: number | null;
  totalFat: number | null;
  cachedAt: number;
}

export interface CachedMealOptionFood {
  id: string;
  mealOptionId: string;
  foodId: string;
  foodName: string;
  quantityGrams: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  cachedAt: number;
}

export interface SyncStatus {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
}

// ==========================================
// INDEXEDDB SCHEMA (VERSION 2)
// ==========================================

interface OfflineDBSchema extends DBSchema {
  // Write queues
  'pending-confirmations': {
    key: string;
    value: PendingMealConfirmation;
    indexes: {
      'by-timestamp': number;
      'by-meal': string;
    };
  };
  'pending-weight-logs': {
    key: string;
    value: PendingWeightLog;
    indexes: {
      'by-timestamp': number;
      'by-user': string;
    };
  };
  'pending-measurements': {
    key: string;
    value: PendingBodyMeasurement;
    indexes: {
      'by-timestamp': number;
      'by-user': string;
    };
  };
  // Read caches
  'cached-profiles': {
    key: string;
    value: CachedProfile;
  };
  'cached-diet-plans': {
    key: string;
    value: CachedDietPlan;
    indexes: {
      'by-user': string;
    };
  };
  'cached-meals': {
    key: string;
    value: CachedMeal;
    indexes: {
      'by-plan': string;
    };
  };
  'cached-meal-options': {
    key: string;
    value: CachedMealOption;
    indexes: {
      'by-meal': string;
    };
  };
  'cached-meal-option-foods': {
    key: string;
    value: CachedMealOptionFood;
    indexes: {
      'by-option': string;
    };
  };
  // Sync metadata
  'sync-status': {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

const DB_NAME = 'nutriplan-offline';
const DB_VERSION = 2; // Bumped version for new stores

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;

/**
 * Get or create the IndexedDB instance
 */
async function getDB(): Promise<IDBPDatabase<OfflineDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Version 1 stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('pending-confirmations')) {
          const store = db.createObjectStore('pending-confirmations', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
          store.createIndex('by-meal', 'mealId');
        }
        if (!db.objectStoreNames.contains('sync-status')) {
          db.createObjectStore('sync-status', { keyPath: 'key' });
        }
      }

      // Version 2 stores
      if (oldVersion < 2) {
        // Weight logs queue
        if (!db.objectStoreNames.contains('pending-weight-logs')) {
          const store = db.createObjectStore('pending-weight-logs', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
          store.createIndex('by-user', 'userId');
        }
        // Body measurements queue
        if (!db.objectStoreNames.contains('pending-measurements')) {
          const store = db.createObjectStore('pending-measurements', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
          store.createIndex('by-user', 'userId');
        }
        // Profile cache
        if (!db.objectStoreNames.contains('cached-profiles')) {
          db.createObjectStore('cached-profiles', { keyPath: 'userId' });
        }
        // Diet plan cache
        if (!db.objectStoreNames.contains('cached-diet-plans')) {
          const store = db.createObjectStore('cached-diet-plans', { keyPath: 'id' });
          store.createIndex('by-user', 'userId');
        }
        // Meals cache
        if (!db.objectStoreNames.contains('cached-meals')) {
          const store = db.createObjectStore('cached-meals', { keyPath: 'id' });
          store.createIndex('by-plan', 'dietPlanId');
        }
        // Meal options cache
        if (!db.objectStoreNames.contains('cached-meal-options')) {
          const store = db.createObjectStore('cached-meal-options', { keyPath: 'id' });
          store.createIndex('by-meal', 'mealId');
        }
        // Meal option foods cache
        if (!db.objectStoreNames.contains('cached-meal-option-foods')) {
          const store = db.createObjectStore('cached-meal-option-foods', { keyPath: 'id' });
          store.createIndex('by-option', 'mealOptionId');
        }
      }
    },
  });

  return dbInstance;
}

// ==========================================
// MEAL CONFIRMATION OPERATIONS
// ==========================================

export async function queueMealConfirmation(
  userId: string,
  mealId: string,
  optionId: string | null,
  status: PendingMealConfirmation['status'],
  logDate: string
): Promise<string> {
  const db = await getDB();
  const existingKey = `${mealId}-${logDate}`;
  const existing = await db.get('pending-confirmations', existingKey);
  
  const confirmation: PendingMealConfirmation = {
    id: existingKey,
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

export async function getPendingConfirmations(): Promise<PendingMealConfirmation[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending-confirmations', 'by-timestamp');
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  const confirmations = await db.count('pending-confirmations');
  const weightLogs = await db.count('pending-weight-logs');
  const measurements = await db.count('pending-measurements');
  return confirmations + weightLogs + measurements;
}

export async function removePendingConfirmation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending-confirmations', id);
}

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

export async function clearAllPending(): Promise<void> {
  const db = await getDB();
  await db.clear('pending-confirmations');
  await db.clear('pending-weight-logs');
  await db.clear('pending-measurements');
}

// ==========================================
// WEIGHT LOG OPERATIONS
// ==========================================

export async function queueWeightLog(
  userId: string,
  weightKg: number,
  logDate: string,
  notes?: string
): Promise<string> {
  const db = await getDB();
  const id = `weight-${userId}-${logDate}`;
  const existing = await db.get('pending-weight-logs', id);
  
  const weightLog: PendingWeightLog = {
    id,
    userId,
    weightKg,
    logDate,
    notes,
    timestamp: Date.now(),
    retryCount: existing?.retryCount || 0,
  };

  await db.put('pending-weight-logs', weightLog);
  return id;
}

export async function getPendingWeightLogs(): Promise<PendingWeightLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending-weight-logs', 'by-timestamp');
}

export async function removePendingWeightLog(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending-weight-logs', id);
}

export async function updatePendingWeightLog(
  id: string,
  updates: Partial<PendingWeightLog>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('pending-weight-logs', id);
  if (existing) {
    await db.put('pending-weight-logs', { ...existing, ...updates });
  }
}

// ==========================================
// BODY MEASUREMENT OPERATIONS
// ==========================================

export async function queueBodyMeasurement(
  data: Omit<PendingBodyMeasurement, 'id' | 'timestamp' | 'retryCount'>
): Promise<string> {
  const db = await getDB();
  const id = `measurement-${data.userId}-${data.measurementDate}`;
  const existing = await db.get('pending-measurements', id);
  
  const measurement: PendingBodyMeasurement = {
    ...data,
    id,
    timestamp: Date.now(),
    retryCount: existing?.retryCount || 0,
  };

  await db.put('pending-measurements', measurement);
  return id;
}

export async function getPendingMeasurements(): Promise<PendingBodyMeasurement[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending-measurements', 'by-timestamp');
}

export async function removePendingMeasurement(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pending-measurements', id);
}

export async function updatePendingMeasurement(
  id: string,
  updates: Partial<PendingBodyMeasurement>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('pending-measurements', id);
  if (existing) {
    await db.put('pending-measurements', { ...existing, ...updates });
  }
}

// ==========================================
// PROFILE CACHE OPERATIONS
// ==========================================

export async function cacheProfile(profile: CachedProfile): Promise<void> {
  const db = await getDB();
  await db.put('cached-profiles', { ...profile, cachedAt: Date.now() });
}

export async function getCachedProfile(userId: string): Promise<CachedProfile | undefined> {
  const db = await getDB();
  return db.get('cached-profiles', userId);
}

// ==========================================
// DIET PLAN CACHE OPERATIONS
// ==========================================

export async function cacheDietPlan(plan: CachedDietPlan): Promise<void> {
  const db = await getDB();
  await db.put('cached-diet-plans', { ...plan, cachedAt: Date.now() });
}

export async function getCachedDietPlan(planId: string): Promise<CachedDietPlan | undefined> {
  const db = await getDB();
  return db.get('cached-diet-plans', planId);
}

export async function getCachedDietPlanByUser(userId: string): Promise<CachedDietPlan | undefined> {
  const db = await getDB();
  const plans = await db.getAllFromIndex('cached-diet-plans', 'by-user', userId);
  // Return most recent
  return plans.sort((a, b) => b.cachedAt - a.cachedAt)[0];
}

export async function cacheMeals(meals: CachedMeal[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached-meals', 'readwrite');
  await Promise.all(meals.map(meal => tx.store.put({ ...meal, cachedAt: Date.now() })));
  await tx.done;
}

export async function getCachedMeals(dietPlanId: string): Promise<CachedMeal[]> {
  const db = await getDB();
  return db.getAllFromIndex('cached-meals', 'by-plan', dietPlanId);
}

export async function cacheMealOptions(options: CachedMealOption[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached-meal-options', 'readwrite');
  await Promise.all(options.map(opt => tx.store.put({ ...opt, cachedAt: Date.now() })));
  await tx.done;
}

export async function getCachedMealOptions(mealId: string): Promise<CachedMealOption[]> {
  const db = await getDB();
  return db.getAllFromIndex('cached-meal-options', 'by-meal', mealId);
}

export async function cacheMealOptionFoods(foods: CachedMealOptionFood[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('cached-meal-option-foods', 'readwrite');
  await Promise.all(foods.map(food => tx.store.put({ ...food, cachedAt: Date.now() })));
  await tx.done;
}

export async function getCachedMealOptionFoods(mealOptionId: string): Promise<CachedMealOptionFood[]> {
  const db = await getDB();
  return db.getAllFromIndex('cached-meal-option-foods', 'by-option', mealOptionId);
}

// ==========================================
// SYNC STATUS OPERATIONS
// ==========================================

export async function getSyncStatus(): Promise<SyncStatus> {
  const db = await getDB();
  const pendingCount = await getPendingCount();
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

export function isOnline(): boolean {
  return navigator.onLine;
}

// ==========================================
// CACHE INVALIDATION
// ==========================================

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function isCacheValid(cachedAt: number): Promise<boolean> {
  return Date.now() - cachedAt < CACHE_TTL_MS;
}

export async function clearAllCaches(): Promise<void> {
  const db = await getDB();
  await db.clear('cached-profiles');
  await db.clear('cached-diet-plans');
  await db.clear('cached-meals');
  await db.clear('cached-meal-options');
  await db.clear('cached-meal-option-foods');
}
