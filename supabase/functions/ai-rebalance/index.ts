import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MealOptionFood {
  id: string;
  meal_option_id: string;
  food_id: string;
  quantity_grams: number;
  food: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string | null;
    category: string | null;
  };
}

interface MealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  meal_option_foods: MealOptionFood[];
}

interface Meal {
  id: string;
  name: string;
  meal_options: MealOption[];
}

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AdjustmentProposal {
  mealOptionFoodId: string;
  mealId: string;
  mealOptionId: string;
  mealName: string;
  foodName: string;
  foodId: string;
  originalGrams: number;
  newGrams: number;
  reason: string;
}

interface AIRebalanceResponse {
  success: boolean;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros: MacroTargets;
  adjustments: AdjustmentProposal[];
  explanation: string;
  warnings: string[];
}

/**
 * Extrai o peso base em gramas do serving_size.
 * Os macros no banco são sempre "por porção" onde a porção é definida em serving_size.
 * Se serving_size = "100g", então calories/protein/carbs/fat são por 100g.
 * Se serving_size = "1 unidade (50g)", então são por 50g.
 */
function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  // Prioriza formato "(XXg)" ou "(XXml)"
  const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  // Fallback para "XXg" ou "XXml"
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  return 100;
}

/**
 * Calcula macros totais a partir dos alimentos.
 * IMPORTANTE: Os valores de macros no banco são POR PORÇÃO (serving_size).
 * Para obter o valor real, multiplicamos por (quantity_grams / serving_grams).
 */
function calculateMacros(foods: MealOptionFood[]): MacroTargets {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  
  for (const mof of foods) {
    // serving_size define a base dos macros no banco
    const servingGrams = parseServingGrams(mof.food.serving_size);
    // Proporção entre quantidade desejada e porção de referência
    const ratio = mof.quantity_grams / servingGrams;
    
    calories += mof.food.calories * ratio;
    protein += mof.food.protein * ratio;
    carbs += mof.food.carbs * ratio;
    fat += mof.food.fat * ratio;
  }
  
  return {
    calories: Math.round(calories),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { planId, targets } = await req.json();

    if (!planId || !targets) {
      return new Response(
        JSON.stringify({ error: "planId and targets are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar refeições com opções e alimentos
    const { data: meals, error: mealsError } = await supabase
      .from("meals")
      .select(`
        id,
        name,
        meal_options (
          id,
          meal_id,
          option_number,
          name,
          meal_option_foods (
            id,
            meal_option_id,
            food_id,
            quantity_grams,
            food:foods (
              id,
              name,
              calories,
              protein,
              carbs,
              fat,
              serving_size,
              category
            )
          )
        )
      `)
      .eq("diet_plan_id", planId)
      .order("sort_order");

    if (mealsError) throw mealsError;

    const typedMeals = meals as unknown as Meal[];

    // Coletar todos os alimentos da primeira opção de cada refeição
    const allFoods: MealOptionFood[] = [];
    const mealContexts: { mealId: string; mealName: string; optionId: string; foods: MealOptionFood[] }[] = [];

    for (const meal of typedMeals) {
      const firstOption = meal.meal_options.find(o => o.option_number === 1);
      if (firstOption) {
        mealContexts.push({
          mealId: meal.id,
          mealName: meal.name,
          optionId: firstOption.id,
          foods: firstOption.meal_option_foods,
        });
        allFoods.push(...firstOption.meal_option_foods);
      }
    }

    // Calcular macros atuais
    const currentMacros = calculateMacros(allFoods);

    // Preparar contexto para a IA
    const mealDetails = mealContexts.map(ctx => ({
      mealName: ctx.mealName,
      foods: ctx.foods.map(f => {
        const servingGrams = parseServingGrams(f.food.serving_size);
        return {
          id: f.id,
          name: f.food.name,
          grams: f.quantity_grams,
          // Normalizar para por 100g para que a IA faça cálculos consistentes
          per100g: {
            calories: Math.round((f.food.calories / servingGrams) * 100),
            protein: Math.round(((f.food.protein / servingGrams) * 100) * 10) / 10,
            carbs: Math.round(((f.food.carbs / servingGrams) * 100) * 10) / 10,
            fat: Math.round(((f.food.fat / servingGrams) * 100) * 10) / 10,
          },
          category: f.food.category,
          servingSize: f.food.serving_size,
        };
      }),
    }));

    const systemPrompt = `Você é um nutricionista expert em ajuste de planos alimentares. Sua tarefa é analisar um plano alimentar e propor ajustes de porções para atingir metas específicas de macronutrientes.

REGRAS IMPORTANTES:
1. Só ajuste porções de alimentos existentes - NÃO adicione nem remova alimentos
2. Mantenha proporções razoáveis (mínimo 20g, máximo 400g por alimento)
3. Priorize ajustes em alimentos ricos no macronutriente em déficit
4. Considere a palatabilidade - não faça ajustes extremos
5. Para proteína: ajuste carnes, ovos, laticínios, leguminosas
6. Para carboidratos: ajuste arroz, batata, pães, frutas
7. Para gordura: ajuste azeite, castanhas, queijos
8. Sempre explique o raciocínio dos ajustes`;

    const userPrompt = `Analise este plano alimentar e proponha ajustes para atingir as metas.

METAS DO USUÁRIO:
- Calorias: ${targets.calories} kcal
- Proteína: ${targets.protein}g
- Carboidratos: ${targets.carbs}g
- Gordura: ${targets.fat}g

MACROS ATUAIS DO PLANO:
- Calorias: ${currentMacros.calories} kcal (diferença: ${targets.calories - currentMacros.calories})
- Proteína: ${currentMacros.protein}g (diferença: ${targets.protein - currentMacros.protein}g)
- Carboidratos: ${currentMacros.carbs}g (diferença: ${targets.carbs - currentMacros.carbs}g)
- Gordura: ${currentMacros.fat}g (diferença: ${targets.fat - currentMacros.fat}g)

REFEIÇÕES DO PLANO:
${JSON.stringify(mealDetails, null, 2)}

Retorne um JSON com a estrutura:
{
  "adjustments": [
    {
      "foodItemId": "id do meal_option_food",
      "newGrams": número,
      "reason": "explicação curta"
    }
  ],
  "explanation": "explicação geral da estratégia usada",
  "warnings": ["avisos importantes se houver"]
}`;

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "propose_adjustments",
              description: "Propõe ajustes de porções para o plano alimentar",
              parameters: {
                type: "object",
                properties: {
                  adjustments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        foodItemId: { type: "string" },
                        newGrams: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["foodItemId", "newGrams", "reason"],
                    },
                  },
                  explanation: { type: "string" },
                  warnings: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["adjustments", "explanation"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "propose_adjustments" } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns minutos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    
    // Extrair resultado do tool call
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const aiResult = JSON.parse(toolCall.function.arguments);

    // Mapear ajustes para o formato completo
    const adjustments: AdjustmentProposal[] = [];
    
    for (const adj of aiResult.adjustments || []) {
      // Encontrar o alimento original
      let found = false;
      for (const ctx of mealContexts) {
        const food = ctx.foods.find(f => f.id === adj.foodItemId);
        if (food) {
          adjustments.push({
            mealOptionFoodId: food.id,
            mealId: ctx.mealId,
            mealOptionId: ctx.optionId,
            mealName: ctx.mealName,
            foodName: food.food.name,
            foodId: food.food_id,
            originalGrams: food.quantity_grams,
            newGrams: Math.round(Math.max(20, Math.min(400, adj.newGrams))),
            reason: adj.reason,
          });
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn("Food not found for adjustment:", adj.foodItemId);
      }
    }

    // Calcular macros propostos
    const proposedFoods = allFoods.map(f => {
      const adj = adjustments.find(a => a.mealOptionFoodId === f.id);
      return {
        ...f,
        quantity_grams: adj ? adj.newGrams : f.quantity_grams,
      };
    });
    const proposedMacros = calculateMacros(proposedFoods);

    const response: AIRebalanceResponse = {
      success: true,
      currentMacros,
      targetMacros: targets,
      proposedMacros,
      adjustments,
      explanation: aiResult.explanation || "Ajustes calculados pela IA",
      warnings: aiResult.warnings || [],
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Rebalance error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro interno ao processar rebalanceamento" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
