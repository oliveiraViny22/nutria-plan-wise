import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ========================================================
// INTERFACES
// ========================================================

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  serving_size: string;
  processing_level: string;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number;
  unit_enabled: boolean;
}

interface FoodWithDisplay {
  food: Food;
  quantity: number;
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
  unit_conversion_locked: boolean;
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

interface MealPlan {
  name: string;
  options: MealOption[];
}

interface GenerationError {
  code: string;
  message: string;
  details?: string;
}

interface ConversionResult {
  success: boolean;
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
  error_percent: number;
}

// ========================================================
// REGRA G5 — CLASSIFICAÇÃO DE PROTEÍNAS POR TEOR DE GORDURA
// ========================================================

type ProteinClass = 'proteina_magra' | 'proteina_moderada' | 'proteina_gordurosa';

function classifyProteinByFat(food: Food): ProteinClass {
  // Gordura por 100g
  const fatPer100g = food.fat;
  
  if (fatPer100g <= 5) return 'proteina_magra';
  if (fatPer100g <= 12) return 'proteina_moderada';
  return 'proteina_gordurosa';
}

function isProteinFood(food: Food): boolean {
  const category = food.category?.toLowerCase() || '';
  return category.includes('proteina') || 
         category === 'proteinas' ||
         food.protein >= 15;
}

function isLeanProtein(food: Food): boolean {
  return isProteinFood(food) && classifyProteinByFat(food) === 'proteina_magra';
}

// ========================================================
// REGRA G2 — CONTEXTO DA REFEIÇÃO (HARD RULES)
// ========================================================

interface MealContext {
  requiredCategories: string[];
  allowedCategories: string[];
  forbiddenCategories: string[];
  forbiddenKeywords: string[];
  requiresProtein: boolean;
  proteinType: 'any' | 'light' | 'none';
}

const MEAL_CONTEXTS: Record<string, MealContext> = {
  "Café da Manhã": {
    requiredCategories: [],
    allowedCategories: ['proteinas', 'carboidratos', 'laticinios', 'frutas'],
    forbiddenCategories: ['gorduras'],
    forbiddenKeywords: ['carne vermelha', 'boi', 'porco', 'bacon', 'linguiça', 'óleo', 'azeite'],
    requiresProtein: true,
    proteinType: 'light',
  },
  "Lanche da Manhã": {
    requiredCategories: [],
    allowedCategories: ['laticinios', 'frutas', 'proteinas'],
    forbiddenCategories: ['gorduras'],
    forbiddenKeywords: ['carne', 'frango', 'peixe', 'óleo', 'azeite'],
    requiresProtein: true,
    proteinType: 'light',
  },
  "Almoço": {
    requiredCategories: ['proteinas'],
    allowedCategories: ['proteinas', 'carboidratos', 'vegetais', 'leguminosas', 'gorduras'],
    forbiddenCategories: [],
    forbiddenKeywords: [],
    requiresProtein: true,
    proteinType: 'any',
  },
  "Lanche da Tarde": {
    requiredCategories: [],
    allowedCategories: ['laticinios', 'frutas', 'proteinas', 'carboidratos'],
    forbiddenCategories: ['gorduras'],
    forbiddenKeywords: ['carne', 'frango', 'peixe', 'óleo', 'azeite'],
    requiresProtein: true,
    proteinType: 'light',
  },
  "Jantar": {
    requiredCategories: ['proteinas'],
    allowedCategories: ['proteinas', 'carboidratos', 'vegetais'],
    forbiddenCategories: [],
    forbiddenKeywords: [],
    requiresProtein: true,
    proteinType: 'any',
  },
  "Ceia": {
    requiredCategories: [],
    allowedCategories: ['laticinios', 'frutas', 'proteinas'],
    forbiddenCategories: ['gorduras'],
    forbiddenKeywords: ['carne', 'frango', 'peixe', 'óleo', 'azeite'],
    requiresProtein: true,
    proteinType: 'light',
  },
};

// Proteínas leves para café da manhã e lanches
const LIGHT_PROTEIN_KEYWORDS = [
  'ovo', 'ovos', 'clara', 'queijo', 'iogurte', 'leite', 'cottage',
  'ricota', 'requeijão', 'whey', 'albumina'
];

function isLightProtein(food: Food): boolean {
  const name = food.name.toLowerCase();
  const category = food.category?.toLowerCase() || '';
  
  // Laticínios com proteína são considerados leves
  if (category === 'laticinios' && food.protein >= 3) return true;
  
  // Ovos e derivados
  for (const keyword of LIGHT_PROTEIN_KEYWORDS) {
    if (name.includes(keyword)) return true;
  }
  
  return false;
}

function isFoodAllowedForMeal(food: Food, mealName: string): boolean {
  const context = MEAL_CONTEXTS[mealName];
  if (!context) return true;
  
  const category = food.category?.toLowerCase() || '';
  const name = food.name.toLowerCase();
  
  // Verificar categorias proibidas
  for (const forbidden of context.forbiddenCategories) {
    if (category === forbidden.toLowerCase()) return false;
  }
  
  // Verificar palavras-chave proibidas
  for (const keyword of context.forbiddenKeywords) {
    if (name.includes(keyword.toLowerCase())) return false;
  }
  
  // Se há categorias permitidas explícitas, verificar
  if (context.allowedCategories.length > 0) {
    const isAllowed = context.allowedCategories.some(
      allowed => category === allowed.toLowerCase()
    );
    // Vegetais sempre permitidos como acompanhamento
    if (!isAllowed && category !== 'vegetais') return false;
  }
  
  return true;
}

// ========================================================
// CONVERSÃO DETERMINÍSTICA DE UNIDADES
// ========================================================

function convertGramsToUnit(
  grams: number,
  unitWeightGrams: number | null,
  unitIncrement: number = 1,
  tolerancePercent: number = 5
): ConversionResult {
  if (!unitWeightGrams || unitWeightGrams <= 0) {
    return {
      success: false,
      display_quantity: Math.round(grams * 10) / 10,
      display_unit: 'g',
      calculated_grams: grams,
      error_percent: 0,
    };
  }

  if (!unitIncrement || unitIncrement <= 0) {
    unitIncrement = 1;
  }

  const rawUnits = grams / unitWeightGrams;
  let roundedUnits = Math.round(rawUnits / unitIncrement) * unitIncrement;

  if (roundedUnits < unitIncrement) {
    roundedUnits = unitIncrement;
  }

  const finalGrams = roundedUnits * unitWeightGrams;
  const errorPercent = grams > 0 ? Math.abs(finalGrams - grams) / grams * 100 : 0;

  if (errorPercent <= tolerancePercent) {
    return {
      success: true,
      display_quantity: roundedUnits,
      display_unit: '',
      calculated_grams: finalGrams,
      error_percent: errorPercent,
    };
  } else {
    return {
      success: false,
      display_quantity: Math.round(grams * 10) / 10,
      display_unit: 'g',
      calculated_grams: grams,
      error_percent: errorPercent,
    };
  }
}

function applyUnitConversion(food: Food, quantityGrams: number): FoodWithDisplay {
  if (!food.unit_enabled || !food.unit_name) {
    return {
      food,
      quantity: quantityGrams,
      display_quantity: Math.round(quantityGrams * 10) / 10,
      display_unit: 'g',
      calculated_grams: quantityGrams,
      unit_conversion_locked: true,
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
    quantity: quantityGrams,
    display_quantity: result.display_quantity,
    display_unit: result.success ? food.unit_name : 'g',
    calculated_grams: result.calculated_grams,
    unit_conversion_locked: true,
  };
}

// ========================================================
// CONFIGURAÇÃO DE REFEIÇÕES
// ========================================================

const MEAL_NAMES = ["Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", "Jantar", "Ceia"];

function getMealsForCount(count: number): string[] {
  const distributions: Record<number, string[]> = {
    3: ["Café da Manhã", "Almoço", "Jantar"],
    4: ["Café da Manhã", "Almoço", "Lanche da Tarde", "Jantar"],
    5: ["Café da Manhã", "Lanche da Manhã", "Almoço", "Lanche da Tarde", "Jantar"],
    6: MEAL_NAMES,
  };
  return distributions[count] || distributions[4];
}

function getMealCalorieDistribution(mealsPerDay: number): Record<string, number> {
  const distributions: Record<number, Record<string, number>> = {
    3: { "Café da Manhã": 0.30, "Almoço": 0.40, "Jantar": 0.30 },
    4: { "Café da Manhã": 0.25, "Almoço": 0.35, "Lanche da Tarde": 0.10, "Jantar": 0.30 },
    5: { "Café da Manhã": 0.20, "Lanche da Manhã": 0.10, "Almoço": 0.30, "Lanche da Tarde": 0.10, "Jantar": 0.30 },
    6: { "Café da Manhã": 0.20, "Lanche da Manhã": 0.10, "Almoço": 0.25, "Lanche da Tarde": 0.10, "Jantar": 0.25, "Ceia": 0.10 },
  };
  return distributions[mealsPerDay] || distributions[4];
}

// ========================================================
// REGRA G3 — DISTRIBUIÇÃO MÍNIMA DE PROTEÍNA
// ========================================================

function calculateMinProteinPerMeal(dailyProtein: number, mealsCount: number): number {
  // 85% da proteína diária deve ser distribuída igualmente entre as refeições
  return (dailyProtein * 0.85) / mealsCount;
}

// ========================================================
// REGRA G4 — VALIDAÇÃO ESTRUTURAL DO PLANO
// ========================================================

interface StructuralValidation {
  valid: boolean;
  errors: GenerationError[];
  carbsPercent: number;
  fatPercent: number;
}

function validatePlanStructure(
  totalCalories: number,
  totalCarbs: number,
  totalFat: number
): StructuralValidation {
  const errors: GenerationError[] = [];
  
  // Calorias de carbs: 4 kcal/g
  const carbsCalories = totalCarbs * 4;
  const carbsPercent = (carbsCalories / totalCalories) * 100;
  
  // Calorias de gordura: 9 kcal/g
  const fatCalories = totalFat * 9;
  const fatPercent = (fatCalories / totalCalories) * 100;
  
  // G4: Carboidrato como base energética (≥50% das calorias)
  if (carbsPercent < 50) {
    errors.push({
      code: 'G4_CARBS_LOW',
      message: `Carboidratos representam apenas ${carbsPercent.toFixed(1)}% das calorias (mínimo: 50%)`,
      details: `Carbs: ${totalCarbs}g = ${carbsCalories} kcal de ${totalCalories} kcal totais`,
    });
  }
  
  // G4: Gordura ≤30% das calorias totais
  if (fatPercent > 30) {
    errors.push({
      code: 'G4_FAT_HIGH',
      message: `Gorduras representam ${fatPercent.toFixed(1)}% das calorias (máximo: 30%)`,
      details: `Gordura: ${totalFat}g = ${fatCalories} kcal de ${totalCalories} kcal totais`,
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    carbsPercent,
    fatPercent,
  };
}

// ========================================================
// SELEÇÃO INTELIGENTE DE ALIMENTOS
// ========================================================

const MEAL_FOOD_PREFERENCES: Record<string, { 
  preferCategories: string[]; 
  avoidCategories: string[];
  preferKeywords: string[];
}> = {
  "Café da Manhã": {
    preferCategories: ['laticinios', 'frutas', 'carboidratos'],
    avoidCategories: ['gorduras'],
    preferKeywords: ['pão', 'queijo', 'leite', 'iogurte', 'ovo', 'aveia', 'granola', 'banana', 'maçã', 'mamão', 'tapioca']
  },
  "Lanche da Manhã": {
    preferCategories: ['frutas', 'laticinios'],
    avoidCategories: ['gorduras'],
    preferKeywords: ['fruta', 'iogurte', 'banana', 'maçã', 'queijo cottage']
  },
  "Almoço": {
    preferCategories: ['proteinas', 'carboidratos', 'vegetais', 'leguminosas'],
    avoidCategories: [],
    preferKeywords: ['arroz', 'feijão', 'frango', 'carne', 'peixe', 'salada', 'legume', 'batata']
  },
  "Lanche da Tarde": {
    preferCategories: ['frutas', 'laticinios'],
    avoidCategories: ['gorduras'],
    preferKeywords: ['fruta', 'iogurte', 'sanduíche', 'pão', 'queijo']
  },
  "Jantar": {
    preferCategories: ['proteinas', 'vegetais', 'carboidratos'],
    avoidCategories: [],
    preferKeywords: ['frango', 'peixe', 'carne', 'salada', 'legume', 'ovo']
  },
  "Ceia": {
    preferCategories: ['laticinios', 'frutas'],
    avoidCategories: ['proteinas', 'gorduras'],
    preferKeywords: ['iogurte', 'leite', 'fruta', 'queijo cottage']
  }
};

interface SelectedFood {
  food: Food;
  quantity: number; // em porções de 100g
}

function selectFoodsForMealV2(
  foods: Food[],
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
  minProtein: number,
  preferences: string[],
  restrictions: string[],
  mealName: string,
  preferLeanProtein: boolean = true
): { foods: SelectedFood[]; hasProtein: boolean; proteinAmount: number; errors: GenerationError[] } {
  const mealPrefs = MEAL_FOOD_PREFERENCES[mealName] || MEAL_FOOD_PREFERENCES["Almoço"];
  const context = MEAL_CONTEXTS[mealName];
  const errors: GenerationError[] = [];
  
  // Filtrar alimentos válidos para esta refeição (G2)
  let availableFoods = foods.filter(f => {
    const nameLower = f.name.toLowerCase();
    
    // Aplicar restrições do usuário (G6)
    for (const restriction of restrictions) {
      if (nameLower.includes(restriction.toLowerCase())) return false;
    }
    
    // Aplicar regras de contexto da refeição (G2)
    if (!isFoodAllowedForMeal(f, mealName)) return false;
    
    return true;
  });
  
  // Separar fontes de proteína disponíveis
  const proteinSources = availableFoods.filter(f => {
    if (!isProteinFood(f)) return false;
    
    // Para lanches e café, preferir proteínas leves
    if (context?.proteinType === 'light') {
      return isLightProtein(f);
    }
    
    return true;
  });
  
  // Classificar e priorizar proteínas magras (G5)
  const leanProteins = proteinSources.filter(f => isLeanProtein(f) || isLightProtein(f));
  const moderateProteins = proteinSources.filter(f => 
    classifyProteinByFat(f) === 'proteina_moderada' && !isLightProtein(f)
  );
  
  // Pontuar alimentos
  const scoredFoods = availableFoods.map(f => {
    let score = 0;
    const nameLower = f.name.toLowerCase();
    const categoryLower = (f.category || '').toLowerCase();
    
    // Categorias preferidas para esta refeição
    if (mealPrefs.preferCategories.some(c => categoryLower.includes(c.toLowerCase()))) {
      score += 10;
    }
    
    // Palavras-chave preferidas
    for (const keyword of mealPrefs.preferKeywords) {
      if (nameLower.includes(keyword.toLowerCase())) {
        score += 5;
      }
    }
    
    // Preferências do usuário (G6)
    for (const pref of preferences) {
      if (nameLower.includes(pref.toLowerCase())) {
        score += 8;
      }
    }
    
    // Bônus para proteínas magras (G5)
    if (isProteinFood(f) && preferLeanProtein) {
      if (isLeanProtein(f) || isLightProtein(f)) {
        score += 15;
      } else if (classifyProteinByFat(f) === 'proteina_moderada') {
        score += 5;
      }
      // Proteínas gordurosas não recebem bônus
    }
    
    // Penalizar alimentos com alta gordura para manter G4
    if (f.fat > 15) {
      score -= 10;
    }
    
    return { food: f, score };
  });
  
  // Ordenar por pontuação com alguma aleatoriedade
  scoredFoods.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) < 3) {
      return Math.random() - 0.5;
    }
    return scoreDiff;
  });
  
  availableFoods = scoredFoods.map(s => s.food);
  
  const selected: SelectedFood[] = [];
  let currentCalories = 0;
  let currentProtein = 0;
  let currentCarbs = 0;
  let currentFat = 0;
  const usedFoodIds = new Set<string>();
  let hasProtein = false;
  
  const addFood = (food: Food, quantity: number): boolean => {
    if (usedFoodIds.has(food.id)) return false;
    if (quantity < 0.2) return false;
    
    usedFoodIds.add(food.id);
    selected.push({ food, quantity });
    currentCalories += food.calories * quantity;
    currentProtein += food.protein * quantity;
    currentCarbs += food.carbs * quantity;
    currentFat += food.fat * quantity;
    
    if (isProteinFood(food) || isLightProtein(food)) {
      hasProtein = true;
    }
    
    return true;
  };
  
  const isBreakfastOrSnack = ['Café da Manhã', 'Lanche da Manhã', 'Lanche da Tarde', 'Ceia'].includes(mealName);
  
  // ===============================================
  // REGRA G1 — PROTEÍNA EM TODA REFEIÇÃO
  // Adicionar fonte de proteína PRIMEIRO
  // ===============================================
  
  if (context?.proteinType === 'light') {
    // Para lanches: usar proteínas leves
    const lightProteins = availableFoods.filter(f => isLightProtein(f));
    if (lightProteins.length > 0) {
      const protein = lightProteins[Math.floor(Math.random() * Math.min(5, lightProteins.length))];
      const neededProtein = Math.max(minProtein, targetProtein * 0.5);
      const quantity = Math.max(0.5, Math.min(2, neededProtein / Math.max(protein.protein, 1)));
      addFood(protein, quantity);
    }
  } else {
    // Para refeições principais: usar proteínas preferencialmente magras
    const proteinOptions = preferLeanProtein ? 
      [...leanProteins, ...moderateProteins] : 
      proteinSources;
    
    if (proteinOptions.length > 0) {
      const protein = proteinOptions[Math.floor(Math.random() * Math.min(5, proteinOptions.length))];
      const neededProtein = Math.max(minProtein, targetProtein * 0.7);
      const quantity = Math.max(0.8, Math.min(2.5, neededProtein / Math.max(protein.protein, 1)));
      addFood(protein, quantity);
    }
  }
  
  // Verificar se conseguimos adicionar proteína (G1)
  if (!hasProtein && context?.requiresProtein) {
    errors.push({
      code: 'G1_NO_PROTEIN',
      message: `Não foi possível encontrar fonte de proteína para ${mealName}`,
      details: 'Nenhuma proteína compatível com o contexto da refeição está disponível',
    });
  }
  
  // ===============================================
  // Adicionar carboidratos (base energética - G4)
  // ===============================================
  
  const carbFoods = availableFoods.filter(f => 
    !usedFoodIds.has(f.id) &&
    (f.category?.toLowerCase() === 'carboidratos' || 
     f.carbs >= 20) &&
    f.fat <= 5 // Priorizar carbs com baixa gordura
  );
  
  if (carbFoods.length > 0) {
    const carb = carbFoods[Math.floor(Math.random() * Math.min(5, carbFoods.length))];
    // Garantir que carboidrato seja a maior fonte calórica
    const targetCarbCalories = targetCalories * 0.5; // 50% das calorias
    const carbsNeeded = (targetCarbCalories / 4) - currentCarbs; // 4 kcal/g carbs
    const quantity = Math.max(0.5, Math.min(2.5, carbsNeeded / Math.max(carb.carbs, 1)));
    addFood(carb, quantity);
  }
  
  // ===============================================
  // Adicionar leguminosas (fonte complementar de proteína e carboidrato)
  // ===============================================
  
  if (!isBreakfastOrSnack) {
    const legumes = availableFoods.filter(f => 
      !usedFoodIds.has(f.id) &&
      f.category?.toLowerCase() === 'leguminosas'
    );
    
    if (legumes.length > 0 && currentProtein < targetProtein * 0.9) {
      const legume = legumes[Math.floor(Math.random() * Math.min(3, legumes.length))];
      addFood(legume, 0.8);
    }
  }
  
  // ===============================================
  // Adicionar vegetais
  // ===============================================
  
  const veggies = availableFoods.filter(f => 
    !usedFoodIds.has(f.id) &&
    f.category?.toLowerCase() === 'vegetais'
  );
  
  if (veggies.length > 0 && !isBreakfastOrSnack) {
    const veg = veggies[Math.floor(Math.random() * Math.min(5, veggies.length))];
    addFood(veg, 1);
  }
  
  // ===============================================
  // Adicionar frutas (para lanches e café)
  // ===============================================
  
  if (isBreakfastOrSnack) {
    const fruits = availableFoods.filter(f => 
      !usedFoodIds.has(f.id) &&
      f.category?.toLowerCase() === 'frutas'
    );
    
    if (fruits.length > 0) {
      const fruit = fruits[Math.floor(Math.random() * Math.min(5, fruits.length))];
      addFood(fruit, 1);
    }
  }
  
  // ===============================================
  // Adicionar gordura APENAS se necessário e permitido (controlado para G4)
  // ===============================================
  
  // Só adicionar gordura em refeições principais, e apenas se estiver muito baixa
  if (!isBreakfastOrSnack && currentFat < targetFat * 0.3) {
    const fatFoods = availableFoods.filter(f => 
      !usedFoodIds.has(f.id) &&
      f.category?.toLowerCase() === 'gorduras' &&
      f.fat <= 15 // Evitar gorduras muito concentradas
    );
    
    if (fatFoods.length > 0) {
      const fat = fatFoods[Math.floor(Math.random() * Math.min(3, fatFoods.length))];
      // Quantidade muito limitada
      const quantity = Math.max(0.1, Math.min(0.3, (targetFat * 0.2 - currentFat) / Math.max(fat.fat, 1)));
      if (quantity >= 0.1) {
        addFood(fat, quantity);
      }
    }
  }
  
  return {
    foods: selected,
    hasProtein,
    proteinAmount: currentProtein,
    errors,
  };
}

// ========================================================
// GERAÇÃO DE OPÇÕES EQUIVALENTES
// ========================================================

function generateEquivalentOption(
  baseOption: MealOption,
  foods: Food[],
  preferences: string[],
  restrictions: string[],
  mealName: string,
  optionNumber: number,
  minProtein: number
): MealOption | null {
  const targetCalories = baseOption.total_calories;
  const targetProtein = baseOption.total_protein;
  const targetCarbs = baseOption.total_carbs;
  const targetFat = baseOption.total_fat;
  
  // Excluir alimentos já usados na opção base
  const availableFoods = foods.filter(f => 
    !baseOption.foods.some(bf => bf.food.id === f.id)
  );
  
  const result = selectFoodsForMealV2(
    availableFoods,
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    minProtein,
    preferences,
    restrictions,
    mealName,
    true
  );
  
  // Se não conseguiu proteína, não gerar esta opção
  if (!result.hasProtein) {
    return null;
  }
  
  let total_calories = 0;
  let total_protein = 0;
  let total_carbs = 0;
  let total_fat = 0;
  
  const foodsWithDisplay: FoodWithDisplay[] = result.foods.map(({ food, quantity }) => {
    const converted = applyUnitConversion(food, quantity * 100);
    total_calories += food.calories * quantity;
    total_protein += food.protein * quantity;
    total_carbs += food.carbs * quantity;
    total_fat += food.fat * quantity;
    return converted;
  });
  
  return {
    option_number: optionNumber,
    name: `Opção ${optionNumber}`,
    foods: foodsWithDisplay,
    total_calories: Math.round(total_calories),
    total_protein: Math.round(total_protein * 10) / 10,
    total_carbs: Math.round(total_carbs * 10) / 10,
    total_fat: Math.round(total_fat * 10) / 10,
  };
}

function validateEquivalence(options: MealOption[]): { valid: boolean; errors: string[] } {
  if (options.length <= 1) return { valid: true, errors: [] };
  
  const reference = options[0];
  const errors: string[] = [];
  
  for (let i = 1; i < options.length; i++) {
    const opt = options[i];
    const proteinDiff = Math.abs(opt.total_protein - reference.total_protein);
    const carbsDiff = Math.abs(opt.total_carbs - reference.total_carbs);
    const fatDiff = Math.abs(opt.total_fat - reference.total_fat);
    const caloriesDiff = Math.abs(opt.total_calories - reference.total_calories) / reference.total_calories * 100;
    
    if (proteinDiff > 5) errors.push(`Option ${i + 1}: protein diff ${proteinDiff.toFixed(1)}g exceeds ±5g`);
    if (carbsDiff > 10) errors.push(`Option ${i + 1}: carbs diff ${carbsDiff.toFixed(1)}g exceeds ±10g`);
    if (fatDiff > 3) errors.push(`Option ${i + 1}: fat diff ${fatDiff.toFixed(1)}g exceeds ±3g`);
    if (caloriesDiff > 10) errors.push(`Option ${i + 1}: calories diff ${caloriesDiff.toFixed(1)}% exceeds ±10%`);
  }
  
  return { valid: errors.length === 0, errors };
}

// ========================================================
// SERVIDOR HTTP
// ========================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { 
      userId, 
      optionsPerMeal: requestedOptions,
      goal = "maintenance"
    } = body;

    const targetUserId = userId || user.id;

    // Verify permissions if generating for another user
    if (targetUserId !== user.id) {
      const { data: studentLink } = await supabase
        .from("professional_students")
        .select("id")
        .eq("professional_id", user.id)
        .eq("student_id", targetUserId)
        .eq("status", "active")
        .single();

      if (!studentLink) {
        return new Response(JSON.stringify({ error: "Sem permissão para gerar plano" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Buscar limite de opções do plano do usuário
    const { data: planInfo } = await supabase.rpc("get_user_plan", {
      _user_id: user.id,
    });

    let mealOptionsLimit = 3;
    if (planInfo && planInfo.length > 0) {
      mealOptionsLimit = planInfo[0].meal_options_limit || 3;
    }

    // Verificar override por usuário
    const { data: userUsage } = await supabase
      .from("user_usage")
      .select("meal_options_override")
      .eq("user_id", user.id)
      .single();

    if (userUsage?.meal_options_override !== null && userUsage?.meal_options_override !== undefined) {
      mealOptionsLimit = userUsage.meal_options_override;
    }

    const optionsPerMeal = requestedOptions 
      ? Math.min(requestedOptions, mealOptionsLimit)
      : mealOptionsLimit;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.daily_calories || !profile.meals_per_day) {
      return new Response(JSON.stringify({ error: "Perfil incompleto. Complete o onboarding." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check usage limits
    const { data: canUse } = await supabase.rpc("can_use_feature", {
      _user_id: user.id,
      _feature: "diet",
    });

    if (!canUse) {
      return new Response(JSON.stringify({ error: "Limite de dietas atingido" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch foods (excluindo suplementos - G6)
    const { data: foods, error: foodsError } = await supabase
      .from("foods")
      .select("*")
      .neq("category", "suplementos")
      .eq("is_active", true);

    if (foodsError || !foods?.length) {
      return new Response(JSON.stringify({ error: "Erro ao buscar alimentos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mealsPerDay = profile.meals_per_day || 4;
    const dailyCalories = profile.daily_calories;
    const proteinTarget = profile.protein_target || Math.round(dailyCalories * 0.25 / 4);
    const carbsTarget = profile.carbs_target || Math.round(dailyCalories * 0.50 / 4);
    const fatTarget = profile.fat_target || Math.round(dailyCalories * 0.25 / 9);
    const preferences = profile.preferences || [];
    const restrictions = profile.restrictions || [];

    // REGRA G3: Calcular proteína mínima por refeição
    const minProteinPerMeal = calculateMinProteinPerMeal(proteinTarget, mealsPerDay);

    const mealNames = getMealsForCount(mealsPerDay);
    const calorieDistribution = getMealCalorieDistribution(mealsPerDay);

    const mealPlans: MealPlan[] = [];
    const generationErrors: GenerationError[] = [];

    for (const mealName of mealNames) {
      const mealCalorieShare = calorieDistribution[mealName] || 0.25;
      const targetMealCalories = Math.round(dailyCalories * mealCalorieShare);
      const targetMealProtein = Math.round(proteinTarget * mealCalorieShare);
      const targetMealCarbs = Math.round(carbsTarget * mealCalorieShare);
      const targetMealFat = Math.round(fatTarget * mealCalorieShare);

      const options: MealOption[] = [];

      // Gerar primeira opção
      const firstResult = selectFoodsForMealV2(
        foods as Food[],
        targetMealCalories,
        targetMealProtein,
        targetMealCarbs,
        targetMealFat,
        minProteinPerMeal,
        preferences,
        restrictions,
        mealName,
        true
      );

      // Coletar erros de geração
      if (firstResult.errors.length > 0) {
        generationErrors.push(...firstResult.errors);
      }

      // REGRA G1: Verificar se tem proteína
      if (!firstResult.hasProtein) {
        generationErrors.push({
          code: 'G1_MEAL_NO_PROTEIN',
          message: `Refeição "${mealName}" não contém fonte de proteína`,
          details: 'Toda refeição deve ter pelo menos uma fonte de proteína',
        });
      }

      // Converter para FoodWithDisplay
      const firstOptionFoods: FoodWithDisplay[] = firstResult.foods.map(({ food, quantity }) => 
        applyUnitConversion(food, quantity * 100)
      );

      let total_calories = 0;
      let total_protein = 0;
      let total_carbs = 0;
      let total_fat = 0;

      for (const { food, quantity } of firstResult.foods) {
        total_calories += food.calories * quantity;
        total_protein += food.protein * quantity;
        total_carbs += food.carbs * quantity;
        total_fat += food.fat * quantity;
      }

      const firstOption: MealOption = {
        option_number: 1,
        name: "Opção 1",
        foods: firstOptionFoods,
        total_calories: Math.round(total_calories),
        total_protein: Math.round(total_protein * 10) / 10,
        total_carbs: Math.round(total_carbs * 10) / 10,
        total_fat: Math.round(total_fat * 10) / 10,
      };

      options.push(firstOption);

      // Gerar opções equivalentes
      const numOptions = Math.min(Math.max(1, optionsPerMeal), 3);
      for (let i = 2; i <= numOptions; i++) {
        const equivalentOption = generateEquivalentOption(
          firstOption,
          foods as Food[],
          preferences,
          restrictions,
          mealName,
          i,
          minProteinPerMeal
        );
        
        if (equivalentOption) {
          const validation = validateEquivalence([firstOption, equivalentOption]);
          if (validation.valid) {
            options.push(equivalentOption);
          }
        }
      }

      mealPlans.push({
        name: mealName,
        options,
      });
    }

    // Calcular totais do plano
    const totalCalories = mealPlans.reduce((sum, meal) => 
      sum + (meal.options[0]?.total_calories || 0), 0
    );
    const totalProtein = mealPlans.reduce((sum, meal) => 
      sum + (meal.options[0]?.total_protein || 0), 0
    );
    const totalCarbs = mealPlans.reduce((sum, meal) => 
      sum + (meal.options[0]?.total_carbs || 0), 0
    );
    const totalFat = mealPlans.reduce((sum, meal) => 
      sum + (meal.options[0]?.total_fat || 0), 0
    );

    // ===============================================
    // REGRA G4: Validar estrutura do plano
    // ===============================================
    
    const structuralValidation = validatePlanStructure(totalCalories, totalCarbs, totalFat);
    
    if (!structuralValidation.valid) {
      generationErrors.push(...structuralValidation.errors);
    }

    // ===============================================
    // VERIFICAR SE HÁ ERROS ESTRUTURAIS (G1, G4)
    // Se houver, NÃO salvar o plano
    // ===============================================
    
    const criticalErrors = generationErrors.filter(e => 
      e.code.startsWith('G1_') || e.code.startsWith('G4_')
    );
    
    if (criticalErrors.length > 0) {
      console.error("Erros estruturais na geração do plano:", criticalErrors);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível gerar um plano estruturalmente válido",
          errors: criticalErrors,
          validation: {
            carbsPercent: structuralValidation.carbsPercent,
            fatPercent: structuralValidation.fatPercent,
          },
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Salvar plano no banco de dados
    const { data: dietPlan, error: planError } = await supabase
      .from("diet_plans")
      .insert({
        user_id: targetUserId,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fat: totalFat,
        status: "active",
      })
      .select()
      .single();

    if (planError) {
      console.error("Error creating diet plan:", planError);
      return new Response(JSON.stringify({ error: "Erro ao criar plano" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salvar refeições com opções
    for (let mealIndex = 0; mealIndex < mealPlans.length; mealIndex++) {
      const mealPlan = mealPlans[mealIndex];
      
      const { data: meal, error: mealError } = await supabase
        .from("meals")
        .insert({
          diet_plan_id: dietPlan.id,
          name: mealPlan.name,
          sort_order: mealIndex,
          total_calories: mealPlan.options[0]?.total_calories || 0,
          total_protein: mealPlan.options[0]?.total_protein || 0,
          total_carbs: mealPlan.options[0]?.total_carbs || 0,
          total_fat: mealPlan.options[0]?.total_fat || 0,
        })
        .select()
        .single();

      if (mealError) {
        console.error("Error creating meal:", mealError);
        continue;
      }

      // Salvar opções da refeição
      for (const option of mealPlan.options) {
        const { data: mealOption, error: optionError } = await supabase
          .from("meal_options")
          .insert({
            meal_id: meal.id,
            option_number: option.option_number,
            name: option.name,
            total_calories: option.total_calories,
            total_protein: option.total_protein,
            total_carbs: option.total_carbs,
            total_fat: option.total_fat,
          })
          .select()
          .single();

        if (optionError) {
          console.error("Error creating meal option:", optionError);
          continue;
        }

        // Salvar alimentos da opção
        for (const item of option.foods) {
          await supabase
            .from("meal_option_foods")
            .insert({
              meal_option_id: mealOption.id,
              food_id: item.food.id,
              quantity_grams: item.calculated_grams,
              display_quantity: item.display_quantity,
              display_unit: item.display_unit,
              calculated_grams: item.calculated_grams,
              unit_locked: item.unit_conversion_locked,
            });
        }
      }
    }

    // Incrementar uso
    await supabase.rpc("increment_usage", {
      _user_id: user.id,
      _feature: "diet",
    });

    return new Response(
      JSON.stringify({
        success: true,
        plan: dietPlan,
        meals: mealPlans,
        validation: {
          carbsPercent: structuralValidation.carbsPercent,
          fatPercent: structuralValidation.fatPercent,
          proteinPerMeal: minProteinPerMeal,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
