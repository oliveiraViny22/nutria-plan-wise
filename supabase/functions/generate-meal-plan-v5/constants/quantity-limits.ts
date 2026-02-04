// =====================================================
// LIMITES DE QUANTIDADE POR CATEGORIA
// Re-exporta da fonte centralizada _shared/category-limits.ts
// =====================================================

export {
  CATEGORY_LIMITS as CATEGORY_QUANTITY_LIMITS,
  SNACK_CATEGORY_LIMITS as SNACK_QUANTITY_LIMITS,
  SCALE_CATEGORY_LIMITS as CATEGORY_SCALE_LIMITS,
  DEFAULT_SCALE_LIMITS,
  DEFAULT_CATEGORY_LIMITS,
  getCategoryLimits,
  getScaleLimits,
  isQuantityValid,
  clampToLimits,
} from "../../_shared/category-limits.ts";
