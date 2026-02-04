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

// Mapa base de refeições por quantidade (usa 'dinner' e 'afternoon_snack' como padrão)
export const MEAL_TYPES_MAP: Record<number, string[]> = {
  2: ["lunch", "dinner"],
  3: ["breakfast", "lunch", "dinner"],
  4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
  5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
  6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
};

// Mapa para 4 refeições com lanche da MANHÃ em vez de tarde
export const MEAL_TYPES_MAP_MORNING_SNACK: Record<number, string[]> = {
  4: ["breakfast", "morning_snack", "lunch", "dinner"],
};

// Mapa alternativo para quando o usuário prefere ceia em vez de jantar (3-5 refeições)
export const MEAL_TYPES_MAP_SUPPER: Record<number, string[]> = {
  2: ["lunch", "supper"],
  3: ["breakfast", "lunch", "supper"],
  4: ["breakfast", "lunch", "afternoon_snack", "supper"],
  5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "supper"],
  6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"], // 6 refeições sempre tem ambos
};

// Mapa para 4 refeições com lanche da MANHÃ + ceia
export const MEAL_TYPES_MAP_SUPPER_MORNING_SNACK: Record<number, string[]> = {
  4: ["breakfast", "morning_snack", "lunch", "supper"],
};

/**
 * Retorna a lista de refeições baseada na quantidade e preferências do usuário
 * @param mealsPerDay Número de refeições por dia
 * @param lastEveningMeal Preferência de refeição noturna (jantar ou ceia) para 3-5 refeições
 * @param snackPreference Preferência de lanche (manhã ou tarde) para 4 refeições
 */
export function getMealTypesForProfile(
  mealsPerDay: number, 
  lastEveningMeal: 'dinner' | 'supper' = 'dinner',
  snackPreference: 'morning_snack' | 'afternoon_snack' = 'afternoon_snack'
): string[] {
  // Para 6 refeições, sempre inclui jantar e ceia
  if (mealsPerDay === 6) {
    return MEAL_TYPES_MAP[6];
  }
  
  // Para 4 refeições, aplica preferência de lanche (manhã ou tarde)
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
  
  // Para 2, 3 e 5 refeições, usa apenas a preferência de refeição noturna
  if (lastEveningMeal === 'supper') {
    return MEAL_TYPES_MAP_SUPPER[mealsPerDay] || MEAL_TYPES_MAP_SUPPER[4];
  }
  
  return MEAL_TYPES_MAP[mealsPerDay] || MEAL_TYPES_MAP[4];
}
