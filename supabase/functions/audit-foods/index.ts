import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string | null;
  category: string | null;
  processing_level: string | null;
}

interface AuditSuggestion {
  food_id: string;
  fields: ('name' | 'category' | 'processing_level')[];
  current: {
    name: string;
    category: string | null;
    processing_level: string | null;
  };
  suggested: {
    name: string | null;
    category: string | null;
    processing_level: string | null;
  };
  flags: ('duplicate' | 'review')[];
  confidence: number;
}

interface AuditResult {
  summary: {
    total: number;
    suggestable: number;
  };
  suggestions: AuditSuggestion[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { foods, offset = 0, limit = 100 } = await req.json();

    let foodsToAudit: Food[] = foods;

    // If no foods provided, fetch from database
    if (!foods || foods.length === 0) {
      const { data: dbFoods, error: fetchError } = await supabase
        .from('foods')
        .select('id, name, calories, protein, carbs, fat, serving_size, category, processing_level')
        .range(offset, offset + limit - 1)
        .order('name');

      if (fetchError) {
        throw new Error(`Failed to fetch foods: ${fetchError.message}`);
      }

      foodsToAudit = dbFoods || [];
    }

    if (foodsToAudit.length === 0) {
      return new Response(
        JSON.stringify({
          summary: { total: 0, suggestable: 0 },
          suggestions: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Você é um módulo automático do NutriAI para AUDITORIA de normalização.

Você NÃO pode alterar dados, apenas sugerir correções.

Banco:
name, calories, protein, carbs, fat, serving_size, category, processing_level

Categorias válidas: proteinas, carboidratos, vegetais, frutas, laticinios, gorduras, bebidas, outros
Níveis de processamento válidos: natural, minimamente_processado, processado, ultraprocessado

Entrada:
- foods: lista de alimentos existentes

Objetivo:
Gerar sugestões SEGURAS que possam ser aplicadas
individualmente ou em lote por um administrador.

Regras:
- Sugira apenas erros claros
- Não remover acentos válidos
- Não gerar explicações longas
- JSON apenas

Para cada alimento:

1. NAME
- Sugerir correção apenas se houver caracteres inválidos,
  capitalização errada ou erro óbvio de acentuação.

2. CLASSIFICATION
- Sugerir category ou processing_level apenas se incoerente ou vazio.

3. FLAGS
- duplicate → se nome normalizado quase idêntico a outro na lista
- review → se dados nutricionais impossíveis (ex: calorias negativas, macros > 100g por porção pequena)

4. VALIDAÇÃO NUTRICIONAL
- Verificar se kcal_calculada = protein*4 + carbs*4 + fat*9 está próxima do declarado (±15%)
- Marcar "review" se muito diferente

Retorne APENAS JSON válido, sem explicações:

{
  "summary": {
    "total": number,
    "suggestable": number
  },
  "suggestions": [
    {
      "food_id": string,
      "fields": ["name" | "category" | "processing_level"],
      "current": {
        "name": string,
        "category": string | null,
        "processing_level": string | null
      },
      "suggested": {
        "name": string | null,
        "category": string | null,
        "processing_level": string | null
      },
      "flags": ["duplicate" | "review"],
      "confidence": number
    }
  ]
}

IMPORTANTE:
- Só inclua no array "suggestions" alimentos que precisam de correção
- fields deve conter apenas os campos que você está sugerindo alterar
- suggested deve ter null para campos que não precisam de alteração
- confidence: 0.0 a 1.0 indicando certeza da sugestão`;

    const userPrompt = `Audite os seguintes alimentos e retorne sugestões de correção:

${JSON.stringify(foodsToAudit, null, 2)}`;

    console.log(`Auditing ${foodsToAudit.length} foods with AI...`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    let auditResult: AuditResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      auditResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Validate structure
    if (!auditResult.summary || !Array.isArray(auditResult.suggestions)) {
      throw new Error('Invalid audit result structure');
    }

    console.log(`Audit complete: ${auditResult.suggestions.length} suggestions`);

    return new Response(
      JSON.stringify(auditResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Audit error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
