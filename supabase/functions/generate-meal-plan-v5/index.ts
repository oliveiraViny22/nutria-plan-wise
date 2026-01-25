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

// =====================================================
// CARREGAR ALIMENTOS-ÂNCORA
// =====================================================

async function loadAnchorFoods(
  supabase: any
): Promise<Map<string, AnchorFood[]>> {
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

  // Agrupar por meal_type + option_number
  const result = new Map<string, AnchorFood[]>();
  for (const anchor of anchors || []) {
    const key = `${anchor.meal_type}-${anchor.option_number}`;
    if (!result.has(key)) {
      result.set(key, []);
    }
    result.get(key)!.push(anchor);
  }

  log("Âncoras carregadas", { count: anchors?.length || 0 });
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

    // Excluir alimentos rejeitados explicitamente
    const nameLower = f.name.toLowerCase();
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
// CALCULAR QUANTIDADE APROXIMADA
// =====================================================

function calculateApproximateQuantity(role: TemplateRole): number {
  // Usar média entre min e max, com leve randomização
  const mid = (role.min_quantity_grams + role.max_quantity_grams) / 2;
  const variance = (role.max_quantity_grams - role.min_quantity_grams) * 0.2;
  const quantity = mid + (Math.random() - 0.5) * variance;

  // Arredondar para 5g
  return Math.round(quantity / 5) * 5;
}

// =====================================================
// MONTAR REFEIÇÃO COM ÂNCORAS
// =====================================================

function buildMealWithAnchors(
  mealType: string,
  optionNumber: number,
  templateData: { template: MealTemplate; roles: TemplateRole[] },
  eligibleFoods: Food[],
  usedGlobalIds: Set<string>,
  preferredFoods: string[],
  anchors: AnchorFood[]
): MealResult {
  const { template, roles } = templateData;
  const foods: FoodSelection[] = [];
  const usedInMeal = new Set<string>();
  const filledRoles = new Set<string>();

  // PASSO 1: Aplicar alimentos-âncora primeiro
  for (const anchor of anchors) {
    if (!anchor.food) continue;

    const conversion = applyUnitConversion(anchor.food, anchor.default_quantity_grams);
    foods.push({
      food: anchor.food,
      role_name: anchor.role_name,
      quantity_grams: conversion.calculated_grams,
      display_quantity: conversion.display_quantity,
      display_unit: conversion.display_unit,
    });

    usedInMeal.add(anchor.food.id);
    filledRoles.add(anchor.role_name);
    log(`Âncora aplicada`, { mealType, food: anchor.food.name, role: anchor.role_name });
  }

  // PASSO 2: Processar papéis obrigatórios NÃO preenchidos por âncoras
  const requiredRoles = roles.filter((r) => r.is_required && !filledRoles.has(r.role_name));
  const optionalRoles = roles.filter((r) => !r.is_required && !filledRoles.has(r.role_name));

  for (const role of requiredRoles) {
    const food = selectFoodForRole(role, eligibleFoods, new Set([...usedGlobalIds, ...usedInMeal]), preferredFoods);

    if (food) {
      const quantity = calculateApproximateQuantity(role);
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

  // Processar papéis opcionais se houver espaço
  const itemLimits = ITEM_COUNTS[mealType] || { min: 2, max: 4 };
  const remainingSlots = itemLimits.max - foods.length;

  for (let i = 0; i < Math.min(optionalRoles.length, remainingSlots); i++) {
    const role = optionalRoles[i];
    const food = selectFoodForRole(role, eligibleFoods, new Set([...usedGlobalIds, ...usedInMeal]), preferredFoods);

    if (food) {
      const quantity = calculateApproximateQuantity(role);
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

  // Adicionar alimentos usados ao conjunto global
  for (const id of usedInMeal) {
    usedGlobalIds.add(id);
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
// VALIDAÇÃO ESTRUTURAL (NÃO CALÓRICA)
// =====================================================

function validateStructure(meals: MealResult[]): StructuralValidation {
  const errors: string[] = [];

  for (const meal of meals) {
    const limits = ITEM_COUNTS[meal.meal_type] || { min: 2, max: 6 };

    // Validar número de itens
    if (meal.foods.length < limits.min) {
      errors.push(`[E1] ${meal.meal_name}: poucos itens (${meal.foods.length} < ${limits.min})`);
    }

    // Validar presença de proteína em refeições principais
    if (MAIN_MEALS.includes(meal.meal_type)) {
      const hasProtein = meal.foods.some((f) => {
        const cat = (f.food.category || "").toLowerCase();
        return cat === "proteinas" || cat === "laticinios";
      });

      if (!hasProtein) {
        errors.push(`[E2] ${meal.meal_name}: sem proteína`);
      }
    }

    // Validar estrutura do almoço/jantar: carbo + leguminosa + proteína + vegetal
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
// SALVAR PLANO
// =====================================================

async function savePlan(
  supabase: any,
  userId: string,
  meals: MealResult[]
): Promise<string> {
  // Calcular totais do plano
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const meal of meals) {
    totalCals += meal.totals.calories;
    totalProt += meal.totals.protein;
    totalCarbs += meal.totals.carbs;
    totalFat += meal.totals.fat;
  }

  // Desativar planos anteriores
  await supabase
    .from("diet_plans")
    .update({ status: "inactive" })
    .eq("user_id", userId)
    .eq("status", "active");

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

  // Criar refeições
  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i];

    const { data: mealData, error: mealError } = await supabase
      .from("meals")
      .insert({
        diet_plan_id: dietPlan.id,
        name: meal.meal_name,
        sort_order: i + 1,
        total_calories: meal.totals.calories,
        total_protein: meal.totals.protein,
        total_carbs: meal.totals.carbs,
        total_fat: meal.totals.fat,
      })
      .select()
      .single();

    if (mealError) {
      log("Erro ao criar refeição", { mealName: meal.meal_name, error: mealError.message });
      throw new Error(mealError.message);
    }

    // Criar opção de refeição
    const { data: optionData, error: optionError } = await supabase
      .from("meal_options")
      .insert({
        meal_id: mealData.id,
        option_number: 1,
        name: "Opção Principal",
        total_calories: meal.totals.calories,
        total_protein: meal.totals.protein,
        total_carbs: meal.totals.carbs,
        total_fat: meal.totals.fat,
      })
      .select()
      .single();

    if (optionError) {
      log("Erro ao criar opção", { mealName: meal.meal_name, error: optionError.message });
      throw new Error(optionError.message);
    }

    // Adicionar alimentos
    for (const food of meal.foods) {
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
        log("Erro ao inserir alimento", { foodId: food.food.id, foodName: food.food.name, error: foodItemError.message });
        throw new Error(foodItemError.message);
      }
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

    // Carregar perfil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return createErrorResponse(CLIENT_ERRORS.NOT_FOUND, 404, corsHeaders);
    }

    if (!profile.onboarding_completed) {
      return createErrorResponse("Complete o onboarding primeiro", 400, corsHeaders);
    }

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

    log("Configuração", { mealsPerDay, mealTypes });

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

    // Gerar refeições
    const usedGlobalIds = new Set<string>();
    const meals: MealResult[] = [];

    for (const mealType of mealTypes) {
      const templateData = templates.get(mealType);

      if (!templateData) {
        log(`Template não encontrado para ${mealType}, usando fallback`);
        continue;
      }

      // Obter âncoras para esta refeição (opção 1)
      const mealAnchors = anchorFoods.get(`${mealType}-1`) || [];

      const meal = buildMealWithAnchors(
        mealType,
        1, // opção 1 usa âncoras
        templateData,
        eligibleFoods,
        usedGlobalIds,
        profile.preferred_foods || [],
        mealAnchors
      );
      meals.push(meal);

      log(`Refeição gerada`, {
        type: mealType,
        items: meal.foods.length,
        anchors: mealAnchors.length,
        cals: meal.totals.calories,
      });
    }

    // Validar estrutura
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

    // Salvar plano (NÃO ajustado - será feito pelo rebalanceador)
    const planId = await savePlan(supabase, user.id, meals);

    log("Plano salvo", { planId });

    // Calcular totais finais
    let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
    for (const meal of meals) {
      totalCals += meal.totals.calories;
      totalProt += meal.totals.protein;
      totalCarbs += meal.totals.carbs;
      totalFat += meal.totals.fat;
    }

    return createSuccessResponse(
      {
        plan_id: planId,
        message: "Plano estrutural gerado. Execute o rebalanceador para ajustar macros.",
        requires_rebalancing: true,
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
        meals: meals.map((m) => ({
          type: m.meal_type,
          name: m.meal_name,
          items: m.foods.length,
          calories: m.totals.calories,
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
