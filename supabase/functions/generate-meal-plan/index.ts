import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { profile } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from auth header
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Unauthorized");

    // Get foods from database
    const { data: foods, error: foodsError } = await supabase.from("foods").select("*");
    if (foodsError) {
      console.error("Failed to load foods:", foodsError);
      throw new Error("Failed to load foods");
    }
    if (!foods || foods.length === 0) throw new Error("No foods available");

    const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const parseQty = (q: unknown) => {
      const n = typeof q === "number" ? q : Number(q);
      if (!Number.isFinite(n) || n <= 0) return 1;
      // Treat quantity as "servings" (not grams). Clamp to avoid absurd AI outputs.
      return clamp(n, 0.25, 5);
    };

    // Generate meal plan using AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `You are a nutritionist. Create a daily meal plan in JSON format. The user's target is ${profile.daily_calories} calories, ${profile.protein_target}g protein, ${profile.carbs_target}g carbs, ${profile.fat_target}g fat. Preferences: ${profile.preferences?.join(", ") || "none"}. Restrictions: ${profile.restrictions?.join(", ") || "none"}. Goal: ${profile.goal}. IMPORTANT: quantities must be small serving multipliers like 0.5, 1, 1.5, 2 (NOT grams).` },
          { role: "user", content: `Available foods: ${JSON.stringify(foods.slice(0, 30).map((f) => ({ id: f.id, name: f.name, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat })))}. Create a balanced meal plan with breakfast, lunch, dinner, and snack. Return ONLY valid JSON: { "meals": [{ "name": "breakfast|lunch|dinner|snack", "foods": [{ "food_id": "uuid", "quantity": 1 }] }] }` }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    let mealPlan;
    try {
      const content = aiData.choices[0].message.content.replace(/```json|```/g, "").trim();
      mealPlan = JSON.parse(content);
    } catch {
      // Fallback simple plan
      const breakfastFoods = foods.filter((f) => ["cereais", "frutas", "laticinios"].includes(f.category)) || [];
      const lunchFoods = foods.filter((f) => ["proteinas", "carboidratos", "vegetais"].includes(f.category)) || [];
      mealPlan = {
        meals: [
          { name: "breakfast", foods: breakfastFoods.slice(0, 3).map((f) => ({ food_id: f.id, quantity: 1 })) },
          { name: "lunch", foods: lunchFoods.slice(0, 4).map((f) => ({ food_id: f.id, quantity: 1 })) },
          { name: "dinner", foods: lunchFoods.slice(2, 5).map((f) => ({ food_id: f.id, quantity: 1 })) },
          { name: "snack", foods: breakfastFoods.slice(1, 3).map((f) => ({ food_id: f.id, quantity: 1 })) },
        ]
      };
    }

    // Calculate totals and save
    let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
    const mealsData = (mealPlan?.meals || []).map((m: any) => {
      let mealCal = 0, mealP = 0, mealC = 0, mealF = 0;
      (m.foods || []).forEach((f: any) => {
        const quantity = parseQty(f?.quantity);
        const food = foods.find((fd) => fd.id === f.food_id);
        if (food) {
          mealCal += food.calories * quantity;
          mealP += Number(food.protein) * quantity;
          mealC += Number(food.carbs) * quantity;
          mealF += Number(food.fat) * quantity;
        }
      });
      totalCal += mealCal; totalP += mealP; totalC += mealC; totalF += mealF;
      return {
        ...m,
        total_calories: Math.round(mealCal),
        total_protein: round2(mealP),
        total_carbs: round2(mealC),
        total_fat: round2(mealF),
        foods: (m.foods || []).map((f: any) => ({
          ...f,
          quantity: parseQty(f?.quantity),
        })),
      };
    });

    if (!mealsData.length) throw new Error("Failed to generate meals");

    // Save diet plan
    const { data: plan, error: planError } = await supabase.from("diet_plans").insert({
      user_id: user.id,
      total_calories: Math.round(totalCal),
      total_protein: round2(totalP),
      total_carbs: round2(totalC),
      total_fat: round2(totalF),
    }).select().single();

    if (planError || !plan) {
      console.error("Failed to create diet plan:", planError);
      throw new Error(`Failed to create diet plan: ${planError?.message || "unknown"}`);
    }

    // Save meals
    for (const meal of mealsData) {
      const { data: savedMeal, error: mealError } = await supabase.from("meals").insert({
        diet_plan_id: plan.id, name: meal.name, total_calories: meal.total_calories,
        total_protein: meal.total_protein, total_carbs: meal.total_carbs, total_fat: meal.total_fat
      }).select().single();
      
      if (mealError || !savedMeal) {
        console.error("Failed to create meal:", mealError);
        continue;
      }

      for (const food of meal.foods || []) {
        if (food.food_id) {
          await supabase.from("meal_foods").insert({ meal_id: savedMeal.id, food_id: food.food_id, quantity: food.quantity || 1 });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, plan }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    console.error("Error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
