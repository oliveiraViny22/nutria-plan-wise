// ============================================================
// GERADOR DE PLANO ALIMENTAR - VERSÃO CANÔNICA v2.1
// ============================================================
// RESPONSABILIDADE: Criar a PRIMEIRA versão do plano.
// NÃO otimiza continuamente (isso é do rebalanceador).
// NÃO usa IA para cálculos - é puramente heurístico.
// ============================================================
// REGRAS ESTRUTURAIS (v2.1):
// 1. TODA refeição deve ter fonte de proteína compatível
// 2. Alimentos bloqueados por contexto NUNCA entram
// 3. Proteína distribuída equilibradamente (mínimo por refeição)
// 4. Se regras não forem atendidas, plano NÃO é gerado
// 5. [G7] Carboidratos totais ≥ 90% da meta (validação pré-save)
// 6. [G7] Refeições principais devem ter fonte de carb base (não apenas frutas)
// ============================================================
// REGRAS DE BLOQUEIO CALÓRICO (v2.1):
// 7. [G0] Calorias totais DEVEM estar dentro de ±10% da meta
// 8. [G0.1] Carbs > 120% E Fat > 120% simultaneamente = BLOQUEIO
// 9. [G0.2] Proibido compensar com excesso - plano deve FALHAR
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
// INTERFACES
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
// VALIDAÇÕES INICIAIS
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
  
  const calculatedCals = (targets.protein * 4) + (targets.carbs * 4) + (targets.fat * 9);
  const tolerance = targets.calories * 0.15;
  if (Math.abs(calculatedCals - targets.calories) > tolerance) {
    logStep("Warning: macro sum doesn't match calories", { calculatedCals, targetCals: targets.calories });
  }
  
  return { valid: true };
}

function assertValidPreferences(preferences: string[], restrictions: string[]): ValidationResult {
  if (!Array.isArray(preferences) || !Array.isArray(restrictions)) {
    return { valid: false, error: "Preferências e restrições devem ser arrays" };
  }
  return { valid: true };
}

// ============================================================
// ESTRUTURA DO DIA
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
// CONTEXTO DE REFEIÇÃO - REGRAS RÍGIDAS (v2)
// ============================================================
// BLOQUEIO ABSOLUTO: Alimentos em 'blocked' NUNCA entram
// PREFERIDOS: Alimentos em 'preferred' têm prioridade
// PROTEÍNAS COMPATÍVEIS: Define fontes de proteína válidas por refeição
// ============================================================

interface MealContextRules {
  preferred: string[];           // Keywords que indicam alimentos preferidos
  blocked: string[];             // Keywords que BLOQUEIAM o alimento (regra rígida)
  proteinSources: string[];      // Keywords de proteínas VÁLIDAS para esta refeição
  minProteinGrams: number;       // Mínimo de proteína (g) para esta refeição
}

const MEAL_CONTEXT_RULES_V2: Record<MealType, MealContextRules> = {
  // Café da manhã: ovos, laticínios, frios leves
  breakfast: {
    preferred: [
      'pão', 'tapioca', 'aveia', 'granola', 'cereal', 'torrada',
      'ovo', 'queijo', 'iogurte', 'leite', 'requeijão', 'cottage',
      'banana', 'maçã', 'mamão', 'morango', 'laranja',
      'mel', 'cuscuz', 'mingau', 'presunto', 'peito de peru'
    ],
    blocked: [
      'feijão', 'feijoada', 'arroz branco', 'arroz integral',
      'macarrão', 'lasanha', 'strogonoff', 'bife', 'frango grelhado',
      'carne moída', 'almôndega', 'costela', 'alcatra', 'patinho',
      'batata doce', 'mandioca', 'inhame', 'purê', 'farofa',
      'tilápia', 'salmão', 'sardinha', 'camarão'
    ],
    proteinSources: [
      'ovo', 'queijo', 'iogurte', 'leite', 'cottage', 'requeijão',
      'presunto', 'peito de peru', 'cream cheese', 'whey', 'albumina'
    ],
    minProteinGrams: 10,
  },
  
  // Lanche da manhã: laticínios, oleaginosas
  morning_snack: {
    preferred: [
      'banana', 'maçã', 'pera', 'uva', 'morango', 'mamão',
      'castanha', 'amêndoa', 'nozes', 'amendoim',
      'iogurte', 'queijo', 'cottage', 'barra de cereal'
    ],
    blocked: [
      'arroz', 'feijão', 'macarrão', 'carne', 'frango', 'peixe', 'bife',
      'batata', 'mandioca', 'purê', 'feijoada', 'strogonoff'
    ],
    proteinSources: [
      'iogurte', 'queijo', 'cottage', 'castanha', 'amêndoa', 'amendoim',
      'nozes', 'whey', 'ovo'
    ],
    minProteinGrams: 5,
  },
  
  // Almoço: refeição principal completa
  lunch: {
    preferred: [
      'arroz', 'feijão', 'lentilha', 'grão-de-bico', 'macarrão',
      'frango', 'carne', 'peixe', 'bife', 'filé', 'lombo', 'alcatra',
      'tilápia', 'salmão', 'atum', 'sardinha', 'camarão',
      'salada', 'alface', 'tomate', 'brócolis', 'couve',
      'batata doce', 'batata inglesa', 'mandioca', 'purê'
    ],
    blocked: [
      'granola', 'cereal matinal', 'mingau', 'iogurte doce',
      'mel', 'geleia', 'biscoito doce', 'chocolate'
    ],
    proteinSources: [
      'frango', 'carne', 'peixe', 'bife', 'filé', 'lombo', 'alcatra',
      'patinho', 'tilápia', 'salmão', 'atum', 'sardinha', 'camarão',
      'ovo', 'carne moída', 'frango desfiado', 'peito de frango'
    ],
    minProteinGrams: 25,
  },
  
  // Lanche da tarde: similar ao da manhã
  afternoon_snack: {
    preferred: [
      'banana', 'maçã', 'pera', 'abacate', 'castanha', 'amêndoa',
      'iogurte', 'queijo', 'cottage', 'pão integral', 'tapioca',
      'sanduíche', 'vitamina'
    ],
    blocked: [
      'arroz', 'feijão', 'macarrão', 'carne grelhada', 'feijoada',
      'batata doce', 'mandioca', 'purê', 'strogonoff'
    ],
    proteinSources: [
      'iogurte', 'queijo', 'cottage', 'ovo', 'presunto', 'peito de peru',
      'whey', 'amendoim', 'castanha', 'pasta de amendoim'
    ],
    minProteinGrams: 8,
  },
  
  // Jantar: refeição principal, pode ser mais leve
  dinner: {
    preferred: [
      'frango', 'peixe', 'carne', 'bife', 'filé', 'omelete', 'ovo',
      'tilápia', 'salmão', 'atum', 'salada', 'alface', 'tomate',
      'brócolis', 'abobrinha', 'legumes', 'arroz', 'batata doce',
      'purê', 'quinoa', 'sopa', 'caldo'
    ],
    blocked: [
      'pão francês', 'tapioca', 'granola', 'cereal matinal',
      'iogurte doce', 'mel', 'geleia', 'biscoito doce', 'mingau',
      'feijoada' // jantar geralmente mais leve
    ],
    proteinSources: [
      'frango', 'peixe', 'carne', 'bife', 'filé', 'ovo', 'omelete',
      'tilápia', 'salmão', 'atum', 'sardinha', 'peito de frango'
    ],
    minProteinGrams: 20,
  },
  
  // Ceia: leve, laticínios
  supper: {
    preferred: [
      'iogurte', 'leite', 'queijo cottage', 'queijo branco',
      'chá', 'banana', 'maçã', 'mamão', 'aveia', 'granola',
      'castanha', 'amêndoa', 'nozes'
    ],
    blocked: [
      'arroz', 'feijão', 'macarrão', 'carne', 'frango', 'peixe', 'bife',
      'batata', 'mandioca', 'legumes refogados', 'salada completa'
    ],
    proteinSources: [
      'iogurte', 'leite', 'queijo', 'cottage', 'whey', 'caseína',
      'castanha', 'amêndoa', 'nozes'
    ],
    minProteinGrams: 5,
  }
};

// ============================================================
// DISTRIBUIÇÃO DE MACROS POR REFEIÇÃO
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
  const percentages: Record<MealType, number> = {
    breakfast: 0.20,
    morning_snack: 0.08,
    lunch: 0.30,
    afternoon_snack: 0.10,
    dinner: 0.25,
    supper: 0.07,
  };
  
  const activeMeals = meals.filter(m => percentages[m] > 0);
  const totalPercent = activeMeals.reduce((sum, m) => sum + percentages[m], 0);
  
  const result: Partial<Record<MealType, MealMacroDistribution>> = {};
  
  for (const meal of meals) {
    const adjustedPercent = percentages[meal] / totalPercent;
    const context = MEAL_CONTEXT_RULES_V2[meal];
    
    // Garantir mínimo de proteína por refeição
    const baseProtein = Math.round(targets.protein * adjustedPercent);
    const minProtein = context?.minProteinGrams || 5;
    const proteinForMeal = Math.max(baseProtein, minProtein);
    
    result[meal] = {
      calories: Math.round(targets.calories * adjustedPercent),
      protein: proteinForMeal,
      carbs: Math.round(targets.carbs * adjustedPercent),
      fat: Math.round(targets.fat * adjustedPercent),
    };
  }
  
  return result as Record<MealType, MealMacroDistribution>;
}

// ============================================================
// CONVERSÃO DETERMINÍSTICA DE UNIDADES
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
      displayUnit: '',
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
// SELEÇÃO DE ALIMENTOS (REGRAS v2)
// ============================================================

function fetchEligibleFoods(
  allFoods: Food[],
  restrictions: string[],
  avoidedFoods: string[] = [] // NOVO: Lista de alimentos evitados pelo usuário
): Food[] {
  // Criar set de alimentos evitados para lookup O(1)
  const avoidedSet = new Set(avoidedFoods.map(f => f.toLowerCase().trim()));
  
  return allFoods.filter((f: Food) => {
    const foodName = f.name.toLowerCase();
    
    // REGRA ABSOLUTA: Alimentos evitados NUNCA entram no plano
    // Checagem por nome exato ou substring
    if (avoidedSet.size > 0) {
      for (const avoided of avoidedSet) {
        if (foodName === avoided || foodName.includes(avoided)) {
          return false;
        }
      }
    }
    
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
    
    // 3. Nível de processamento deve ser válido
    if (!isSubstitutableLevel(f.processing_level)) {
      return false;
    }
    
    // 4. Aplicar restrições do usuário
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
 * REGRA RÍGIDA: Verifica se alimento está bloqueado para o tipo de refeição
 */
function isFoodBlockedForMeal(food: Food, mealType: MealType): boolean {
  const context = MEAL_CONTEXT_RULES_V2[mealType];
  if (!context) return false;
  
  const foodName = food.name.toLowerCase();
  
  // Verifica se alguma keyword de bloqueio está presente no nome
  return context.blocked.some(keyword => foodName.includes(keyword.toLowerCase()));
}

/**
 * Verifica se o alimento é uma fonte de proteína compatível com a refeição
 */
function isCompatibleProteinSource(food: Food, mealType: MealType): boolean {
  const context = MEAL_CONTEXT_RULES_V2[mealType];
  if (!context) return false;
  
  const foodName = food.name.toLowerCase();
  const category = (food.category || '').toLowerCase();
  
  // Deve ser categoria proteínas ou laticínios com proteína significativa
  if (category !== 'proteinas' && category !== 'laticinios' && category !== 'gorduras') {
    return false;
  }
  
  // Verificar se é fonte de proteína válida para esta refeição
  return context.proteinSources.some(keyword => foodName.includes(keyword.toLowerCase()));
}

/**
 * Filtra alimentos por contexto de refeição (regras rígidas)
 */
function filterFoodsByMealContext(
  foods: Food[],
  mealType: MealType
): Food[] {
  const context = MEAL_CONTEXT_RULES_V2[mealType];
  if (!context) return foods;
  
  // REGRA RÍGIDA: Remover todos os alimentos bloqueados
  const notBlocked = foods.filter(f => !isFoodBlockedForMeal(f, mealType));
  
  if (notBlocked.length === 0) {
    logStep("Warning: all foods blocked for meal type", { mealType });
    return foods; // Fallback extremo
  }
  
  // Priorizar alimentos preferidos
  const preferred = notBlocked.filter(f => {
    const name = f.name.toLowerCase();
    return context.preferred.some(keyword => name.includes(keyword.toLowerCase()));
  });
  
  // Se houver preferidos suficientes, usar apenas eles
  if (preferred.length >= 5) {
    return preferred;
  }
  
  return notBlocked;
}

/**
 * Busca fonte de proteína COMPATÍVEL para a refeição
 * G0.1 FIX: SEMPRE prioriza fontes magras por padrão para evitar excesso de gordura
 * @param preferLean - Se true, filtra APENAS fontes magras (default: true)
 */
function findCompatibleProteinSource(
  foods: Food[],
  mealType: MealType,
  usedIds: Set<string>,
  preferences: string[],
  preferLean: boolean = true, // G0.1 FIX: Default agora é TRUE
  preferredFoods: string[] = [] // NOVO: Alimentos específicos preferidos pelo usuário
): Food | null {
  const context = MEAL_CONTEXT_RULES_V2[mealType];
  if (!context) return null;
  
  // G0.1 FIX: Limites de gordura para proteínas "magras"
  const MAX_FAT_PER_100G_LEAN = 8; // máx 8g gordura por 100g para ser considerada magra
  
  // Set de alimentos preferidos para lookup O(1)
  const preferredSet = new Set(preferredFoods.map(f => f.toLowerCase().trim()));
  
  // Primeiro, buscar proteínas da categoria correta que não estão bloqueadas
  let candidates = foods.filter(f => {
    if (usedIds.has(f.id)) return false;
    if (isFoodBlockedForMeal(f, mealType)) return false;
    
    const category = (f.category || '').toLowerCase();
    const foodName = f.name.toLowerCase();
    
    // Verificar se é fonte de proteína válida
    const isValidSource = context.proteinSources.some(keyword => 
      foodName.includes(keyword.toLowerCase())
    );
    
    // Aceitar proteínas ou laticínios com proteína significativa
    if (category === 'proteinas' && isValidSource) return true;
    if (category === 'laticinios' && isValidSource && f.protein >= 5) return true;
    
    // Para café da manhã e lanches, aceitar ovos e laticínios gerais
    if (['breakfast', 'morning_snack', 'afternoon_snack', 'supper'].includes(mealType)) {
      if (category === 'laticinios' && f.protein >= 3) return true;
    }
    
    return false;
  });
  
  if (candidates.length === 0) {
    logStep("No compatible protein found for meal", { mealType });
    return null;
  }
  
  // G0.1 FIX: SEMPRE ordenar por razão proteína/gordura
  candidates.sort((a, b) => {
    const ratioA = a.fat > 0 ? a.protein / a.fat : a.protein * 10;
    const ratioB = b.fat > 0 ? b.protein / b.fat : b.protein * 10;
    return ratioB - ratioA; // Maior ratio primeiro (mais magro)
  });
  
  // G0.1 FIX: Se preferLean, filtrar apenas proteínas realmente magras
  if (preferLean) {
    const leanCandidates = candidates.filter(f => f.fat <= MAX_FAT_PER_100G_LEAN);
    if (leanCandidates.length >= 2) {
      candidates = leanCandidates;
      logStep("G0.1 FIX: Filtered to lean protein sources only", { 
        mealType, 
        count: leanCandidates.length,
        maxFat: MAX_FAT_PER_100G_LEAN,
        examples: leanCandidates.slice(0, 3).map(c => ({ name: c.name, protein: c.protein, fat: c.fat }))
      });
    } else {
      // Se não há proteínas magras suficientes, pegar as 5 mais magras disponíveis
      candidates = candidates.slice(0, Math.min(5, candidates.length));
      logStep("G0.1 FIX: Not enough lean proteins, using leanest available", { 
        mealType, 
        topCandidates: candidates.slice(0, 3).map(c => ({ name: c.name, protein: c.protein, fat: c.fat }))
      });
    }
  }
  
  // PRIORIDADE 1: Alimentos ESPECÍFICOS preferidos pelo usuário (maior prioridade)
  if (preferredSet.size > 0) {
    const userPreferred = candidates.filter(f => {
      const foodName = f.name.toLowerCase();
      for (const pref of preferredSet) {
        if (foodName.includes(pref)) return true;
      }
      return false;
    });
    if (userPreferred.length > 0) {
      logStep("Using user-preferred protein", { 
        mealType, 
        selected: userPreferred[0].name,
        matchedFromPreferredFoods: true
      });
      return userPreferred[Math.floor(Math.random() * userPreferred.length)];
    }
  }
  
  // PRIORIDADE 2: Preferências gerais de dieta (ex: "Proteína Alta")
  const preferred = candidates.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickFoodFromCategory(
  foods: Food[],
  category: FoodCategory,
  usedIds: Set<string>,
  preferences: string[],
  mealType: MealType,
  preferredFoods: string[] = [] // NOVO: Alimentos específicos preferidos pelo usuário
): Food | null {
  // Set de alimentos preferidos para lookup O(1)
  const preferredSet = new Set(preferredFoods.map(f => f.toLowerCase().trim()));
  
  // Filtrar por categoria e aplicar regras de contexto
  let candidates = foods.filter(f => {
    const cat = (f.category || '').toLowerCase();
    if (cat !== category) return false;
    if (usedIds.has(f.id)) return false;
    
    // REGRA RÍGIDA: Bloquear alimentos incompatíveis
    if (isFoodBlockedForMeal(f, mealType)) return false;
    
    return true;
  });
  
  if (candidates.length === 0) return null;
  
  // Aplicar filtro de contexto (preferências)
  const contextFiltered = filterFoodsByMealContext(candidates, mealType);
  if (contextFiltered.length > 0) {
    candidates = contextFiltered;
  }
  
  // PRIORIDADE 1: Alimentos ESPECÍFICOS preferidos pelo usuário (maior prioridade)
  if (preferredSet.size > 0) {
    const userPreferred = candidates.filter(f => {
      const foodName = f.name.toLowerCase();
      for (const pref of preferredSet) {
        if (foodName.includes(pref)) return true;
      }
      return false;
    });
    if (userPreferred.length > 0) {
      return userPreferred[Math.floor(Math.random() * userPreferred.length)];
    }
  }
  
  // PRIORIDADE 2: Preferências gerais de dieta (ex: "Low Carb")
  const preferred = candidates.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

function calculateDefaultPortion(
  food: Food, 
  targetMacro: MealMacroDistribution,
  currentMealCalories: number = 0,
  currentMealFat: number = 0
): number {
  // Escalar porções baseado na meta calórica da refeição
  // Permitir escala mais agressiva para metas altas
  const calorieScale = Math.max(1, Math.min(2.5, targetMacro.calories / 400));
  
  // Porções base adequadas para cobrir metas
  const basePortions: Record<string, number> = {
    proteinas: 150,
    carboidratos: 200,
    gorduras: 15,
    vegetais: 100,
    frutas: 150,
    laticinios: 180,
    leguminosas: 150,
    mistos: 150,
  };
  
  const category = (food.category || '').toLowerCase();
  // Escalar de forma mais agressiva para metas altas
  const maxScale = targetMacro.calories > 900 ? 2.0 : (targetMacro.calories > 600 ? 1.6 : 1.3);
  let portion = Math.round(basePortions[category] * Math.min(maxScale, calorieScale)) || 100;
  
  const foodCalPerGram = food.calories > 0 ? food.calories / 100 : 1;
  const foodFatPerGram = food.fat / 100;
  
  // Calcular quanto ainda pode ser adicionado respeitando o target
  const remainingCalories = Math.max(0, targetMacro.calories - currentMealCalories);
  const maxPortionByCalories = remainingCalories > 0 
    ? (remainingCalories * 0.7 / foodCalPerGram) * 100  // Usar até 70% das calorias restantes
    : portion;
  
  // Limitar também pela gordura restante
  const remainingFat = Math.max(0, targetMacro.fat - currentMealFat);
  const maxPortionByFat = foodFatPerGram > 0.1
    ? (remainingFat * 0.8 / foodFatPerGram) * 100  // Usar até 80% da gordura restante
    : 600;
  
  // Usar 30% das calorias restantes para cada item
  const targetCalsPercent = 0.30;
  const targetCalsForThis = Math.min(targetMacro.calories * targetCalsPercent, remainingCalories * 0.7);
  const suggestedPortion = targetCalsForThis / foodCalPerGram;
  
  // Limites mais generosos para metas altas
  const maxPortion = targetMacro.calories > 1000 ? 450 : 
                     targetMacro.calories > 700 ? 350 : 280;
  
  // Tomar a menor entre as opções para evitar excesso
  portion = Math.round(Math.min(portion, suggestedPortion * 1.3) / 10) * 10;
  portion = Math.min(maxPortion, maxPortionByCalories, maxPortionByFat, Math.max(50, portion));
  
  return portion;
}

// ============================================================
// MONTAGEM DA REFEIÇÃO (REGRAS ESTRUTURAIS v2 + G7)
// ============================================================
// REGRA 1: TODA refeição DEVE ter fonte de proteína compatível
// REGRA 2: Proteína deve atingir mínimo definido para o tipo
// REGRA 3: Se não for possível, retornar FALHA (não gerar plano)
// REGRA G7: Refeições principais DEVEM ter fonte de carb base
// ============================================================

interface MealBuildResult {
  success: boolean;
  option?: MealOption;
  error?: string;
}

/**
 * Busca fonte de carboidrato BASE (não fruta) para refeição principal
 * REGRA G7: Prioriza categoria 'carboidratos' com ALTA densidade de carbs
 * Filtra alimentos com pelo menos 15g carbs/100g
 * REGRA G0.1 FIX: Prioriza carbs BAIXOS em gordura para evitar excesso simultâneo
 */
function findBaseCarbSource(
  foods: Food[],
  mealType: MealType,
  usedIds: Set<string>,
  preferences: string[],
  preferLowFat: boolean = true, // G0.1 FIX: Preferir carbs com baixa gordura
  preferredFoods: string[] = [] // NOVO: Alimentos específicos preferidos pelo usuário
): Food | null {
  const MIN_CARB_DENSITY = 15; // mínimo de 15g carbs por 100g
  const MAX_FAT_FOR_CARB = 5; // G0.1 FIX: máximo de 5g gordura por 100g para carbs ideais
  
  // Set de alimentos preferidos para lookup O(1)
  const preferredSet = new Set(preferredFoods.map(f => f.toLowerCase().trim()));
  
  // Primeiro: carboidratos da categoria específica com boa densidade
  let candidates = foods.filter(f => {
    if (usedIds.has(f.id)) return false;
    if (isFoodBlockedForMeal(f, mealType)) return false;
    
    const category = (f.category || '').toLowerCase();
    const foodName = f.name.toLowerCase();
    
    // REGRA G7: Filtrar por densidade de carboidratos (evitar leguminosas pobres)
    const carbDensity = f.carbs; // carbs por 100g
    if (carbDensity < MIN_CARB_DENSITY) return false;
    
    // Categoria carboidratos é prioridade absoluta
    if (category === 'carboidratos') return true;
    
    // Leguminosas apenas se tiverem boa densidade de carbs
    if (category === 'leguminosas' && carbDensity >= 20) return true;
    
    // Verificar keywords de carbs base em outras categorias
    return BASE_CARB_SOURCES.some(keyword => foodName.includes(keyword));
  });
  
  if (candidates.length === 0) {
    logStep("Warning: no base carb source found with good density", { mealType, minDensity: MIN_CARB_DENSITY });
    return null;
  }
  
  // G0.1 FIX: Se preferLowFat, filtrar/priorizar carbs com baixa gordura
  if (preferLowFat) {
    const lowFatCandidates = candidates.filter(f => f.fat <= MAX_FAT_FOR_CARB);
    if (lowFatCandidates.length >= 3) {
      candidates = lowFatCandidates;
      logStep("G0.1 FIX: Filtered to low-fat carb sources", { 
        count: lowFatCandidates.length,
        examples: lowFatCandidates.slice(0, 3).map(c => ({ name: c.name, fat: c.fat, carbs: c.carbs }))
      });
    }
  }
  
  // Ordenar por: (1) baixa gordura, (2) alta densidade de carboidrato
  candidates.sort((a, b) => {
    // Primeiro critério: menor gordura
    const fatDiff = a.fat - b.fat;
    if (Math.abs(fatDiff) > 2) return fatDiff;
    // Segundo critério: maior carbs
    return b.carbs - a.carbs;
  });
  
  // PRIORIDADE 1: Alimentos ESPECÍFICOS preferidos pelo usuário (maior prioridade)
  if (preferredSet.size > 0) {
    const userPreferred = candidates.filter(f => {
      const foodName = f.name.toLowerCase();
      for (const pref of preferredSet) {
        if (foodName.includes(pref)) return true;
      }
      return false;
    });
    if (userPreferred.length > 0) {
      logStep("Using user-preferred carb source", { 
        mealType, 
        selected: userPreferred[0].name,
        matchedFromPreferredFoods: true
      });
      return userPreferred[Math.floor(Math.random() * userPreferred.length)];
    }
  }
  
  // PRIORIDADE 2: Preferências gerais entre os top candidatos
  const topCandidates = candidates.slice(0, Math.min(10, candidates.length));
  const preferred = topCandidates.filter(f => 
    preferences.some(p => f.name.toLowerCase().includes(p.toLowerCase()))
  );
  
  const pool = preferred.length > 0 ? preferred : topCandidates;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildMealOption(
  foods: Food[],
  mealType: MealType,
  targetMacro: MealMacroDistribution,
  preferences: string[],
  usedFoodIds: Set<string>,
  optionNumber: number,
  preferredFoods: string[] = [] // NOVO: Alimentos específicos preferidos pelo usuário
): MealBuildResult {
  const context = MEAL_CONTEXT_RULES_V2[mealType];
  const categoryPriorities = MEAL_CATEGORY_PRIORITIES[mealType] || 
                             MEAL_CATEGORY_PRIORITIES[MEAL_NAMES[mealType]] || 
                             ['proteinas', 'carboidratos', 'vegetais'];
  
  const mealFoods: FoodWithDisplay[] = [];
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  
  const isMainMeal = MAIN_MEALS_REQUIRING_CARBS.includes(mealType);
  let hasBaseCarb = false;
  
  // ============================================================
  // G7 FIX: Para refeições principais, adicionar CARB PRIMEIRO
  // Isso garante que carboidratos tenham prioridade no orçamento
  // ============================================================
  
  if (isMainMeal) {
    // G0.1 FIX: Sempre preferir carbs com baixa gordura para evitar excesso simultâneo
    const baseCarbSource = findBaseCarbSource(foods, mealType, usedFoodIds, preferences, true);
    
    if (baseCarbSource) {
      usedFoodIds.add(baseCarbSource.id);
      
      // G7: Calcular porção de carb respeitando tanto carbs quanto gordura
      const carbsPerGram = baseCarbSource.carbs / 100;
      const carbCalPerGram = baseCarbSource.calories / 100;
      const fatPerGram = baseCarbSource.fat / 100;
      const targetCarbsForMeal = targetMacro.carbs;
      
      // Usar 55% do orçamento calórico para carboidratos
      const carbCalorieBudget = targetMacro.calories * 0.55;
      const maxPortionByCalories = carbCalorieBudget / carbCalPerGram;
      
      // Limitar pela gordura da refeição (máx 40% do budget de gordura)
      const maxFatForCarb = targetMacro.fat * 0.4;
      const maxPortionByFat = fatPerGram > 0.1 ? (maxFatForCarb / fatPerGram) * 100 : 600;
      
      // Cobrir 90% da meta de carbs da refeição
      const carbCoveragePercent = 0.90;
      const carbCoverageTarget = targetCarbsForMeal * carbCoveragePercent;
      const suggestedPortion = carbsPerGram > 0 ? (carbCoverageTarget / carbsPerGram) * 100 : 200;
      
      // Limites mais generosos para metas altas
      const maxCarbPortion = targetMacro.calories > 1000 ? 500 : 
                             targetMacro.calories > 800 ? 400 : 
                             targetMacro.calories > 600 ? 350 : 280;
      const carbPortion = Math.min(maxCarbPortion, maxPortionByCalories, maxPortionByFat, Math.max(120, Math.round(suggestedPortion / 10) * 10));
      
      const carbConverted = applyUnitConversion(baseCarbSource, carbPortion);
      
      const carbMultiplier = carbConverted.calculated_grams / 100;
      totalCalories += baseCarbSource.calories * carbMultiplier;
      totalProtein += baseCarbSource.protein * carbMultiplier;
      totalCarbs += baseCarbSource.carbs * carbMultiplier;
      totalFat += baseCarbSource.fat * carbMultiplier;
      
      mealFoods.push(carbConverted);
      hasBaseCarb = true;
      
      logStep("G7: Added base carb source FIRST", { 
        mealType, 
        food: baseCarbSource.name, 
        portion: carbPortion,
        carbDensity: baseCarbSource.carbs,
        fatContent: baseCarbSource.fat,
        carbs: baseCarbSource.carbs * carbMultiplier,
        fat: baseCarbSource.fat * carbMultiplier,
        caloriesUsed: baseCarbSource.calories * carbMultiplier,
        budgetRemaining: targetMacro.calories - totalCalories,
      });
    }
  }
  
  // ============================================================
  // REGRA 1: Agora adicionar fonte de proteína DENTRO do restante
  // Priorizar fontes MAGRAS quando orçamento de gordura é apertado
  // ============================================================
  
  // Calcular orçamento restante de gordura para proteína
  const fatBudgetForProtein = targetMacro.fat - totalFat;
  const preferLeanProtein = fatBudgetForProtein < targetMacro.fat * 0.5; // Se gastou mais de 50% da gordura
  
  // G0.1 FIX: SEMPRE preferir proteínas magras (default já é true na função)
  const proteinSource = findCompatibleProteinSource(foods, mealType, usedFoodIds, preferences, true);
  
  if (!proteinSource) {
    return {
      success: false,
      error: `Não há fonte de proteína compatível para ${MEAL_NAMES[mealType]}`,
    };
  }
  
  usedFoodIds.add(proteinSource.id);
  
  // G0.2: Calcular porção de proteína respeitando limite de calorias RESTANTES
  const minProtein = context?.minProteinGrams || 10;
  const proteinPer100g = proteinSource.protein;
  const minPortionForProtein = proteinPer100g > 0 ? (minProtein / proteinPer100g) * 100 : 100;
  
  // Usar calorias restantes para limitar proteína
  const remainingCalories = targetMacro.calories - totalCalories - 30; // Reserva 30 cal para vegetais
  const proteinCalPerGram = proteinSource.calories / 100;
  const maxPortionByCalories = remainingCalories > 0 ? (remainingCalories * 0.85) / proteinCalPerGram : 200;
  
  // Limites mais generosos para metas altas
  const maxProteinPortion = targetMacro.calories > 900 ? 350 : 
                            targetMacro.calories > 600 ? 300 : 260;
  const proteinPortion = Math.min(maxProteinPortion, maxPortionByCalories, 
                                  Math.max(Math.round(minPortionForProtein / 10) * 10, 120));
  
  const proteinConverted = applyUnitConversion(proteinSource, proteinPortion);
  
  const proteinMultiplier = proteinConverted.calculated_grams / 100;
  totalCalories += proteinSource.calories * proteinMultiplier;
  totalProtein += proteinSource.protein * proteinMultiplier;
  totalCarbs += proteinSource.carbs * proteinMultiplier;
  totalFat += proteinSource.fat * proteinMultiplier;
  
  mealFoods.push(proteinConverted);
  
  logStep("Added protein source after carbs", {
    mealType,
    food: proteinSource.name,
    portion: proteinPortion,
    protein: proteinSource.protein * proteinMultiplier,
    fat: proteinSource.fat * proteinMultiplier,
    caloriesUsed: proteinSource.calories * proteinMultiplier,
  });
  
  // G0: Verificar se ainda há espaço calórico para mais alimentos
  const remainingCaloriesBudget = targetMacro.calories - totalCalories;
  
  // G0.1 FIX: Verificar também espaço de gordura restante
  const remainingFatBudget = targetMacro.fat - totalFat;
  
  // Agora adicionar outros alimentos por categoria (exceto proteínas e carbs base)
  for (const category of categoryPriorities) {
    if (!isValidCategory(category)) continue;
    if (category === 'proteinas') continue; // Já adicionamos
    
    // G7: Se já adicionamos carb base, pular carboidratos na prioridade
    if (hasBaseCarb && (category === 'carboidratos' || category === 'leguminosas')) {
      continue;
    }
    
    // G0.2: Pular se não há mais espaço calórico significativo
    if (targetMacro.calories - totalCalories < 30) {
      logStep("G0: Skipping category - calorie budget exhausted", { category, remaining: targetMacro.calories - totalCalories });
      break;
    }
    
    // G0.1 FIX: Pular gorduras se orçamento de gordura está esgotado
    if (category === 'gorduras' && totalFat >= targetMacro.fat * 0.8) {
      logStep("G0.1 FIX: Skipping gorduras - fat budget nearly exhausted", { currentFat: totalFat, targetFat: targetMacro.fat });
      continue;
    }
    
    const food = pickFoodFromCategory(foods, category, usedFoodIds, preferences, mealType);
    if (!food) continue;
    
    // G0.1 FIX: Se o alimento é muito gorduroso e estamos perto do limite, pular
    if (food.fat > 5 && totalFat + food.fat > targetMacro.fat * 0.9) {
      logStep("G0.1 FIX: Skipping high-fat food", { food: food.name, foodFat: food.fat, currentFat: totalFat });
      continue;
    }
    
    usedFoodIds.add(food.id);
    
    // G0.1 FIX: Passar calorias E gordura acumuladas para calcular porção limitada
    const portion = calculateDefaultPortion(food, targetMacro, totalCalories, totalFat);
    const converted = applyUnitConversion(food, portion);
    
    const multiplier = converted.calculated_grams / 100;
    totalCalories += food.calories * multiplier;
    totalProtein += food.protein * multiplier;
    totalCarbs += food.carbs * multiplier;
    totalFat += food.fat * multiplier;
    
    mealFoods.push(converted);
  }
  
  // VALIDAÇÃO: Verificar se atingimos proteína mínima
  if (totalProtein < minProtein * 0.8) { // 80% de tolerância
    logStep("Warning: meal below protein minimum", { 
      mealType, 
      totalProtein, 
      minProtein 
    });
  }
  
  return {
    success: true,
    option: {
      option_number: optionNumber,
      name: optionNumber === 1 ? 'Opção Principal' : `Opção ${optionNumber}`,
      foods: mealFoods,
      total_calories: Math.round(totalCalories),
      total_protein: Math.round(totalProtein * 10) / 10,
      total_carbs: Math.round(totalCarbs * 10) / 10,
      total_fat: Math.round(totalFat * 10) / 10,
    },
  };
}

// ============================================================
// VALIDAÇÃO GERAL DO PLANO (v2)
// ============================================================

interface PlanValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================
// REGRA G0 — VALIDAÇÃO CALÓRICA GLOBAL (BLOQUEANTE)
// ============================================================
// G0:   Calorias totais DEVEM estar dentro de ±10% da meta
// G0.1: Carbs > 120% E Fat > 120% simultaneamente = BLOQUEIO
// G0.2: Proibido compensar com excesso (não salvar plano ruim)
// ============================================================

interface G0ValidationResult {
  valid: boolean;
  errors: string[];
  metrics: {
    totalCalories: number;
    targetCalories: number;
    caloriePercent: number;
    totalCarbs: number;
    targetCarbs: number;
    carbsPercent: number;
    totalFat: number;
    targetFat: number;
    fatPercent: number;
  };
}

/**
 * REGRA G0: Valida calorias dentro de ±10% da meta
 * REGRA G0.1: Bloqueia se carbs > 120% E fat > 120% ao mesmo tempo
 * REGRA G0.2: Impede planos fora dos limites
 */
function validateG0CalorieGlobal(
  meals: Array<{ name: string; mealType: MealType; options: MealOption[] }>,
  targets: MacroTargets
): G0ValidationResult {
  const errors: string[] = [];
  
  // Calcular totais do plano (opção principal de cada refeição)
  const totalCalories = meals.reduce((sum, meal) => {
    const primary = meal.options.find(o => o.option_number === 1);
    return sum + (primary?.total_calories || 0);
  }, 0);
  
  const totalCarbs = meals.reduce((sum, meal) => {
    const primary = meal.options.find(o => o.option_number === 1);
    return sum + (primary?.total_carbs || 0);
  }, 0);
  
  const totalFat = meals.reduce((sum, meal) => {
    const primary = meal.options.find(o => o.option_number === 1);
    return sum + (primary?.total_fat || 0);
  }, 0);
  
  const caloriePercent = (totalCalories / targets.calories) * 100;
  const carbsPercent = (totalCarbs / targets.carbs) * 100;
  const fatPercent = (totalFat / targets.fat) * 100;
  
  const metrics = {
    totalCalories: Math.round(totalCalories),
    targetCalories: targets.calories,
    caloriePercent: Math.round(caloriePercent),
    totalCarbs: Math.round(totalCarbs),
    targetCarbs: targets.carbs,
    carbsPercent: Math.round(carbsPercent),
    totalFat: Math.round(totalFat),
    targetFat: targets.fat,
    fatPercent: Math.round(fatPercent),
  };
  
  logStep("G0 Metrics", metrics);
  
  // ============================================================
  // 🔒 REGRA G0: Calorias devem estar dentro de ±10%
  // ============================================================
  if (caloriePercent < 90) {
    errors.push(
      `[G0] BLOQUEIO: Calorias muito baixas - ${metrics.totalCalories} kcal (${metrics.caloriePercent}% da meta ${targets.calories}). Mínimo: 90%.`
    );
  }
  
  if (caloriePercent > 110) {
    errors.push(
      `[G0] BLOQUEIO: Calorias excedidas - ${metrics.totalCalories} kcal (${metrics.caloriePercent}% da meta ${targets.calories}). Máximo: 110%.`
    );
  }
  
  // ============================================================
  // 🔒 REGRA G0.1: Bloquear se carbs > 120% E fat > 120% juntos
  // ============================================================
  if (carbsPercent > 120 && fatPercent > 120) {
    errors.push(
      `[G0.1] BLOQUEIO: Macros extremos simultâneos - Carbs ${metrics.carbsPercent}% (máx 120%) E Gordura ${metrics.fatPercent}% (máx 120%). Plano inviável.`
    );
  }
  
  // ============================================================
  // 🔒 REGRA G0.2: Alertar sobre excessos individuais extremos
  // ============================================================
  if (caloriePercent > 150) {
    errors.push(
      `[G0.2] BLOQUEIO CRÍTICO: Calorias ${metrics.caloriePercent}% da meta (${metrics.totalCalories} vs ${targets.calories}). Limite máximo absoluto excedido.`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors,
    metrics,
  };
}

// ============================================================
// REGRA G7 — VALIDAÇÃO DE CARBOIDRATO
// ============================================================
// 1. Total de carboidratos ≥ 90% da meta diária
// 2. Refeições principais devem ter fonte de carb base (não frutas)
// 3. Nunca compensar déficit de carb com aumento de gordura
// ============================================================

/**
 * Refeições consideradas "principais" que DEVEM ter fonte de carboidrato base
 */
const MAIN_MEALS_REQUIRING_CARBS: MealType[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Keywords de fontes de carboidrato BASE (não frutas)
 */
const BASE_CARB_SOURCES = [
  // Cereais
  'arroz', 'aveia', 'granola', 'cereal', 'milho', 'cuscuz', 'quinoa',
  // Pães e massas
  'pão', 'torrada', 'tapioca', 'macarrão', 'massa', 'lasanha', 'nhoque',
  // Tubérculos
  'batata', 'mandioca', 'inhame', 'cará', 'purê',
  // Leguminosas com carbs
  'feijão', 'lentilha', 'grão-de-bico', 'ervilha',
];

/**
 * Verifica se um alimento é fonte de carboidrato base (não apenas fruta)
 */
function isBaseCarbSource(food: Food): boolean {
  const category = (food.category || '').toLowerCase();
  const foodName = food.name.toLowerCase();
  
  // Categoria carboidratos ou leguminosas (ricas em carbs)
  if (category === 'carboidratos' || category === 'leguminosas') {
    return true;
  }
  
  // Verificar keywords de carbs base
  return BASE_CARB_SOURCES.some(keyword => foodName.includes(keyword));
}

/**
 * REGRA G7.1: Valida que carboidratos totais ≥ 90% da meta
 */
function validateCarbsThreshold(
  meals: Array<{ name: string; mealType: MealType; options: MealOption[] }>,
  targets: MacroTargets
): { valid: boolean; error?: string; totalCarbs: number; minRequired: number } {
  // Calcula total de carbs considerando apenas opção principal (option_number = 1)
  const totalCarbs = meals.reduce((sum, meal) => {
    const primaryOption = meal.options.find(o => o.option_number === 1);
    return sum + (primaryOption?.total_carbs || 0);
  }, 0);
  
  const minRequired = targets.carbs * 0.90; // 90% da meta
  
  if (totalCarbs < minRequired) {
    return {
      valid: false,
      error: `[G7] Carboidratos insuficientes: ${Math.round(totalCarbs)}g gerado, mínimo ${Math.round(minRequired)}g (90% de ${targets.carbs}g)`,
      totalCarbs,
      minRequired,
    };
  }
  
  return { valid: true, totalCarbs, minRequired };
}

/**
 * REGRA G7.2: Valida que refeições principais têm fonte de carboidrato base
 */
function validateBaseCarbInMainMeals(
  meals: Array<{ name: string; mealType: MealType; options: MealOption[] }>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const meal of meals) {
    // Apenas refeições principais
    if (!MAIN_MEALS_REQUIRING_CARBS.includes(meal.mealType)) {
      continue;
    }
    
    const primaryOption = meal.options.find(o => o.option_number === 1);
    if (!primaryOption) continue;
    
    // Verificar se tem pelo menos uma fonte de carb base
    const hasBaseCarb = primaryOption.foods.some(f => isBaseCarbSource(f.food));
    
    if (!hasBaseCarb) {
      errors.push(`[G7] ${meal.name} deve ter fonte de carboidrato base (não apenas frutas)`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validatePlan(
  meals: Array<{ name: string; mealType: MealType; options: MealOption[] }>,
  targets: MacroTargets
): PlanValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // ============================================================
  // 🔒 REGRA G0 — VALIDAÇÃO CALÓRICA GLOBAL (BLOQUEANTE PRIMEIRO)
  // ============================================================
  
  const g0Validation = validateG0CalorieGlobal(meals, targets);
  if (!g0Validation.valid) {
    errors.push(...g0Validation.errors);
    logStep("G0 validation FAILED - plan will be rejected", g0Validation.metrics);
  }
  
  // ============================================================
  // REGRA G7 — VALIDAÇÃO DE CARBOIDRATO (BLOQUEANTE)
  // ============================================================
  
  // G7.1: Carboidratos totais ≥ 90% da meta
  const carbsValidation = validateCarbsThreshold(meals, targets);
  if (!carbsValidation.valid && carbsValidation.error) {
    errors.push(carbsValidation.error);
  }
  
  // G7.2: Refeições principais devem ter fonte de carb base
  const baseCarbValidation = validateBaseCarbInMainMeals(meals);
  errors.push(...baseCarbValidation.errors);
  
  // Log de validação G7
  logStep("G7 Carb validation", {
    totalCarbs: carbsValidation.totalCarbs,
    minRequired: carbsValidation.minRequired,
    carbsValid: carbsValidation.valid,
    baseCarbValid: baseCarbValidation.valid,
  });
  
  // ============================================================
  // VALIDAÇÕES ORIGINAIS
  // ============================================================
  
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
      
      // 3. REGRA v2: TODA refeição deve ter proteína
      const hasProtein = option.foods.some(f => {
        const cat = (f.food.category || '').toLowerCase();
        return cat === 'proteinas' || (cat === 'laticinios' && f.food.protein >= 5);
      });
      
      if (!hasProtein) {
        errors.push(`${meal.name} sem fonte de proteína`);
      }
    }
  }
  
  // 4. Proteína total (apenas warning, G0 já valida calorias)
  const totalProtein = meals.reduce((sum, m) => sum + (m.options[0]?.total_protein || 0), 0);
  const proteinError = Math.abs(totalProtein - targets.protein) / targets.protein;
  
  if (proteinError > 0.20) {
    warnings.push(`Proteína total (${Math.round(totalProtein)}g) difere ${Math.round(proteinError * 100)}% da meta (${targets.protein}g)`);
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
    logStep("Function started - v2 with structural rules");
    
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
    // VALIDAÇÕES INICIAIS
    // ============================================================
    
    const targets: MacroTargets = {
      calories: validate.isInRange(profileData.daily_calories, 500, 10000) 
        ? profileData.daily_calories as number 
        : 0,
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
    
    // NOVO: Alimentos específicos preferidos e evitados (v2.2)
    const preferredFoods = validate.isArray(profileData.preferred_foods)
      ? (profileData.preferred_foods as unknown[]).filter(validate.isString).slice(0, 30) as string[]
      : [];
    const avoidedFoods = validate.isArray(profileData.avoided_foods)
      ? (profileData.avoided_foods as unknown[]).filter(validate.isString).slice(0, 30) as string[]
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
    
    logStep("Input validated", { 
      calories: targets.calories, 
      mealsPerDay, 
      goal, 
      studentId: validStudentId,
      preferredFoodsCount: preferredFoods.length,
      avoidedFoodsCount: avoidedFoods.length,
    });
    
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
    // BUSCAR ALIMENTOS
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
    
    const eligibleFoods = fetchEligibleFoods(allFoods as Food[], restrictions, avoidedFoods);
    
    logStep("Eligible foods filtered", { 
      total: allFoods.length, 
      eligible: eligibleFoods.length,
      avoidedFoodsApplied: avoidedFoods.length,
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
    // DEFINIÇÃO DA ESTRUTURA DO DIA
    // ============================================================
    
    const mealSkeleton = buildMealSkeleton(mealsPerDay);
    const mealTargets = distributeMacros(targets, mealSkeleton);
    
    logStep("Meal skeleton built", { 
      meals: mealSkeleton.map(m => MEAL_NAMES[m]), 
      distribution: mealTargets 
    });
    
    // ============================================================
    // MONTAGEM DAS REFEIÇÕES (REGRAS ESTRUTURAIS v2)
    // ============================================================
    
    const generatedMeals: Array<{ 
      name: string; 
      mealType: MealType;
      options: MealOption[];
      sortOrder: number;
    }> = [];
    
    const buildErrors: string[] = [];
    
    for (let sortOrder = 0; sortOrder < mealSkeleton.length; sortOrder++) {
      const mealType = mealSkeleton[sortOrder];
      const mealTarget = mealTargets[mealType];
      
      const options: MealOption[] = [];
      const usedFoodIds = new Set<string>();
      
      // Opção 1 (principal) - DEVE funcionar ou falhar o plano
      const result1 = buildMealOption(
        eligibleFoods,
        mealType,
        mealTarget,
        preferences,
        usedFoodIds,
        1
      );
      
      if (!result1.success || !result1.option) {
        buildErrors.push(result1.error || `Falha ao montar ${MEAL_NAMES[mealType]}`);
        continue;
      }
      
      options.push(result1.option);
      
      // Opções 2+ (equivalentes)
      for (let optNum = 2; optNum <= mealOptionsLimit; optNum++) {
        const resultN = buildMealOption(
          eligibleFoods,
          mealType,
          mealTarget,
          preferences,
          usedFoodIds,
          optNum
        );
        
        if (resultN.success && resultN.option) {
          options.push(resultN.option);
        }
      }
      
      generatedMeals.push({
        name: MEAL_NAMES[mealType],
        mealType,
        options,
        sortOrder,
      });
    }
    
    // REGRA v2: Se alguma refeição falhou, NÃO gerar o plano
    if (buildErrors.length > 0) {
      logStep("Plan generation failed - structural rules not met", { errors: buildErrors });
      return createErrorResponse(
        `Não foi possível gerar o plano: ${buildErrors.join("; ")}`,
        400,
        corsHeaders
      );
    }
    
    // ============================================================
    // VALIDAÇÃO GERAL
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
    
    const { data: plan, error: planError } = await supabase.from("diet_plans").insert({
      user_id: targetUserId,
      total_calories: Math.round(totalCalories),
      total_protein: Math.round(totalProtein * 10) / 10,
      total_carbs: Math.round(totalCarbs * 10) / 10,
      total_fat: Math.round(totalFat * 10) / 10,
      status: 'draft',
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

        // Salvar alimentos da opção
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
      totalProtein,
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
