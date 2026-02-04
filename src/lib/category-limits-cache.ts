// =====================================================
// CACHE LOCAL PARA LIMITES DE CATEGORIA
// =====================================================
// Singleton que mantém os limites sincronizados com o backend
// e provê acesso síncrono para serviços como substitution-service
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import { 
  CATEGORY_LIMITS as FALLBACK_CATEGORY_LIMITS,
  DEFAULT_LIMITS as FALLBACK_DEFAULT_LIMITS,
} from './optimizer-limits';

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

// Estado do singleton
let cachedData: CachedLimits | null = null;
let isFetching = false;

/**
 * Tenta carregar do localStorage
 */
function loadFromLocalStorage(): CachedLimits | null {
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

/**
 * Salva no localStorage
 */
function saveToLocalStorage(data: CachedLimits): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to cache category limits:', e);
  }
}

/**
 * Busca limites do backend e atualiza cache
 * Chamado automaticamente no boot da aplicação
 */
export async function fetchAndCacheLimits(): Promise<void> {
  if (isFetching) return;
  
  // Tentar cache primeiro
  const fromStorage = loadFromLocalStorage();
  if (fromStorage) {
    cachedData = fromStorage;
    return;
  }
  
  isFetching = true;
  try {
    const { data: response, error } = await supabase.functions.invoke(
      'get-category-limits'
    );
    
    if (error) throw error;
    
    cachedData = {
      ...response,
      fetchedAt: Date.now(),
    };
    
    saveToLocalStorage(cachedData);
  } catch (err) {
    console.warn('Failed to fetch category limits, using fallback:', err);
  } finally {
    isFetching = false;
  }
}

/**
 * Obtém os limites de categoria de forma síncrona
 * Usa cache local ou fallback se não disponível
 */
export function getCategoryLimitsSync(
  category: string | null | undefined,
  isSnack = false
): CategoryLimit {
  if (!category) return FALLBACK_DEFAULT_LIMITS;
  
  const normalized = category.toLowerCase().trim();
  
  // Se temos cache, usar
  if (cachedData) {
    // Priorizar limites de lanche se aplicável
    if (isSnack && cachedData.limits.snack[normalized]) {
      return cachedData.limits.snack[normalized];
    }
    
    // Match exato
    if (cachedData.limits.category[normalized]) {
      return cachedData.limits.category[normalized];
    }
    
    // Match parcial
    for (const [key, limits] of Object.entries(cachedData.limits.category)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return limits;
      }
    }
    
    return cachedData.defaults.category;
  }
  
  // Fallback para valores locais
  const fallbackLimits = FALLBACK_CATEGORY_LIMITS[normalized];
  if (fallbackLimits) return fallbackLimits;
  
  // Match parcial no fallback
  for (const [key, limits] of Object.entries(FALLBACK_CATEGORY_LIMITS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return limits;
    }
  }
  
  return FALLBACK_DEFAULT_LIMITS;
}

/**
 * Clamp uma quantidade aos limites da categoria
 */
export function clampToLimitsSync(
  category: string | null | undefined,
  grams: number,
  isSnack = false
): number {
  const limits = getCategoryLimitsSync(category, isSnack);
  return Math.max(limits.min, Math.min(limits.max, Math.round(grams)));
}

/**
 * Valida se uma quantidade está dentro dos limites
 */
export function isQuantityValidSync(
  category: string | null | undefined,
  grams: number,
  isSnack = false
): boolean {
  const limits = getCategoryLimitsSync(category, isSnack);
  return grams >= limits.min && grams <= limits.max;
}

/**
 * Força refresh do cache
 */
export function refreshLimitsCache(): Promise<void> {
  cachedData = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
  return fetchAndCacheLimits();
}

/**
 * Verifica se o cache está sincronizado
 */
export function isLimitsCacheSynced(): boolean {
  return cachedData !== null;
}
