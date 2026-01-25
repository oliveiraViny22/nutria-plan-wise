// =====================================================
// REBALANCER V5 - ORQUESTRADOR PRINCIPAL
// =====================================================
// Coordena todos os módulos do rebalanceador.
// Implementa o fluxo do checklist técnico.
//
// FLUXO:
// 1. Pré-validação estrutural
// 2. Seleção de estratégia única
// 3. Planejamento de deltas
// 4. Execução dirigida
// 5. Validação final
// =====================================================

import {
  DietPlan,
  MacroTargets,
  RebalanceResult,
  RebalanceStatus,
  sumMacros,
  roundMacros,
} from './types';

import { preValidateStructure } from './pre-validation';
import { selectStrategy, isAlreadyBalanced } from './strategy-selector';
import { planDeltas } from './delta-planner';
import { executeAdjustments, applyAdjustmentsToItems } from './adjustment-executor';
import { validateFinalResult, isExactlyOnTarget, isWithinTolerances } from './final-validator';

// =====================================================
// FUNÇÃO PRINCIPAL
// =====================================================

/**
 * REBALANCE PLAN V5
 * 
 * Implementa o checklist técnico de refatoração:
 * 
 * ✅ Pré-validação obrigatória antes de mexer em qualquer alimento
 * ✅ Definição de estratégia única (decisão, não execução)
 * ✅ Plano de deltas (macro-first, não alimento-first)
 * ✅ Execução dirigida (uma única passada)
 * ✅ Validação final (sem surpresas)
 * 
 * PROIBIÇÕES ABSOLUTAS:
 * ❌ while, retry, re-run
 * ❌ ajustar alimento sem plano de delta
 * ❌ usar proteína para "fechar caloria"
 * ❌ descobrir erro só no final
 * ❌ rodar rebalanceador de novo automaticamente
 */
export function rebalancePlanV5(
  plan: DietPlan,
  targetMacros: MacroTargets
): RebalanceResult {
  const activeItems = plan.items.filter(item => item.isActive);
  const currentMacros = sumMacros(activeItems);
  
  // ========================================
  // ETAPA 1: PRÉ-VALIDAÇÃO ESTRUTURAL
  // Se falhar aqui → não tenta ajustar depois
  // ========================================
  
  const structuralValidation = preValidateStructure(activeItems, targetMacros);
  
  if (!structuralValidation.isValid) {
    return {
      status: 'blocked_structural',
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      adjustments: [],
      reason: structuralValidation.errors.join('; '),
      validationDetails: structuralValidation,
    };
  }
  
  // ========================================
  // ETAPA 2: VERIFICAR SE JÁ ESTÁ BALANCEADO
  // ========================================
  
  if (isAlreadyBalanced(currentMacros, targetMacros)) {
    return {
      status: 'balanced',
      plan: { ...plan, version: plan.version + 1 },
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      proposedMacros: roundMacros(currentMacros),
      adjustments: [],
    };
  }
  
  // ========================================
  // ETAPA 3: DEFINIR ESTRATÉGIA ÚNICA
  // Uma única estratégia por execução
  // ========================================
  
  const strategyContext = selectStrategy(currentMacros, targetMacros);
  
  if (strategyContext.strategy === 'STRUCTURALLY_BLOCKED') {
    return {
      status: 'blocked_structural',
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      adjustments: [],
      reason: strategyContext.reason,
      strategyContext,
    };
  }
  
  // ========================================
  // ETAPA 4: PLANEJAR DELTAS
  // Calcular antes de ajustar qualquer alimento
  // ========================================
  
  const plannedDeltas = planDeltas(currentMacros, targetMacros, strategyContext);
  
  if (!plannedDeltas.isViable) {
    return {
      status: 'blocked_structural',
      currentMacros: roundMacros(currentMacros),
      targetMacros: roundMacros(targetMacros),
      adjustments: [],
      reason: plannedDeltas.reason || 'Não foi possível planejar ajustes viáveis',
      strategyContext,
      plannedDeltas,
    };
  }
  
  // ========================================
  // ETAPA 5: EXECUTAR AJUSTES
  // Uma única passada, sem recalcular estratégia
  // ========================================
  
  const adjustments = executeAdjustments(activeItems, plannedDeltas, strategyContext);
  
  // Aplicar ajustes aos itens
  const adjustedItems = applyAdjustmentsToItems(activeItems, adjustments);
  const proposedMacros = sumMacros(adjustedItems);
  
  // ========================================
  // ETAPA 6: VALIDAÇÃO FINAL
  // Se inválido → falha controlada, não reexecutar
  // ========================================
  
  const finalValidation = validateFinalResult(proposedMacros, targetMacros);
  
  // Determinar status final
  let status: RebalanceStatus;
  let reason: string | undefined;
  
  if (isExactlyOnTarget(proposedMacros, targetMacros)) {
    status = 'balanced';
  } else if (finalValidation.isValid || adjustments.length > 0) {
    // Se passou na validação OU se temos ajustes, considerar como ajustado
    status = 'adjusted';
    if (!finalValidation.isValid) {
      reason = `Ajustes aplicados, mas macros fora da tolerância ideal: ${finalValidation.errors.join('; ')}`;
    }
  } else {
    // Falha controlada: não foi possível ajustar
    status = 'blocked_structural';
    reason = `Não foi possível ajustar as quantidades: ${finalValidation.errors.join('; ')}`;
  }
  
  // Construir resultado final
  const newPlan: DietPlan = {
    ...plan,
    items: adjustedItems,
    version: plan.version + 1,
  };
  
  return {
    status,
    plan: newPlan,
    currentMacros: roundMacros(currentMacros),
    targetMacros: roundMacros(targetMacros),
    proposedMacros: roundMacros(proposedMacros),
    adjustments,
    reason,
    strategyContext,
    plannedDeltas,
    validationDetails: finalValidation.isValid ? undefined : {
      isValid: false,
      errors: finalValidation.errors,
    },
  };
}

// =====================================================
// EXPORTS
// =====================================================

// Re-exportar tipos principais
export type {
  DietPlan,
  PlanItem,
  FoodItem,
  MacroTargets,
  RebalanceResult,
  RebalanceStatus,
  QuantityAdjustment,
  StrategyContext,
  PlannedDeltas,
} from './types';

export { sumMacros, roundMacros } from './types';

export { preValidateStructure } from './pre-validation';
export { selectStrategy, isAlreadyBalanced } from './strategy-selector';
export { planDeltas } from './delta-planner';
export { executeAdjustments, applyAdjustmentsToItems } from './adjustment-executor';
export { validateFinalResult, isExactlyOnTarget, isWithinTolerances } from './final-validator';
