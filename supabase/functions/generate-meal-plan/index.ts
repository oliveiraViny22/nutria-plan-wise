// ============================================================
// GERADOR DE PLANO ALIMENTAR - VERSÃO CANÔNICA
// ============================================================
// RESPONSABILIDADE: Criar a PRIMEIRA versão do plano.
// NÃO otimiza continuamente (isso é do rebalanceador).
// NÃO usa IA para cálculos - é puramente heurístico.
// ============================================================

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
  LOW_CALORIC_IMPACT,
  SUBSTITUTABLE_PROCESSING_LEVELS,
  isSubstitutableLevel,
  type FoodCategory
} from "../_shared/food-categories.ts";

// ============================================================
// LOGGING
// ============================================================

const logStep = (step: string, details?: unknown) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-MEAL-PLAN] ${timestamp} | ${step}${detailsStr}`);
};

// ============================================================
// INTERFACES (LINHAS 1-30 DA SPEC)
// ============================================================

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
  // Campos de conversão de unidades
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

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface GeneratorInput {
  targetUserId: string;
  targets: MacroTargets;
  mealsPerDay: number;
  preferences: string[];
  restrictions: string[];
  goal: string;
  mealOptionsLimit: number;
}

// ============================================================
// VALIDAÇÕES INICIAIS (LINHAS 1-30 DA SPEC)
// ============================================================

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function assertValidTargets(targets: MacroTargets): ValidationResult {
  if (targets.calories <= 0 || targets.calories > 10000) {
    return { valid: false, error: "Calorias devem estar entre 1 e 10000" };
  }
  if (targets.protein < 0 || targets.protein > 500) {
    return { valid: false, error: "Proteína deve estar entre 0 e 500g" };
  }
  if (targets.carbs < 0 || targets.carbs > 1000) {
    return { valid: false, error: "Carboidratos devem estar entre 0 e 1000g" };
  }
  if (targets.fat < 0 || targets.fat > 300) {
    return { valid: false, error: "Gordura deve estar entre 0 e 300g" };
  }
  
  // Coerência de macros (soma aproximada das calorias)
  const calculatedCals = (targets.protein * 4) + (targets.carbs * 4) + (targets.fat * 9);
  const tolerance = targets.calories * 0.15;
  if (Math.abs(calculatedCals - targets.calories) > tolerance) {
    logStep("Warning: macro sum doesn't match calories", { calculatedCals, targetCals: targets.calories });
    // Não invalida, apenas avisa
  }
  
  return { valid: true };
}

function assertValidPreferences(preferences: string[], restrictions: string[]): ValidationResult {
  // Verifica se preferências e restrições são arrays de strings válidas
  if (!Array.isArray(preferences) || !Array.isArray(restrictions)) {
    return { valid: false, error: "Preferências e restrições devem ser arrays" };
  }
  return { valid: true };
}

// ============================================================
// DEFINIÇÃO DA ESTRUTURA DO DIA (LINHAS 30-60 DA SPEC)
// ============================================================

const MEAL_TYPES = [
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
  'supper',
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

function buildMealSkeleton(mealsPerDay: number): MealType[] {
  switch (mealsPerDay) {
    case 2:
      return ['lunch', 'dinner'];
    case 3:
      return ['breakfast', 'lunch', 'dinner'];
    case 4:
      return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
    case 5:
      return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
    case 6:
      return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
    default:
      return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
  }
}

// ============================================================
// DISTRIBUIÇÃO DE MACROS POR REFEIÇÃO (LINHAS 60-90 DA SPEC)
// Regras: soma = target total, proteína bem distribuída
// ============================================================

interface MealMacroDistribution {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function distributeMacros(
  targets: MacroTargets, 
  meals: MealType[]
): Record<MealType, MealMacroDistribution> {
  // Percentuais fixos baseados no tipo de refeição
  const percentages: Record<MealType, number> = {
    breakfast: 0.20,
    morning_snack: 0.08,
    lunch: 0.30,
    afternoon_snack: 0.10,
    dinner: 0.25,
    supper: 0.07,
  };
  
  // Ajusta percentuais para somar 100% apenas para as refeições selecionadas
  const activeMeals = meals.filter(m => percentages[m] > 0);
  const totalPercent = activeMeals.reduce((sum, m) => sum + percentages[m], 0);
  
  const result: Partial<Record<MealType, MealMacroDistribution>> = {};
  
  for (const meal of meals) {
    const adjustedPercent = percentages[meal] / totalPercent;
    result[meal] = {
      calories: Math.round(targets.calories * adjustedPercent),
      protein: Math.round(targets.protein * adjustedPercent),
      carbs: Math.round(targets.carbs * adjustedPercent),
      fat: Math.round(targets.fat * adjustedPercent),
    };
  }
  
  return result as Record<MealType, MealMacroDistribution>;
}

// ============================================================
// CONVERSÃO DETERMINÍSTICA DE UNIDADES
// Princípio: Gramas são verdade nutricional, unidades são apresentação
// ============================================================

function convertGramsToUnit(
  grams: number,
  unitWeightGrams: number | null,
  unitIncrement: number = 1,
  tolerancePercent: number = 5
): { success: boolean; displayQty: number; displayUnit: string; calculatedGrams: number } {
  if (!unitWeightGrams || unitWeightGrams <= 0) {
    return {
      success: false,
      displayQty: Math.round(grams),
      displayUnit: 'g',
      calculatedGrams: grams,
    };
  }

  const rawUnits = grams / unitWeightGrams;
  let roundedUnits = Math.round(rawUnits / (unitIncrement || 1)) * (unitIncrement || 1);

  if (roundedUnits < (unitIncrement || 1)) {
    roundedUnits = unitIncrement || 1;
  }

  const finalGrams = roundedUnits * unitWeightGrams;
  const errorPercent = grams > 0 ? Math.abs(finalGrams - grams) / grams * 100 : 0;

  if (errorPercent <= tolerancePercent) {
    return {
      success: true,
      displayQty: roundedUnits,
      displayUnit: '', // Será preenchido com unit_name
      calculatedGrams: finalGrams,
    };
  } else {
    return {
      success: false,
      displayQty: Math.round(grams),
      displayUnit: 'g',
      calculatedGrams: grams,
    };
  }
}

function applyUnitConversion(food: Food, quantityGrams: number): FoodWithDisplay {
  if (!food.unit_enabled || !food.unit_name) {
    return {
      food,
      quantity_grams: quantityGrams,
      display_quantity: Math.round(quantityGrams),
      display_unit: 'g',
      calculated_grams: quantityGrams,
      unit_locked: true,
    };
  }

  const result = convertGramsToUnit(
    quantityGrams,
    food.unit_weight_grams,
    food.unit_increment,
    5
  );

  return {
    food,
    quantity_grams: quantityGrams,
    display_quantity: result.displayQty,
    display_unit: result.success ? food.unit_name : 'g',
    calculated_grams: result.calculatedGrams,
    unit_locked: true,
  };
}

// ============================================================
// SELEÇÃO DE ALIMENTOS (LINHAS 90-130 DA SPEC)
// REGRA CRÍTICA: Apenas categorias canônicas, apenas approved + active
// ============================================================

/**
 * Definição de contexto de refeição para filtragem inteligente
 * Alimentos são filtrados baseado em palavras-chave apropriadas para cada tipo de refeição
 */
interface MealContext {
  preferred: string[];  // Palavras-chave que indicam alimentos preferidos
  avoided: string[];    // Palavras-chave que indicam alimentos a evitar
}

const MEAL_CONTEXT_RULES: Record<string, MealContext> = {
  // Café da manhã: pães, cereais, frutas, laticínios, ovos
  breakfast: {
    preferred: [
      'pão', 'tapioca', 'aveia', 'granola', 'cereal', 'biscoito', 'torrada',
      'ovo', 'queijo', 'iogurte', 'leite', 'manteiga', 'requeijão', 'cream cheese',
      'banana', 'maçã', 'mamão', 'morango', 'laranja', 'melão', 'manga',
      'mel', 'geleia', 'cuscuz', 'mingau', 'café', 'chocolate',
      'presunto', 'peito de peru', 'cottage'
    ],
    avoided: [
      'feijão', 'arroz', 'macarrão', 'lasanha', 'strogonoff', 'feijoada',
      'bife', 'frango grelhado', 'carne moída', 'almôndega', 'file', 'costela',
      'salada', 'alface', 'tomate', 'pepino', 'brócolis', 'couve',
      'batata doce', 'mandioca', 'inhame', 'purê', 'farofa'
    ]
  },
  // Lanche da manhã: frutas, oleaginosas, laticínios leves
  morning_snack: {
    preferred: [
      'banana', 'maçã', 'pera', 'uva', 'morango', 'mamão', 'melão', 'laranja',
      'castanha', 'amêndoa', 'nozes', 'amendoim', 'mix de nuts',
      'iogurte', 'queijo', 'cottage', 'whey',
      'barra de cereal', 'granola', 'aveia'
    ],
    avoided: [
      'arroz', 'feijão', 'macarrão', 'carne', 'frango', 'peixe', 'bife',
      'batata', 'mandioca', 'purê', 'salada completa'
    ]
  },
  // Almoço: refeição completa com proteína, carboidrato, leguminosas, vegetais
  lunch: {
    preferred: [
      'arroz', 'feijão', 'lentilha', 'grão-de-bico', 'macarrão', 'nhoque',
      'frango', 'carne', 'peixe', 'bife', 'filé', 'costela', 'lombo', 'alcatra',
      'tilápia', 'salmão', 'atum', 'sardinha', 'camarão',
      'salada', 'alface', 'tomate', 'pepino', 'cenoura', 'brócolis', 'couve',
      'batata doce', 'batata inglesa', 'mandioca', 'inhame', 'purê',
      'farofa', 'vinagrete', 'legumes'
    ],
    avoided: [
      'pão', 'tapioca', 'granola', 'cereal matinal', 'mingau',
      'iogurte doce', 'mel', 'geleia', 'biscoito doce'
    ]
  },
  // Lanche da tarde: similar ao lanche da manhã, com opções leves
  afternoon_snack: {
    preferred: [
      'banana', 'maçã', 'pera', 'uva', 'morango', 'mamão', 'abacate',
      'castanha', 'amêndoa', 'nozes', 'amendoim', 'pasta de amendoim',
      'iogurte', 'queijo', 'cottage', 'whey',
      'pão integral', 'tapioca', 'crepioca', 'wrap',
      'sanduíche', 'vitamina', 'smoothie'
    ],
    avoided: [
      'arroz', 'feijão', 'macarrão', 'carne grelhada', 'feijoada',
      'batata doce', 'mandioca', 'purê'
    ]
  },
  // Jantar: similar ao almoço, mas pode ser mais leve
  dinner: {
    preferred: [
      'frango', 'peixe', 'carne', 'bife', 'filé', 'omelete', 'ovo',
      'tilápia', 'salmão', 'atum',
      'salada', 'alface', 'tomate', 'pepino', 'brócolis', 'abobrinha', 'legumes',
      'arroz', 'batata doce', 'purê', 'quinoa',
      'sopa', 'caldo', 'creme'
    ],
    avoided: [
      'pão francês', 'tapioca', 'granola', 'cereal matinal',
      'iogurte doce', 'mel', 'geleia', 'biscoito doce', 'mingau',
      'feijão', 'feijoada' // jantar geralmente mais leve, sem feijão pesado
    ]
  },
  // Ceia: leve, laticínios, frutas
  supper: {
    preferred: [
      'iogurte', 'leite', 'queijo cottage', 'queijo branco',
      'chá', 'chocolate quente', 'vitamina',
      'banana', 'maçã', 'mamão', 'melão',
      'aveia', 'granola', 'mel',
      'castanha', 'amêndoa', 'nozes'
    ],
    avoided: [
      'arroz', 'feijão', 'macarrão', 'carne', 'frango', 'peixe', 'bife',
      'batata', 'mandioca', 'salada completa', 'legumes refogados'
    ]
  }
};

function fetchEligibleFoods(
  allFoods: Food[],
  restrictions: string[]
): Food[] {
  return allFoods.filter((f: Food) => {
    // 1. Status deve ser approved ou active
    const status = (f.status || '').toLowerCase();
    if (status !== 'approved' && status !== 'active' && status !== '') {
      return false;
    }
    
    // 2. Categoria deve ser canônica (exceto suplementos)
    const category = (f.category || '').toLowerCase();
    if (!isValidCategory(category) || EXCLUDED_FROM_AUTO_PLAN.includes(category as FoodCategory)) {
      return false;
    }
    
    // 3. Nível de processamento deve ser in_natura ou minimamente_processado
    if (!isSubstitutableLevel(f.processing_level)) {
      return false;
    }
    
    // 4. Aplicar restrições do usuário
    const foodName = f.name.toLowerCase();
    const isRestricted = restrictions.some(r => {
      const restriction = r.toLowerCase();
      if (restriction.includes('lactose') && category === 'laticinios') return true;
      if (restriction.includes('gluten') && (foodName.includes('trigo') || foodName.includes('aveia') || foodName.includes('pão') || foodName.includes('macarrão'))) return true;
      if (restriction.includes('vegetariano') && category === 'proteinas' && !foodName.includes('ovo')) return true;
      if (restriction.includes('vegano') && (category === 'proteinas' || category === 'laticinios')) return true;
      return foodName.includes(restriction);
    });
    
    return !isRestricted;
  });
}

/**
 * Filtra alimentos por contexto de refeição
 * Retorna alimentos apropriados para o tipo de refeição específico
 */
function filterFoodsByMealContext(
  foods: Food[],
  mealType: MealType
): Food[] {
  const context = MEAL_CONTEXT_RULES[mealType];
  if (!context) return foods;
  
  // Primeiro, tentar encontrar alimentos preferidos para esta refeição
  const preferredFoods = foods.filter(f => {
    const name = f.name.toLowerCase();
    // Verificar se o alimento NÃO está na lista de evitados
    const isAvoided = context.avoided.some(keyword => name.includes(keyword.toLowerCase()));
    if (isAvoided) return false;
    
    // Verificar se o alimento está na lista de preferidos
    const isPreferred = context.preferred.some(keyword => name.includes(keyword.toLowerCase()));
    return isPreferred;
  });
  
  // Se houver alimentos preferidos suficientes, usar apenas eles
  if (preferredFoods.length >= 3) {
    return preferredFoods;
  }
  
  // Caso contrário, usar todos os alimentos que não são evitados
  const notAvoidedFoods = foods.filter(f => {
    const name = f.name.toLowerCase();
    return !context.avoided.some(keyword => name.includes(keyword.toLowerCase()));
  });
  
  // Se ainda não houver alimentos suficientes, incluir todos (fallback)
  if (notAvoidedFoods.length < 3) {
    logStep("Fallback: not enough context-filtered foods", { mealType, notAvoided: notAvoidedFoods.length });
    return foods;
  }
  
  return notAvoidedFoods;
}

// ============================================================
// MONTAGEM DA REFEIÇÃO (LINHAS 130-180 DA SPEC)
// Proteína quase sempre presente, gordura opcional, vegetais livres
// ============================================================

function pickFoodFromCategory(
  foods: Food[],
  category: FoodCategory,
  usedIds: Set<string>,
  preferences: string[],
  mealType?: MealType
): Food | null {
  // Primeiro, filtrar por categoria
  let candidates = foods.filter(f => {
    const cat = (f.category || '').toLowerCase();
    return cat === category && !usedIds.has(f.id);
  });
  
  if (candidates.length === 0) return null;
  
  // Aplicar filtro de contexto de refeição se disponível
  if (mealType) {
    const contextFiltered = filterFoodsByMealContext(candidates, mealType);
    if (contextFiltered.length > 0) {
      candidates = contextFiltered;
    }
  }
  
  // Priorizar preferências do usuário
  const preferred = candidates.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : candidates;
  
  // Adicionar aleatoriedade para variedade
  return pool[Math.floor(Math.random() * pool.length)];
}

function calculateDefaultPortion(food: Food, targetMacro: MealMacroDistribution): number {
  // Porções médias e plausíveis por categoria (em gramas)
  const defaultPortions: Record<string, number> = {
    proteinas: 120,
    carboidratos: 150,
    gorduras: 15,
    vegetais: 100,
    frutas: 120,
    laticinios: 200,
    leguminosas: 100,
    mistos: 150,
  };
  
  const category = (food.category || '').toLowerCase();
  let portion = defaultPortions[category] || 100;
  
  // Ajuste grosso baseado na meta calórica (não tentar fechar exato)
  // Isso é heurístico, não preciso - o rebalanceador fará o ajuste fino
  const foodCalPerGram = food.calories > 0 ? food.calories / 100 : 1;
  const targetCalsForThis = targetMacro.calories * 0.25; // ~25% da refeição
  const suggestedPortion = targetCalsForThis / foodCalPerGram;
  
  // Clamp para valores razoáveis
  portion = Math.round(Math.min(Math.max(suggestedPortion, portion * 0.5), portion * 2) / 10) * 10;
  portion = Math.min(500, Math.max(20, portion));
  
  return portion;
}

function buildMealOption(
  foods: Food[],
  mealType: MealType,
  targetMacro: MealMacroDistribution,
  preferences: string[],
  usedFoodIds: Set<string>,
  optionNumber: number
): MealOption {
  const categoryPriorities = MEAL_CATEGORY_PRIORITIES[mealType] || 
                             MEAL_CATEGORY_PRIORITIES[MEAL_NAMES[mealType]] || 
                             ['proteinas', 'carboidratos', 'vegetais'];
  
  const mealFoods: FoodWithDisplay[] = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  // Para almoço e jantar, proteína é obrigatória
  const isMainMeal = mealType === 'lunch' || mealType === 'dinner';
  
  for (const category of categoryPriorities) {
    if (!isValidCategory(category)) continue;
    
    // Passar mealType para filtrar alimentos por contexto de refeição
    const food = pickFoodFromCategory(foods, category, usedFoodIds, preferences, mealType);
    if (!food) continue;
    
    usedFoodIds.add(food.id);
    
    const portion = calculateDefaultPortion(food, targetMacro);
    const converted = applyUnitConversion(food, portion);
    
    // Calcular macros baseado em gramas calculados
    const multiplier = converted.calculated_grams / 100;
    totalCalories += food.calories * multiplier;
    totalProtein += Number(food.protein) * multiplier;
    totalCarbs += Number(food.carbs) * multiplier;
    totalFat += Number(food.fat) * multiplier;
    
    mealFoods.push(converted);
  }
  
  // Garantir que refeições principais tenham proteína
  if (isMainMeal && !mealFoods.some(f => (f.food.category || '').toLowerCase() === 'proteinas')) {
    // Passar mealType para filtrar proteína apropriada
    const protein = pickFoodFromCategory(foods, 'proteinas', usedFoodIds, preferences, mealType);
    if (protein) {
      usedFoodIds.add(protein.id);
      const portion = calculateDefaultPortion(protein, targetMacro);
      const converted = applyUnitConversion(protein, portion);
      
      const multiplier = converted.calculated_grams / 100;
      totalCalories += protein.calories * multiplier;
      totalProtein += Number(protein.protein) * multiplier;
      totalCarbs += Number(protein.carbs) * multiplier;
      totalFat += Number(protein.fat) * multiplier;
      
      mealFoods.unshift(converted); // Proteína primeiro
    }
  }
  
  return {
    option_number: optionNumber,
    name: optionNumber === 1 ? 'Opção Principal' : `Opção ${optionNumber}`,
    foods: mealFoods,
    total_calories: Math.round(totalCalories),
    total_protein: Math.round(totalProtein * 10) / 10,
    total_carbs: Math.round(totalCarbs * 10) / 10,
    total_fat: Math.round(totalFat * 10) / 10,
  };
}

// ============================================================
// VALIDAÇÃO GERAL DO PLANO (LINHAS 270-300 DA SPEC)
// ============================================================

interface PlanValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validatePlan(
  meals: Array<{ name: string; options: MealOption[] }>,
  targets: MacroTargets
): PlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Todas as refeições devem ter pelo menos uma opção
  for (const meal of meals) {
    if (meal.options.length === 0) {
      errors.push(`Refeição ${meal.name} sem opções`);
    }
    
    // 2. Nenhuma porção zero
    for (const option of meal.options) {
      for (const food of option.foods) {
        if (food.quantity_grams <= 0) {
          errors.push(`Porção zero em ${meal.name}: ${food.food.name}`);
        }
      }
    }
    
    // 3. Refeições principais devem ter proteína
    const mealType = meal.name.toLowerCase();
    const isMainMeal = mealType.includes('almoço') || mealType.includes('jantar') || 
                       mealType === 'lunch' || mealType === 'dinner';
    
    if (isMainMeal) {
      const hasProtein = meal.options[0]?.foods.some(f => 
        (f.food.category || '').toLowerCase() === 'proteinas'
      );
      if (!hasProtein) {
        warnings.push(`${meal.name} sem fonte de proteína`);
      }
    }
  }
  
  // 4. Calorias totais aproximadas (±15%)
  const totalCalories = meals.reduce((sum, m) => sum + (m.options[0]?.total_calories || 0), 0);
  const calorieError = Math.abs(totalCalories - targets.calories) / targets.calories;
  
  if (calorieError > 0.15) {
    warnings.push(`Calorias totais (${totalCalories}) diferem ${Math.round(calorieError * 100)}% da meta (${targets.calories})`);
  }
  
  // 5. Verificar categorias canônicas
  for (const meal of meals) {
    for (const option of meal.options) {
      for (const food of option.foods) {
        const category = (food.food.category || '').toLowerCase();
        if (!isValidCategory(category)) {
          errors.push(`Categoria inválida: ${category} em ${food.food.name}`);
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    // Parse e validação do input
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
      logStep("Invalid profile: not an object");
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const profileData = profile as Record<string, unknown>;
    
    // ============================================================
    // VALIDAÇÕES INICIAIS (LINHAS 1-30 DA SPEC)
    // ============================================================
    
    const targets: MacroTargets = {
      calories: validate.isInRange(profileData.daily_calories, 500, 10000) 
        ? profileData.daily_calories as number 
        : 0, // Zero para falhar validação se não informado
      protein: validate.isInRange(profileData.protein_target, 0, 500) 
        ? profileData.protein_target as number 
        : 0,
      carbs: validate.isInRange(profileData.carbs_target, 0, 1000) 
        ? profileData.carbs_target as number 
        : 0,
      fat: validate.isInRange(profileData.fat_target, 0, 300) 
        ? profileData.fat_target as number 
        : 0,
    };
    
    const targetValidation = assertValidTargets(targets);
    if (!targetValidation.valid) {
      logStep("Invalid targets", { error: targetValidation.error });
      return createErrorResponse(
        targetValidation.error || "Metas nutricionais inválidas",
        400,
        corsHeaders
      );
    }
    
    const mealsPerDay = validate.isInRange(profileData.meals_per_day, 2, 6) 
      ? profileData.meals_per_day as number 
      : 4;
    
    const preferences = validate.isArray(profileData.preferences)
      ? (profileData.preferences as unknown[]).filter(validate.isString).slice(0, 20) as string[]
      : [];
    const restrictions = validate.isArray(profileData.restrictions)
      ? (profileData.restrictions as unknown[]).filter(validate.isString).slice(0, 20) as string[]
      : [];
    
    const prefValidation = assertValidPreferences(preferences, restrictions);
    if (!prefValidation.valid) {
      logStep("Invalid preferences", { error: prefValidation.error });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const goal = validate.isString(profileData.goal) ? profileData.goal as string : 'maintain';
    
    const validStudentId = validate.isString(studentId) && 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId as string)
      ? studentId as string
      : null;
    
    logStep("Input validated", { calories: targets.calories, mealsPerDay, goal, studentId: validStudentId });
    
    // ============================================================
    // AUTENTICAÇÃO E PERMISSÕES
    // ============================================================
    
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
      logStep("Auth failed");
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }
    
    logStep("User authenticated", { userId: user.id });
    
    let targetUserId = user.id;
    
    if (validStudentId) {
      const { data: linkData, error: linkError } = await supabase
        .from('professional_students')
        .select('id')
        .eq('professional_id', user.id)
        .eq('student_id', validStudentId)
        .eq('status', 'active')
        .single();
      
      if (linkError || !linkData) {
        logStep("Professional does not have access to student", { studentId: validStudentId });
        return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
      }
      
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'professional',
      });
      
      if (!hasRole) {
        logStep("User is not a professional");
        return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
      }
      
      targetUserId = validStudentId;
      logStep("Creating plan for student", { studentId: validStudentId, professionalId: user.id });
    }
    
    // Skip validações para plano inicial (onboarding)
    const skipValidation = isInitialPlan === true;
    
    if (!skipValidation) {
      const { data: canUse } = await supabase.rpc('can_use_feature', {
        _user_id: user.id,
        _feature: 'diet',
      });

      if (!canUse) {
        logStep("Usage limit reached");
        return createErrorResponse(
          CLIENT_ERRORS.USAGE_LIMIT,
          403,
          corsHeaders,
          { upgradeRequired: true }
        );
      }
    } else {
      logStep("Skipping validation - initial plan creation");
    }
    
    // Buscar limite de opções do plano
    const { data: userPlanData } = await supabase.rpc('get_user_plan', {
      _user_id: user.id,
    });
    
    const mealOptionsLimit = userPlanData?.[0]?.meal_options_limit ?? 1;
    logStep("User plan meal options limit", { mealOptionsLimit });
    
    // ============================================================
    // BUSCAR ALIMENTOS (LINHAS 90-130 DA SPEC)
    // ============================================================
    
    const { data: allFoods, error: foodsError } = await supabase
      .from("foods")
      .select("*");
    
    if (foodsError) {
      logStep("Failed to load foods", { error: foodsError.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }
    
    if (!allFoods || allFoods.length === 0) {
      logStep("No foods available");
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }
    
    const eligibleFoods = fetchEligibleFoods(allFoods as Food[], restrictions);
    
    logStep("Eligible foods filtered", { 
      total: allFoods.length, 
      eligible: eligibleFoods.length,
    });
    
    if (eligibleFoods.length < 10) {
      logStep("Too few eligible foods");
      return createErrorResponse(
        "Poucos alimentos disponíveis após aplicar restrições",
        400,
        corsHeaders
      );
    }
    
    // ============================================================
    // DEFINIÇÃO DA ESTRUTURA DO DIA (LINHAS 30-60 DA SPEC)
    // ============================================================
    
    const mealSkeleton = buildMealSkeleton(mealsPerDay);
    const mealTargets = distributeMacros(targets, mealSkeleton);
    
    logStep("Meal skeleton built", { 
      meals: mealSkeleton.map(m => MEAL_NAMES[m]), 
      distribution: mealTargets 
    });
    
    // ============================================================
    // MONTAGEM DAS REFEIÇÕES (LINHAS 130-270 DA SPEC)
    // ============================================================
    
    const generatedMeals: Array<{ 
      name: string; 
      mealType: MealType;
      options: MealOption[];
      sortOrder: number;
    }> = [];
    
    for (let sortOrder = 0; sortOrder < mealSkeleton.length; sortOrder++) {
      const mealType = mealSkeleton[sortOrder];
      const mealTarget = mealTargets[mealType];
      
      const options: MealOption[] = [];
      const usedFoodIds = new Set<string>();
      
      // Opção 1 (principal)
      const option1 = buildMealOption(
        eligibleFoods,
        mealType,
        mealTarget,
        preferences,
        usedFoodIds,
        1
      );
      options.push(option1);
      
      // Opções 2+ (equivalentes)
      for (let optNum = 2; optNum <= mealOptionsLimit; optNum++) {
        const optionN = buildMealOption(
          eligibleFoods,
          mealType,
          mealTarget,
          preferences,
          usedFoodIds,
          optNum
        );
        options.push(optionN);
      }
      
      generatedMeals.push({
        name: MEAL_NAMES[mealType],
        mealType,
        options,
        sortOrder,
      });
    }
    
    // ============================================================
    // VALIDAÇÃO GERAL (LINHAS 270-300 DA SPEC)
    // ============================================================
    
    const planValidation = validatePlan(generatedMeals, targets);
    
    if (!planValidation.valid) {
      logStep("Plan validation failed", { errors: planValidation.errors });
      return createErrorResponse(
        `Falha na validação do plano: ${planValidation.errors.join("; ")}`,
        500,
        corsHeaders
      );
    }
    
    if (planValidation.warnings.length > 0) {
      logStep("Plan validation warnings", { warnings: planValidation.warnings });
    }
    
    // ============================================================
    // SALVAR NO BANCO (STATUS = 'draft')
    // ============================================================
    
    const totalCalories = generatedMeals.reduce((sum, m) => sum + (m.options[0]?.total_calories || 0), 0);
    const totalProtein = generatedMeals.reduce((sum, m) => sum + (m.options[0]?.total_protein || 0), 0);
    const totalCarbs = generatedMeals.reduce((sum, m) => sum + (m.options[0]?.total_carbs || 0), 0);
    const totalFat = generatedMeals.reduce((sum, m) => sum + (m.options[0]?.total_fat || 0), 0);
    
    // STATUS = 'draft' conforme spec (linha 11: plano nasce editável)
    const { data: plan, error: planError } = await supabase.from("diet_plans").insert({
      user_id: targetUserId,
      total_calories: Math.round(totalCalories),
      total_protein: Math.round(totalProtein * 10) / 10,
      total_carbs: Math.round(totalCarbs * 10) / 10,
      total_fat: Math.round(totalFat * 10) / 10,
      status: 'draft', // REGRA: plano nasce como draft, não active
    }).select().single();

    if (planError || !plan) {
      logStep("Failed to create diet plan", { error: planError?.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }
    
    logStep("Diet plan created", { planId: plan.id, status: 'draft' });

    // Incrementar uso após criação bem-sucedida
    if (!skipValidation) {
      await supabase.rpc('increment_usage', {
        _user_id: user.id,
        _feature: 'diet',
      });
    }

    // Salvar refeições com schema v2
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
      
      if (mealError || !savedMeal) {
        logStep("Failed to create meal", { error: mealError?.message, mealName: meal.name });
        continue;
      }

      // Salvar opções da refeição
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

        if (optionError || !savedOption) {
          logStep("Failed to create meal option", { error: optionError?.message, optionNum: option.option_number });
          continue;
        }

        // Salvar alimentos da opção (schema v2: meal_option_foods)
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
    
    logStep("Plan saved successfully", { 
      planId: plan.id, 
      meals: generatedMeals.length,
      totalCalories,
    });

    return createSuccessResponse({ 
      success: true, 
      plan,
      validation: planValidation,
    }, corsHeaders);
    
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
