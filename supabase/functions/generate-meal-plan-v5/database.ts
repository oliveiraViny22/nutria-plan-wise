// =====================================================
// OPERAÇÕES DE BANCO DE DADOS
// =====================================================

import type { MealWithOptions } from "./types.ts";
import { MEAL_NAMES } from "./constants.ts";
import { logInfo, logError } from "./logger.ts";

/**
 * Salva plano alimentar com múltiplas opções no banco.
 */
export async function savePlanWithOptions(
  supabase: any,
  userId: string,
  mealsWithOptions: MealWithOptions[]
): Promise<string> {
  // Calcular totais do plano (baseado na primeira opção)
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const mealData of mealsWithOptions) {
    if (mealData.options[0]) {
      totalCals += mealData.options[0].totals.calories;
      totalProt += mealData.options[0].totals.protein;
      totalCarbs += mealData.options[0].totals.carbs;
      totalFat += mealData.options[0].totals.fat;
    }
  }

  // Arquivar planos anteriores
  const { error: deactivateError } = await supabase
    .from("diet_plans")
    .update({ status: "archived" })
    .eq("user_id", userId)
    .eq("status", "active");

  if (deactivateError) {
    logError("Erro ao desativar planos anteriores", { error: deactivateError.message });
    throw new Error(`Falha ao desativar plano existente: ${deactivateError.message}`);
  }

  // Delay para garantir commit
  await new Promise(resolve => setTimeout(resolve, 100));

  // Criar novo plano
  const { data: dietPlan, error: planError } = await supabase
    .from("diet_plans")
    .insert({
      user_id: userId,
      status: "active",
      total_calories: totalCals,
      total_protein: totalProt,
      total_carbs: totalCarbs,
      total_fat: totalFat,
    })
    .select()
    .single();

  if (planError) {
    logError("Erro ao criar plano", { error: planError.message });
    throw new Error(planError.message);
  }

  // Criar refeições com múltiplas opções
  for (let i = 0; i < mealsWithOptions.length; i++) {
    const mealWithOpts = mealsWithOptions[i];
    const firstOption = mealWithOpts.options[0];
    
    if (!firstOption) continue;

    const { data: mealData, error: mealError } = await supabase
      .from("meals")
      .insert({
        diet_plan_id: dietPlan.id,
        name: firstOption.meal_name,
        sort_order: i + 1,
        total_calories: firstOption.totals.calories,
        total_protein: firstOption.totals.protein,
        total_carbs: firstOption.totals.carbs,
        total_fat: firstOption.totals.fat,
      })
      .select()
      .single();

    if (mealError) {
      logError("Erro ao criar refeição", { mealName: firstOption.meal_name, error: mealError.message });
      throw new Error(mealError.message);
    }

    // Criar todas as opções desta refeição
    for (let optIdx = 0; optIdx < mealWithOpts.options.length; optIdx++) {
      const option = mealWithOpts.options[optIdx];
      const optionNumber = optIdx + 1;
      const optionName = optionNumber === 1 ? "Opção Principal" : `Opção ${optionNumber}`;

      const { data: optionData, error: optionError } = await supabase
        .from("meal_options")
        .insert({
          meal_id: mealData.id,
          option_number: optionNumber,
          name: optionName,
          total_calories: option.totals.calories,
          total_protein: option.totals.protein,
          total_carbs: option.totals.carbs,
          total_fat: option.totals.fat,
        })
        .select()
        .single();

      if (optionError) {
        logError("Erro ao criar opção", { optionNumber, error: optionError.message });
        throw new Error(optionError.message);
      }

      // Adicionar alimentos
      for (const food of option.foods) {
        const { error: foodItemError } = await supabase.from("meal_option_foods").insert({
          meal_option_id: optionData.id,
          food_id: food.food.id,
          quantity_grams: food.quantity_grams,
          display_quantity: food.display_quantity,
          display_unit: food.display_unit,
          calculated_grams: food.quantity_grams,
          unit_locked: true,
        });

        if (foodItemError) {
          logError("Erro ao inserir alimento", { 
            foodName: food.food.name, 
            error: foodItemError.message 
          });
          throw new Error(foodItemError.message);
        }
      }

      logInfo(`Opção ${optionNumber} salva para ${option.meal_name}`, { 
        foods: option.foods.length 
      });
    }
  }

  return dietPlan.id;
}
