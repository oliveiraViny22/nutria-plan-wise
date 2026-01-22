// =====================================================
// EDGE FUNCTION: ESTRATÉGIAS DE REBALANCEAMENTO (IA)
// =====================================================
// Esta função é chamada APENAS quando o backend sinaliza
// falha controlada. A IA analisa o motivo e sugere
// ESTRATÉGIAS, nunca valores numéricos finais.
//
// REGRAS INVIOLÁVEIS:
// 1. IA NÃO calcula macros finais
// 2. IA NÃO define gramagens
// 3. IA NÃO aplica mudanças
// 4. IA NÃO viola teto calórico
// 5. IA NÃO burla regras de plano ou suplemento
// 6. Toda sugestão é OPCIONAL
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createErrorResponse, createSuccessResponse, CLIENT_ERRORS } from "../_shared/security.ts";

// =====================================================
// TIPOS
// =====================================================

type ControlledFailureReason = 
  | 'calorie_protein_impossible'
  | 'macro_distribution_blocked'
  | 'insufficient_food_variety';

interface FailureDetails {
  reason: ControlledFailureReason;
  proteinGap: number;
  calorieGap: number;
  blockedBy: string[];
  attemptedAdjustments: number;
  userMessage: string;
}

type AIStrategyType = 
  | 'redistribute_meals'
  | 'substitute_within_category'
  | 'add_complementary_option'
  | 'reduce_meal_complexity'
  | 'adjust_meal_timing'
  | 'professional_guidance';

interface AIStrategy {
  type: AIStrategyType;
  title: string;
  description: string;
  targetMeals?: string[];
  targetCategories?: string[];
  requiresSupplement: boolean;
  requiresProfessional: boolean;
  expectedImpact: 'low' | 'medium' | 'high';
  considerations: string[];
}

interface AIStrategiesResponse {
  failureAnalysis: string;
  strategies: AIStrategy[];
  noViableStrategy: boolean;
  noViableReason?: string;
  recommendation: string;
}

interface RequestBody {
  plan_id: string;
  failure_details: FailureDetails;
  current_meals: {
    id: string;
    name: string;
    foods: { name: string; category: string; grams: number }[];
  }[];
  user_preferences?: string[];
  user_restrictions?: string[];
  allow_supplements: boolean;
}

// =====================================================
// PROMPT DO SISTEMA
// =====================================================

const SYSTEM_PROMPT = `Você é o Consultor de Estratégias Nutricionais do NutriaPlan.

SUA FUNÇÃO ÚNICA:
Analisar por que o rebalanceador automático falhou e sugerir ESTRATÉGIAS nutricionais.
Você NUNCA fornece valores numéricos finais, gramagens ou cálculos.

REGRAS ABSOLUTAS:
1. NUNCA calcule macros finais
2. NUNCA defina gramagens específicas
3. NUNCA diga "aumente para X gramas" ou "reduza para Y calorias"
4. NUNCA sugira ações que violem o teto calórico
5. NUNCA ignore restrições do usuário
6. TODAS as sugestões são OPCIONAIS

ESTRATÉGIAS PERMITIDAS:
- redistribute_meals: Redistribuir alimentos entre refeições
- substitute_within_category: Substituir por alimento equivalente na mesma categoria
- add_complementary_option: Criar opção complementar (ex: lanche proteico)
- reduce_meal_complexity: Simplificar refeições para melhor adesão
- adjust_meal_timing: Ajustar distribuição de calorias ao longo do dia
- professional_guidance: Recomendar acompanhamento profissional

FORMATO DE RESPOSTA (JSON):
{
  "failureAnalysis": "Explicação clara do motivo da falha em 2-3 frases",
  "strategies": [
    {
      "type": "redistribute_meals",
      "title": "Título curto e claro",
      "description": "Explicação em linguagem simples do que seria feito",
      "targetMeals": ["Café da Manhã", "Almoço"],
      "targetCategories": ["proteinas", "carboidratos"],
      "requiresSupplement": false,
      "requiresProfessional": false,
      "expectedImpact": "medium",
      "considerations": ["Pode alterar saciedade", "Requer ajuste de horários"]
    }
  ],
  "noViableStrategy": false,
  "noViableReason": null,
  "recommendation": "Recomendação geral em uma frase"
}

SE NENHUMA ESTRATÉGIA FOR VIÁVEL:
{
  "failureAnalysis": "Explicação do motivo",
  "strategies": [
    {
      "type": "professional_guidance",
      "title": "Acompanhamento Profissional Recomendado",
      "description": "Seu caso requer avaliação individualizada...",
      "requiresSupplement": false,
      "requiresProfessional": true,
      "expectedImpact": "high",
      "considerations": ["Metas podem precisar de revisão"]
    }
  ],
  "noViableStrategy": true,
  "noViableReason": "Explicação clara da limitação",
  "recommendation": "Consulte um nutricionista para ajustar suas metas"
}`;

// =====================================================
// CONSTRUTOR DE PROMPT DO USUÁRIO
// =====================================================

function buildUserPrompt(body: RequestBody): string {
  const { failure_details, current_meals, user_preferences, user_restrictions, allow_supplements } = body;

  const mealsSummary = current_meals.map(meal => {
    const foodsStr = meal.foods.map(f => `${f.name} (${f.category})`).join(', ');
    return `- ${meal.name}: ${foodsStr}`;
  }).join('\n');

  return `
FALHA DO REBALANCEADOR:
Motivo: ${failure_details.reason}
Déficit de proteína não resolvido: ${failure_details.proteinGap}g
Déficit/Excesso de calorias não resolvido: ${failure_details.calorieGap} kcal
Regras que bloquearam: ${failure_details.blockedBy.join(', ')}
Ajustes tentados: ${failure_details.attemptedAdjustments}

REFEIÇÕES ATUAIS:
${mealsSummary}

PREFERÊNCIAS DO USUÁRIO:
${user_preferences?.join(', ') || 'Nenhuma informada'}

RESTRIÇÕES DO USUÁRIO:
${user_restrictions?.join(', ') || 'Nenhuma'}

SUPLEMENTOS PERMITIDOS: ${allow_supplements ? 'Sim' : 'Não'}

Com base nessas informações, sugira até 3 estratégias para resolver o problema.
Lembre-se: NÃO forneça valores numéricos, apenas estratégias em linguagem simples.
`.trim();
}

// =====================================================
// FALLBACK: ESTRATÉGIAS BASEADAS EM REGRAS
// =====================================================

function generateRuleBasedStrategies(body: RequestBody): AIStrategiesResponse {
  const { failure_details, allow_supplements } = body;
  const strategies: AIStrategy[] = [];

  // Estratégia 1: Redistribuição
  if (failure_details.proteinGap > 0) {
    strategies.push({
      type: 'redistribute_meals',
      title: 'Redistribuir Proteína Entre Refeições',
      description: 'Mover parte da proteína das refeições principais para lanches pode ajudar a atingir a meta sem exceder calorias.',
      targetCategories: ['proteinas'],
      requiresSupplement: false,
      requiresProfessional: false,
      expectedImpact: 'medium',
      considerations: [
        'Pode requerer ajuste nos horários das refeições',
        'Proteína fracionada pode ter melhor absorção'
      ]
    });
  }

  // Estratégia 2: Substituição
  strategies.push({
    type: 'substitute_within_category',
    title: 'Substituir por Alimentos Mais Proteicos',
    description: 'Trocar alguns alimentos por opções com melhor relação proteína/caloria dentro da mesma categoria.',
    targetCategories: ['proteinas'],
    requiresSupplement: false,
    requiresProfessional: false,
    expectedImpact: 'medium',
    considerations: [
      'Mantém equivalência calórica',
      'Pode alterar levemente o sabor das refeições'
    ]
  });

  // Estratégia 3: Suplementação (se permitido)
  if (allow_supplements && failure_details.proteinGap > 10) {
    strategies.push({
      type: 'add_complementary_option',
      title: 'Adicionar Opção com Suplemento',
      description: 'Criar uma opção de lanche com whey protein ou similar pode cobrir o déficit de proteína sem adicionar muitas calorias.',
      targetCategories: ['suplementos'],
      requiresSupplement: true,
      requiresProfessional: false,
      expectedImpact: 'high',
      considerations: [
        'Requer compra de suplemento',
        'Solução mais direta para déficit proteico alto'
      ]
    });
  }

  // Se nenhuma estratégia viável
  if (strategies.length === 0) {
    return {
      failureAnalysis: `O rebalanceador não conseguiu atingir as metas porque: ${failure_details.userMessage}`,
      strategies: [{
        type: 'professional_guidance',
        title: 'Acompanhamento Profissional Recomendado',
        description: 'Suas metas nutricionais podem precisar de revisão por um profissional de saúde.',
        requiresSupplement: false,
        requiresProfessional: true,
        expectedImpact: 'high',
        considerations: ['Metas muito ambiciosas para os alimentos disponíveis']
      }],
      noViableStrategy: true,
      noViableReason: 'As metas definidas não são atingíveis apenas com ajustes de porções.',
      recommendation: 'Consulte um nutricionista para revisar suas metas calóricas e proteicas.'
    };
  }

  return {
    failureAnalysis: `O rebalanceador não conseguiu atingir as metas porque: ${failure_details.userMessage}`,
    strategies,
    noViableStrategy: false,
    recommendation: 'Escolha uma das estratégias acima para o sistema recalcular seu plano.'
  };
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    // Parse request body
    const body: RequestBody = await req.json();

    // Validate required fields
    if (!body.plan_id || !body.failure_details || !body.current_meals) {
      return createErrorResponse('Dados incompletos para análise de estratégias', 400, corsHeaders);
    }

    // Try AI-powered strategies
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    let strategies: AIStrategiesResponse;

    if (apiKey) {
      try {
        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: buildUserPrompt(body) }
            ],
            temperature: 0.3,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          
          // Parse JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            strategies = JSON.parse(jsonMatch[0]);
          } else {
            strategies = generateRuleBasedStrategies(body);
          }
        } else {
          // Handle rate limiting
          if (response.status === 429) {
            return createErrorResponse('Limite de requisições excedido. Tente novamente em alguns minutos.', 429, corsHeaders);
          }
          if (response.status === 402) {
            return createErrorResponse('Créditos de IA esgotados.', 402, corsHeaders);
          }
          strategies = generateRuleBasedStrategies(body);
        }
      } catch (error) {
        console.error('AI strategies error:', error);
        strategies = generateRuleBasedStrategies(body);
      }
    } else {
      strategies = generateRuleBasedStrategies(body);
    }

    // Log usage
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabaseAdmin.from('ai_usage_logs').insert({
      user_id: user.id,
      function_name: 'rebalance-strategies',
      model: 'google/gemini-3-flash-preview',
      success: true,
      metadata: { 
        failure_reason: body.failure_details.reason,
        strategies_count: strategies.strategies.length,
        no_viable: strategies.noViableStrategy
      }
    });

    return createSuccessResponse(strategies, corsHeaders);

  } catch (error) {
    console.error('Strategies error:', error);
    return createErrorResponse('Erro ao analisar estratégias', 500, getCorsHeaders(req));
  }
});
