// =====================================================
// ESTRATÉGIA DE INTEGRAÇÃO: TEMPLATES ↔ ÂNCORAS
// =====================================================
// 
// HIERARQUIA (aprovada):
// 1. Template define os PAPÉIS necessários (estrutura)
// 2. Âncora preenche os papéis com alimentos específicos
// 3. Pool completa papéis sem âncora
//
// REGRA CONTEXTUAL (aprovada):
// - Plano Automático: Template prevalece sobre âncoras
//   → Âncoras SÓ entram se o papel está no template
// - Plano Profissional: Âncora prevalece sobre template
//   → Âncoras SEMPRE entram, mesmo sem papel no template
//
// =====================================================

import type { AnchorsByRole, TemplateRole, Food, AnchorFood } from "./types.ts";
import { logInfo, logDebug } from "./logger.ts";

export type PlanContext = "automatic" | "professional";

export interface StrategyConfig {
  context: PlanContext;
  templateRoles: TemplateRole[];
  anchorsByRole: AnchorsByRole[];
}

export interface RoleFillPlan {
  roleName: string;
  source: "anchor" | "pool";
  anchor?: AnchorFood;
  isRequired: boolean;
  minQuantity: number;
  maxQuantity: number;
}

/**
 * Determina quais papéis devem ser preenchidos e de onde vem cada alimento.
 * 
 * @param config - Configuração da estratégia
 * @returns Lista de papéis a preencher, ordenados por prioridade
 */
export function buildRoleFillPlan(config: StrategyConfig): RoleFillPlan[] {
  const { context, templateRoles, anchorsByRole } = config;
  const plan: RoleFillPlan[] = [];
  const processedRoles = new Set<string>();

  logDebug(`[STRATEGY] Contexto: ${context}`, {
    templateRoles: templateRoles.length,
    anchorRoles: anchorsByRole.length,
  });

  if (context === "automatic") {
    // =====================================================
    // PLANO AUTOMÁTICO: Template prevalece
    // =====================================================
    // Iterar pelos papéis do template primeiro
    for (const role of templateRoles) {
      const normalizedRole = normalizeRoleName(role.role_name);
      
      // Buscar âncora compatível
      const matchingAnchors = anchorsByRole.find(a => 
        normalizeRoleName(a.role_name) === normalizedRole
      );

      if (matchingAnchors && matchingAnchors.anchors.length > 0) {
        // Papel do template TEM âncora → usar âncora
        plan.push({
          roleName: role.role_name,
          source: "anchor",
          anchor: matchingAnchors.anchors[0], // Será selecionada por opção depois
          isRequired: role.is_required,
          minQuantity: role.min_quantity_grams,
          maxQuantity: role.max_quantity_grams,
        });
        logDebug(`[STRATEGY] ${role.role_name}: ÂNCORA (template+anchor)`, {
          food: matchingAnchors.anchors[0]?.food?.name,
        });
      } else {
        // Papel do template SEM âncora → pool
        plan.push({
          roleName: role.role_name,
          source: "pool",
          isRequired: role.is_required,
          minQuantity: role.min_quantity_grams,
          maxQuantity: role.max_quantity_grams,
        });
        logDebug(`[STRATEGY] ${role.role_name}: POOL (template only)`);
      }
      
      processedRoles.add(normalizedRole);
    }

    // Âncoras sem papel no template são IGNORADAS no contexto automático
    for (const anchor of anchorsByRole) {
      const normalizedRole = normalizeRoleName(anchor.role_name);
      if (!processedRoles.has(normalizedRole)) {
        logDebug(`[STRATEGY] ${anchor.role_name}: IGNORADA (âncora sem papel no template)`, {
          foods: anchor.anchors.map(a => a.food?.name),
        });
      }
    }

  } else {
    // =====================================================
    // PLANO PROFISSIONAL: Âncora prevalece
    // =====================================================
    // Primeiro, incluir TODAS as âncoras
    for (const anchorGroup of anchorsByRole) {
      const normalizedRole = normalizeRoleName(anchorGroup.role_name);
      
      // Buscar papel compatível no template (para limites de quantidade)
      const templateRole = templateRoles.find(t => 
        normalizeRoleName(t.role_name) === normalizedRole
      );

      plan.push({
        roleName: anchorGroup.role_name,
        source: "anchor",
        anchor: anchorGroup.anchors[0],
        isRequired: true, // Âncoras de profissional são sempre obrigatórias
        minQuantity: templateRole?.min_quantity_grams ?? 50,
        maxQuantity: templateRole?.max_quantity_grams ?? 300,
      });
      
      logDebug(`[STRATEGY] ${anchorGroup.role_name}: ÂNCORA (profissional)`, {
        food: anchorGroup.anchors[0]?.food?.name,
        hasTemplate: !!templateRole,
      });
      
      processedRoles.add(normalizedRole);
    }

    // Depois, completar com papéis do template que NÃO têm âncora
    for (const role of templateRoles) {
      const normalizedRole = normalizeRoleName(role.role_name);
      
      if (!processedRoles.has(normalizedRole)) {
        plan.push({
          roleName: role.role_name,
          source: "pool",
          isRequired: role.is_required,
          minQuantity: role.min_quantity_grams,
          maxQuantity: role.max_quantity_grams,
        });
        logDebug(`[STRATEGY] ${role.role_name}: POOL (template sem âncora)`);
      }
    }
  }

  // Ordenar: obrigatórios primeiro, depois opcionais
  plan.sort((a, b) => {
    if (a.isRequired !== b.isRequired) return a.isRequired ? -1 : 1;
    return 0;
  });

  logInfo(`[STRATEGY] Plano de papéis definido`, {
    context,
    totalRoles: plan.length,
    fromAnchors: plan.filter(p => p.source === "anchor").length,
    fromPool: plan.filter(p => p.source === "pool").length,
  });

  return plan;
}

/**
 * Normaliza nome do papel para comparação.
 */
function normalizeRoleName(roleName: string): string {
  if (roleName.startsWith("proteina")) return "proteina";
  if (roleName.startsWith("carboidrato")) return "carboidrato";
  if (roleName.startsWith("laticinio")) return "laticinio";
  return roleName;
}

/**
 * Detecta o contexto do plano baseado em metadados.
 * Por enquanto, todos os planos são automáticos.
 * Futuramente, profissionais poderão criar planos personalizados.
 */
export function detectPlanContext(
  _userId: string,
  _professionalId?: string | null
): PlanContext {
  // TODO: Implementar detecção quando profissionais criarem planos
  // if (professionalId) return "professional";
  return "automatic";
}
