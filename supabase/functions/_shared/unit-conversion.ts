/**
 * REGRA DE ARQUITETURA: Sistema de Conversão Determinística de Unidades
 * 
 * PRINCÍPIOS IMUTÁVEIS:
 * 1. Gramas são a ÚNICA fonte de verdade nutricional
 * 2. Unidades (ovo, fatia, etc.) são APENAS camada de apresentação
 * 3. Conversões são decisões ÚNICAS e PERSISTIDAS
 * 4. O backend REAPLICA decisões SEM IA
 * 5. O frontend NUNCA executa lógica nutricional
 * 
 * FLUXO:
 * - IA decide UMA VEZ na criação/substituição
 * - Sistema executa SEMPRE deterministicamente
 * - Exibição usa valores PERSISTIDOS
 */

export interface FoodUnitConfig {
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number;
  unit_enabled: boolean;
}

export interface ConversionResult {
  success: boolean;
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
  error_percent: number;
  fallback_to_grams: boolean;
}

export interface MealFoodDisplay {
  food_id: string;
  quantity: number; // gramas originais do cálculo
  display_quantity: number;
  display_unit: string;
  calculated_grams: number;
  unit_conversion_locked: boolean;
}

/**
 * Converte gramas para unidades de forma determinística.
 * Esta função NÃO usa IA - é puramente matemática.
 * 
 * @param grams - Quantidade em gramas (verdade nutricional)
 * @param unitWeightGrams - Peso de 1 unidade em gramas
 * @param unitIncrement - Incremento permitido (1, 0.5, etc.)
 * @param tolerancePercent - Tolerância máxima de erro (default: 5%)
 */
export function convertGramsToUnit(
  grams: number,
  unitWeightGrams: number | null,
  unitIncrement: number = 1,
  tolerancePercent: number = 5
): ConversionResult {
  // Validações de entrada
  if (!unitWeightGrams || unitWeightGrams <= 0) {
    return {
      success: false,
      display_quantity: grams,
      display_unit: 'g',
      calculated_grams: grams,
      error_percent: 0,
      fallback_to_grams: true,
    };
  }

  if (!unitIncrement || unitIncrement <= 0) {
    unitIncrement = 1;
  }

  // Calcular quantidade bruta de unidades
  const rawUnits = grams / unitWeightGrams;

  // Arredondar para o incremento mais próximo
  let roundedUnits = Math.round(rawUnits / unitIncrement) * unitIncrement;

  // Garantir mínimo de 1 incremento
  if (roundedUnits < unitIncrement) {
    roundedUnits = unitIncrement;
  }

  // Calcular gramas finais após arredondamento
  const finalGrams = roundedUnits * unitWeightGrams;

  // Calcular erro percentual
  const errorPercent = grams > 0 ? Math.abs(finalGrams - grams) / grams * 100 : 0;

  // Verificar tolerância
  if (errorPercent <= tolerancePercent) {
    return {
      success: true,
      display_quantity: roundedUnits,
      display_unit: '', // Será preenchido pelo chamador com unit_name
      calculated_grams: finalGrams,
      error_percent: errorPercent,
      fallback_to_grams: false,
    };
  } else {
    // Fallback para gramas quando erro excede tolerância
    return {
      success: false,
      display_quantity: grams,
      display_unit: 'g',
      calculated_grams: grams,
      error_percent: errorPercent,
      fallback_to_grams: true,
    };
  }
}

/**
 * Aplica conversão de unidade para um alimento específico.
 * Usa a configuração do alimento para determinar se deve converter.
 * 
 * @param quantityGrams - Quantidade calculada em gramas
 * @param food - Configuração de unidade do alimento
 */
export function applyUnitConversion(
  quantityGrams: number,
  food: FoodUnitConfig
): ConversionResult {
  // Se não tem unidade habilitada, retornar gramas
  if (!food.unit_enabled || !food.unit_name) {
    return {
      success: true,
      display_quantity: Math.round(quantityGrams * 10) / 10, // Arredondar para 1 casa decimal
      display_unit: 'g',
      calculated_grams: quantityGrams,
      error_percent: 0,
      fallback_to_grams: false,
    };
  }

  // Aplicar conversão determinística
  const result = convertGramsToUnit(
    quantityGrams,
    food.unit_weight_grams,
    food.unit_increment,
    5 // tolerância de 5%
  );

  // Preencher unit_name se conversão bem-sucedida
  if (result.success) {
    result.display_unit = food.unit_name;
  }

  return result;
}

/**
 * Processa lista de alimentos aplicando conversão determinística.
 * Usado na geração e exibição de planos.
 * 
 * @param foods - Lista de alimentos com quantidades em gramas
 * @param foodConfigs - Mapa de configurações de unidades por food_id
 */
export function processFoodsForDisplay(
  foods: Array<{ food_id: string; quantity: number }>,
  foodConfigs: Map<string, FoodUnitConfig>
): MealFoodDisplay[] {
  return foods.map(item => {
    const config = foodConfigs.get(item.food_id);
    
    if (!config) {
      // Sem configuração = exibir em gramas
      return {
        food_id: item.food_id,
        quantity: item.quantity,
        display_quantity: Math.round(item.quantity * 10) / 10,
        display_unit: 'g',
        calculated_grams: item.quantity,
        unit_conversion_locked: true, // Sem config = locked por padrão
      };
    }

    const result = applyUnitConversion(item.quantity, config);

    return {
      food_id: item.food_id,
      quantity: item.quantity,
      display_quantity: result.display_quantity,
      display_unit: result.display_unit,
      calculated_grams: result.calculated_grams,
      unit_conversion_locked: true, // Conversão aplicada = locked
    };
  });
}

/**
 * Formata quantidade para exibição humana.
 * Ex: "2 ovos", "150g", "1.5 fatias"
 */
export function formatQuantityForDisplay(
  displayQuantity: number,
  displayUnit: string
): string {
  if (displayUnit === 'g') {
    return `${Math.round(displayQuantity)}g`;
  }

  // Para unidades, usar plural quando necessário
  const qty = displayQuantity;
  const isPlural = qty !== 1;
  
  // Mapear plurais em português
  const pluralMap: Record<string, string> = {
    'unidade': 'unidades',
    'fatia': 'fatias',
    'colher': 'colheres',
    'xícara': 'xícaras',
    'copo': 'copos',
    'porção': 'porções',
  };

  const unit = isPlural && pluralMap[displayUnit] 
    ? pluralMap[displayUnit] 
    : displayUnit;

  // Formatar número (inteiro se possível, senão 1 casa decimal)
  const formattedQty = Number.isInteger(qty) ? qty : qty.toFixed(1);

  return `${formattedQty} ${unit}`;
}

/**
 * Recalcula macros baseado nos gramas finais (após arredondamento).
 * IMPORTANTE: Sempre usar calculated_grams, não quantity original.
 */
export function recalculateMacros(
  calculatedGrams: number,
  originalGrams: number,
  originalMacros: { calories: number; protein: number; carbs: number; fat: number }
): { calories: number; protein: number; carbs: number; fat: number } {
  if (originalGrams === 0) return originalMacros;
  
  const factor = calculatedGrams / originalGrams;
  
  return {
    calories: Math.round(originalMacros.calories * factor),
    protein: Math.round(originalMacros.protein * factor * 10) / 10,
    carbs: Math.round(originalMacros.carbs * factor * 10) / 10,
    fat: Math.round(originalMacros.fat * factor * 10) / 10,
  };
}
