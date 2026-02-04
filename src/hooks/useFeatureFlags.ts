/**
 * Hook para gerenciar Feature Flags
 * 
 * Lê flags da tabela system_settings (categoria 'feature_flags')
 * Permite ativar/desativar funcionalidades sem deploy
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FeatureFlag {
  key: string;
  value: boolean | number | string;
  description: string;
}

/**
 * Lista de feature flags conhecidas
 */
export const FEATURE_FLAGS = {
  SHADOW_MODE: 'shadow_mode_enabled',
  OPENAI_CIRCUIT_BREAKER: 'openai_circuit_breaker_enabled',
  DETAILED_METRICS: 'detailed_metrics_enabled',
  GENERATOR_V58_ROLLOUT: 'generator_v58_rollout_percent',
} as const;

/**
 * Hook para buscar todas as feature flags
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value, description')
        .eq('category', 'feature_flags');

      if (error) throw error;

      const flags: Record<string, FeatureFlag> = {};
      for (const row of data || []) {
        flags[row.key] = {
          key: row.key,
          value: parseValue(row.value),
          description: row.description || '',
        };
      }
      return flags;
    },
    staleTime: 60 * 1000, // 1 minuto de cache
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para verificar uma flag específica
 */
export function useFeatureFlag(flagKey: string, defaultValue: boolean = false) {
  const { data: flags, isLoading } = useFeatureFlags();
  
  if (isLoading || !flags) {
    return { enabled: defaultValue, isLoading };
  }
  
  const flag = flags[flagKey];
  const enabled = flag?.value === true || flag?.value === 'true';
  
  return { enabled, isLoading: false };
}

/**
 * Hook para verificar rollout percentual
 */
export function useRolloutFlag(flagKey: string, userId?: string) {
  const { data: flags, isLoading } = useFeatureFlags();
  
  if (isLoading || !flags || !userId) {
    return { inRollout: false, isLoading };
  }
  
  const flag = flags[flagKey];
  const percent = typeof flag?.value === 'number' 
    ? flag.value 
    : parseInt(String(flag?.value) || '0', 10);
  
  if (percent <= 0) return { inRollout: false, isLoading: false };
  if (percent >= 100) return { inRollout: true, isLoading: false };
  
  // Calcular bucket do usuário baseado no UUID
  const userBucket = Math.abs(hashCode(userId)) % 100;
  const inRollout = userBucket < percent;
  
  return { inRollout, isLoading: false };
}

/**
 * Helpers
 */
function parseValue(value: unknown): boolean | number | string {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  if (typeof value === 'string' && !isNaN(Number(value))) return Number(value);
  return String(value);
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}
