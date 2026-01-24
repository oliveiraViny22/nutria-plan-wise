// =====================================================
// HOOK DO REBALANCEADOR V4 - CAMADA DE INTEGRAÇÃO
// =====================================================
// Conecta o rebalancer-v4 puro com React e Supabase.
//
// CONTRATO:
// - Busca dados do banco
// - Transforma para formato do core
// - Chama função pura rebalancePlanV4
// - Persiste resultados se aprovado
// =====================================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  rebalancePlanV4,
  RebalanceResult,
  RebalanceStatus,
  DietPlan,
  PlanItem,
  FoodItem,
  MacroTargets,
  QuantityAdjustment,
} from '@/lib/rebalancer-v4';

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
  reason: string;
}

export interface RebalanceProposalV4 {
  status: RebalanceStatus;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros?: MacroTargets;
  adjustments: FoodAdjustment[];
  reason?: string;
  validationErrors: string[];
}

// Re-export types
export type { MacroTargets, RebalanceStatus } from '@/lib/rebalancer-v4';

// =====================================================
// FUNÇÕES DE TRANSFORMAÇÃO
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
  meal_option_foods: DBMealOptionFood[];
}

interface DBMeal {
  id: string;
  name: string;
  diet_plan_id: string;
  meal_options: DBMealOption[];
}

/**
 * Parse serving_size para extrair gramas base.
 */
function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

/**
 * Transforma dados do banco para o formato do core.
 */
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
          mealName: meal.name,
          optionId: option.id,
          optionNumber: option.option_number,
          food,
          quantityGrams: mof.quantity_grams,
          isActive: true,
        });
      }
    }
  }

  return {
    id: planId,
    items,
    version: 1,
  };
}

/**
 * Transforma ajustes do core para o formato da UI.
 */
function transformToUIAdjustments(
  adjustments: QuantityAdjustment[]
): FoodAdjustment[] {
  return adjustments.map(adj => ({
    mealOptionFoodId: adj.itemId,
    mealId: adj.mealId,
    mealOptionId: adj.optionId,
    mealName: adj.mealName,
    foodName: adj.foodName,
    foodId: adj.foodId,
    originalQuantity: adj.originalGrams,
    newQuantity: adj.newGrams,
    reason: adj.reason,
  }));
}

/**
 * Transforma resultado do core para o formato da UI.
 */
function transformToProposal(result: RebalanceResult): RebalanceProposalV4 {
  return {
    status: result.status,
    currentMacros: result.currentMacros,
    targetMacros: result.targetMacros,
    proposedMacros: result.proposedMacros,
    adjustments: transformToUIAdjustments(result.adjustments),
    reason: result.reason,
    validationErrors: result.validationDetails?.errors || [],
  };
}

/**
 * Propaga ajustes para todas as opções de uma refeição.
 * Apenas primeira opção é calculada, outras recebem proporcional.
 */
function propagateAdjustments(
  adjustments: QuantityAdjustment[],
  allItems: PlanItem[]
): QuantityAdjustment[] {
  const propagated: QuantityAdjustment[] = [...adjustments];
  
  for (const adj of adjustments) {
    // Encontrar item original
    const originalItem = allItems.find(i => i.id === adj.itemId);
    if (!originalItem) continue;
    
    // Encontrar itens com o mesmo alimento em outras opções da mesma refeição
    const equivalentItems = allItems.filter(item =>
      item.mealId === originalItem.mealId &&
      item.food.id === originalItem.food.id &&
      item.optionNumber !== originalItem.optionNumber &&
      item.isActive
    );
    
    for (const eqItem of equivalentItems) {
      // Calcular proporção e aplicar o mesmo ajuste proporcional
      const ratio = adj.newGrams / adj.originalGrams;
      const newGrams = Math.round(eqItem.quantityGrams * ratio);
      
      // Verificar se já não foi adicionado
      if (!propagated.some(p => p.itemId === eqItem.id)) {
        propagated.push({
          itemId: eqItem.id,
          mealId: eqItem.mealId,
          mealName: eqItem.mealName,
          optionId: eqItem.optionId,
          foodId: eqItem.food.id,
          foodName: eqItem.food.name,
          originalGrams: eqItem.quantityGrams,
          newGrams,
          reason: `Propagado de opção ${originalItem.optionNumber}`,
        });
      }
    }
  }
  
  return propagated;
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useRebalancerV4() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<RebalanceProposalV4 | null>(null);
  const [corePlan, setCorePlan] = useState<DietPlan | null>(null);

  /**
   * Calcula uma proposta de rebalanceamento.
   * NÃO persiste nada - apenas calcula.
   */
  const calculateProposal = async (
    planId: string,
    targets: MacroTargets
  ): Promise<RebalanceProposalV4 | null> => {
    setLoading(true);
    try {
      // Buscar refeições do banco
      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          diet_plan_id,
          meal_options (
            id,
            meal_id,
            option_number,
            name,
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

      // Transformar para formato do core
      const plan = transformToCorePlan(typedMeals, planId);
      setCorePlan(plan);

      // Chamar função pura de rebalanceamento V4
      const result = rebalancePlanV4(plan, targets);

      // Transformar para formato da UI
      const uiProposal = transformToProposal(result);
      setProposal(uiProposal);
      
      return uiProposal;
    } catch (error: unknown) {
      console.error('Error calculating rebalance proposal:', error);
      toast.error('Erro ao calcular otimização de macros');
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Aplica a proposta de rebalanceamento no banco.
   * Só persiste após confirmação do usuário.
   */
  const applyProposal = async (planId: string): Promise<boolean> => {
    if (!proposal || !corePlan) return false;

    // Validar antes de aplicar
    if (proposal.status === 'blocked_structural') {
      toast.error('Não é possível aplicar: ' + proposal.reason);
      return false;
    }

    if (proposal.status === 'balanced') {
      toast.info('Plano já está otimizado!');
      return true;
    }

    setLoading(true);
    try {
      // Recalcular resultado para pegar ajustes atualizados
      const result = rebalancePlanV4(corePlan, proposal.targetMacros);
      
      if (result.status !== 'adjusted') {
        toast.error('Estado inconsistente: plano não pode ser ajustado');
        return false;
      }

      // Propagar ajustes para todas as opções
      const allAdjustments = propagateAdjustments(result.adjustments, corePlan.items);

      // Aplicar ajustes de quantidade no banco
      for (const adj of allAdjustments) {
        await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: adj.newGrams })
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

      // Recalcular totais das refeições (usando primeira opção)
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
      toast.success('Plano otimizado com sucesso!');
      return true;
    } catch (error: unknown) {
      console.error('Error applying rebalance:', error);
      toast.error('Erro ao aplicar otimização');
      return false;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Limpa a proposta atual.
   */
  const clearProposal = () => {
    setProposal(null);
    setCorePlan(null);
  };

  return {
    loading,
    proposal,
    calculateProposal,
    applyProposal,
    clearProposal,
  };
}
