import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// =====================================================
// HOOK: useSupplementCatalog
// =====================================================
// Busca itens de suplementação do banco de dados com cache.
// Fornece fallback para catálogo hardcoded se a busca falhar.
// =====================================================

const CACHE_KEY = 'nutriaplan_supplement_catalog';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface SupplementCatalogItem {
  id: string;
  name: string;
  portion: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  notes: string;
  scalable: boolean;
  minPortion: number;
  maxPortion: number;
  type: 'supplement' | 'food';
}

interface CachedCatalog {
  items: SupplementCatalogItem[];
  fetchedAt: number;
  version: string;
}

interface UseSupplementCatalogResult {
  catalog: Record<string, SupplementCatalogItem>;
  supplements: Record<string, SupplementCatalogItem>;
  foods: Record<string, SupplementCatalogItem>;
  loading: boolean;
  error: string | null;
  isSynced: boolean;
  refresh: () => Promise<void>;
}

function getFromCache(): CachedCatalog | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedCatalog = JSON.parse(cached);
    const isExpired = Date.now() - parsed.fetchedAt > CACHE_DURATION_MS;
    
    return isExpired ? null : parsed;
  } catch {
    return null;
  }
}

function saveToCache(data: CachedCatalog): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache supplement catalog:', e);
  }
}

export function useSupplementCatalog(): UseSupplementCatalogResult {
  const [items, setItems] = useState<SupplementCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  const fetchCatalog = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Tentar cache primeiro
      const cached = getFromCache();
      if (cached) {
        setItems(cached.items);
        setIsSynced(true);
        setLoading(false);
        return;
      }

      // Buscar do banco de dados
      const { data, error: fetchError } = await supabase
        .from('foods')
        .select('id, name, calories, protein, carbs, fat, type, supplement_portion, supplement_notes, supplement_min_portion, supplement_max_portion')
        .eq('is_supplement_item', true)
        .eq('is_active', true)
        .eq('review_status', 'approved');

      if (fetchError) throw fetchError;

      const catalogItems: SupplementCatalogItem[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        portion: item.supplement_portion || '100g',
        macros: {
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          carbs: Number(item.carbs) || 0,
          fat: Number(item.fat) || 0,
        },
        notes: item.supplement_notes || '',
        scalable: true,
        minPortion: Number(item.supplement_min_portion) || 0.5,
        maxPortion: Number(item.supplement_max_portion) || 2,
        type: item.type === 'supplement' ? 'supplement' : 'food',
      }));

      // Salvar no cache
      const cacheData: CachedCatalog = {
        items: catalogItems,
        fetchedAt: Date.now(),
        version: '1.0.0',
      };
      saveToCache(cacheData);

      setItems(catalogItems);
      setIsSynced(true);
    } catch (err) {
      console.warn('Failed to fetch supplement catalog, using fallback:', err);
      setError('Usando catálogo local (sincronização pendente)');
      setIsSynced(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Converter array para objetos indexados por nome
  const catalog = useMemo(() => {
    const result: Record<string, SupplementCatalogItem> = {};
    items.forEach(item => {
      result[item.name] = item;
    });
    return result;
  }, [items]);

  const supplements = useMemo(() => {
    const result: Record<string, SupplementCatalogItem> = {};
    items.filter(i => i.type === 'supplement').forEach(item => {
      result[item.name] = item;
    });
    return result;
  }, [items]);

  const foods = useMemo(() => {
    const result: Record<string, SupplementCatalogItem> = {};
    items.filter(i => i.type === 'food').forEach(item => {
      result[item.name] = item;
    });
    return result;
  }, [items]);

  return {
    catalog,
    supplements,
    foods,
    loading,
    error,
    isSynced,
    refresh: fetchCatalog,
  };
}

// =====================================================
// VERSÃO SÍNCRONA COM PREFETCH
// =====================================================
// Para uso no calculateMealReplacement que é síncrono.
// Deve ser chamado no boot da aplicação.
// =====================================================

let prefetchedCatalog: Record<string, SupplementCatalogItem> | null = null;
let prefetchedSupplements: Record<string, SupplementCatalogItem> | null = null;
let prefetchedFoods: Record<string, SupplementCatalogItem> | null = null;

export async function prefetchSupplementCatalog(): Promise<void> {
  try {
    // Tentar cache primeiro
    const cached = getFromCache();
    if (cached) {
      prefetchedCatalog = {};
      prefetchedSupplements = {};
      prefetchedFoods = {};
      cached.items.forEach(item => {
        prefetchedCatalog![item.name] = item;
        if (item.type === 'supplement') {
          prefetchedSupplements![item.name] = item;
        } else {
          prefetchedFoods![item.name] = item;
        }
      });
      return;
    }

    // Buscar do banco
    const { data, error } = await supabase
      .from('foods')
      .select('id, name, calories, protein, carbs, fat, type, supplement_portion, supplement_notes, supplement_min_portion, supplement_max_portion')
      .eq('is_supplement_item', true)
      .eq('is_active', true)
      .eq('review_status', 'approved');

    if (error) throw error;

    prefetchedCatalog = {};
    prefetchedSupplements = {};
    prefetchedFoods = {};

    const items: SupplementCatalogItem[] = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      portion: item.supplement_portion || '100g',
      macros: {
        calories: Number(item.calories) || 0,
        protein: Number(item.protein) || 0,
        carbs: Number(item.carbs) || 0,
        fat: Number(item.fat) || 0,
      },
      notes: item.supplement_notes || '',
      scalable: true,
      minPortion: Number(item.supplement_min_portion) || 0.5,
      maxPortion: Number(item.supplement_max_portion) || 2,
      type: item.type === 'supplement' ? 'supplement' : 'food',
    }));

    items.forEach(item => {
      prefetchedCatalog![item.name] = item;
      if (item.type === 'supplement') {
        prefetchedSupplements![item.name] = item;
      } else {
        prefetchedFoods![item.name] = item;
      }
    });

    // Salvar no cache
    saveToCache({
      items,
      fetchedAt: Date.now(),
      version: '1.0.0',
    });
  } catch (err) {
    console.warn('Failed to prefetch supplement catalog:', err);
    // Fallback será usado pelo calculator
  }
}

export function getPrefetchedCatalog(): {
  catalog: Record<string, SupplementCatalogItem> | null;
  supplements: Record<string, SupplementCatalogItem> | null;
  foods: Record<string, SupplementCatalogItem> | null;
} {
  return {
    catalog: prefetchedCatalog,
    supplements: prefetchedSupplements,
    foods: prefetchedFoods,
  };
}

export function clearSupplementCatalogCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    prefetchedCatalog = null;
    prefetchedSupplements = null;
    prefetchedFoods = null;
  } catch {
    // Ignore
  }
}
