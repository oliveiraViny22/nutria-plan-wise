// =====================================================
// CATEGORIAS CANÔNICAS DE ALIMENTOS - v2
// =====================================================
// ÚNICA FONTE DE VERDADE para categorias em todo o sistema
// Qualquer categoria fora desta lista é INVÁLIDA
// =====================================================

/**
 * Categorias canônicas oficiais do sistema.
 * NUNCA adicione categorias fora desta lista.
 */
export const CANONICAL_CATEGORIES = [
  // Categorias base
  'carboidratos',
  'proteinas',
  'gorduras',
  'vegetais',
  'frutas',
  'laticinios',
  'leguminosas',
  'suplementos',
  'mistos',
  // Categorias expandidas
  'peixes',
  'frutos_do_mar',
  'tuberculos',
  'cereais',
  'graos',
  'oleaginosas',
  'ovos',
  'cogumelos',
  'queijos',
  'sementes',
  'bebidas',
  'condimentos',
  'veganos',
  'receitas',
] as const;

export type FoodCategory = typeof CANONICAL_CATEGORIES[number];

/**
 * Labels legíveis para UI
 */
export const CATEGORY_LABELS: Record<FoodCategory, string> = {
  // Base
  carboidratos: 'Carboidratos',
  proteinas: 'Proteínas',
  gorduras: 'Gorduras',
  vegetais: 'Vegetais',
  frutas: 'Frutas',
  laticinios: 'Laticínios',
  leguminosas: 'Leguminosas',
  suplementos: 'Suplementos',
  mistos: 'Mistos',
  // Expandidas
  peixes: 'Peixes',
  frutos_do_mar: 'Frutos do Mar',
  tuberculos: 'Tubérculos',
  cereais: 'Cereais',
  graos: 'Grãos',
  oleaginosas: 'Oleaginosas',
  ovos: 'Ovos',
  cogumelos: 'Cogumelos',
  queijos: 'Queijos',
  sementes: 'Sementes',
  bebidas: 'Bebidas',
  condimentos: 'Condimentos',
  veganos: 'Veganos',
  receitas: 'Receitas',
};

/**
 * Cores por categoria para badges e charts
 */
export const CATEGORY_COLORS: Record<FoodCategory, string> = {
  // Base
  carboidratos: 'bg-amber-500',
  proteinas: 'bg-red-500',
  gorduras: 'bg-yellow-500',
  vegetais: 'bg-green-500',
  frutas: 'bg-orange-500',
  laticinios: 'bg-blue-400',
  leguminosas: 'bg-emerald-600',
  suplementos: 'bg-purple-500',
  mistos: 'bg-gray-500',
  // Expandidas
  peixes: 'bg-cyan-500',
  frutos_do_mar: 'bg-teal-500',
  tuberculos: 'bg-amber-600',
  cereais: 'bg-yellow-600',
  graos: 'bg-lime-600',
  oleaginosas: 'bg-amber-700',
  ovos: 'bg-orange-400',
  cogumelos: 'bg-stone-500',
  queijos: 'bg-sky-400',
  sementes: 'bg-lime-500',
  bebidas: 'bg-indigo-400',
  condimentos: 'bg-rose-400',
  veganos: 'bg-green-600',
  receitas: 'bg-violet-500',
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
  // Nomes em PT para generate-meal-plan-v2
  'Café da Manhã': ['carboidratos', 'frutas', 'laticinios', 'gorduras'],
  'Lanche da Manhã': ['frutas', 'gorduras', 'laticinios'],
  'Almoço': ['proteinas', 'carboidratos', 'leguminosas', 'vegetais'],
  'Lanche da Tarde': ['frutas', 'laticinios', 'gorduras'],
  'Jantar': ['proteinas', 'vegetais', 'carboidratos'],
  'Ceia': ['laticinios', 'frutas', 'gorduras'],
};

/**
 * Ordem de exibição de alimentos por categoria (para UI)
 * Carboidratos > Proteínas > Vegetais > Óleos > Frutas > Gorduras
 */
export const CATEGORY_DISPLAY_ORDER: FoodCategory[] = [
  'carboidratos',
  'tuberculos',
  'cereais',
  'graos',
  'proteinas',
  'peixes',
  'frutos_do_mar',
  'ovos',
  'leguminosas',
  'vegetais',
  'cogumelos',
  'laticinios',
  'queijos',
  'frutas',
  'gorduras',
  'oleaginosas',
  'sementes',
  'bebidas',
  'condimentos',
  'veganos',
  'receitas',
  'mistos',
  'suplementos',
];

/**
 * Retorna a ordem de exibição para uma categoria (menor = primeiro)
 */
export function getCategoryDisplayOrder(category: string | null | undefined): number {
  if (!category) return 999;
  const normalized = category.toLowerCase().trim();
  const index = CATEGORY_DISPLAY_ORDER.indexOf(normalized as FoodCategory);
  return index >= 0 ? index : 999;
}

/**
 * Categorias que NÃO devem entrar automaticamente nos planos
 */
export const EXCLUDED_FROM_AUTO_PLAN: FoodCategory[] = ['suplementos'];

/**
 * Categorias com impacto calórico baixo (flexíveis em quantidade)
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
 * Retorna o label de uma categoria ou fallback
 */
export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return '—';
  if (isValidCategory(category)) {
    return CATEGORY_LABELS[category];
  }
  // Fallback para categorias antigas (não deveria acontecer)
  return category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Retorna a cor de uma categoria
 */
export function getCategoryColor(category: string | null | undefined): string {
  if (!category || !isValidCategory(category)) {
    return 'bg-muted';
  }
  return CATEGORY_COLORS[category];
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
 * Níveis de processamento permitidos para substituições automáticas
 * Incluímos 'processado' pois alimentos como macarrão/pão são válidos para troca
 */
export const SUBSTITUTABLE_PROCESSING_LEVELS: ProcessingLevel[] = [
  'in_natura',
  'minimamente_processado',
  'processado',
];

export function isSubstitutableProcessingLevel(level: string | null | undefined): boolean {
  if (!level) return false;
  return SUBSTITUTABLE_PROCESSING_LEVELS.includes(level as ProcessingLevel);
}

export function getProcessingLabel(level: string | null | undefined): string {
  if (!level) return '—';
  const normalized = level.toLowerCase().replace(/ /g, '_');
  if (PROCESSING_LEVELS.includes(normalized as ProcessingLevel)) {
    return PROCESSING_LABELS[normalized as ProcessingLevel];
  }
  // Fallback para níveis com espaço
  const spacedLabels: Record<string, string> = {
    'in natura': 'In natura',
    'minimamente processado': 'Minimamente processado',
  };
  return spacedLabels[level.toLowerCase()] || level;
}
