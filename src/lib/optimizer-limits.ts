// =====================================================
// LIMITES DE QUANTIDADE POR CATEGORIA - FONTE ÚNICA
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
 */
export const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  // ==========================================
  // CARBOIDRATOS - porções energéticas
  // ==========================================
  'carboidrato': { min: 40, max: 300 },
  'carboidratos': { min: 40, max: 300 },
  'grãos': { min: 40, max: 250 },
  'cereais': { min: 30, max: 200 },
  'pães': { min: 25, max: 150 },
  'massas': { min: 60, max: 250 },
  'tubérculos': { min: 50, max: 300 },
  
  // ==========================================
  // PROTEÍNAS - fontes principais
  // ==========================================
  'proteína': { min: 60, max: 250 },
  'proteínas': { min: 60, max: 250 },
  'proteinas': { min: 60, max: 250 },
  'carnes': { min: 80, max: 250 },
  'aves': { min: 80, max: 250 },
  'peixes': { min: 80, max: 250 },
  'frutos do mar': { min: 60, max: 200 },
  'ovos': { min: 50, max: 200 },
  
  // ==========================================
  // LATICÍNIOS
  // ==========================================
  'laticínios': { min: 30, max: 300 },
  'laticinios': { min: 30, max: 300 },
  'queijos': { min: 20, max: 100 },
  'leite': { min: 100, max: 400 },
  'iogurtes': { min: 100, max: 300 },
  
  // ==========================================
  // VEGETAIS E FRUTAS
  // ==========================================
  'vegetais': { min: 30, max: 300 },
  'verduras': { min: 20, max: 200 },
  'legumes': { min: 40, max: 250 },
  'leguminosas': { min: 40, max: 200 },
  'frutas': { min: 30, max: 150 },  // Reduzido de 300 para 150
  'figo': { min: 20, max: 80 },      // Figo específico
  'saladas': { min: 30, max: 200 },
  
  // ==========================================
  // GORDURAS - porções controladas
  // ==========================================
  'gorduras': { min: 5, max: 30 },   // Reduzido de 50 para 30
  'óleos': { min: 5, max: 20 },      // Reduzido de 30 para 20
  'oleaginosas': { min: 10, max: 40 }, // Reduzido de 60 para 40
  'castanhas': { min: 10, max: 35 },   // Reduzido de 50 para 35
  'azeite': { min: 5, max: 20 },       // Azeite específico
  
  // ==========================================
  // OUTROS
  // ==========================================
  'suplementos': { min: 10, max: 100 },
  'bebidas': { min: 100, max: 500 },
  'condimentos': { min: 5, max: 30 },
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
