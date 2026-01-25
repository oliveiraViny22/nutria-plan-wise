// =====================================================
// SERVIÇO DE SUBSTITUIÇÕES INTELIGENTES (CANÔNICO)
// =====================================================
// Regra Mestre: Substituição não cria plano novo e não muda metas.
// Ela troca um item por equivalente mantendo calorias/macros o mais próximo.
// =====================================================

import { Food, MealOptionFood, DietPlan } from './types';
import { 
  CANONICAL_CATEGORIES, 
  FoodCategory, 
  isValidCategory,
  SUBSTITUTABLE_PROCESSING_LEVELS,
  ProcessingLevel 
} from './food-categories';

// =====================================================
// TIPOS
// =====================================================

export interface SubstituteOptions {
  /** Allow cross-category substitution (requires confirmation) */
  allowCrossCategory?: boolean;
  /** Force rebalance after substitution */
  forceRebalance?: boolean;
}

export interface SubstituteCandidate {
  food: Food;
  score: number;
  newPortionGrams: number;
  deltaMacros: DeltaMacros;
  requiresRebalance: boolean;
  substituteType: SubstituteType;
}

export interface DeltaMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface SubstituteProposal {
  from: {
    food: Food;
    portionGrams: number;
    nutrients: NutrientValues;
  };
  to: {
    food: Food;
    portionGrams: number;
    nutrients: NutrientValues;
  };
  deltaMacros: DeltaMacros;
  requiresRebalance: boolean;
  substituteType: SubstituteType;
  score: number;
}

export interface NutrientValues {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Tipos de substituição permitidos */
export type SubstituteType = 
  | 'equivalent_direct'    // Tipo A - mesmo macro dominante, mesma categoria
  | 'equivalent_functional' // Tipo B - mesma categoria, densidade diferente
  | 'exception_controlled'; // Tipo C - exceção com confirmação (bloqueado por padrão)

export interface SubstituteResult {
  success: boolean;
  proposal?: SubstituteProposal;
  candidates?: SubstituteCandidate[];
  error?: SubstituteError;
}

export type SubstituteError = 
  | 'PLAN_LOCKED'
  | 'ITEM_NOT_FOUND'
  | 'INVALID_CATEGORY'
  | 'INVALID_PROCESSING_LEVEL'
  | 'SUPPLEMENT_NOT_SUBSTITUTABLE'
  | 'NO_PERMISSION'
  | 'NO_CANDIDATES'
  | 'INVALID_PORTION';

// =====================================================
// GATES DE GOVERNANÇA
// =====================================================

export interface GovernanceContext {
  planStatus: string;
  userHasPermission: boolean;
}

/**
 * Valida gates de governança antes de qualquer cálculo
 * @throws SubstituteError se algum gate falhar
 */
export function validateGovernanceGates(
  context: GovernanceContext,
  sourceFood: Food | null | undefined
): SubstituteError | null {
  // Gate 1: Plano não pode estar locked
  if (context.planStatus === 'locked') {
    return 'PLAN_LOCKED';
  }

  // Gate 2: Usuário precisa de permissão
  if (!context.userHasPermission) {
    return 'NO_PERMISSION';
  }

  // Gate 3: Item de origem precisa existir
  if (!sourceFood) {
    return 'ITEM_NOT_FOUND';
  }

  // Gate 4: Categoria precisa ser válida
  if (!sourceFood.category || !isValidCategory(sourceFood.category)) {
    return 'INVALID_CATEGORY';
  }

  // Gate 5: Suplementos não podem ser substituídos automaticamente
  if (sourceFood.category === 'suplementos') {
    return 'SUPPLEMENT_NOT_SUBSTITUTABLE';
  }

  return null;
}

// =====================================================
// VALIDAÇÃO DO ITEM DE ORIGEM
// =====================================================

/**
 * Verifica se um alimento pode ser usado em substituições automáticas
 */
export function canBeSubstituted(food: Food): boolean {
  const reason = getSubstitutionBlockReason(food);
  return reason === null;
}

/**
 * Retorna o motivo pelo qual um alimento não pode ser substituído, ou null se permitido
 */
export function getSubstitutionBlockReason(food: Food): SubstituteError | null {
  // Suplementos não podem ser auto-substituídos
  if (food.category === 'suplementos') {
    return 'SUPPLEMENT_NOT_SUBSTITUTABLE';
  }

  // Categoria precisa ser canônica
  if (!food.category || !isValidCategory(food.category)) {
    return 'INVALID_CATEGORY';
  }

  // Verificar nível de processamento
  const processingLevel = food.processing_level;
  if (!processingLevel) {
    return null; // Permitir se não definido
  }

  // Normalizar para comparação
  const normalizedLevel = processingLevel.toLowerCase().replace(/\s+/g, '_');
  
  // Níveis permitidos para substituição
  // Incluímos 'processado' pois alimentos como macarrão/pão são válidos para troca
  // Apenas 'ultraprocessado' e 'suplemento' são bloqueados
  const allowedLevels = [
    'in_natura',
    'minimamente_processado',
    'processado',
  ];

  if (!allowedLevels.includes(normalizedLevel)) {
    return 'INVALID_PROCESSING_LEVEL';
  }
  
  return null;
}

/**
 * Verifica se um alimento pode ser candidato para substituição
 */
export function isValidCandidate(
  candidate: Food, 
  sourceFood: Food,
  options?: SubstituteOptions
): boolean {
  // Não pode ser o mesmo alimento
  if (candidate.id === sourceFood.id) return false;

  // Candidato precisa ser substituível
  if (!canBeSubstituted(candidate)) return false;

  // Por padrão, mesma categoria é obrigatória (case-insensitive)
  if (!options?.allowCrossCategory) {
    const normalizedCandidateCategory = candidate.category?.toLowerCase().trim();
    const normalizedSourceCategory = sourceFood.category?.toLowerCase().trim();
    if (normalizedCandidateCategory !== normalizedSourceCategory) return false;
  }

  // Alimento precisa estar ativo
  // (assumindo que foods inativos são filtrados na query)

  return true;
}

// =====================================================
// CÁLCULOS NUTRICIONAIS
// =====================================================

/**
 * Calcula nutrientes para uma quantidade em gramas
 */
export function calculateNutrients(food: Food, grams: number): NutrientValues {
  const baseGrams = parseServingGrams(food.serving_size);
  const multiplier = grams / baseGrams;
  
  return {
    calories: Math.round(food.calories * multiplier),
    protein: Math.round(food.protein * multiplier * 10) / 10,
    carbs: Math.round(food.carbs * multiplier * 10) / 10,
    fat: Math.round(food.fat * multiplier * 10) / 10,
  };
}

/**
 * Extrai gramas base do serving_size
 */
function parseServingGrams(servingSize: string): number {
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

/**
 * Calcula quantidade ajustada para manter calorias similares
 */
export function calculateAdjustedPortion(
  sourceFood: Food,
  sourceGrams: number,
  targetFood: Food
): number {
  const sourceNutrients = calculateNutrients(sourceFood, sourceGrams);
  const targetBaseGrams = parseServingGrams(targetFood.serving_size);
  
  // Calorias por grama do alimento alvo
  const caloriesPerGram = targetFood.calories / targetBaseGrams;
  
  if (caloriesPerGram <= 0) {
    return targetBaseGrams; // Fallback para porção padrão
  }
  
  // Gramas necessários para igualar calorias
  let targetGrams = sourceNutrients.calories / caloriesPerGram;
  
  // Arredondar para grama mais próximo
  targetGrams = Math.round(targetGrams);
  
  // Limitar a faixa razoável (10g - 500g)
  return Math.min(500, Math.max(10, targetGrams));
}

/**
 * Calcula diferença de macros entre origem e destino
 */
export function calculateDeltaMacros(
  sourceNutrients: NutrientValues,
  targetNutrients: NutrientValues
): DeltaMacros {
  return {
    calories: targetNutrients.calories - sourceNutrients.calories,
    protein: Math.round((targetNutrients.protein - sourceNutrients.protein) * 10) / 10,
    carbs: Math.round((targetNutrients.carbs - sourceNutrients.carbs) * 10) / 10,
    fat: Math.round((targetNutrients.fat - sourceNutrients.fat) * 10) / 10,
  };
}

// =====================================================
// SCORING DOS CANDIDATOS (INTELIGÊNCIA REAL)
// =====================================================

/**
 * Identifica o macro dominante de um alimento
 */
export function getDominantMacro(food: Food): 'protein' | 'carbs' | 'fat' {
  const baseGrams = parseServingGrams(food.serving_size);
  const proteinCals = (food.protein / baseGrams) * 4;
  const carbsCals = (food.carbs / baseGrams) * 4;
  const fatCals = (food.fat / baseGrams) * 9;
  
  if (proteinCals >= carbsCals && proteinCals >= fatCals) return 'protein';
  if (carbsCals >= proteinCals && carbsCals >= fatCals) return 'carbs';
  return 'fat';
}

/**
 * Calcula similaridade do macro dominante (0-1)
 */
function calculateMacroSimilarity(source: Food, target: Food): number {
  const sourceDominant = getDominantMacro(source);
  const targetDominant = getDominantMacro(target);
  
  // Macro dominante igual = score máximo
  if (sourceDominant === targetDominant) return 1;
  
  // Calcular proximidade dos valores normalizados
  const sourceBase = parseServingGrams(source.serving_size);
  const targetBase = parseServingGrams(target.serving_size);
  
  // Normalizar por 100g
  const sourceNorm = {
    protein: (source.protein / sourceBase) * 100,
    carbs: (source.carbs / sourceBase) * 100,
    fat: (source.fat / sourceBase) * 100,
  };
  const targetNorm = {
    protein: (target.protein / targetBase) * 100,
    carbs: (target.carbs / targetBase) * 100,
    fat: (target.fat / targetBase) * 100,
  };
  
  // Calcular distância euclidiana normalizada
  const diff = Math.sqrt(
    Math.pow(sourceNorm.protein - targetNorm.protein, 2) +
    Math.pow(sourceNorm.carbs - targetNorm.carbs, 2) +
    Math.pow(sourceNorm.fat - targetNorm.fat, 2)
  );
  
  // Converter para similaridade (max ~50 de diferença prática)
  return Math.max(0, 1 - diff / 50);
}

/**
 * Calcula similaridade de densidade calórica (0-1)
 */
function calculateCalorieDensitySimilarity(source: Food, target: Food): number {
  const sourceBase = parseServingGrams(source.serving_size);
  const targetBase = parseServingGrams(target.serving_size);
  
  const sourceDensity = source.calories / sourceBase;
  const targetDensity = target.calories / targetBase;
  
  if (sourceDensity === 0 && targetDensity === 0) return 1;
  if (sourceDensity === 0 || targetDensity === 0) return 0;
  
  const ratio = Math.min(sourceDensity, targetDensity) / Math.max(sourceDensity, targetDensity);
  return ratio;
}

/**
 * Calcula plausibilidade da porção resultante (0-1)
 */
function calculatePortionPlausibility(portionGrams: number): number {
  // Porções ideais: 50-200g
  // Aceitáveis: 30-300g
  // Extremas: <30g ou >300g
  
  if (portionGrams >= 50 && portionGrams <= 200) return 1;
  if (portionGrams >= 30 && portionGrams < 50) return 0.8;
  if (portionGrams > 200 && portionGrams <= 300) return 0.8;
  if (portionGrams < 30) return 0.4;
  if (portionGrams > 300) return 0.5;
  
  return 0.6;
}

/**
 * Calcula score total do candidato
 * score = macroSimilarity * 0.5 + calorieDensitySimilarity * 0.3 + portionPlausibility * 0.2
 */
export function scoreCandidate(
  source: Food,
  sourceGrams: number,
  candidate: Food
): SubstituteCandidate {
  const macroSimilarity = calculateMacroSimilarity(source, candidate);
  const calorieSimilarity = calculateCalorieDensitySimilarity(source, candidate);
  const newPortionGrams = calculateAdjustedPortion(source, sourceGrams, candidate);
  const portionPlausibility = calculatePortionPlausibility(newPortionGrams);
  
  const score = 
    macroSimilarity * 0.5 + 
    calorieSimilarity * 0.3 + 
    portionPlausibility * 0.2;
  
  const sourceNutrients = calculateNutrients(source, sourceGrams);
  const targetNutrients = calculateNutrients(candidate, newPortionGrams);
  const deltaMacros = calculateDeltaMacros(sourceNutrients, targetNutrients);
  
  // Determinar tipo de substituição
  const sourceDominant = getDominantMacro(source);
  const targetDominant = getDominantMacro(candidate);
  
  let substituteType: SubstituteType = 'equivalent_direct';
  let requiresRebalance = false;
  
  if (sourceDominant !== targetDominant) {
    substituteType = 'equivalent_functional';
    requiresRebalance = true;
  }
  
  // Se delta de calorias > 10%, requer rebalance
  if (Math.abs(deltaMacros.calories) > sourceNutrients.calories * 0.1) {
    requiresRebalance = true;
  }
  
  return {
    food: candidate,
    score,
    newPortionGrams,
    deltaMacros,
    requiresRebalance,
    substituteType,
  };
}

// =====================================================
// SERVIÇO PRINCIPAL
// =====================================================

/**
 * Busca e ordena candidatos para substituição
 * NÃO executa a substituição - apenas retorna proposta
 */
export function findSubstituteCandidates(
  sourceFood: Food,
  sourceGrams: number,
  availableFoods: Food[],
  options?: SubstituteOptions
): SubstituteCandidate[] {
  // Debug: verificar por que candidatos são rejeitados
  let rejectionStats = {
    sameId: 0,
    notSubstitutable: 0,
    differentCategory: 0,
  };
  
  // Normalizar categoria do source para comparação case-insensitive
  const normalizedSourceCategory = sourceFood.category?.toLowerCase().trim();
  
  // Filtrar candidatos válidos com logging detalhado
  const validCandidates = availableFoods.filter(food => {
    // Não pode ser o mesmo alimento
    if (food.id === sourceFood.id) {
      rejectionStats.sameId++;
      return false;
    }
    
    // Candidato precisa ser substituível
    const blockReason = getSubstitutionBlockReason(food);
    if (blockReason) {
      rejectionStats.notSubstitutable++;
      return false;
    }
    
    // Por padrão, mesma categoria é obrigatória (case-insensitive)
    if (!options?.allowCrossCategory) {
      const normalizedCandidateCategory = food.category?.toLowerCase().trim();
      if (normalizedCandidateCategory !== normalizedSourceCategory) {
        rejectionStats.differentCategory++;
        return false;
      }
    }
    
    return true;
  });
  
  console.log('[findSubstituteCandidates] Source:', sourceFood.name, 'category:', sourceFood.category);
  console.log('[findSubstituteCandidates] Available foods:', availableFoods.length);
  console.log('[findSubstituteCandidates] Rejection stats:', rejectionStats);
  console.log('[findSubstituteCandidates] Valid candidates:', validCandidates.length);
  
  if (validCandidates.length === 0) {
    // Log some examples of why foods were rejected
    const sampleFoods = availableFoods.slice(0, 5);
    console.log('[findSubstituteCandidates] Sample foods:');
    sampleFoods.forEach(f => {
      console.log(`  - ${f.name}: category=${f.category}, processing=${f.processing_level}, blockReason=${getSubstitutionBlockReason(f)}`);
    });
    return [];
  }
  
  // Calcular score para cada candidato
  const scoredCandidates = validCandidates.map(candidate => 
    scoreCandidate(sourceFood, sourceGrams, candidate)
  );
  
  // Ordenar por score decrescente
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  return scoredCandidates;
}

/**
 * Cria proposta de substituição para um candidato específico
 */
export function createSubstituteProposal(
  sourceFood: Food,
  sourceGrams: number,
  targetFood: Food,
  options?: SubstituteOptions
): SubstituteProposal {
  const candidate = scoreCandidate(sourceFood, sourceGrams, targetFood);
  const sourceNutrients = calculateNutrients(sourceFood, sourceGrams);
  const targetNutrients = calculateNutrients(targetFood, candidate.newPortionGrams);
  
  return {
    from: {
      food: sourceFood,
      portionGrams: sourceGrams,
      nutrients: sourceNutrients,
    },
    to: {
      food: targetFood,
      portionGrams: candidate.newPortionGrams,
      nutrients: targetNutrients,
    },
    deltaMacros: candidate.deltaMacros,
    requiresRebalance: candidate.requiresRebalance,
    substituteType: candidate.substituteType,
    score: candidate.score,
  };
}

/**
 * Serviço principal de substituição
 * Retorna proposta SEM EXECUTAR
 */
export function substituteItem(
  sourceFood: Food,
  sourceGrams: number,
  availableFoods: Food[],
  targetFoodId?: string,
  governanceContext?: GovernanceContext,
  options?: SubstituteOptions
): SubstituteResult {
  // 1. Validar gates de governança
  if (governanceContext) {
    const gateError = validateGovernanceGates(governanceContext, sourceFood);
    if (gateError) {
      return { success: false, error: gateError };
    }
  }
  
  // 2. Validar item de origem
  const blockReason = getSubstitutionBlockReason(sourceFood);
  if (blockReason) {
    return { success: false, error: blockReason };
  }
  
  // 3. Buscar candidatos
  const candidates = findSubstituteCandidates(
    sourceFood, 
    sourceGrams, 
    availableFoods, 
    options
  );
  
  if (candidates.length === 0) {
    return { success: false, error: 'NO_CANDIDATES', candidates: [] };
  }
  
  // 4. Se targetFoodId foi especificado, criar proposta para ele
  if (targetFoodId) {
    const targetCandidate = candidates.find(c => c.food.id === targetFoodId);
    
    if (!targetCandidate) {
      // Alimento não está na lista de candidatos válidos
      return { success: false, error: 'INVALID_CATEGORY', candidates };
    }
    
    const proposal = createSubstituteProposal(
      sourceFood,
      sourceGrams,
      targetCandidate.food,
      options
    );
    
    return { success: true, proposal, candidates };
  }
  
  // 5. Retornar lista de candidatos para seleção do usuário
  // Proposta será criada quando usuário selecionar
  const bestCandidate = candidates[0];
  const proposal = createSubstituteProposal(
    sourceFood,
    sourceGrams,
    bestCandidate.food,
    options
  );
  
  return { success: true, proposal, candidates };
}

// =====================================================
// HELPERS PARA UI
// =====================================================

/**
 * Formata mensagem de proposta para o usuário
 */
export function formatProposalMessage(proposal: SubstituteProposal): string {
  const { from, to, deltaMacros } = proposal;
  
  const calorieDiff = deltaMacros.calories > 0 
    ? `+${deltaMacros.calories}` 
    : `${deltaMacros.calories}`;
  
  return `Posso substituir "${from.food.name}" (${from.portionGrams}g) por "${to.food.name}" (${to.portionGrams}g). ` +
    `Impacto: ${calorieDiff} kcal. Deseja confirmar?`;
}

/**
 * Verifica se a proposta precisa de rebalanceamento
 */
export function needsRebalance(proposal: SubstituteProposal): boolean {
  return proposal.requiresRebalance;
}

/**
 * Retorna classificação de impacto da substituição
 */
export function getImpactLevel(proposal: SubstituteProposal): 'low' | 'medium' | 'high' {
  const { deltaMacros, from } = proposal;
  const calorieChange = Math.abs(deltaMacros.calories);
  const percentChange = (calorieChange / from.nutrients.calories) * 100;
  
  if (percentChange <= 5) return 'low';
  if (percentChange <= 15) return 'medium';
  return 'high';
}

/**
 * Retorna label amigável para o score de similaridade
 * Usado para mostrar feedback visual ao usuário
 */
export function getSimilarityLabel(score: number): { 
  label: string; 
  quality: 'excellent' | 'good' | 'fair' | 'acceptable' 
} {
  const percentage = Math.round(score * 100);
  
  if (percentage >= 90) {
    return { label: 'Excelente escolha', quality: 'excellent' };
  }
  if (percentage >= 75) {
    return { label: 'Ótima escolha', quality: 'good' };
  }
  if (percentage >= 60) {
    return { label: 'Boa opção', quality: 'fair' };
  }
  return { label: 'Opção viável', quality: 'acceptable' };
}
