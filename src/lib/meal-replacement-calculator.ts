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
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  tips: string[];
}

interface CatalogItem {
  portion: string;
  macros: MacroTarget;
  notes: string;
  scalable?: boolean; // Se pode ajustar a porção
  minPortion?: number; // Porção mínima em fração (0.5 = metade)
  maxPortion?: number; // Porção máxima em fração (2 = dobro)
}

/**
 * Catálogo de suplementos com macros por porção
 */
const SUPPLEMENT_CATALOG: Record<string, CatalogItem> = {
  'Whey Protein Isolado': {
    portion: '30g (1 scoop)',
    macros: { calories: 120, protein: 25, carbs: 2, fat: 1 },
    notes: 'Alta absorção, ideal pós-treino',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Whey Protein Concentrado': {
    portion: '30g (1 scoop)',
    macros: { calories: 130, protein: 24, carbs: 4, fat: 2 },
    notes: 'Custo-benefício, versátil',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Caseína': {
    portion: '30g (1 scoop)',
    macros: { calories: 110, protein: 24, carbs: 3, fat: 0.5 },
    notes: 'Liberação lenta (6-8h), ideal antes de dormir',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Albumina': {
    portion: '40g (2 scoops)',
    macros: { calories: 140, protein: 32, carbs: 2, fat: 0.5 },
    notes: 'Proteína de ovo, absorção média',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  'Maltodextrina': {
    portion: '30g',
    macros: { calories: 120, protein: 0, carbs: 30, fat: 0 },
    notes: 'Carboidrato de rápida absorção',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Dextrose': {
    portion: '30g',
    macros: { calories: 120, protein: 0, carbs: 30, fat: 0 },
    notes: 'Recuperação glicogênica imediata',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
};

/**
 * Catálogo expandido de alimentos com macros
 */
const FOOD_CATALOG: Record<string, CatalogItem> = {
  // Gorduras saudáveis
  'Pasta de Amendoim Integral': {
    portion: '30g (2 colheres)',
    macros: { calories: 180, protein: 8, carbs: 6, fat: 14 },
    notes: 'Gordura saudável + proteína vegetal',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Castanha de Caju': {
    portion: '30g (10 unidades)',
    macros: { calories: 170, protein: 5, carbs: 9, fat: 13 },
    notes: 'Gordura saudável + minerais',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  'Castanha do Pará': {
    portion: '20g (4 unidades)',
    macros: { calories: 130, protein: 3, carbs: 2, fat: 13 },
    notes: 'Rica em selênio + gordura saudável',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  'Nozes': {
    portion: '30g (6 unidades)',
    macros: { calories: 195, protein: 5, carbs: 4, fat: 19 },
    notes: 'Ômega-3 vegetal + antioxidantes',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  'Amêndoas': {
    portion: '30g (20 unidades)',
    macros: { calories: 170, protein: 6, carbs: 6, fat: 15 },
    notes: 'Vitamina E + magnésio',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  'Abacate': {
    portion: '100g (1/2 unidade)',
    macros: { calories: 160, protein: 2, carbs: 8, fat: 15 },
    notes: 'Gordura monoinsaturada',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  
  // Carboidratos
  'Banana': {
    portion: '1 unidade (100g)',
    macros: { calories: 90, protein: 1, carbs: 23, fat: 0 },
    notes: 'Carboidrato de rápida absorção + potássio',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Aveia em Flocos': {
    portion: '40g (4 colheres)',
    macros: { calories: 150, protein: 5, carbs: 27, fat: 3 },
    notes: 'Fibras + carboidrato complexo',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Mel': {
    portion: '20g (1 colher)',
    macros: { calories: 60, protein: 0, carbs: 17, fat: 0 },
    notes: 'Carboidrato simples natural',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Pão Integral': {
    portion: '2 fatias (50g)',
    macros: { calories: 130, protein: 5, carbs: 24, fat: 2 },
    notes: 'Carboidrato complexo + fibras',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Batata Doce': {
    portion: '150g (1 unidade média)',
    macros: { calories: 130, protein: 2, carbs: 30, fat: 0 },
    notes: 'Carboidrato de baixo índice glicêmico',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  
  // Proteínas
  'Iogurte Grego Natural': {
    portion: '170g (1 pote)',
    macros: { calories: 150, protein: 15, carbs: 8, fat: 6 },
    notes: 'Alto teor proteico + probióticos',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  'Ovo Cozido': {
    portion: '1 unidade (50g)',
    macros: { calories: 75, protein: 6, carbs: 0.5, fat: 5 },
    notes: 'Proteína completa + gordura',
    scalable: true,
    minPortion: 1,
    maxPortion: 3,
  },
  'Queijo Cottage': {
    portion: '100g',
    macros: { calories: 100, protein: 12, carbs: 3, fat: 4 },
    notes: 'Alto teor proteico + cálcio',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Ricota': {
    portion: '100g',
    macros: { calories: 140, protein: 11, carbs: 3, fat: 10 },
    notes: 'Proteína + cálcio',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 1.5,
  },
  
  // Líquidos
  'Leite Desnatado': {
    portion: '200ml',
    macros: { calories: 70, protein: 7, carbs: 10, fat: 0 },
    notes: 'Base líquida para shakes',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Leite Integral': {
    portion: '200ml',
    macros: { calories: 120, protein: 6, carbs: 9, fat: 6 },
    notes: 'Mais calórico, ideal para ganho de massa',
    scalable: true,
    minPortion: 0.5,
    maxPortion: 2,
  },
  'Leite de Amêndoas': {
    portion: '200ml',
    macros: { calories: 30, protein: 1, carbs: 1, fat: 2.5 },
    notes: 'Baixo em calorias, alternativa vegana',
    scalable: true,
    minPortion: 1,
    maxPortion: 2,
  },
};

/**
 * Calcula os macros escalados para uma porção
 */
function scaleMacros(macros: MacroTarget, scale: number): MacroTarget {
  return {
    calories: Math.round(macros.calories * scale),
    protein: Math.round(macros.protein * scale * 10) / 10,
    carbs: Math.round(macros.carbs * scale * 10) / 10,
    fat: Math.round(macros.fat * scale * 10) / 10,
  };
}

/**
 * Formata a quantidade baseada no scale
 */
function formatQuantity(originalPortion: string, scale: number): string {
  if (scale === 1) return originalPortion;
  
  // Extrai a quantidade numérica da porção
  const match = originalPortion.match(/^(\d+(?:,\d+)?(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    const num = parseFloat(match[1].replace(',', '.'));
    const unit = match[2];
    const newNum = Math.round(num * scale * 10) / 10;
    return `${newNum}${unit ? ' ' + unit : ''}`;
  }
  
  // Para porções como "1 unidade (100g)"
  const unitMatch = originalPortion.match(/(\d+)\s*(unidade|fatia|pote|scoop)/i);
  if (unitMatch) {
    const num = parseInt(unitMatch[1]);
    const unit = unitMatch[2];
    const newNum = Math.round(num * scale);
    const gramsMatch = originalPortion.match(/\((\d+)g\)/);
    const newGrams = gramsMatch ? Math.round(parseInt(gramsMatch[1]) * scale) : null;
    return `${newNum} ${unit}${newNum > 1 && !unit.endsWith('s') ? 's' : ''}${newGrams ? ` (${newGrams}g)` : ''}`;
  }
  
  // Para "Xg (Y scoops)" ou similar
  const gramsMatch = originalPortion.match(/^(\d+)g/);
  if (gramsMatch) {
    const grams = parseInt(gramsMatch[1]);
    const newGrams = Math.round(grams * scale);
    const scoopMatch = originalPortion.match(/\((\d+)\s*scoop/i);
    if (scoopMatch) {
      const scoops = parseInt(scoopMatch[1]);
      const newScoops = Math.round(scoops * scale * 10) / 10;
      return `${newGrams}g (${newScoops} scoop${newScoops !== 1 ? 's' : ''})`;
    }
    return `${newGrams}g`;
  }
  
  return `${scale}x ${originalPortion}`;
}

/**
 * Calcula a pontuação de um item baseado no que ainda precisamos
 */
function scoreItem(item: CatalogItem, remaining: MacroTarget, goal: string): number {
  let score = 0;
  const macros = item.macros;
  
  // Penaliza se exceder calorias
  if (macros.calories > remaining.calories * 1.1) {
    score -= 100;
  }
  
  // Prioriza proteína para cut e muscle gain
  if (goal === 'lose_weight' || goal === 'gain_muscle') {
    if (remaining.protein > 0 && macros.protein > 0) {
      score += (macros.protein / macros.calories) * 100; // Densidade proteica
    }
  }
  
  // Prioriza carboidratos para muscle gain
  if (goal === 'gain_muscle' && remaining.carbs > 10) {
    if (macros.carbs > 0) {
      score += (macros.carbs / macros.calories) * 50;
    }
  }
  
  // Prioriza baixa gordura para cut
  if (goal === 'lose_weight') {
    if (macros.fat < 5) {
      score += 20;
    }
  }
  
  // Penaliza se adicionar muito de algo que já atingimos
  if (remaining.protein <= 0 && macros.protein > 5) score -= 30;
  if (remaining.carbs <= 0 && macros.carbs > 10) score -= 30;
  if (remaining.fat <= 0 && macros.fat > 5) score -= 30;
  
  return score;
}

/**
 * Calcula a combinação ideal de suplementos + alimentos para substituir uma refeição
 * Prioriza precisão de calorias (±10% máximo)
 */
export function calculateMealReplacement(
  targetMacros: MacroTarget,
  userGoal: 'lose_weight' | 'maintain' | 'gain_muscle'
): MealReplacement {
  const items: ReplacementItem[] = [];
  let currentMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  // Limites: 90-100% calorias, máx 120% proteína/carbos/gordura
  const limits = {
    calories: { min: targetMacros.calories * 0.90, max: targetMacros.calories * 1.00 },
    protein: { min: targetMacros.protein * 0.85, max: targetMacros.protein * 1.20 },
    carbs: { min: targetMacros.carbs * 0.70, max: targetMacros.carbs * 1.30 },
    fat: { min: targetMacros.fat * 0.70, max: targetMacros.fat * 1.30 },
  };
  
  // Funções para calcular espaço restante
  const remaining = () => ({
    calories: limits.calories.max - currentMacros.calories,
    protein: limits.protein.max - currentMacros.protein,
    carbs: limits.carbs.max - currentMacros.carbs,
    fat: limits.fat.max - currentMacros.fat,
  });
  
  // Função para verificar se podemos adicionar um item sem exceder limites
  const canAddItem = (macros: MacroTarget, scale: number = 1): boolean => {
    const r = remaining();
    return (
      macros.calories * scale <= r.calories + 10 && // margem de 10kcal
      macros.protein * scale <= r.protein + 2 &&    // margem de 2g
      macros.fat * scale <= r.fat + 3               // margem de 3g
    );
  };
  
  // Função para calcular o scale máximo respeitando TODOS os limites
  const calculateOptimalScale = (macros: MacroTarget, desiredScale: number, minScale: number = 0.5): number => {
    const r = remaining();
    
    // Calcular scale máximo para cada macro
    const maxByCalories = macros.calories > 0 ? r.calories / macros.calories : desiredScale;
    const maxByProtein = macros.protein > 0 ? r.protein / macros.protein : desiredScale;
    const maxByFat = macros.fat > 5 ? r.fat / macros.fat : desiredScale; // Só limita se item tem muita gordura
    
    // Usar o menor dos limites
    const maxAllowed = Math.min(maxByCalories, maxByProtein, maxByFat, desiredScale);
    
    return Math.max(minScale, maxAllowed);
  };
  
  // Função para adicionar um item
  const addItem = (name: string, catalog: Record<string, CatalogItem>, type: 'supplement' | 'food', scale: number = 1): boolean => {
    const item = catalog[name];
    if (!item) return false;
    
    // Ajustar scale para respeitar todos os limites
    const adjustedScale = calculateOptimalScale(item.macros, scale, 0.25);
    if (adjustedScale < 0.25) return false; // Porção muito pequena
    
    const finalScale = Math.round(adjustedScale * 4) / 4; // Arredondar para 0.25
    if (finalScale <= 0) return false;
    
    // Verificar se ainda cabe
    if (!canAddItem(item.macros, finalScale)) return false;
    
    const scaledMacros = scaleMacros(item.macros, finalScale);
    
    items.push({
      name,
      quantity: formatQuantity(item.portion, finalScale),
      macros: scaledMacros,
      type,
      notes: item.notes,
    });
    
    currentMacros.protein += scaledMacros.protein;
    currentMacros.calories += scaledMacros.calories;
    currentMacros.carbs += scaledMacros.carbs;
    currentMacros.fat += scaledMacros.fat;
    
    return true;
  };
  
  // 1. PROTEÍNA: Usar Whey SOMENTE se precisar de muita proteína
  const proteinDeficit = targetMacros.protein - currentMacros.protein;
  if (proteinDeficit >= 12 && remaining().calories >= 60) {
    const wheyType = userGoal === 'lose_weight' ? 'Whey Protein Isolado' : 'Whey Protein Concentrado';
    const whey = SUPPLEMENT_CATALOG[wheyType];
    
    // Calcular scoops baseado na proteína NECESSÁRIA (não mais que 1 scoop para refeições pequenas)
    const idealScoops = Math.min(1.5, proteinDeficit / whey.macros.protein);
    const optimalScale = calculateOptimalScale(whey.macros, idealScoops, 0.5);
    
    // Arredondar para 0.5
    const finalScoops = Math.round(optimalScale * 2) / 2;
    
    if (finalScoops >= 0.5) {
      addItem(wheyType, SUPPLEMENT_CATALOG, 'supplement', finalScoops);
    }
  }

  // 2. CARBOIDRATOS: Adicionar fonte de carboidrato se necessário
  if (remaining().carbs >= 10 && remaining().calories >= 45) {
    const bananaScale = calculateOptimalScale(FOOD_CATALOG['Banana'].macros, 1, 0.5);
    if (bananaScale >= 0.5) {
      addItem('Banana', FOOD_CATALOG, 'food', bananaScale);
    }
  }
  
  if (remaining().carbs >= 15 && remaining().calories >= 75) {
    const oatsScale = calculateOptimalScale(FOOD_CATALOG['Aveia em Flocos'].macros, remaining().carbs >= 25 ? 1 : 0.5, 0.5);
    if (oatsScale >= 0.5) {
      addItem('Aveia em Flocos', FOOD_CATALOG, 'food', oatsScale);
    }
  }

  // 3. GORDURA: Adicionar gordura saudável se necessário (variar entre opções)
  if (remaining().fat >= 6 && remaining().calories >= 80) {
    const fatOptions = ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Nozes', 'Amêndoas'];
    const shuffled = fatOptions.sort(() => Math.random() - 0.5);
    
    for (const option of shuffled) {
      const item = FOOD_CATALOG[option];
      const scale = calculateOptimalScale(item.macros, 1, 0.5);
      if (scale >= 0.5 && canAddItem(item.macros, scale)) {
        addItem(option, FOOD_CATALOG, 'food', scale);
        break;
      }
    }
  }

  // 4. PROTEÍNA ADICIONAL: Se ainda precisar (mas sem exceder limite)
  if (remaining().protein >= 6 && remaining().calories >= 50) {
    const proteinOptions = ['Iogurte Grego Natural', 'Ovo Cozido', 'Queijo Cottage'];
    
    for (const option of proteinOptions) {
      const item = FOOD_CATALOG[option];
      if (option === 'Ovo Cozido') {
        const numEggs = Math.min(2, Math.ceil(remaining().protein / item.macros.protein));
        const eggScale = calculateOptimalScale(item.macros, numEggs, 1);
        if (eggScale >= 1 && canAddItem(item.macros, eggScale)) {
          addItem(option, FOOD_CATALOG, 'food', Math.round(eggScale));
          break;
        }
      } else {
        const scale = calculateOptimalScale(item.macros, 1, 0.5);
        if (scale >= 0.5 && canAddItem(item.macros, scale)) {
          addItem(option, FOOD_CATALOG, 'food', scale);
          break;
        }
      }
    }
  }

  // 5. LÍQUIDO: Base para shake (apenas se tiver suplemento)
  if (items.some(i => i.type === 'supplement') && remaining().calories >= 35) {
    const milkType = userGoal === 'lose_weight' ? 'Leite Desnatado' : 
                     userGoal === 'gain_muscle' ? 'Leite Integral' : 'Leite Desnatado';
    
    const scale = calculateOptimalScale(FOOD_CATALOG[milkType].macros, 1, 0.5);
    if (scale >= 0.5) {
      addItem(milkType, FOOD_CATALOG, 'food', scale);
    }
  }

  // 6. AJUSTE FINO: Preencher espaço restante se ainda abaixo de 90%
  const currentAccuracy = (currentMacros.calories / targetMacros.calories) * 100;
  
  if (currentAccuracy < 90 && remaining().calories >= 30) {
    // Adicionar mel para completar carboidratos/calorias
    const melScale = Math.min(2, remaining().calories / FOOD_CATALOG['Mel'].macros.calories);
    if (melScale >= 0.5) {
      addItem('Mel', FOOD_CATALOG, 'food', Math.round(melScale * 2) / 2);
    }
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
  if (accuracy.calories > 100) {
    tips.push('⚠️ Esta substituição excede as calorias originais em ' + (accuracy.calories - 100) + '%.');
  } else if (accuracy.calories < 90) {
    tips.push('💡 Adicione mais alimentos para atingir as calorias necessárias.');
  } else {
    tips.push('✅ Calorias dentro da margem ideal (±10%).');
  }
  
  if (items.length > 5) {
    tips.push('📝 Prepare os ingredientes com antecedência para facilitar o consumo.');
  }

  // Dica de preparo baseada nos itens
  const hasWhey = items.some(i => i.name.includes('Whey'));
  const hasOats = items.some(i => i.name.includes('Aveia'));
  const hasBanana = items.some(i => i.name === 'Banana');
  const hasNuts = items.some(i => ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Nozes', 'Amêndoas', 'Castanha do Pará'].includes(i.name));
  
  if (hasWhey && (hasOats || hasBanana)) {
    tips.push('🥤 Bata todos os ingredientes no liquidificador para um shake completo.');
  } else if (hasNuts && !hasWhey) {
    tips.push('🥜 Consuma as oleaginosas como snack ou adicione ao iogurte/aveia.');
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
