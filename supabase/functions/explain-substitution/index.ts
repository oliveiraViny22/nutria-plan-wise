import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { originalFood, newFood, userGoal, dailyCalories } = await req.json();
    
    // Validate usage limits
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
    
    const userId = userData.user.id;
    
    // Check usage limits
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    const { data: canUse, error: canUseError } = await supabaseAdmin.rpc('can_use_feature', {
      _user_id: userId,
      _feature: 'substitution'
    });
    
    if (canUseError || !canUse) {
      // Get plan info for better error message
      const { data: planInfo } = await supabaseAdmin.rpc('get_user_plan', { _user_id: userId });
      return new Response(JSON.stringify({ 
        error: "Limite de substituições atingido",
        allowed: false,
        upgradeRequired: true,
        planName: planInfo?.[0]?.plan_name || 'Gratuito',
        limit: planInfo?.[0]?.substitution_limit || 0
      }), { 
        status: 403, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }
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
    
    // Increment usage after successful response
    await supabaseAdmin.rpc('increment_usage', {
      _user_id: userId,
      _feature: 'substitution'
    });

    return new Response(JSON.stringify({ explanation: data.choices[0].message.content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
