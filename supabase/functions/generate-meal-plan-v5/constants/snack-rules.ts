// =====================================================
// ALIMENTOS BLOQUEADOS PARA LANCHES (v5.8)
// =====================================================

/** 
 * Proteínas que NÃO são adequadas para lanches.
 * Frutos do mar, carnes que requerem preparo elaborado.
 */
export const BLOCKED_SNACK_PROTEINS = [
  "camarão",
  "atum",
  "salmão",
  "sardinha",
  "tilápia",
  "peixe",
  "bacalhau",
  "lagosta",
  "caranguejo",
  "lula",
  "polvo",
  "mexilhão",
  "ostra",
  "filé mignon",
  "alcatra",
  "picanha",
  "costela",
  "lombo",
  // "patinho" removido - Patinho Moído é prático para lanches
  "coxão",
  "patinho cozido",  // Bloqueia patinho cozido inteiro, mas permite moído
];

/**
 * Proteínas PERMITIDAS para lanches - práticas e fáceis de consumir.
 */
export const ALLOWED_SNACK_PROTEINS = [
  "iogurte",
  "cottage",
  "ricota",
  "queijo minas",
  "ovo",
  "clara",
  "peito de peru",
  "blanquet",
  "presunto de peru",
  "frango desfiado",
  "patinho moído",          // (v5.8) Carne moída prática para lanches com purê
  "sanduíche natural",      // (v5.8) Opção completa de lanche
  "whey",
];

/**
 * Carboidratos PERMITIDOS para lanches - práticos e versáteis (v5.8)
 */
export const ALLOWED_SNACK_CARBS = [
  "pão integral",
  "pão de forma integral",
  "tapioca",
  "crepioca",
  "wrap integral",
  "torrada integral",
  "aveia",
  "mingau",
  "purê de batata",
];

// =====================================================
// BLOQUEIOS POR TIPO DE REFEIÇÃO (v5.9)
// =====================================================

/**
 * Alimentos bloqueados para refeições específicas por adequação cultural.
 * Ex: Mingau de Aveia é mais adequado para ceia do que jantar.
 */
export const BLOCKED_FOODS_BY_MEAL: Record<string, string[]> = {
  breakfast: [
    "pipoca",           // Mais adequada como lanche
  ],
  dinner: [
    "mingau",
    "mingau de aveia",
    "aveia em flocos",  // Quando usado para mingau
    "pipoca",           // Mais adequada como lanche
  ],
  lunch: [
    "mingau",
    "mingau de aveia",
    "pipoca",           // Mais adequada como lanche
  ],
};
