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

const SYSTEM_PROMPT = `Você é uma IA de curadoria de dados nutricionais do NutriAI, sem interação com usuários finais.

Seu papel é:
- Revisar alimentos existentes
- Padronizar nomes e categorias
- Sugerir novos alimentos (sempre pendentes)
- Classificar corretamente
- Respeitar políticas de visibilidade

Você NUNCA:
- Aprova alimentos (apenas admin humano)
- Remove dados
- Sobrescreve registros
- Altera visibilidade manualmente

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHEMA OBRIGATÓRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Todo alimento deve respeitar:
- name (Nome padronizado PT-BR)
- canonical_name (lowercase, sem acentos, underscore separador)
- category (frutas | hortalicas_folhosas | legumes | cereais_tuberculos | leguminosas | proteinas_animais | laticinios | oleos_oleaginosas | suplementos)
- calories (kcal por porção)
- protein (g)
- carbs (g)
- fat (g)
- serving_size (ex: 100g)
- type (food | supplement)
- origin (manual | ia_estimated | imported)
- confidence_level (high | medium | low)
- is_optional (boolean)
- created_by_type (admin | professional | ai | system)
- created_by_id (UUID ou NULL)
- review_status (pending | approved | rejected)
- is_active (boolean)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POLÍTICAS DE VISIBILIDADE (NÃO VIOLAR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 ALIMENTOS OFICIAIS (BASE DO SISTEMA)
- review_status = approved AND is_active = true
- Visíveis para: Todos os usuários

🟡 ALIMENTOS CRIADOS PELA IA (NÃO APROVADOS)
- created_by_type = ai AND review_status = pending
- Visíveis para: Admin (somente para revisão)
- ⚠️ Nunca entram em plano alimentar

🟣 ALIMENTOS CRIADOS POR PROFISSIONAL (PENDENTES)
- created_by_type = professional AND review_status = pending
- Visíveis para: Profissional criador + Admin

🔵 ALIMENTOS CRIADOS POR PROFISSIONAL (APROVADOS)
- created_by_type = professional AND review_status = approved
- Visíveis para: Todos os profissionais + Usuários pagos + Admin

🔴 ALIMENTOS REJEITADOS OU DESATIVADOS
- review_status = rejected OR is_active = false
- Visíveis para: Admin (auditoria apenas)

🧠 SUPLEMENTOS (REGRA ESPECIAL)
- Mesmo aprovados, suplementos:
  - ❌ NÃO aparecem para usuário gratuito
  - ✅ Aparecem para usuário pago
  - ✅ Aparecem para profissional
  - Sempre com badge "Suplementar"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOVERNANÇA DE AUTORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para NOVOS alimentos sugeridos pela IA, aplicar OBRIGATORIAMENTE:
- created_by_type = "ai"
- created_by_id = null
- origin = "ia_estimated"
- review_status = "pending"
- confidence_level = "medium"
- is_active = true

⚠️ A IA NUNCA aprova seus próprios alimentos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTROLE DE DUPLICIDADE (OBRIGATÓRIO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de sugerir novo alimento:
1. Normalizar nome (remover marca, preparo, adjetivos)
2. Gerar canonical_name
3. Comparar com existentes (nome canônico + macros ±10%)
4. Se equivalente existir: NÃO criar, sinalizar duplicata

Diferenças que NÃO criam novo alimento:
- Preparo (cozido, grelhado, assado)
- Marca
- Cor superficial
- Porção diferente

Diferenças que PODEM criar novo alimento:
- Integral × refinado
- Cru × frito
- In natura × ultraprocessado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONSISTÊNCIA NUTRICIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Fórmula: kcal_calc = protein*4 + carbs*4 + fat*9
Tolerância: ±5% entre calculado e declarado

Se incoerente → sinalizar como alerta, NÃO corrigir.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SAÍDA OBRIGATÓRIA (JSON VÁLIDO)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne APENAS JSON válido, sem markdown, sem explicações:

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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REGRA FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Se houver QUALQUER dúvida:
➡️ NÃO criar o alimento
➡️ Marcar para revisão humana`;

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
    const { mode = 'full', category_filter = null, limit = 100 } = body; // Reduced default limit

    console.log(`Running food curation in ${mode} mode with limit ${limit}...`);

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

    // Call AI via Lovable AI Gateway with smaller batches
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        max_tokens: 32000, // Increased token limit
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
      console.error('Failed to parse AI response, attempting recovery...', cleanedContent.substring(0, 500));
      
      // Attempt to recover partial valid JSON
      try {
        // Try to find the last complete object in each array
        const partialResult: { alerts: AuditAlert[]; suggested_foods: SuggestedFood[]; duplicates: DuplicateCandidate[] } = {
          alerts: [],
          suggested_foods: [],
          duplicates: []
        };
        
        // Try to extract alerts array if present
        const alertsMatch = cleanedContent.match(/"alerts"\s*:\s*\[([\s\S]*?)(?:\],|\]$)/);
        if (alertsMatch) {
          try {
            const alertsJson = '[' + alertsMatch[1].replace(/,\s*$/, '') + ']';
            // Try to parse, removing incomplete last object if needed
            let alertsStr = alertsJson;
            while (alertsStr.length > 2) {
              try {
                partialResult.alerts = JSON.parse(alertsStr);
                break;
              } catch {
                // Remove last character and try again
                const lastBrace = alertsStr.lastIndexOf('{');
                if (lastBrace > 1) {
                  alertsStr = alertsStr.substring(0, lastBrace).replace(/,\s*$/, '') + ']';
                } else {
                  break;
                }
              }
            }
          } catch { /* ignore */ }
        }
        
        aiResult = partialResult;
        console.log('Recovered partial result with', partialResult.alerts.length, 'alerts');
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError);
        throw new Error('Invalid JSON response from AI - could not recover partial data');
      }
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
