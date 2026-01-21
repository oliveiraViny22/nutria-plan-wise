import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  category: string | null;
  processing_level: string | null;
}

interface MealOptionFood {
  id: string;
  meal_option_id: string;
  food_id: string;
  quantity_grams: number;
  food: Food;
}

interface MealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  meal_option_foods: MealOptionFood[];
}

interface Meal {
  id: string;
  name: string;
  diet_plan_id: string;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  meal_options: MealOption[];
}

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

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
}

// Parse serving_size to extract base grams
function parseServingGrams(servingSize: string | null): number {
  if (!servingSize) return 100;
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

// Calculate nutrients for a given quantity in grams
function calcNutrients(food: Food, gramsQty: number) {
  const baseGrams = parseServingGrams(food.serving_size);
  const multiplier = gramsQty / baseGrams;
  return {
    calories: food.calories * multiplier,
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
  };
}

export function useMacroRebalancer() {
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<RebalanceProposal | null>(null);

  const calculateProposal = async (
    planId: string,
    targets: MacroTargets
  ): Promise<RebalanceProposal | null> => {
    setLoading(true);
    try {
      // Fetch all meals with options and foods using v2 schema
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

      const typedMeals = (meals || []) as unknown as Meal[];

      // Estrutura para armazenar alimentos de TODAS as opções (para rebalanceamento)
      // Inclui informação de option_number para manter a equivalência
      const allMealOptionFoods: (MealOptionFood & { 
        mealId: string; 
        mealName: string; 
        mealOptionId: string;
        optionNumber: number;
      })[] = [];
      
      // Estrutura para armazenar alimentos apenas da PRIMEIRA opção (para cálculo de calorias diárias)
      const firstOptionFoods: (MealOptionFood & { 
        mealId: string; 
        mealName: string; 
        mealOptionId: string;
      })[] = [];
      
      for (const meal of typedMeals) {
        const sortedOptions = [...(meal.meal_options || [])].sort(
          (a, b) => a.option_number - b.option_number
        );
        
        // Coleta TODAS as opções para rebalanceamento
        for (const option of sortedOptions) {
          for (const mof of option.meal_option_foods || []) {
            allMealOptionFoods.push({
              ...mof,
              mealId: meal.id,
              mealName: meal.name,
              mealOptionId: option.id,
              optionNumber: option.option_number,
            });
          }
        }
        
        // Coleta apenas a primeira opção para cálculo de calorias diárias
        const firstOption = sortedOptions[0];
        if (firstOption) {
          for (const mof of firstOption.meal_option_foods || []) {
            firstOptionFoods.push({
              ...mof,
              mealId: meal.id,
              mealName: meal.name,
              mealOptionId: firstOption.id,
            });
          }
        }
      }

      // Fetch supplements for Step 2
      const { data: supplementsData } = await supabase
        .from('foods')
        .select('*')
        .eq('category', 'suplementos');

      const supplements = (supplementsData || []) as Food[];

      // Calculate current macros APENAS da primeira opção de cada refeição
      // (as opções são equivalentes, então basta usar uma)
      let currentProtein = 0;
      let currentCarbs = 0;
      let currentFat = 0;
      let currentCalories = 0;

      for (const mof of firstOptionFoods) {
        const food = mof.food;
        const qty = mof.quantity_grams;
        const nutrients = calcNutrients(food, qty);
        currentProtein += nutrients.protein;
        currentCarbs += nutrients.carbs;
        currentFat += nutrients.fat;
        currentCalories += nutrients.calories;
      }

      const currentMacros: MacroTargets = {
        protein: Math.round(currentProtein),
        carbs: Math.round(currentCarbs),
        fat: Math.round(currentFat),
        calories: Math.round(currentCalories),
      };

      // Calculate deficits
      let proteinDeficit = targets.protein - currentProtein;
      let carbsDeficit = targets.carbs - currentCarbs;
      let fatDeficit = targets.fat - currentFat;

      const adjustments: FoodAdjustment[] = [];
      const supplementsAdded: FoodAdjustment[] = [];

      // Group foods by macro dominance
      const proteinFoods = allMealOptionFoods.filter((mof) => {
        const f = mof.food;
        return f.protein > f.carbs && f.protein > f.fat && f.category !== 'suplementos';
      });

      const carbFoods = allMealOptionFoods.filter((mof) => {
        const f = mof.food;
        return f.carbs > f.protein && f.carbs > f.fat && f.category !== 'suplementos';
      });

      const fatFoods = allMealOptionFoods.filter((mof) => {
        const f = mof.food;
        return f.fat > f.protein && f.fat > f.carbs && f.category !== 'suplementos';
      });

      const mealNameMap: Record<string, string> = {
        breakfast: 'Café da Manhã',
        lunch: 'Almoço',
        dinner: 'Jantar',
        snack: 'Lanche',
      };

      // STEP 1: Adjust existing food quantities
      // Os ajustes são feitos em TODAS as opções para manter a equivalência
      const adjustForMacro = (
        deficit: number,
        foods: (MealOptionFood & { mealId: string; mealName: string; mealOptionId: string; optionNumber: number })[],
        macroKey: 'protein' | 'carbs' | 'fat',
        maxIncreasePct: number = 0.5
      ): number => {
        if (deficit <= 0 || foods.length === 0) return deficit;

        let remaining = deficit;
        
        // Agrupar por food_id + mealId para ajustar o mesmo alimento em todas as opções
        // Usamos apenas a primeira opção para calcular o déficit, mas aplicamos em todas
        const firstOptionFoodsForAdjust = foods.filter(f => f.optionNumber === 1);
        
        const sorted = [...firstOptionFoodsForAdjust].sort((a, b) => {
          const baseA = parseServingGrams(a.food.serving_size);
          const baseB = parseServingGrams(b.food.serving_size);
          return (b.food[macroKey] / baseB) - (a.food[macroKey] / baseA);
        });

        for (const mof of sorted) {
          if (remaining <= 0) break;

          const food = mof.food;
          const baseGrams = parseServingGrams(food.serving_size);
          const currentQty = mof.quantity_grams;
          const maxIncrease = currentQty * maxIncreasePct;
          
          const macroPer100g = (food[macroKey] / baseGrams) * 100;
          const gramsNeeded = (remaining / macroPer100g) * 100;
          
          const actualIncrease = Math.min(gramsNeeded, maxIncrease);
          if (actualIncrease < 5) continue;

          const newQty = Math.round(currentQty + actualIncrease);
          const macroGain = (actualIncrease / baseGrams) * food[macroKey];
          
          remaining -= macroGain;

          const oldNutrients = calcNutrients(food, currentQty);
          const newNutrients = calcNutrients(food, newQty);
          const percentChange = newQty / currentQty;

          // Adiciona ajuste para a opção 1 (para exibição)
          adjustments.push({
            mealOptionFoodId: mof.id,
            mealId: mof.mealId,
            mealOptionId: mof.mealOptionId,
            mealName: mealNameMap[mof.mealName] || mof.mealName,
            foodName: food.name,
            foodId: food.id,
            originalQuantity: Math.round(currentQty),
            newQuantity: newQty,
            isNewItem: false,
            macroChange: {
              protein: Math.round(newNutrients.protein - oldNutrients.protein),
              carbs: Math.round(newNutrients.carbs - oldNutrients.carbs),
              fat: Math.round(newNutrients.fat - oldNutrients.fat),
              calories: Math.round(newNutrients.calories - oldNutrients.calories),
            },
          });

          // Propaga ajuste para as demais opções (mesma refeição, mesmo alimento)
          const equivalentFoods = foods.filter(
            f => f.mealId === mof.mealId && 
                 f.food_id === mof.food_id && 
                 f.optionNumber !== 1
          );
          
          for (const eqFood of equivalentFoods) {
            const eqNewQty = Math.round(eqFood.quantity_grams * percentChange);
            const eqOldNutrients = calcNutrients(eqFood.food, eqFood.quantity_grams);
            const eqNewNutrients = calcNutrients(eqFood.food, eqNewQty);
            
            adjustments.push({
              mealOptionFoodId: eqFood.id,
              mealId: eqFood.mealId,
              mealOptionId: eqFood.mealOptionId,
              mealName: mealNameMap[eqFood.mealName] || eqFood.mealName,
              foodName: eqFood.food.name,
              foodId: eqFood.food.id,
              originalQuantity: Math.round(eqFood.quantity_grams),
              newQuantity: eqNewQty,
              isNewItem: false,
              macroChange: {
                protein: Math.round(eqNewNutrients.protein - eqOldNutrients.protein),
                carbs: Math.round(eqNewNutrients.carbs - eqOldNutrients.carbs),
                fat: Math.round(eqNewNutrients.fat - eqOldNutrients.fat),
                calories: Math.round(eqNewNutrients.calories - eqOldNutrients.calories),
              },
            });
          }
        }

        return Math.max(0, remaining);
      };

      // Handle deficits
      proteinDeficit = adjustForMacro(proteinDeficit, proteinFoods, 'protein');
      carbsDeficit = adjustForMacro(carbsDeficit, carbFoods, 'carbs');
      fatDeficit = adjustForMacro(fatDeficit, fatFoods, 'fat');

      // Handle excesses
      const reduceForMacro = (
        excess: number,
        foods: (MealOptionFood & { mealId: string; mealName: string; mealOptionId: string; optionNumber: number })[],
        macroKey: 'protein' | 'carbs' | 'fat',
        maxDecreasePct: number = 0.3
      ): number => {
        if (excess <= 0 || foods.length === 0) return excess;

        let remaining = excess;
        
        // Usar apenas a primeira opção para calcular a redução
        const firstOptionFoodsForReduce = foods.filter(f => f.optionNumber === 1);
        
        const sorted = [...firstOptionFoodsForReduce].sort((a, b) => {
          const baseA = parseServingGrams(a.food.serving_size);
          const baseB = parseServingGrams(b.food.serving_size);
          return (a.food[macroKey] / baseA) - (b.food[macroKey] / baseB);
        });

        for (const mof of sorted) {
          if (remaining <= 0) break;

          const existingAdjustment = adjustments.find((a) => a.mealOptionFoodId === mof.id);
          if (existingAdjustment) continue;

          const food = mof.food;
          const baseGrams = parseServingGrams(food.serving_size);
          const currentQty = mof.quantity_grams;
          const maxDecrease = currentQty * maxDecreasePct;
          
          const macroPer100g = (food[macroKey] / baseGrams) * 100;
          const gramsToReduce = (remaining / macroPer100g) * 100;
          
          const actualDecrease = Math.min(gramsToReduce, maxDecrease);
          if (actualDecrease < 5) continue;

          const newQty = Math.max(10, Math.round(currentQty - actualDecrease));
          const macroLoss = ((currentQty - newQty) / baseGrams) * food[macroKey];
          
          remaining -= macroLoss;

          const oldNutrients = calcNutrients(food, currentQty);
          const newNutrients = calcNutrients(food, newQty);
          const percentChange = newQty / currentQty;

          // Adiciona ajuste para a opção 1 (para exibição)
          adjustments.push({
            mealOptionFoodId: mof.id,
            mealId: mof.mealId,
            mealOptionId: mof.mealOptionId,
            mealName: mealNameMap[mof.mealName] || mof.mealName,
            foodName: food.name,
            foodId: food.id,
            originalQuantity: Math.round(currentQty),
            newQuantity: newQty,
            isNewItem: false,
            macroChange: {
              protein: Math.round(newNutrients.protein - oldNutrients.protein),
              carbs: Math.round(newNutrients.carbs - oldNutrients.carbs),
              fat: Math.round(newNutrients.fat - oldNutrients.fat),
              calories: Math.round(newNutrients.calories - oldNutrients.calories),
            },
          });

          // Propaga ajuste para as demais opções (mesma refeição, mesmo alimento)
          const equivalentFoods = foods.filter(
            f => f.mealId === mof.mealId && 
                 f.food_id === mof.food_id && 
                 f.optionNumber !== 1
          );
          
          for (const eqFood of equivalentFoods) {
            const eqNewQty = Math.max(10, Math.round(eqFood.quantity_grams * percentChange));
            const eqOldNutrients = calcNutrients(eqFood.food, eqFood.quantity_grams);
            const eqNewNutrients = calcNutrients(eqFood.food, eqNewQty);
            
            adjustments.push({
              mealOptionFoodId: eqFood.id,
              mealId: eqFood.mealId,
              mealOptionId: eqFood.mealOptionId,
              mealName: mealNameMap[eqFood.mealName] || eqFood.mealName,
              foodName: eqFood.food.name,
              foodId: eqFood.food.id,
              originalQuantity: Math.round(eqFood.quantity_grams),
              newQuantity: eqNewQty,
              isNewItem: false,
              macroChange: {
                protein: Math.round(eqNewNutrients.protein - eqOldNutrients.protein),
                carbs: Math.round(eqNewNutrients.carbs - eqOldNutrients.carbs),
                fat: Math.round(eqNewNutrients.fat - eqOldNutrients.fat),
                calories: Math.round(eqNewNutrients.calories - eqOldNutrients.calories),
              },
            });
          }
        }

        return Math.max(0, remaining);
      };

      if (proteinDeficit < 0) {
        proteinDeficit = -reduceForMacro(-proteinDeficit, proteinFoods, 'protein');
      }
      if (carbsDeficit < 0) {
        carbsDeficit = -reduceForMacro(-carbsDeficit, carbFoods, 'carbs');
      }
      if (fatDeficit < 0) {
        fatDeficit = -reduceForMacro(-fatDeficit, fatFoods, 'fat');
      }

      // STEP 2: Add supplements if deficits remain
      const wheyProtein = supplements.find((s) => 
        s.name.toLowerCase().includes('whey') || 
        (s.protein > 20 && s.carbs < 5 && s.fat < 5)
      );
      const maltodextrin = supplements.find((s) => 
        s.name.toLowerCase().includes('malto') || 
        s.name.toLowerCase().includes('dextrose') ||
        (s.carbs > 80 && s.protein < 5)
      );
      const mctoil = supplements.find((s) => 
        s.name.toLowerCase().includes('mct') || 
        s.name.toLowerCase().includes('óleo') ||
        (s.fat > 80 && s.protein < 5 && s.carbs < 5)
      );

      // Get a snack meal option for supplements - adicionar em TODAS as opções da refeição
      const snackMeal = typedMeals.find((m) => m.name === 'snack');
      const targetMealForSupplements = snackMeal || typedMeals[typedMeals.length - 1];
      const allTargetOptions = targetMealForSupplements?.meal_options || [];
      const targetOption = allTargetOptions[0]; // Primeira opção para cálculo

      // Helper para adicionar suplemento em todas as opções
      const addSupplementToAllOptions = (
        supplement: Food,
        roundedGrams: number,
        nutrients: { calories: number; protein: number; carbs: number; fat: number }
      ) => {
        for (const option of allTargetOptions) {
          supplementsAdded.push({
            mealOptionFoodId: '',
            mealId: targetMealForSupplements.id,
            mealOptionId: option.id,
            mealName: mealNameMap[targetMealForSupplements.name] || targetMealForSupplements.name,
            foodName: supplement.name,
            foodId: supplement.id,
            originalQuantity: 0,
            newQuantity: roundedGrams,
            isNewItem: true,
            macroChange: {
              protein: Math.round(nutrients.protein),
              carbs: Math.round(nutrients.carbs),
              fat: Math.round(nutrients.fat),
              calories: Math.round(nutrients.calories),
            },
          });
        }
      };

      if (proteinDeficit > 5 && wheyProtein && targetOption) {
        const baseGrams = parseServingGrams(wheyProtein.serving_size);
        const proteinPer100g = (wheyProtein.protein / baseGrams) * 100;
        const gramsNeeded = Math.round((proteinDeficit / proteinPer100g) * 100);
        const roundedGrams = Math.min(90, Math.max(30, Math.round(gramsNeeded / 10) * 10));

        const nutrients = calcNutrients(wheyProtein, roundedGrams);
        proteinDeficit -= nutrients.protein;

        addSupplementToAllOptions(wheyProtein, roundedGrams, nutrients);
      }

      if (carbsDeficit > 10 && maltodextrin && targetOption) {
        const baseGrams = parseServingGrams(maltodextrin.serving_size);
        const carbsPer100g = (maltodextrin.carbs / baseGrams) * 100;
        const gramsNeeded = Math.round((carbsDeficit / carbsPer100g) * 100);
        const roundedGrams = Math.min(60, Math.max(20, Math.round(gramsNeeded / 10) * 10));

        const nutrients = calcNutrients(maltodextrin, roundedGrams);
        carbsDeficit -= nutrients.carbs;

        addSupplementToAllOptions(maltodextrin, roundedGrams, nutrients);
      }

      if (fatDeficit > 5 && mctoil && targetOption) {
        const baseGrams = parseServingGrams(mctoil.serving_size);
        const fatPer100g = (mctoil.fat / baseGrams) * 100;
        const gramsNeeded = Math.round((fatDeficit / fatPer100g) * 100);
        const roundedGrams = Math.min(30, Math.max(10, Math.round(gramsNeeded / 5) * 5));

        const nutrients = calcNutrients(mctoil, roundedGrams);
        fatDeficit -= nutrients.fat;

        addSupplementToAllOptions(mctoil, roundedGrams, nutrients);
      }

      // Calculate proposed macros - usar apenas ajustes da PRIMEIRA OPÇÃO (optionNumber = 1)
      // para evitar somar macros de todas as opções equivalentes
      let proposedProtein = currentProtein;
      let proposedCarbs = currentCarbs;
      let proposedFat = currentFat;
      let proposedCalories = currentCalories;

      // Filtrar ajustes apenas da primeira opção de cada refeição para cálculo de macros propostos
      const firstOptionAdjustments = adjustments.filter(adj => {
        const meal = typedMeals.find(m => m.id === adj.mealId);
        if (!meal) return false;
        const sortedOpts = [...(meal.meal_options || [])].sort((a, b) => a.option_number - b.option_number);
        return sortedOpts[0]?.id === adj.mealOptionId;
      });

      const firstOptionSupplements = supplementsAdded.filter(supp => {
        const meal = typedMeals.find(m => m.id === supp.mealId);
        if (!meal) return false;
        const sortedOpts = [...(meal.meal_options || [])].sort((a, b) => a.option_number - b.option_number);
        return sortedOpts[0]?.id === supp.mealOptionId;
      });

      for (const adj of [...firstOptionAdjustments, ...firstOptionSupplements]) {
        proposedProtein += adj.macroChange.protein;
        proposedCarbs += adj.macroChange.carbs;
        proposedFat += adj.macroChange.fat;
        proposedCalories += adj.macroChange.calories;
      }

      const proposedMacros: MacroTargets = {
        protein: Math.round(proposedProtein),
        carbs: Math.round(proposedCarbs),
        fat: Math.round(proposedFat),
        calories: Math.round(proposedCalories),
      };

      const result: RebalanceProposal = {
        currentMacros,
        targetMacros: targets,
        proposedMacros,
        adjustments,
        supplementsAdded,
        deficits: {
          protein: Math.round(Math.max(0, proteinDeficit)),
          carbs: Math.round(Math.max(0, carbsDeficit)),
          fat: Math.round(Math.max(0, fatDeficit)),
        },
      };

      setProposal(result);
      return result;
    } catch (error: unknown) {
      console.error('Error calculating rebalance proposal:', error);
      toast.error('Erro ao calcular otimização de macros');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = async (planId: string): Promise<boolean> => {
    if (!proposal) return false;

    setLoading(true);
    try {
      // Apply food quantity adjustments using v2 schema
      for (const adj of proposal.adjustments) {
        await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: adj.newQuantity })
          .eq('id', adj.mealOptionFoodId);
      }

      // Add new supplements
      for (const supp of proposal.supplementsAdded) {
        await supabase.from('meal_option_foods').insert({
          meal_option_id: supp.mealOptionId,
          food_id: supp.foodId,
          quantity_grams: supp.newQuantity,
        });
      }

      // Recalculate meal option totals
      const affectedOptionIds = new Set([
        ...proposal.adjustments.map((a) => a.mealOptionId),
        ...proposal.supplementsAdded.map((s) => s.mealOptionId),
      ]);

      for (const optionId of affectedOptionIds) {
        const { data: optionFoods } = await supabase
          .from('meal_option_foods')
          .select('*, food:foods(*)')
          .eq('meal_option_id', optionId);

        let optionCalories = 0;
        let optionProtein = 0;
        let optionCarbs = 0;
        let optionFat = 0;

        if (optionFoods) {
          for (const mof of optionFoods) {
            const food = mof.food as Food;
            const qty = mof.quantity_grams;
            const nutrients = calcNutrients(food, qty);
            optionCalories += nutrients.calories;
            optionProtein += nutrients.protein;
            optionCarbs += nutrients.carbs;
            optionFat += nutrients.fat;
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

      // Recalculate meal totals (using first option as default)
      const affectedMealIds = new Set([
        ...proposal.adjustments.map((a) => a.mealId),
        ...proposal.supplementsAdded.map((s) => s.mealId),
      ]);

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

      // Recalculate plan totals
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

  const clearProposal = () => {
    setProposal(null);
  };

  return {
    loading,
    proposal,
    calculateProposal,
    applyProposal,
    clearProposal,
  };
}
