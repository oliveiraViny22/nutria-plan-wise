// =====================================================
// FILTRO DE ALIMENTOS ELEGÍVEIS
// =====================================================

import type { Food, TemplateRole } from "./types.ts";
import { 
  EXCLUDED_PURE_FATS, 
  HIGH_FAT_FOODS,
  CATEGORY_QUANTITY_LIMITS,
} from "./constants.ts";
import { logDebug } from "./logger.ts";
import {
  isValidCategory,
  EXCLUDED_FROM_AUTO_PLAN,
  type FoodCategory,
} from "../_shared/food-categories.ts";

export function isPureFat(foodName: string): boolean {
  const nameLower = foodName.toLowerCase();
  return EXCLUDED_PURE_FATS.some(term => nameLower.includes(term));
}

export function isHighFatFood(foodName: string): boolean {
  const nameLower = foodName.toLowerCase();
  return HIGH_FAT_FOODS.some(term => nameLower.includes(term));
}

/**
 * Filtra alimentos elegíveis baseado em preferências e restrições do usuário.
 */
export function filterEligibleFoods(
  allFoods: Food[],
  avoidedFoods: string[],
  restrictions: string[]
): Food[] {
  const avoidedSet = new Set(avoidedFoods.map((a) => a.toLowerCase()));

  return allFoods.filter((f) => {
    const category = (f.category || "").toLowerCase();
    if (!isValidCategory(category)) return false;
    if (EXCLUDED_FROM_AUTO_PLAN.includes(category as FoodCategory)) return false;

    // Excluir alimentos marcados como opcionais (uncommon)
    if (f.is_optional) return false;

    const nameLower = f.name.toLowerCase();

    // Excluir gorduras puras (óleos, manteigas) - são temperos
    if (category === "gorduras" && isPureFat(f.name)) {
      logDebug("Excluindo gordura pura", { name: f.name });
      return false;
    }

    // Excluir alimentos rejeitados explicitamente
    if (avoidedSet.has(nameLower)) return false;
    for (const avoided of avoidedSet) {
      if (nameLower.includes(avoided)) return false;
    }

    // Aplicar restrições
    for (const rest of restrictions) {
      const restLower = rest.toLowerCase();
      if (restLower.includes("lactose") && category === "laticinios") return false;
      if (restLower.includes("gluten")) {
        if (nameLower.includes("trigo") || nameLower.includes("pão") || nameLower.includes("macarrão")) return false;
      }
      if (restLower.includes("vegetariano") && category === "proteinas") {
        if (!nameLower.includes("ovo")) return false;
      }
      if (restLower.includes("vegano") && (category === "proteinas" || category === "laticinios")) return false;
    }

    return true;
  });
}

/**
 * Seleciona um alimento aleatório para um papel específico.
 * Prioriza alimentos preferidos pelo usuário.
 */
export function selectFoodForRole(
  role: TemplateRole,
  eligibleFoods: Food[],
  usedFoodIds: Set<string>,
  preferredFoods: string[]
): Food | null {
  const preferredSet = new Set(preferredFoods.map((p) => p.toLowerCase()));

  // Filtrar por categorias do papel
  const candidates = eligibleFoods.filter((f) => {
    if (usedFoodIds.has(f.id)) return false;
    const cat = (f.category || "").toLowerCase();
    return role.categories.includes(cat);
  });

  if (candidates.length === 0) return null;

  // Priorizar alimentos preferidos com peso
  const preferred = candidates.filter((f) => {
    const nameLower = f.name.toLowerCase();
    for (const pref of preferredSet) {
      if (nameLower.includes(pref)) return true;
    }
    return false;
  });

  // Se há preferidos, 80% de chance de usar um deles
  if (preferred.length > 0 && Math.random() < 0.8) {
    return preferred[Math.floor(Math.random() * preferred.length)];
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Calcula quantidade aproximada baseada no papel e limites da categoria.
 */
export function calculateApproximateQuantity(role: TemplateRole, food?: Food): number {
  let mid = (role.min_quantity_grams + role.max_quantity_grams) / 2;
  let min = role.min_quantity_grams;
  let max = role.max_quantity_grams;

  // Aplicar limites específicos da categoria do alimento
  if (food) {
    const category = (food.category || "").toLowerCase();
    const catLimits = CATEGORY_QUANTITY_LIMITS[category];
    if (catLimits) {
      min = Math.max(min, catLimits.min);
      max = Math.min(max, catLimits.max);
    }
    
    // Alimentos com alta gordura precisam de porções menores
    if (isHighFatFood(food.name)) {
      max = Math.min(max, 30);
      min = Math.min(min, 10);
      logDebug("Limitando porção de alimento gorduroso", { name: food.name, max });
    }
    
    mid = (min + max) / 2;
  }

  const variance = (max - min) * 0.2;
  const quantity = mid + (Math.random() - 0.5) * variance;
  const clamped = Math.max(min, Math.min(max, quantity));

  // Arredondar para 5g
  return Math.round(clamped / 5) * 5;
}
