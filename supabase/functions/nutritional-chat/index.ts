import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, profile, chatHistory } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const token = authHeader?.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Unauthorized");

    // Validate chat usage limit
    const { data: canUse } = await supabase.rpc('can_use_feature', {
      _user_id: user.id,
      _feature: 'chat',
    });

    if (!canUse) {
      const { data: planInfo } = await supabase.rpc('get_user_plan', { _user_id: user.id });
      const errorMsg = planInfo?.[0]?.has_chat 
        ? `Você atingiu o limite de ${planInfo?.[0]?.chat_messages_per_day || 0} mensagens diárias.`
        : 'O chat não está disponível no seu plano atual.';
      return new Response(JSON.stringify({
        error: errorMsg,
        upgradeRequired: true,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente nutricional educacional. Responda perguntas sobre alimentação saudável de forma clara e acessível. 
Contexto do usuário:
- Objetivo: ${profile?.goal === 'lose_weight' ? 'perder peso' : profile?.goal === 'gain_muscle' ? 'ganhar massa muscular' : 'manter peso'}
- Meta calórica: ${profile?.daily_calories || 2000} kcal/dia
- Proteína: ${profile?.protein_target || 150}g | Carboidratos: ${profile?.carbs_target || 250}g | Gordura: ${profile?.fat_target || 65}g
- Preferências: ${profile?.preferences?.join(", ") || "Nenhuma"}
- Restrições: ${profile?.restrictions?.join(", ") || "Nenhuma"}

IMPORTANTE: Você oferece educação nutricional, não aconselhamento médico. Sugira consultar um profissional para casos específicos.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(chatHistory || []),
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: corsHeaders });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: corsHeaders });
      throw new Error("AI error");
    }

    const data = await response.json();

    // Increment chat usage after successful response
    await supabase.rpc('increment_usage', {
      _user_id: user.id,
      _feature: 'chat',
    });

    return new Response(JSON.stringify({ message: data.choices[0].message.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
