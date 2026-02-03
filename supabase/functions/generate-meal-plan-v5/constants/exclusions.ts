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
