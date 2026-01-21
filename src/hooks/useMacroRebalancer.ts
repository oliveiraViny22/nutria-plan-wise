// =====================================================
// HOOK DO REBALANCEADOR - CAMADA DE INTEGRAÇÃO
// =====================================================
// Este hook conecta a camada de domínio pura (rebalancer-core)
// com o React e o Supabase.
//
// RESPONSABILIDADES:
// 1. Buscar dados do banco
// 2. Transformar para o formato do core
// 3. Chamar a função pura de rebalanceamento
// 4. Persistir resultados no banco
// =====================================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  SupplementNeed,
} from '@/lib/rebalancer-core';

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
  supplementNeeds: SupplementNeed[];
  isValid: boolean;
  validationErrors: string[];
}

// Re-export types
export type { MacroTargets } from '@/lib/rebalancer-core';

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
  
  const mealNameMap: Record<string, string> = {
    breakfast: 'Café da Manhã',
    morning_snack: 'Lanche da Manhã',
    lunch: 'Almoço',
    afternoon_snack: 'Lanche da Tarde',
    dinner: 'Jantar',
    supper: 'Ceia',
  };

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
          mealName: mealNameMap[meal.name] || meal.name,
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

/**
 * Transforma snapshot do core para o formato da UI.
 */
function transformToProposal(
  snapshot: RebalanceSnapshot,
  allItems: PlanItem[]
): RebalanceProposal {
  // Propagar ajustes para todas as opções equivalentes
  const allAdjustments = propagateAdjustmentsToOptions(snapshot.adjustments, allItems);
  
  // Filtrar apenas ajustes da primeira opção para exibição principal
  const firstOptionAdjustments = allAdjustments.filter(adj => {
    const item = allItems.find(i => i.id === adj.itemId);
    return item?.optionNumber === 1;
  });

  return {
    currentMacros: snapshot.currentMacros,
    targetMacros: snapshot.targetMacros,
    proposedMacros: snapshot.proposedMacros,
    adjustments: transformToUIAdjustments(firstOptionAdjustments),
    supplementsAdded: [], // Suplementos são apenas sinalizados, não adicionados
    deficits: {
      protein: snapshot.supplementNeeds.find(s => s.type === 'protein')?.deficitGrams || 0,
      carbs: snapshot.supplementNeeds.find(s => s.type === 'carbs')?.deficitGrams || 0,
      fat: snapshot.supplementNeeds.find(s => s.type === 'fat')?.deficitGrams || 0,
    },
    supplementNeeds: snapshot.supplementNeeds,
    isValid: snapshot.isValid,
    validationErrors: snapshot.validationErrors,
  };
}

// =====================================================
// HOOK PRINCIPAL
// =====================================================

export function useMacroRebalancer() {
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<RebalanceProposal | null>(null);
  const [corePlan, setCorePlan] = useState<DietPlan | null>(null);

  /**
   * Calcula uma proposta de rebalanceamento.
   * NÃO persiste nada - apenas calcula.
   */
  const calculateProposal = async (
    planId: string,
    targets: MacroTargets
  ): Promise<RebalanceProposal | null> => {
    setLoading(true);
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

      // Transformar para formato do core
      const plan = transformToCorePlan(typedMeals, planId);
      setCorePlan(plan);

      // Chamar função pura de rebalanceamento
      const snapshot = rebalancePlan(plan, targets, {
        tolerancePercent: 2,
        maxAdjustmentPercent: 0.5,
        minQuantityGrams: 10,
        allowSupplements: true,
      });

      // Transformar para formato da UI
      const result = transformToProposal(snapshot, plan.items);
      setProposal(result);
      
      return result;
    } catch (error: unknown) {
      console.error('Error calculating rebalance proposal:', error);
      
      // Tratar erro de governança especificamente
      if (error instanceof Error && error.name === 'GovernanceError') {
        toast.error(error.message);
      } else {
        toast.error('Erro ao calcular otimização de macros');
      }
      
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
    if (!proposal.isValid) {
      toast.error('Proposta inválida: ' + proposal.validationErrors.join(', '));
      return false;
    }

    setLoading(true);
    try {
      // Recalcular ajustes propagados para todas as opções
      const snapshot = rebalancePlan(corePlan, proposal.targetMacros, {
        tolerancePercent: 2,
        maxAdjustmentPercent: 0.5,
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
