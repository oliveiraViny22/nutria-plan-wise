// =====================================================
// CONVERSÃO DE UNIDADES
// =====================================================

import type { Food } from "./types.ts";

export interface UnitConversionResult {
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
}

/**
 * Aplica conversão de unidade para um alimento.
 * Se o alimento tem unidade habilitada e o erro está dentro de 5%, usa a unidade.
 * Caso contrário, mantém em gramas.
 */
export function applyUnitConversion(
  food: Food,
  grams: number
): UnitConversionResult {
  if (!food.unit_enabled || !food.unit_name || !food.unit_weight_grams) {
    return {
      display_quantity: Math.round(grams),
      display_unit: "g",
      calculated_grams: grams,
    };
  }

  const rawUnits = grams / food.unit_weight_grams;
  const increment = food.unit_increment || 1;
  let roundedUnits = Math.round(rawUnits / increment) * increment;
  if (roundedUnits < increment) roundedUnits = increment;

  const finalGrams = roundedUnits * food.unit_weight_grams;
  const errorPercent = grams > 0 ? (Math.abs(finalGrams - grams) / grams) * 100 : 0;

  // Tolerância de 15% para permitir conversões práticas em unidades naturais
  // Ex: 135g de pão francês → 3 unidades (150g) = 11% erro → aceitável
  if (errorPercent <= 15) {
    return {
      display_quantity: roundedUnits,
      display_unit: food.unit_name,
      calculated_grams: finalGrams,
    };
  }

  return {
    display_quantity: Math.round(grams),
    display_unit: "g",
    calculated_grams: grams,
  };
}
