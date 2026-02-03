// =====================================================
// FILTRO DE ALIMENTOS ELEGÍVEIS
// =====================================================

import type { Food, TemplateRole } from "./types.ts";
import { 
  EXCLUDED_PURE_FATS, 
  HIGH_FAT_FOODS,
  CATEGORY_QUANTITY_LIMITS,
  LEAN_PROTEIN_RULES,
  HIGH_FAT_PROTEIN_RULES,
  MAX_HIGH_FAT_PROTEIN_PORTION,
  MAX_FAT_SHARE_PER_FOOD,
  LEAN_DAIRY_RULES,
  HIGH_FAT_DAIRY_THRESHOLD,
  MAX_HIGH_FAT_DAIRY_PORTION,
} from "./constants.ts";
import { logDebug, logWarn } from "./logger.ts";
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

// =====================================================
// CLASSIFICAÇÃO DE PROTEÍNAS (v5.1)
// =====================================================

/**
 * Verifica se um alimento é uma proteína magra elegível como base.
 * Critério: alta proteína, baixa gordura, calorias controladas.
 */
export function isLeanProtein(food: Food): boolean {
  return (
    food.protein >= LEAN_PROTEIN_RULES.MIN_PROTEIN_PER_100G &&
    food.fat <= LEAN_PROTEIN_RULES.MAX_FAT_PER_100G &&
    food.calories <= LEAN_PROTEIN_RULES.MAX_CALORIES_PER_100G
  );
}

/**
 * Verifica se um alimento é uma proteína com alta gordura (bloqueada como base).
 * Critério: tem proteína significativa mas gordura dominante ou calorias altas.
 */
export function isHighFatProtein(food: Food): boolean {
  // Precisa ter proteína mínima para ser considerada "proteína"
  if (food.protein < LEAN_PROTEIN_RULES.MIN_PROTEIN_PER_100G) {
    return false;
  }
  
  return (
    food.fat >= HIGH_FAT_PROTEIN_RULES.FAT_PER_100G ||
    food.fat > food.protein || // gordura domina a proteína
    food.calories >= HIGH_FAT_PROTEIN_RULES.CALORIES_PER_100G
  );
}

// =====================================================
// CLASSIFICAÇÃO DE LATICÍNIOS (v5.2)
// =====================================================

/**
 * Verifica se um alimento é um laticínio magro elegível como base.
 * Critério: baixa gordura e calorias controladas.
 */
export function isLeanDairy(food: Food): boolean {
  const category = (food.category || "").toLowerCase();
  if (category !== "laticinios") return false;
  
  return (
    food.fat <= LEAN_DAIRY_RULES.MAX_FAT_PER_100G &&
    food.calories <= LEAN_DAIRY_RULES.MAX_CALORIES_PER_100G
  );
}

/**
 * Verifica se um alimento é um laticínio com alta gordura.
 * Critério: gordura acima do threshold (queijos amarelos, requeijão integral).
 */
export function isHighFatDairy(food: Food): boolean {
  const category = (food.category || "").toLowerCase();
  if (category !== "laticinios") return false;
  
  return food.fat >= HIGH_FAT_DAIRY_THRESHOLD;
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

// =====================================================
// SOLUÇÃO 3: SELEÇÃO PONDERADA POR DÉFICIT DE MACRO
// =====================================================

interface MacroDeficits {
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Calcula um score de adequação nutricional para um alimento.
 * Alimentos que melhor preenchem os déficits recebem scores mais altos.
 */
function calculateNutritionalScore(
  food: Food,
  deficits: MacroDeficits,
  quantity: number
): number {
  const mult = quantity / 100;
  let score = 0;
  
  // Pesos por macro (proteína é prioridade)
  const PROTEIN_WEIGHT = 3;
  const CARBS_WEIGHT = 2;
  const FAT_WEIGHT = 1;
  
  // Pontuar positivamente se contribui para déficit positivo (precisamos mais)
  if (deficits.protein > 0) {
    const proteinContrib = Math.min(food.protein * mult, deficits.protein);
    score += proteinContrib * PROTEIN_WEIGHT;
  }
  
  if (deficits.carbs > 0) {
    const carbsContrib = Math.min(food.carbs * mult, deficits.carbs);
    score += carbsContrib * CARBS_WEIGHT;
  }
  
  // Gordura: pontuar negativamente se já temos demais
  if (deficits.fat <= 0) {
    score -= food.fat * mult * FAT_WEIGHT;
  } else {
    const fatContrib = Math.min(food.fat * mult, deficits.fat);
    score += fatContrib * FAT_WEIGHT * 0.5; // Menor peso para gordura
  }
  
  return score;
}

// =====================================================
// PAPÉIS QUE EXIGEM PROTEÍNA MAGRA
// =====================================================

const LEAN_PROTEIN_REQUIRED_ROLES = [
  "proteina_principal",
  "proteina",
  "proteina_base",
];

/**
 * Verifica se um papel exige proteína magra.
 */
function requiresLeanProtein(roleName: string): boolean {
  return LEAN_PROTEIN_REQUIRED_ROLES.some(r => 
    roleName.toLowerCase().includes(r)
  );
}

/**
 * Verifica se um papel é de laticínio.
 */
function isDairyRole(roleName: string): boolean {
  return roleName.toLowerCase().includes("laticinio") || 
         roleName.toLowerCase().includes("laticinios");
}

/**
 * Seleciona um alimento para um papel usando seleção ponderada.
 * Prioriza alimentos preferidos E que melhor preenchem déficits de macros.
 * 
 * v5.1: Papéis de proteína base exigem proteínas magras.
 * v5.2: Papéis de laticínio preferem laticínios magros.
 */
export function selectFoodForRole(
  role: TemplateRole,
  eligibleFoods: Food[],
  usedFoodIds: Set<string>,
  preferredFoods: string[],
  macroDeficits?: MacroDeficits
): Food | null {
  const preferredSet = new Set(preferredFoods.map((p) => p.toLowerCase()));
  const isProteinBaseRole = requiresLeanProtein(role.role_name);
  const isLaticinioRole = isDairyRole(role.role_name);

  // Filtrar por categorias do papel
  let candidates = eligibleFoods.filter((f) => {
    if (usedFoodIds.has(f.id)) return false;
    const cat = (f.category || "").toLowerCase();
    if (!role.categories.includes(cat)) return false;
    
    // v5.1: Papéis de proteína base exigem proteínas magras
    if (isProteinBaseRole && cat === "proteinas") {
      // Bloquear proteínas com alta gordura
      if (isHighFatProtein(f)) {
        logDebug("Bloqueando proteína gorda como base", {
          name: f.name,
          fat: f.fat,
          protein: f.protein,
          calories: f.calories,
        });
        return false;
      }
      
      // Preferir proteínas magras
      if (!isLeanProtein(f)) {
        logDebug("Proteína rejeitada por não ser magra", { name: f.name });
        return false;
      }
    }
    
    // v5.2: Papéis de laticínio bloqueiam laticínios muito gordos como primeira escolha
    if (isLaticinioRole && cat === "laticinios") {
      // Bloquear laticínios muito gordos como primeira seleção
      if (isHighFatDairy(f)) {
        logDebug("Bloqueando laticínio gordo como primeira escolha", {
          name: f.name,
          fat: f.fat,
        });
        return false;
      }
    }
    
    return true;
  });

  if (candidates.length === 0) {
    // Fallback: se não há proteínas magras, aceitar não-gordas
    if (isProteinBaseRole) {
      logWarn("Nenhuma proteína magra disponível, usando fallback");
      candidates = eligibleFoods.filter((f) => {
        if (usedFoodIds.has(f.id)) return false;
        const cat = (f.category || "").toLowerCase();
        if (!role.categories.includes(cat)) return false;
        // Ainda bloquear as muito gordas
        if (cat === "proteinas" && isHighFatProtein(f)) return false;
        return true;
      });
    }
    
    // Fallback para laticínios: aceitar gordos mas com log
    if (isLaticinioRole) {
      logWarn("Nenhum laticínio magro disponível, usando fallback com laticínio gordo");
      candidates = eligibleFoods.filter((f) => {
        if (usedFoodIds.has(f.id)) return false;
        const cat = (f.category || "").toLowerCase();
        if (!role.categories.includes(cat)) return false;
        return true;
      });
    }
    
    if (candidates.length === 0) return null;
  }

  // Identificar alimentos preferidos
  const preferred = candidates.filter((f) => {
    const nameLower = f.name.toLowerCase();
    for (const pref of preferredSet) {
      if (nameLower.includes(pref)) return true;
    }
    return false;
  });

  // Se não temos déficits, usar lógica original
  if (!macroDeficits) {
    if (preferred.length > 0 && Math.random() < 0.8) {
      return preferred[Math.floor(Math.random() * preferred.length)];
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // SELEÇÃO PONDERADA: Calcular scores para cada candidato
  const estimatedQuantity = (role.min_quantity_grams + role.max_quantity_grams) / 2;
  
  const scoredCandidates = candidates.map(food => ({
    food,
    score: calculateNutritionalScore(food, macroDeficits, estimatedQuantity),
    isPreferred: preferred.includes(food),
  }));

  // Ordenar por score (maior primeiro)
  scoredCandidates.sort((a, b) => b.score - a.score);

  // Boost para preferidos: se um preferido está no top 30%, priorizar
  const topThreshold = Math.max(1, Math.ceil(scoredCandidates.length * 0.3));
  const topCandidates = scoredCandidates.slice(0, topThreshold);
  const topPreferred = topCandidates.filter(c => c.isPreferred);

  if (topPreferred.length > 0 && Math.random() < 0.7) {
    return topPreferred[Math.floor(Math.random() * topPreferred.length)].food;
  }

  // Seleção ponderada por score entre os top candidatos
  const totalScore = topCandidates.reduce((sum, c) => sum + Math.max(0.1, c.score), 0);
  let random = Math.random() * totalScore;
  
  for (const candidate of topCandidates) {
    random -= Math.max(0.1, candidate.score);
    if (random <= 0) {
      return candidate.food;
    }
  }

  return topCandidates[0]?.food || candidates[0];
}

// =====================================================
// SOLUÇÃO 4: CÁLCULO INTELIGENTE DE QUANTIDADES INICIAIS
// =====================================================

interface MealCalorieContext {
  mealCalorieTarget: number;
  roleContribution: number; // Percentual esperado (0.0 a 1.0)
}

/**
 * Calcula quantidade baseada no alvo calórico da refeição e contribuição do papel.
 * Usa a densidade calórica do alimento para calcular gramas necessários.
 */
export function calculateSmartQuantity(
  role: TemplateRole,
  food: Food,
  context?: MealCalorieContext
): number {
  // Se não temos contexto, usar lógica padrão melhorada
  if (!context || !context.mealCalorieTarget) {
    return calculateApproximateQuantity(role, food);
  }

  const { mealCalorieTarget, roleContribution } = context;
  
  // Calcular calorias esperadas para este papel
  const roleCalories = mealCalorieTarget * roleContribution;
  
  // Calcular gramas necessários baseado na densidade calórica
  const caloriesPer100g = food.calories || 100; // fallback
  let targetGrams = (roleCalories / caloriesPer100g) * 100;
  
  // Aplicar limites do papel
  let min = role.min_quantity_grams;
  let max = role.max_quantity_grams;
  
  // Aplicar limites da categoria
  const category = (food.category || "").toLowerCase();
  const catLimits = CATEGORY_QUANTITY_LIMITS[category];
  if (catLimits) {
    min = Math.max(min, catLimits.min);
    max = Math.min(max, catLimits.max);
  }
  
  // Alimentos gordurosos: limitar porções
  if (isHighFatFood(food.name)) {
    max = Math.min(max, 30);
    min = Math.min(min, 10);
    logDebug("Limitando porção de alimento gorduroso", { name: food.name, max });
  }
  
  // v5.2: Laticínios gordos têm limite de porção
  if (isHighFatDairy(food)) {
    max = Math.min(max, MAX_HIGH_FAT_DAIRY_PORTION);
    logDebug("Limitando porção de laticínio gordo", { name: food.name, max });
  }
  
  // Clampar e arredondar
  targetGrams = Math.max(min, Math.min(max, targetGrams));
  return Math.round(targetGrams / 5) * 5;
}

/**
 * Calcula quantidade aproximada baseada no papel e limites da categoria.
 * Mantida para compatibilidade - usar calculateSmartQuantity quando possível.
 * 
 * v5.1: Limita porções de proteínas gordas.
 * v5.2: Limita porções de laticínios gordos.
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
    
    // v5.1: Proteínas gordas têm limite de porção adicional
    if (isHighFatProtein(food)) {
      max = Math.min(max, MAX_HIGH_FAT_PROTEIN_PORTION);
      logDebug("Limitando porção de proteína gorda", { 
        name: food.name, 
        max,
        fat: food.fat,
        protein: food.protein 
      });
    }
    
    // v5.2: Laticínios gordos têm limite de porção (queijos amarelos)
    if (isHighFatDairy(food)) {
      max = Math.min(max, MAX_HIGH_FAT_DAIRY_PORTION);
      logDebug("Limitando porção de laticínio gordo", { 
        name: food.name, 
        max,
        fat: food.fat 
      });
    }
    
    mid = (min + max) / 2;
  }

  const variance = (max - min) * 0.2;
  const quantity = mid + (Math.random() - 0.5) * variance;
  const clamped = Math.max(min, Math.min(max, quantity));

  // Arredondar para 5g
  return Math.round(clamped / 5) * 5;
}

// =====================================================
// VALIDAÇÃO DE DOMINÂNCIA DE GORDURA (v5.1)
// =====================================================

interface FoodWithQuantity {
  food: Food;
  quantity_grams: number;
}

interface FatShareValidation {
  status: "PASS" | "FAIL";
  reason?: string;
  food?: string;
  fatShare?: number;
}

/**
 * Valida que nenhum alimento domina a gordura diária do plano.
 * Nenhum alimento deve contribuir mais que MAX_FAT_SHARE_PER_FOOD (60%) da gordura.
 */
export function validateFatShare(
  foods: FoodWithQuantity[],
  targetFat: number
): FatShareValidation {
  if (targetFat <= 0) {
    return { status: "PASS" };
  }

  for (const item of foods) {
    const foodFatContrib = (item.food.fat / 100) * item.quantity_grams;
    const fatShare = foodFatContrib / targetFat;
    
    if (fatShare > MAX_FAT_SHARE_PER_FOOD) {
      logWarn("Alimento domina gordura do plano", {
        name: item.food.name,
        fatContrib: foodFatContrib.toFixed(1),
        targetFat,
        share: `${(fatShare * 100).toFixed(0)}%`,
      });
      
      return {
        status: "FAIL",
        reason: `Alimento excede ${MAX_FAT_SHARE_PER_FOOD * 100}% da gordura diária`,
        food: item.food.name,
        fatShare: Math.round(fatShare * 100),
      };
    }
  }

  return { status: "PASS" };
}
