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
}

interface Supplement {
  name: string;
  dosage: string;
  timing: string;
  benefit: string;
  priority: 'essential' | 'recommended' | 'optional';
}

interface SupplementSuggestion {
  mealType: string;
  supplements: Supplement[];
  reasoning: string;
}

// Goal mapping for Portuguese
const GOAL_MAP: Record<string, string> = {
  'lose_weight': 'perda de peso',
  'maintain': 'manutenção',
  'gain_muscle': 'ganho de massa muscular',
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
    const { mealType, goal, dailyCalories, proteinTarget } = await req.json() as SupplementRequest;
    
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

    const systemPrompt = `Você é um nutricionista especializado em suplementação esportiva e nutricional.
Sua tarefa é sugerir suplementos adequados para o contexto informado.

REGRAS IMPORTANTES:
1. Sugira apenas suplementos seguros e baseados em evidências científicas
2. Considere o horário da refeição para timing de suplementação
3. Não sugira mais de 3 suplementos por refeição
4. Priorize suplementos essenciais antes dos opcionais
5. Dosagens devem ser conservadoras e seguras
6. Suplementos devem COMPLEMENTAR a alimentação, não substituí-la

PRIORIDADES:
- essential: Suplementos com forte evidência científica para o objetivo
- recommended: Suplementos com boa evidência, mas não essenciais
- optional: Suplementos que podem ajudar, mas são menos prioritários`;

    const userPrompt = `Sugira suplementos para a seguinte situação:

- Refeição: ${mealText}
- Objetivo: ${goalText}
${dailyCalories ? `- Calorias diárias: ${dailyCalories} kcal` : ''}
${proteinTarget ? `- Meta de proteína: ${proteinTarget}g` : ''}

Retorne as sugestões usando a função suggest_supplements.`;

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
              description: "Return supplement suggestions for the meal context",
              parameters: {
                type: "object",
                properties: {
                  supplements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { 
                          type: "string",
                          description: "Nome do suplemento em português"
                        },
                        dosage: { 
                          type: "string",
                          description: "Dosagem recomendada (ex: '5g', '1 cápsula')"
                        },
                        timing: { 
                          type: "string",
                          description: "Quando tomar em relação à refeição"
                        },
                        benefit: { 
                          type: "string",
                          description: "Benefício principal para o objetivo"
                        },
                        priority: { 
                          type: "string", 
                          enum: ["essential", "recommended", "optional"],
                          description: "Nível de prioridade do suplemento"
                        },
                      },
                      required: ["name", "dosage", "timing", "benefit", "priority"],
                      additionalProperties: false,
                    },
                  },
                  reasoning: {
                    type: "string",
                    description: "Explicação breve do porquê dessas sugestões para o contexto"
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
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call response from AI");
    }

    const suggestionData = JSON.parse(toolCall.function.arguments);
    
    const suggestion: SupplementSuggestion = {
      mealType,
      supplements: suggestionData.supplements || [],
      reasoning: suggestionData.reasoning || '',
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
