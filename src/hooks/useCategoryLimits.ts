import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  CATEGORY_LIMITS as FALLBACK_CATEGORY_LIMITS,
  DEFAULT_LIMITS as FALLBACK_DEFAULT_LIMITS,
} from '@/lib/optimizer-limits';

// =====================================================
// HOOK: useCategoryLimits
// =====================================================
// Busca limites de categoria do backend com cache local.
// Usa fallback do frontend se a requisição falhar.
// =====================================================

const CACHE_KEY = 'nutriaplan_category_limits';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hora

interface CategoryLimit {
  min: number;
  max: number;
}

interface CachedLimits {
  version: string;
  timestamp: string;
  fetchedAt: number;
  limits: {
    category: Record<string, CategoryLimit>;
    snack: Record<string, CategoryLimit>;
    scale: Record<string, CategoryLimit>;
  };
  defaults: {
    category: CategoryLimit;
    scale: CategoryLimit;
  };
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

function getFromCache(): CachedLimits | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedLimits = JSON.parse(cached);
    const isExpired = Date.now() - parsed.fetchedAt > CACHE_DURATION_MS;
    
    return isExpired ? null : parsed;
  } catch {
    return null;
  }
}

function saveToCache(data: CachedLimits): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache category limits:', e);
  }
}

export function useCategoryLimits(): UseCategoryLimitsResult {
  const [data, setData] = useState<CachedLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Tentar cache primeiro
      const cached = getFromCache();
      if (cached) {
        setData(cached);
        setIsSynced(true);
        setLoading(false);
        return;
      }

      // Buscar do backend
      const { data: response, error: fetchError } = await supabase.functions.invoke(
        'get-category-limits'
      );

      if (fetchError) throw fetchError;

      const limitsData: CachedLimits = {
        ...response,
        fetchedAt: Date.now(),
      };

      saveToCache(limitsData);
      setData(limitsData);
      setIsSynced(true);
    } catch (err) {
      console.warn('Failed to fetch category limits, using fallback:', err);
      setError('Usando limites locais (sincronização pendente)');
      setIsSynced(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  // Limites ativos (do backend ou fallback)
  const categoryLimits = data?.limits.category ?? FALLBACK_CATEGORY_LIMITS;
  const snackLimits = data?.limits.snack ?? {};
  const scaleLimits = data?.limits.scale ?? {};
  const defaultCategoryLimit = data?.defaults.category ?? FALLBACK_DEFAULT_LIMITS;
  const defaultScaleLimit = data?.defaults.scale ?? { min: 20, max: 500 };

  const getCategoryLimit = useCallback(
    (category: string, isSnack = false): CategoryLimit => {
      const normalized = category.toLowerCase().trim();

      // Priorizar limites de lanche se aplicável
      if (isSnack && snackLimits[normalized]) {
        return snackLimits[normalized];
      }

      // Match exato
      if (categoryLimits[normalized]) {
        return categoryLimits[normalized];
      }

      // Match parcial
      for (const [key, limits] of Object.entries(categoryLimits)) {
        if (normalized.includes(key) || key.includes(normalized)) {
          return limits;
        }
      }

      return defaultCategoryLimit;
    },
    [categoryLimits, snackLimits, defaultCategoryLimit]
  );

  return {
    categoryLimits,
    snackLimits,
    scaleLimits,
    defaultCategoryLimit,
    defaultScaleLimit,
    loading,
    error,
    isSynced,
    refresh: fetchLimits,
    getCategoryLimit,
  };
}
