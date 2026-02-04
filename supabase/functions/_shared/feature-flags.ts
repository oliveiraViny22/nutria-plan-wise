/**
 * Feature Flags Helper para Edge Functions
 * 
 * Permite verificar flags de funcionalidades sem hardcode
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SettingRow {
  key: string;
  value: unknown;
}

/**
 * Verifica se uma feature flag está ativa
 */
export async function getFeatureFlag(
  supabase: SupabaseClient,
  flagKey: string,
  defaultValue: boolean = false
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', flagKey)
      .eq('category', 'feature_flags')
      .maybeSingle();

    if (error || !data) {
      return defaultValue;
    }

    const row = data as { value: unknown };
    const value = row.value;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Obtém percentual de rollout
 */
export async function getRolloutPercent(
  supabase: SupabaseClient,
  flagKey: string,
  defaultValue: number = 0
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', flagKey)
      .eq('category', 'feature_flags')
      .maybeSingle();

    if (error || !data) {
      return defaultValue;
    }

    const row = data as { value: unknown };
    const value = row.value;
    const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
    
    return isNaN(parsed) ? defaultValue : parsed;
  } catch {
    return defaultValue;
  }
}

/**
 * Verifica se um usuário está no rollout percentual
 */
export async function isInRollout(
  supabase: SupabaseClient,
  userId: string,
  flagKey: string
): Promise<boolean> {
  const percent = await getRolloutPercent(supabase, flagKey, 0);
  
  if (percent <= 0) return false;
  if (percent >= 100) return true;
  
  // Hash do userId para bucket consistente
  const userBucket = Math.abs(hashCode(userId)) % 100;
  return userBucket < percent;
}

/**
 * Carrega múltiplas flags de uma vez (otimização)
 */
export async function loadFeatureFlags(
  supabase: SupabaseClient
): Promise<Map<string, unknown>> {
  const flags = new Map<string, unknown>();
  
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .eq('category', 'feature_flags');

    if (error || !data) {
      return flags;
    }

    const rows = data as SettingRow[];
    for (const row of rows) {
      flags.set(row.key, row.value);
    }
  } catch {
    // Retorna mapa vazio em caso de erro
  }
  
  return flags;
}

/**
 * Helper para hash consistente
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Constantes exportadas
export const FLAGS = {
  SHADOW_MODE: 'shadow_mode_enabled',
  OPENAI_CIRCUIT_BREAKER: 'openai_circuit_breaker_enabled',
  DETAILED_METRICS: 'detailed_metrics_enabled',
  GENERATOR_V58_ROLLOUT: 'generator_v58_rollout_percent',
} as const;
