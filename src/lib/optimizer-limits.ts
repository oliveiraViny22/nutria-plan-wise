// =====================================================
// LIMITES DE QUANTIDADE POR CATEGORIA - FALLBACK LOCAL
// =====================================================
// NOTA: Estes são valores de fallback. A fonte da verdade é:
// supabase/functions/_shared/category-limits.ts
// 
// Para limites sincronizados, use o hook useCategoryLimits().
// O hook busca do backend com cache de 1h e fallback para estes valores.
// =====================================================
// Utilizado por todos os motores de otimização:
// - useBruteForceOptimizer
// - useContractOptimizer
// - useHybridOptimizer
// - useComparisonOptimizer
// =====================================================

/**
 * Limites de quantidade em gramas por categoria de alimento.
 * Valores baseados em porções nutricionalmente realistas.
 * 
 * IMPORTANTE: Estes valores devem estar sincronizados com
 * supabase/functions/_shared/category-limits.ts
 */
export const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  // ==========================================
  // PROTEÍNAS - fontes principais
  // ==========================================
  proteinas: { min: 60, max: 250 },
  'proteína': { min: 60, max: 250 },
  'proteínas': { min: 60, max: 250 },
  carnes: { min: 80, max: 250 },
  aves: { min: 80, max: 250 },
  peixes: { min: 80, max: 250 },
  'frutos do mar': { min: 60, max: 200 },
  ovos: { min: 50, max: 200 },

  // ==========================================
  // CARBOIDRATOS - porções energéticas
  // ==========================================
  carboidratos: { min: 40, max: 300 },
  carboidrato: { min: 40, max: 300 },
  'grãos': { min: 40, max: 250 },
  cereais: { min: 30, max: 200 },
  'pães': { min: 25, max: 150 },
  massas: { min: 60, max: 250 },
  'tubérculos': { min: 50, max: 300 },

  // ==========================================
  // LEGUMINOSAS
  // ==========================================
  leguminosas: { min: 40, max: 200 },

  // ==========================================
  // VEGETAIS E FRUTAS
  // ==========================================
  vegetais: { min: 30, max: 300 },
  verduras: { min: 20, max: 200 },
  legumes: { min: 40, max: 250 },
  frutas: { min: 30, max: 150 },
  figo: { min: 20, max: 80 },
  saladas: { min: 30, max: 200 },

  // ==========================================
  // LATICÍNIOS
  // ==========================================
  laticinios: { min: 30, max: 300 },
  'laticínios': { min: 30, max: 300 },
  queijos: { min: 20, max: 100 },
  leite: { min: 100, max: 400 },
  iogurtes: { min: 100, max: 300 },

  // ==========================================
  // GORDURAS - porções controladas
  // ==========================================
  gorduras: { min: 5, max: 30 },
  'óleos': { min: 5, max: 20 },
  oleaginosas: { min: 10, max: 40 },
  castanhas: { min: 10, max: 35 },
  azeite: { min: 5, max: 20 },

  // ==========================================
  // OUTROS
  // ==========================================
  suplementos: { min: 10, max: 100 },
  bebidas: { min: 100, max: 500 },
  condimentos: { min: 5, max: 30 },
};

/**
 * Limites padrão para categorias não mapeadas
 */
export const DEFAULT_LIMITS = { min: 20, max: 400 };

/**
 * Obtém os limites de quantidade para uma categoria.
 * Tenta match exato, depois parcial, depois retorna default.
 */
export function getCategoryLimits(category: string): { min: number; max: number } {
  const normalized = category.toLowerCase().trim();
  
  // Match exato
  if (CATEGORY_LIMITS[normalized]) {
    return CATEGORY_LIMITS[normalized];
  }
  
  // Match parcial (ex: "proteína magra" -> "proteína")
  for (const [key, limits] of Object.entries(CATEGORY_LIMITS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return limits;
    }
  }
  
  return DEFAULT_LIMITS;
}

/**
 * Valida se uma quantidade está dentro dos limites da categoria.
 */
export function isQuantityValid(category: string, grams: number): boolean {
  const limits = getCategoryLimits(category);
  return grams >= limits.min && grams <= limits.max;
}

/**
 * Clamp uma quantidade aos limites da categoria.
 */
export function clampToLimits(category: string, grams: number): number {
  const limits = getCategoryLimits(category);
  return Math.max(limits.min, Math.min(limits.max, Math.round(grams)));
}
