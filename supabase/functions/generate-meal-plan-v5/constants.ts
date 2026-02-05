// =====================================================
// CONSTANTES CONSOLIDADAS DO GERADOR v5
// =====================================================
// Consolidado de constants/ para resolver timeout de bundle
// =====================================================

import {
  CATEGORY_LIMITS,
  SNACK_CATEGORY_LIMITS,
  SCALE_CATEGORY_LIMITS,
  DEFAULT_SCALE_LIMITS,
  DEFAULT_CATEGORY_LIMITS,
  getCategoryLimits,
  getScaleLimits,
  isQuantityValid,
  clampToLimits,
} from "../_shared/category-limits.ts";

// Re-export category limits
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
};

// =====================================================
// CONFIGURAÇÃO DE REFEIÇÕES
// =====================================================

export const MEAL_NAMES: Record<string, string> = {
  breakfast: "Café da Manhã",
  morning_snack: "Lanche da Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche da Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

export const MAIN_MEALS = ["breakfast", "lunch", "dinner"];
export const SNACK_MEALS = ["morning_snack", "afternoon_snack", "supper"];

export const ITEM_COUNTS: Record<string, { min: number; max: number }> = {
  breakfast: { min: 2, max: 4 },
  morning_snack: { min: 2, max: 3 },
  lunch: { min: 4, max: 6 },
  afternoon_snack: { min: 2, max: 3 },
  dinner: { min: 4, max: 6 },
  supper: { min: 2, max: 3 },
};

export const ITEM_COUNTS_LIGHT_DINNER: Record<string, { min: number; max: number }> = {
  breakfast: { min: 2, max: 4 },
  morning_snack: { min: 2, max: 3 },
  lunch: { min: 4, max: 6 },
  afternoon_snack: { min: 2, max: 3 },
  dinner: { min: 2, max: 3 },
  supper: { min: 3, max: 5 },
};

export const MEAL_TYPES_MAP: Record<number, string[]> = {
  2: ["lunch", "dinner"],
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
  5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
  6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
};

export const MEAL_TYPES_MAP_MORNING_SNACK: Record<number, string[]> = {
  4: ["breakfast", "morning_snack", "lunch", "dinner"],
};

export const MEAL_TYPES_MAP_SUPPER: Record<number, string[]> = {
  2: ["lunch", "supper"],
  3: ["breakfast", "lunch", "supper"],
  4: ["breakfast", "lunch", "afternoon_snack", "supper"],
  5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "supper"],
  6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
};

export const MEAL_TYPES_MAP_SUPPER_MORNING_SNACK: Record<number, string[]> = {
  4: ["breakfast", "morning_snack", "lunch", "supper"],
};

export function getMealTypesForProfile(
  mealsPerDay: number, 
  lastEveningMeal: 'dinner' | 'supper' = 'dinner',
  snackPreference: 'morning_snack' | 'afternoon_snack' = 'afternoon_snack'
): string[] {
  if (mealsPerDay === 6) {
    return MEAL_TYPES_MAP[6];
  }
  
  if (mealsPerDay === 4) {
    const usesMorningSnack = snackPreference === 'morning_snack';
    
    if (lastEveningMeal === 'supper') {
      return usesMorningSnack 
        ? MEAL_TYPES_MAP_SUPPER_MORNING_SNACK[4] 
        : MEAL_TYPES_MAP_SUPPER[4];
    }
    return usesMorningSnack 
      ? MEAL_TYPES_MAP_MORNING_SNACK[4] 
      : MEAL_TYPES_MAP[4];
  }
  
  if (lastEveningMeal === 'supper') {
    return MEAL_TYPES_MAP_SUPPER[mealsPerDay] || MEAL_TYPES_MAP_SUPPER[4];
  }
  
  return MEAL_TYPES_MAP[mealsPerDay] || MEAL_TYPES_MAP[4];
}

// =====================================================
// REGRAS DE PROTEÍNAS
// =====================================================

export const LEAN_PROTEIN_RULES = {
  MIN_PROTEIN_PER_100G: 15,
  MAX_FAT_PER_100G: 8,
  MAX_CALORIES_PER_100G: 220,
};

export const HIGH_FAT_PROTEIN_RULES = {
  FAT_PER_100G: 12,
  CALORIES_PER_100G: 250,
};

export const MAX_HIGH_FAT_PROTEIN_PORTION = 40;

// =====================================================
// REGRAS DE LATICÍNIOS
// =====================================================

export const LEAN_DAIRY_RULES = {
  MAX_FAT_PER_100G: 8,
  MAX_CALORIES_PER_100G: 150,
};

export const HIGH_FAT_DAIRY_THRESHOLD = 10;
export const MAX_HIGH_FAT_DAIRY_PORTION = 30;

// =====================================================
// REGRAS DE CARBOIDRATOS
// =====================================================

export const LEAN_CARB_RULES = {
  MAX_FAT_PER_100G: 5,
};

export const HIGH_FAT_CARB_THRESHOLD = 5;

// =====================================================
// REGRAS DE GORDURA (G-10)
// =====================================================

export const IMPLICIT_FAT_LIMITS = {
  PASS: 1.0,
  ALLOW: 1.2,
  HARD_FAIL: 1.2,
};

export const MAX_IMPLICIT_FAT_RATIO = IMPLICIT_FAT_LIMITS.ALLOW;
export const MAX_FAT_SHARE_PER_FOOD = 0.6;

// =====================================================
// REGRAS DE LANCHES
// =====================================================

export const BLOCKED_SNACK_PROTEINS = [
  "camarão", "atum", "salmão", "sardinha", "tilápia", "peixe",
  "bacalhau", "lagosta", "caranguejo", "lula", "polvo", "mexilhão", "ostra",
  "filé mignon", "alcatra", "picanha", "costela", "lombo", "coxão", "patinho cozido",
];

export const ALLOWED_SNACK_PROTEINS = [
  "iogurte", "cottage", "ricota", "queijo minas", "ovo", "clara",
  "peito de peru", "blanquet", "presunto de peru", "frango desfiado",
  "patinho moído", "sanduíche natural", "whey",
];

export const ALLOWED_SNACK_CARBS = [
  "pão integral", "pão de forma integral", "tapioca", "crepioca",
  "wrap integral", "torrada integral", "aveia", "mingau", "purê de batata",
];

const BLOCKED_POPCORN_VARIANTS = [
  "pipoca", "pipoca com água", "pipoca com manteiga",
  "pipoca com óleo", "pipoca doce", "pipoca de microondas",
];

export const BLOCKED_FOODS_BY_MEAL: Record<string, string[]> = {
  breakfast: [...BLOCKED_POPCORN_VARIANTS],
  lunch: ["mingau", "mingau de aveia", ...BLOCKED_POPCORN_VARIANTS],
  dinner: ["mingau", "mingau de aveia", "aveia em flocos", ...BLOCKED_POPCORN_VARIANTS],
  supper: [...BLOCKED_POPCORN_VARIANTS],
};

// =====================================================
// EXCLUSÕES
// =====================================================

export const EXCLUDED_PURE_FATS = [
  "óleo", "azeite", "manteiga", "creme de leite", "tahine",
  "banha", "margarina", "gordura", "bacon", "toucinho"
];

export const HIGH_FAT_FOODS = [
  "castanha", "nozes", "amêndoa", "amendoim", "pistache", 
  "gergelim", "linhaça", "chia", "abacate", "coco"
];

export const ROLE_ALIASES: Record<string, string[]> = {
  proteina: ["proteina_principal", "proteina_leve"],
  proteina_principal: ["proteina", "proteina_leve"],
  proteina_leve: ["proteina", "proteina_principal"],
  carboidrato_base: ["carboidrato"],
  carboidrato: ["carboidrato_base"],
  laticinio: ["laticinios"],
  laticinios: ["laticinio"],
};
