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

interface MealFood {
  id: string;
  meal_id: string;
  food_id: string;
  quantity: number;
  food: Food;
}

interface Meal {
  id: string;
  name: string;
  diet_plan_id: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
}

export interface MacroTargets {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface FoodAdjustment {
  mealFoodId: string;
  mealId: string;
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
function parseServingGrams(servingSize: string): number {
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
      // Fetch all meals with foods
      const { data: meals, error: mealsError } = await supabase
        .from('meals')
        .select('*')
        .eq('diet_plan_id', planId);

      if (mealsError) throw mealsError;

      // Fetch all meal_foods with food details
      const mealIds = meals?.map((m) => m.id) || [];
      const { data: mealFoodsData, error: mfError } = await supabase
        .from('meal_foods')
        .select('*, food:foods(*)')
        .in('meal_id', mealIds);

      if (mfError) throw mfError;

      const mealFoods = (mealFoodsData || []) as unknown as MealFood[];

      // Fetch supplements for Step 2
      const { data: supplementsData } = await supabase
        .from('foods')
        .select('*')
        .eq('category', 'suplementos');

      const supplements = (supplementsData || []) as Food[];

      // Calculate current macros
      let currentProtein = 0;
      let currentCarbs = 0;
      let currentFat = 0;
      let currentCalories = 0;

      for (const mf of mealFoods) {
        const food = mf.food;
        const qty = mf.quantity >= 10 ? mf.quantity : parseServingGrams(food.serving_size) * mf.quantity;
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

      // Group meal foods by macro dominance for smart adjustments
      const proteinFoods = mealFoods.filter((mf) => {
        const f = mf.food;
        return f.protein > f.carbs && f.protein > f.fat && f.category !== 'suplementos';
      });

      const carbFoods = mealFoods.filter((mf) => {
        const f = mf.food;
        return f.carbs > f.protein && f.carbs > f.fat && f.category !== 'suplementos';
      });

      const fatFoods = mealFoods.filter((mf) => {
        const f = mf.food;
        return f.fat > f.protein && f.fat > f.carbs && f.category !== 'suplementos';
      });

      const mealsMap = new Map(meals?.map((m) => [m.id, m]) || []);
      const mealNameMap: Record<string, string> = {
        breakfast: 'Café da Manhã',
        lunch: 'Almoço',
        dinner: 'Jantar',
        snack: 'Lanche',
      };

      // STEP 1: Adjust existing food quantities
      const adjustForMacro = (
        deficit: number,
        foods: MealFood[],
        macroKey: 'protein' | 'carbs' | 'fat',
        maxIncreasePct: number = 0.5 // max 50% increase per food
      ): number => {
        if (deficit <= 0 || foods.length === 0) return deficit;

        let remaining = deficit;
        
        // Sort by macro density (higher first)
        const sorted = [...foods].sort((a, b) => {
          const baseA = parseServingGrams(a.food.serving_size);
          const baseB = parseServingGrams(b.food.serving_size);
          return (b.food[macroKey] / baseB) - (a.food[macroKey] / baseA);
        });

        for (const mf of sorted) {
          if (remaining <= 0) break;

          const food = mf.food;
          const baseGrams = parseServingGrams(food.serving_size);
          const currentQty = mf.quantity >= 10 ? mf.quantity : baseGrams * mf.quantity;
          const maxIncrease = currentQty * maxIncreasePct;
          
          // How much grams needed to cover remaining deficit
          const macroPer100g = (food[macroKey] / baseGrams) * 100;
          const gramsNeeded = (remaining / macroPer100g) * 100;
          
          const actualIncrease = Math.min(gramsNeeded, maxIncrease);
          if (actualIncrease < 5) continue; // Skip tiny adjustments

          const newQty = Math.round(currentQty + actualIncrease);
          const macroGain = (actualIncrease / baseGrams) * food[macroKey];
          
          remaining -= macroGain;

          // Calculate full macro change
          const oldNutrients = calcNutrients(food, currentQty);
          const newNutrients = calcNutrients(food, newQty);

          const meal = mealsMap.get(mf.meal_id);

          adjustments.push({
            mealFoodId: mf.id,
            mealId: mf.meal_id,
            mealName: meal ? mealNameMap[meal.name] || meal.name : 'Refeição',
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
        }

        return Math.max(0, remaining);
      };

      // Handle deficits - increase portions
      proteinDeficit = adjustForMacro(proteinDeficit, proteinFoods, 'protein');
      carbsDeficit = adjustForMacro(carbsDeficit, carbFoods, 'carbs');
      fatDeficit = adjustForMacro(fatDeficit, fatFoods, 'fat');

      // Handle excesses - reduce portions (negative deficit = excess)
      const reduceForMacro = (
        excess: number, // positive value means excess
        foods: MealFood[],
        macroKey: 'protein' | 'carbs' | 'fat',
        maxDecreasePct: number = 0.3 // max 30% decrease per food
      ): number => {
        if (excess <= 0 || foods.length === 0) return excess;

        let remaining = excess;
        
        // Sort by macro density (lower first for reduction)
        const sorted = [...foods].sort((a, b) => {
          const baseA = parseServingGrams(a.food.serving_size);
          const baseB = parseServingGrams(b.food.serving_size);
          return (a.food[macroKey] / baseA) - (b.food[macroKey] / baseB);
        });

        for (const mf of sorted) {
          if (remaining <= 0) break;

          // Check if already adjusted
          const existingAdjustment = adjustments.find((a) => a.mealFoodId === mf.id);
          if (existingAdjustment) continue;

          const food = mf.food;
          const baseGrams = parseServingGrams(food.serving_size);
          const currentQty = mf.quantity >= 10 ? mf.quantity : baseGrams * mf.quantity;
          const maxDecrease = currentQty * maxDecreasePct;
          
          const macroPer100g = (food[macroKey] / baseGrams) * 100;
          const gramsToReduce = (remaining / macroPer100g) * 100;
          
          const actualDecrease = Math.min(gramsToReduce, maxDecrease);
          if (actualDecrease < 5) continue;

          const newQty = Math.max(10, Math.round(currentQty - actualDecrease)); // Min 10g
          const macroLoss = ((currentQty - newQty) / baseGrams) * food[macroKey];
          
          remaining -= macroLoss;

          const oldNutrients = calcNutrients(food, currentQty);
          const newNutrients = calcNutrients(food, newQty);

          const meal = mealsMap.get(mf.meal_id);

          adjustments.push({
            mealFoodId: mf.id,
            mealId: mf.meal_id,
            mealName: meal ? mealNameMap[meal.name] || meal.name : 'Refeição',
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
        }

        return Math.max(0, remaining);
      };

      // Check for excesses
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
      // Find appropriate supplements
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

      // Get a snack meal or create reference to last meal for supplements
      const snackMeal = meals?.find((m) => m.name === 'snack');
      const targetMealForSupplements = snackMeal || meals?.[meals.length - 1];

      if (proteinDeficit > 5 && wheyProtein && targetMealForSupplements) {
        const baseGrams = parseServingGrams(wheyProtein.serving_size);
        const proteinPer100g = (wheyProtein.protein / baseGrams) * 100;
        const gramsNeeded = Math.round((proteinDeficit / proteinPer100g) * 100);
        const roundedGrams = Math.min(90, Math.max(30, Math.round(gramsNeeded / 10) * 10)); // 30-90g, round to 10

        const nutrients = calcNutrients(wheyProtein, roundedGrams);
        proteinDeficit -= nutrients.protein;

        supplementsAdded.push({
          mealFoodId: '',
          mealId: targetMealForSupplements.id,
          mealName: mealNameMap[targetMealForSupplements.name] || targetMealForSupplements.name,
          foodName: wheyProtein.name,
          foodId: wheyProtein.id,
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

      if (carbsDeficit > 10 && maltodextrin && targetMealForSupplements) {
        const baseGrams = parseServingGrams(maltodextrin.serving_size);
        const carbsPer100g = (maltodextrin.carbs / baseGrams) * 100;
        const gramsNeeded = Math.round((carbsDeficit / carbsPer100g) * 100);
        const roundedGrams = Math.min(60, Math.max(20, Math.round(gramsNeeded / 10) * 10));

        const nutrients = calcNutrients(maltodextrin, roundedGrams);
        carbsDeficit -= nutrients.carbs;

        supplementsAdded.push({
          mealFoodId: '',
          mealId: targetMealForSupplements.id,
          mealName: mealNameMap[targetMealForSupplements.name] || targetMealForSupplements.name,
          foodName: maltodextrin.name,
          foodId: maltodextrin.id,
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

      if (fatDeficit > 5 && mctoil && targetMealForSupplements) {
        const baseGrams = parseServingGrams(mctoil.serving_size);
        const fatPer100g = (mctoil.fat / baseGrams) * 100;
        const gramsNeeded = Math.round((fatDeficit / fatPer100g) * 100);
        const roundedGrams = Math.min(30, Math.max(10, Math.round(gramsNeeded / 5) * 5));

        const nutrients = calcNutrients(mctoil, roundedGrams);
        fatDeficit -= nutrients.fat;

        supplementsAdded.push({
          mealFoodId: '',
          mealId: targetMealForSupplements.id,
          mealName: mealNameMap[targetMealForSupplements.name] || targetMealForSupplements.name,
          foodName: mctoil.name,
          foodId: mctoil.id,
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

      // Calculate proposed macros after all adjustments
      let proposedProtein = currentProtein;
      let proposedCarbs = currentCarbs;
      let proposedFat = currentFat;
      let proposedCalories = currentCalories;

      for (const adj of [...adjustments, ...supplementsAdded]) {
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
    } catch (error: any) {
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
      // Apply food quantity adjustments
      for (const adj of proposal.adjustments) {
        await supabase
          .from('meal_foods')
          .update({ quantity: adj.newQuantity })
          .eq('id', adj.mealFoodId);
      }

      // Add new supplements
      for (const supp of proposal.supplementsAdded) {
        await supabase.from('meal_foods').insert({
          meal_id: supp.mealId,
          food_id: supp.foodId,
          quantity: supp.newQuantity,
        });
      }

      // Recalculate meal totals
      const affectedMealIds = new Set([
        ...proposal.adjustments.map((a) => a.mealId),
        ...proposal.supplementsAdded.map((s) => s.mealId),
      ]);

      for (const mealId of affectedMealIds) {
        const { data: mealFoods } = await supabase
          .from('meal_foods')
          .select('*, food:foods(*)')
          .eq('meal_id', mealId);

        let mealCalories = 0;
        let mealProtein = 0;
        let mealCarbs = 0;
        let mealFat = 0;

        if (mealFoods) {
          for (const mf of mealFoods) {
            const food = mf.food as Food;
            const qty = mf.quantity >= 10 ? mf.quantity : parseServingGrams(food.serving_size) * mf.quantity;
            const nutrients = calcNutrients(food, qty);
            mealCalories += nutrients.calories;
            mealProtein += nutrients.protein;
            mealCarbs += nutrients.carbs;
            mealFat += nutrients.fat;
          }
        }

        await supabase
          .from('meals')
          .update({
            total_calories: Math.round(mealCalories),
            total_protein: Math.round(mealProtein),
            total_carbs: Math.round(mealCarbs),
            total_fat: Math.round(mealFat),
          })
          .eq('id', mealId);
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

      // Log to history
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.id) {
        await supabase.from('plan_history').insert([{
          user_id: userData.user.id,
          diet_plan_id: planId,
          action: 'macro_rebalance',
          description: 'Otimização automática de macros aplicada',
          previous_values: JSON.parse(JSON.stringify(proposal.currentMacros)),
          new_values: JSON.parse(JSON.stringify(proposal.proposedMacros)),
        }]);
      }

      setProposal(null);
      toast.success('Plano otimizado com sucesso!');
      return true;
    } catch (error: any) {
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
