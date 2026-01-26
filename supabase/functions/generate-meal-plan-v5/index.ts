// =====================================================
// GERADOR DE PLANO ALIMENTAR v5 - ESTRUTURA CULTURAL
// =====================================================
// Este gerador foca EXCLUSIVAMENTE em:
// 1. Respeitar estrutura cultural das refeições
// 2. Usar templates de refeição do banco
// 3. Gerar quantidades APROXIMADAS
// 4. NÃO fecha calorias/macros (delegado ao rebalanceador)
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getCorsHeaders,
  CLIENT_ERRORS,
  validate,
  getErrorForLogging,
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/security.ts";
import {
  isValidCategory,
  isSubstitutableLevel,
  EXCLUDED_FROM_AUTO_PLAN,
  type FoodCategory,
} from "../_shared/food-categories.ts";
import {
  KCAL_PER_GRAM,
  GENERATOR_CONTRACT,
  REBALANCER_CONTRACT,
  validateGeneratedPlan,
  type MacroTargets,
} from "../_shared/nutrition-contracts.ts";

// =====================================================
// LOGGING
// =====================================================

const log = (step: string, data?: unknown) => {
  const timestamp = new Date().toISOString();
  console.log(`[GEN-V5] ${timestamp} | ${step}`, data ? JSON.stringify(data) : "");
};

// =====================================================
// TIPOS
// =====================================================

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  processing_level: string | null;
  is_optional: boolean | null;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number | null;
  unit_enabled: boolean | null;
}

interface MealTemplate {
  id: string;
  meal_type: string;
  name: string;
  min_items: number;
  max_items: number;
}

interface TemplateRole {
  id: string;
  template_id: string;
  role_name: string;
  is_required: boolean;
  min_quantity_grams: number;
  max_quantity_grams: number;
  sort_order: number;
  categories: string[];
}

interface FoodSelection {
  food: Food;
  role_name: string;
  quantity_grams: number;
  display_quantity: number;
  display_unit: string;
}

interface MealResult {
  meal_type: string;
  meal_name: string;
  foods: FoodSelection[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface StructuralValidation {
  valid: boolean;
  errors: string[];
}

// =====================================================
// CONSTANTES
// =====================================================

const MEAL_NAMES: Record<string, string> = {
  breakfast: "Café da Manhã",
  morning_snack: "Lanche da Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche da Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

const MAIN_MEALS = ["breakfast", "lunch", "dinner"];

const ITEM_COUNTS: Record<string, { min: number; max: number }> = {
  breakfast: { min: 2, max: 4 },
  morning_snack: { min: 2, max: 3 },
  lunch: { min: 4, max: 6 },
  afternoon_snack: { min: 2, max: 3 },
  dinner: { min: 4, max: 6 },
  supper: { min: 2, max: 3 },
};

// =====================================================
// CONVERSÃO DE UNIDADES
// =====================================================

function applyUnitConversion(
  food: Food,
  grams: number
): { display_quantity: number; display_unit: string; calculated_grams: number } {
  if (!food.unit_enabled || !food.unit_name || !food.unit_weight_grams) {
    return {
      display_quantity: Math.round(grams),
      display_unit: "g",
      calculated_grams: grams,
    };
  }

  const rawUnits = grams / food.unit_weight_grams;
  const increment = food.unit_increment || 1;
  let roundedUnits = Math.round(rawUnits / increment) * increment;
  if (roundedUnits < increment) roundedUnits = increment;

  const finalGrams = roundedUnits * food.unit_weight_grams;
  const errorPercent = grams > 0 ? (Math.abs(finalGrams - grams) / grams) * 100 : 0;

  if (errorPercent <= 5) {
    return {
      display_quantity: roundedUnits,
      display_unit: food.unit_name,
      calculated_grams: finalGrams,
    };
  }

  return {
    display_quantity: Math.round(grams),
    display_unit: "g",
    calculated_grams: grams,
  };
}

// =====================================================
// TIPOS PARA ALIMENTOS-ÂNCORA
// =====================================================

interface AnchorFood {
  id: string;
  meal_type: string;
  option_number: number;
  food_id: string;
  role_name: string;
  default_quantity_grams: number;
  sort_order: number;
  food: Food;
}

// Estrutura para armazenar âncoras agrupadas por papel
interface AnchorsByRole {
  role_name: string;
  anchors: AnchorFood[];
}

// =====================================================
// CARREGAR ALIMENTOS-ÂNCORA
// =====================================================

async function loadAnchorFoods(
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
    log("Erro ao carregar âncoras", { error: error.message });
    return new Map();
  }

  // Agrupar por meal_type, depois por role_name
  // Isso permite distribuir âncoras do mesmo papel entre opções diferentes
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

  // Converter para estrutura final: Map<meal_type, AnchorsByRole[]>
  const result = new Map<string, AnchorsByRole[]>();
  
  for (const [mealType, roleMap] of byMealType.entries()) {
    const rolesList: AnchorsByRole[] = [];
    for (const [roleName, anchorList] of roleMap.entries()) {
      rolesList.push({ role_name: roleName, anchors: anchorList });
    }
    result.set(mealType, rolesList);
  }

  // Log detalhado para debug de option_number
  const anchorSummary = (anchors || []).map((a: AnchorFood) => ({
    food: a.food?.name,
    meal_type: a.meal_type,
    role_name: a.role_name,
    option_number: a.option_number
  }));
  
  log("Âncoras carregadas", { 
    count: anchors?.length || 0,
    meals: Array.from(result.keys()),
    detail: anchorSummary
  });
  return result;
}

// =====================================================
// CARREGAR TEMPLATES
// =====================================================

async function loadTemplatesWithRoles(
  supabase: any
): Promise<Map<string, { template: MealTemplate; roles: TemplateRole[] }>> {
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
  const result = new Map<string, { template: MealTemplate; roles: TemplateRole[] }>();

  for (const template of templates || []) {
    const templateRoles = (roles || [])
      .filter((r: any) => r.template_id === template.id)
      .map((r: any) => ({
        ...r,
        categories: categoriesByRole.get(r.id) || [],
      }));

    result.set(template.meal_type, { template, roles: templateRoles });
  }

  return result;
}

// =====================================================
// FILTRAR ALIMENTOS ELEGÍVEIS
// =====================================================

// =====================================================
// LIMITES DE QUANTIDADE POR CATEGORIA
// =====================================================

const CATEGORY_QUANTITY_LIMITS: Record<string, { min: number; max: number }> = {
  proteinas: { min: 50, max: 200 },
  carboidratos: { min: 80, max: 250 },
  leguminosas: { min: 60, max: 150 },
  vegetais: { min: 50, max: 200 },
  frutas: { min: 80, max: 200 },
  laticinios: { min: 50, max: 200 },
  gorduras: { min: 10, max: 30 }, // Gorduras são complementos, não itens principais
};

// Gorduras puras que NÃO devem entrar automaticamente em planos
// (são temperos/complementos, não itens principais)
const EXCLUDED_PURE_FATS = [
  "óleo", "azeite", "manteiga", "creme de leite", "tahine",
  "banha", "margarina", "gordura"
];

function isPureFat(foodName: string): boolean {
  const nameLower = foodName.toLowerCase();
  return EXCLUDED_PURE_FATS.some(term => nameLower.includes(term));
}

function filterEligibleFoods(
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
      log("Excluindo gordura pura", { name: f.name });
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
// SELECIONAR ALIMENTO POR PAPEL
// =====================================================

function selectFoodForRole(
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

  // Priorizar alimentos preferidos
  const preferred = candidates.filter((f) => {
    const nameLower = f.name.toLowerCase();
    for (const pref of preferredSet) {
      if (nameLower.includes(pref)) return true;
    }
    return false;
  });

  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

// =====================================================
// CALCULAR QUANTIDADE APROXIMADA COM LIMITES POR CATEGORIA
// =====================================================

function calculateApproximateQuantity(role: TemplateRole, food?: Food): number {
  // Usar média entre min e max do papel, com leve randomização
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
      // Recalcular média com limites ajustados
      mid = (min + max) / 2;
    }
  }

  const variance = (max - min) * 0.2;
  const quantity = mid + (Math.random() - 0.5) * variance;

  // Garantir que está dentro dos limites
  const clamped = Math.max(min, Math.min(max, quantity));

  // Arredondar para 5g
  return Math.round(clamped / 5) * 5;
}

// =====================================================
// SELECIONAR ÂNCORA PARA UMA OPÇÃO ESPECÍFICA
// =====================================================

function selectAnchorForOption(
  anchors: AnchorFood[],
  optionNumber: number,
  usedIds: Set<string>
): AnchorFood | null {
  // Filtrar âncoras não usadas E que se aplicam a esta opção
  // option_number = 0 significa "todas as opções"
  // option_number = N significa "apenas opção N"
  const available = anchors.filter(a => 
    !usedIds.has(a.food.id) && 
    (a.option_number === 0 || a.option_number === optionNumber)
  );
  
  log(`[ANCHOR-SELECT] Opção ${optionNumber}`, {
    total_anchors: anchors.length,
    available_count: available.length,
    used_ids_count: usedIds.size,
    anchors_detail: anchors.map(a => ({ 
      food: a.food?.name, 
      option_number: a.option_number,
      is_used: usedIds.has(a.food?.id || ''),
      matches: a.option_number === 0 || a.option_number === optionNumber
    }))
  });
  
  if (available.length === 0) {
    log(`[ANCHOR-SELECT] Nenhuma âncora disponível para opção ${optionNumber}`);
    return null;
  }
  
  // Priorizar âncoras específicas para esta opção sobre as genéricas
  const specific = available.filter(a => a.option_number === optionNumber);
  if (specific.length > 0) {
    log(`[ANCHOR-SELECT] Usando âncora ESPECÍFICA`, { 
      food: specific[0].food?.name, 
      option_number: specific[0].option_number 
    });
    return specific[0];
  }
  
  // Se só temos âncoras genéricas, distribuir ciclicamente entre opções
  const index = (optionNumber - 1) % available.length;
  const selected = available[index];
  log(`[ANCHOR-SELECT] Usando âncora GENÉRICA (índice ${index})`, { 
    food: selected.food?.name, 
    option_number: selected.option_number 
  });
  return selected;
}

// =====================================================
// MAPEAMENTO DE NOMES DE PAPÉIS SIMILARES
// =====================================================

const ROLE_ALIASES: Record<string, string[]> = {
  proteina: ["proteina_principal", "proteina_leve"],
  proteina_principal: ["proteina", "proteina_leve"],
  proteina_leve: ["proteina", "proteina_principal"],
  carboidrato_base: ["carboidrato"],
  carboidrato: ["carboidrato_base"],
  laticinio: ["laticinios"],
  laticinios: ["laticinio"],
};

function normalizeRoleName(roleName: string): string {
  // Retorna o nome canônico para comparação
  if (roleName.startsWith("proteina")) return "proteina";
  if (roleName.startsWith("carboidrato")) return "carboidrato";
  if (roleName.startsWith("laticinio")) return "laticinio";
  return roleName;
}

function rolesMatch(anchor_role: string, template_role: string): boolean {
  if (anchor_role === template_role) return true;
  return normalizeRoleName(anchor_role) === normalizeRoleName(template_role);
}

// =====================================================
// MONTAR REFEIÇÃO COM ÂNCORAS DISTRIBUÍDAS
// =====================================================

function buildMealWithAnchors(
  mealType: string,
  optionNumber: number,
  templateData: { template: MealTemplate; roles: TemplateRole[] },
  eligibleFoods: Food[],
  usedGlobalIds: Set<string>,
  preferredFoods: string[],
  anchorsByRole: AnchorsByRole[],
  previousOptionsUsedIds: Set<string>
): MealResult {
  const { template, roles } = templateData;
  const foods: FoodSelection[] = [];
  const usedInMeal = new Set<string>();
  const filledRoles = new Set<string>();
  const filledNormalizedRoles = new Set<string>(); // Para evitar duplicatas de proteína/carbo

  // Criar set combinado de IDs usados (global + opções anteriores desta refeição)
  const combinedUsedIds = new Set([...usedGlobalIds, ...previousOptionsUsedIds]);

  // PASSO 1: Tentar usar âncoras para preencher papéis
  // CRÍTICO: Apenas UMA âncora por categoria normalizada de papel
  for (const { role_name, anchors } of anchorsByRole) {
    const normalizedRole = normalizeRoleName(role_name);
    
    // Pular se já temos um alimento para este papel normalizado
    if (filledNormalizedRoles.has(normalizedRole)) {
      log(`Âncora ignorada - papel já preenchido`, { 
        mealType, 
        role: role_name,
        normalizedRole 
      });
      continue;
    }
    
    const anchor = selectAnchorForOption(anchors, optionNumber, combinedUsedIds);
    
    if (anchor && anchor.food) {
      const conversion = applyUnitConversion(anchor.food, anchor.default_quantity_grams);
      foods.push({
        food: anchor.food,
        role_name: role_name,
        quantity_grams: conversion.calculated_grams,
        display_quantity: conversion.display_quantity,
        display_unit: conversion.display_unit,
      });

      usedInMeal.add(anchor.food.id);
      filledRoles.add(role_name);
      filledNormalizedRoles.add(normalizedRole);
      
      // Marcar papéis similares como preenchidos também
      const aliases = ROLE_ALIASES[role_name] || [];
      for (const alias of aliases) {
        filledRoles.add(alias);
      }
      
      log(`Âncora aplicada (opção ${optionNumber})`, { 
        mealType, 
        food: anchor.food.name, 
        role: role_name,
        normalizedRole
      });
    }
  }

  // PASSO 2: Processar papéis obrigatórios NÃO preenchidos por âncoras
  // Verificar tanto pelo nome exato quanto pelo normalizado
  const requiredRoles = roles.filter((r) => 
    r.is_required && 
    !filledRoles.has(r.role_name) && 
    !filledNormalizedRoles.has(normalizeRoleName(r.role_name))
  );
  const optionalRoles = roles.filter((r) => 
    !r.is_required && 
    !filledRoles.has(r.role_name) &&
    !filledNormalizedRoles.has(normalizeRoleName(r.role_name))
  );

  for (const role of requiredRoles) {
    const food = selectFoodForRole(
      role, 
      eligibleFoods, 
      new Set([...combinedUsedIds, ...usedInMeal]), 
      preferredFoods
    );

    if (food) {
      const quantity = calculateApproximateQuantity(role, food);
      const conversion = applyUnitConversion(food, quantity);

      foods.push({
        food,
        role_name: role.role_name,
        quantity_grams: conversion.calculated_grams,
        display_quantity: conversion.display_quantity,
        display_unit: conversion.display_unit,
      });

      usedInMeal.add(food.id);
    } else {
      log(`Papel obrigatório não preenchido`, { mealType, role: role.role_name });
    }
  }

  // PASSO 3: Processar papéis opcionais se houver espaço
  // IMPORTANTE: Não preenche necessariamente até o máximo!
  // Escolhe um número aleatório de itens dentro do range [min, max]
  const itemLimits = ITEM_COUNTS[mealType] || { min: 2, max: 4 };
  
  // Determinar quantos itens totais a refeição deve ter (aleatório no range)
  const targetItems = Math.floor(
    Math.random() * (itemLimits.max - itemLimits.min + 1)
  ) + itemLimits.min;
  
  // Quantos slots opcionais ainda podemos preencher
  const remainingSlots = Math.max(0, targetItems - foods.length);

  log(`Opção ${optionNumber} de ${mealType}`, {
    currentItems: foods.length,
    targetItems,
    remainingSlots,
    optionalRolesAvailable: optionalRoles.length,
  });

  // Embaralhar papéis opcionais para variedade entre opções
  const shuffledOptionalRoles = [...optionalRoles].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(shuffledOptionalRoles.length, remainingSlots); i++) {
    const role = shuffledOptionalRoles[i];
    const food = selectFoodForRole(
      role, 
      eligibleFoods, 
      new Set([...combinedUsedIds, ...usedInMeal]), 
      preferredFoods
    );

    if (food) {
      const quantity = calculateApproximateQuantity(role, food);
      const conversion = applyUnitConversion(food, quantity);

      foods.push({
        food,
        role_name: role.role_name,
        quantity_grams: conversion.calculated_grams,
        display_quantity: conversion.display_quantity,
        display_unit: conversion.display_unit,
      });

      usedInMeal.add(food.id);
    }
  }

  // Calcular totais
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const sel of foods) {
    const mult = sel.quantity_grams / 100;
    totalCals += sel.food.calories * mult;
    totalProt += sel.food.protein * mult;
    totalCarbs += sel.food.carbs * mult;
    totalFat += sel.food.fat * mult;
  }

  return {
    meal_type: mealType,
    meal_name: MEAL_NAMES[mealType] || mealType,
    foods,
    totals: {
      calories: Math.round(totalCals),
      protein: Math.round(totalProt * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
    },
  };
}

// =====================================================
// AJUSTE PROPORCIONAL PARA FECHAR METAS
// =====================================================
// O gerador delega o "fechamento fino" ao rebalanceador, MAS precisa
// entregar um plano dentro de ±10% da meta calórica.
// Esta função escala todas as porções proporcionalmente.
// =====================================================

interface ScaleResult {
  scaledMeals: MealResult[];
  scaleFactor: number;
  beforeTotals: { calories: number; protein: number; carbs: number; fat: number };
  afterTotals: { calories: number; protein: number; carbs: number; fat: number };
}

/**
 * Ajusta proporcionalmente todas as porções para atingir a meta calórica.
 * Prioriza proteína e carboidrato, limitando gordura a 30% das calorias.
 */
function scaleToCalorieTarget(
  mealsWithOptions: Array<{ mealType: string; options: MealResult[] }>,
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number
): ScaleResult {
  // Calcular totais atuais (somando primeira opção de cada refeição)
  let currentCals = 0, currentProt = 0, currentCarbs = 0, currentFat = 0;
  
  for (const mealData of mealsWithOptions) {
    if (mealData.options[0]) {
      currentCals += mealData.options[0].totals.calories;
      currentProt += mealData.options[0].totals.protein;
      currentCarbs += mealData.options[0].totals.carbs;
      currentFat += mealData.options[0].totals.fat;
    }
  }
  
  const beforeTotals = {
    calories: Math.round(currentCals),
    protein: Math.round(currentProt * 10) / 10,
    carbs: Math.round(currentCarbs * 10) / 10,
    fat: Math.round(currentFat * 10) / 10,
  };
  
  // Se já está dentro da tolerância de 5%, não ajustar
  const diffPercent = Math.abs((currentCals - targetCalories) / targetCalories * 100);
  if (diffPercent <= 5) {
    log("Plano já está dentro da tolerância (±5%)", { currentCals, targetCalories, diffPercent });
    return {
      scaledMeals: mealsWithOptions.map(m => m.options[0]),
      scaleFactor: 1,
      beforeTotals,
      afterTotals: beforeTotals,
    };
  }
  
  // Calcular fator de escala baseado em calorias
  const scaleFactor = targetCalories / currentCals;
  
  log("Aplicando ajuste proporcional", { 
    currentCals, 
    targetCalories, 
    scaleFactor: scaleFactor.toFixed(3),
    diffPercent: diffPercent.toFixed(1),
  });
  
  // Aplicar fator a todas as opções de todas as refeições
  for (const mealData of mealsWithOptions) {
    for (const option of mealData.options) {
      for (const foodSel of option.foods) {
        // Aplicar fator de escala à quantidade
        const originalGrams = foodSel.quantity_grams;
        let newGrams = originalGrams * scaleFactor;
        
        // Limitar a faixa razoável (mínimo 10g, máximo 500g)
        newGrams = Math.max(10, Math.min(500, newGrams));
        
        // Arredondar para número inteiro
        newGrams = Math.round(newGrams);
        
        // Re-aplicar conversão de unidade
        const conversion = applyUnitConversion(foodSel.food, newGrams);
        
        foodSel.quantity_grams = conversion.calculated_grams;
        foodSel.display_quantity = conversion.display_quantity;
        foodSel.display_unit = conversion.display_unit;
      }
      
      // Recalcular totais da opção
      let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
      for (const sel of option.foods) {
        const mult = sel.quantity_grams / 100;
        totalCals += sel.food.calories * mult;
        totalProt += sel.food.protein * mult;
        totalCarbs += sel.food.carbs * mult;
        totalFat += sel.food.fat * mult;
      }
      
      option.totals = {
        calories: Math.round(totalCals),
        protein: Math.round(totalProt * 10) / 10,
        carbs: Math.round(totalCarbs * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
      };
    }
  }
  
  // Calcular novos totais após ajuste
  let afterCals = 0, afterProt = 0, afterCarbs = 0, afterFat = 0;
  for (const mealData of mealsWithOptions) {
    if (mealData.options[0]) {
      afterCals += mealData.options[0].totals.calories;
      afterProt += mealData.options[0].totals.protein;
      afterCarbs += mealData.options[0].totals.carbs;
      afterFat += mealData.options[0].totals.fat;
    }
  }
  
  const afterTotals = {
    calories: Math.round(afterCals),
    protein: Math.round(afterProt * 10) / 10,
    carbs: Math.round(afterCarbs * 10) / 10,
    fat: Math.round(afterFat * 10) / 10,
  };
  
  log("Ajuste concluído", { 
    before: beforeTotals.calories, 
    after: afterTotals.calories,
    target: targetCalories,
    finalDiffPercent: Math.abs((afterTotals.calories - targetCalories) / targetCalories * 100).toFixed(1),
  });
  
  return {
    scaledMeals: mealsWithOptions.map(m => m.options[0]),
    scaleFactor,
    beforeTotals,
    afterTotals,
  };
}

// =====================================================
// VALIDAÇÃO ESTRUTURAL (NÃO CALÓRICA)
// =====================================================

function validateStructure(meals: MealResult[]): StructuralValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const meal of meals) {
    const limits = ITEM_COUNTS[meal.meal_type] || { min: 2, max: 6 };

    // Validar número de itens (ERRO BLOQUEANTE)
    if (meal.foods.length < limits.min) {
      errors.push(`[E1] ${meal.meal_name}: poucos itens (${meal.foods.length} < ${limits.min})`);
    }

    // Validar presença de proteína em refeições principais
    // NOTA: Isso é WARNING, não erro - o rebalanceador ajustará as quantidades
    if (MAIN_MEALS.includes(meal.meal_type)) {
      const mealProtein = meal.totals.protein;
      if (mealProtein < GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
        // WARNING: rebalanceador pode aumentar quantidade do alimento proteico
        log(`[WARN] ${meal.meal_name}: proteína baixa (${mealProtein.toFixed(1)}g), rebalanceador ajustará`);
      }
    } else {
      // Lanches/Ceia - também é apenas warning
      const mealProtein = meal.totals.protein;
      if (mealProtein < GENERATOR_CONTRACT.MIN_PROTEIN_SNACK_GRAMS) {
        log(`[WARN] ${meal.meal_name}: proteína baixa no lanche (${mealProtein.toFixed(1)}g)`);
      }
    }

    // Validar estrutura do almoço/jantar: carbo + leguminosa + proteína + vegetal (ERRO BLOQUEANTE)
    if (meal.meal_type === "lunch" || meal.meal_type === "dinner") {
      const categories = new Set(meal.foods.map((f) => (f.food.category || "").toLowerCase()));

      if (!categories.has("carboidratos")) {
        errors.push(`[E3] ${meal.meal_name}: sem carboidrato base`);
      }
      if (!categories.has("leguminosas")) {
        errors.push(`[E4] ${meal.meal_name}: sem leguminosa`);
      }
      if (!categories.has("proteinas")) {
        errors.push(`[E5] ${meal.meal_name}: sem proteína principal`);
      }
      if (!categories.has("vegetais")) {
        errors.push(`[E6] ${meal.meal_name}: sem vegetal`);
      }
    }
    
    // Validar que café da manhã tem fonte de proteína (ERRO BLOQUEANTE)
    if (meal.meal_type === "breakfast") {
      const hasProteinSource = meal.foods.some((f) => {
        const cat = (f.food.category || "").toLowerCase();
        return cat === "proteinas" || cat === "laticinios";
      });
      if (!hasProteinSource) {
        errors.push(`[E7] ${meal.meal_name}: sem fonte de proteína (proteínas ou laticínios)`);
      }
    }

    // Validar gordura obrigatória quando houver vegetal cru
    const hasVegetal = meal.foods.some((f) => (f.food.category || "").toLowerCase() === "vegetais");
    const hasGordura = meal.foods.some((f) => (f.food.category || "").toLowerCase() === "gorduras");

    if (hasVegetal && !hasGordura && (meal.meal_type === "lunch" || meal.meal_type === "dinner")) {
      log(`Atenção: ${meal.meal_name} tem vegetal mas sem gordura para temperar`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =====================================================
// VALIDAÇÃO NUTRICIONAL (USA CONTRATOS)
// =====================================================

interface NutritionalValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    caloriePercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercentOfCals: number;
  };
}

function validateNutritionalContracts(
  meals: MealResult[],
  targets: MacroTargets
): NutritionalValidation {
  // Calcular totais
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  const mealProteinValues: number[] = [];
  const mainMealIndices: number[] = [];

  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i];
    totalCals += meal.totals.calories;
    totalProt += meal.totals.protein;
    totalCarbs += meal.totals.carbs;
    totalFat += meal.totals.fat;
    mealProteinValues.push(meal.totals.protein);

    if (MAIN_MEALS.includes(meal.meal_type)) {
      mainMealIndices.push(i);
    }
  }

  const totals: MacroTargets = {
    calories: totalCals,
    protein: totalProt,
    carbs: totalCarbs,
    fat: totalFat,
  };

  // Usar validação dos contratos
  const contractValidation = validateGeneratedPlan(
    totals,
    targets,
    mealProteinValues,
    mainMealIndices
  );

  // Separar erros críticos de warnings
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const error of contractValidation.errors) {
    // Erros de proteína por refeição são warnings (gerador não fecha macros)
    if (error.includes('[G1]') && error.includes('Refeição')) {
      warnings.push(error);
    } else {
      // Outros erros são informativos para o gerador (rebalanceador corrige)
      warnings.push(error);
    }
  }

  return {
    valid: true, // Gerador sempre passa - rebalanceador corrige
    errors,
    warnings,
    metrics: contractValidation.metrics,
  };
}

// =====================================================
// SALVAR PLANO COM MÚLTIPLAS OPÇÕES
// =====================================================

interface MealWithOptions {
  mealType: string;
  options: MealResult[];
}

async function savePlanWithOptions(
  supabase: any,
  userId: string,
  mealsWithOptions: MealWithOptions[]
): Promise<string> {
  // Calcular totais do plano (baseado na primeira opção de cada refeição)
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const mealData of mealsWithOptions) {
    if (mealData.options[0]) {
      totalCals += mealData.options[0].totals.calories;
      totalProt += mealData.options[0].totals.protein;
      totalCarbs += mealData.options[0].totals.carbs;
      totalFat += mealData.options[0].totals.fat;
    }
  }

  // Arquivar planos anteriores (status válidos: draft, active, archived, completed)
  const { error: deactivateError } = await supabase
    .from("diet_plans")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  if (deactivateError) {
    log("Erro ao desativar planos anteriores", { error: deactivateError.message });
    throw new Error(`Falha ao desativar plano existente: ${deactivateError.message}`);
  }

  // Pequeno delay para garantir que a transação anterior foi commitada
  await new Promise(resolve => setTimeout(resolve, 100));

  // Criar novo plano
  const { data: dietPlan, error: planError } = await supabase
    .from("diet_plans")
    .insert({
      user_id: userId,
      status: "active",
      total_calories: totalCals,
      total_protein: totalProt,
      total_carbs: totalCarbs,
      total_fat: totalFat,
    })
    .select()
    .single();

  if (planError) {
    log("Erro ao criar plano", { error: planError.message });
    throw new Error(planError.message);
  }

  // Criar refeições com múltiplas opções
  for (let i = 0; i < mealsWithOptions.length; i++) {
    const mealWithOpts = mealsWithOptions[i];
    const firstOption = mealWithOpts.options[0];
    
    if (!firstOption) continue;

    const { data: mealData, error: mealError } = await supabase
      .from("meals")
      .insert({
        diet_plan_id: dietPlan.id,
        name: firstOption.meal_name,
        sort_order: i + 1,
        total_calories: firstOption.totals.calories,
        total_protein: firstOption.totals.protein,
        total_carbs: firstOption.totals.carbs,
        total_fat: firstOption.totals.fat,
      })
      .select()
      .single();

    if (mealError) {
      log("Erro ao criar refeição", { mealName: firstOption.meal_name, error: mealError.message });
      throw new Error(mealError.message);
    }

    // Criar todas as opções desta refeição
    for (let optIdx = 0; optIdx < mealWithOpts.options.length; optIdx++) {
      const option = mealWithOpts.options[optIdx];
      const optionNumber = optIdx + 1;
      const optionName = optionNumber === 1 ? "Opção Principal" : `Opção ${optionNumber}`;

      const { data: optionData, error: optionError } = await supabase
        .from("meal_options")
        .insert({
          meal_id: mealData.id,
          option_number: optionNumber,
          name: optionName,
          total_calories: option.totals.calories,
          total_protein: option.totals.protein,
          total_carbs: option.totals.carbs,
          total_fat: option.totals.fat,
        })
        .select()
        .single();

      if (optionError) {
        log("Erro ao criar opção", { mealName: option.meal_name, optionNumber, error: optionError.message });
        throw new Error(optionError.message);
      }

      // Adicionar alimentos desta opção
      for (const food of option.foods) {
        const { error: foodItemError } = await supabase.from("meal_option_foods").insert({
          meal_option_id: optionData.id,
          food_id: food.food.id,
          quantity_grams: food.quantity_grams,
          display_quantity: food.display_quantity,
          display_unit: food.display_unit,
          calculated_grams: food.quantity_grams,
          unit_locked: true,
        });

        if (foodItemError) {
          log("Erro ao inserir alimento", { 
            foodId: food.food.id, 
            foodName: food.food.name, 
            optionNumber,
            error: foodItemError.message 
          });
          throw new Error(foodItemError.message);
        }
      }

      log(`Opção ${optionNumber} salva para ${option.meal_name}`, { 
        foods: option.foods.length 
      });
    }
  }

  return dietPlan.id;
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    log("Iniciando geração v5", { userId: user.id });

    // Carregar perfil e limites do plano em paralelo
    const [profileResult, planLimitsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.rpc("get_user_plan", { _user_id: user.id }),
    ]);

    const { data: profile, error: profileError } = profileResult;
    if (profileError || !profile) {
      return createErrorResponse(CLIENT_ERRORS.NOT_FOUND, 404, corsHeaders);
    }

    if (!profile.onboarding_completed) {
      return createErrorResponse("Complete o onboarding primeiro", 400, corsHeaders);
    }

    // Determinar limite de opções do plano
    const planData = planLimitsResult.data?.[0];
    const mealOptionsLimit = planData?.meal_options_limit ?? 1;
    log("Limite de opções do plano", { mealOptionsLimit, planName: planData?.plan_name });

    // Determinar refeições
    const mealsPerDay = profile.meals_per_day || 4;
    const mealTypesMap: Record<number, string[]> = {
      2: ["lunch", "dinner"],
      3: ["breakfast", "lunch", "dinner"],
      4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
      5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
      6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
    };
    const mealTypes = mealTypesMap[mealsPerDay] || mealTypesMap[4];

    log("Configuração", { mealsPerDay, mealTypes, mealOptionsLimit });

    // Carregar templates e âncoras em paralelo
    const [templates, anchorFoods] = await Promise.all([
      loadTemplatesWithRoles(supabase),
      loadAnchorFoods(supabase),
    ]);
    log("Templates carregados", { count: templates.size });

    // Carregar alimentos
    const { data: allFoods, error: foodsError } = await supabase
      .from("foods")
      .select("id, name, calories, protein, carbs, fat, category, processing_level, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled")
      .eq("review_status", "approved")
      .eq("is_active", true);

    if (foodsError) throw foodsError;

    log("Alimentos carregados", { count: allFoods?.length || 0 });

    // Filtrar alimentos elegíveis
    const eligibleFoods = filterEligibleFoods(
      allFoods || [],
      profile.avoided_foods || [],
      profile.restrictions || []
    );

    log("Alimentos elegíveis", { count: eligibleFoods.length });

    // Gerar refeições com múltiplas opções
    const usedGlobalIds = new Set<string>();
    const mealsWithOptions: Array<{
      mealType: string;
      options: MealResult[];
    }> = [];

    for (const mealType of mealTypes) {
      const templateData = templates.get(mealType);

      if (!templateData) {
        log(`Template não encontrado para ${mealType}, usando fallback`);
        continue;
      }

      // Buscar âncoras para este tipo de refeição (agrupadas por role)
      const mealAnchorsByRole = anchorFoods.get(mealType) || [];
      
      log(`Âncoras para ${mealType}`, { 
        roles: mealAnchorsByRole.map(r => ({ 
          role: r.role_name, 
          count: r.anchors.length 
        })) 
      });

      const mealOptions: MealResult[] = [];
      
      // Set para rastrear alimentos usados nas opções anteriores desta refeição
      const previousOptionsUsedIds = new Set<string>();

      // Gerar N opções para esta refeição
      for (let optNum = 1; optNum <= mealOptionsLimit; optNum++) {
        const meal = buildMealWithAnchors(
          mealType,
          optNum,
          templateData,
          eligibleFoods,
          usedGlobalIds,
          profile.preferred_foods || [],
          mealAnchorsByRole,
          previousOptionsUsedIds
        );
        
        // Adicionar alimentos desta opção ao set de opções anteriores
        for (const foodSel of meal.foods) {
          previousOptionsUsedIds.add(foodSel.food.id);
        }
        
        mealOptions.push(meal);

        log(`Opção ${optNum} gerada para ${mealType}`, {
          items: meal.foods.length,
          foods: meal.foods.map(f => f.food.name),
          cals: meal.totals.calories,
        });
      }

      mealsWithOptions.push({ mealType, options: mealOptions });
      
      // Adicionar IDs da primeira opção ao global (para variar entre refeições)
      if (mealOptions[0]) {
        for (const food of mealOptions[0].foods) {
          usedGlobalIds.add(food.food.id);
        }
      }
    }

    // Para compatibilidade, extrair primeira opção de cada refeição
    let meals: MealResult[] = mealsWithOptions.map(m => m.options[0]);

    // Validar estrutura ANTES do ajuste proporcional
    const validation = validateStructure(meals);

    if (!validation.valid) {
      log("Validação estrutural falhou", { errors: validation.errors });
      return createErrorResponse(
        "Plano não atende requisitos estruturais",
        400,
        corsHeaders,
        { code: "STRUCTURAL_VALIDATION_FAILED", details: validation.errors }
      );
    }

    log("Validação estrutural OK");

    // =====================================================
    // AJUSTE PROPORCIONAL PARA FECHAR METAS CALÓRICAS
    // =====================================================
    const targets: MacroTargets = {
      calories: profile.daily_calories || 2000,
      protein: profile.protein_target || 100,
      carbs: profile.carbs_target || 250,
      fat: profile.fat_target || 65,
    };
    
    const scaleResult = scaleToCalorieTarget(
      mealsWithOptions,
      targets.calories,
      targets.protein,
      targets.carbs,
      targets.fat
    );
    
    log("Ajuste proporcional aplicado", {
      scaleFactor: scaleResult.scaleFactor.toFixed(3),
      before: scaleResult.beforeTotals,
      after: scaleResult.afterTotals,
      target: targets.calories,
    });
    
    // Atualizar referência após ajuste
    meals = mealsWithOptions.map(m => m.options[0]);

    // Validar contratos nutricionais APÓS ajuste
    const nutritionalValidation = validateNutritionalContracts(meals, targets);
    
    if (nutritionalValidation.warnings.length > 0) {
      log("Avisos nutricionais pós-ajuste", { 
        warnings: nutritionalValidation.warnings,
        metrics: nutritionalValidation.metrics 
      });
    }

    // Salvar plano com todas as opções (AGORA AJUSTADO)
    const planId = await savePlanWithOptions(supabase, user.id, mealsWithOptions);

    log("Plano salvo", { planId, optionsPerMeal: mealOptionsLimit });

    // Usar totais do resultado do ajuste
    const totalCals = scaleResult.afterTotals.calories;
    const totalProt = scaleResult.afterTotals.protein;
    const totalCarbs = scaleResult.afterTotals.carbs;
    const totalFat = scaleResult.afterTotals.fat;

    // Calcular diferença percentual final
    const finalDiffPercent = Math.abs((totalCals - targets.calories) / targets.calories * 100);
    const isWithinTolerance = finalDiffPercent <= GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT;

    return createSuccessResponse(
      {
        plan_id: planId,
        message: isWithinTolerance 
          ? `Plano gerado com ${mealOptionsLimit} opção(ões) por refeição. Calorias dentro da meta (${finalDiffPercent.toFixed(1)}% de diferença).`
          : `Plano gerado com ${mealOptionsLimit} opção(ões) por refeição. Rebalanceamento pode refinar os valores.`,
        requires_rebalancing: !isWithinTolerance,
        options_per_meal: mealOptionsLimit,
        scale_applied: scaleResult.scaleFactor !== 1,
        scale_factor: scaleResult.scaleFactor,
        totals: {
          calories: totalCals,
          protein: totalProt,
          carbs: totalCarbs,
          fat: totalFat,
        },
        targets: {
          calories: profile.daily_calories,
          protein: profile.protein_target,
          carbs: profile.carbs_target,
          fat: profile.fat_target,
        },
        difference_percent: {
          calories: finalDiffPercent.toFixed(1),
          protein: targets.protein > 0 ? ((totalProt - targets.protein) / targets.protein * 100).toFixed(1) : "0",
          carbs: targets.carbs > 0 ? ((totalCarbs - targets.carbs) / targets.carbs * 100).toFixed(1) : "0",
          fat: targets.fat > 0 ? ((totalFat - targets.fat) / targets.fat * 100).toFixed(1) : "0",
        },
        // Métricas de validação dos contratos nutricionais
        contract_metrics: nutritionalValidation.metrics,
        contract_warnings: nutritionalValidation.warnings,
        meals: mealsWithOptions.map((m) => ({
          type: m.mealType,
          name: m.options[0]?.meal_name || MEAL_NAMES[m.mealType],
          options: m.options.length,
          items_per_option: m.options.map(o => o.foods.length),
          calories: m.options[0]?.totals.calories || 0,
        })),
      },
      corsHeaders
    );
  } catch (error) {
    log("Erro fatal", { error: getErrorForLogging(error) });
    return createErrorResponse(
      CLIENT_ERRORS.SERVER_ERROR,
      500,
      corsHeaders
    );
  }
});
