// =====================================================
// TIPOS DO SISTEMA HÍBRIDO DE REBALANCEAMENTO
// =====================================================
// Tipos compartilhados entre frontend e backend para
// o fluxo híbrido Backend + IA.
// =====================================================

/**
 * Resultado do rebalanceamento do backend.
 * Pode ser sucesso total, sucesso parcial, ou falha controlada.
 */
export interface BackendRebalanceResult {
  success: boolean;
  
  // Macros calculados
  currentMacros: MacroSnapshot;
  targetMacros: MacroSnapshot;
  proposedMacros: MacroSnapshot;
  
  // Ajustes propostos (se sucesso ou parcial)
  adjustments: PortionAdjustment[];
  
  // Indicadores de falha controlada
  failureReason?: ControlledFailureReason;
  failureDetails?: ControlledFailureDetails;
  
  // Validação
  isValid: boolean;
  validationErrors: string[];
  
  // Necessidades não atendidas
  supplementNeeds: SupplementNeed[];
}

export interface MacroSnapshot {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface PortionAdjustment {
  itemId: string;
  mealId: string;
  mealName: string;
  optionId: string;
  foodId: string;
  foodName: string;
  originalGrams: number;
  newGrams: number;
  macroDelta: MacroSnapshot;
  reason: string;
}

export interface SupplementNeed {
  type: 'protein' | 'carbs' | 'fat';
  deficitGrams: number;
  message: string;
}

// =====================================================
// TIPOS DE FALHA CONTROLADA
// =====================================================

/**
 * Razões possíveis para falha controlada do backend.
 * Só estas razões acionam a IA.
 */
export type ControlledFailureReason = 
  | 'calorie_protein_impossible'  // Não é possível atingir calorias E proteína
  | 'macro_distribution_blocked'  // Distribuição de macros bloqueada por regras
  | 'insufficient_food_variety';  // Alimentos disponíveis não permitem ajuste

export interface ControlledFailureDetails {
  reason: ControlledFailureReason;
  
  // Déficits que não puderam ser corrigidos
  proteinGap: number;      // Diferença de proteína não resolvida
  calorieGap: number;      // Diferença de calorias não resolvida
  
  // Contexto para a IA
  blockedBy: string[];     // Quais regras bloquearam o ajuste
  attemptedAdjustments: number; // Quantos ajustes foram tentados
  
  // Mensagem explicativa para o usuário
  userMessage: string;
}

// =====================================================
// TIPOS DE ESTRATÉGIA DA IA
// =====================================================

/**
 * Estratégias que a IA pode sugerir.
 * NUNCA incluem valores numéricos finais.
 */
export type AIStrategyType = 
  | 'redistribute_meals'       // Redistribuir alimentos entre refeições
  | 'substitute_within_category' // Substituir por equivalente na mesma categoria
  | 'add_complementary_option' // Criar opção complementar (com ou sem suplemento)
  | 'reduce_meal_complexity'   // Simplificar refeições
  | 'adjust_meal_timing'       // Ajustar horários/distribuição
  | 'professional_guidance';   // Requer acompanhamento profissional

export interface AIStrategy {
  type: AIStrategyType;
  
  // Descrição em linguagem simples
  title: string;
  description: string;
  
  // Contexto da estratégia (sem valores finais)
  targetMeals?: string[];      // Quais refeições seriam afetadas
  targetCategories?: string[]; // Quais categorias de alimentos
  
  // Flags
  requiresSupplement: boolean;
  requiresProfessional: boolean;
  
  // Impacto esperado (qualitativo, não quantitativo)
  expectedImpact: 'low' | 'medium' | 'high';
  
  // Riscos ou considerações
  considerations: string[];
}

export interface AIStrategiesResponse {
  // Análise do motivo da falha
  failureAnalysis: string;
  
  // Estratégias sugeridas (ordenadas por relevância)
  strategies: AIStrategy[];
  
  // Se nenhuma estratégia é viável
  noViableStrategy: boolean;
  noViableReason?: string;
  
  // Recomendação geral
  recommendation: string;
}

// =====================================================
// TIPOS DE EXECUÇÃO PÓS-ESTRATÉGIA
// =====================================================

/**
 * Requisição para reexecutar o rebalanceador após escolha de estratégia.
 */
export interface StrategyExecutionRequest {
  planId: string;
  chosenStrategy: AIStrategyType;
  
  // Contexto adicional baseado na estratégia
  targetMealIds?: string[];
  substitutionHints?: {
    fromFoodId: string;
    toCategory: string;
  }[];
  
  // Se o usuário aprovou suplemento
  allowSupplement: boolean;
}

/**
 * Estado do fluxo híbrido no frontend.
 */
export type HybridRebalanceState = 
  | { phase: 'idle' }
  | { phase: 'calculating'; progress: string }
  | { phase: 'success'; result: BackendRebalanceResult }
  | { phase: 'failure_controlled'; failure: ControlledFailureDetails; strategies?: AIStrategiesResponse }
  | { phase: 'fetching_strategies' }
  | { phase: 'strategy_selection'; strategies: AIStrategiesResponse }
  | { phase: 'executing_strategy'; strategy: AIStrategyType }
  | { phase: 'error'; message: string };
