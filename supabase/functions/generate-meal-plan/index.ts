import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  serving_size: string;
  category: string;
}

interface MealFood {
  food_id: string;
  quantity: number; // in grams/ml
}

interface MealPlan {
  name: string;
  foods: MealFood[];
}

// Parse serving_size to extract base grams (e.g., "100g" -> 100, "1 unidade (50g)" -> 50)
function parseServingGrams(servingSize: string): number {
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  // Fallback: try to extract from parentheses
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100; // Default to 100g
}

// Calculate nutrients for a given quantity in grams
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Unauthorized");

    const { data: foods, error: foodsError } = await supabase.from("foods").select("*");
    if (foodsError) throw new Error("Failed to load foods");
    if (!foods || foods.length === 0) throw new Error("No foods available");

    const targetCalories = profile.daily_calories || 2000;
    const targetProtein = profile.protein_target || 150;
    const targetCarbs = profile.carbs_target || 250;
    const targetFat = profile.fat_target || 70;

    // AI prompt asking for quantities in grams
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
Preferências: ${profile.preferences?.join(", ") || "nenhuma"}. 
Restrições: ${profile.restrictions?.join(", ") || "nenhuma"}. 
Objetivo: ${profile.goal}.

REGRAS IMPORTANTES:
1. As quantidades devem ser em GRAMAS ou ML (não porções).
2. O total de calorias do plano DEVE ser EXATAMENTE ${targetCalories} calorias (margem de ±10 kcal).
3. Distribua as calorias: café da manhã 25%, almoço 35%, jantar 30%, lanche 10%.
4. Use quantidades realistas (ex: 150g de arroz, 200ml de leite, 120g de frango).` 
          },
          { 
            role: "user", 
            content: `Alimentos disponíveis (id, nome, calorias por porção base, tamanho porção):
${foods.slice(0, 40).map((f: Food) => `- ${f.id}: ${f.name}, ${f.calories}kcal/${f.serving_size}, categoria: ${f.category}`).join("\n")}

Retorne APENAS JSON válido:
{ "meals": [{ "name": "breakfast|lunch|dinner|snack", "foods": [{ "food_id": "uuid", "quantity": 150 }] }] }

Lembre-se: quantity em gramas/ml, total EXATO de ${targetCalories} calorias!` 
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
      // Fallback simple plan - proportional to calorie targets
      const breakfastFoods = foods.filter((f: Food) => ["cereais", "frutas", "laticinios"].includes(f.category));
      const mainFoods = foods.filter((f: Food) => ["proteinas", "carboidratos", "vegetais", "leguminosas"].includes(f.category));
      
      mealPlan = {
        meals: [
          { name: "breakfast", foods: breakfastFoods.slice(0, 3).map((f: Food) => ({ food_id: f.id, quantity: 100 })) },
          { name: "lunch", foods: mainFoods.slice(0, 4).map((f: Food) => ({ food_id: f.id, quantity: 150 })) },
          { name: "dinner", foods: mainFoods.slice(2, 5).map((f: Food) => ({ food_id: f.id, quantity: 120 })) },
          { name: "snack", foods: breakfastFoods.slice(1, 3).map((f: Food) => ({ food_id: f.id, quantity: 80 })) },
        ]
      };
    }

    // Calculate initial totals
    let totalCalories = 0;
    const mealsWithNutrients = mealPlan.meals.map((meal) => {
      let mealCal = 0, mealP = 0, mealC = 0, mealF = 0;
      const mealFoods: Array<{ food_id: string; quantity: number; nutrients: ReturnType<typeof calcNutrients> }> = [];
      
      for (const f of meal.foods || []) {
        const food = foods.find((fd: Food) => fd.id === f.food_id);
        if (!food) continue;
        
        // Clamp quantity to reasonable range (10g - 500g)
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

    // SCALE ADJUSTMENT: adjust all quantities proportionally to hit exact target
    const scaleFactor = totalCalories > 0 ? targetCalories / totalCalories : 1;
    
    let finalTotalCal = 0, finalTotalP = 0, finalTotalC = 0, finalTotalF = 0;
    
    const adjustedMeals = mealsWithNutrients.map((meal) => {
      let mealCal = 0, mealP = 0, mealC = 0, mealF = 0;
      const adjustedFoods = meal.foods.map((f) => {
        const food = foods.find((fd: Food) => fd.id === f.food_id);
        if (!food) return f;
        
        // Scale quantity and round to nearest 5g for cleaner display
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

    if (!adjustedMeals.length) throw new Error("Failed to generate meals");

    // Save diet plan with exact target (actual may vary slightly due to rounding)
    const { data: plan, error: planError } = await supabase.from("diet_plans").insert({
      user_id: user.id,
      total_calories: Math.round(finalTotalCal),
      total_protein: Math.round(finalTotalP * 10) / 10,
      total_carbs: Math.round(finalTotalC * 10) / 10,
      total_fat: Math.round(finalTotalF * 10) / 10,
    }).select().single();

    if (planError || !plan) {
      console.error("Failed to create diet plan:", planError);
      throw new Error(`Failed to create diet plan: ${planError?.message || "unknown"}`);
    }

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
        console.error("Failed to create meal:", mealError);
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

    return new Response(JSON.stringify({ success: true, plan }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e: unknown) {
    console.error("Error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
