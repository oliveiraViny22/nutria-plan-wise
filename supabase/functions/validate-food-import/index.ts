import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FoodToImport {
  row_index: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size?: string;
  category?: string | null;
  processing_level?: string;
}

interface ExistingFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ValidationItem {
  row_index: number;
  original_name: string;
  normalized_name: string;
  final_name: string;
  is_duplicate: boolean;
  duplicate_name: string | null;
  validation_status: 'valid' | 'warning' | 'invalid';
  issues: string[];
  calories_check: {
    calculated: number;
    declared: number;
  };
  category: string;
  processing_level: string;
  action: 'use_existing' | 'import_private' | 'import_global' | 'reject';
  confidence: number;
}

interface ValidationResult {
  summary: {
    total: number;
    use_existing: number;
    import_private: number;
    import_global: number;
    reject: number;
  };
  items: ValidationItem[];
}

serve(async (req) => {
  // Handle CORS preflight
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

    const { foods_to_import } = await req.json() as { foods_to_import: FoodToImport[] };

    if (!foods_to_import || !Array.isArray(foods_to_import) || foods_to_import.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No foods to validate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating ${foods_to_import.length} foods with AI...`);

    // Fetch existing foods for comparison (get similar names)
    const foodNames = foods_to_import.map(f => f.name.toLowerCase());
    const { data: existingFoods } = await supabase
      .from('foods')
      .select('id, name, calories, protein, carbs, fat')
      .limit(500);

    // Filter existing foods that might be similar
    const relevantExistingFoods: ExistingFood[] = (existingFoods || []).filter(ef => {
      const efNameLower = ef.name.toLowerCase();
      return foodNames.some(fn => {
        // Check for partial matches
        const fnNormalized = fn.replace(/[^\w\s]/g, '').trim();
        const efNormalized = efNameLower.replace(/[^\w\s]/g, '').trim();
        return fnNormalized.includes(efNormalized) || 
               efNormalized.includes(fnNormalized) ||
               fnNormalized.split(' ').some(word => word.length > 3 && efNormalized.includes(word));
      });
    });

    console.log(`Found ${relevantExistingFoods.length} potentially similar existing foods`);

    // Build the AI prompt
    const systemPrompt = `Você é um módulo automático do NutriAI responsável por validar, normalizar e deduplicar alimentos durante IMPORTAÇÃO EM MASSA.

O banco já possui alimentos com as colunas:
name, calories, protein, carbs, fat, serving_size, category, processing_level

Objetivo:
Processar cada alimento de forma independente, garantindo:
- ausência de duplicações
- dados nutricionais coerentes
- nomes padronizados e legíveis
- segurança para inserção em lote

--------------------------------------------------
REGRAS GERAIS
--------------------------------------------------
- Cada alimento deve ser avaliado isoladamente
- Não interrompa o processamento por erro em um item
- Nunca altere alimentos existentes
- Nunca explique fora do JSON
- Priorize decisões conservadoras (evitar inserir lixo no banco)

--------------------------------------------------
PROCESSO PARA CADA ITEM
--------------------------------------------------
Para cada alimento em foods_to_import:

1. NORMALIZAÇÃO INTERNA
- Gerar normalized_name:
  - lowercase
  - remover acentos
  - remover pontuação
  - remover termos genéricos: cozido, cru, caseiro, industrializado

2. NOME EXIBIDO
- Corrigir name para exibição:
  - PT-BR correto
  - acentos preservados
  - remover símbolos inválidos
  - capitalização adequada
  - sem abreviações técnicas ou ruído

3. DUPLICIDADE
- Comparar com existing_foods usando:
  - normalized_name
  - similaridade semântica
  - macros compatíveis (±10%)
- Marcar como duplicado se houver correspondência clara.

4. VALIDAÇÃO NUTRICIONAL
- kcal_calculada = protein*4 + carbs*4 + fat*9
- Comparar com calories
- Marcar inválido se:
  - valores negativos
  - calorias incompatíveis (>25% de diferença)
  - macros impossíveis para a porção

5. CLASSIFICAÇÃO
- Validar ou ajustar category e processing_level apenas se incoerentes.
- Categorias válidas: frutas, hortaliças_folhosas, legumes, cereais_tubérculos, leguminosas, proteínas_animais, laticínios, óleos_oleaginosas, suplementos
- Processing levels válidos: in_natura, minimamente_processado, processado, ultraprocessado, suplemento

6. DECISÃO POR ITEM
Classificar cada item como:
- use_existing → duplicado (não importar)
- import_private → válido, mas não elegível para banco global (nome muito específico, marca, etc)
- import_global → válido e elegível para banco global
- reject → inválido ou inconsistente

--------------------------------------------------
FORMATO DE SAÍDA (OBRIGATÓRIO)
--------------------------------------------------
Retorne APENAS um JSON válido sem markdown, sem explicações:
{
  "summary": {
    "total": number,
    "use_existing": number,
    "import_private": number,
    "import_global": number,
    "reject": number
  },
  "items": [
    {
      "row_index": number,
      "original_name": string,
      "normalized_name": string,
      "final_name": string,
      "is_duplicate": boolean,
      "duplicate_name": string | null,
      "validation_status": "valid" | "warning" | "invalid",
      "issues": [string],
      "calories_check": {
        "calculated": number,
        "declared": number
      },
      "category": string,
      "processing_level": string,
      "action": "use_existing" | "import_private" | "import_global" | "reject",
      "confidence": number (0-100)
    }
  ]
}`;

    const userMessage = JSON.stringify({
      foods_to_import: foods_to_import.map((f, idx) => ({
        row_index: f.row_index ?? idx,
        name: f.name,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        serving_size: f.serving_size || '100g',
        category: f.category || null,
        processing_level: f.processing_level || 'in_natura'
      })),
      existing_foods: relevantExistingFoods.map(ef => ({
        name: ef.name,
        calories: ef.calories,
        protein: ef.protein,
        carbs: ef.carbs,
        fat: ef.fat
      }))
    });

    // Call Lovable AI
    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content in AI response');
    }

    console.log('AI response received, parsing...');

    // Parse AI response - handle potential markdown wrapping
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

    let validationResult: ValidationResult;
    try {
      validationResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanedContent);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate response structure
    if (!validationResult.summary || !validationResult.items) {
      throw new Error('Invalid response structure from AI');
    }

    console.log('Validation complete:', validationResult.summary);

    return new Response(
      JSON.stringify(validationResult),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in validate-food-import:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to validate food import with AI'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
