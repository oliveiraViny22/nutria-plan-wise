// =====================================================
// GERADOR DE PLANO ALIMENTAR v3 - REIMPLEMENTAÇÃO LIMPA
// =====================================================
// Este módulo gera planos alimentares seguindo contratos
// rigorosos. Se o plano não atender os contratos, FALHA.
//
// CONTRATOS:
// 1. Calorias dentro de ±10% da meta
// 2. Proteína em TODAS as refeições
// 3. Carboidrato como base energética (≥90%)
// 4. Gordura ≤30% das calorias
// 5. Se inválido, FALHA (não salva)
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  getCorsHeaders, 
  CLIENT_ERRORS, 
  validate, 
  getErrorForLogging, 
  createErrorResponse, 
  createSuccessResponse 
} from "../_shared/security.ts";
import { 
  CANONICAL_CATEGORIES, 
  isValidCategory,
  MEAL_CATEGORY_PRIORITIES,
  EXCLUDED_FROM_AUTO_PLAN,
  isSubstitutableLevel,
  type FoodCategory
} from "../_shared/food-categories.ts";
import {
  GENERATOR_CONTRACT,
  KCAL_PER_GRAM,
  MacroTargets,
  validateGeneratedPlan,
  fatPercentOfCalories,
} from "../_shared/nutrition-contracts.ts";

// =====================================================
// LOGGING
// =====================================================

const logStep = (step: string, details?: unknown) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATOR-V3] ${timestamp} | ${step}${detailsStr}`);
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
  serving_size: string;
  category: string;
  processing_level: string;
  status: string;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number;
  unit_enabled: boolean;
}

interface FoodWithDisplay {
  food: Food;
  quantity_grams: number;
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
  unit_locked: boolean;
}

interface MealOption {
  option_number: number;
  name: string;
  foods: FoodWithDisplay[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

// =====================================================
// ESTRUTURA DO DIA
// =====================================================

const MEAL_TYPES = [
  'breakfast', 'morning_snack', 'lunch', 
  'afternoon_snack', 'dinner', 'supper',
] as const;

type MealType = typeof MEAL_TYPES[number];

const MEAL_NAMES: Record<MealType, string> = {
  breakfast: 'Café da Manhã',
  morning_snack: 'Lanche da Manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da Tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
};

const MAIN_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];

function buildMealSkeleton(mealsPerDay: number): MealType[] {
  switch (mealsPerDay) {
    case 2: return ['lunch', 'dinner'];
    case 3: return ['breakfast', 'lunch', 'dinner'];
    case 4: return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
    case 5: return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
    case 6: return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
    default: return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
  }
}

// =====================================================
// CONTEXTO DE REFEIÇÃO
// =====================================================

interface MealContext {
  preferred: string[];
  blocked: string[];
  proteinSources: string[];
  minProteinGrams: number;
  carbRequired: boolean;
}

const MEAL_CONTEXTS: Record<MealType, MealContext> = {
  breakfast: {
    preferred: ['pão', 'tapioca', 'aveia', 'ovo', 'queijo', 'iogurte', 'leite', 'banana', 'maçã'],
    blocked: ['feijão', 'arroz branco', 'macarrão', 'bife', 'frango grelhado', 'tilápia', 'salmão'],
    proteinSources: ['ovo', 'queijo', 'iogurte', 'leite', 'cottage', 'presunto', 'peito de peru'],
    minProteinGrams: 15,
    carbRequired: true,
  },
  morning_snack: {
    preferred: ['banana', 'maçã', 'castanha', 'iogurte', 'queijo'],
    blocked: ['arroz', 'feijão', 'macarrão', 'carne', 'frango'],
    proteinSources: ['iogurte', 'queijo', 'cottage', 'castanha', 'amendoim'],
    minProteinGrams: 5,
    carbRequired: false,
  },
  lunch: {
    preferred: ['arroz', 'feijão', 'frango', 'carne', 'peixe', 'salada', 'batata'],
    blocked: ['granola', 'cereal matinal', 'iogurte doce', 'mel'],
    proteinSources: ['frango', 'carne', 'peixe', 'bife', 'tilápia', 'salmão', 'ovo'],
    minProteinGrams: 30,
    carbRequired: true,
  },
  afternoon_snack: {
    preferred: ['banana', 'maçã', 'castanha', 'iogurte', 'pão integral'],
    blocked: ['arroz', 'feijão', 'macarrão', 'feijoada'],
    proteinSources: ['iogurte', 'queijo', 'cottage', 'ovo', 'amendoim'],
    minProteinGrams: 8,
    carbRequired: false,
  },
  dinner: {
    preferred: ['frango', 'peixe', 'carne', 'ovo', 'salada', 'arroz', 'batata'],
    blocked: ['pão francês', 'tapioca', 'granola', 'iogurte doce'],
    proteinSources: ['frango', 'peixe', 'carne', 'bife', 'ovo', 'tilápia', 'salmão'],
    minProteinGrams: 25,
    carbRequired: true,
  },
  supper: {
    preferred: ['iogurte', 'leite', 'queijo', 'banana', 'aveia', 'castanha'],
    blocked: ['arroz', 'feijão', 'macarrão', 'carne', 'frango'],
    proteinSources: ['iogurte', 'leite', 'queijo', 'cottage', 'castanha'],
    minProteinGrams: 5,
    carbRequired: false,
  },
};

// =====================================================
// DISTRIBUIÇÃO DE MACROS
// =====================================================

interface MealMacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function distributeMacros(targets: MacroTargets, meals: MealType[]): Record<MealType, MealMacroTarget> {
  const percentages: Record<MealType, number> = {
    breakfast: 0.20,
    morning_snack: 0.08,
    lunch: 0.30,
    afternoon_snack: 0.10,
    dinner: 0.25,
    supper: 0.07,
  };
  
  const totalPercent = meals.reduce((sum, m) => sum + percentages[m], 0);
  const result: Partial<Record<MealType, MealMacroTarget>> = {};
  
  for (const meal of meals) {
    const pct = percentages[meal] / totalPercent;
    const ctx = MEAL_CONTEXTS[meal];
    
    result[meal] = {
      calories: Math.round(targets.calories * pct),
      protein: Math.max(ctx.minProteinGrams, Math.round(targets.protein * pct)),
      carbs: Math.round(targets.carbs * pct),
      fat: Math.round(targets.fat * pct),
    };
  }
  
  return result as Record<MealType, MealMacroTarget>;
}

// =====================================================
// CONVERSÃO DE UNIDADES
// =====================================================

function applyUnitConversion(food: Food, grams: number): FoodWithDisplay {
  if (!food.unit_enabled || !food.unit_name || !food.unit_weight_grams) {
    return {
      food,
      quantity_grams: grams,
      display_quantity: Math.round(grams),
      display_unit: 'g',
      calculated_grams: grams,
      unit_locked: true,
    };
  }
  
  const rawUnits = grams / food.unit_weight_grams;
  const increment = food.unit_increment || 1;
  let roundedUnits = Math.round(rawUnits / increment) * increment;
  if (roundedUnits < increment) roundedUnits = increment;
  
  const finalGrams = roundedUnits * food.unit_weight_grams;
  const errorPercent = grams > 0 ? Math.abs(finalGrams - grams) / grams * 100 : 0;
  
  if (errorPercent <= 5) {
    return {
      food,
      quantity_grams: grams,
      display_quantity: roundedUnits,
      display_unit: food.unit_name,
      calculated_grams: finalGrams,
      unit_locked: true,
    };
  }
  
  return {
    food,
    quantity_grams: grams,
    display_quantity: Math.round(grams),
    display_unit: 'g',
    calculated_grams: grams,
    unit_locked: true,
  };
}

// =====================================================
// SELEÇÃO DE ALIMENTOS
// =====================================================

function fetchEligibleFoods(allFoods: Food[], restrictions: string[]): Food[] {
  return allFoods.filter(f => {
    const status = (f.status || '').toLowerCase();
    if (status !== 'approved' && status !== 'active' && status !== '') return false;
    
    const category = (f.category || '').toLowerCase();
    if (!isValidCategory(category) || EXCLUDED_FROM_AUTO_PLAN.includes(category as FoodCategory)) {
      return false;
    }
    
    if (!isSubstitutableLevel(f.processing_level)) return false;
    
    const name = f.name.toLowerCase();
    return !restrictions.some(r => {
      const rest = r.toLowerCase();
      if (rest.includes('lactose') && category === 'laticinios') return true;
      if (rest.includes('gluten') && (name.includes('trigo') || name.includes('pão') || name.includes('macarrão'))) return true;
      if (rest.includes('vegetariano') && category === 'proteinas' && !name.includes('ovo')) return true;
      if (rest.includes('vegano') && (category === 'proteinas' || category === 'laticinios')) return true;
      return name.includes(rest);
    });
  });
}

function isFoodBlocked(food: Food, mealType: MealType): boolean {
  const ctx = MEAL_CONTEXTS[mealType];
  const name = food.name.toLowerCase();
  return ctx.blocked.some(kw => name.includes(kw.toLowerCase()));
}

function findProteinSource(
  foods: Food[],
  mealType: MealType,
  usedIds: Set<string>,
  preferences: string[]
): Food | null {
  const ctx = MEAL_CONTEXTS[mealType];
  
  const candidates = foods.filter(f => {
    if (usedIds.has(f.id)) return false;
    if (isFoodBlocked(f, mealType)) return false;
    
    const category = (f.category || '').toLowerCase();
    const name = f.name.toLowerCase();
    
    if (category !== 'proteinas' && category !== 'laticinios') return false;
    
    return ctx.proteinSources.some(kw => name.includes(kw.toLowerCase()));
  });
  
  if (candidates.length === 0) return null;
  
  const preferred = candidates.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

function findCarbSource(
  foods: Food[],
  mealType: MealType,
  usedIds: Set<string>,
  preferences: string[]
): Food | null {
  const candidates = foods.filter(f => {
    if (usedIds.has(f.id)) return false;
    if (isFoodBlocked(f, mealType)) return false;
    
    const category = (f.category || '').toLowerCase();
    if (category !== 'carboidratos' && category !== 'leguminosas') return false;
    
    // Mínimo 15g carbs/100g
    return f.carbs >= 15;
  });
  
  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => b.carbs - a.carbs);
  
  const top = candidates.slice(0, Math.min(5, candidates.length));
  const preferred = top.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : top;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickFoodFromCategory(
  foods: Food[],
  category: FoodCategory,
  mealType: MealType,
  usedIds: Set<string>,
  preferences: string[]
): Food | null {
  const candidates = foods.filter(f => {
    if (usedIds.has(f.id)) return false;
    if (isFoodBlocked(f, mealType)) return false;
    return (f.category || '').toLowerCase() === category;
  });
  
  if (candidates.length === 0) return null;
  
  const preferred = candidates.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

// =====================================================
// CÁLCULO DE PORÇÕES (COM CONTROLE CALÓRICO)
// =====================================================

function calculatePortion(
  food: Food,
  target: MealMacroTarget,
  accumulatedCalories: number,
  role: 'protein' | 'carb' | 'other'
): number {
  const calPerGram = food.calories / 100;
  const remainingCalories = Math.max(0, target.calories - accumulatedCalories);
  
  // Máximo permitido por calorias restantes
  const maxByCalories = calPerGram > 0 ? (remainingCalories / calPerGram) * 100 : 200;
  
  let basePortion: number;
  
  if (role === 'protein') {
    // Calcular porção para atingir proteína mínima
    const proteinPerGram = food.protein / 100;
    basePortion = proteinPerGram > 0 ? (target.protein / proteinPerGram) * 100 : 120;
    basePortion = Math.min(basePortion, 200); // Max 200g proteína
  } else if (role === 'carb') {
    // Calcular porção para cobrir 60% dos carbs
    const carbsPerGram = food.carbs / 100;
    const targetCarbs = target.carbs * 0.6;
    basePortion = carbsPerGram > 0 ? (targetCarbs / carbsPerGram) * 100 : 150;
    basePortion = Math.min(basePortion, 300); // Max 300g carb
  } else {
    // Porção padrão baseada na categoria
    const category = (food.category || '').toLowerCase();
    const defaults: Record<string, number> = {
      proteinas: 100,
      carboidratos: 120,
      gorduras: 15,
      vegetais: 80,
      frutas: 100,
      laticinios: 150,
      leguminosas: 80,
      mistos: 100,
    };
    basePortion = defaults[category] || 80;
  }
  
  // Limitar pelo orçamento calórico
  let portion = Math.min(basePortion, maxByCalories);
  
  // Arredondar para 5g
  portion = Math.round(portion / 5) * 5;
  
  // Limites absolutos
  return Math.max(20, Math.min(400, portion));
}

// =====================================================
// MONTAGEM DA REFEIÇÃO
// =====================================================

interface MealBuildResult {
  success: boolean;
  option?: MealOption;
  error?: string;
  actualProtein?: number;
}

function buildMealOption(
  foods: Food[],
  mealType: MealType,
  target: MealMacroTarget,
  preferences: string[],
  usedFoodIds: Set<string>,
  optionNumber: number
): MealBuildResult {
  const ctx = MEAL_CONTEXTS[mealType];
  const mealFoods: FoodWithDisplay[] = [];
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  
  // PASSO 1: Proteína (OBRIGATÓRIA)
  const proteinSource = findProteinSource(foods, mealType, usedFoodIds, preferences);
  if (!proteinSource) {
    return { success: false, error: `Sem proteína para ${MEAL_NAMES[mealType]}` };
  }
  
  usedFoodIds.add(proteinSource.id);
  const proteinPortion = calculatePortion(proteinSource, target, totalCals, 'protein');
  const proteinConverted = applyUnitConversion(proteinSource, proteinPortion);
  
  const mult1 = proteinConverted.calculated_grams / 100;
  totalCals += proteinSource.calories * mult1;
  totalProt += proteinSource.protein * mult1;
  totalCarbs += proteinSource.carbs * mult1;
  totalFat += proteinSource.fat * mult1;
  mealFoods.push(proteinConverted);
  
  // PASSO 2: Carboidrato (se refeição principal)
  if (ctx.carbRequired) {
    const carbSource = findCarbSource(foods, mealType, usedFoodIds, preferences);
    if (carbSource) {
      usedFoodIds.add(carbSource.id);
      const carbPortion = calculatePortion(carbSource, target, totalCals, 'carb');
      const carbConverted = applyUnitConversion(carbSource, carbPortion);
      
      const mult2 = carbConverted.calculated_grams / 100;
      totalCals += carbSource.calories * mult2;
      totalProt += carbSource.protein * mult2;
      totalCarbs += carbSource.carbs * mult2;
      totalFat += carbSource.fat * mult2;
      mealFoods.push(carbConverted);
    }
  }
  
  // PASSO 3: Complementos (vegetais, frutas)
  const remainingBudget = target.calories - totalCals;
  if (remainingBudget > 30) {
    const categoryPriorities = MEAL_CATEGORY_PRIORITIES[mealType] || 
                               MEAL_CATEGORY_PRIORITIES[MEAL_NAMES[mealType]] || 
                               ['vegetais', 'frutas'];
    
    for (const cat of categoryPriorities) {
      if (target.calories - totalCals < 30) break;
      if (cat === 'proteinas' || cat === 'carboidratos' || cat === 'leguminosas') continue;
      
      const food = pickFoodFromCategory(foods, cat as FoodCategory, mealType, usedFoodIds, preferences);
      if (!food) continue;
      
      usedFoodIds.add(food.id);
      const portion = calculatePortion(food, target, totalCals, 'other');
      const converted = applyUnitConversion(food, portion);
      
      const mult = converted.calculated_grams / 100;
      totalCals += food.calories * mult;
      totalProt += food.protein * mult;
      totalCarbs += food.carbs * mult;
      totalFat += food.fat * mult;
      mealFoods.push(converted);
    }
  }
  
  return {
    success: true,
    actualProtein: totalProt,
    option: {
      option_number: optionNumber,
      name: optionNumber === 1 ? 'Opção Principal' : `Opção ${optionNumber}`,
      foods: mealFoods,
      total_calories: Math.round(totalCals),
      total_protein: Math.round(totalProt * 10) / 10,
      total_carbs: Math.round(totalCarbs * 10) / 10,
      total_fat: Math.round(totalFat * 10) / 10,
    },
  };
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
    logStep("Generator v3 started");
    
    // Parse input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!validate.isObject(body)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const { profile, studentId, isInitialPlan } = body as { 
      profile: unknown; 
      studentId?: unknown; 
      isInitialPlan?: boolean 
    };
    
    if (!validate.isObject(profile)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const profileData = profile as Record<string, unknown>;
    
    // Construir targets
    const targets: MacroTargets = {
      calories: validate.isInRange(profileData.daily_calories, 500, 10000) 
        ? profileData.daily_calories as number : 0,
      protein: validate.isInRange(profileData.protein_target, 0, 500) 
        ? profileData.protein_target as number : 0,
      carbs: validate.isInRange(profileData.carbs_target, 0, 1000) 
        ? profileData.carbs_target as number : 0,
      fat: validate.isInRange(profileData.fat_target, 0, 300) 
        ? profileData.fat_target as number : 0,
    };
    
    if (targets.calories <= 0) {
      return createErrorResponse("Metas nutricionais inválidas", 400, corsHeaders);
    }
    
    const mealsPerDay = validate.isInRange(profileData.meals_per_day, 2, 6) 
      ? profileData.meals_per_day as number : 4;
    
    const preferences = validate.isArray(profileData.preferences)
      ? (profileData.preferences as unknown[]).filter(validate.isString).slice(0, 20) as string[]
      : [];
    const restrictions = validate.isArray(profileData.restrictions)
      ? (profileData.restrictions as unknown[]).filter(validate.isString).slice(0, 20) as string[]
      : [];
    
    const validStudentId = validate.isString(studentId) && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId as string)
      ? studentId as string : null;
    
    logStep("Input validated", { calories: targets.calories, mealsPerDay });
    
    // Autenticação
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }
    
    let targetUserId = user.id;
    
    // Verificar acesso a aluno
    if (validStudentId) {
      const { data: linkData, error: linkError } = await supabase
        .from('professional_students')
        .select('id')
        .eq('professional_id', user.id)
        .eq('student_id', validStudentId)
        .eq('status', 'active')
        .single();
      
      if (linkError || !linkData) {
        return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
      }
      
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'professional',
      });
      
      if (!hasRole) {
        return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
      }
      
      targetUserId = validStudentId;
    }
    
    // Verificar limite de uso
    if (isInitialPlan !== true) {
      const { data: canUse } = await supabase.rpc('can_use_feature', {
        _user_id: user.id,
        _feature: 'diet',
      });

      if (!canUse) {
        return createErrorResponse(CLIENT_ERRORS.USAGE_LIMIT, 403, corsHeaders, { upgradeRequired: true });
      }
    }
    
    // Buscar limite de opções
    const { data: userPlanData } = await supabase.rpc('get_user_plan', { _user_id: user.id });
    const mealOptionsLimit = userPlanData?.[0]?.meal_options_limit ?? 1;
    
    // Buscar alimentos
    const { data: allFoods, error: foodsError } = await supabase.from("foods").select("*");
    if (foodsError || !allFoods || allFoods.length === 0) {
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }
    
    const eligibleFoods = fetchEligibleFoods(allFoods as Food[], restrictions);
    logStep("Eligible foods", { total: allFoods.length, eligible: eligibleFoods.length });
    
    if (eligibleFoods.length < 10) {
      return createErrorResponse("Poucos alimentos disponíveis após restrições", 400, corsHeaders);
    }
    
    // Estrutura do dia
    const mealSkeleton = buildMealSkeleton(mealsPerDay);
    const mealTargets = distributeMacros(targets, mealSkeleton);
    
    // Gerar refeições
    const generatedMeals: Array<{ 
      name: string; 
      mealType: MealType;
      options: MealOption[];
      sortOrder: number;
    }> = [];
    
    const buildErrors: string[] = [];
    const mealProteinValues: number[] = [];
    const mainMealIndices: number[] = [];
    
    for (let sortOrder = 0; sortOrder < mealSkeleton.length; sortOrder++) {
      const mealType = mealSkeleton[sortOrder];
      const target = mealTargets[mealType];
      const options: MealOption[] = [];
      const usedFoodIds = new Set<string>();
      
      // Opção principal
      const result = buildMealOption(eligibleFoods, mealType, target, preferences, usedFoodIds, 1);
      
      if (!result.success || !result.option) {
        buildErrors.push(result.error || `Falha em ${MEAL_NAMES[mealType]}`);
        continue;
      }
      
      options.push(result.option);
      mealProteinValues.push(result.actualProtein || 0);
      
      if (MAIN_MEALS.includes(mealType)) {
        mainMealIndices.push(sortOrder);
      }
      
      // Opções alternativas
      for (let optNum = 2; optNum <= mealOptionsLimit; optNum++) {
        const altResult = buildMealOption(eligibleFoods, mealType, target, preferences, usedFoodIds, optNum);
        if (altResult.success && altResult.option) {
          options.push(altResult.option);
        }
      }
      
      generatedMeals.push({
        name: MEAL_NAMES[mealType],
        mealType,
        options,
        sortOrder,
      });
    }
    
    // Falha estrutural
    if (buildErrors.length > 0) {
      logStep("Build failed", { errors: buildErrors });
      return createErrorResponse(`Falha estrutural: ${buildErrors.join("; ")}`, 400, corsHeaders);
    }
    
    // Calcular totais
    const totals: MacroTargets = {
      calories: generatedMeals.reduce((s, m) => s + (m.options[0]?.total_calories || 0), 0),
      protein: generatedMeals.reduce((s, m) => s + (m.options[0]?.total_protein || 0), 0),
      carbs: generatedMeals.reduce((s, m) => s + (m.options[0]?.total_carbs || 0), 0),
      fat: generatedMeals.reduce((s, m) => s + (m.options[0]?.total_fat || 0), 0),
    };
    
    // VALIDAÇÃO FINAL (CONTRATO)
    const validation = validateGeneratedPlan(totals, targets, mealProteinValues, mainMealIndices);
    
    logStep("Plan validation", { 
      isValid: validation.isValid, 
      metrics: validation.metrics,
      errors: validation.errors,
    });
    
    // SE INVÁLIDO, NÃO SALVAR
    if (!validation.isValid) {
      return createErrorResponse(
        `Plano não atende contratos: ${validation.errors.join("; ")}`, 
        400, 
        corsHeaders,
        { validation }
      );
    }
    
    // Salvar plano
    const { data: plan, error: planError } = await supabase.from("diet_plans").insert({
      user_id: targetUserId,
      total_calories: Math.round(totals.calories),
      total_protein: Math.round(totals.protein * 10) / 10,
      total_carbs: Math.round(totals.carbs * 10) / 10,
      total_fat: Math.round(totals.fat * 10) / 10,
      status: 'draft',
    }).select().single();

    if (planError || !plan) {
      logStep("Failed to create plan", { error: planError?.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }
    
    // Incrementar uso
    if (isInitialPlan !== true) {
      await supabase.rpc('increment_usage', { _user_id: user.id, _feature: 'diet' });
    }

    // Salvar refeições
    for (const meal of generatedMeals) {
      const { data: savedMeal, error: mealError } = await supabase.from("meals").insert({
        diet_plan_id: plan.id,
        name: meal.name,
        sort_order: meal.sortOrder,
        total_calories: meal.options[0]?.total_calories || 0,
        total_protein: meal.options[0]?.total_protein || 0,
        total_carbs: meal.options[0]?.total_carbs || 0,
        total_fat: meal.options[0]?.total_fat || 0,
      }).select().single();
      
      if (mealError || !savedMeal) continue;

      for (const option of meal.options) {
        const { data: savedOption, error: optionError } = await supabase.from("meal_options").insert({
          meal_id: savedMeal.id,
          option_number: option.option_number,
          name: option.name,
          total_calories: option.total_calories,
          total_protein: option.total_protein,
          total_carbs: option.total_carbs,
          total_fat: option.total_fat,
        }).select().single();

        if (optionError || !savedOption) continue;

        for (const foodItem of option.foods) {
          await supabase.from("meal_option_foods").insert({ 
            meal_option_id: savedOption.id, 
            food_id: foodItem.food.id, 
            quantity_grams: foodItem.quantity_grams,
            display_quantity: foodItem.display_quantity,
            display_unit: foodItem.display_unit,
            calculated_grams: foodItem.calculated_grams,
            unit_locked: foodItem.unit_locked,
          });
        }
      }
    }
    
    logStep("Plan saved successfully", { planId: plan.id, ...validation.metrics });

    return createSuccessResponse({ 
      success: true, 
      plan,
      validation: { metrics: validation.metrics },
    }, corsHeaders);
    
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
