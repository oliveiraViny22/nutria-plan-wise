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

const ALLOWED_PROCESSING_LEVELS = ['in_natura', 'minimamente_processado'];

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
      ? (profileData.preferences as unknown[]).filter(validate.isString).slice(0, 20)
      : [];
    const restrictions = validate.isArray(profileData.restrictions)
      ? (profileData.restrictions as unknown[]).filter(validate.isString).slice(0, 20)
      : [];
    const goal = validate.isString(profileData.goal) ? profileData.goal : 'maintain';
    
    // Validate studentId if provided (must be UUID format)
    const validStudentId = validate.isString(studentId) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentId as string)
      ? studentId as string
      : null;
    
    logStep("Profile validated", { targetCalories, mealsPerDay, studentId: validStudentId });
    
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
      // Verificar permissão para criar plano (usa função do banco)
      const { data: canCreate } = await supabase.rpc('can_create_plan', {
        _user_id: targetUserId,
      });

      if (!canCreate && !validStudentId) {
        logStep("User cannot create plan - limit reached or restricted account type");
        return createErrorResponse('Limite de planos atingido ou conta sem permissão', 403, corsHeaders);
      }

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

    // Filter foods for meal plan generation
    const foods = allFoods.filter((f: Food) => {
      if (f.category === 'suplementos') return false;
      const level = f.processing_level || 'in_natura';
      if (!ALLOWED_PROCESSING_LEVELS.includes(level)) return false;
      return true;
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
Objetivo: ${goal}.

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
6. Tipos de refeição válidos: ${mealTypes.join(', ')}.` 
          },
          { 
            role: "user", 
            content: `Alimentos disponíveis (id, nome, calorias por porção base, tamanho porção, categoria):
${foods.slice(0, 50).map((f: Food) => `- ${f.id}: ${f.name}, ${f.calories}kcal/${f.serving_size}, categoria: ${f.category}`).join("\n")}

Retorne APENAS JSON válido com EXATAMENTE ${mealsPerDay} refeições:
{ "meals": [{ "name": "${mealTypes[0]}|${mealTypes[1]}|...", "foods": [{ "food_id": "uuid", "quantity": 150 }] }] }

Use os tipos de refeição: ${mealTypes.join(', ')}.
Lembre-se: quantity em gramas/ml, total EXATO de ${targetCalories} calorias, sem suplementos!` 
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
      const breakfastFoods = foods.filter((f: Food) => 
        ["cereais_tubérculos", "frutas", "laticínios"].includes(f.category)
      );
      const mainFoods = foods.filter((f: Food) => 
        ["proteínas_animais", "cereais_tubérculos", "hortaliças_folhosas", "leguminosas"].includes(f.category)
      );
      const snackFoods = foods.filter((f: Food) => 
        ["frutas", "laticínios", "óleos_oleaginosas"].includes(f.category)
      );
      
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
      released_to_student: false, // Default to not released
      status: 'active', // Status ativo por padrão
      is_initial_plan: isInitialPlan === true, // Marca se é plano inicial automático
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

    // Save meals
    for (const meal of adjustedMeals) {
      const { data: savedMeal, error: mealError } = await supabase.from("meals").insert({
        diet_plan_id: plan.id,
        name: meal.name,
        total_calories: meal.total_calories,
        total_protein: meal.total_protein,
        total_carbs: meal.total_carbs,
        total_fat: meal.total_fat,
      }).select().single();
      
      if (mealError || !savedMeal) {
        logStep("Failed to create meal", { error: mealError?.message });
        continue;
      }

      for (const food of meal.foods) {
        if (food.food_id) {
          await supabase.from("meal_foods").insert({ 
            meal_id: savedMeal.id, 
            food_id: food.food_id, 
            quantity: food.quantity 
          });
        }
      }
    }

    return createSuccessResponse({ success: true, plan }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
