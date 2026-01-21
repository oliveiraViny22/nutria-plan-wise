import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-MEAL-PLAN] ${step}${detailsStr}`);
};

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
}

interface MealFood {
  food_id: string;
  quantity: number;
}

interface MealPlan {
  name: string;
  foods: MealFood[];
}

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

function getMealsForCount(mealsPerDay: number): MealType[] {
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

function getMealCalorieDistribution(mealsPerDay: number): Record<MealType, number> {
  switch (mealsPerDay) {
    case 2:
      return { breakfast: 0, morning_snack: 0, lunch: 0.5, afternoon_snack: 0, dinner: 0.5, supper: 0 };
    case 3:
      return { breakfast: 0.25, morning_snack: 0, lunch: 0.40, afternoon_snack: 0, dinner: 0.35, supper: 0 };
    case 4:
      return { breakfast: 0.25, morning_snack: 0, lunch: 0.35, afternoon_snack: 0.10, dinner: 0.30, supper: 0 };
    case 5:
      return { breakfast: 0.20, morning_snack: 0.10, lunch: 0.30, afternoon_snack: 0.10, dinner: 0.30, supper: 0 };
    case 6:
      return { breakfast: 0.20, morning_snack: 0.08, lunch: 0.28, afternoon_snack: 0.10, dinner: 0.26, supper: 0.08 };
    default:
      return { breakfast: 0.25, morning_snack: 0, lunch: 0.35, afternoon_snack: 0.10, dinner: 0.30, supper: 0 };
  }
}

const VALID_CATEGORIES = [
  'frutas',
  'hortaliças_folhosas',
  'legumes',
  'cereais_tubérculos',
  'leguminosas',
  'proteínas_animais',
  'laticínios',
  'óleos_oleaginosas',
  'suplementos',
];

const ALLOWED_PROCESSING_LEVELS = ['in_natura', 'minimamente_processado', 'In natura', 'Minimamente processado'];

// Category priorities by meal type
const MEAL_CATEGORY_PRIORITIES: Record<MealType, string[]> = {
  breakfast: ['cereais_tubérculos', 'frutas', 'laticínios', 'óleos_oleaginosas'],
  morning_snack: ['frutas', 'óleos_oleaginosas', 'laticínios'],
  lunch: ['proteínas_animais', 'cereais_tubérculos', 'leguminosas', 'hortaliças_folhosas', 'legumes'],
  afternoon_snack: ['frutas', 'laticínios', 'óleos_oleaginosas'],
  dinner: ['proteínas_animais', 'hortaliças_folhosas', 'legumes', 'cereais_tubérculos'],
  supper: ['laticínios', 'frutas', 'óleos_oleaginosas'],
};

// Goal-based macro priorities
const GOAL_MACRO_WEIGHTS: Record<string, { protein: number; carbs: number; fat: number }> = {
  lose_weight: { protein: 1.3, carbs: 0.7, fat: 0.9 },
  gain_muscle: { protein: 1.4, carbs: 1.1, fat: 0.8 },
  maintain: { protein: 1.0, carbs: 1.0, fat: 1.0 },
};

// Intelligent food selection based on goal, macros, and categories
function selectFoodsIntelligently(
  allFoods: Food[],
  goal: string,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
  preferences: string[],
  restrictions: string[],
  maxFoods: number = 80
): Food[] {
  const weights = GOAL_MACRO_WEIGHTS[goal] || GOAL_MACRO_WEIGHTS.maintain;
  
  // Filter out supplements and ultra-processed
  const eligibleFoods = allFoods.filter((f: Food) => {
    // Normalize category for comparison (handle both old and new formats)
    const normalizedCategory = (f.category || '').toLowerCase();
    if (normalizedCategory === 'suplementos' || normalizedCategory.includes('suplemento')) return false;
    
    // Normalize processing level for comparison
    const level = (f.processing_level || 'in_natura').toLowerCase().replace(/ /g, '_');
    const allowedNormalized = ['in_natura', 'minimamente_processado'];
    if (!allowedNormalized.some(allowed => level.includes(allowed.replace('_', ' ')) || level.includes(allowed))) return false;
    
    // Check restrictions
    const foodName = f.name.toLowerCase();
    const isRestricted = restrictions.some(r => {
      const restriction = r.toLowerCase();
      if (restriction.includes('lactose') && normalizedCategory.includes('latic')) return true;
      if (restriction.includes('gluten') && (foodName.includes('trigo') || foodName.includes('aveia') || foodName.includes('pão'))) return true;
      if (restriction.includes('vegetariano') && (normalizedCategory.includes('prote') && !normalizedCategory.includes('vegetal'))) return true;
      if (restriction.includes('vegano') && (normalizedCategory.includes('prote') || normalizedCategory.includes('latic'))) return true;
      return foodName.includes(restriction);
    });
    
    return !isRestricted;
  });
  
  // Score each food based on goal alignment and macro density
  const scoredFoods = eligibleFoods.map((f: Food) => {
    let score = 0;
    const servingGrams = parseServingGrams(f.serving_size);
    
    // Macro density per 100g (normalized)
    const proteinDensity = (Number(f.protein) / servingGrams) * 100;
    const carbsDensity = (Number(f.carbs) / servingGrams) * 100;
    const fatDensity = (Number(f.fat) / servingGrams) * 100;
    
    // Score based on goal-weighted macros
    score += proteinDensity * weights.protein;
    score += carbsDensity * weights.carbs * 0.3; // Carbs weighted less
    score += fatDensity * weights.fat * 0.5;
    
    // Bonus for preferences
    const foodName = f.name.toLowerCase();
    if (preferences.some(p => foodName.includes(p.toLowerCase()))) {
      score *= 1.5;
    }
    
    // Category diversity bonus (handle both old and new category formats)
    const normalizedCat = (f.category || '').toLowerCase();
    let categoryMultiplier = 1;
    
    if (normalizedCat.includes('prote')) {
      categoryMultiplier = goal === 'gain_muscle' ? 2 : 1.2;
    } else if (normalizedCat.includes('vegeta') || normalizedCat.includes('hortali') || normalizedCat.includes('folhos')) {
      categoryMultiplier = goal === 'lose_weight' ? 1.8 : 1.2;
    } else if (normalizedCat.includes('legum')) {
      categoryMultiplier = 1.4;
    } else if (normalizedCat.includes('frut')) {
      categoryMultiplier = 1.2;
    } else if (normalizedCat.includes('carbo') || normalizedCat.includes('cerea') || normalizedCat.includes('tubér')) {
      categoryMultiplier = goal === 'gain_muscle' ? 1.5 : 1;
    } else if (normalizedCat.includes('latic')) {
      categoryMultiplier = 1.2;
    } else if (normalizedCat.includes('gordur') || normalizedCat.includes('óleo') || normalizedCat.includes('oleagin')) {
      categoryMultiplier = 1.1;
    }
    
    score *= categoryMultiplier;
    
    return { food: f, score };
  });
  
  // Sort by score descending
  scoredFoods.sort((a, b) => b.score - a.score);
  
  // Ensure category diversity - pick foods from each category
  // Category quotas (use normalized matching for actual DB categories)
  const categoryQuotaRules: Array<{ match: string; quota: number }> = [
    { match: 'prote', quota: Math.ceil(maxFoods * 0.2) },
    { match: 'carbo', quota: Math.ceil(maxFoods * 0.15) },
    { match: 'vegeta', quota: Math.ceil(maxFoods * 0.15) },
    { match: 'frut', quota: Math.ceil(maxFoods * 0.15) },
    { match: 'legum', quota: Math.ceil(maxFoods * 0.1) },
    { match: 'latic', quota: Math.ceil(maxFoods * 0.1) },
    { match: 'gordur', quota: Math.ceil(maxFoods * 0.1) },
  ];
  
  const getQuota = (category: string): number => {
    const normalized = category.toLowerCase();
    for (const rule of categoryQuotaRules) {
      if (normalized.includes(rule.match)) return rule.quota;
    }
    return 3;
  };
  
  const selectedFoods: Food[] = [];
  const categoryCount: Record<string, number> = {};
  
  for (const { food } of scoredFoods) {
    const cat = food.category || '';
    const quota = getQuota(cat);
    const current = categoryCount[cat] || 0;
    
    if (current < quota) {
      selectedFoods.push(food);
      categoryCount[cat] = current + 1;
      
      if (selectedFoods.length >= maxFoods) break;
    }
  }
  
  // If we haven't filled the quota, add more high-scoring foods
  if (selectedFoods.length < maxFoods) {
    for (const { food } of scoredFoods) {
      if (!selectedFoods.includes(food)) {
        selectedFoods.push(food);
        if (selectedFoods.length >= maxFoods) break;
      }
    }
  }
  
  return selectedFoods;
}

function parseServingGrams(servingSize: string): number {
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

function calcNutrients(food: Food, gramsQty: number) {
  const baseGrams = parseServingGrams(food.serving_size);
  const multiplier = gramsQty / baseGrams;
  return {
    calories: food.calories * multiplier,
    protein: Number(food.protein) * multiplier,
    carbs: Number(food.carbs) * multiplier,
    fat: Number(food.fat) * multiplier,
  };
}

// Generate an equivalent meal option with different foods but similar macros
function generateEquivalentOption(
  originalFoods: Array<{ food_id: string; quantity: number }>,
  allFoods: Food[],
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
  restrictions: string[],
  mealType: MealType
): Array<{ food_id: string; quantity: number }> {
  const usedFoodIds = new Set(originalFoods.map(f => f.food_id));
  const categoryPriorities = MEAL_CATEGORY_PRIORITIES[mealType] || [];
  
  // Group available foods by category (excluding already used)
  const availableByCategory: Record<string, Food[]> = {};
  
  for (const food of allFoods) {
    if (usedFoodIds.has(food.id)) continue;
    
    // Check processing level
    const level = (food.processing_level || 'in_natura').toLowerCase().replace(/ /g, '_');
    const allowedNormalized = ['in_natura', 'minimamente_processado'];
    if (!allowedNormalized.some(allowed => level.includes(allowed.replace('_', ' ')) || level.includes(allowed))) continue;
    
    // Skip supplements
    const normalizedCategory = (food.category || '').toLowerCase();
    if (normalizedCategory === 'suplementos' || normalizedCategory.includes('suplemento')) continue;
    
    // Check restrictions
    const foodName = food.name.toLowerCase();
    const isRestricted = restrictions.some(r => {
      const restriction = r.toLowerCase();
      if (restriction.includes('lactose') && normalizedCategory.includes('latic')) return true;
      if (restriction.includes('gluten') && (foodName.includes('trigo') || foodName.includes('aveia') || foodName.includes('pão'))) return true;
      return false;
    });
    if (isRestricted) continue;
    
    const cat = food.category || 'outros';
    if (!availableByCategory[cat]) availableByCategory[cat] = [];
    availableByCategory[cat].push(food);
  }
  
  const equivalentFoods: Array<{ food_id: string; quantity: number }> = [];
  let currentCalories = 0;
  let currentProtein = 0;
  let currentCarbs = 0;
  let currentFat = 0;
  
  // For each original food, try to find an equivalent from the same category
  for (const origFood of originalFoods) {
    const originalFoodData = allFoods.find(f => f.id === origFood.food_id);
    if (!originalFoodData) continue;
    
    const origCategory = originalFoodData.category || 'outros';
    const origNutrients = calcNutrients(originalFoodData, origFood.quantity);
    
    // Get alternatives from the same category
    const alternatives = availableByCategory[origCategory] || [];
    
    if (alternatives.length > 0) {
      // Pick a random alternative from the category
      const randomIndex = Math.floor(Math.random() * alternatives.length);
      const altFood = alternatives[randomIndex];
      
      // Calculate quantity to match original calories
      const baseGrams = parseServingGrams(altFood.serving_size);
      const caloriesPerGram = altFood.calories / baseGrams;
      let targetQty = caloriesPerGram > 0 
        ? origNutrients.calories / caloriesPerGram 
        : origFood.quantity;
      
      // Round and clamp
      targetQty = Math.round(targetQty / 5) * 5;
      targetQty = Math.min(500, Math.max(10, targetQty));
      
      const altNutrients = calcNutrients(altFood, targetQty);
      
      equivalentFoods.push({ food_id: altFood.id, quantity: targetQty });
      currentCalories += altNutrients.calories;
      currentProtein += altNutrients.protein;
      currentCarbs += altNutrients.carbs;
      currentFat += altNutrients.fat;
      
      // Remove from available to avoid duplicates
      const idx = alternatives.findIndex(f => f.id === altFood.id);
      if (idx > -1) alternatives.splice(idx, 1);
    } else {
      // If no alternative found, use the original
      equivalentFoods.push(origFood);
      currentCalories += origNutrients.calories;
      currentProtein += origNutrients.protein;
      currentCarbs += origNutrients.carbs;
      currentFat += origNutrients.fat;
    }
  }
  
  // Fine-tune to match target calories (scale proportionally)
  if (currentCalories > 0 && Math.abs(currentCalories - targetCalories) > 50) {
    const scaleFactor = targetCalories / currentCalories;
    for (const ef of equivalentFoods) {
      const scaledQty = Math.round((ef.quantity * scaleFactor) / 5) * 5;
      ef.quantity = Math.min(500, Math.max(10, scaledQty));
    }
  }
  
  return equivalentFoods;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!validate.isObject(body)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const { profile, studentId, isInitialPlan } = body as { profile: unknown; studentId?: unknown; isInitialPlan?: boolean };
    
    if (!validate.isObject(profile)) {
      logStep("Invalid profile: not an object");
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const profileData = profile as Record<string, unknown>;
    
    // Validate and sanitize profile fields with safe defaults
    const targetCalories = validate.isInRange(profileData.daily_calories, 500, 10000) 
      ? profileData.daily_calories as number 
      : 2000;
    const targetProtein = validate.isInRange(profileData.protein_target, 0, 500) 
      ? profileData.protein_target as number 
      : 150;
    const targetCarbs = validate.isInRange(profileData.carbs_target, 0, 1000) 
      ? profileData.carbs_target as number 
      : 250;
    const targetFat = validate.isInRange(profileData.fat_target, 0, 300) 
      ? profileData.fat_target as number 
      : 70;
    const mealsPerDay = validate.isInRange(profileData.meals_per_day, 2, 6) 
      ? profileData.meals_per_day as number 
      : 4;
    
    // Validate preferences and restrictions
    const preferences = validate.isArray(profileData.preferences)
      ? (profileData.preferences as unknown[]).filter(validate.isString).slice(0, 20) as string[]
      : [];
    const restrictions = validate.isArray(profileData.restrictions)
      ? (profileData.restrictions as unknown[]).filter(validate.isString).slice(0, 20) as string[]
      : [];
    const goal = validate.isString(profileData.goal) ? profileData.goal : 'maintain';
    
    // Validate studentId if provided (must be UUID format)
    const validStudentId = validate.isString(studentId) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId as string)
      ? studentId as string
      : null;
    
    logStep("Profile validated", { targetCalories, mealsPerDay, goal, studentId: validStudentId });
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
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

    // Determine target user ID (student or self)
    let targetUserId = user.id;
    
    if (validStudentId) {
      // If studentId is provided, verify professional has access to this student
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
      
      // Also verify the user has professional role
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

    // Skip validations for initial plan (onboarding) - rule: create immediately after data collection
    const skipValidation = isInitialPlan === true;
    
    if (!skipValidation) {

      // Validate usage limit (use professional's quota when creating for student)
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

    // Get user's plan limits for meal options
    const { data: userPlanData } = await supabase.rpc('get_user_plan', {
      _user_id: user.id,
    });
    
    const mealOptionsLimit = userPlanData?.[0]?.meal_options_limit ?? 1;
    logStep("User plan meal options limit", { mealOptionsLimit });

    // Fetch all foods from database
    const { data: allFoods, error: foodsError } = await supabase.from("foods").select("*");
    if (foodsError) {
      logStep("Failed to load foods", { error: foodsError.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }
    if (!allFoods || allFoods.length === 0) {
      logStep("No foods available");
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    // Use intelligent food selection instead of fixed slice
    const foods = selectFoodsIntelligently(
      allFoods as Food[],
      goal,
      targetProtein,
      targetCarbs,
      targetFat,
      preferences,
      restrictions,
      80 // Select up to 80 diverse foods
    );

    logStep("Foods selected intelligently", { 
      totalAvailable: allFoods.length, 
      selected: foods.length,
      goal,
    });

    if (foods.length === 0) {
      logStep("No suitable foods available");
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    const mealTypes = getMealsForCount(mealsPerDay);
    const calorieDistribution = getMealCalorieDistribution(mealsPerDay);

    const mealDistributionText = mealTypes.map(m => 
      `${MEAL_NAMES[m]} (${m}): ${Math.round(calorieDistribution[m] * 100)}%`
    ).join(', ');

    const categoryList = VALID_CATEGORIES.filter(c => c !== 'suplementos').join(', ');

    // Group foods by category for better AI context
    const foodsByCategory: Record<string, string[]> = {};
    for (const f of foods) {
      const cat = f.category || 'outros';
      if (!foodsByCategory[cat]) foodsByCategory[cat] = [];
      foodsByCategory[cat].push(`${f.id}: ${f.name} (${f.calories}kcal/${f.serving_size})`);
    }

    const foodsContextText = Object.entries(foodsByCategory)
      .map(([cat, items]) => `\n### ${cat}:\n${items.join('\n')}`)
      .join('\n');

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { 
            role: "system", 
            content: `Você é um nutricionista. Crie um plano alimentar diário em JSON. 
A meta EXATA do usuário é: ${targetCalories} calorias, ${targetProtein}g proteína, ${targetCarbs}g carboidratos, ${targetFat}g gordura.
Preferências: ${preferences.join(", ") || "nenhuma"}. 
Restrições: ${restrictions.join(", ") || "nenhuma"}. 
Objetivo: ${goal === 'lose_weight' ? 'perder peso' : goal === 'gain_muscle' ? 'ganhar massa muscular' : 'manter peso'}.

CATEGORIAS VÁLIDAS: ${categoryList}
TAXONOMIA NUTRICIONAL:
- cereais_tubérculos: inclui cereais (arroz, milho, trigo, aveia, quinoa) E tubérculos/raízes (batata, mandioca, inhame, cará)
- proteínas_animais: carnes, peixes, ovos
- leguminosas: feijões, lentilhas, grão-de-bico, ervilhas, favas
- óleos_oleaginosas: azeite, óleo de coco, castanhas, nozes, amendoim

REGRAS IMPORTANTES:
1. As quantidades devem ser em GRAMAS ou ML (não porções).
2. O total de calorias do plano DEVE ser EXATAMENTE ${targetCalories} calorias (margem de ±10 kcal).
3. O usuário quer ${mealsPerDay} refeições por dia: ${mealDistributionText}.
4. Use quantidades realistas (ex: 150g de arroz, 200ml de leite, 120g de frango).
5. NÃO use suplementos - apenas alimentos naturais ou minimamente processados.
6. Tipos de refeição válidos: ${mealTypes.join(', ')}.
7. GARANTA VARIEDADE: use alimentos diferentes em cada refeição, não repita o mesmo alimento.
8. PRIORIZE proteínas no objetivo ${goal === 'gain_muscle' ? 'ganhar massa' : goal === 'lose_weight' ? 'perder peso' : 'manter peso'}.` 
          },
          { 
            role: "user", 
            content: `Alimentos disponíveis organizados por categoria:
${foodsContextText}

Retorne APENAS JSON válido com EXATAMENTE ${mealsPerDay} refeições:
{ "meals": [{ "name": "${mealTypes[0]}|${mealTypes[1]}|...", "foods": [{ "food_id": "uuid", "quantity": 150 }] }] }

Use os tipos de refeição: ${mealTypes.join(', ')}.
Lembre-se: quantity em gramas/ml, total EXATO de ${targetCalories} calorias, sem suplementos, VARIEDADE de alimentos!` 
          }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    let mealPlan: { meals: MealPlan[] };
    
    try {
      const content = aiData.choices[0].message.content.replace(/```json|```/g, "").trim();
      mealPlan = JSON.parse(content);
    } catch {
      // Fallback: create meals based on user's meals_per_day preference
      // Use normalized category matching for actual DB values
      const normalizeCategory = (cat: string) => (cat || '').toLowerCase();
      
      const breakfastFoods = foods.filter((f: Food) => {
        const cat = normalizeCategory(f.category);
        return cat.includes('carbo') || cat.includes('frut') || cat.includes('latic');
      });
      const mainFoods = foods.filter((f: Food) => {
        const cat = normalizeCategory(f.category);
        return cat.includes('prote') || cat.includes('carbo') || cat.includes('vegeta') || cat.includes('legum');
      });
      const snackFoods = foods.filter((f: Food) => {
        const cat = normalizeCategory(f.category);
        return cat.includes('frut') || cat.includes('latic') || cat.includes('gordur');
      });
      
      const fallbackMeals: MealPlan[] = mealTypes.map(mealType => {
        let selectedFoods: Food[];
        let quantity: number;
        
        switch (mealType) {
          case 'breakfast':
            selectedFoods = breakfastFoods.slice(0, 3);
            quantity = 100;
            break;
          case 'morning_snack':
          case 'afternoon_snack':
            selectedFoods = snackFoods.slice(0, 2);
            quantity = 80;
            break;
          case 'lunch':
            selectedFoods = mainFoods.slice(0, 4);
            quantity = 150;
            break;
          case 'dinner':
            selectedFoods = mainFoods.slice(2, 5);
            quantity = 120;
            break;
          case 'supper':
            selectedFoods = snackFoods.slice(1, 3);
            quantity = 60;
            break;
          default:
            selectedFoods = mainFoods.slice(0, 3);
            quantity = 100;
        }
        
        return {
          name: mealType,
          foods: selectedFoods.map((f: Food) => ({ food_id: f.id, quantity }))
        };
      });
      
      mealPlan = { meals: fallbackMeals };
    }

    // Calculate initial totals
    let totalCalories = 0;
    const mealsWithNutrients = mealPlan.meals.map((meal) => {
      let mealCal = 0, mealP = 0, mealC = 0, mealF = 0;
      const mealFoods: Array<{ food_id: string; quantity: number; nutrients: ReturnType<typeof calcNutrients> }> = [];
      
      for (const f of meal.foods || []) {
        const food = foods.find((fd: Food) => fd.id === f.food_id);
        if (!food) continue;
        
        const qty = Math.min(500, Math.max(10, f.quantity || 100));
        const nutrients = calcNutrients(food, qty);
        
        mealCal += nutrients.calories;
        mealP += nutrients.protein;
        mealC += nutrients.carbs;
        mealF += nutrients.fat;
        
        mealFoods.push({ food_id: f.food_id, quantity: qty, nutrients });
      }
      
      totalCalories += mealCal;
      return { ...meal, foods: mealFoods, total_calories: mealCal, total_protein: mealP, total_carbs: mealC, total_fat: mealF };
    });

    // Scale adjustment
    const scaleFactor = totalCalories > 0 ? targetCalories / totalCalories : 1;
    
    let finalTotalCal = 0, finalTotalP = 0, finalTotalC = 0, finalTotalF = 0;
    
    const adjustedMeals = mealsWithNutrients.map((meal) => {
      let mealCal = 0, mealP = 0, mealC = 0, mealF = 0;
      const adjustedFoods = meal.foods.map((f) => {
        const food = foods.find((fd: Food) => fd.id === f.food_id);
        if (!food) return f;
        
        const scaledQty = Math.round((f.quantity * scaleFactor) / 5) * 5;
        const finalQty = Math.min(500, Math.max(10, scaledQty));
        const nutrients = calcNutrients(food, finalQty);
        
        mealCal += nutrients.calories;
        mealP += nutrients.protein;
        mealC += nutrients.carbs;
        mealF += nutrients.fat;
        
        return { food_id: f.food_id, quantity: finalQty };
      });
      
      finalTotalCal += mealCal;
      finalTotalP += mealP;
      finalTotalC += mealC;
      finalTotalF += mealF;
      
      return {
        name: meal.name,
        foods: adjustedFoods,
        total_calories: Math.round(mealCal),
        total_protein: Math.round(mealP * 10) / 10,
        total_carbs: Math.round(mealC * 10) / 10,
        total_fat: Math.round(mealF * 10) / 10,
      };
    });

    if (!adjustedMeals.length) {
      logStep("Failed to generate meals");
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    // Save diet plan - use targetUserId (student or self)
    const { data: plan, error: planError } = await supabase.from("diet_plans").insert({
      user_id: targetUserId,
      total_calories: Math.round(finalTotalCal),
      total_protein: Math.round(finalTotalP * 10) / 10,
      total_carbs: Math.round(finalTotalC * 10) / 10,
      total_fat: Math.round(finalTotalF * 10) / 10,
      status: 'active',
    }).select().single();

    if (planError || !plan) {
      logStep("Failed to create diet plan", { error: planError?.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    // Increment usage after successful plan creation
    await supabase.rpc('increment_usage', {
      _user_id: user.id,
      _feature: 'diet',
    });

    // Use the plan's meal options limit (fetched earlier)
    // Free plan = 1 option, Paid plans = 3 options (configurable via plans.meal_options_limit)
    const OPTIONS_PER_MEAL = mealOptionsLimit;
    // Save meals with v2 schema (meal_options and meal_option_foods)
    for (let sortOrder = 0; sortOrder < adjustedMeals.length; sortOrder++) {
      const meal = adjustedMeals[sortOrder];
      const { data: savedMeal, error: mealError } = await supabase.from("meals").insert({
        diet_plan_id: plan.id,
        name: meal.name,
        sort_order: sortOrder,
        total_calories: meal.total_calories,
        total_protein: meal.total_protein,
        total_carbs: meal.total_carbs,
        total_fat: meal.total_fat,
      }).select().single();
      
      if (mealError || !savedMeal) {
        logStep("Failed to create meal", { error: mealError?.message });
        continue;
      }

      // Create multiple meal options (nutritionally equivalent)
      for (let optionNum = 1; optionNum <= OPTIONS_PER_MEAL; optionNum++) {
        let optionFoods = meal.foods;
        let optionCalories = meal.total_calories;
        let optionProtein = meal.total_protein;
        let optionCarbs = meal.total_carbs;
        let optionFat = meal.total_fat;
        
        // For option 2+, generate equivalent alternatives
        if (optionNum > 1) {
          const equivalentFoods = generateEquivalentOption(
            meal.foods,
            foods,
            meal.total_calories,
            meal.total_protein,
            meal.total_carbs,
            meal.total_fat,
            restrictions,
            meal.name as MealType
          );
          
          // Recalculate macros for the equivalent option
          let eqCal = 0, eqP = 0, eqC = 0, eqF = 0;
          for (const ef of equivalentFoods) {
            const food = foods.find((fd: Food) => fd.id === ef.food_id);
            if (food) {
              const nutrients = calcNutrients(food, ef.quantity);
              eqCal += nutrients.calories;
              eqP += nutrients.protein;
              eqC += nutrients.carbs;
              eqF += nutrients.fat;
            }
          }
          
          optionFoods = equivalentFoods;
          optionCalories = Math.round(eqCal);
          optionProtein = Math.round(eqP * 10) / 10;
          optionCarbs = Math.round(eqC * 10) / 10;
          optionFat = Math.round(eqF * 10) / 10;
        }
        
        const { data: savedOption, error: optionError } = await supabase.from("meal_options").insert({
          meal_id: savedMeal.id,
          option_number: optionNum,
          name: optionNum === 1 ? 'Opção Principal' : `Opção ${optionNum}`,
          total_calories: optionCalories,
          total_protein: optionProtein,
          total_carbs: optionCarbs,
          total_fat: optionFat,
        }).select().single();

        if (optionError || !savedOption) {
          logStep("Failed to create meal option", { error: optionError?.message, optionNum });
          continue;
        }

        // Insert foods into meal_option_foods (v2 schema)
        for (const food of optionFoods) {
          if (food.food_id) {
            await supabase.from("meal_option_foods").insert({ 
              meal_option_id: savedOption.id, 
              food_id: food.food_id, 
              quantity_grams: food.quantity,
            });
          }
        }
      }
    }

    return createSuccessResponse({ success: true, plan }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
