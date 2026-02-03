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

/** Failsafe nutricional: nenhum alimento domina a gordura diária */
export const MAX_FAT_SHARE_PER_FOOD = 0.6; // 60% da gordura diária

/** Porção máxima para proteínas gordas (quando permitidas) */
export const MAX_HIGH_FAT_PROTEIN_PORTION = 40; // g

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

// =====================================================
// BLOQUEIOS POR TIPO DE REFEIÇÃO (v5.9)
// =====================================================

/**
 * Alimentos bloqueados para refeições específicas por adequação cultural.
 * Ex: Mingau de Aveia é mais adequado para ceia do que jantar.
 */
export const BLOCKED_FOODS_BY_MEAL: Record<string, string[]> = {
  dinner: [
    "mingau",
    "mingau de aveia",
    "aveia em flocos",  // Quando usado para mingau
  ],
  lunch: [
    "mingau",
    "mingau de aveia",
  ],
};
