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

interface MigrationSuggestion {
  name: string;
  old_category: string | null;
  old_processing_level: string | null;
  proposed_category: string;
  proposed_processing_level: string;
  justification: string;
  confidence: number;
  food_id: string;
}

interface MigrationResult {
  summary: {
    total: number;
    to_update: number;
    unchanged: number;
    already_migrated: number;
  };
  suggestions: MigrationSuggestion[];
}

// Categorias canônicas oficiais
const NEW_CATEGORIES = new Set([
  'carboidratos', 'proteinas', 'gorduras', 'vegetais', 'frutas',
  'laticinios', 'leguminosas', 'suplementos', 'mistos'
]);

const NEW_PROCESSING_LEVELS = new Set([
  'in_natura', 'minimamente_processado', 'processado', 'ultraprocessado', 'suplemento'
]);

// Check if food is already migrated to new format
function isAlreadyMigrated(food: Food): boolean {
  const hasMigratedCategory = food.category && NEW_CATEGORIES.has(food.category);
  const hasMigratedProcessing = food.processing_level && NEW_PROCESSING_LEVELS.has(food.processing_level);
  return hasMigratedCategory === true && hasMigratedProcessing === true;
}

const SYSTEM_PROMPT = `Você é um módulo especialista em nutrição clínica e classificação de alimentos,
operando em MODO DE MIGRAÇÃO GLOBAL do NutriAI.

IMPORTANTE:
- Esta execução antecede a atualização definitiva do banco
- O backend fará normalização semântica e reaproveitamento de valores existentes
- Você NÃO deve criar variações desnecessárias de categorias ou processamento
- Após esta migração, TODOS os planos existentes serão reprocessados
- O impacto nutricional é esperado e aceitável

--------------------------------------------------
ESTRUTURA DO BANCO
--------------------------------------------------

Cada alimento possui:
- name
- calories
- protein
- carbs
- fat
- serving_size
- category
- processing_level

--------------------------------------------------
CATEGORIAS E PROCESSAMENTO (BASE CONCEITUAL)
--------------------------------------------------

Categorias nutricionais válidas (ÚNICAS PERMITIDAS):
- carboidratos (arroz, pão, massas, tubérculos, cereais)
- proteinas (carnes, peixes, ovos, frango)
- gorduras (óleos, azeites, oleaginosas, castanhas)
- vegetais (folhas, verduras, legumes)
- frutas (frutas frescas e secas)
- laticinios (leite, queijos, iogurtes)
- leguminosas (feijões, lentilha, grão-de-bico, soja)
- suplementos (whey, creatina, vitaminas)
- mistos (preparações mistas, pratos prontos)

⚠️ NÃO USE NENHUMA OUTRA CATEGORIA!
Categorias antigas como proteinas_animais, cereais_tuberculos, hortalicas_folhosas são INVÁLIDAS.

Níveis de processamento (ÚNICOS PERMITIDOS):
- in_natura
- minimamente_processado
- processado
- ultraprocessado
- suplemento

--------------------------------------------------
OBJETIVO
--------------------------------------------------

Reclassificar TODOS os alimentos para as categorias canônicas acima.

--------------------------------------------------
REGRAS DE CLASSIFICAÇÃO
--------------------------------------------------

CATEGORIA (ordem de prioridade):
1. Se for suplemento nutricional → suplementos
2. Se ≥60% das kcal vierem de carboidratos → carboidratos
3. Se ≥20g de proteína por 100g ou porção → proteinas
4. Se ≥15g de gordura por 100g → gorduras
5. Frutas naturais → frutas
6. Hortaliças, verduras, legumes → vegetais
7. Feijões, lentilhas, grão-de-bico, soja → leguminosas
8. Leite, queijos, iogurtes → laticinios
9. Se não houver dominância clara → mistos

PROCESSAMENTO:
- Cru ou fresco, sem preparo → In natura
- Cozido, grelhado, seco, flocado, fermentado simples → Minimamente processado
- Preparações com óleo, açúcar ou sal → Processado
- Formulações industriais complexas → Ultraprocessado
- Pós, blends, fórmulas → Suplemento

--------------------------------------------------
REGRAS CRÍTICAS DE SEGURANÇA
--------------------------------------------------

- Ignore completamente categorias antigas incorretas
- Não preserve erro por compatibilidade
- Classifique alimentos similares de forma idêntica
- Não invente novos conceitos
- Prefira decisões nutricionalmente defensáveis
- Considere que planos existentes serão recalculados
  com base nesta nova classificação

--------------------------------------------------
FORMATO DE SAÍDA (JSON APENAS)
--------------------------------------------------

Retorne um array JSON onde cada item contém:

{
  "name": string,
  "old_category": string | null,
  "old_processing_level": string | null,
  "proposed_category": string,
  "proposed_processing_level": string,
  "justification": string,
  "confidence": number (0.0 a 1.0)
}

--------------------------------------------------
RESTRIÇÕES FINAIS
--------------------------------------------------

- Não explique fora do JSON
- Não gere categorias ou processamentos fora da lista conceitual
- Não tente manter compatibilidade com o modelo antigo
- Esta saída será usada para:
  1) Atualização do banco de alimentos
  2) Reprocessamento total de planos alimentares`;

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

    const { foods, offset = 0, limit = 100, mode = 'migration' } = await req.json();

    let allFoods: Food[] = foods;
    let alreadyMigratedCount = 0;

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

      allFoods = dbFoods || [];
    }

    // Filter out already migrated foods
    const foodsToAudit = allFoods.filter(food => !isAlreadyMigrated(food));
    alreadyMigratedCount = allFoods.length - foodsToAudit.length;

    console.log(`[Migration] ${allFoods.length} total, ${alreadyMigratedCount} already migrated, ${foodsToAudit.length} to process`);

    if (foodsToAudit.length === 0) {
      return new Response(
        JSON.stringify({
          summary: { 
            total: allFoods.length, 
            to_update: 0, 
            unchanged: 0,
            already_migrated: alreadyMigratedCount
          },
          suggestions: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build food list for AI with id mapping
    const foodsForAI = foodsToAudit.map(f => ({
      id: f.id,
      name: f.name,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      serving_size: f.serving_size,
      current_category: f.category,
      current_processing_level: f.processing_level
    }));

    const userPrompt = `Reclassifique os seguintes alimentos de acordo com as regras de migração.
Para cada alimento, inclua o campo "id" da entrada original.

Alimentos a reclassificar:

${JSON.stringify(foodsForAI, null, 2)}

Retorne APENAS um array JSON com a reclassificação de TODOS os alimentos, incluindo o "id" de cada um.`;

    console.log(`[Migration] Processing ${foodsToAudit.length} foods with AI...`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
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
    let suggestions: MigrationSuggestion[];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Map food_id from the original data if not present
      suggestions = parsed.map((item: any) => {
        const originalFood = foodsToAudit.find(f => 
          f.id === item.id || 
          f.name.toLowerCase() === item.name?.toLowerCase()
        );
        
        return {
          name: item.name,
          old_category: item.old_category || originalFood?.category || null,
          old_processing_level: item.old_processing_level || originalFood?.processing_level || null,
          proposed_category: item.proposed_category,
          proposed_processing_level: item.proposed_processing_level,
          justification: item.justification || '',
          confidence: item.confidence || 0.9,
          food_id: item.id || originalFood?.id || ''
        };
      });
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Calculate statistics
    const toUpdate = suggestions.filter(s => 
      s.proposed_category !== s.old_category || 
      s.proposed_processing_level !== s.old_processing_level
    ).length;

    const result: MigrationResult = {
      summary: {
        total: allFoods.length,
        to_update: toUpdate,
        unchanged: suggestions.length - toUpdate,
        already_migrated: alreadyMigratedCount
      },
      suggestions
    };

    console.log(`[Migration] Complete: ${result.summary.to_update} to update, ${result.summary.unchanged} unchanged, ${result.summary.already_migrated} already migrated`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Migration audit error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
