import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Food {
  id: string;
  name: string;
  canonical_name: string | null;
  category: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string | null;
  processing_level: string | null;
  type: string;
  origin: string;
  confidence_level: string;
  is_optional: boolean;
  created_by_type: string;
  created_by_id: string | null;
  review_status: string;
  is_active: boolean;
}

interface AuditAlert {
  food_id: string;
  food_name: string;
  alert_type: 'macro_inconsistency' | 'name_not_standardized' | 'missing_category' | 'missing_canonical' | 'possible_duplicate' | 'inactive_used';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggested_fix?: string;
}

interface SuggestedFood {
  name: string;
  canonical_name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  serving_unit: string;
  type: 'food' | 'supplement';
  origin: 'ia_estimated';
  confidence_level: 'medium';
  is_optional: boolean;
  created_by_type: 'ai';
  review_status: 'pending';
  is_active: boolean;
  justification: string;
}

interface DuplicateCandidate {
  food_id: string;
  food_name: string;
  duplicate_of_id: string;
  duplicate_of_name: string;
  similarity_score: number;
  reason: string;
}

interface CurationReport {
  generated_at: string;
  summary: {
    total_foods: number;
    foods_with_alerts: number;
    suggested_new_foods: number;
    possible_duplicates: number;
    pending_review: number;
  };
  alerts: AuditAlert[];
  suggested_foods: SuggestedFood[];
  duplicates: DuplicateCandidate[];
}

const SYSTEM_PROMPT = `Você é uma IA de curadoria de dados nutricionais, responsável por revisar, padronizar e sugerir a expansão do banco de alimentos da plataforma.

Você NÃO interage com usuários finais.
Você NÃO executa alterações automaticamente.
Você NÃO remove nem sobrescreve dados existentes.

Seu papel é analisar, normalizar, sugerir e classificar corretamente alimentos de acordo com o schema definido.

SCHEMA DE REFERÊNCIA (OBRIGATÓRIO)

Todo alimento (existente ou sugerido) deve respeitar os campos abaixo:
- name
- canonical_name
- category
- calories_per_serving (calories)
- protein_g (protein)
- carbs_g (carbs)
- fat_g (fat)
- serving_size
- type (food | supplement)
- origin (manual | ia_estimated | imported)
- confidence_level (high | medium | low)
- is_optional
- created_by_type (admin | professional | ai | system)
- created_by_id (UUID ou NULL)
- review_status (pending | approved | rejected)
- is_active

REGRAS DE GOVERNANÇA (CRÍTICAS)

🔒 REGRA 1 — PREENCHIMENTO OBRIGATÓRIO DE AUTORIA

Para todo alimento sugerido pela IA, aplicar obrigatoriamente:
- created_by_type = ai
- created_by_id = NULL
- origin = ia_estimated
- review_status = pending
- confidence_level = medium
- is_active = true

⚠️ A IA NUNCA aprova alimentos criados por ela mesma.

🔒 REGRA 2 — ALIMENTOS EXISTENTES

Para alimentos já existentes:
- NÃO alterar created_by_type ou created_by_id
- NÃO sobrescrever dados
- Apenas sinalizar: inconsistências, possíveis duplicatas, campos ausentes

CONTROLE RÍGIDO DE DUPLICIDADE (NÃO NEGOCIÁVEL)

Antes de sugerir qualquer novo alimento:
1. Normalizar o nome removendo: marca, preparo, adjetivos cosméticos
2. Definir o canonical_name
3. Comparar com alimentos existentes
4. Se já existir equivalente canônico: ❌ NÃO sugerir novo alimento, ✅ Marcar como possível duplicata

Diferenças que NÃO criam novo alimento:
- preparo (cozido, grelhado, assado)
- marca
- cor superficial
- porção diferente

Diferenças que PODEM criar novo alimento:
- integral × refinado
- cru × frito
- alimento in natura × ultraprocessado

⚠️ Em caso de dúvida → não criar, marcar como "necessita revisão".

PADRONIZAÇÃO OBRIGATÓRIA

🔹 Nome (name): singular, sem marca, sem preparo. Ex.: "Arroz branco"
🔹 Nome canônico (canonical_name): lowercase, sem acentos, underscore como separador. Ex.: arroz_branco
🔹 Porção base: unidade clara (g, ml, unidade), porção padrão (ex.: 100g)

CONSISTÊNCIA NUTRICIONAL

- 4 kcal/g proteína
- 4 kcal/g carboidrato
- 9 kcal/g gordura
- tolerância máxima de ±5%

Se incoerente → sinalizar, não corrigir automaticamente.

SUPLEMENTOS (SEPARAÇÃO OBRIGATÓRIA)

Se o item for suplemento:
- type = supplement
- is_optional = true

Permitidos no MVP: Whey protein, Albumina, Maltodextrina, Dextrose, Óleo MCT

Nunca tratar suplemento como refeição.

SAÍDA OBRIGATÓRIA

Retorne um JSON válido com a seguinte estrutura:
{
  "alerts": [
    {
      "food_id": "uuid",
      "food_name": "nome",
      "alert_type": "macro_inconsistency" | "name_not_standardized" | "missing_category" | "missing_canonical" | "possible_duplicate" | "inactive_used",
      "severity": "low" | "medium" | "high",
      "description": "descrição do problema",
      "suggested_fix": "sugestão de correção (opcional)"
    }
  ],
  "suggested_foods": [
    {
      "name": "Nome Padronizado",
      "canonical_name": "nome_padronizado",
      "category": "categoria",
      "calories": 100,
      "protein": 10,
      "carbs": 15,
      "fat": 2,
      "serving_size": "100g",
      "serving_unit": "g",
      "type": "food",
      "origin": "ia_estimated",
      "confidence_level": "medium",
      "is_optional": false,
      "created_by_type": "ai",
      "review_status": "pending",
      "is_active": true,
      "justification": "Motivo para sugerir este alimento"
    }
  ],
  "duplicates": [
    {
      "food_id": "uuid",
      "food_name": "nome",
      "duplicate_of_id": "uuid",
      "duplicate_of_name": "nome do original",
      "similarity_score": 0.95,
      "reason": "Motivo da detecção"
    }
  ]
}

REGRA FINAL ABSOLUTA

Se houver qualquer dúvida sobre nome, categoria, porção, macros ou equivalência com alimento existente:
➡️ NÃO CRIAR O ALIMENTO
➡️ Marcar como necessita revisão`;

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

    const body = await req.json().catch(() => ({}));
    const { mode = 'full', category_filter = null, limit = 500 } = body;

    console.log(`Running food curation in ${mode} mode...`);

    // Fetch foods based on mode
    let query = supabase
      .from('foods')
      .select('*')
      .order('name');

    if (category_filter) {
      query = query.eq('category', category_filter);
    }

    query = query.limit(limit);

    const { data: foods, error: foodsError } = await query;

    if (foodsError) {
      throw new Error(`Failed to fetch foods: ${foodsError.message}`);
    }

    if (!foods || foods.length === 0) {
      return new Response(
        JSON.stringify({
          generated_at: new Date().toISOString(),
          summary: {
            total_foods: 0,
            foods_with_alerts: 0,
            suggested_new_foods: 0,
            possible_duplicates: 0,
            pending_review: 0
          },
          alerts: [],
          suggested_foods: [],
          duplicates: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pending review count
    const { count: pendingCount } = await supabase
      .from('foods')
      .select('*', { count: 'exact', head: true })
      .eq('review_status', 'pending');

    // Prepare foods for AI analysis
    const foodsForAnalysis = foods.map((f: Food) => ({
      id: f.id,
      name: f.name,
      canonical_name: f.canonical_name,
      category: f.category,
      calories: f.calories,
      protein: f.protein,
      carbs: f.carbs,
      fat: f.fat,
      serving_size: f.serving_size,
      processing_level: f.processing_level,
      type: f.type || 'food',
      origin: f.origin || 'manual',
      review_status: f.review_status || 'approved',
      is_active: f.is_active !== false
    }));

    // Get categories distribution
    const categoriesMap = new Map<string, number>();
    foods.forEach((f: Food) => {
      const cat = f.category || 'sem_categoria';
      categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + 1);
    });

    const userMessage = JSON.stringify({
      mode,
      total_foods: foods.length,
      categories_distribution: Object.fromEntries(categoriesMap),
      foods: foodsForAnalysis,
      instructions: mode === 'audit' 
        ? 'Foque apenas em auditar os alimentos existentes, identificando inconsistências e possíveis duplicatas. NÃO sugira novos alimentos.'
        : mode === 'suggest'
        ? 'Foque em sugerir novos alimentos canônicos que estão faltando no banco, considerando a distribuição atual de categorias. NÃO faça auditoria detalhada.'
        : 'Realize auditoria completa E sugira novos alimentos necessários.'
    });

    // Call AI
    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        max_tokens: 16000,
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

    let aiResult: { alerts: AuditAlert[]; suggested_foods: SuggestedFood[]; duplicates: DuplicateCandidate[] };
    try {
      aiResult = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', cleanedContent.substring(0, 500));
      throw new Error('Invalid JSON response from AI');
    }

    // Validate and sanitize results
    const alerts = (aiResult.alerts || []).filter(a => 
      a.food_id && a.food_name && a.alert_type && a.severity && a.description
    );

    const suggestedFoods = (aiResult.suggested_foods || []).map(sf => ({
      ...sf,
      origin: 'ia_estimated' as const,
      confidence_level: 'medium' as const,
      created_by_type: 'ai' as const,
      review_status: 'pending' as const,
      is_active: true
    }));

    const duplicates = (aiResult.duplicates || []).filter(d =>
      d.food_id && d.food_name && d.duplicate_of_id && d.duplicate_of_name
    );

    const report: CurationReport = {
      generated_at: new Date().toISOString(),
      summary: {
        total_foods: foods.length,
        foods_with_alerts: alerts.length,
        suggested_new_foods: suggestedFoods.length,
        possible_duplicates: duplicates.length,
        pending_review: pendingCount || 0
      },
      alerts,
      suggested_foods: suggestedFoods,
      duplicates
    };

    console.log('Curation complete:', report.summary);

    // Log the curation run
    await supabase.from('admin_audit_log').insert({
      user_id: user.id,
      action: 'food_curation',
      entity_type: 'foods',
      entity_id: null,
      new_value: report.summary
    });

    return new Response(
      JSON.stringify(report),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in food-curation:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Failed to run food curation'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
