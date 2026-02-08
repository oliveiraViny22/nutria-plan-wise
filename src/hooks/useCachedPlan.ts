import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNetworkStatus } from './useNetworkStatus';
import {
  cacheDietPlan,
  cacheMeals,
  cacheMealOptions,
  cacheMealOptionFoods,
  getCachedDietPlanByUser,
  getCachedMeals,
  getCachedMealOptions,
  getCachedMealOptionFoods,
  isCacheValid,
  CachedDietPlan,
  CachedMeal,
  CachedMealOption,
  CachedMealOptionFood,
} from '@/lib/offline-sync';

export interface CachedPlanData {
  plan: CachedDietPlan | null;
  meals: CachedMeal[];
  mealOptions: Map<string, CachedMealOption[]>;
  mealOptionFoods: Map<string, CachedMealOptionFood[]>;
  isFromCache: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and cache meal plan data for offline use
 * Returns cached data when offline, fetches fresh data when online
 */
export function useCachedPlan(userId: string | undefined): CachedPlanData {
  const { isOnline } = useNetworkStatus();
  const [plan, setPlan] = useState<CachedDietPlan | null>(null);
  const [meals, setMeals] = useState<CachedMeal[]>([]);
  const [mealOptions, setMealOptions] = useState<Map<string, CachedMealOption[]>>(new Map());
  const [mealOptionFoods, setMealOptionFoods] = useState<Map<string, CachedMealOptionFood[]>>(new Map());
  const [isFromCache, setIsFromCache] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch fresh data from Supabase and cache it
   */
  const fetchAndCache = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch active diet plan
      const { data: planData, error: planError } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError) throw planError;
      if (!planData) {
        setPlan(null);
        setMeals([]);
        return;
      }

      // Cache diet plan
      const cachedPlan: CachedDietPlan = {
        id: planData.id,
        userId: planData.user_id,
        totalCalories: planData.total_calories,
        totalProtein: planData.total_protein,
        totalCarbs: planData.total_carbs,
        totalFat: planData.total_fat,
        status: planData.status,
        isSaved: planData.is_saved,
        cachedAt: Date.now(),
      };
      await cacheDietPlan(cachedPlan);
      setPlan(cachedPlan);

      // Fetch meals with options and foods
      const { data: mealsData, error: mealsError } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          sort_order,
          total_calories,
          total_protein,
          total_carbs,
          total_fat,
          meal_options (
            id,
            option_number,
            name,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            meal_option_foods (
              id,
              quantity_grams,
              display_quantity,
              display_unit,
              food:foods (
                id,
                name,
                calories,
                protein,
                carbs,
                fat,
                category
              )
            )
          )
        `)
        .eq('diet_plan_id', planData.id)
        .order('sort_order');

      if (mealsError) throw mealsError;

      // Process and cache meals
      const cachedMeals: CachedMeal[] = (mealsData || []).map((meal: any) => ({
        id: meal.id,
        dietPlanId: planData.id,
        name: meal.name,
        sortOrder: meal.sort_order,
        totalCalories: meal.total_calories,
        totalProtein: meal.total_protein,
        totalCarbs: meal.total_carbs,
        totalFat: meal.total_fat,
        cachedAt: Date.now(),
      }));
      await cacheMeals(cachedMeals);
      setMeals(cachedMeals);

      // Process and cache options
      const allOptions: CachedMealOption[] = [];
      const allFoods: CachedMealOptionFood[] = [];
      const optionsMap = new Map<string, CachedMealOption[]>();
      const foodsMap = new Map<string, CachedMealOptionFood[]>();

      for (const meal of mealsData || []) {
        const mealOpts: CachedMealOption[] = [];
        
        for (const opt of meal.meal_options || []) {
          const cachedOpt: CachedMealOption = {
            id: opt.id,
            mealId: meal.id,
            optionNumber: opt.option_number,
            name: opt.name,
            totalCalories: opt.total_calories,
            totalProtein: opt.total_protein,
            totalCarbs: opt.total_carbs,
            totalFat: opt.total_fat,
            cachedAt: Date.now(),
          };
          mealOpts.push(cachedOpt);
          allOptions.push(cachedOpt);

          const optFoods: CachedMealOptionFood[] = [];
          for (const mof of opt.meal_option_foods || []) {
            if (mof.food) {
              const cachedFood: CachedMealOptionFood = {
                id: mof.id,
                mealOptionId: opt.id,
                foodId: mof.food.id,
                foodName: mof.food.name,
                quantityGrams: mof.quantity_grams,
                displayQuantity: mof.display_quantity,
                displayUnit: mof.display_unit,
                calories: mof.food.calories,
                protein: mof.food.protein,
                carbs: mof.food.carbs,
                fat: mof.food.fat,
                category: mof.food.category,
                cachedAt: Date.now(),
              };
              optFoods.push(cachedFood);
              allFoods.push(cachedFood);
            }
          }
          foodsMap.set(opt.id, optFoods);
        }
        optionsMap.set(meal.id, mealOpts);
      }

      await cacheMealOptions(allOptions);
      await cacheMealOptionFoods(allFoods);
      setMealOptions(optionsMap);
      setMealOptionFoods(foodsMap);
      setIsFromCache(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching plan data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar plano');
    }
  }, [userId]);

  /**
   * Load data from cache
   */
  const loadFromCache = useCallback(async () => {
    if (!userId) return false;

    try {
      const cachedPlan = await getCachedDietPlanByUser(userId);
      if (!cachedPlan) return false;

      // Check if cache is still valid
      if (!await isCacheValid(cachedPlan.cachedAt)) {
        return false;
      }

      setPlan(cachedPlan);

      const cachedMeals = await getCachedMeals(cachedPlan.id);
      setMeals(cachedMeals.sort((a, b) => a.sortOrder - b.sortOrder));

      const optionsMap = new Map<string, CachedMealOption[]>();
      const foodsMap = new Map<string, CachedMealOptionFood[]>();

      for (const meal of cachedMeals) {
        const options = await getCachedMealOptions(meal.id);
        optionsMap.set(meal.id, options.sort((a, b) => a.optionNumber - b.optionNumber));

        for (const opt of options) {
          const foods = await getCachedMealOptionFoods(opt.id);
          foodsMap.set(opt.id, foods);
        }
      }

      setMealOptions(optionsMap);
      setMealOptionFoods(foodsMap);
      setIsFromCache(true);
      return true;
    } catch (err) {
      console.error('Error loading from cache:', err);
      return false;
    }
  }, [userId]);

  /**
   * Main refresh function
   */
  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    if (isOnline) {
      // Online: fetch fresh data and cache it
      await fetchAndCache();
    } else {
      // Offline: try to load from cache
      const loaded = await loadFromCache();
      if (!loaded) {
        setError('Sem conexão e sem dados em cache');
      }
    }

    setIsLoading(false);
  }, [userId, isOnline, fetchAndCache, loadFromCache]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh when coming back online
  useEffect(() => {
    if (isOnline && isFromCache) {
      refresh();
    }
  }, [isOnline, isFromCache, refresh]);

  return {
    plan,
    meals,
    mealOptions,
    mealOptionFoods,
    isFromCache,
    isLoading,
    error,
    refresh,
  };
}
