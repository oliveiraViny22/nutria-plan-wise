// =====================================================
// CONSTANTES DO GERADOR v5 - BARREL EXPORT
// =====================================================
// Re-exporta todas as constantes para manter compatibilidade
// com imports existentes de "./constants.ts"
// =====================================================

// Configuração de refeições
export {
  MEAL_NAMES,
  MAIN_MEALS,
  SNACK_MEALS,
  ITEM_COUNTS,
  ITEM_COUNTS_LIGHT_DINNER,
  MEAL_TYPES_MAP,
} from "./meal-config.ts";

// Limites de quantidade
export {
  CATEGORY_QUANTITY_LIMITS,
  SNACK_QUANTITY_LIMITS,
  CATEGORY_SCALE_LIMITS,
  DEFAULT_SCALE_LIMITS,
} from "./quantity-limits.ts";

// Regras de proteínas
export {
  LEAN_PROTEIN_RULES,
  HIGH_FAT_PROTEIN_RULES,
  MAX_HIGH_FAT_PROTEIN_PORTION,
} from "./protein-rules.ts";

// Regras de laticínios
export {
  LEAN_DAIRY_RULES,
  HIGH_FAT_DAIRY_THRESHOLD,
  MAX_HIGH_FAT_DAIRY_PORTION,
} from "./dairy-rules.ts";

// Regras de carboidratos
export {
  LEAN_CARB_RULES,
  HIGH_FAT_CARB_THRESHOLD,
} from "./carb-rules.ts";

// Regras de gordura
export {
  IMPLICIT_FAT_LIMITS,
  MAX_IMPLICIT_FAT_RATIO,
  MAX_FAT_SHARE_PER_FOOD,
} from "./fat-rules.ts";

// Regras de lanches
export {
  BLOCKED_SNACK_PROTEINS,
  ALLOWED_SNACK_PROTEINS,
  ALLOWED_SNACK_CARBS,
  BLOCKED_FOODS_BY_MEAL,
} from "./snack-rules.ts";

// Exclusões e aliases
export {
  EXCLUDED_PURE_FATS,
  HIGH_FAT_FOODS,
  ROLE_ALIASES,
} from "./exclusions.ts";
