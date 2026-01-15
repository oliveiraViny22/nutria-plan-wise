import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { originalFood, newFood, userGoal, dailyCalories } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um nutricionista educador. Explique de forma clara e simples o impacto nutricional de substituições alimentares. Seja objetivo, use linguagem acessível e limite a 3 frases." },
          { role: "user", content: `O usuário está trocando "${originalFood?.name}" (${originalFood?.calories}kcal, P:${originalFood?.protein}g, C:${originalFood?.carbs}g, G:${originalFood?.fat}g) por "${newFood?.name}" (${newFood?.calories}kcal, P:${newFood?.protein}g, C:${newFood?.carbs}g, G:${newFood?.fat}g). Objetivo: ${userGoal === 'lose_weight' ? 'perder peso' : userGoal === 'gain_muscle' ? 'ganhar massa' : 'manter peso'}. Meta diária: ${dailyCalories}kcal. Explique o impacto dessa troca.` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: corsHeaders });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: corsHeaders });
      throw new Error("AI error");
    }

    const data = await response.json();
    return new Response(JSON.stringify({ explanation: data.choices[0].message.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
