import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  // Campos de conversão de unidades
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number;
  unit_enabled: boolean;
}

interface FoodWithDisplay {
  food: Food;
  quantity: number; // gramas originais do cálculo
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

// ========================================================
// CONVERSÃO DETERMINÍSTICA DE UNIDADES
// Princípio: Gramas são verdade nutricional, unidades são apresentação
// ========================================================

interface ConversionResult {
  success: boolean;
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
  error_percent: number;
}

/**
 * Converte gramas para unidades de forma determinística.
 * Esta função NÃO usa IA - é puramente matemática.
 */
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
      display_unit: '', // Será preenchido com unit_name
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

/**
 * Aplica conversão de unidade para um alimento.
 * Retorna dados prontos para persistência.
 */
function applyUnitConversion(
  food: Food,
  quantityGrams: number
): FoodWithDisplay {
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

function selectFoodsForMeal(
  foods: Food[],
  targetCalories: number,
  targetProtein: number,
  targetCarbs: number,
  targetFat: number,
  preferences: string[],
  restrictions: string[],
  category: string
): { food: Food; quantity: number }[] {
  // Filter foods based on restrictions and preferences
  let availableFoods = foods.filter(f => {
    const nameLower = f.name.toLowerCase();
    for (const restriction of restrictions) {
      if (nameLower.includes(restriction.toLowerCase())) return false;
    }
    return true;
  });
  
  // Prioritize preferred foods
  if (preferences.length > 0) {
    availableFoods.sort((a, b) => {
      const aPreferred = preferences.some(p => a.name.toLowerCase().includes(p.toLowerCase()));
      const bPreferred = preferences.some(p => b.name.toLowerCase().includes(p.toLowerCase()));
      return (bPreferred ? 1 : 0) - (aPreferred ? 1 : 0);
    });
  }
  
  const selected: { food: Food; quantity: number }[] = [];
  let currentCalories = 0;
  let currentProtein = 0;
  let currentCarbs = 0;
  let currentFat = 0;
  
  // Select protein source first
  const proteinFoods = availableFoods.filter(f => 
    f.category === 'proteina' || f.protein > 15
  );
  if (proteinFoods.length > 0) {
    const protein = proteinFoods[Math.floor(Math.random() * Math.min(5, proteinFoods.length))];
    const quantity = Math.max(0.5, Math.min(2, targetProtein / protein.protein));
    selected.push({ food: protein, quantity });
    currentCalories += protein.calories * quantity;
    currentProtein += protein.protein * quantity;
    currentCarbs += protein.carbs * quantity;
    currentFat += protein.fat * quantity;
  }
  
  // Add carbs source
  const carbFoods = availableFoods.filter(f => 
    f.category === 'carboidrato' || f.carbs > 20
  );
  if (carbFoods.length > 0 && currentCarbs < targetCarbs * 0.8) {
    const carb = carbFoods[Math.floor(Math.random() * Math.min(5, carbFoods.length))];
    const quantity = Math.max(0.5, Math.min(2, (targetCarbs - currentCarbs) / carb.carbs));
    selected.push({ food: carb, quantity });
    currentCalories += carb.calories * quantity;
    currentProtein += carb.protein * quantity;
    currentCarbs += carb.carbs * quantity;
    currentFat += carb.fat * quantity;
  }
  
  // Add vegetables/fiber
  const veggies = availableFoods.filter(f => 
    f.category === 'vegetal' || f.category === 'legume'
  );
  if (veggies.length > 0) {
    const veg = veggies[Math.floor(Math.random() * Math.min(5, veggies.length))];
    selected.push({ food: veg, quantity: 1 });
    currentCalories += veg.calories;
    currentProtein += veg.protein;
    currentCarbs += veg.carbs;
    currentFat += veg.fat;
  }
  
  // Add healthy fat if needed
  if (currentFat < targetFat * 0.6) {
    const fatFoods = availableFoods.filter(f => 
      f.category === 'gordura' || f.fat > 10
    );
    if (fatFoods.length > 0) {
      const fat = fatFoods[Math.floor(Math.random() * Math.min(3, fatFoods.length))];
      const quantity = Math.max(0.3, Math.min(1, (targetFat - currentFat) / fat.fat));
      selected.push({ food: fat, quantity });
    }
  }
  
  return selected;
}

function generateEquivalentOption(
  baseOption: MealOption,
  foods: Food[],
  preferences: string[],
  restrictions: string[],
  optionNumber: number
): MealOption {
  const targetCalories = baseOption.total_calories;
  const targetProtein = baseOption.total_protein;
  const targetCarbs = baseOption.total_carbs;
  const targetFat = baseOption.total_fat;
  
  // Get different foods that match the targets
  const selectedFoods = selectFoodsForMeal(
    foods.filter(f => !baseOption.foods.some(bf => bf.food.id === f.id)),
    targetCalories,
    targetProtein,
    targetCarbs,
    targetFat,
    preferences,
    restrictions,
    "alternative"
  );
  
  let total_calories = 0;
  let total_protein = 0;
  let total_carbs = 0;
  let total_fat = 0;
  
  // Aplicar conversão determinística de unidades
  const foodsWithDisplay: FoodWithDisplay[] = [];
  
  for (const { food, quantity } of selectedFoods) {
    const converted = applyUnitConversion(food, quantity);
    foodsWithDisplay.push(converted);
    
    // Usar calculated_grams para cálculos nutricionais (verdade)
    const factor = converted.calculated_grams / 100; // assumindo macros por 100g
    total_calories += food.calories * (converted.calculated_grams / quantity) * quantity / 100 * 100;
    total_protein += food.protein * (converted.calculated_grams / quantity) * quantity / 100 * 100;
    total_carbs += food.carbs * (converted.calculated_grams / quantity) * quantity / 100 * 100;
    total_fat += food.fat * (converted.calculated_grams / quantity) * quantity / 100 * 100;
  }
  
  // Recalcular usando gramas convertidos
  total_calories = 0;
  total_protein = 0;
  total_carbs = 0;
  total_fat = 0;
  
  for (const item of foodsWithDisplay) {
    const gramsMultiplier = item.calculated_grams;
    total_calories += item.food.calories * gramsMultiplier;
    total_protein += item.food.protein * gramsMultiplier;
    total_carbs += item.food.carbs * gramsMultiplier;
    total_fat += item.food.fat * gramsMultiplier;
  }
  
  // Scale to match target calories within tolerance
  const scaleFactor = total_calories > 0 ? targetCalories / total_calories : 1;
  if (Math.abs(scaleFactor - 1) > 0.2) {
    for (const item of foodsWithDisplay) {
      const newGrams = item.quantity * scaleFactor;
      const converted = applyUnitConversion(item.food, newGrams);
      item.quantity = newGrams;
      item.display_quantity = converted.display_quantity;
      item.display_unit = converted.display_unit;
      item.calculated_grams = converted.calculated_grams;
    }
    total_calories *= scaleFactor;
    total_protein *= scaleFactor;
    total_carbs *= scaleFactor;
    total_fat *= scaleFactor;
  }
  
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
      optionsPerMeal = 2, // 1-3 options per meal
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

    // Fetch foods
    const { data: foods, error: foodsError } = await supabase
      .from("foods")
      .select("*");

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

    const mealNames = getMealsForCount(mealsPerDay);
    const calorieDistribution = getMealCalorieDistribution(mealsPerDay);

    const mealPlans: MealPlan[] = [];

    for (const mealName of mealNames) {
      const mealCalorieShare = calorieDistribution[mealName] || 0.25;
      const targetMealCalories = Math.round(dailyCalories * mealCalorieShare);
      const targetMealProtein = Math.round(proteinTarget * mealCalorieShare);
      const targetMealCarbs = Math.round(carbsTarget * mealCalorieShare);
      const targetMealFat = Math.round(fatTarget * mealCalorieShare);

      const options: MealOption[] = [];

      // Generate first option
      const rawFirstOptionFoods = selectFoodsForMeal(
        foods,
        targetMealCalories,
        targetMealProtein,
        targetMealCarbs,
        targetMealFat,
        preferences,
        restrictions,
        mealName
      );

      // Aplicar conversão determinística de unidades para a primeira opção
      const firstOptionFoods: FoodWithDisplay[] = rawFirstOptionFoods.map(({ food, quantity }) => 
        applyUnitConversion(food, quantity)
      );

      let total_calories = 0;
      let total_protein = 0;
      let total_carbs = 0;
      let total_fat = 0;

      // Usar calculated_grams para cálculos nutricionais (verdade)
      for (const item of firstOptionFoods) {
        total_calories += item.food.calories * item.calculated_grams;
        total_protein += item.food.protein * item.calculated_grams;
        total_carbs += item.food.carbs * item.calculated_grams;
        total_fat += item.food.fat * item.calculated_grams;
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

      // Generate equivalent options
      const numOptions = Math.min(Math.max(1, optionsPerMeal), 3);
      for (let i = 2; i <= numOptions; i++) {
        const equivalentOption = generateEquivalentOption(
          firstOption,
          foods,
          preferences,
          restrictions,
          i
        );
        
        // Validate equivalence
        const validation = validateEquivalence([firstOption, equivalentOption]);
        if (validation.valid) {
          options.push(equivalentOption);
        }
      }

      mealPlans.push({
        name: mealName,
        options,
      });
    }

    // Calculate totals
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

    // Save to database
    const { data: dietPlan, error: planError } = await supabase
      .from("diet_plans")
      .insert({
        user_id: targetUserId,
        total_calories: totalCalories,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fat: totalFat,
        status: "active",
        is_initial_plan: true,
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

    // Save meals with options
    for (const mealPlan of mealPlans) {
      const { data: meal, error: mealError } = await supabase
        .from("meals")
        .insert({
          diet_plan_id: dietPlan.id,
          name: mealPlan.name,
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

      // Save meal options
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

        // Save option foods com dados de conversão de unidades
        for (const item of option.foods) {
          await supabase
            .from("meal_option_foods")
            .insert({
              meal_option_id: mealOption.id,
              food_id: item.food.id,
              quantity: item.quantity,
              display_quantity: item.display_quantity,
              display_unit: item.display_unit,
              calculated_grams: item.calculated_grams,
              unit_conversion_locked: item.unit_conversion_locked,
            });
        }
      }

      // Also save to meal_foods for backward compatibility
      for (const item of mealPlan.options[0]?.foods || []) {
        await supabase
          .from("meal_foods")
          .insert({
            meal_id: meal.id,
            food_id: item.food.id,
            quantity: item.quantity,
            display_quantity: item.display_quantity,
            display_unit: item.display_unit,
            calculated_grams: item.calculated_grams,
            unit_conversion_locked: item.unit_conversion_locked,
          });
      }
    }

    // Create initial plan version
    await supabase
      .from("plan_versions")
      .insert({
        diet_plan_id: dietPlan.id,
        version_number: 1,
        snapshot: { meals: mealPlans },
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        notes: "Versão inicial do plano",
      });

    // Increment usage
    await supabase.rpc("increment_usage", {
      _user_id: user.id,
      _feature: "diet",
    });

    return new Response(
      JSON.stringify({
        success: true,
        plan: dietPlan,
        meals: mealPlans,
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
