// =====================================================
// CONSTANTES DO GERADOR v5
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

export const MEAL_TYPES_MAP: Record<number, string[]> = {
  2: ["lunch", "dinner"],
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
  5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
  6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
};

// =====================================================
// LIMITES DE QUANTIDADE POR CATEGORIA
// =====================================================

export const CATEGORY_QUANTITY_LIMITS: Record<string, { min: number; max: number }> = {
  proteinas: { min: 80, max: 250 },
  carboidratos: { min: 80, max: 300 },
  leguminosas: { min: 60, max: 150 },
  vegetais: { min: 50, max: 200 },
  frutas: { min: 80, max: 200 },
  laticinios: { min: 50, max: 200 },
  gorduras: { min: 5, max: 20 },
  oleaginosas: { min: 10, max: 30 },
};

export const CATEGORY_SCALE_LIMITS: Record<string, { min: number; max: number }> = {
  proteinas: { min: 50, max: 350 },
  carboidratos: { min: 50, max: 400 },
  leguminosas: { min: 40, max: 250 },
  vegetais: { min: 30, max: 300 },
  frutas: { min: 50, max: 300 },
  laticinios: { min: 30, max: 250 },
  gorduras: { min: 5, max: 30 },
  oleaginosas: { min: 5, max: 40 },
};

export const DEFAULT_SCALE_LIMITS = { min: 20, max: 500 };

// =====================================================
// LISTAS DE EXCLUSÃO
// =====================================================

export const EXCLUDED_PURE_FATS = [
  "óleo", "azeite", "manteiga", "creme de leite", "tahine",
  "banha", "margarina", "gordura", "bacon", "toucinho"
];

export const HIGH_FAT_FOODS = [
  "castanha", "nozes", "amêndoa", "amendoim", "pistache", 
  "gergelim", "linhaça", "chia", "abacate", "coco"
];

// =====================================================
// MAPEAMENTO DE PAPÉIS
// =====================================================

export const ROLE_ALIASES: Record<string, string[]> = {
  proteina: ["proteina_principal", "proteina_leve"],
  proteina_principal: ["proteina", "proteina_leve"],
  proteina_leve: ["proteina", "proteina_principal"],
  carboidrato_base: ["carboidrato"],
  carboidrato: ["carboidrato_base"],
  laticinio: ["laticinios"],
  laticinios: ["laticinio"],
};
