// =====================================================
// SELETOR DE ESTRATÉGIA (CHECKLIST ITEM 2)
// =====================================================
// Determina UMA ÚNICA estratégia de rebalanceamento.
// REGRA: Nunca misturar estratégias na mesma execução.
// =====================================================

import {
  MacroTargets,
  MacroDeltas,
  GlobalMacroState,
  RebalanceStrategy,
  StrategyContext,
  calculateDeltas,
  classifyGlobalState,
  KCAL_PER_GRAM,
} from './types';

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

/**
 * Calcula o impacto calórico de ajustar um macro.
 */
function calorieImpact(macro: 'protein' | 'carbs' | 'fat', deltaGrams: number): number {
  return deltaGrams * KCAL_PER_GRAM[macro];
}

/**
 * Encontra o macro mais distante da meta.
 */
function findPrimaryDeficit(deltas: MacroDeltas): { macro: 'protein' | 'carbs' | 'fat'; delta: number } {
  const candidates: { macro: 'protein' | 'carbs' | 'fat'; delta: number }[] = [
    { macro: 'protein', delta: Math.abs(deltas.protein) },
    { macro: 'carbs', delta: Math.abs(deltas.carbs) },
    { macro: 'fat', delta: Math.abs(deltas.fat) },
  ];
  
  return candidates.reduce((max, current) => 
    current.delta > max.delta ? current : max
  );
}

// =====================================================
// REGRAS DE BLOQUEIO ESTRUTURAL
// =====================================================

interface BlockAnalysis {
  isBlocked: boolean;
  reason?: string;
}

/**
 * Verifica se o estado atual representa um bloqueio estrutural.
 */
function analyzeStructuralBlock(
  deltas: MacroDeltas,
  state: GlobalMacroState
): BlockAnalysis {
  // REGRA: Carbs e gordura ambos precisam subir
  if (state.carbs === 'deficit' && state.fat === 'deficit' && 
      deltas.carbs > 10 && deltas.fat > 5) {
    return {
      isBlocked: true,
      reason: 'Carboidrato e gordura precisam aumentar simultaneamente - estruturalmente impossível',
    };
  }
  
  // REGRA: Calorias precisam subir mas todos os macros estão ok/excesso
  if (state.calories === 'deficit' && 
      state.protein !== 'deficit' && 
      state.carbs !== 'deficit' && 
      state.fat !== 'deficit') {
    return {
      isBlocked: true,
      reason: 'Calorias insuficientes mas nenhum macro pode aumentar - estruturalmente impossível',
    };
  }
  
  // REGRA: Proteína precisa subir muito e calorias já estão no limite
  if (state.protein === 'deficit' && deltas.protein > 30 && 
      (state.calories === 'excess' || state.calories === 'on_target')) {
    return {
      isBlocked: true,
      reason: 'Proteína precisa aumentar significativamente mas calorias estão no limite',
    };
  }
  
  return { isBlocked: false };
}

// =====================================================
// FUNÇÃO PRINCIPAL DE SELEÇÃO
// =====================================================

/**
 * Determina a estratégia única de rebalanceamento.
 * 
 * REGRAS:
 * 1. Uma única estratégia por execução
 * 2. Baseado no macro mais distante da meta
 * 3. Considera impacto calórico esperado
 * 4. Salva contexto no snapshot para debug
 */
export function selectStrategy(
  current: MacroTargets,
  target: MacroTargets
): StrategyContext {
  const deltas = calculateDeltas(current, target);
  const state = classifyGlobalState(current, target);
  
  // 1️⃣ Verificar bloqueio estrutural
  const blockAnalysis = analyzeStructuralBlock(deltas, state);
  if (blockAnalysis.isBlocked) {
    return {
      strategy: 'STRUCTURALLY_BLOCKED',
      reason: blockAnalysis.reason!,
      primaryDeficit: 0,
      calorieImpact: 0,
    };
  }
  
  // 2️⃣ Verificar se calorias são o limitante principal
  const caloriePercent = target.calories > 0 ? (current.calories / target.calories) * 100 : 100;
  if (Math.abs(caloriePercent - 100) > 10) {
    // Calorias muito fora - limitar ajustes de macros
    return {
      strategy: 'CALORIE_CONSTRAINED',
      reason: `Calorias ${caloriePercent < 100 ? 'insuficientes' : 'excessivas'} (${caloriePercent.toFixed(0)}% da meta)`,
      primaryDeficit: Math.abs(deltas.calories),
      calorieImpact: deltas.calories,
    };
  }
  
  // 3️⃣ Encontrar macro primário (mais distante da meta)
  const primary = findPrimaryDeficit(deltas);
  
  // 4️⃣ Determinar estratégia baseada no macro primário
  let strategy: RebalanceStrategy;
  let reason: string;
  
  switch (primary.macro) {
    case 'protein':
      strategy = 'PROTEIN_PRIMARY';
      reason = deltas.protein > 0 
        ? `Proteína insuficiente: precisa +${Math.round(deltas.protein)}g`
        : `Proteína excessiva: precisa -${Math.round(Math.abs(deltas.protein))}g`;
      break;
      
    case 'carbs':
      strategy = 'CARB_PRIMARY';
      reason = deltas.carbs > 0
        ? `Carboidrato insuficiente: precisa +${Math.round(deltas.carbs)}g`
        : `Carboidrato excessivo: precisa -${Math.round(Math.abs(deltas.carbs))}g`;
      break;
      
    case 'fat':
      strategy = 'FAT_PRIMARY';
      reason = deltas.fat > 0
        ? `Gordura insuficiente: precisa +${Math.round(deltas.fat)}g`
        : `Gordura excessiva: precisa -${Math.round(Math.abs(deltas.fat))}g`;
      break;
  }
  
  return {
    strategy,
    reason,
    primaryDeficit: primary.delta,
    calorieImpact: calorieImpact(primary.macro, deltas[primary.macro]),
  };
}

/**
 * Verifica se todas as metas já foram atingidas.
 * CRÍTICO: Não confundir "já otimizado" com "não otimizável".
 */
export function isAlreadyBalanced(current: MacroTargets, target: MacroTargets): boolean {
  const state = classifyGlobalState(current, target);
  return (
    state.protein === 'on_target' &&
    state.carbs === 'on_target' &&
    state.fat === 'on_target' &&
    state.calories === 'on_target'
  );
}
