// ============================================================
// EDGE FUNCTION: SUGESTÃO INTELIGENTE DE SUPLEMENTAÇÃO v3
// ============================================================
// Modo "coringa": Suplementos disponíveis para TODAS as refeições
// como opção para ajudar a atingir metas de macros/calorias.
//
// Regras:
// - Suplementos de dose única (creatina, vitaminas) apenas 1x/dia
// - Cada refeição recebe sugestões específicas para seu contexto
// - Macros são calculados para suplementos calóricos
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SupplementRequest {
  mealType: string;
  goal: string;
  dailyCalories?: number;
  proteinTarget?: number;
  currentMealCalories?: number; // Calorias da refeição atual
  currentMealProtein?: number;  // Proteína da refeição atual
  alreadySuggestedToday?: string[]; // Suplementos já sugeridos hoje
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      mealType, 
      goal, 
      dailyCalories, 
      proteinTarget,
      currentMealCalories,
      currentMealProtein,
      alreadySuggestedToday = [],
    } = await req.json() as SupplementRequest;
    
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
      mode: 'wildcard', // Modo coringa
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
