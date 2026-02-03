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

// =====================================================
// CONFIGURAÇÃO POR PREFERÊNCIA DE REFEIÇÃO NOTURNA
// =====================================================

/**
 * Ajusta contagem de itens baseado na preferência de refeição noturna:
 * - full_dinner: jantar completo (4-6 itens), ceia leve (2-3 itens) - PADRÃO
 * - light_dinner: jantar leve (2-3 itens), ceia substancial (3-5 itens)
 */
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
  dinner: { min: 2, max: 3 },  // Jantar leve
  supper: { min: 3, max: 5 },  // Ceia substancial
};

export const MEAL_TYPES_MAP: Record<number, string[]> = {
  2: ["lunch", "dinner"],
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
  5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
  6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
};
