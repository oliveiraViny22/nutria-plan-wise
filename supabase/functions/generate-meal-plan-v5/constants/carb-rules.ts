// =====================================================
// CONTROLE DE CARBOIDRATOS GORDOS (v5.3)
// =====================================================

/**
 * Critérios para carboidratos limpos (preferidos para refeições).
 * Bloqueia: Granola (14g fat), Farofa Pronta (12g fat), etc.
 * Permite: Arroz (0.3g), Batata (0.1g), Pão Integral (2.5g)
 */
export const LEAN_CARB_RULES = {
  MAX_FAT_PER_100G: 5,           // g máximo de gordura para carbs
};

/** Carboidratos com alta gordura - bloquear como base */
export const HIGH_FAT_CARB_THRESHOLD = 5; // g gordura por 100g
