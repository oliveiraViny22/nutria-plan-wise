// =====================================================
// TIPOS DE GOVERNANÇA DO REBALANCEADOR
// =====================================================
// Tipos para a política de uso do rebalanceador baseada
// na adesão do usuário ao plano alimentar.
//
// REGRAS DE GOVERNANÇA:
// 1. Adesão determina se o rebalanceador pode ser usado
// 2. O rebalanceador NUNCA é acionado automaticamente por baixa adesão
// 3. Backend é a ÚNICA fonte de decisão
// 4. Frontend e IA apenas CONSOMEM permissões
// =====================================================

/**
 * Classificação de adesão e suas permissões.
 * 
 * - Alta (>= 80%): Rebalanceamento completo permitido
 * - Média (50-79%): Apenas redistribuição e simplificação
 * - Baixa (< 50%): Rebalanceamento bloqueado
 */
export type AdherenceLevel = 'high' | 'medium' | 'low' | 'no_data';

/**
 * Limiares de adesão para classificação.
 */
export const ADHERENCE_THRESHOLDS = {
  HIGH: 80,    // >= 80% = Alta
  MEDIUM: 50,  // >= 50% = Média
  LOW: 0,      // < 50% = Baixa
} as const;

/**
 * Estratégias permitidas por nível de adesão.
 */
export type RebalanceStrategyType =
  | 'full_rebalance'          // Rebalanceamento completo com ajuste de macros
  | 'quantity_change'         // Apenas ajustes de quantidade
  | 'redistribute_meals'      // Redistribuição entre refeições
  | 'reduce_complexity'       // Simplificação de refeições
  | 'substitute_equivalent'   // Substituição por equivalente
  | 'add_option'              // Adicionar opção complementar
  | 'professional_guidance';  // Apenas orientação profissional

/**
 * Permissões de rebalanceamento baseadas em adesão.
 */
export interface AdherenceRebalancePermissions {
  /** Se o rebalanceador pode ser usado */
  canRebalance: boolean;
  
  /** Nível de adesão calculado */
  adherenceLevel: AdherenceLevel;
  
  /** Taxa de adesão em percentual */
  adherenceRate: number;
  
  /** Estratégias permitidas para este nível */
  allowedStrategies: RebalanceStrategyType[];
  
  /** Estratégias bloqueadas para este nível */
  blockedStrategies: RebalanceStrategyType[];
  
  /** Motivo do bloqueio (se houver) */
  blockReason?: string;
  
  /** Mensagem para o usuário */
  userMessage: string;
  
  /** Dias de dados analisados */
  periodDays: number;
  
  /** Total de refeições no período */
  totalMeals: number;
}

/**
 * Mapeamento de estratégias permitidas por nível de adesão.
 */
export const STRATEGIES_BY_ADHERENCE: Record<AdherenceLevel, RebalanceStrategyType[]> = {
  high: [
    'full_rebalance',
    'quantity_change',
    'redistribute_meals',
    'reduce_complexity',
    'substitute_equivalent',
    'add_option',
  ],
  medium: [
    'redistribute_meals',
    'reduce_complexity',
    'substitute_equivalent',
  ],
  low: [
    'professional_guidance',
  ],
  no_data: [
    'professional_guidance',
  ],
};

/**
 * Mensagens de usuário por nível de adesão.
 */
export const ADHERENCE_MESSAGES: Record<AdherenceLevel, string> = {
  high: 'Sua adesão está excelente! Todas as opções de otimização estão disponíveis.',
  medium: 'Adesão moderada. Focamos em ajustes simples para facilitar seu dia a dia.',
  low: 'Adesão baixa detectada. Recomendamos estabilizar sua rotina antes de ajustar o plano.',
  no_data: 'Sem dados suficientes de adesão. Registre algumas refeições primeiro.',
};

/**
 * Resultado completo da verificação de governança do rebalanceador.
 */
export interface RebalanceGovernanceResult {
  /** Permissões baseadas em adesão */
  permissions: AdherenceRebalancePermissions;
  
  /** Dados originais de adesão */
  adherenceMetrics: {
    confirmedMeals: number;
    skippedMeals: number;
    lateConfirmed: number;
    outOfPlan: number;
    totalDays: number;
  };
  
  /** Timestamp da verificação */
  checkedAt: string;
}

/**
 * Classifica o nível de adesão com base na taxa.
 */
export function classifyAdherenceLevel(rate: number, totalMeals: number): AdherenceLevel {
  if (totalMeals === 0) {
    return 'no_data';
  }
  
  if (rate >= ADHERENCE_THRESHOLDS.HIGH) {
    return 'high';
  }
  
  if (rate >= ADHERENCE_THRESHOLDS.MEDIUM) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Retorna as estratégias permitidas para um nível de adesão.
 */
export function getAllowedStrategies(level: AdherenceLevel): RebalanceStrategyType[] {
  return STRATEGIES_BY_ADHERENCE[level];
}

/**
 * Retorna as estratégias bloqueadas para um nível de adesão.
 */
export function getBlockedStrategies(level: AdherenceLevel): RebalanceStrategyType[] {
  const allStrategies: RebalanceStrategyType[] = [
    'full_rebalance',
    'quantity_change',
    'redistribute_meals',
    'reduce_complexity',
    'substitute_equivalent',
    'add_option',
    'professional_guidance',
  ];
  
  const allowed = STRATEGIES_BY_ADHERENCE[level];
  return allStrategies.filter(s => !allowed.includes(s));
}

/**
 * Gera o motivo de bloqueio para um nível de adesão.
 */
export function getBlockReason(level: AdherenceLevel): string | undefined {
  switch (level) {
    case 'low':
      return 'Adesão abaixo de 50%. Estabilize sua rotina alimentar antes de otimizar o plano.';
    case 'no_data':
      return 'Sem dados de adesão suficientes. Registre ao menos 3 dias de refeições.';
    default:
      return undefined;
  }
}

/**
 * Constrói as permissões de rebalanceamento baseadas na adesão.
 */
export function buildRebalancePermissions(
  adherenceRate: number,
  totalMeals: number,
  periodDays: number = 30
): AdherenceRebalancePermissions {
  const level = classifyAdherenceLevel(adherenceRate, totalMeals);
  const allowedStrategies = getAllowedStrategies(level);
  const blockedStrategies = getBlockedStrategies(level);
  const blockReason = getBlockReason(level);
  
  return {
    canRebalance: level === 'high' || level === 'medium',
    adherenceLevel: level,
    adherenceRate,
    allowedStrategies,
    blockedStrategies,
    blockReason,
    userMessage: ADHERENCE_MESSAGES[level],
    periodDays,
    totalMeals,
  };
}
