// =====================================================
// CONTROLE DE LATICÍNIOS GORDOS (v5.2)
// =====================================================

/**
 * Critérios para laticínios limpos (preferidos para refeições).
 * Calibrado com dados reais do banco (2026-02-03):
 * - Permite: Cottage (4.3g), Minas Frescal (1.4g), Iogurte Grego Light (0g), Ricota (10g)
 * - Bloqueia: Queijo Prato (28g), Mussarela (22g), Requeijão Cremoso (23g), Cream Cheese Light (12g)
 */
export const LEAN_DAIRY_RULES = {
  MAX_FAT_PER_100G: 8,           // g máximo de gordura (reduzido de 10 para bloquear Cream Cheese Light)
  MAX_CALORIES_PER_100G: 150,    // kcal máximo
};

/** Laticínios com alta gordura - limitar porções drasticamente */
export const HIGH_FAT_DAIRY_THRESHOLD = 10; // g gordura por 100g (reduzido de 15)

/** Porção máxima para laticínios gordos (queijos amarelos) */
export const MAX_HIGH_FAT_DAIRY_PORTION = 30; // g (1 fatia)
