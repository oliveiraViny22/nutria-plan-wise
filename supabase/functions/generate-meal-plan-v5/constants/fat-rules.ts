// =====================================================
// REGRA G-10: LIMITE GLOBAL DE GORDURA IMPLÍCITA (PROGRESSIVO)
// =====================================================

/**
 * Limites progressivos para gordura implícita:
 * - PASS: ≤100% → plano OK, segue normalmente
 * - ALLOW_REBALANCE: 100%-120% → plano bom, envia ao rebalanceador com sinalização
 * - HARD_FAIL: >120% → plano estruturalmente ruim, regenerar
 */
export const IMPLICIT_FAT_LIMITS = {
  PASS: 1.0,          // até 100% da meta → OK
  ALLOW: 1.2,         // 100%-120% → rebalanceável
  HARD_FAIL: 1.2,     // acima de 120% → regenerar
};

// Mantido para compatibilidade com código legado
export const MAX_IMPLICIT_FAT_RATIO = IMPLICIT_FAT_LIMITS.ALLOW;

/** Failsafe nutricional: nenhum alimento domina a gordura diária */
export const MAX_FAT_SHARE_PER_FOOD = 0.6; // 60% da gordura diária
