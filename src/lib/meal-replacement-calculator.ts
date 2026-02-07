/**
 * Sistema de Cálculo de Substituição de Refeições
 * 
 * Combina suplementos + alimentos para igualar os macros de uma refeição
 * que o usuário não consegue consumir.
 * 
 * ARQUITETURA:
 * - Usa catálogo dinâmico do banco de dados quando disponível
 * - Fallback para catálogo hardcoded se a busca falhar
 * - Garante zero downtime na migração
 */

import { getPrefetchedCatalog, type SupplementCatalogItem } from '@/hooks/useSupplementCatalog';

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
  reason?: string; // Justificativa da escolha (ex: "Menor caloria para atingir meta")
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
  usedDynamicCatalog?: boolean; // Indica se usou catálogo do DB
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
  // REMOVIDOS: Pão Integral, Tapioca, Batata Doce - são alimentos de plano, não de suplementação
  // A suplementação foca em itens práticos para shakes: whey, aveia, banana, mel, oleaginosas
  
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
  
  // Líquidos - apenas água como base para shakes
  'Água': {
    portion: '200ml',
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    notes: 'Base preferencial para shakes - zero calorias',
    scalable: true,
    minPortion: 0.75, // Mínimo 150ml
    maxPortion: 2,
  },
};

// =====================================================
// CATÁLOGO DINÂMICO COM FALLBACK
// =====================================================

/**
 * Converte item do catálogo dinâmico (DB) para o formato CatalogItem
 */
function convertDynamicItem(item: SupplementCatalogItem): CatalogItem {
  return {
    portion: item.portion,
    macros: item.macros,
    notes: item.notes,
    scalable: item.scalable,
    minPortion: item.minPortion,
    maxPortion: item.maxPortion,
  };
}

/**
 * Obtém os catálogos ativos (dinâmico ou fallback)
 * Retorna { supplements, foods, usedDynamic }
 */
function getActiveCatalogs(): {
  supplements: Record<string, CatalogItem>;
  foods: Record<string, CatalogItem>;
  usedDynamic: boolean;
} {
  const prefetched = getPrefetchedCatalog();
  
  // Se temos catálogo dinâmico, converter e usar
  if (prefetched.supplements && Object.keys(prefetched.supplements).length > 0) {
    const dynamicSupplements: Record<string, CatalogItem> = {};
    const dynamicFoods: Record<string, CatalogItem> = {};
    
    for (const [name, item] of Object.entries(prefetched.supplements)) {
      dynamicSupplements[name] = convertDynamicItem(item);
    }
    
    if (prefetched.foods) {
      for (const [name, item] of Object.entries(prefetched.foods)) {
        dynamicFoods[name] = convertDynamicItem(item);
      }
    }
    
    return {
      supplements: dynamicSupplements,
      foods: dynamicFoods,
      usedDynamic: true,
    };
  }
  
  // Fallback para catálogos hardcoded
  return {
    supplements: SUPPLEMENT_CATALOG,
    foods: FOOD_CATALOG,
    usedDynamic: false,
  };
}

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
  // Obter catálogos ativos (dinâmico ou fallback)
  const { supplements: ACTIVE_SUPPLEMENTS, foods: ACTIVE_FOODS, usedDynamic } = getActiveCatalogs();
  
  const items: ReplacementItem[] = [];
  let currentMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  
  // Limites: 90-100% calorias, 90-105% proteína (preciso), carbos/gordura flexíveis
  const limits = {
    calories: { min: targetMacros.calories * 0.90, max: targetMacros.calories * 1.00 },
    protein: { min: targetMacros.protein * 0.90, max: targetMacros.protein * 1.05 }, // Proteína precisa
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
  // PRIORIDADE: Proteína precisa (máx 105%) > Calorias (90-100%) > Gordura
  const canAddItem = (macros: MacroTarget, scale: number = 1): boolean => {
    const r = remaining();
    // Tolerância de proteína reduzida: máximo 5% de excesso
    const proteinTolerance = 0.05;
    return (
      macros.calories * scale <= r.calories + 15 && // margem de 15kcal
      macros.protein * scale <= r.protein + (targetMacros.protein * proteinTolerance) &&
      macros.fat * scale <= r.fat + 5               // margem de 5g
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
  
  // 1. PROTEÍNA: Usar Whey SOMENTE se precisar de proteína E não vai exceder muito
  const proteinDeficit = targetMacros.protein - currentMacros.protein;
  const proteinAccuracy = () => (currentMacros.protein / targetMacros.protein) * 100;
  
  // Só adicionar whey se o deficit for significativo (>= 15g) e temos espaço
  if (proteinDeficit >= 15 && remaining().calories >= 60) {
    const wheyType = userGoal === 'lose_weight' ? 'Whey Protein Isolado' : 'Whey Protein Concentrado';
    const whey = ACTIVE_SUPPLEMENTS[wheyType];
    
    if (whey) {
      // Calcular scoops para atingir ~95% da proteína (não 100%+)
      const targetProteinScoops = (targetMacros.protein * 0.95 - currentMacros.protein) / whey.macros.protein;
      const idealScoops = Math.min(1, Math.max(0.5, targetProteinScoops)); // Máx 1 scoop
      const optimalScale = calculateOptimalScale(whey.macros, idealScoops, 0.5);
      
      // Arredondar para 0.5
      const finalScoops = Math.round(optimalScale * 2) / 2;
      
      if (finalScoops >= 0.5 && finalScoops <= 1) {
        addItem(wheyType, ACTIVE_SUPPLEMENTS, 'supplement', finalScoops);
      }
    }
  }

  // 2. CARBOIDRATOS: Adicionar fontes de carboidrato proporcionalmente ao déficit
  // Priorizar atingir pelo menos 90% das calorias com carboidratos de qualidade
  const carbDeficit = () => targetMacros.carbs - currentMacros.carbs;
  const caloriePercent = () => (currentMacros.calories / targetMacros.calories) * 100;
  const isHighCarbMeal = targetMacros.carbs >= 40; // Ajustado de 60 para 40g
  
  // Aveia PRIMEIRO (carboidrato complexo e nutritivo)
  const oatsItem = ACTIVE_FOODS['Aveia em Flocos'];
  if (oatsItem && remaining().carbs >= 15 && remaining().calories >= 75) {
    const oatsDesiredScale = carbDeficit() >= 40 ? 1.5 : (carbDeficit() >= 25 ? 1 : 0.75);
    const oatsScale = calculateOptimalScale(oatsItem.macros, oatsDesiredScale, 0.5);
    if (oatsScale >= 0.5) {
      addItem('Aveia em Flocos', ACTIVE_FOODS, 'food', oatsScale);
    }
  }
  
  // Banana (carboidrato rápido + potássio)
  const bananaItem = ACTIVE_FOODS['Banana'];
  if (bananaItem && remaining().carbs >= 10 && remaining().calories >= 45) {
    // Para refeições com muitos carbos, usar mais banana
    const bananaDesiredScale = carbDeficit() > 30 ? 1.5 : 1;
    const bananaScale = calculateOptimalScale(bananaItem.macros, bananaDesiredScale, 0.5);
    if (bananaScale >= 0.5) {
      addItem('Banana', ACTIVE_FOODS, 'food', bananaScale);
    }
  }
  
  // REMOVIDOS: Tapioca e Pão Integral - são alimentos de plano, não de suplementação
  // Para déficit de carboidratos em suplementação, usar mais Aveia ou Banana
  
  // Aveia extra se ainda precisar de carboidratos
  if (oatsItem && carbDeficit() >= 20 && remaining().calories >= 75 && caloriePercent() < 85) {
    const extraOatsScale = calculateOptimalScale(oatsItem.macros, 0.75, 0.5);
    if (extraOatsScale >= 0.5 && !items.some(i => i.name === 'Aveia em Flocos')) {
      addItem('Aveia em Flocos', ACTIVE_FOODS, 'food', extraOatsScale);
    }
  }
  
  // Banana extra se ainda precisar de calorias
  if (bananaItem && caloriePercent() < 85 && remaining().carbs >= 10 && !items.some(i => i.name === 'Banana')) {
    const extraBananaScale = calculateOptimalScale(bananaItem.macros, 1, 0.5);
    if (extraBananaScale >= 0.5) {
      addItem('Banana', ACTIVE_FOODS, 'food', extraBananaScale);
    }
  }

  // 3. GORDURA: Adicionar gordura saudável se necessário (variar entre opções)
  if (remaining().fat >= 6 && remaining().calories >= 80) {
    const fatOptions = ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Nozes', 'Amêndoas'];
    const shuffled = fatOptions.sort(() => Math.random() - 0.5);
    
    for (const option of shuffled) {
      const item = ACTIVE_FOODS[option];
      if (!item) continue;
      const scale = calculateOptimalScale(item.macros, 1, 0.5);
      if (scale >= 0.5 && canAddItem(item.macros, scale)) {
        addItem(option, ACTIVE_FOODS, 'food', scale);
        break;
      }
    }
  }

  // 4. PROTEÍNA ADICIONAL: REMOVIDO - priorizar precisão de proteína
  // Não adicionar proteína extra (iogurte, ovos) para evitar exceder a meta
  // O whey já deve cobrir a necessidade proteica

  // 5. LÍQUIDO: Base para shake (obrigatório se tiver suplemento em pó)
  const hasProteinPowder = items.some(i => 
    i.type === 'supplement' && 
    (i.name.includes('Whey') || i.name.includes('Caseína') || i.name.includes('Albumina'))
  );
  
  if (hasProteinPowder) {
    // ÁGUA é sempre a base preferencial para shakes
    // Isso garante que o shake não impacte negativamente no plano alimentar,
    // mantendo hidratação e controle preciso de calorias
    items.push({
      name: 'Água',
      quantity: '150-200ml',
      macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      type: 'food',
      notes: 'Base preferencial para shakes - mantém controle calórico',
      reason: '💧 Água para não impactar o plano alimentar e garantir hidratação',
    });
  }

  // 6. DIVERSIDADE MÍNIMA: Garantir pelo menos 2-3 itens variados
  // Evita sugestões de itens isolados (ex: só mel, só aveia)
  const MIN_ITEMS_SUBSTANTIVE = 2; // Mínimo para refeições leves
  const MIN_ITEMS_FULL = 3;        // Mínimo para refeições completas
  const isFullMeal = targetMacros.calories >= 300;
  const minItemsRequired = isFullMeal ? MIN_ITEMS_FULL : MIN_ITEMS_SUBSTANTIVE;
  
  // Se temos poucos itens, adicionar diversidade antes de fillers
  const substantiveItems = items.filter(i => i.name !== 'Água');
  if (substantiveItems.length < minItemsRequired) {
    // Priorizar adição de proteína se não tem whey
    const hasProteinSource = items.some(i => 
      i.name.includes('Whey') || i.name.includes('Iogurte') || 
      i.name.includes('Ovo') || i.name.includes('Cottage')
    );
    
    if (!hasProteinSource && remaining().protein >= 5 && remaining().calories >= 50) {
      // Adicionar fonte proteica leve
      const proteinOptions = ['Iogurte Grego Natural', 'Queijo Cottage', 'Ovo Cozido'];
      for (const opt of proteinOptions) {
        const item = ACTIVE_FOODS[opt];
        if (item && canAddItem(item.macros, 0.5)) {
          if (addItem(opt, ACTIVE_FOODS, 'food', 0.5)) break;
        }
      }
    }
    
    // Adicionar fonte de carboidrato se não tem
    const hasCarbSource = items.some(i => 
      i.name.includes('Aveia') || i.name.includes('Banana') || i.name.includes('Maltodextrina')
    );
    
    if (!hasCarbSource && remaining().carbs >= 10 && remaining().calories >= 50) {
      if (bananaItem && canAddItem(bananaItem.macros, 0.5)) {
        addItem('Banana', ACTIVE_FOODS, 'food', 0.5);
      }
    }
    
    // Adicionar fonte de gordura se não tem
    const hasFatSource = items.some(i => 
      i.name.includes('Amendoim') || i.name.includes('Castanha') || 
      i.name.includes('Nozes') || i.name.includes('Amêndoas')
    );
    
    if (!hasFatSource && remaining().fat >= 5 && remaining().calories >= 80 && substantiveItems.length < minItemsRequired) {
      const fatOptions = ['Pasta de Amendoim Integral', 'Castanha de Caju', 'Amêndoas'];
      for (const opt of fatOptions) {
        const item = ACTIVE_FOODS[opt];
        if (item && canAddItem(item.macros, 0.5)) {
          if (addItem(opt, ACTIVE_FOODS, 'food', 0.5)) break;
        }
      }
    }
  }
  
  // 7. AJUSTE FINO: Preencher espaço restante se ainda abaixo de 90%
  const currentAccuracyPreFill = (currentMacros.calories / targetMacros.calories) * 100;
  
  // Adicionar mel SOMENTE se já temos diversidade mínima
  const currentSubstantiveItems = items.filter(i => i.name !== 'Água');
  const melItem = ACTIVE_FOODS['Mel'];
  if (melItem && currentAccuracyPreFill < 90 && remaining().calories >= 30 && currentSubstantiveItems.length >= MIN_ITEMS_SUBSTANTIVE) {
    // Calcular quantas porções de mel precisamos para atingir ~90%
    const caloriesNeeded = (targetMacros.calories * 0.90) - currentMacros.calories;
    const melPortionCalories = melItem.macros.calories;
    const melScaleNeeded = Math.min(2, caloriesNeeded / melPortionCalories); // Máx 2 porções (reduzido de 3)
    
    if (melScaleNeeded >= 0.5) {
      // Arredondar para 0.5 para porções práticas
      const melScale = Math.round(melScaleNeeded * 2) / 2;
      addItem('Mel', ACTIVE_FOODS, 'food', melScale);
    }
  }
  
  // Se ainda abaixo de 90% após mel, adicionar mais banana
  const currentAccuracyPostMel = (currentMacros.calories / targetMacros.calories) * 100;
  if (bananaItem && currentAccuracyPostMel < 88 && remaining().calories >= 45) {
    const bananaScale = calculateOptimalScale(bananaItem.macros, 1, 0.5);
    if (bananaScale >= 0.5 && !items.some(i => i.name === 'Banana')) {
      addItem('Banana', ACTIVE_FOODS, 'food', bananaScale);
    }
  }

  // =====================================================
  // 8. REFINAMENTO ITERATIVO: Ajustar porções para convergência
  // =====================================================
  const ACCURACY_TARGETS = {
    calories: { min: 90, max: 100 },
    protein: { min: 90, max: 105 },
    carbs: { min: 80, max: 120 },
    fat: { min: 80, max: 120 },
  };
  
  // Função para calcular accuracy atual
  const calculateAccuracy = () => ({
    calories: targetMacros.calories > 0 ? (currentMacros.calories / targetMacros.calories) * 100 : 100,
    protein: targetMacros.protein > 0 ? (currentMacros.protein / targetMacros.protein) * 100 : 100,
    carbs: targetMacros.carbs > 0 ? (currentMacros.carbs / targetMacros.carbs) * 100 : 100,
    fat: targetMacros.fat > 0 ? (currentMacros.fat / targetMacros.fat) * 100 : 100,
  });
  
  // Função para verificar se todos os macros estão convergidos
  const isConverged = (acc: ReturnType<typeof calculateAccuracy>) => {
    return (
      acc.calories >= ACCURACY_TARGETS.calories.min &&
      acc.calories <= ACCURACY_TARGETS.calories.max &&
      acc.protein >= ACCURACY_TARGETS.protein.min &&
      acc.protein <= ACCURACY_TARGETS.protein.max
    );
  };
  
  // Função para escalar um item existente
  const scaleExistingItem = (itemIndex: number, newScale: number): boolean => {
    const item = items[itemIndex];
    if (!item || item.name === 'Água') return false;
    
    // Encontrar item no catálogo
    const catalogItem = ACTIVE_FOODS[item.name] || ACTIVE_SUPPLEMENTS[item.name];
    if (!catalogItem) return false;
    
    // Calcular scale atual baseado nos macros
    const currentScale = catalogItem.macros.calories > 0 
      ? item.macros.calories / catalogItem.macros.calories 
      : 1;
    
    // Limitar newScale aos bounds do catálogo
    const minScale = catalogItem.minPortion || 0.25;
    const maxScale = catalogItem.maxPortion || 2;
    const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
    
    if (Math.abs(clampedScale - currentScale) < 0.1) return false; // Mudança insignificante
    
    // Atualizar macros
    const oldMacros = item.macros;
    const newMacros = scaleMacros(catalogItem.macros, clampedScale);
    
    // Verificar se a mudança não excede limites críticos
    const projectedProtein = currentMacros.protein - oldMacros.protein + newMacros.protein;
    const projectedCalories = currentMacros.calories - oldMacros.calories + newMacros.calories;
    
    if (projectedProtein > targetMacros.protein * 1.10) return false; // Limite de proteína
    if (projectedCalories > targetMacros.calories * 1.05) return false; // Limite de calorias
    
    // Aplicar mudança
    currentMacros.calories = currentMacros.calories - oldMacros.calories + newMacros.calories;
    currentMacros.protein = currentMacros.protein - oldMacros.protein + newMacros.protein;
    currentMacros.carbs = currentMacros.carbs - oldMacros.carbs + newMacros.carbs;
    currentMacros.fat = currentMacros.fat - oldMacros.fat + newMacros.fat;
    
    items[itemIndex] = {
      ...item,
      quantity: formatQuantity(catalogItem.portion, clampedScale),
      macros: newMacros,
    };
    
    return true;
  };
  
  // Executar até 5 iterações de refinamento
  const MAX_REFINEMENT_ITERATIONS = 5;
  for (let iteration = 0; iteration < MAX_REFINEMENT_ITERATIONS; iteration++) {
    const acc = calculateAccuracy();
    
    if (isConverged(acc)) break;
    
    // Identificar o macro mais crítico (mais longe da meta)
    const calorieGap = acc.calories < ACCURACY_TARGETS.calories.min 
      ? ACCURACY_TARGETS.calories.min - acc.calories 
      : (acc.calories > ACCURACY_TARGETS.calories.max ? acc.calories - ACCURACY_TARGETS.calories.max : 0);
    const proteinGap = acc.protein < ACCURACY_TARGETS.protein.min 
      ? ACCURACY_TARGETS.protein.min - acc.protein 
      : 0; // Só preocupa se abaixo
    
    // Prioridade: Calorias primeiro (se abaixo de 90%)
    if (acc.calories < ACCURACY_TARGETS.calories.min) {
      // Tentar escalar itens de carboidrato para aumentar calorias
      const carbItems = items.map((item, idx) => ({ item, idx }))
        .filter(({ item }) => 
          item.name.includes('Aveia') || item.name.includes('Banana') || 
          item.name === 'Mel' || item.name.includes('Maltodextrina')
        );
      
      for (const { item, idx } of carbItems) {
        const catalogItem = ACTIVE_FOODS[item.name] || ACTIVE_SUPPLEMENTS[item.name];
        if (!catalogItem) continue;
        
        const currentScale = catalogItem.macros.calories > 0 
          ? item.macros.calories / catalogItem.macros.calories 
          : 1;
        
        // Calcular quanto precisamos aumentar
        const caloriesNeeded = targetMacros.calories * 0.92 - currentMacros.calories;
        const scaleIncrease = caloriesNeeded / catalogItem.macros.calories;
        const newScale = currentScale + Math.min(0.5, scaleIncrease);
        
        if (scaleExistingItem(idx, newScale)) break;
      }
    }
    
    // Se proteína abaixo de 90%, tentar escalar whey
    if (acc.protein < ACCURACY_TARGETS.protein.min) {
      const wheyIdx = items.findIndex(item => item.name.includes('Whey'));
      if (wheyIdx >= 0) {
        const wheyItem = items[wheyIdx];
        const catalogItem = ACTIVE_SUPPLEMENTS[wheyItem.name];
        if (catalogItem) {
          const currentScale = catalogItem.macros.protein > 0 
            ? wheyItem.macros.protein / catalogItem.macros.protein 
            : 1;
          
          // Tentar aumentar para 1 scoop se ainda está em 0.5
          if (currentScale < 1) {
            scaleExistingItem(wheyIdx, 1);
          }
        }
      }
    }
    
    // Se calorias acima de 100%, tentar reduzir itens menos essenciais
    if (acc.calories > ACCURACY_TARGETS.calories.max) {
      // Reduzir mel primeiro, depois oleaginosas
      const fillerItems = items.map((item, idx) => ({ item, idx }))
        .filter(({ item }) => 
          item.name === 'Mel' || item.name.includes('Castanha') || 
          item.name.includes('Amendoim') || item.name.includes('Nozes')
        );
      
      for (const { item, idx } of fillerItems) {
        const catalogItem = ACTIVE_FOODS[item.name];
        if (!catalogItem) continue;
        
        const currentScale = catalogItem.macros.calories > 0 
          ? item.macros.calories / catalogItem.macros.calories 
          : 1;
        
        // Reduzir em 0.25
        const newScale = currentScale - 0.25;
        if (newScale >= 0.25) {
          scaleExistingItem(idx, newScale);
          break;
        }
      }
    }
  }

  // Calcular totais finais
  const totalMacros = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.macros.calories,
      protein: acc.protein + item.macros.protein,
      carbs: acc.carbs + item.macros.carbs,
      fat: acc.fat + item.macros.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Calcular precisão final
  const accuracy = {
    calories: targetMacros.calories > 0 ? Math.round((totalMacros.calories / targetMacros.calories) * 100) : 100,
    protein: targetMacros.protein > 0 ? Math.round((totalMacros.protein / targetMacros.protein) * 100) : 100,
    carbs: targetMacros.carbs > 0 ? Math.round((totalMacros.carbs / targetMacros.carbs) * 100) : 100,
    fat: targetMacros.fat > 0 ? Math.round((totalMacros.fat / targetMacros.fat) * 100) : 100,
  };
  
  // Verificar convergência final
  const finalConverged = 
    accuracy.calories >= ACCURACY_TARGETS.calories.min && 
    accuracy.calories <= ACCURACY_TARGETS.calories.max &&
    accuracy.protein >= ACCURACY_TARGETS.protein.min;

  // Dicas contextuais
  const tips: string[] = [];
  
  if (finalConverged) {
    tips.push('✅ Substituição otimizada: calorias e proteína dentro das metas.');
  } else {
    if (accuracy.protein < 90) {
      tips.push('💡 Adicione mais 1 scoop de whey ou 2 ovos para atingir a meta de proteína.');
    }
    if (accuracy.calories < 90) {
      tips.push('💡 Adicione mais alimentos para atingir as calorias necessárias.');
    } else if (accuracy.calories > 100) {
      tips.push('⚠️ Esta substituição excede as calorias originais em ' + (accuracy.calories - 100) + '%.');
    }
  }
  
  if (accuracy.carbs < 80) {
    tips.push('💡 Adicione 1 fatia de pão integral ou mais banana para os carboidratos.');
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
    usedDynamicCatalog: usedDynamic,
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
