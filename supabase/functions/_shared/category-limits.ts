// =====================================================
// LIMITES DE QUANTIDADE POR CATEGORIA - FONTE ÚNICA
// =====================================================
// Utilizado por:
// - generate-meal-plan-v5 (gerador)
// - ai-rebalance (rebalanceador)
// - Frontend (optimizer-limits.ts - re-exporta)
// =====================================================

/**
 * Limites de quantidade em gramas por categoria de alimento.
 * Valores baseados em porções nutricionalmente realistas.
 */
export const CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  // ==========================================
  // PROTEÍNAS - fontes principais
  // ==========================================
  proteinas: { min: 60, max: 250 },
  carnes: { min: 80, max: 250 },
  aves: { min: 80, max: 250 },
  peixes: { min: 80, max: 250 },
  'frutos do mar': { min: 60, max: 200 },
  ovos: { min: 50, max: 200 },

  // ==========================================
  // CARBOIDRATOS - porções energéticas (expandido para bulk)
  // ==========================================
  carboidratos: { min: 40, max: 400 },      // +100g para bulk de alta caloria
  'grãos': { min: 40, max: 350 },           // arroz, quinoa - +100g
  cereais: { min: 30, max: 300 },           // aveia, granola - +100g
  'pães': { min: 25, max: 200 },            // +50g
  massas: { min: 60, max: 350 },            // macarrão integral - +100g
  'tubérculos': { min: 50, max: 400 },      // batata-doce, mandioca - +100g

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
export const DEFAULT_CATEGORY_LIMITS = { min: 20, max: 400 };

/**
 * Limites específicos para lanches (porções menores)
 */
export const SNACK_CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  frutas: { min: 80, max: 150 },
  proteinas: { min: 60, max: 150 },
  laticinios: { min: 100, max: 200 },
  gorduras: { min: 5, max: 15 },
  oleaginosas: { min: 10, max: 25 },
  carboidratos: { min: 80, max: 150 },
};

/**
 * Limites de escala (para ajustes proporcionais)
 */
export const SCALE_CATEGORY_LIMITS: Record<string, { min: number; max: number }> = {
  proteinas: { min: 50, max: 350 },
  carboidratos: { min: 50, max: 500 },      // +100g para convergência bulk
  'grãos': { min: 50, max: 450 },           // arroz, quinoa
  cereais: { min: 30, max: 400 },           // aveia
  'tubérculos': { min: 50, max: 500 },      // batata-doce, mandioca
  massas: { min: 60, max: 450 },            // macarrão
  leguminosas: { min: 40, max: 300 },       // feijão - +50g
  vegetais: { min: 30, max: 300 },
  frutas: { min: 50, max: 300 },
  laticinios: { min: 30, max: 250 },
  gorduras: { min: 5, max: 30 },
  oleaginosas: { min: 5, max: 40 },
};

export const DEFAULT_SCALE_LIMITS = { min: 20, max: 500 };

/**
 * Obtém os limites de quantidade para uma categoria.
 * Tenta match exato, depois parcial, depois retorna default.
 */
export function getCategoryLimits(
  category: string | null | undefined,
  isSnack = false
): { min: number; max: number } {
  if (!category) return DEFAULT_CATEGORY_LIMITS;

  const normalized = category.toLowerCase().trim();

  // Se é lanche, priorizar limites de lanche
  if (isSnack && SNACK_CATEGORY_LIMITS[normalized]) {
    return SNACK_CATEGORY_LIMITS[normalized];
  }

  // Match exato
  if (CATEGORY_LIMITS[normalized]) {
    return CATEGORY_LIMITS[normalized];
  }

  // Match parcial (ex: "proteína magra" -> "proteina")
  for (const [key, limits] of Object.entries(CATEGORY_LIMITS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return limits;
    }
  }

  return DEFAULT_CATEGORY_LIMITS;
}

/**
 * Obtém os limites de escala para uma categoria.
 */
export function getScaleLimits(category: string | null | undefined): { min: number; max: number } {
  if (!category) return DEFAULT_SCALE_LIMITS;

  const normalized = category.toLowerCase().trim();

  if (SCALE_CATEGORY_LIMITS[normalized]) {
    return SCALE_CATEGORY_LIMITS[normalized];
  }

  return DEFAULT_SCALE_LIMITS;
}

/**
 * Valida se uma quantidade está dentro dos limites da categoria.
 */
export function isQuantityValid(
  category: string | null | undefined,
  grams: number,
  isSnack = false
): boolean {
  const limits = getCategoryLimits(category, isSnack);
  return grams >= limits.min && grams <= limits.max;
}

/**
 * Clamp uma quantidade aos limites da categoria.
 */
export function clampToLimits(
  category: string | null | undefined,
  grams: number,
  isSnack = false
): number {
  const limits = getCategoryLimits(category, isSnack);
  return Math.max(limits.min, Math.min(limits.max, Math.round(grams)));
}
