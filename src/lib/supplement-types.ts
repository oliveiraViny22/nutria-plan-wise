// =============================================================
// TIPOS E CONSTANTES PARA SISTEMA DE SUPLEMENTAÇÃO INTELIGENTE
// =============================================================

/**
 * Categorias de suplementos por comportamento de dosagem
 */
export type SupplementDoseType = 'single_daily' | 'contextual' | 'meal_replacement';

/**
 * Suplementos que devem ser sugeridos APENAS UMA VEZ por dia
 * Vinculados a uma refeição específica (geralmente café da manhã ou almoço)
 */
export const SINGLE_DAILY_SUPPLEMENTS = [
  'creatina',
  'creatine',
  'multivitamínico',
  'multivitamin',
  'vitamina d',
  'vitamin d',
  'ômega-3',
  'omega-3',
  'fish oil',
  'óleo de peixe',
  'zinco',
  'zinc',
  'magnésio',
  'magnesium',
  'vitamina b12',
  'b12',
  'ferro',
  'iron',
] as const;

/**
 * Mapeamento de suplementos de dose única para refeição preferida
 */
export const SINGLE_DOSE_MEAL_PREFERENCE: Record<string, string[]> = {
  creatina: ['breakfast', 'lunch'], // Pós-treino ou manhã
  multivitamínico: ['breakfast'],
  'vitamina d': ['breakfast', 'lunch'], // Com gordura
  'ômega-3': ['lunch', 'dinner'], // Com refeição gordurosa
  zinco: ['dinner', 'supper'], // À noite
  magnésio: ['dinner', 'supper'], // À noite, relaxante
};

/**
 * Suplementos contextuais (vinculados a treino, não refeição)
 */
export const CONTEXTUAL_SUPPLEMENTS = [
  'pré-treino',
  'pre-workout',
  'bcaa',
  'cafeína',
  'caffeine',
  'beta-alanina',
  'citrulina',
  'glutamina',
] as const;

/**
 * Suplementos que podem substituir refeições (modo substituição)
 * ESTES TÊM IMPACTO CALÓRICO e devem ser tratados como alimentos
 */
export const MEAL_REPLACEMENT_SUPPLEMENTS = [
  'whey protein',
  'whey',
  'proteína whey',
  'hipercalórico',
  'mass gainer',
  'caseína',
  'casein',
  'albumina',
  'proteína vegetal',
  'plant protein',
  'blend proteico',
  'protein blend',
] as const;

/**
 * Determina o tipo de dose de um suplemento
 */
export function getSupplementDoseType(name: string): SupplementDoseType {
  const normalized = name.toLowerCase().trim();
  
  if (SINGLE_DAILY_SUPPLEMENTS.some(s => normalized.includes(s))) {
    return 'single_daily';
  }
  
  if (CONTEXTUAL_SUPPLEMENTS.some(s => normalized.includes(s))) {
    return 'contextual';
  }
  
  if (MEAL_REPLACEMENT_SUPPLEMENTS.some(s => normalized.includes(s))) {
    return 'meal_replacement';
  }
  
  return 'contextual'; // Default
}

/**
 * Verifica se um suplemento deve ser sugerido para uma refeição específica
 */
export function shouldSuggestForMeal(
  supplementName: string,
  mealType: string,
  alreadySuggestedToday: string[] = []
): boolean {
  const normalized = supplementName.toLowerCase().trim();
  const doseType = getSupplementDoseType(normalized);
  
  // Suplementos de dose única: verificar se já foi sugerido hoje
  if (doseType === 'single_daily') {
    if (alreadySuggestedToday.some(s => s.toLowerCase().includes(normalized) || normalized.includes(s.toLowerCase()))) {
      return false;
    }
    
    // Verificar se é a refeição preferida para este suplemento
    for (const [suppKey, preferredMeals] of Object.entries(SINGLE_DOSE_MEAL_PREFERENCE)) {
      if (normalized.includes(suppKey)) {
        return preferredMeals.includes(mealType);
      }
    }
    
    // Se não há preferência, sugerir no café da manhã
    return mealType === 'breakfast';
  }
  
  // Suplementos contextuais: não sugerir em refeições (são para treino)
  if (doseType === 'contextual') {
    return false;
  }
  
  // Suplementos de substituição: sempre disponíveis como opção
  return true;
}

/**
 * Contexto de sugestão de suplemento
 */
export interface SupplementContext {
  mode: 'complement' | 'replacement';
  mealType: string;
  goal: string;
  dailyCalories?: number;
  proteinTarget?: number;
  mealSkipped?: boolean;
  alreadySuggestedToday?: string[];
}

/**
 * Suplemento sugerido
 */
export interface SuggestedSupplement {
  name: string;
  dosage: string;
  timing: string;
  benefit: string;
  priority: 'essential' | 'recommended' | 'optional';
  doseType: SupplementDoseType;
  hasMacros: boolean; // Se true, tem impacto calórico
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

/**
 * Resposta de sugestão de suplementação
 */
export interface SupplementSuggestion {
  mode: 'complement' | 'replacement';
  mealType: string;
  supplements: SuggestedSupplement[];
  reasoning: string;
  totalMacros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}
