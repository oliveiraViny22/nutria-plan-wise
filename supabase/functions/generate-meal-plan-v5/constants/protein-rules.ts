// =====================================================
// CONTROLE DE PROTEÍNAS GORDAS (v5.1 → v5.4)
// =====================================================

/** 
 * Critérios para proteínas magras (elegíveis como base).
 * RECALIBRADO (2026-02-03): Para metas de 73g fat/dia, precisamos ser mais restritivos.
 * - 8g fat permite: Frango Grelhado (3.6g), Tilápia (2.6g), Patinho (7.3g), Carne Magra (5g)
 * - Bloqueia: Filé Mignon (8.8g), Coxa (11g), Lombo (11g), Salmão (13g)
 */
export const LEAN_PROTEIN_RULES = {
  MIN_PROTEIN_PER_100G: 15,      // g mínimo de proteína
  MAX_FAT_PER_100G: 8,           // g máximo de gordura (reduzido de 12 para 8)
  MAX_CALORIES_PER_100G: 220,    // kcal máximo (permite Patinho 219kcal)
};

/** Critérios para proteínas gordas (bloqueadas como base) */
export const HIGH_FAT_PROTEIN_RULES = {
  FAT_PER_100G: 12,              // g de gordura (reduzido de 20 para 12)
  CALORIES_PER_100G: 250,        // kcal (reduzido de 300)
};

/** Porção máxima para proteínas gordas (quando permitidas) */
export const MAX_HIGH_FAT_PROTEIN_PORTION = 40; // g
