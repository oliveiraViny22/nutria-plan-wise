// =====================================================
// SELEÇÃO DE ALIMENTOS ÂNCORA
// =====================================================

import type { AnchorFood, AnchorsByRole, Food } from "./types.ts";
import { ROLE_ALIASES } from "./constants/index.ts";
import { logDebug, logInfo } from "./logger.ts";

/**
 * Carrega alimentos âncora do banco de dados.
 */
export async function loadAnchorFoods(
  supabase: any
): Promise<Map<string, AnchorsByRole[]>> {
  const { data: anchors, error } = await supabase
    .from("meal_anchor_foods")
    .select(`
      *,
      food:foods(id, name, calories, protein, carbs, fat, category, processing_level, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled)
    `)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    logInfo("Erro ao carregar âncoras", { error: error.message });
    return new Map();
  }

  // Agrupar por meal_type, depois por role_name
  const byMealType = new Map<string, Map<string, AnchorFood[]>>();
  
  for (const anchor of anchors || []) {
    if (!anchor.food) continue;
    
    if (!byMealType.has(anchor.meal_type)) {
      byMealType.set(anchor.meal_type, new Map());
    }
    
    const roleMap = byMealType.get(anchor.meal_type)!;
    if (!roleMap.has(anchor.role_name)) {
      roleMap.set(anchor.role_name, []);
    }
    roleMap.get(anchor.role_name)!.push(anchor);
  }

  // Converter para estrutura final
  const result = new Map<string, AnchorsByRole[]>();
  
  for (const [mealType, roleMap] of byMealType.entries()) {
    const rolesList: AnchorsByRole[] = [];
    for (const [roleName, anchorList] of roleMap.entries()) {
      rolesList.push({ role_name: roleName, anchors: anchorList });
    }
    result.set(mealType, rolesList);
  }

  logInfo("Âncoras carregadas", { 
    count: anchors?.length || 0,
    meals: Array.from(result.keys())
  });
  
  return result;
}

/**
 * Normaliza nome do papel para comparação.
 */
export function normalizeRoleName(roleName: string): string {
  if (roleName.startsWith("proteina")) return "proteina";
  if (roleName.startsWith("carboidrato")) return "carboidrato";
  if (roleName.startsWith("laticinio")) return "laticinio";
  return roleName;
}

/**
 * Verifica se dois papéis são compatíveis.
 */
export function rolesMatch(anchor_role: string, template_role: string): boolean {
  if (anchor_role === template_role) return true;
  return normalizeRoleName(anchor_role) === normalizeRoleName(template_role);
}

/**
 * Seleciona âncora para uma opção específica.
 * Prioriza âncoras específicas, depois distribui genéricas ciclicamente.
 * Inclui retry com fallback.
 */
export function selectAnchorForOption(
  anchors: AnchorFood[],
  optionNumber: number,
  usedIds: Set<string>,
  retryCount = 0
): AnchorFood | null {
  // Filtrar âncoras não usadas E que se aplicam a esta opção
  const available = anchors.filter(a => 
    !usedIds.has(a.food.id) && 
    (a.option_number === 0 || a.option_number === optionNumber)
  );
  
  logDebug(`[ANCHOR-SELECT] Opção ${optionNumber}`, {
    total_anchors: anchors.length,
    available_count: available.length,
    retry: retryCount
  });
  
  if (available.length === 0) {
    // RETRY: se não encontrou e ainda não fez retry, tentar ignorar option_number
    if (retryCount === 0 && anchors.length > 0) {
      const anyAvailable = anchors.filter(a => !usedIds.has(a.food.id));
      if (anyAvailable.length > 0) {
        logDebug(`[ANCHOR-SELECT] Fallback para âncora genérica`, { 
          found: anyAvailable[0].food?.name 
        });
        return anyAvailable[0];
      }
    }
    return null;
  }
  
  // Priorizar âncoras específicas para esta opção
  const specific = available.filter(a => a.option_number === optionNumber);
  if (specific.length > 0) {
    logDebug(`[ANCHOR-SELECT] Usando âncora ESPECÍFICA`, { 
      food: specific[0].food?.name, 
      option_number: specific[0].option_number 
    });
    return specific[0];
  }
  
  // Distribuir âncoras genéricas ciclicamente
  const index = (optionNumber - 1) % available.length;
  const selected = available[index];
  logDebug(`[ANCHOR-SELECT] Usando âncora GENÉRICA (índice ${index})`, { 
    food: selected.food?.name 
  });
  return selected;
}

/**
 * Obtém aliases de um papel para evitar duplicatas.
 */
export function getRoleAliases(roleName: string): string[] {
  return ROLE_ALIASES[roleName] || [];
}
