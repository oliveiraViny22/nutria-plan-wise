import { useState, useEffect, useCallback } from 'react';
import { 
  fetchAndCacheLimits,
  getCategoryLimitsSync,
  isLimitsCacheSynced,
  refreshLimitsCache,
} from '@/lib/category-limits-cache';
import { 
  CATEGORY_LIMITS as FALLBACK_CATEGORY_LIMITS,
  DEFAULT_LIMITS as FALLBACK_DEFAULT_LIMITS,
} from '@/lib/optimizer-limits';

// =====================================================
// HOOK: useCategoryLimits
// =====================================================
// Wrapper reativo sobre o cache singleton.
// Usa o cache centralizado em category-limits-cache.ts.
// =====================================================

interface CategoryLimit {
  min: number;
  max: number;
}

interface UseCategoryLimitsResult {
  categoryLimits: Record<string, CategoryLimit>;
  snackLimits: Record<string, CategoryLimit>;
  scaleLimits: Record<string, CategoryLimit>;
  defaultCategoryLimit: CategoryLimit;
  defaultScaleLimit: CategoryLimit;
  loading: boolean;
  error: string | null;
  isSynced: boolean;
  refresh: () => Promise<void>;
  getCategoryLimit: (category: string, isSnack?: boolean) => CategoryLimit;
}

export function useCategoryLimits(): UseCategoryLimitsResult {
  const [loading, setLoading] = useState(!isLimitsCacheSynced());
  const [error, setError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(isLimitsCacheSynced());
  const [, forceUpdate] = useState(0);

  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await fetchAndCacheLimits();
      setIsSynced(isLimitsCacheSynced());
      forceUpdate(n => n + 1);
    } catch (err) {
      console.warn('Failed to fetch category limits:', err);
      setError('Usando limites locais (sincronização pendente)');
      setIsSynced(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await refreshLimitsCache();
      setIsSynced(isLimitsCacheSynced());
      forceUpdate(n => n + 1);
    } catch (err) {
      console.warn('Failed to refresh category limits:', err);
      setError('Falha ao atualizar limites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLimitsCacheSynced()) {
      fetchLimits();
    }
  }, [fetchLimits]);

  // Wrapper reativo que usa o cache singleton
  const getCategoryLimit = useCallback(
    (category: string, isSnack = false): CategoryLimit => {
      return getCategoryLimitsSync(category, isSnack);
    },
    []
  );

  return {
    categoryLimits: FALLBACK_CATEGORY_LIMITS,
    snackLimits: {},
    scaleLimits: {},
    defaultCategoryLimit: FALLBACK_DEFAULT_LIMITS,
    defaultScaleLimit: { min: 20, max: 500 },
    loading,
    error,
    isSynced,
    refresh,
    getCategoryLimit,
  };
}
