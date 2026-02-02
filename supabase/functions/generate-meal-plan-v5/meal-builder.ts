// =====================================================
// CONSTRUTOR DE REFEIÇÕES
// =====================================================

import type { 
  Food, 
  FoodSelection, 
  MealResult, 
  MealTemplate, 
  TemplateRole,
  AnchorsByRole,
} from "./types.ts";
import { MEAL_NAMES, ITEM_COUNTS } from "./constants.ts";
import { applyUnitConversion } from "./unit-conversion.ts";
import { selectFoodForRole, calculateApproximateQuantity } from "./food-filter.ts";
import { selectAnchorForOption, normalizeRoleName, getRoleAliases } from "./anchor-selection.ts";
import { logInfo, logDebug } from "./logger.ts";

interface TemplateData {
  template: MealTemplate;
  roles: TemplateRole[];
}

/**
 * Monta uma refeição com âncoras distribuídas entre opções.
 */
export function buildMealWithAnchors(
  mealType: string,
  optionNumber: number,
  templateData: TemplateData,
  eligibleFoods: Food[],
  usedGlobalIds: Set<string>,
  preferredFoods: string[],
  anchorsByRole: AnchorsByRole[],
  previousOptionsUsedIds: Set<string>
): MealResult {
  const { template, roles } = templateData;
  const foods: FoodSelection[] = [];
  const usedInMeal = new Set<string>();
  const filledRoles = new Set<string>();
  const filledNormalizedRoles = new Set<string>();

  const combinedUsedIds = new Set([...usedGlobalIds, ...previousOptionsUsedIds]);

  // PASSO 1: Usar âncoras para preencher papéis
  for (const { role_name, anchors } of anchorsByRole) {
    const normalizedRole = normalizeRoleName(role_name);
    
    if (filledNormalizedRoles.has(normalizedRole)) {
      logDebug(`Âncora ignorada - papel já preenchido`, { 
        mealType, 
        role: role_name,
        normalizedRole 
      });
      continue;
    }
    
    const anchor = selectAnchorForOption(anchors, optionNumber, combinedUsedIds);
    
    if (anchor && anchor.food) {
      const conversion = applyUnitConversion(anchor.food, anchor.default_quantity_grams);
      foods.push({
        food: anchor.food,
        role_name: role_name,
        quantity_grams: conversion.calculated_grams,
        display_quantity: conversion.display_quantity,
        display_unit: conversion.display_unit,
      });

      usedInMeal.add(anchor.food.id);
      filledRoles.add(role_name);
      filledNormalizedRoles.add(normalizedRole);
      
      const aliases = getRoleAliases(role_name);
      for (const alias of aliases) {
        filledRoles.add(alias);
      }
      
      logDebug(`Âncora aplicada (opção ${optionNumber})`, { 
        mealType, 
        food: anchor.food.name, 
        role: role_name
      });
    }
  }

  // PASSO 2: Processar papéis obrigatórios não preenchidos
  const requiredRoles = roles.filter((r) => 
    r.is_required && 
    !filledRoles.has(r.role_name) && 
    !filledNormalizedRoles.has(normalizeRoleName(r.role_name))
  );
  const optionalRoles = roles.filter((r) => 
    !r.is_required && 
    !filledRoles.has(r.role_name) &&
    !filledNormalizedRoles.has(normalizeRoleName(r.role_name))
  );

  for (const role of requiredRoles) {
    const food = selectFoodForRole(
      role, 
      eligibleFoods, 
      new Set([...combinedUsedIds, ...usedInMeal]), 
      preferredFoods
    );

    if (food) {
      const quantity = calculateApproximateQuantity(role, food);
      const conversion = applyUnitConversion(food, quantity);

      foods.push({
        food,
        role_name: role.role_name,
        quantity_grams: conversion.calculated_grams,
        display_quantity: conversion.display_quantity,
        display_unit: conversion.display_unit,
      });

      usedInMeal.add(food.id);
    } else {
      logInfo(`Papel obrigatório não preenchido`, { mealType, role: role.role_name });
    }
  }

  // PASSO 3: Processar papéis opcionais
  const itemLimits = ITEM_COUNTS[mealType] || { min: 2, max: 4 };
  const targetItems = Math.floor(
    Math.random() * (itemLimits.max - itemLimits.min + 1)
  ) + itemLimits.min;
  const remainingSlots = Math.max(0, targetItems - foods.length);

  logDebug(`Opção ${optionNumber} de ${mealType}`, {
    currentItems: foods.length,
    targetItems,
    remainingSlots,
  });

  const shuffledOptionalRoles = [...optionalRoles].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(shuffledOptionalRoles.length, remainingSlots); i++) {
    const role = shuffledOptionalRoles[i];
    const food = selectFoodForRole(
      role, 
      eligibleFoods, 
      new Set([...combinedUsedIds, ...usedInMeal]), 
      preferredFoods
    );

    if (food) {
      const quantity = calculateApproximateQuantity(role, food);
      const conversion = applyUnitConversion(food, quantity);

      foods.push({
        food,
        role_name: role.role_name,
        quantity_grams: conversion.calculated_grams,
        display_quantity: conversion.display_quantity,
        display_unit: conversion.display_unit,
      });

      usedInMeal.add(food.id);
    }
  }

  // Calcular totais
  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const sel of foods) {
    const mult = sel.quantity_grams / 100;
    totalCals += sel.food.calories * mult;
    totalProt += sel.food.protein * mult;
    totalCarbs += sel.food.carbs * mult;
    totalFat += sel.food.fat * mult;
  }

  return {
    meal_type: mealType,
    meal_name: MEAL_NAMES[mealType] || mealType,
    foods,
    totals: {
      calories: Math.round(totalCals),
      protein: Math.round(totalProt * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
    },
  };
}
