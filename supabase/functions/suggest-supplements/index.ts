// ============================================================
// EDGE FUNCTION: SUGESTÃO INTELIGENTE DE SUPLEMENTAÇÃO v4
// ============================================================
// Dois modos de operação:
// 1. 'wildcard' (coringa): Suplementos opcionais para complementar refeição
// 2. 'replacement': Combina suplementos + alimentos para SUBSTITUIR refeição
//
// No modo replacement, o sistema busca alimentos da tabela foods
// para criar uma combinação que atinja os macros da refeição original.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupplementRequest {
  mode: 'wildcard' | 'replacement';
  mealType: string;
  goal: string;
  dailyCalories?: number;
  proteinTarget?: number;
  currentMealCalories?: number;
  currentMealProtein?: number;
  currentMealCarbs?: number;
  currentMealFat?: number;
  targetMacros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  alreadySuggestedToday?: string[];
}

interface ReplacementItem {
  type: 'supplement' | 'food';
  name: string;
  quantity: string;
  quantityGrams?: number;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Suplementos de dose única (não repetir no dia)
const SINGLE_DAILY_SUPPLEMENTS = [
  'creatina', 'multivitamínico', 'vitamina d', 'ômega-3', 'zinco', 'magnésio', 'vitamina b12', 'ferro'
];

// Mapeamento de refeição preferida para suplementos de dose única
const SINGLE_DOSE_MEALS: Record<string, string[]> = {
  creatina: ['breakfast', 'lunch'],
  multivitamínico: ['breakfast'],
  'vitamina d': ['breakfast', 'lunch'],
  'ômega-3': ['lunch', 'dinner'],
  zinco: ['dinner', 'supper'],
  magnésio: ['dinner', 'supper'],
};

// Goal mapping for Portuguese
const GOAL_MAP: Record<string, string> = {
  'lose_weight': 'perda de peso (cutting) - foco em proteína, baixas calorias',
  'maintain': 'manutenção - equilíbrio de macros',
  'gain_muscle': 'ganho de massa muscular (bulking) - alta proteína, calorias extras',
};

// Meal type mapping with context
const MEAL_MAP: Record<string, { name: string; context: string }> = {
  'breakfast': { name: 'Café da Manhã', context: 'início do dia, quebra do jejum noturno' },
  'morning_snack': { name: 'Lanche da Manhã', context: 'refeição leve entre café e almoço' },
  'lunch': { name: 'Almoço', context: 'refeição principal do dia' },
  'afternoon_snack': { name: 'Lanche da Tarde', context: 'pré-treino ou energia para a tarde' },
  'dinner': { name: 'Jantar', context: 'última refeição principal' },
  'supper': { name: 'Ceia', context: 'antes de dormir, proteína de absorção lenta' },
};

// Categorias de alimentos permitidas para substituição
const REPLACEMENT_FOOD_CATEGORIES = [
  'frutas',
  'cereais',
  'oleaginosas',
  'laticínios',
  'suplementos',
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData = await req.json() as SupplementRequest;
    const { 
      mode = 'wildcard',
      mealType, 
      goal, 
      dailyCalories, 
      proteinTarget,
      currentMealCalories,
      currentMealProtein,
      currentMealCarbs,
      currentMealFat,
      targetMacros,
      alreadySuggestedToday = [],
    } = requestData;
    
    if (!goal || !mealType) {
      return new Response(
        JSON.stringify({ error: 'Goal and mealType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // MODE: REPLACEMENT - Combina suplementos + alimentos
    if (mode === 'replacement') {
      if (!targetMacros) {
        return new Response(
          JSON.stringify({ error: 'targetMacros is required for replacement mode' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar alimentos disponíveis para substituição
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: foods, error: foodsError } = await supabase
        .from('foods')
        .select('id, name, calories, protein, carbs, fat, category, serving_size, type')
        .in('category', REPLACEMENT_FOOD_CATEGORIES)
        .eq('is_active', true)
        .eq('review_status', 'approved')
        .order('protein', { ascending: false })
        .limit(50);

      if (foodsError) {
        console.error("Error fetching foods:", foodsError);
        throw new Error("Failed to fetch foods for replacement");
      }

      // Filtrar suplementos proteicos e alimentos complementares
      const proteinSupplements = (foods || []).filter(f => 
        f.type === 'supplement' && f.protein > 15
      );
      const complementaryFoods = (foods || []).filter(f => 
        f.type !== 'supplement' && ['frutas', 'cereais', 'oleaginosas'].includes(f.category)
      );

      // Preparar lista de alimentos para o prompt
      const foodsListForAI = [
        ...proteinSupplements.slice(0, 5).map(f => ({
          name: f.name,
          type: 'supplement',
          per100g: { calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat },
          serving: f.serving_size,
        })),
        ...complementaryFoods.slice(0, 15).map(f => ({
          name: f.name,
          type: 'food',
          category: f.category,
          per100g: { calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat },
          serving: f.serving_size,
        })),
      ];

      const goalText = GOAL_MAP[goal] || goal;
      const mealInfo = MEAL_MAP[mealType] || { name: mealType, context: '' };

      const replacementPrompt = `Você é um nutricionista criando uma SUBSTITUIÇÃO DE REFEIÇÃO usando suplementos + alimentos.

REFEIÇÃO A SUBSTITUIR: ${mealInfo.name}
MACROS ALVO: ${targetMacros.calories}kcal | ${targetMacros.protein}g P | ${targetMacros.carbs}g C | ${targetMacros.fat}g G
OBJETIVO: ${goalText}

ALIMENTOS DISPONÍVEIS (valores por 100g):
${JSON.stringify(foodsListForAI, null, 2)}

REGRAS CRÍTICAS:
1. A combinação DEVE atingir pelo menos 80% dos macros alvo
2. Priorize 1 suplemento proteico + 1-2 alimentos complementares
3. Use quantidades realistas (não mais que 300g de um único alimento)
4. Calcule os macros finais com base nas quantidades sugeridas
5. Para ${mealType === 'supper' ? 'ceia, prefira caseína (proteína lenta)' : 'outras refeições, whey é adequado'}

EXEMPLO DE COMBINAÇÃO VÁLIDA:
- 1 scoop Whey Protein (30g) = ~120kcal, 24g P
- 1 banana média (100g) = ~89kcal, 1g P, 23g C
- Pasta de amendoim (15g) = ~90kcal, 4g P, 3g C, 8g G
- TOTAL: ~299kcal, 29g P, 26g C, 8g G

Sugira a melhor combinação para atingir os macros alvo.`;

      const replacementSchema = {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["supplement", "food"] },
                name: { type: "string" },
                quantity: { type: "string", description: "Ex: '1 scoop (30g)', '1 unidade média (100g)'" },
                quantityGrams: { type: "number", description: "Quantidade em gramas" },
                macros: {
                  type: "object",
                  properties: {
                    calories: { type: "number" },
                    protein: { type: "number" },
                    carbs: { type: "number" },
                    fat: { type: "number" },
                  },
                  required: ["calories", "protein", "carbs", "fat"],
                },
              },
              required: ["type", "name", "quantity", "quantityGrams", "macros"],
            },
          },
          totalMacros: {
            type: "object",
            properties: {
              calories: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fat: { type: "number" },
            },
            required: ["calories", "protein", "carbs", "fat"],
          },
          coveragePercent: {
            type: "object",
            properties: {
              calories: { type: "number" },
              protein: { type: "number" },
              carbs: { type: "number" },
              fat: { type: "number" },
            },
            description: "Porcentagem dos macros alvo atingida",
          },
          reasoning: { type: "string" },
        },
        required: ["items", "totalMacros", "coveragePercent", "reasoning"],
      };

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "user", content: replacementPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "create_meal_replacement",
                description: "Create a meal replacement combining supplements and foods",
                parameters: {
                  type: "object",
                  properties: replacementSchema.properties,
                  required: replacementSchema.required,
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "create_meal_replacement" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        throw new Error("No tool call response from AI");
      }

      const replacementData = JSON.parse(toolCall.function.arguments);

      return new Response(
        JSON.stringify({
          suggestion: {
            mode: 'replacement',
            mealType,
            targetMacros,
            items: replacementData.items,
            totalMacros: replacementData.totalMacros,
            coveragePercent: replacementData.coveragePercent,
            reasoning: replacementData.reasoning,
            isValid: (replacementData.coveragePercent?.protein || 0) >= 80,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE: WILDCARD - Suplementos opcionais (código original)
    const goalText = GOAL_MAP[goal] || goal;
    const mealInfo = MEAL_MAP[mealType] || { name: mealType, context: '' };

    // Determinar quais suplementos de dose única podem ser sugeridos nesta refeição
    const eligibleSingleDose: string[] = [];
    for (const [supp, preferredMeals] of Object.entries(SINGLE_DOSE_MEALS)) {
      const alreadySuggested = alreadySuggestedToday.some(s => 
        s.toLowerCase().includes(supp) || supp.includes(s.toLowerCase())
      );
      if (!alreadySuggested && preferredMeals.includes(mealType)) {
        eligibleSingleDose.push(supp);
      }
    }

    // Construir prompt para modo "coringa"
    const systemPrompt = `Você é um nutricionista especializado em suplementação esportiva e nutricional.
Sua tarefa é sugerir suplementos como OPÇÕES ADICIONAIS (coringas) para ajudar o usuário a atingir suas metas.

CONCEITO "CORINGA":
- Suplementos são OPCIONAIS, servem para complementar ou reforçar a refeição
- Para objetivos de ganho de massa: priorize suplementos calóricos/proteicos
- Para objetivos de perda de peso: priorize suplementos sem calorias ou low-carb
- Para manutenção: balance entre os dois

REGRAS DE DOSE ÚNICA (CRÍTICO):
- Creatina: APENAS sugerir no café da manhã ou almoço, NUNCA em outras refeições
- Multivitamínico: APENAS no café da manhã
- Ômega-3: APENAS no almoço ou jantar
- Zinco/Magnésio: APENAS no jantar ou ceia
- NÃO repita suplementos já sugeridos hoje: [${alreadySuggestedToday.join(', ') || 'nenhum'}]

SUPLEMENTOS ELEGÍVEIS PARA DOSE ÚNICA nesta refeição: ${eligibleSingleDose.length > 0 ? eligibleSingleDose.join(', ') : 'Nenhum'}

REGRAS DE CONTEXTO POR REFEIÇÃO:
- Café da Manhã: Whey, vitaminas, creatina
- Lanche da Manhã: Barra proteica, BCAA (se treino matinal)
- Almoço: Ômega-3, multivitamínico
- Lanche da Tarde: Whey, pré-treino (se treino à tarde), barra proteica
- Jantar: Proteína, ômega-3
- Ceia: Caseína (proteína de absorção lenta), ZMA

FORMATO DE RESPOSTA:
1. Sugira 2-3 suplementos adequados para o contexto
2. Inclua MACROS para suplementos calóricos (whey, hipercalórico, caseína, etc.)
3. NÃO inclua macros para vitaminas, minerais, creatina
4. Priorize por: essential > recommended > optional`;

    const userPrompt = `Contexto da refeição:
- Refeição: ${mealInfo.name} (${mealInfo.context})
- Objetivo do usuário: ${goalText}
${dailyCalories ? `- Meta calórica diária: ${dailyCalories} kcal` : ''}
${proteinTarget ? `- Meta de proteína diária: ${proteinTarget}g` : ''}
${currentMealCalories ? `- Calorias desta refeição: ${currentMealCalories} kcal` : ''}
${currentMealProtein ? `- Proteína desta refeição: ${currentMealProtein}g` : ''}
- Suplementos já sugeridos hoje: ${alreadySuggestedToday.length > 0 ? alreadySuggestedToday.join(', ') : 'Nenhum'}

Sugira suplementos "coringa" adequados para esta refeição que ajudem o usuário a atingir suas metas.
Lembre-se: suplementos de dose única só podem ser sugeridos se estiverem na lista de elegíveis.`;

    // Schema de resposta unificado
    const supplementSchema = {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do suplemento em português" },
        dosage: { type: "string", description: "Dosagem (ex: '30g', '1 scoop', '5g')" },
        timing: { type: "string", description: "Quando consumir em relação à refeição" },
        benefit: { type: "string", description: "Benefício principal para o objetivo" },
        priority: { type: "string", enum: ["essential", "recommended", "optional"] },
        hasMacros: { type: "boolean", description: "true se tem calorias (whey, caseína), false se não (creatina, vitaminas)" },
        macros: {
          type: "object",
          properties: {
            calories: { type: "number" },
            protein: { type: "number" },
            carbs: { type: "number" },
            fat: { type: "number" },
          },
          description: "Apenas preencher se hasMacros=true"
        },
      },
      required: ["name", "dosage", "timing", "benefit", "priority", "hasMacros"],
      additionalProperties: false,
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              name: "suggest_supplements",
              description: "Return supplement suggestions for the meal",
              parameters: {
                type: "object",
                properties: {
                  supplements: {
                    type: "array",
                    items: supplementSchema,
                  },
                  reasoning: {
                    type: "string",
                    description: "Explicação breve das sugestões"
                  },
                },
                required: ["supplements", "reasoning"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_supplements" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call response from AI");
    }

    const suggestionData = JSON.parse(toolCall.function.arguments);
    
    // Processar e validar suplementos
    const validatedSupplements = (suggestionData.supplements || []).map((supp: any) => {
      const isSingleDaily = SINGLE_DAILY_SUPPLEMENTS.some(s => 
        supp.name.toLowerCase().includes(s)
      );
      const hasMacros = supp.hasMacros ?? false;
      
      return {
        ...supp,
        doseType: isSingleDaily ? 'single_daily' : (hasMacros ? 'meal_replacement' : 'complement'),
        hasMacros,
        macros: hasMacros ? supp.macros : undefined,
      };
    });

    // Calcular totais de macros dos suplementos calóricos
    const supplementsWithMacros = validatedSupplements.filter((s: any) => s.hasMacros && s.macros);
    const totalMacros = supplementsWithMacros.length > 0 ? {
      calories: supplementsWithMacros.reduce((sum: number, s: any) => sum + (s.macros?.calories || 0), 0),
      protein: supplementsWithMacros.reduce((sum: number, s: any) => sum + (s.macros?.protein || 0), 0),
      carbs: supplementsWithMacros.reduce((sum: number, s: any) => sum + (s.macros?.carbs || 0), 0),
      fat: supplementsWithMacros.reduce((sum: number, s: any) => sum + (s.macros?.fat || 0), 0),
    } : undefined;

    const suggestion = {
      mode: 'wildcard',
      mealType,
      supplements: validatedSupplements,
      reasoning: suggestionData.reasoning || '',
      totalMacros,
    };

    return new Response(
      JSON.stringify({ suggestion }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in suggest-supplements:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
