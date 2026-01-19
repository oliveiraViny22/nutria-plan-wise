/**
 * Utilitários para exibição de quantidades com unidades
 * 
 * REGRA: O frontend NUNCA executa lógica nutricional
 * Apenas formata dados já calculados pelo backend
 * 
 * Atualizado para banco v2: usa quantity_grams e unit_locked
 */

import type { MealFood, MealOptionFood } from './types';

/**
 * Mapeia plurais para unidades em português
 */
const PLURAL_MAP: Record<string, string> = {
  'unidade': 'unidades',
  'fatia': 'fatias',
  'colher': 'colheres',
  'xícara': 'xícaras',
  'copo': 'copos',
  'porção': 'porções',
  'ovo': 'ovos',
  'pedaço': 'pedaços',
  'folha': 'folhas',
};

/**
 * Formata quantidade para exibição humana.
 * Usa dados persistidos pelo backend (display_quantity, display_unit).
 * 
 * @example
 * formatQuantityDisplay(2, 'unidade') // "2 unidades"
 * formatQuantityDisplay(150, 'g') // "150g"
 * formatQuantityDisplay(1.5, 'fatia') // "1.5 fatias"
 */
export function formatQuantityDisplay(
  displayQuantity: number,
  displayUnit: string
): string {
  if (displayUnit === 'g') {
    return `${Math.round(displayQuantity)}g`;
  }

  const qty = displayQuantity;
  const isPlural = qty !== 1;
  
  const unit = isPlural && PLURAL_MAP[displayUnit] 
    ? PLURAL_MAP[displayUnit] 
    : displayUnit;

  // Formatar número (inteiro se possível, senão 1 casa decimal)
  const formattedQty = Number.isInteger(qty) ? qty : qty.toFixed(1);

  return `${formattedQty} ${unit}`;
}

/**
 * Obtém a quantidade formatada de um item de refeição.
 * Prioriza display_quantity/display_unit se disponíveis.
 * Fallback para quantity_grams + 'g' se não houver conversão.
 * 
 * Atualizado para suportar tanto quantity_grams (v2) quanto quantity (legacy)
 */
export function getMealFoodDisplay(item: MealFood | MealOptionFood): string {
  if (item.display_quantity != null && item.display_unit) {
    return formatQuantityDisplay(item.display_quantity, item.display_unit);
  }
  
  // Fallback: exibir em gramas (suporta ambos os schemas)
  const grams = 'quantity_grams' in item ? item.quantity_grams : item.quantity;
  return `${Math.round(grams)}g`;
}

/**
 * Obtém os gramas reais para cálculos (se necessário no frontend).
 * IMPORTANTE: Preferir calculated_grams sobre quantity_grams.
 * 
 * Atualizado para suportar tanto quantity_grams (v2) quanto quantity (legacy)
 */
export function getActualGrams(item: MealFood | MealOptionFood): number {
  if (item.calculated_grams != null) {
    return item.calculated_grams;
  }
  return 'quantity_grams' in item ? item.quantity_grams : item.quantity;
}

/**
 * Verifica se um item teve conversão de unidade aplicada.
 */
export function hasUnitConversion(item: MealFood | MealOptionFood): boolean {
  return item.display_unit != null && item.display_unit !== 'g';
}

/**
 * Verifica se a conversão está bloqueada (não pode ser reavaliada).
 * Atualizado para v2: usa unit_locked em vez de unit_conversion_locked
 */
export function isConversionLocked(item: MealFood | MealOptionFood): boolean {
  return item.unit_locked ?? false;
}
