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

// =====================================================
// LIMITES ESPECÍFICOS PARA LANCHES (v5.8)
// =====================================================

export const SNACK_QUANTITY_LIMITS: Record<string, { min: number; max: number }> = {
  frutas: { min: 80, max: 150 },       // Reduzido de 200 para 150
  proteinas: { min: 60, max: 150 },    // Aumentado para permitir frango/patinho moído
  laticinios: { min: 100, max: 200 },
  gorduras: { min: 5, max: 15 },
  oleaginosas: { min: 10, max: 25 },
  carboidratos: { min: 80, max: 150 }, // (v5.8) Purê de batata para lanches
};

// =====================================================
// LIMITES DE ESCALA POR CATEGORIA
// =====================================================

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
