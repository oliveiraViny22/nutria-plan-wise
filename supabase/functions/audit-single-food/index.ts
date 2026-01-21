import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FoodInput {
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

interface CorrectedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  category: string;
  processing_level: string;
}

interface AuditResult {
  status: 'APROVADO' | 'CORRIGIDO' | 'INVALIDO';
  original_id: string;
  corrected_food: CorrectedFood;
  changes_summary: string[];
  technical_justification: string;
}

const VALID_CATEGORIES = [
  'frutas',
  'hortaliças_folhosas',
  'legumes',
  'cereais_tubérculos',
  'leguminosas',
  'proteínas_animais',
  'laticínios',
  'óleos_oleaginosas',
  'suplementos'
];

const VALID_PROCESSING_LEVELS = [
  'in_natura',
  'minimamente_processado',
  'processado',
  'ultraprocessado',
  'suplemento'
];

const SYSTEM_PROMPT = `Você é um auditor técnico de banco de dados nutricional do NutriaPlan.

Seu papel é auditar tecnicamente alimentos, garantindo que cada alimento seja uma unidade nutricional estável, coerente e substituível.

REGRAS DE AUDITORIA (OBRIGATÓRIAS):

1️⃣ NOME DO ALIMENTO
O nome DEVE:
- Estar no singular
- Descrever alimento + preparo
- NÃO conter marca
- NÃO conter quantidade
- NÃO conter variações subjetivas

Exemplos:
❌ "Frango" → ✅ "Peito de frango grelhado"
❌ "Ovo grande" → ✅ "Ovo de galinha inteiro cozido"
❌ "Arroz cozido 100g" → ✅ "Arroz branco cozido"

2️⃣ PORÇÃO (serving_size)
A porção DEVE seguir o padrão: "<porção humana> (<peso em gramas>)"

Exemplos válidos:
- "1 unidade (50g)"
- "1 colher de sopa (15g)"
- "1 concha média (100g)"
- "1 copo (200ml)"
- "1 porção (100g)"

❌ Proibido: apenas "100g", apenas "1 unidade", texto ambíguo

3️⃣ CALORIAS E MACRONUTRIENTES
Validar compatibilidade usando:
- Proteína = 4 kcal/g
- Carboidrato = 4 kcal/g
- Gordura = 9 kcal/g

Tolerância: ±10% entre calorias declaradas e calculadas.
Se divergir, ajuste mantendo coerência clínica.

❌ Nunca invente valores extremos
❌ Nunca zere macros sem justificativa

4️⃣ CATEGORIA
DEVE ser UMA das seguintes (exatamente como escrito):
- frutas
- hortaliças_folhosas
- legumes
- cereais_tubérculos
- leguminosas
- proteínas_animais
- laticínios
- óleos_oleaginosas
- suplementos

5️⃣ NÍVEL DE PROCESSAMENTO
DEVE ser UM dos seguintes:
- in_natura
- minimamente_processado
- processado
- ultraprocessado
- suplemento

6️⃣ ALIMENTOS INVÁLIDOS
Marque como INVALIDO se:
- For genérico demais (ex: "Carne", "Fruta")
- Misturar vários alimentos
- Representar uma refeição pronta
- Não puder ser substituído de forma segura
- Não fizer sentido clínico como unidade

PRINCÍPIO FINAL:
- Se houver dúvida entre manter ou corrigir, CORRIJA.
- Se houver dúvida entre corrigir ou invalidar, INVALIDE.

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "status": "APROVADO | CORRIGIDO | INVALIDO",
  "original_id": "uuid",
  "corrected_food": {
    "name": "string",
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "serving_size": "string",
    "category": "string",
    "processing_level": "string"
  },
  "changes_summary": ["mudança 1", "mudança 2"],
  "technical_justification": "justificativa técnica"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { food, food_id, apply_changes = false } = body;

    let foodToAudit: FoodInput;

    // If food_id is provided, fetch from database
    if (food_id && !food) {
      const { data: fetchedFood, error: fetchError } = await supabase
        .from('foods')
        .select('id, name, calories, protein, carbs, fat, serving_size, category, processing_level')
        .eq('id', food_id)
        .single();

      if (fetchError || !fetchedFood) {
        return new Response(
          JSON.stringify({ error: 'Food not found', details: fetchError?.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      foodToAudit = fetchedFood;
    } else if (food) {
      foodToAudit = food;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either food or food_id must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Auditing food: ${foodToAudit.name} (${foodToAudit.id})`);

    // Build user message with the food data
    const userMessage = JSON.stringify(foodToAudit, null, 2);

    // Call AI for audit
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    // Parse AI response
    let cleanedContent = aiContent.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    let auditResult: AuditResult;
    try {
      auditResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanedContent);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate the audit result structure
    if (!auditResult.status || !auditResult.corrected_food) {
      throw new Error('Invalid audit result structure');
    }

    // Ensure original_id is set
    auditResult.original_id = foodToAudit.id;

    // Validate category and processing_level in the response
    if (!VALID_CATEGORIES.includes(auditResult.corrected_food.category)) {
      console.warn(`Invalid category returned: ${auditResult.corrected_food.category}, defaulting to original or first valid`);
      auditResult.corrected_food.category = foodToAudit.category && VALID_CATEGORIES.includes(foodToAudit.category) 
        ? foodToAudit.category 
        : 'proteínas_animais';
    }

    if (!VALID_PROCESSING_LEVELS.includes(auditResult.corrected_food.processing_level)) {
      console.warn(`Invalid processing_level returned: ${auditResult.corrected_food.processing_level}, defaulting to original or first valid`);
      auditResult.corrected_food.processing_level = foodToAudit.processing_level && VALID_PROCESSING_LEVELS.includes(foodToAudit.processing_level)
        ? foodToAudit.processing_level
        : 'minimamente_processado';
    }

    console.log(`Audit result for ${foodToAudit.name}: ${auditResult.status}`);

    // Apply changes if requested and status is CORRIGIDO
    if (apply_changes && auditResult.status === 'CORRIGIDO') {
      const { error: updateError } = await supabase
        .from('foods')
        .update({
          name: auditResult.corrected_food.name,
          calories: auditResult.corrected_food.calories,
          protein: auditResult.corrected_food.protein,
          carbs: auditResult.corrected_food.carbs,
          fat: auditResult.corrected_food.fat,
          serving_size: auditResult.corrected_food.serving_size,
          category: auditResult.corrected_food.category,
          processing_level: auditResult.corrected_food.processing_level,
        })
        .eq('id', foodToAudit.id);

      if (updateError) {
        console.error('Failed to apply corrections:', updateError);
        return new Response(
          JSON.stringify({ 
            ...auditResult, 
            applied: false, 
            apply_error: updateError.message 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Applied corrections to food: ${foodToAudit.id}`);
      return new Response(
        JSON.stringify({ ...auditResult, applied: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle INVALIDO status - optionally mark for deletion
    if (apply_changes && auditResult.status === 'INVALIDO') {
      // Don't auto-delete, but log for manual review
      console.log(`Food marked as INVALID: ${foodToAudit.id} - ${foodToAudit.name}`);
      // Could optionally add to an audit log or flag the food
    }

    return new Response(
      JSON.stringify(auditResult),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in audit-single-food:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to audit food'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
