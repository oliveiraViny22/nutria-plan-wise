// =====================================================
// HOOK DO REBALANCEADOR HÍBRIDO
// =====================================================
// Este hook implementa o fluxo híbrido Backend + IA:
// 1. Backend tenta rebalanceamento
// 2. Se falha controlada → busca estratégias da IA
// 3. Usuário escolhe estratégia
// 4. Backend reexecuta com contexto da estratégia
// =====================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  rebalancePlan,
  propagateAdjustmentsToOptions,
  MacroTargets,
  DietPlan,
  PlanItem,
  FoodItem,
  RebalanceSnapshot,
  QuantityAdjustment,
  ControlledFailureDetails,
} from '@/lib/rebalancer-core';
import type {
  AIStrategy,
  AIStrategiesResponse,
  HybridRebalanceState,
  BackendRebalanceResult,
} from '@/lib/rebalancer-types';

// =====================================================
// TIPOS DE INTERFACE (para UI)
// =====================================================

export interface FoodAdjustment {
  mealOptionFoodId: string;
  mealId: string;
  mealOptionId: string;
  mealName: string;
  foodName: string;
  foodId: string;
  originalQuantity: number;
  newQuantity: number;
  isNewItem: boolean;
  macroChange: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
}

export interface RebalanceProposal {
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros: MacroTargets;
  adjustments: FoodAdjustment[];
  supplementsAdded: FoodAdjustment[];
  deficits: {
    protein: number;
    carbs: number;
    fat: number;
  };
  supplementNeeds: { type: 'protein' | 'carbs' | 'fat'; deficitGrams: number; message: string }[];
  isValid: boolean;
  validationErrors: string[];
  // NOVO: Indicador de falha controlada
  controlledFailure?: ControlledFailureDetails;
}

// Re-export types
export type { MacroTargets } from '@/lib/rebalancer-core';
export type { AIStrategy, AIStrategiesResponse, HybridRebalanceState } from '@/lib/rebalancer-types';

// =====================================================
// FUNÇÕES DE TRANSFORMAÇÃO (do hook original)
// =====================================================

interface DBFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string | null;
  category: string | null;
  processing_level: string | null;
}

interface DBMealOptionFood {
  id: string;
  meal_option_id: string;
  food_id: string;
  quantity_grams: number;
  food: DBFood;
}

interface DBMealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  meal_option_foods: DBMealOptionFood[];
}

interface DBMeal {
  id: string;
  name: string;
  diet_plan_id: string;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  meal_options: DBMealOption[];
}

function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

const MEAL_NAME_MAP: Record<string, string> = {
  breakfast: 'Café da Manhã',
  morning_snack: 'Lanche da Manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da Tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
};

function transformToCorePlan(meals: DBMeal[], planId: string): DietPlan {
  const items: PlanItem[] = [];

  for (const meal of meals) {
    const sortedOptions = [...(meal.meal_options || [])].sort(
      (a, b) => a.option_number - b.option_number
    );

    for (const option of sortedOptions) {
      for (const mof of option.meal_option_foods || []) {
        const dbFood = mof.food;
        
        const food: FoodItem = {
          id: dbFood.id,
          name: dbFood.name,
          calories: dbFood.calories,
          protein: dbFood.protein,
          carbs: dbFood.carbs,
          fat: dbFood.fat,
          category: dbFood.category,
          servingGrams: parseServingGrams(dbFood.serving_size),
        };

        items.push({
          id: mof.id,
          mealId: meal.id,
          mealName: MEAL_NAME_MAP[meal.name] || meal.name,
          optionId: option.id,
          optionNumber: option.option_number,
          food,
          quantityGrams: mof.quantity_grams,
          isActive: true,
        });
      }
    }
  }

  return { id: planId, items, version: 1 };
}

function transformToUIAdjustments(adjustments: QuantityAdjustment[]): FoodAdjustment[] {
  return adjustments.map(adj => ({
    mealOptionFoodId: adj.itemId,
    mealId: adj.mealId,
    mealOptionId: adj.optionId,
    mealName: adj.mealName,
    foodName: adj.foodName,
    foodId: adj.foodId,
    originalQuantity: Math.round(adj.originalGrams),
    newQuantity: Math.round(adj.newGrams),
    isNewItem: false,
    macroChange: {
      protein: Math.round(adj.macroDelta.protein),
      carbs: Math.round(adj.macroDelta.carbs),
      fat: Math.round(adj.macroDelta.fat),
      calories: Math.round(adj.macroDelta.calories),
    },
  }));
}

function transformToProposal(
  snapshot: RebalanceSnapshot,
  allItems: PlanItem[]
): RebalanceProposal {
  const allAdjustments = propagateAdjustmentsToOptions(snapshot.adjustments, allItems);
  const firstOptionAdjustments = allAdjustments.filter(adj => {
    const item = allItems.find(i => i.id === adj.itemId);
    return item?.optionNumber === 1;
  });

  return {
    currentMacros: snapshot.currentMacros,
    targetMacros: snapshot.targetMacros,
    proposedMacros: snapshot.proposedMacros,
    adjustments: transformToUIAdjustments(firstOptionAdjustments),
    supplementsAdded: [],
    deficits: {
      protein: snapshot.supplementNeeds.find(s => s.type === 'protein')?.deficitGrams || 0,
      carbs: snapshot.supplementNeeds.find(s => s.type === 'carbs')?.deficitGrams || 0,
      fat: snapshot.supplementNeeds.find(s => s.type === 'fat')?.deficitGrams || 0,
    },
    supplementNeeds: snapshot.supplementNeeds,
    isValid: snapshot.isValid,
    validationErrors: snapshot.validationErrors,
    controlledFailure: snapshot.controlledFailure,
  };
}

// =====================================================
// HOOK PRINCIPAL HÍBRIDO
// =====================================================

export function useHybridRebalancer() {
  const { user } = useAuth();
  const [state, setState] = useState<HybridRebalanceState>({ phase: 'idle' });
  const [proposal, setProposal] = useState<RebalanceProposal | null>(null);
  const [corePlan, setCorePlan] = useState<DietPlan | null>(null);
  const [strategies, setStrategies] = useState<AIStrategiesResponse | null>(null);

  /**
   * PASSO 1: Tenta rebalanceamento via backend puro.
   * Se falha controlada, sinaliza para buscar estratégias.
   */
  const calculateProposal = useCallback(async (
    planId: string,
    targets: MacroTargets
  ): Promise<RebalanceProposal | null> => {
    setState({ phase: 'calculating', progress: 'Analisando plano...' });
    
    try {
      // Buscar refeições do banco
      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          diet_plan_id,
          total_calories,
          total_protein,
          total_carbs,
          total_fat,
          meal_options (
            id,
            meal_id,
            option_number,
            name,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            meal_option_foods (
              id,
              meal_option_id,
              food_id,
              quantity_grams,
              food:foods (*)
            )
          )
        `)
        .eq('diet_plan_id', planId);

      if (mealsError) throw mealsError;

      const typedMeals = (meals || []) as unknown as DBMeal[];
      const plan = transformToCorePlan(typedMeals, planId);
      setCorePlan(plan);

      // Chamar função pura de rebalanceamento
      const snapshot = rebalancePlan(plan, targets, {
        tolerancePercent: 2,
        maxAdjustmentPercent: 0.75,
        minQuantityGrams: 10,
        allowSupplements: true,
      });

      const result = transformToProposal(snapshot, plan.items);
      setProposal(result);

      // Verificar se houve falha controlada
      if (snapshot.controlledFailure) {
        setState({ 
          phase: 'failure_controlled', 
          failure: snapshot.controlledFailure 
        });
        
        // Mostrar toast informativo
        toast.info('O rebalanceamento automático encontrou limitações. Estratégias alternativas estão disponíveis.');
      } else if (result.isValid) {
        setState({ phase: 'success', result: { 
          success: true,
          currentMacros: result.currentMacros,
          targetMacros: result.targetMacros,
          proposedMacros: result.proposedMacros,
          adjustments: snapshot.adjustments.map(a => ({
            itemId: a.itemId,
            mealId: a.mealId,
            mealName: a.mealName,
            optionId: a.optionId,
            foodId: a.foodId,
            foodName: a.foodName,
            originalGrams: a.originalGrams,
            newGrams: a.newGrams,
            macroDelta: a.macroDelta,
            reason: a.reason,
          })),
          isValid: true,
          validationErrors: [],
          supplementNeeds: snapshot.supplementNeeds,
        }});
      } else {
        setState({ phase: 'error', message: result.validationErrors.join(', ') });
      }
      
      return result;
    } catch (error: unknown) {
      console.error('Error calculating rebalance proposal:', error);
      const message = error instanceof Error ? error.message : 'Erro ao calcular otimização de macros';
      setState({ phase: 'error', message });
      toast.error(message);
      return null;
    }
  }, []);

  /**
   * PASSO 2: Busca estratégias da IA (só chamado em falha controlada).
   */
  const fetchStrategies = useCallback(async (
    planId: string,
    failure: ControlledFailureDetails
  ): Promise<AIStrategiesResponse | null> => {
    if (!corePlan) return null;
    
    setState({ phase: 'fetching_strategies' });
    
    try {
      // Preparar dados das refeições para a IA
      const currentMeals = corePlan.items
        .filter(item => item.optionNumber === 1)
        .reduce((acc, item) => {
          const existing = acc.find(m => m.id === item.mealId);
          if (existing) {
            existing.foods.push({
              name: item.food.name,
              category: item.food.category || 'outros',
              grams: item.quantityGrams,
            });
          } else {
            acc.push({
              id: item.mealId,
              name: item.mealName,
              foods: [{
                name: item.food.name,
                category: item.food.category || 'outros',
                grams: item.quantityGrams,
              }],
            });
          }
          return acc;
        }, [] as { id: string; name: string; foods: { name: string; category: string; grams: number }[] }[]);

      const { data, error } = await supabase.functions.invoke('rebalance-strategies', {
        body: {
          plan_id: planId,
          failure_details: failure,
          current_meals: currentMeals,
          allow_supplements: true,
        },
      });

      if (error) throw error;

      const strategiesResponse = data as AIStrategiesResponse;
      setStrategies(strategiesResponse);
      setState({ phase: 'strategy_selection', strategies: strategiesResponse });
      
      return strategiesResponse;
    } catch (error) {
      console.error('Error fetching strategies:', error);
      toast.error('Erro ao buscar estratégias alternativas');
      setState({ phase: 'error', message: 'Erro ao buscar estratégias' });
      return null;
    }
  }, [corePlan]);

  /**
   * PASSO 3: Executa estratégia escolhida (backend reexecuta).
   * A IA não participa da execução.
   */
  const executeStrategy = useCallback(async (
    planId: string,
    strategy: AIStrategy,
    targets: MacroTargets
  ): Promise<boolean> => {
    setState({ phase: 'executing_strategy', strategy: strategy.type });
    
    try {
      // Aplicar contexto da estratégia e recalcular
      // O backend aplica a estratégia internamente
      const { data, error } = await supabase.functions.invoke('rebalance-meal-plan', {
        body: {
          plan_id: planId,
          execute: true,
          strategy_context: {
            type: strategy.type,
            targetMeals: strategy.targetMeals,
            targetCategories: strategy.targetCategories,
            allowSupplement: strategy.requiresSupplement,
          },
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Plano otimizado com a estratégia selecionada!');
        setState({ phase: 'idle' });
        return true;
      } else {
        toast.error(data.justification || 'Estratégia não pôde ser aplicada');
        setState({ phase: 'error', message: data.justification || 'Falha na execução' });
        return false;
      }
    } catch (error) {
      console.error('Error executing strategy:', error);
      toast.error('Erro ao executar estratégia');
      setState({ phase: 'error', message: 'Erro ao executar estratégia' });
      return false;
    }
  }, []);

  /**
   * Aplica a proposta de rebalanceamento no banco.
   * Só persiste após confirmação do usuário.
   */
  const applyProposal = useCallback(async (planId: string): Promise<boolean> => {
    if (!proposal || !corePlan) return false;

    if (!proposal.isValid) {
      toast.error('Proposta inválida: ' + proposal.validationErrors.join(', '));
      return false;
    }

    setState({ phase: 'calculating', progress: 'Aplicando alterações...' });
    
    try {
      const snapshot = rebalancePlan(corePlan, proposal.targetMacros, {
        tolerancePercent: 2,
        maxAdjustmentPercent: 0.75,
        minQuantityGrams: 10,
        allowSupplements: true,
      });
      
      const allAdjustments = propagateAdjustmentsToOptions(snapshot.adjustments, corePlan.items);

      // Aplicar ajustes de quantidade no banco
      for (const adj of allAdjustments) {
        await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: Math.round(adj.newGrams) })
          .eq('id', adj.itemId);
      }

      // Recalcular totais das opções afetadas
      const affectedOptionIds = new Set(allAdjustments.map(a => a.optionId));

      for (const optionId of affectedOptionIds) {
        const { data: optionFoods } = await supabase
          .from('meal_option_foods')
          .select('quantity_grams, food:foods(*)')
          .eq('meal_option_id', optionId);

        let optionCalories = 0;
        let optionProtein = 0;
        let optionCarbs = 0;
        let optionFat = 0;

        if (optionFoods) {
          for (const mof of optionFoods) {
            const food = mof.food as DBFood;
            const qty = mof.quantity_grams;
            const baseGrams = parseServingGrams(food.serving_size);
            const multiplier = qty / baseGrams;
            
            optionCalories += food.calories * multiplier;
            optionProtein += food.protein * multiplier;
            optionCarbs += food.carbs * multiplier;
            optionFat += food.fat * multiplier;
          }
        }

        await supabase
          .from('meal_options')
          .update({
            total_calories: Math.round(optionCalories),
            total_protein: Math.round(optionProtein),
            total_carbs: Math.round(optionCarbs),
            total_fat: Math.round(optionFat),
          })
          .eq('id', optionId);
      }

      // Recalcular totais das refeições e plano
      const affectedMealIds = new Set(allAdjustments.map(a => a.mealId));

      for (const mealId of affectedMealIds) {
        const { data: mealOptions } = await supabase
          .from('meal_options')
          .select('*')
          .eq('meal_id', mealId)
          .order('option_number')
          .limit(1);

        if (mealOptions && mealOptions.length > 0) {
          const firstOption = mealOptions[0];
          await supabase
            .from('meals')
            .update({
              total_calories: firstOption.total_calories,
              total_protein: firstOption.total_protein,
              total_carbs: firstOption.total_carbs,
              total_fat: firstOption.total_fat,
            })
            .eq('id', mealId);
        }
      }

      // Recalcular totais do plano
      const { data: allMeals } = await supabase
        .from('meals')
        .select('*')
        .eq('diet_plan_id', planId);

      let planCalories = 0;
      let planProtein = 0;
      let planCarbs = 0;
      let planFat = 0;

      if (allMeals) {
        for (const m of allMeals) {
          planCalories += m.total_calories || 0;
          planProtein += m.total_protein || 0;
          planCarbs += m.total_carbs || 0;
          planFat += m.total_fat || 0;
        }
      }

      await supabase
        .from('diet_plans')
        .update({
          total_calories: Math.round(planCalories),
          total_protein: Math.round(planProtein),
          total_carbs: Math.round(planCarbs),
          total_fat: Math.round(planFat),
        })
        .eq('id', planId);

      // Incrementar uso de ajuste
      if (user?.id) {
        await supabase.rpc('increment_usage', {
          _user_id: user.id,
          _feature: 'adjustment',
        });
      }

      setProposal(null);
      setCorePlan(null);
      setStrategies(null);
      setState({ phase: 'idle' });
      toast.success('Plano otimizado com sucesso!');
      return true;
    } catch (error: unknown) {
      console.error('Error applying rebalance:', error);
      toast.error('Erro ao aplicar otimização');
      setState({ phase: 'error', message: 'Erro ao aplicar' });
      return false;
    }
  }, [proposal, corePlan, user?.id]);

  /**
   * Limpa o estado do hook.
   */
  const clearState = useCallback(() => {
    setProposal(null);
    setCorePlan(null);
    setStrategies(null);
    setState({ phase: 'idle' });
  }, []);

  return {
    // Estado
    state,
    proposal,
    strategies,
    
    // Ações
    calculateProposal,
    fetchStrategies,
    executeStrategy,
    applyProposal,
    clearState,
    
    // Helpers
    isLoading: state.phase === 'calculating' || 
               state.phase === 'fetching_strategies' || 
               state.phase === 'executing_strategy',
    hasControlledFailure: state.phase === 'failure_controlled',
    hasStrategies: state.phase === 'strategy_selection',
  };
}

// =====================================================
// EXPORT DO HOOK ORIGINAL PARA COMPATIBILIDADE
// =====================================================
export { useMacroRebalancer } from './useMacroRebalancer';
