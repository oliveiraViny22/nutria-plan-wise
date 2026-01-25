// =====================================================
// GERADOR DE PLANO ALIMENTAR v4 - EXPERIMENTAL COM IA
// =====================================================
// Esta versão usa IA para otimizar a seleção de alimentos
// e garantir melhor distribuição de macros.
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// TIPOS
// =====================================================

interface ProfileInput {
  daily_calories: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  preferences?: string[];
  restrictions?: string[];
  preferred_foods?: string[];
  avoided_foods?: string[];
  goal?: string;
  meals_per_day?: number;
}

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  serving_size: string | null;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number | null;
  unit_enabled: boolean | null;
}

interface MealPlan {
  meals: Array<{
    name: string;
    type: string;
    foods: Array<{
      food_id: string;
      food_name: string;
      quantity_grams: number;
      display_quantity: number;
      display_unit: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    }>;
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
  }>;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const MEAL_TYPES = {
  2: ['lunch', 'dinner'],
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'lunch', 'afternoon_snack', 'dinner'],
  5: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'],
  6: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'],
};

const MEAL_NAMES: Record<string, string> = {
  breakfast: 'Café da Manhã',
  morning_snack: 'Lanche da Manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da Tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
};

const MEAL_DISTRIBUTIONS: Record<string, number> = {
  breakfast: 0.22,
  morning_snack: 0.08,
  lunch: 0.30,
  afternoon_snack: 0.10,
  dinner: 0.25,
  supper: 0.05,
};

// =====================================================
// HELPERS
// =====================================================

const log = (step: string, data?: unknown) => {
  console.log(`[V4-EXPERIMENTAL] ${step}`, data ? JSON.stringify(data) : '');
};

function applyUnitConversion(food: Food, grams: number): {
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
} {
  if (!food.unit_enabled || !food.unit_name || !food.unit_weight_grams) {
    return {
      display_quantity: Math.round(grams),
      display_unit: 'g',
      calculated_grams: grams,
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
      display_quantity: roundedUnits,
      display_unit: food.unit_name,
      calculated_grams: finalGrams,
    };
  }

  return {
    display_quantity: Math.round(grams),
    display_unit: 'g',
    calculated_grams: grams,
  };
}

// =====================================================
// SELEÇÃO DE ALIMENTOS COM IA
// =====================================================

async function selectFoodsWithAI(
  foods: Food[],
  profile: ProfileInput,
  mealTypes: string[],
  lovableApiKey: string
): Promise<MealPlan | null> {
  // Preparar lista de alimentos disponíveis por categoria
  const foodsByCategory: Record<string, Food[]> = {};
  for (const food of foods) {
    const cat = food.category.toLowerCase();
    if (!foodsByCategory[cat]) foodsByCategory[cat] = [];
    foodsByCategory[cat].push(food);
  }

  // Criar prompt para a IA
  const prompt = `Você é um nutricionista criando um plano alimentar personalizado.

PERFIL DO PACIENTE:
- Meta calórica: ${profile.daily_calories} kcal/dia
- Proteína: ${profile.protein_target}g/dia
- Carboidratos: ${profile.carbs_target}g/dia
- Gorduras: ${profile.fat_target}g/dia
- Objetivo: ${profile.goal || 'manter peso'}
- Preferências: ${profile.preferences?.join(', ') || 'nenhuma'}
- Restrições: ${profile.restrictions?.join(', ') || 'nenhuma'}
- Alimentos preferidos: ${profile.preferred_foods?.join(', ') || 'nenhum específico'}
- Alimentos a evitar: ${profile.avoided_foods?.join(', ') || 'nenhum'}

REFEIÇÕES A PLANEJAR: ${mealTypes.map(t => MEAL_NAMES[t]).join(', ')}

DISTRIBUIÇÃO CALÓRICA:
${mealTypes.map(t => `- ${MEAL_NAMES[t]}: ${Math.round(profile.daily_calories * MEAL_DISTRIBUTIONS[t])} kcal`).join('\n')}

ALIMENTOS DISPONÍVEIS POR CATEGORIA:
${Object.entries(foodsByCategory).map(([cat, items]) => 
  `\n${cat.toUpperCase()}:\n${items.slice(0, 15).map(f => 
    `- ${f.name} (${f.calories}kcal, P:${f.protein}g, C:${f.carbs}g, G:${f.fat}g por 100g)`
  ).join('\n')}`
).join('\n')}

REGRAS OBRIGATÓRIAS:
1. TODAS as refeições principais (café, almoço, jantar) devem ter proteína
2. Manter calorias totais dentro de ±10% da meta
3. Priorizar alimentos preferidos do paciente
4. Evitar alimentos na lista de evitados
5. Variedade: não repetir o mesmo alimento em refeições diferentes
6. Café da manhã: incluir carboidrato (pão, aveia, tapioca) + proteína (ovo, queijo)
7. Almoço/Jantar: arroz/batata + proteína (frango, carne, peixe) + salada/legumes
8. Lanches: frutas, iogurte, castanhas

Retorne APENAS um JSON válido (sem markdown, sem explicações) no formato:
{
  "meals": [
    {
      "type": "breakfast",
      "foods": [
        {"food_name": "nome exato do alimento", "quantity_grams": 100}
      ]
    }
  ],
  "reasoning": "breve explicação das escolhas (max 100 palavras)"
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um nutricionista especializado em criar planos alimentares. Responda APENAS com JSON válido, sem markdown."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      log("AI request failed", { status: response.status });
      return null;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      log("No AI response content");
      return null;
    }

    log("AI response received", { length: content.length });

    // Tentar parsear o JSON (pode estar com markdown)
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonStr = content.split('```')[1].split('```')[0].trim();
    }

    const aiPlan = JSON.parse(jsonStr);
    log("AI plan parsed", { mealsCount: aiPlan.meals?.length });

    // Converter o plano da IA para o formato interno
    const mealPlan: MealPlan = {
      meals: [],
      total_calories: 0,
      total_protein: 0,
      total_carbs: 0,
      total_fat: 0,
    };

    const foodsMap = new Map(foods.map(f => [f.name.toLowerCase(), f]));

    for (const aiMeal of aiPlan.meals || []) {
      const mealFoods: MealPlan['meals'][0]['foods'] = [];
      let mealCal = 0, mealProt = 0, mealCarbs = 0, mealFat = 0;

      for (const aiFood of aiMeal.foods || []) {
        // Encontrar alimento correspondente
        const foodName = aiFood.food_name?.toLowerCase() || '';
        let matchedFood = foodsMap.get(foodName);

        // Se não encontrou exato, buscar por similaridade
        if (!matchedFood) {
          for (const [name, food] of foodsMap) {
            if (name.includes(foodName) || foodName.includes(name)) {
              matchedFood = food;
              break;
            }
          }
        }

        if (matchedFood) {
          const grams = aiFood.quantity_grams || 100;
          const mult = grams / 100;
          const conversion = applyUnitConversion(matchedFood, grams);

          const foodEntry = {
            food_id: matchedFood.id,
            food_name: matchedFood.name,
            quantity_grams: grams,
            display_quantity: conversion.display_quantity,
            display_unit: conversion.display_unit,
            calories: Math.round(matchedFood.calories * mult),
            protein: Math.round(matchedFood.protein * mult * 10) / 10,
            carbs: Math.round(matchedFood.carbs * mult * 10) / 10,
            fat: Math.round(matchedFood.fat * mult * 10) / 10,
          };

          mealFoods.push(foodEntry);
          mealCal += foodEntry.calories;
          mealProt += foodEntry.protein;
          mealCarbs += foodEntry.carbs;
          mealFat += foodEntry.fat;
        } else {
          log("Food not found", { name: aiFood.food_name });
        }
      }

      if (mealFoods.length > 0) {
        mealPlan.meals.push({
          name: MEAL_NAMES[aiMeal.type] || aiMeal.type,
          type: aiMeal.type,
          foods: mealFoods,
          total_calories: Math.round(mealCal),
          total_protein: Math.round(mealProt * 10) / 10,
          total_carbs: Math.round(mealCarbs * 10) / 10,
          total_fat: Math.round(mealFat * 10) / 10,
        });

        mealPlan.total_calories += mealCal;
        mealPlan.total_protein += mealProt;
        mealPlan.total_carbs += mealCarbs;
        mealPlan.total_fat += mealFat;
      }
    }

    // Arredondar totais
    mealPlan.total_calories = Math.round(mealPlan.total_calories);
    mealPlan.total_protein = Math.round(mealPlan.total_protein);
    mealPlan.total_carbs = Math.round(mealPlan.total_carbs);
    mealPlan.total_fat = Math.round(mealPlan.total_fat);

    return mealPlan;
  } catch (error) {
    log("AI selection error", { error: String(error) });
    return null;
  }
}

// =====================================================
// VALIDAÇÃO DO PLANO
// =====================================================

function validatePlan(
  plan: MealPlan,
  profile: ProfileInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Verificar tolerância calórica (±10%)
  const calorieDiff = Math.abs(plan.total_calories - profile.daily_calories);
  const caloriePercent = (calorieDiff / profile.daily_calories) * 100;
  if (caloriePercent > 10) {
    errors.push(`Calorias fora da tolerância: ${plan.total_calories} kcal (meta: ${profile.daily_calories} kcal, diferença: ${caloriePercent.toFixed(1)}%)`);
  }

  // Verificar proteína mínima (80% da meta)
  const proteinMin = profile.protein_target * 0.8;
  if (plan.total_protein < proteinMin) {
    errors.push(`Proteína insuficiente: ${plan.total_protein}g (mínimo: ${proteinMin}g)`);
  }

  // Verificar se todas as refeições têm alimentos
  for (const meal of plan.meals) {
    if (meal.foods.length === 0) {
      errors.push(`Refeição vazia: ${meal.name}`);
    }

    // Verificar proteína em refeições principais
    const mainMeals = ['breakfast', 'lunch', 'dinner'];
    if (mainMeals.includes(meal.type) && meal.total_protein < 10) {
      errors.push(`Proteína baixa no ${meal.name}: ${meal.total_protein}g (mínimo: 10g)`);
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
  plan: MealPlan
): Promise<string> {
  // Desativar planos anteriores
  await supabase
    .from('diet_plans')
    .update({ status: 'inactive' })
    .eq('user_id', userId)
    .eq('status', 'active');

  // Criar novo plano
  const { data: dietPlan, error: planError } = await supabase
    .from('diet_plans')
    .insert({
      user_id: userId,
      status: 'active',
      total_calories: plan.total_calories,
      total_protein: plan.total_protein,
      total_carbs: plan.total_carbs,
      total_fat: plan.total_fat,
    })
    .select()
    .single();

  if (planError) throw planError;

  // Criar refeições
  for (let i = 0; i < plan.meals.length; i++) {
    const meal = plan.meals[i];

    const { data: mealData, error: mealError } = await supabase
      .from('meals')
      .insert({
        diet_plan_id: dietPlan.id,
        name: meal.name,
        sort_order: i + 1,
        total_calories: meal.total_calories,
        total_protein: meal.total_protein,
        total_carbs: meal.total_carbs,
        total_fat: meal.total_fat,
      })
      .select()
      .single();

    if (mealError) throw mealError;

    // Criar opção de refeição
    const { data: optionData, error: optionError } = await supabase
      .from('meal_options')
      .insert({
        meal_id: mealData.id,
        option_number: 1,
        name: 'Opção Principal',
        total_calories: meal.total_calories,
        total_protein: meal.total_protein,
        total_carbs: meal.total_carbs,
        total_fat: meal.total_fat,
      })
      .select()
      .single();

    if (optionError) throw optionError;

    // Adicionar alimentos à opção
    for (const food of meal.foods) {
      await supabase.from('meal_option_foods').insert({
        meal_option_id: optionData.id,
        food_id: food.food_id,
        quantity_grams: food.quantity_grams,
        display_quantity: food.display_quantity,
        display_unit: food.display_unit,
        calculated_grams: food.quantity_grams,
        unit_locked: true,
      });
    }
  }

  return dietPlan.id;
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticação
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
    const profile = body.profile as ProfileInput;

    if (!profile || !profile.daily_calories) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Perfil incompleto" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Starting generation", { userId: user.id, calories: profile.daily_calories });

    // Buscar alimentos disponíveis
    const { data: foods, error: foodsError } = await supabase
      .from('foods')
      .select('*')
      .eq('is_active', true);

    if (foodsError || !foods || foods.length === 0) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Nenhum alimento disponível" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Foods loaded", { count: foods.length });

    // Filtrar alimentos por restrições
    const restrictions = profile.restrictions || [];
    const avoidedFoods = profile.avoided_foods || [];
    const eligibleFoods = foods.filter(f => {
      const name = f.name.toLowerCase();
      const category = f.category.toLowerCase();

      // Verificar restrições
      for (const r of restrictions) {
        const rest = r.toLowerCase();
        if (rest.includes('lactose') && category === 'laticinios') return false;
        if (rest.includes('gluten') && (name.includes('trigo') || name.includes('pão'))) return false;
        if (rest.includes('vegetariano') && category === 'proteinas' && !name.includes('ovo')) return false;
      }

      // Verificar alimentos a evitar
      for (const a of avoidedFoods) {
        if (name.includes(a.toLowerCase())) return false;
      }

      return true;
    });

    log("Eligible foods", { count: eligibleFoods.length });

    // Determinar refeições
    const mealsPerDay = profile.meals_per_day || 4;
    const mealTypes = MEAL_TYPES[mealsPerDay as keyof typeof MEAL_TYPES] || MEAL_TYPES[4];

    // Gerar plano com IA (se disponível)
    let mealPlan: MealPlan | null = null;

    if (lovableApiKey) {
      log("Using AI for food selection");
      mealPlan = await selectFoodsWithAI(eligibleFoods, profile, mealTypes, lovableApiKey);
    }

    if (!mealPlan) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Falha na geração do plano com IA" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar plano
    const validation = validatePlan(mealPlan, profile);
    log("Plan validation", validation);

    if (!validation.valid) {
      return new Response(JSON.stringify({ 
        success: false,
        error: "Plano não passou na validação",
        validationErrors: validation.errors,
        totalCalories: mealPlan.total_calories,
        totalProtein: mealPlan.total_protein,
        totalCarbs: mealPlan.total_carbs,
        totalFat: mealPlan.total_fat,
        mealsCount: mealPlan.meals.length,
      }), {
        status: 200, // Retornamos 200 para mostrar os detalhes
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Salvar plano
    const planId = await savePlan(supabase, user.id, mealPlan);
    log("Plan saved", { planId });

    return new Response(JSON.stringify({ 
      success: true,
      planId,
      totalCalories: mealPlan.total_calories,
      totalProtein: mealPlan.total_protein,
      totalCarbs: mealPlan.total_carbs,
      totalFat: mealPlan.total_fat,
      mealsCount: mealPlan.meals.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    log("Error", { error: String(error) });
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
