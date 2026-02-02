// =====================================================
// CARREGADOR DE TEMPLATES
// =====================================================

import type { MealTemplate, TemplateRole } from "./types.ts";
import { logInfo } from "./logger.ts";

export interface TemplateData {
  template: MealTemplate;
  roles: TemplateRole[];
}

// Cache simples em memória (per-request)
let templateCache: Map<string, TemplateData> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minuto

/**
 * Carrega templates com papéis do banco de dados.
 * Usa cache em memória para evitar queries repetidas.
 */
export async function loadTemplatesWithRoles(
  supabase: any,
  forceRefresh = false
): Promise<Map<string, TemplateData>> {
  const now = Date.now();
  
  // Usar cache se válido
  if (!forceRefresh && templateCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    logInfo("Usando templates do cache", { age: now - cacheTimestamp });
    return templateCache;
  }

  const { data: templates, error: tErr } = await supabase
    .from("meal_templates")
    .select("*")
    .eq("is_active", true);

  if (tErr) throw new Error(`Erro ao carregar templates: ${tErr.message}`);

  const { data: roles, error: rErr } = await supabase
    .from("meal_template_roles")
    .select("*")
    .order("sort_order");

  if (rErr) throw new Error(`Erro ao carregar roles: ${rErr.message}`);

  const { data: roleCategories, error: rcErr } = await supabase
    .from("meal_role_food_categories")
    .select("role_id, category, priority")
    .order("priority");

  if (rcErr) throw new Error(`Erro ao carregar categorias: ${rcErr.message}`);

  // Mapear categorias por role
  const categoriesByRole = new Map<string, string[]>();
  for (const rc of roleCategories || []) {
    if (!categoriesByRole.has(rc.role_id)) {
      categoriesByRole.set(rc.role_id, []);
    }
    categoriesByRole.get(rc.role_id)!.push(rc.category);
  }

  // Montar mapa de templates
  const result = new Map<string, TemplateData>();

  for (const template of templates || []) {
    const templateRoles = (roles || [])
      .filter((r: any) => r.template_id === template.id)
      .map((r: any) => ({
        ...r,
        categories: categoriesByRole.get(r.id) || [],
      }));

    result.set(template.meal_type, { template, roles: templateRoles });
  }

  // Atualizar cache
  templateCache = result;
  cacheTimestamp = now;

  logInfo("Templates carregados do BD", { count: result.size });
  return result;
}

/**
 * Limpa o cache de templates.
 */
export function clearTemplateCache(): void {
  templateCache = null;
  cacheTimestamp = 0;
}
