// =====================================================
// CATEGORIAS CANÔNICAS DE ALIMENTOS - EDGE FUNCTIONS
// =====================================================
// ÚNICA FONTE DE VERDADE para categorias em todo o backend
// Qualquer categoria fora desta lista é INVÁLIDA
// =====================================================

/**
 * Categorias canônicas oficiais do sistema.
 * NUNCA adicione categorias fora desta lista.
 */
export const CANONICAL_CATEGORIES = [
  'carboidratos',
  'proteinas',
  'gorduras',
  'vegetais',
  'frutas',
  'laticinios',
  'leguminosas',
  'suplementos',
  'mistos',
] as const;

export type FoodCategory = typeof CANONICAL_CATEGORIES[number];

/**
 * Labels legíveis para logs e mensagens
 */
export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  carboidratos: 'Carboidratos',
  proteinas: 'Proteínas',
  gorduras: 'Gorduras',
  vegetais: 'Vegetais',
  frutas: 'Frutas',
  laticinios: 'Laticínios',
  leguminosas: 'Leguminosas',
  suplementos: 'Suplementos',
  mistos: 'Mistos',
};

/**
 * Prioridades de categoria por tipo de refeição
 */
export const MEAL_CATEGORY_PRIORITIES: Record<string, FoodCategory[]> = {
  breakfast: ['carboidratos', 'frutas', 'laticinios', 'gorduras'],
  morning_snack: ['frutas', 'gorduras', 'laticinios'],
  lunch: ['proteinas', 'carboidratos', 'leguminosas', 'vegetais'],
  afternoon_snack: ['frutas', 'laticinios', 'gorduras'],
  dinner: ['proteinas', 'vegetais', 'carboidratos'],
  supper: ['laticinios', 'frutas', 'gorduras'],
  // Nomes em PT
  'Café da Manhã': ['carboidratos', 'frutas', 'laticinios', 'gorduras'],
  'Lanche da Manhã': ['frutas', 'gorduras', 'laticinios'],
  'Almoço': ['proteinas', 'carboidratos', 'leguminosas', 'vegetais'],
  'Lanche da Tarde': ['frutas', 'laticinios', 'gorduras'],
  'Jantar': ['proteinas', 'vegetais', 'carboidratos'],
  'Ceia': ['laticinios', 'frutas', 'gorduras'],
};

/**
 * Categorias que NÃO devem entrar automaticamente nos planos
 */
export const EXCLUDED_FROM_AUTO_PLAN: FoodCategory[] = ['suplementos'];

/**
 * Categorias com impacto calórico baixo
 */
export const LOW_CALORIC_IMPACT: FoodCategory[] = ['vegetais'];

/**
 * Valida se uma string é uma categoria válida
 */
export function isValidCategory(category: string | null | undefined): category is FoodCategory {
  if (!category) return false;
  return CANONICAL_CATEGORIES.includes(category as FoodCategory);
}

/**
 * Retorna o label de uma categoria
 */
export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  if (isValidCategory(category)) {
    return CATEGORY_LABELS[category];
  }
  return category;
}

// =====================================================
// NÍVEIS DE PROCESSAMENTO
// =====================================================

export const PROCESSING_LEVELS = [
  'in_natura',
  'minimamente_processado',
  'processado',
  'ultraprocessado',
  'suplemento',
] as const;

export type ProcessingLevel = typeof PROCESSING_LEVELS[number];

export const PROCESSING_LABELS: Record<ProcessingLevel, string> = {
  in_natura: 'In natura',
  minimamente_processado: 'Minimamente processado',
  processado: 'Processado',
  ultraprocessado: 'Ultraprocessado',
  suplemento: 'Suplemento',
};

/**
 * Níveis permitidos para substituições automáticas
 */
export const SUBSTITUTABLE_PROCESSING_LEVELS: ProcessingLevel[] = [
  'in_natura',
  'minimamente_processado',
];

export function isSubstitutableLevel(level: string | null | undefined): boolean {
  if (!level) return false;
  const normalized = level.toLowerCase().replace(/ /g, '_');
  return SUBSTITUTABLE_PROCESSING_LEVELS.includes(normalized as ProcessingLevel);
}

// =====================================================
// PROMPT DE IA PARA CATEGORIAS
// =====================================================

/**
 * Texto padrão para incluir em prompts de IA
 */
export const AI_CATEGORY_PROMPT = `
CATEGORIAS DE ALIMENTOS OBRIGATÓRIAS:
Você DEVE usar EXCLUSIVAMENTE estas categorias:
- carboidratos (arroz, pão, massas, tubérculos, cereais)
- proteinas (carnes, peixes, ovos, frango)
- gorduras (óleos, azeites, oleaginosas, castanhas)
- vegetais (folhas, verduras, legumes)
- frutas (frutas frescas e secas)
- laticinios (leite, queijos, iogurtes)
- leguminosas (feijões, lentilha, grão-de-bico, soja)
- suplementos (whey, creatina, vitaminas)
- mistos (preparações mistas, pratos prontos)

Qualquer outra categoria é INVÁLIDA e será rejeitada.
NÃO use: proteinas_animais, cereais_tuberculos, hortalicas_folhosas, oleos_oleaginosas, etc.
`.trim();
