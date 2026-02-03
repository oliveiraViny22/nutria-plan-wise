/**
 * Sistema de Cálculo de Substituição de Refeições
 * 
 * Combina suplementos + alimentos para igualar os macros de uma refeição
 * que o usuário não consegue consumir.
 */

export interface MacroTarget {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ReplacementItem {
  name: string;
  quantity: string;
  macros: MacroTarget;
  type: 'supplement' | 'food';
  notes?: string;
}

export interface MealReplacement {
  originalMealMacros: MacroTarget;
  items: ReplacementItem[];
  totalMacros: MacroTarget;
  accuracy: {
    calories: number; // % do original
    protein: number;
    carbs: number;
    fat: number;
  };
  tips: string[];
}

/**
 * Catálogo de suplementos com macros por porção
 */
const SUPPLEMENT_CATALOG: Record<string, { portion: string; macros: MacroTarget; notes: string }> = {
  'Whey Protein Isolado': {
    portion: '30g (1 scoop)',
    macros: { calories: 120, protein: 25, carbs: 2, fat: 1 },
    notes: 'Alta absorção, ideal pós-treino',
  },
  'Whey Protein Concentrado': {
    portion: '30g (1 scoop)',
    macros: { calories: 130, protein: 24, carbs: 4, fat: 2 },
    notes: 'Custo-benefício, versatil',
  },
  'Caseína': {
    portion: '30g (1 scoop)',
    macros: { calories: 110, protein: 24, carbs: 3, fat: 0.5 },
    notes: 'Liberação lenta (6-8h), ideal antes de dormir',
  },
  'Hipercalórico': {
    portion: '100g (2 scoops)',
    macros: { calories: 400, protein: 20, carbs: 70, fat: 6 },
    notes: 'Rico em carboidratos, ideal para ganho de massa',
  },
  'Albumina': {
    portion: '40g (2 scoops)',
    macros: { calories: 140, protein: 32, carbs: 2, fat: 0.5 },
    notes: 'Proteína de ovo, absorção média',
  },
  'Maltodextrina': {
    portion: '30g',
    macros: { calories: 120, protein: 0, carbs: 30, fat: 0 },
    notes: 'Carboidrato de rápida absorção',
  },
  'Dextrose': {
    portion: '30g',
    macros: { calories: 120, protein: 0, carbs: 30, fat: 0 },
    notes: 'Recuperação glicogênica imediata',
  },
  'Creatina': {
    portion: '5g',
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    notes: 'Não substitui macros, apenas complementa',
  },
};

/**
 * Catálogo de alimentos complementares com macros
 */
const FOOD_CATALOG: Record<string, { portion: string; macros: MacroTarget; notes: string }> = {
  'Pasta de Amendoim Integral': {
    portion: '30g (2 colheres)',
    macros: { calories: 180, protein: 8, carbs: 6, fat: 14 },
    notes: 'Gordura saudável + proteína vegetal',
  },
  'Banana': {
    portion: '1 unidade (100g)',
    macros: { calories: 90, protein: 1, carbs: 23, fat: 0 },
    notes: 'Carboidrato de rápida absorção + potássio',
  },
  'Aveia em Flocos': {
    portion: '40g (4 colheres)',
    macros: { calories: 150, protein: 5, carbs: 27, fat: 3 },
    notes: 'Fibras + carboidrato complexo',
  },
  'Iogurte Grego Natural': {
    portion: '170g (1 pote)',
    macros: { calories: 150, protein: 15, carbs: 8, fat: 6 },
    notes: 'Alto teor proteico + probióticos',
  },
  'Leite Desnatado': {
    portion: '200ml',
    macros: { calories: 70, protein: 7, carbs: 10, fat: 0 },
    notes: 'Base líquida para shakes',
  },
  'Leite Integral': {
    portion: '200ml',
    macros: { calories: 120, protein: 6, carbs: 9, fat: 6 },
    notes: 'Mais calórico, ideal para bulking',
  },
  'Castanha de Caju': {
    portion: '30g (10 unidades)',
    macros: { calories: 170, protein: 5, carbs: 9, fat: 13 },
    notes: 'Gordura saudável + minerais',
  },
  'Mel': {
    portion: '20g (1 colher)',
    macros: { calories: 60, protein: 0, carbs: 17, fat: 0 },
    notes: 'Carboidrato simples natural',
  },
  'Ovo Cozido': {
    portion: '1 unidade (50g)',
    macros: { calories: 75, protein: 6, carbs: 0.5, fat: 5 },
    notes: 'Proteína completa + gordura',
  },
  'Queijo Cottage': {
    portion: '100g',
    macros: { calories: 100, protein: 12, carbs: 3, fat: 4 },
    notes: 'Alto teor proteico + cálcio',
  },
  'Pão Integral': {
    portion: '2 fatias (50g)',
    macros: { calories: 130, protein: 5, carbs: 24, fat: 2 },
    notes: 'Carboidrato complexo + fibras',
  },
  'Abacate': {
    portion: '100g (1/2 unidade)',
    macros: { calories: 160, protein: 2, carbs: 8, fat: 15 },
    notes: 'Gordura monoinsaturada',
  },
};

/**
 * Calcula a combinação ideal de suplementos + alimentos para substituir uma refeição
 */
export function calculateMealReplacement(
  targetMacros: MacroTarget,
  userGoal: 'lose_weight' | 'maintain' | 'gain_muscle'
): MealReplacement {
  const items: ReplacementItem[] = [];
  let remaining = { ...targetMacros };
  
  // Prioridade baseada no objetivo
  const proteinFirst = userGoal === 'lose_weight' || userGoal === 'gain_muscle';
  
  // 1. PROTEÍNA: Usar Whey como base
  if (remaining.protein >= 20) {
    const wheyType = userGoal === 'lose_weight' ? 'Whey Protein Isolado' : 'Whey Protein Concentrado';
    const whey = SUPPLEMENT_CATALOG[wheyType];
    const scoops = Math.min(2, Math.ceil(remaining.protein / whey.macros.protein));
    
    items.push({
      name: wheyType,
      quantity: scoops === 1 ? '30g (1 scoop)' : `${scoops * 30}g (${scoops} scoops)`,
      macros: {
        calories: whey.macros.calories * scoops,
        protein: whey.macros.protein * scoops,
        carbs: whey.macros.carbs * scoops,
        fat: whey.macros.fat * scoops,
      },
      type: 'supplement',
      notes: whey.notes,
    });
    
    remaining.protein -= whey.macros.protein * scoops;
    remaining.calories -= whey.macros.calories * scoops;
    remaining.carbs -= whey.macros.carbs * scoops;
    remaining.fat -= whey.macros.fat * scoops;
  }

  // 2. CARBOIDRATOS: Adicionar fonte de carboidrato
  if (remaining.carbs >= 15) {
    // Para bulking: hipercalórico ou maltodextrina
    if (userGoal === 'gain_muscle' && remaining.calories >= 200) {
      const hiper = SUPPLEMENT_CATALOG['Hipercalórico'];
      items.push({
        name: 'Hipercalórico',
        quantity: hiper.portion,
        macros: { ...hiper.macros },
        type: 'supplement',
        notes: hiper.notes,
      });
      remaining.protein -= hiper.macros.protein;
      remaining.calories -= hiper.macros.calories;
      remaining.carbs -= hiper.macros.carbs;
      remaining.fat -= hiper.macros.fat;
    } else {
      // Aveia + Banana para carboidratos saudáveis
      if (remaining.carbs >= 25) {
        const aveia = FOOD_CATALOG['Aveia em Flocos'];
        items.push({
          name: 'Aveia em Flocos',
          quantity: aveia.portion,
          macros: { ...aveia.macros },
          type: 'food',
          notes: aveia.notes,
        });
        remaining.protein -= aveia.macros.protein;
        remaining.calories -= aveia.macros.calories;
        remaining.carbs -= aveia.macros.carbs;
        remaining.fat -= aveia.macros.fat;
      }
      
      if (remaining.carbs >= 15) {
        const banana = FOOD_CATALOG['Banana'];
        items.push({
          name: 'Banana',
          quantity: banana.portion,
          macros: { ...banana.macros },
          type: 'food',
          notes: banana.notes,
        });
        remaining.protein -= banana.macros.protein;
        remaining.calories -= banana.macros.calories;
        remaining.carbs -= banana.macros.carbs;
        remaining.fat -= banana.macros.fat;
      }
    }
  }

  // 3. GORDURA: Adicionar gordura saudável se necessário
  if (remaining.fat >= 8) {
    const pastaAmendoim = FOOD_CATALOG['Pasta de Amendoim Integral'];
    items.push({
      name: 'Pasta de Amendoim Integral',
      quantity: pastaAmendoim.portion,
      macros: { ...pastaAmendoim.macros },
      type: 'food',
      notes: pastaAmendoim.notes,
    });
    remaining.protein -= pastaAmendoim.macros.protein;
    remaining.calories -= pastaAmendoim.macros.calories;
    remaining.carbs -= pastaAmendoim.macros.carbs;
    remaining.fat -= pastaAmendoim.macros.fat;
  }

  // 4. PROTEÍNA ADICIONAL: Se ainda precisar de proteína
  if (remaining.protein >= 10) {
    const iogurte = FOOD_CATALOG['Iogurte Grego Natural'];
    items.push({
      name: 'Iogurte Grego Natural',
      quantity: iogurte.portion,
      macros: { ...iogurte.macros },
      type: 'food',
      notes: iogurte.notes,
    });
    remaining.protein -= iogurte.macros.protein;
    remaining.calories -= iogurte.macros.calories;
    remaining.carbs -= iogurte.macros.carbs;
    remaining.fat -= iogurte.macros.fat;
  }

  // 5. LÍQUIDO: Base para shake
  if (items.some(i => i.type === 'supplement')) {
    const leite = userGoal === 'lose_weight' ? FOOD_CATALOG['Leite Desnatado'] : FOOD_CATALOG['Leite Integral'];
    const leiteName = userGoal === 'lose_weight' ? 'Leite Desnatado' : 'Leite Integral';
    items.push({
      name: leiteName,
      quantity: leite.portion,
      macros: { ...leite.macros },
      type: 'food',
      notes: leite.notes,
    });
    remaining.calories -= leite.macros.calories;
    remaining.protein -= leite.macros.protein;
    remaining.carbs -= leite.macros.carbs;
    remaining.fat -= leite.macros.fat;
  }

  // Calcular totais
  const totalMacros = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.macros.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Calcular precisão
  const accuracy = {
    calories: targetMacros.calories > 0 ? Math.round((totalMacros.calories / targetMacros.calories) * 100) : 100,
    protein: targetMacros.protein > 0 ? Math.round((totalMacros.protein / targetMacros.protein) * 100) : 100,
    carbs: targetMacros.carbs > 0 ? Math.round((totalMacros.carbs / targetMacros.carbs) * 100) : 100,
    fat: targetMacros.fat > 0 ? Math.round((totalMacros.fat / targetMacros.fat) * 100) : 100,
  };

  // Dicas contextuais
  const tips: string[] = [];
  
  if (accuracy.protein < 90) {
    tips.push('💡 Adicione mais 1 scoop de whey ou 2 ovos para atingir a meta de proteína.');
  }
  if (accuracy.carbs < 80) {
    tips.push('💡 Adicione 1 fatia de pão integral ou mais banana para os carboidratos.');
  }
  if (accuracy.calories > 110) {
    tips.push('⚠️ Esta substituição excede ligeiramente as calorias originais.');
  }
  if (items.length > 5) {
    tips.push('📝 Prepare os ingredientes com antecedência para facilitar o consumo.');
  }

  return {
    originalMealMacros: targetMacros,
    items,
    totalMacros,
    accuracy,
    tips,
  };
}

/**
 * Gera substituições pré-calculadas para refeições típicas
 */
export function getPresetReplacements(goal: 'lose_weight' | 'maintain' | 'gain_muscle'): Record<string, MealReplacement> {
  const presets: Record<string, MacroTarget> = {
    'Café da Manhã': { calories: 400, protein: 25, carbs: 45, fat: 12 },
    'Lanche da Manhã': { calories: 200, protein: 10, carbs: 25, fat: 6 },
    'Almoço': { calories: 600, protein: 40, carbs: 60, fat: 18 },
    'Lanche da Tarde': { calories: 250, protein: 15, carbs: 30, fat: 8 },
    'Jantar': { calories: 500, protein: 35, carbs: 45, fat: 15 },
    'Ceia': { calories: 150, protein: 20, carbs: 10, fat: 5 },
  };

  const result: Record<string, MealReplacement> = {};
  
  for (const [mealName, macros] of Object.entries(presets)) {
    result[mealName] = calculateMealReplacement(macros, goal);
  }
  
  return result;
}

/**
 * Formata a precisão como badge variant
 */
export function getAccuracyStatus(percent: number): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  if (percent >= 95 && percent <= 105) {
    return { label: 'Exato', variant: 'default' };
  }
  if (percent >= 85 && percent <= 115) {
    return { label: 'Adequado', variant: 'secondary' };
  }
  if (percent < 85) {
    return { label: 'Abaixo', variant: 'outline' };
  }
  return { label: 'Acima', variant: 'destructive' };
}
