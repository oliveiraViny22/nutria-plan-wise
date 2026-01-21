import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, createErrorResponse, createSuccessResponse, validate, CLIENT_ERRORS } from "../_shared/security.ts";

type UserProfile = 'free' | 'premium' | 'usuario_pessoal_pago' | 'profissional_vinculado';

interface ProfileData {
  user_id: string;
  name: string | null;
  goal: string | null;
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  preferences: string[] | null;
  restrictions: string[] | null;
  meals_per_day: number | null;
}

interface PlanData {
  plan_type: string;
  subscription_status: string;
  diet_limit: number;
  has_chat: boolean;
}

interface AdherenceMetrics {
  total_days: number;
  confirmed_meals: number;
  skipped_meals: number;
  late_confirmed: number;
  out_of_plan: number;
  adherence_rate: number;
}

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string | null;
  processing_level: string | null;
}

interface MealOptionFood {
  id: string;
  food_id: string;
  quantity_grams: number;
  food: FoodItem;
}

interface MealOption {
  id: string;
  option_number: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  foods: MealOptionFood[];
}

interface Meal {
  id: string;
  name: string;
  sort_order: number;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  options: MealOption[];
}

interface Adjustment {
  type: 'quantity_change' | 'food_substitution' | 'meal_redistribution' | 'supplement_addition';
  meal_id: string;
  meal_name: string;
  option_id: string;
  food_id?: string;
  food_name?: string;
  original_quantity?: number;
  new_quantity?: number;
  new_food_id?: string;
  new_food_name?: string;
  reason: string;
}

interface RebalanceResult {
  success: boolean;
  profile_type: UserProfile;
  adjustments: Adjustment[];
  current_macros: { calories: number; protein: number; carbs: number; fat: number };
  proposed_macros: { calories: number; protein: number; carbs: number; fat: number };
  target_macros: { calories: number; protein: number; carbs: number; fat: number };
  justification: string;
  adherence_impact: string;
  warnings: string[];
  requires_approval: boolean;
  execution_blocked: boolean;
  block_reason?: string;
}

// =====================================================
// CONSTANTES DE EQUIVALÊNCIA
// =====================================================

const EQUIVALENCE_TOLERANCES = {
  protein: 5,      // ±5g
  carbs: 10,       // ±10g
  fat: 3,          // ±3g
  calories_percent: 10  // ±10%
};

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function determineUserProfile(planData: PlanData | null, isProfessional: boolean, isLinkedStudent: boolean): UserProfile {
  if (isProfessional) {
    return 'profissional_vinculado';
  }
  
  if (!planData) {
    return 'free';
  }

  const planType = planData.plan_type;
  
  if (planType === 'profissional') {
    return 'profissional_vinculado';
  }
  
  if (planType === 'plano_pessoal_pago') {
    return 'usuario_pessoal_pago';
  }
  
  if (planType === 'premium' || (isLinkedStudent && planData.subscription_status === 'active')) {
    return 'premium';
  }
  
  return 'free';
}

function getProfilePermissions(profile: UserProfile): {
  canAdjustMacros: boolean;
  canAdjustCalories: boolean;
  canSubstituteFoods: boolean;
  canReorganizeMeals: boolean;
  requiresApproval: boolean;
  canExecute: boolean;
} {
  switch (profile) {
    case 'free':
      return {
        canAdjustMacros: false,
        canAdjustCalories: false,
        canSubstituteFoods: false,
        canReorganizeMeals: false,
        requiresApproval: false,
        canExecute: false
      };
    case 'premium':
      return {
        canAdjustMacros: false,
        canAdjustCalories: false,
        canSubstituteFoods: true,
        canReorganizeMeals: true,
        requiresApproval: false,
        canExecute: true
      };
    case 'usuario_pessoal_pago':
      return {
        canAdjustMacros: true,
        canAdjustCalories: true,
        canSubstituteFoods: true,
        canReorganizeMeals: true,
        requiresApproval: false,
        canExecute: true
      };
    case 'profissional_vinculado':
      return {
        canAdjustMacros: true,
        canAdjustCalories: true,
        canSubstituteFoods: true,
        canReorganizeMeals: true,
        requiresApproval: true,
        canExecute: false
      };
  }
}

function calculateCurrentMacros(meals: Meal[]): { calories: number; protein: number; carbs: number; fat: number } {
  let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  for (const meal of meals) {
    // Use first option as base for calculation
    const option = meal.options[0];
    if (option) {
      totals.calories += option.total_calories;
      totals.protein += option.total_protein;
      totals.carbs += option.total_carbs;
      totals.fat += option.total_fat;
    }
  }
  
  return totals;
}

function checkEquivalence(
  original: { calories: number; protein: number; carbs: number; fat: number },
  proposed: { calories: number; protein: number; carbs: number; fat: number }
): { isValid: boolean; violations: string[] } {
  const violations: string[] = [];
  
  const proteinDiff = Math.abs(proposed.protein - original.protein);
  if (proteinDiff > EQUIVALENCE_TOLERANCES.protein) {
    violations.push(`Proteína excede tolerância: ±${proteinDiff.toFixed(1)}g (máx ±${EQUIVALENCE_TOLERANCES.protein}g)`);
  }
  
  const carbsDiff = Math.abs(proposed.carbs - original.carbs);
  if (carbsDiff > EQUIVALENCE_TOLERANCES.carbs) {
    violations.push(`Carboidrato excede tolerância: ±${carbsDiff.toFixed(1)}g (máx ±${EQUIVALENCE_TOLERANCES.carbs}g)`);
  }
  
  const fatDiff = Math.abs(proposed.fat - original.fat);
  if (fatDiff > EQUIVALENCE_TOLERANCES.fat) {
    violations.push(`Gordura excede tolerância: ±${fatDiff.toFixed(1)}g (máx ±${EQUIVALENCE_TOLERANCES.fat}g)`);
  }
  
  const caloriesDiffPercent = Math.abs((proposed.calories - original.calories) / original.calories * 100);
  if (caloriesDiffPercent > EQUIVALENCE_TOLERANCES.calories_percent) {
    violations.push(`Calorias excedem tolerância: ±${caloriesDiffPercent.toFixed(1)}% (máx ±${EQUIVALENCE_TOLERANCES.calories_percent}%)`);
  }
  
  return { isValid: violations.length === 0, violations };
}

// deno-lint-ignore no-explicit-any
async function calculateAdherenceMetrics(
  supabase: any,
  userId: string,
  days: number = 30
): Promise<AdherenceMetrics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const { data: mealLogs } = await supabase
    .from('meal_logs')
    .select(`
      status,
      daily_log:daily_logs!inner(user_id, log_date)
    `)
    .eq('daily_log.user_id', userId)
    .gte('daily_log.log_date', startDate.toISOString().split('T')[0]);
  
  if (!mealLogs || mealLogs.length === 0) {
    return {
      total_days: 0,
      confirmed_meals: 0,
      skipped_meals: 0,
      late_confirmed: 0,
      out_of_plan: 0,
      adherence_rate: 0
    };
  }
  
  const stats = {
    total_days: days,
    confirmed_meals: 0,
    skipped_meals: 0,
    late_confirmed: 0,
    out_of_plan: 0,
    adherence_rate: 0
  };
  
  for (const log of mealLogs) {
    // deno-lint-ignore no-explicit-any
    const status = (log as any).status;
    switch (status) {
      case 'confirmed':
        stats.confirmed_meals++;
        break;
      case 'skipped':
        stats.skipped_meals++;
        break;
      case 'late_confirmed':
        stats.late_confirmed++;
        break;
      case 'out_of_plan':
        stats.out_of_plan++;
        break;
    }
  }
  
  const totalMeals = stats.confirmed_meals + stats.skipped_meals + stats.late_confirmed + stats.out_of_plan;
  stats.adherence_rate = totalMeals > 0 
    ? ((stats.confirmed_meals + stats.late_confirmed) / totalMeals) * 100 
    : 0;
  
  return stats;
}

async function generateAIRebalanceSuggestions(
  profile: ProfileData,
  meals: Meal[],
  currentMacros: { calories: number; protein: number; carbs: number; fat: number },
  targetMacros: { calories: number; protein: number; carbs: number; fat: number },
  adherence: AdherenceMetrics,
  permissions: ReturnType<typeof getProfilePermissions>,
  availableFoods: FoodItem[],
  profileType: UserProfile
): Promise<{ adjustments: Adjustment[]; justification: string; adherence_impact: string; warnings: string[] }> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  
  // Return explanation only for free users
  if (profileType === 'free') {
    return {
      adjustments: [],
      justification: `Seu plano atual apresenta as seguintes diferenças em relação às metas:
- Calorias: ${currentMacros.calories} kcal (meta: ${targetMacros.calories} kcal)
- Proteína: ${currentMacros.protein}g (meta: ${targetMacros.protein}g)
- Carboidrato: ${currentMacros.carbs}g (meta: ${targetMacros.carbs}g)
- Gordura: ${currentMacros.fat}g (meta: ${targetMacros.fat}g)

Para ajustar automaticamente seu plano e atingir suas metas, faça upgrade para o plano Premium ou Pessoal Pago.`,
      adherence_impact: 'Nenhum ajuste aplicado - plano gratuito.',
      warnings: ['Plano gratuito não permite ajustes automáticos. Apenas explicações são fornecidas.']
    };
  }

  if (!apiKey) {
    // Fallback to rule-based rebalancing
    const result = generateRuleBasedAdjustments(meals, currentMacros, targetMacros, permissions, availableFoods);
    return { ...result, warnings: [] };
  }

  const prompt = buildRebalancePrompt(profile, meals, currentMacros, targetMacros, adherence, permissions, profileType);
  
  try {
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(profileType)
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      const result = generateRuleBasedAdjustments(meals, currentMacros, targetMacros, permissions, availableFoods);
      return { ...result, warnings: [] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        adjustments: parsed.adjustments || [],
        justification: parsed.justification || 'Ajustes calculados com base nos objetivos nutricionais.',
        adherence_impact: parsed.adherence_impact || 'Impacto neutro esperado na adesão.',
        warnings: parsed.warnings || []
      };
    }
  } catch (error) {
    console.error('AI rebalance error:', error);
  }
  
  const result = generateRuleBasedAdjustments(meals, currentMacros, targetMacros, permissions, availableFoods);
  return { ...result, warnings: [] };
}

function buildSystemPrompt(profileType: UserProfile): string {
  const baseRules = `Você é o Rebalanceador Automático do NutriaPlan.

SUA FUNÇÃO:
- Ajustar planos alimentares existentes respeitando perfil, permissões e governança clínica
- Melhorar adesão e corrigir desvios de peso/macros
- Manter plano seguro, explicável e nutricionalmente equivalente

CATEGORIAS DE ALIMENTOS OBRIGATÓRIAS:
Você DEVE usar EXCLUSIVAMENTE estas categorias ao classificar ou referenciar alimentos:
- carboidratos (arroz, pão, massas, tubérculos, cereais)
- proteinas (carnes, peixes, ovos, frango)
- gorduras (óleos, azeites, oleaginosas, castanhas)
- vegetais (folhas, verduras, legumes)
- frutas (frutas frescas e secas)
- laticinios (leite, queijos, iogurtes)
- leguminosas (feijões, lentilha, grão-de-bico, soja)
- suplementos (whey, creatina, vitaminas)
- mistos (preparações mistas, pratos prontos)

Qualquer outra categoria é INVÁLIDA.

ETAPAS OBRIGATÓRIAS:
1. Identificar perfil (free/premium/usuario_pessoal_pago/profissional_vinculado)
2. Validar permissões do perfil
3. Avaliar objetivo, adesão e comportamento alimentar
4. Aplicar apenas ajustes permitidos
5. Gerar justificativa clara e impacto na adesão

REGRAS DE EQUIVALÊNCIA OBRIGATÓRIAS:
- Proteína: ±5g
- Carboidrato: ±10g
- Gordura: ±3g
- Calorias: ±10%
NUNCA quebrar equivalência sem permissão explícita.

REGRAS DE SEGURANÇA:
- Se dados insuficientes, conflito de permissões ou risco clínico → ABORTAR
- Nunca inferir doenças ou usar lógica clínica
- Nunca interpretar dados médicos
- Nunca executar sem dados suficientes
- Priorizar alimentos in natura e minimamente processados
- Se adesão < 50%, considerar simplificar refeições
- Se adesão > 80%, manter estrutura e fazer ajustes mínimos

Responda APENAS em JSON válido com o formato:
{
  "adjustments": [...],
  "justification": "string",
  "adherence_impact": "string",
  "warnings": ["string"]
}`;

  const profileRules: Record<UserProfile, string> = {
    free: `
PERFIL: GRATUITO (🟢)
LIMITES ESTRITOS:
❌ NÃO rebalancear macros
❌ NÃO alterar calorias
❌ NÃO substituir alimentos
❌ NÃO reorganizar refeições
✅ APENAS explicar a situação atual e recomendar upgrade`,
    premium: `
PERFIL: PREMIUM (🟡)
PERMISSÕES:
✅ Ajustar distribuição de refeições
✅ Ajustar escolhas alimentares dentro das opções
❌ NÃO alterar target calórico total
❌ NÃO modificar macros targets`,
    usuario_pessoal_pago: `
PERFIL: USUÁRIO PESSOAL PAGO (🟠)
PERMISSÕES:
✅ Ajustar calorias totais
✅ Ajustar macros
✅ Substituir alimentos
✅ Reorganizar refeições
❌ PROIBIDO: usar lógica clínica
❌ PROIBIDO: inferir doenças
❌ PROIBIDO: interpretar dados médicos
❌ PROIBIDO: recomendar suplementos terapêuticos`,
    profissional_vinculado: `
PERFIL: PROFISSIONAL VINCULADO (🔵)
COMPORTAMENTO ESPECIAL:
❌ NÃO executar automaticamente
✅ GERAR sugestão técnica detalhada
✅ Incluir justificativa clínica para revisão
✅ AGUARDAR aprovação do profissional
✅ Marcar requires_approval = true`
  };

  return baseRules + profileRules[profileType];
}

function buildRebalancePrompt(
  profile: ProfileData,
  meals: Meal[],
  currentMacros: { calories: number; protein: number; carbs: number; fat: number },
  targetMacros: { calories: number; protein: number; carbs: number; fat: number },
  adherence: AdherenceMetrics,
  permissions: ReturnType<typeof getProfilePermissions>,
  profileType: UserProfile
): string {
  const deficits = {
    calories: targetMacros.calories - currentMacros.calories,
    protein: targetMacros.protein - currentMacros.protein,
    carbs: targetMacros.carbs - currentMacros.carbs,
    fat: targetMacros.fat - currentMacros.fat
  };

  // Analyze adherence behavior
  const adherenceBehavior = analyzeAdherenceBehavior(adherence);

  return `
PERFIL DO USUÁRIO (${profileType}):
- Objetivo: ${profile.goal || 'não definido'}
- Meta calórica: ${targetMacros.calories} kcal
- Meta proteína: ${targetMacros.protein}g
- Meta carboidrato: ${targetMacros.carbs}g
- Meta gordura: ${targetMacros.fat}g
- Preferências: ${profile.preferences?.join(', ') || 'nenhuma'}
- Restrições: ${profile.restrictions?.join(', ') || 'nenhuma'}

MACROS ATUAIS:
- Calorias: ${currentMacros.calories} kcal (déficit/excesso: ${deficits.calories > 0 ? '+' : ''}${deficits.calories})
- Proteína: ${currentMacros.protein}g (déficit/excesso: ${deficits.protein > 0 ? '+' : ''}${deficits.protein})
- Carboidrato: ${currentMacros.carbs}g (déficit/excesso: ${deficits.carbs > 0 ? '+' : ''}${deficits.carbs})
- Gordura: ${currentMacros.fat}g (déficit/excesso: ${deficits.fat > 0 ? '+' : ''}${deficits.fat})

ANÁLISE DE ADESÃO (últimos 30 dias):
- Taxa de adesão: ${adherence.adherence_rate.toFixed(1)}%
- Classificação: ${adherenceBehavior.classification}
- Refeições confirmadas: ${adherence.confirmed_meals}
- Refeições puladas: ${adherence.skipped_meals}
- Confirmações tardias: ${adherence.late_confirmed}
- Fora do plano: ${adherence.out_of_plan}

COMPORTAMENTO ALIMENTAR DETECTADO:
${adherenceBehavior.insights.map(i => `- ${i}`).join('\n')}

RECOMENDAÇÕES BASEADAS NA ADESÃO:
${adherenceBehavior.recommendations.map(r => `- ${r}`).join('\n')}

PERMISSÕES DO PERFIL:
- Pode ajustar macros: ${permissions.canAdjustMacros ? 'Sim' : 'Não'}
- Pode ajustar calorias: ${permissions.canAdjustCalories ? 'Sim' : 'Não'}
- Pode substituir alimentos: ${permissions.canSubstituteFoods ? 'Sim' : 'Não'}
- Pode reorganizar refeições: ${permissions.canReorganizeMeals ? 'Sim' : 'Não'}
- Requer aprovação: ${permissions.requiresApproval ? 'Sim' : 'Não'}

REFEIÇÕES ATUAIS:
${meals.map(m => `
${m.name}:
${m.options[0]?.foods.map(f => `  - ${f.food.name}: ${f.quantity_grams}g (${f.food.calories} kcal, P:${f.food.protein}g, C:${f.food.carbs}g, G:${f.food.fat}g)`).join('\n') || '  Sem alimentos'}
`).join('\n')}

INSTRUÇÕES:
Com base nas permissões do perfil "${profileType}" e no comportamento alimentar detectado:
1. Gere ajustes que respeitem as regras de equivalência
2. Priorize a manutenção da adesão (não fazer mudanças drásticas se adesão está boa)
3. Se adesão baixa, simplifique o plano em vez de adicionar complexidade
4. Justifique cada ajuste com foco no impacto prático

Responda em JSON:
{
  "adjustments": [
    {
      "type": "quantity_change" | "food_substitution" | "meal_redistribution",
      "meal_id": "id da refeição",
      "meal_name": "nome da refeição",
      "option_id": "id da opção",
      "food_id": "id do alimento",
      "food_name": "nome do alimento",
      "original_quantity": número,
      "new_quantity": número,
      "reason": "motivo do ajuste"
    }
  ],
  "justification": "justificativa nutricional geral focada no objetivo e comportamento",
  "adherence_impact": "impacto esperado na adesão com base no comportamento atual",
  "warnings": ["avisos de limitação, se houver"]
}`;
}

function analyzeAdherenceBehavior(adherence: AdherenceMetrics): {
  classification: string;
  insights: string[];
  recommendations: string[];
} {
  const rate = adherence.adherence_rate;
  const totalRecords = adherence.confirmed_meals + adherence.skipped_meals + 
                       adherence.late_confirmed + adherence.out_of_plan;
  
  let classification: string;
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Classify adherence level
  if (rate >= 80) {
    classification = 'EXCELENTE';
    insights.push('Usuário demonstra alta disciplina alimentar');
    recommendations.push('Manter estrutura atual - fazer apenas ajustes finos');
    recommendations.push('Evitar mudanças drásticas que possam afetar a rotina');
  } else if (rate >= 60) {
    classification = 'BOA';
    insights.push('Adesão moderada com espaço para otimização');
    recommendations.push('Focar em tornar refeições mais práticas');
    recommendations.push('Considerar simplificar opções menos aderidas');
  } else if (rate >= 40) {
    classification = 'REGULAR';
    insights.push('Dificuldade em manter o plano');
    recommendations.push('Simplificar significativamente as refeições');
    recommendations.push('Reduzir número de alimentos por refeição');
    recommendations.push('Priorizar alimentos de fácil preparo');
  } else {
    classification = 'BAIXA';
    insights.push('Adesão muito baixa - plano pode estar inadequado');
    recommendations.push('Reconsiderar completamente a estrutura');
    recommendations.push('Verificar se restrições estão sendo respeitadas');
    recommendations.push('Priorizar refeições simples e rápidas');
  }

  // Analyze specific behaviors
  if (adherence.skipped_meals > adherence.confirmed_meals) {
    insights.push('Mais refeições puladas do que confirmadas - possível falta de tempo');
    recommendations.push('Sugerir preparos antecipados ou refeições rápidas');
  }

  if (adherence.late_confirmed > adherence.confirmed_meals * 0.3) {
    insights.push('Muitas confirmações tardias - problema de rotina');
    recommendations.push('Ajustar horários das refeições ao estilo de vida');
  }

  if (adherence.out_of_plan > totalRecords * 0.2) {
    insights.push('Alto índice de refeições fora do plano - preferências não atendidas');
    recommendations.push('Incluir mais alimentos preferidos do usuário');
    recommendations.push('Revisar restrições que podem estar limitando opções');
  }

  if (totalRecords === 0) {
    classification = 'SEM DADOS';
    insights.length = 0;
    recommendations.length = 0;
    insights.push('Nenhum registro de adesão encontrado');
    recommendations.push('Aguardar dados de consumo antes de ajustes significativos');
  }

  return { classification, insights, recommendations };
}

function generateRuleBasedAdjustments(
  meals: Meal[],
  currentMacros: { calories: number; protein: number; carbs: number; fat: number },
  targetMacros: { calories: number; protein: number; carbs: number; fat: number },
  permissions: ReturnType<typeof getProfilePermissions>,
  availableFoods: FoodItem[]
): { adjustments: Adjustment[]; justification: string; adherence_impact: string } {
  const adjustments: Adjustment[] = [];
  const deficits = {
    calories: targetMacros.calories - currentMacros.calories,
    protein: targetMacros.protein - currentMacros.protein,
    carbs: targetMacros.carbs - currentMacros.carbs,
    fat: targetMacros.fat - currentMacros.fat
  };

  // Only proceed if permissions allow
  if (!permissions.canAdjustMacros && !permissions.canSubstituteFoods) {
    return {
      adjustments: [],
      justification: 'Seu plano atual não permite ajustes automáticos. Considere fazer upgrade para ter acesso a essa funcionalidade.',
      adherence_impact: 'Nenhum impacto - nenhum ajuste aplicado.'
    };
  }

  // Simple rule-based adjustments
  for (const meal of meals) {
    const option = meal.options[0];
    if (!option) continue;

    for (const mealFood of option.foods) {
      const food = mealFood.food;
      
      // Adjust protein-rich foods if protein deficit
      if (permissions.canAdjustMacros && deficits.protein > 5 && food.protein > 15) {
        const proteinPerGram = food.protein / 100;
        const additionalGrams = Math.min(50, Math.round(deficits.protein / proteinPerGram));
        
        if (additionalGrams > 10) {
          adjustments.push({
            type: 'quantity_change',
            meal_id: meal.id,
            meal_name: meal.name,
            option_id: option.id,
            food_id: food.id,
            food_name: food.name,
            original_quantity: mealFood.quantity_grams,
            new_quantity: mealFood.quantity_grams + additionalGrams,
            reason: `Aumentar proteína em ${(additionalGrams * proteinPerGram).toFixed(1)}g`
          });
          
          deficits.protein -= additionalGrams * proteinPerGram;
        }
      }
      
      // Reduce high-fat foods if fat excess
      if (permissions.canAdjustMacros && deficits.fat < -3 && food.fat > 10) {
        const fatPerGram = food.fat / 100;
        const reduceGrams = Math.min(30, Math.round(Math.abs(deficits.fat) / fatPerGram));
        
        if (reduceGrams > 5 && mealFood.quantity_grams - reduceGrams >= 20) {
          adjustments.push({
            type: 'quantity_change',
            meal_id: meal.id,
            meal_name: meal.name,
            option_id: option.id,
            food_id: food.id,
            food_name: food.name,
            original_quantity: mealFood.quantity_grams,
            new_quantity: mealFood.quantity_grams - reduceGrams,
            reason: `Reduzir gordura em ${(reduceGrams * fatPerGram).toFixed(1)}g`
          });
          
          deficits.fat += reduceGrams * fatPerGram;
        }
      }
    }
  }

  const justificationParts: string[] = [];
  if (deficits.protein > 5) justificationParts.push(`déficit de ${deficits.protein.toFixed(0)}g de proteína`);
  if (deficits.protein < -5) justificationParts.push(`excesso de ${Math.abs(deficits.protein).toFixed(0)}g de proteína`);
  if (deficits.carbs > 10) justificationParts.push(`déficit de ${deficits.carbs.toFixed(0)}g de carboidrato`);
  if (deficits.fat < -3) justificationParts.push(`excesso de ${Math.abs(deficits.fat).toFixed(0)}g de gordura`);

  return {
    adjustments,
    justification: adjustments.length > 0 
      ? `Ajustes aplicados para corrigir: ${justificationParts.join(', ')}.`
      : 'O plano está dentro das metas. Nenhum ajuste necessário.',
    adherence_impact: adjustments.length > 0
      ? 'Ajustes moderados podem melhorar resultados sem impactar significativamente a adesão.'
      : 'Nenhum impacto - plano já está otimizado.'
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // User client for auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Service client for data operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    // Parse request body
    const body = await req.json();
    const { plan_id, target_user_id, execute = false } = body;

    if (!validate.isUUID(plan_id)) {
      return createErrorResponse('ID do plano inválido', 400, corsHeaders);
    }

    const targetUserId = target_user_id || user.id;

    // Check if user has permission to rebalance this plan
    // deno-lint-ignore no-explicit-any
    const isProfessional = await checkIsProfessional(supabaseAdmin as any, user.id);
    let isLinkedStudent = false;
    
    if (targetUserId !== user.id) {
      if (!isProfessional) {
        return createErrorResponse('Sem permissão para ajustar plano de outro usuário', 403, corsHeaders);
      }
      
      // Verify professional-student relationship
      const { data: relationship } = await supabaseAdmin
        .from('professional_students')
        .select('id')
        .eq('professional_id', user.id)
        .eq('student_id', targetUserId)
        .eq('status', 'active')
        .single();
      
      if (!relationship) {
        return createErrorResponse('Usuário não é seu aluno vinculado', 403, corsHeaders);
      }
      
      isLinkedStudent = true;
    }

    // Get user's plan info
    const { data: planData } = await supabaseAdmin.rpc('get_user_plan', { _user_id: targetUserId });
    const userPlanData = planData?.[0] || null;

    // Determine profile type and permissions
    const profileType = determineUserProfile(userPlanData, isProfessional && targetUserId !== user.id, isLinkedStudent);
    const permissions = getProfilePermissions(profileType);

    // Get profile data
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', targetUserId)
      .single();

    if (profileError || !profileData) {
      return createErrorResponse('Perfil não encontrado', 404, corsHeaders);
    }

    // Get diet plan with meals
    const { data: dietPlan, error: planError } = await supabaseAdmin
      .from('diet_plans')
      .select('id, user_id, status')
      .eq('id', plan_id)
      .eq('user_id', targetUserId)
      .eq('status', 'active')
      .single();

    if (planError || !dietPlan) {
      return createErrorResponse('Plano alimentar não encontrado ou inativo', 404, corsHeaders);
    }

    // Get meals with options and foods
    const { data: mealsData, error: mealsError } = await supabaseAdmin
      .from('meals')
      .select(`
        id,
        name,
        sort_order,
        total_calories,
        total_protein,
        total_carbs,
        total_fat,
        meal_options (
          id,
          option_number,
          total_calories,
          total_protein,
          total_carbs,
          total_fat,
          meal_option_foods (
            id,
            food_id,
            quantity_grams,
            foods (
              id,
              name,
              calories,
              protein,
              carbs,
              fat,
              category,
              processing_level
            )
          )
        )
      `)
      .eq('diet_plan_id', plan_id)
      .order('sort_order', { ascending: true });

    if (mealsError || !mealsData) {
      return createErrorResponse('Erro ao buscar refeições', 500, corsHeaders);
    }

    // Transform data
    const meals: Meal[] = mealsData.map(meal => ({
      id: meal.id,
      name: meal.name,
      sort_order: meal.sort_order,
      total_calories: meal.total_calories || 0,
      total_protein: meal.total_protein || 0,
      total_carbs: meal.total_carbs || 0,
      total_fat: meal.total_fat || 0,
      options: (meal.meal_options || []).map((opt: any) => ({
        id: opt.id,
        option_number: opt.option_number,
        total_calories: opt.total_calories || 0,
        total_protein: opt.total_protein || 0,
        total_carbs: opt.total_carbs || 0,
        total_fat: opt.total_fat || 0,
        foods: (opt.meal_option_foods || []).map((mof: any) => ({
          id: mof.id,
          food_id: mof.food_id,
          quantity_grams: mof.quantity_grams,
          food: mof.foods
        }))
      }))
    }));

    // Calculate current macros
    const currentMacros = calculateCurrentMacros(meals);
    
    // Target macros from profile
    const targetMacros = {
      calories: profileData.daily_calories || 2000,
      protein: profileData.protein_target || 100,
      carbs: profileData.carbs_target || 250,
      fat: profileData.fat_target || 65
    };

    // Get adherence metrics
    const adherence = await calculateAdherenceMetrics(supabaseAdmin, targetUserId);

    // Check if rebalancing is needed
    const macrosDiff = {
      calories: Math.abs(currentMacros.calories - targetMacros.calories),
      protein: Math.abs(currentMacros.protein - targetMacros.protein),
      carbs: Math.abs(currentMacros.carbs - targetMacros.carbs),
      fat: Math.abs(currentMacros.fat - targetMacros.fat)
    };

    const warnings: string[] = [];

    // Check for insufficient data
    if (!profileData.daily_calories || !profileData.protein_target) {
      warnings.push('Metas calóricas não definidas no perfil. Usando valores padrão.');
    }

    // Check for clinical risk indicators (abort if detected)
    if (profileData.restrictions?.some((r: string) => 
      r.toLowerCase().includes('diabetes') || 
      r.toLowerCase().includes('renal') ||
      r.toLowerCase().includes('hepático')
    )) {
      return createSuccessResponse({
        success: false,
        profile_type: profileType,
        adjustments: [],
        current_macros: currentMacros,
        proposed_macros: currentMacros,
        target_macros: targetMacros,
        justification: 'Rebalanceamento automático bloqueado.',
        adherence_impact: 'Nenhum impacto.',
        warnings: ['Restrições clínicas detectadas. O rebalanceamento automático requer supervisão profissional.'],
        requires_approval: true,
        execution_blocked: true,
        block_reason: 'Condição clínica detectada nas restrições. Intervenção humana necessária.'
      }, corsHeaders);
    }

    // Get available foods for substitutions
    const { data: availableFoods } = await supabaseAdmin
      .from('foods')
      .select('id, name, calories, protein, carbs, fat, category, processing_level')
      .in('processing_level', ['in_natura', 'minimamente_processado']);

    // Generate rebalance suggestions
    const { adjustments, justification, adherence_impact, warnings: aiWarnings } = await generateAIRebalanceSuggestions(
      profileData,
      meals,
      currentMacros,
      targetMacros,
      adherence,
      permissions,
      availableFoods || [],
      profileType
    );
    
    warnings.push(...aiWarnings);

    // Calculate proposed macros after adjustments
    let proposedMacros = { ...currentMacros };
    for (const adj of adjustments) {
      if (adj.type === 'quantity_change' && adj.original_quantity && adj.new_quantity) {
        const meal = meals.find(m => m.id === adj.meal_id);
        const option = meal?.options.find(o => o.id === adj.option_id);
        const food = option?.foods.find(f => f.food_id === adj.food_id)?.food;
        
        if (food) {
          const quantityDiff = (adj.new_quantity - adj.original_quantity) / 100;
          proposedMacros.calories += food.calories * quantityDiff;
          proposedMacros.protein += food.protein * quantityDiff;
          proposedMacros.carbs += food.carbs * quantityDiff;
          proposedMacros.fat += food.fat * quantityDiff;
        }
      }
    }

    // Validate equivalence
    const equivalenceCheck = checkEquivalence(currentMacros, proposedMacros);
    if (!equivalenceCheck.isValid) {
      warnings.push(...equivalenceCheck.violations);
    }

    // Check if execution is allowed
    const canExecute = permissions.canExecute && execute && !permissions.requiresApproval;
    
    // Execute adjustments if allowed
    if (canExecute && adjustments.length > 0) {
      for (const adj of adjustments) {
        if (adj.type === 'quantity_change' && adj.new_quantity) {
          await supabaseAdmin
            .from('meal_option_foods')
            .update({ quantity_grams: adj.new_quantity })
            .eq('meal_option_id', adj.option_id)
            .eq('food_id', adj.food_id);
        }
      }

      // Recalculate option and meal totals
      for (const meal of meals) {
        for (const option of meal.options) {
          const { data: optionFoods } = await supabaseAdmin
            .from('meal_option_foods')
            .select('quantity_grams, foods(calories, protein, carbs, fat)')
            .eq('meal_option_id', option.id);

          if (optionFoods) {
            const totals = optionFoods.reduce((acc: any, mof: any) => {
              const ratio = mof.quantity_grams / 100;
              return {
                calories: acc.calories + (mof.foods.calories * ratio),
                protein: acc.protein + (mof.foods.protein * ratio),
                carbs: acc.carbs + (mof.foods.carbs * ratio),
                fat: acc.fat + (mof.foods.fat * ratio)
              };
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

            await supabaseAdmin
              .from('meal_options')
              .update({
                total_calories: totals.calories,
                total_protein: totals.protein,
                total_carbs: totals.carbs,
                total_fat: totals.fat
              })
              .eq('id', option.id);
          }
        }
      }

      // Increment adjustment usage counter for the target user
      const adjustmentTargetUserId = dietPlan?.user_id || user.id;
      await supabaseAdmin.rpc('increment_usage', { 
        _user_id: adjustmentTargetUserId, 
        _feature: 'adjustment' 
      });
    }

    const result: RebalanceResult = {
      success: true,
      profile_type: profileType,
      adjustments,
      current_macros: currentMacros,
      proposed_macros: proposedMacros,
      target_macros: targetMacros,
      justification,
      adherence_impact,
      warnings,
      requires_approval: permissions.requiresApproval,
      execution_blocked: !permissions.canExecute,
      block_reason: !permissions.canExecute 
        ? profileType === 'free' 
          ? 'Plano gratuito não permite ajustes automáticos.' 
          : 'Ajustes requerem aprovação do profissional.'
        : undefined
    };

    // Log AI usage
    await supabaseAdmin.from('ai_usage_logs').insert({
      user_id: user.id,
      function_name: 'rebalance-meal-plan',
      model: 'google/gemini-2.5-flash',
      success: true,
      metadata: { 
        profile_type: profileType, 
        adjustments_count: adjustments.length,
        executed: canExecute
      }
    });

    return createSuccessResponse(result, corsHeaders);

  } catch (error) {
    console.error('Rebalance error:', error);
    return createErrorResponse('Erro interno ao rebalancear plano', 500, getCorsHeaders(req));
  }
});

// deno-lint-ignore no-explicit-any
async function checkIsProfessional(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'professional')
    .single();
  
  return !!data;
}
