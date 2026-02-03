// ============================================================
// EDGE FUNCTION: SUGESTÃO INTELIGENTE DE SUPLEMENTAÇÃO v2
// ============================================================
// Modos:
// - complement: Sugestões complementares (não afetam macros)
// - replacement: Substituição de refeição pulada (tem macros)
//
// Regras:
// - Suplementos de dose única (creatina, vitaminas) apenas 1x/dia
// - Suplementos contextuais (pré-treino, BCAA) não sugeridos
// - Substituição apenas quando mealSkipped=true
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
  mealSkipped?: boolean; // NOVO: Indica se a refeição foi pulada
  alreadySuggestedToday?: string[]; // NOVO: Suplementos já sugeridos hoje
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
  'lose_weight': 'perda de peso (cutting)',
  'maintain': 'manutenção',
  'gain_muscle': 'ganho de massa muscular (bulking)',
};

// Meal type mapping
const MEAL_MAP: Record<string, string> = {
  'breakfast': 'Café da Manhã',
  'morning_snack': 'Lanche da Manhã',
  'lunch': 'Almoço',
  'afternoon_snack': 'Lanche da Tarde',
  'dinner': 'Jantar',
  'supper': 'Ceia',
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
      mealSkipped = false,
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
    const mealText = MEAL_MAP[mealType] || mealType;
    const mode = mealSkipped ? 'replacement' : 'complement';

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

    // Construir prompt baseado no modo
    let systemPrompt = '';
    let userPrompt = '';

    if (mode === 'replacement') {
      // MODO SUBSTITUIÇÃO: Refeição pulada
      systemPrompt = `Você é um nutricionista especializado em suplementação. 
O usuário PULOU uma refeição e precisa de suplementos para compensar.

REGRAS CRÍTICAS:
1. Sugira APENAS suplementos proteicos/calóricos que compensem a refeição perdida
2. Inclua os MACROS de cada suplemento sugerido
3. Máximo 2 suplementos de substituição
4. Foque em: Whey Protein, Caseína, Hipercalórico, Albumina
5. NÃO sugira vitaminas, creatina ou suplementos sem calorias
6. A soma dos macros deve aproximar o que seria consumido na refeição`;

      userPrompt = `O usuário PULOU a refeição: ${mealText}

Contexto:
- Objetivo: ${goalText}
${dailyCalories ? `- Calorias diárias totais: ${dailyCalories} kcal` : ''}
${proteinTarget ? `- Meta de proteína diária: ${proteinTarget}g` : ''}

Sugira suplementos proteicos para SUBSTITUIR esta refeição perdida.
Inclua os macros (calorias, proteína, carboidratos, gordura) de cada suplemento.`;

    } else {
      // MODO COMPLEMENTO: Sugestões sem impacto calórico
      systemPrompt = `Você é um nutricionista especializado em suplementação.
Sua tarefa é sugerir suplementos COMPLEMENTARES que NÃO afetam as calorias do plano.

REGRAS CRÍTICAS:
1. NÃO sugira whey, hipercalórico ou qualquer suplemento calórico
2. Foque em suplementos de dose única: vitaminas, minerais, creatina, ômega-3
3. Máximo 2 suplementos por refeição
4. APENAS sugira creatina se "${mealType}" for "breakfast" ou "lunch"
5. APENAS sugira magnésio/zinco se "${mealType}" for "dinner" ou "supper"
6. NÃO repita suplementos já sugeridos hoje: [${alreadySuggestedToday.join(', ')}]
7. NÃO sugira BCAA, pré-treino ou suplementos de treino (são contextuais)

SUPLEMENTOS ELEGÍVEIS para ${mealText}: ${eligibleSingleDose.length > 0 ? eligibleSingleDose.join(', ') : 'Nenhum de dose única disponível'}

PRIORIDADES:
- essential: Suplementos essenciais para o objetivo
- recommended: Suplementos recomendados
- optional: Suplementos opcionais`;

      userPrompt = `Contexto da refeição:
- Refeição: ${mealText}
- Objetivo: ${goalText}
${dailyCalories ? `- Calorias diárias: ${dailyCalories} kcal` : ''}
${proteinTarget ? `- Meta de proteína: ${proteinTarget}g` : ''}
- Suplementos já sugeridos hoje: ${alreadySuggestedToday.length > 0 ? alreadySuggestedToday.join(', ') : 'Nenhum'}

Sugira suplementos COMPLEMENTARES (sem calorias) adequados para esta refeição.
Se não houver suplementos adequados para este horário, retorne uma lista vazia.`;
    }

    // Definir schema de resposta baseado no modo
    const supplementSchema = mode === 'replacement' ? {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do suplemento" },
        dosage: { type: "string", description: "Dosagem (ex: '30g', '1 scoop')" },
        timing: { type: "string", description: "Quando consumir" },
        benefit: { type: "string", description: "Benefício principal" },
        priority: { type: "string", enum: ["essential", "recommended", "optional"] },
        hasMacros: { type: "boolean", description: "Sempre true para substituição" },
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
      required: ["name", "dosage", "timing", "benefit", "priority", "hasMacros", "macros"],
      additionalProperties: false,
    } : {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do suplemento" },
        dosage: { type: "string", description: "Dosagem (ex: '5g', '1 cápsula')" },
        timing: { type: "string", description: "Quando tomar" },
        benefit: { type: "string", description: "Benefício principal" },
        priority: { type: "string", enum: ["essential", "recommended", "optional"] },
        hasMacros: { type: "boolean", description: "Sempre false para complemento" },
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
              description: "Return supplement suggestions",
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
                  totalMacros: mode === 'replacement' ? {
                    type: "object",
                    properties: {
                      calories: { type: "number" },
                      protein: { type: "number" },
                      carbs: { type: "number" },
                      fat: { type: "number" },
                    },
                    description: "Soma dos macros de todos os suplementos sugeridos"
                  } : undefined,
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
    
    // Filtrar suplementos inválidos e adicionar doseType
    const validatedSupplements = (suggestionData.supplements || []).map((supp: any) => {
      const isSingleDaily = SINGLE_DAILY_SUPPLEMENTS.some(s => 
        supp.name.toLowerCase().includes(s)
      );
      return {
        ...supp,
        doseType: isSingleDaily ? 'single_daily' : (supp.hasMacros ? 'meal_replacement' : 'contextual'),
        hasMacros: supp.hasMacros ?? false,
      };
    });

    const suggestion = {
      mode,
      mealType,
      supplements: validatedSupplements,
      reasoning: suggestionData.reasoning || '',
      totalMacros: suggestionData.totalMacros,
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
