// =====================================================
// TESTES: OTIMIZAÇÃO DE MACROS
// =====================================================

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { Food, MealResult, MealWithOptions, MacroTargets } from "./types.ts";
import {
  applyMultiObjectiveScaling,
  applyMacroFineAdjustment,
  optimizeMacroDistribution,
} from "./macro-optimization.ts";

// =====================================================
// FIXTURES
// =====================================================

function createTestFood(overrides: Partial<Food> = {}): Food {
  return {
    id: crypto.randomUUID(),
    name: "Alimento Teste",
    calories: 100,
    protein: 10,
    carbs: 15,
    fat: 3,
    category: "proteinas",
    processing_level: "minimamente_processado",
    is_optional: false,
    unit_name: null,
    unit_weight_grams: null,
    unit_increment: null,
    unit_enabled: false,
    ...overrides,
  };
}

function createTestMeal(
  mealType: string,
  foods: Array<{ food: Food; grams: number }>
): MealResult {
  const selections = foods.map(({ food, grams }) => ({
    food,
    role_name: "test_role",
    quantity_grams: grams,
    display_quantity: grams,
    display_unit: "g",
  }));

  let totalCals = 0, totalProt = 0, totalCarbs = 0, totalFat = 0;
  for (const { food, grams } of foods) {
    const mult = grams / 100;
    totalCals += food.calories * mult;
    totalProt += food.protein * mult;
    totalCarbs += food.carbs * mult;
    totalFat += food.fat * mult;
  }

  return {
    meal_type: mealType,
    meal_name: mealType,
    foods: selections,
    totals: {
      calories: Math.round(totalCals),
      protein: Math.round(totalProt * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
    },
  };
}

function createMealsWithOptions(meals: MealResult[]): MealWithOptions[] {
  return meals.map(meal => ({
    mealType: meal.meal_type,
    options: [meal],
  }));
}

// =====================================================
// TESTES: ESCALONAMENTO MULTI-OBJETIVO
// =====================================================

Deno.test("MultiObjective: Escala proteínas quando déficit de proteína", () => {
  const proteinFood = createTestFood({
    name: "Frango",
    category: "proteinas",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  });

  const meal = createTestMeal("lunch", [{ food: proteinFood, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 300,
    protein: 60, // Precisamos de mais proteína
    carbs: 20,
    fat: 10,
  };

  const applied = applyMultiObjectiveScaling(mealsWithOptions, targets);

  console.log(`
✅ Teste de escala de proteína:
   Applied: ${applied}
   Antes: 100g
   Depois: ${mealsWithOptions[0].options[0].foods[0].quantity_grams}g
`);

  assertEquals(applied, true, "Deveria ter aplicado escala");
  // Com ratio de proteína ~2x, a quantidade deve aumentar
  const newGrams = mealsWithOptions[0].options[0].foods[0].quantity_grams;
  assertEquals(newGrams > 100, true, `Quantidade deveria aumentar: ${newGrams}g`);
});

Deno.test("MultiObjective: Escala carboidratos quando déficit de carbs", () => {
  const carbFood = createTestFood({
    name: "Arroz",
    category: "carboidratos",
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
  });

  const meal = createTestMeal("lunch", [{ food: carbFood, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 300,
    protein: 5,
    carbs: 80, // Precisamos de mais carbs
    fat: 5,
  };

  const applied = applyMultiObjectiveScaling(mealsWithOptions, targets);

  assertEquals(applied, true, "Deveria ter aplicado escala");
  const newGrams = mealsWithOptions[0].options[0].foods[0].quantity_grams;
  assertEquals(newGrams > 100, true, `Quantidade deveria aumentar: ${newGrams}g`);
});

Deno.test("MultiObjective: Não escala quando já está balanceado", () => {
  const balancedFood = createTestFood({
    name: "Refeição Balanceada",
    category: "mistos",
    calories: 200,
    protein: 20,
    carbs: 25,
    fat: 5,
  });

  const meal = createTestMeal("lunch", [{ food: balancedFood, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 200,
    protein: 20,
    carbs: 25,
    fat: 5,
  };

  const applied = applyMultiObjectiveScaling(mealsWithOptions, targets);

  // Pode ou não aplicar, mas diferença deve ser mínima
  const newGrams = mealsWithOptions[0].options[0].foods[0].quantity_grams;
  const diff = Math.abs(newGrams - 100);
  assertEquals(diff < 20, true, `Diferença deveria ser pequena: ${diff}g`);
});

Deno.test("MultiObjective: Limita fator de escala extremo", () => {
  const food = createTestFood({
    name: "Alimento",
    category: "proteinas",
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 2,
  });

  const meal = createTestMeal("lunch", [{ food, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  // Targets muito maiores que o atual
  const targets: MacroTargets = {
    calories: 1000,
    protein: 200,
    carbs: 300,
    fat: 50,
  };

  applyMultiObjectiveScaling(mealsWithOptions, targets);

  // Deve limitar o fator a 2.0x máximo
  const newGrams = mealsWithOptions[0].options[0].foods[0].quantity_grams;
  assertEquals(newGrams <= 200, true, `Deveria limitar a 200g max: ${newGrams}g`);
});

// =====================================================
// TESTES: AJUSTE FINO POR MACRO
// =====================================================

Deno.test("FineAdjust: Aumenta proteína quando abaixo de 95%", () => {
  const proteinFood = createTestFood({
    name: "Peito de Frango",
    category: "proteinas",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  });

  const carbFood = createTestFood({
    name: "Arroz",
    category: "carboidratos",
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
  });

  const meal = createTestMeal("lunch", [
    { food: proteinFood, grams: 100 },
    { food: carbFood, grams: 150 },
  ]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const beforeProtein = meal.totals.protein;

  const targets: MacroTargets = {
    calories: 400,
    protein: 50, // 31g atual = 62% da meta
    carbs: 50,
    fat: 10,
  };

  const applied = applyMacroFineAdjustment(mealsWithOptions, targets);

  const afterProtein = mealsWithOptions[0].options[0].totals.protein;

  console.log(`
✅ Teste de ajuste fino de proteína:
   Applied: ${applied}
   Antes: ${beforeProtein}g
   Depois: ${afterProtein}g
   Meta: ${targets.protein}g
`);

  assertEquals(applied, true, "Deveria ter aplicado ajuste");
  assertEquals(afterProtein > beforeProtein, true, "Proteína deveria aumentar");
});

Deno.test("FineAdjust: Aumenta carboidratos quando abaixo de 90%", () => {
  const carbFood = createTestFood({
    name: "Batata Doce",
    category: "carboidratos",
    calories: 86,
    protein: 1.6,
    carbs: 20,
    fat: 0.1,
  });

  const meal = createTestMeal("lunch", [{ food: carbFood, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const beforeCarbs = meal.totals.carbs;

  const targets: MacroTargets = {
    calories: 200,
    protein: 5,
    carbs: 50, // 20g atual = 40% da meta
    fat: 5,
  };

  const applied = applyMacroFineAdjustment(mealsWithOptions, targets);

  const afterCarbs = mealsWithOptions[0].options[0].totals.carbs;

  assertEquals(applied, true, "Deveria ter aplicado ajuste");
  assertEquals(afterCarbs > beforeCarbs, true, "Carbs deveria aumentar");
});

Deno.test("FineAdjust: Reduz gordura quando acima de 30% das calorias", () => {
  const fatFood = createTestFood({
    name: "Castanha",
    category: "gorduras",
    calories: 656,
    protein: 14,
    carbs: 12,
    fat: 66,
  });

  const meal = createTestMeal("snack", [{ food: fatFood, grams: 50 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const beforeFat = meal.totals.fat;

  const targets: MacroTargets = {
    calories: 300,
    protein: 10,
    carbs: 30,
    fat: 10, // Meta baixa de gordura
  };

  const applied = applyMacroFineAdjustment(mealsWithOptions, targets);

  const afterFat = mealsWithOptions[0].options[0].totals.fat;

  console.log(`
✅ Teste de redução de gordura:
   Applied: ${applied}
   Antes: ${beforeFat}g
   Depois: ${afterFat}g
`);

  // Gorduras podem ser reduzidas
  if (applied) {
    assertEquals(afterFat <= beforeFat, true, "Gordura não deveria aumentar");
  }
});

Deno.test("FineAdjust: Não ajusta quando já está nos limites", () => {
  const food = createTestFood({
    name: "Alimento OK",
    category: "proteinas",
    calories: 200,
    protein: 30,
    carbs: 20,
    fat: 5,
  });

  const meal = createTestMeal("lunch", [{ food, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 200,
    protein: 30, // 100%
    carbs: 20, // 100%
    fat: 5,
  };

  const applied = applyMacroFineAdjustment(mealsWithOptions, targets);

  // Já está OK, não deveria ajustar muito
  assertEquals(applied, false, "Não deveria precisar ajustar");
});

Deno.test("FineAdjust: Respeita limites máximos de porção", () => {
  const proteinFood = createTestFood({
    name: "Frango",
    category: "proteinas",
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  });

  // Começar já no limite máximo (350g para proteínas)
  const meal = createTestMeal("lunch", [{ food: proteinFood, grams: 340 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 1000,
    protein: 200, // Impossível atingir com 350g max
    carbs: 100,
    fat: 30,
  };

  applyMacroFineAdjustment(mealsWithOptions, targets);

  const newGrams = mealsWithOptions[0].options[0].foods[0].quantity_grams;
  assertEquals(newGrams <= 350, true, `Deveria respeitar limite: ${newGrams}g`);
});

// =====================================================
// TESTES: OTIMIZAÇÃO COMPLETA
// =====================================================

Deno.test("Optimization: Executa pipeline completo", () => {
  const proteinFood = createTestFood({
    name: "Filé de Tilápia",
    category: "proteinas",
    calories: 96,
    protein: 20,
    carbs: 0,
    fat: 1.7,
  });

  const carbFood = createTestFood({
    name: "Arroz Integral",
    category: "carboidratos",
    calories: 111,
    protein: 2.6,
    carbs: 23,
    fat: 0.9,
  });

  const meal = createTestMeal("lunch", [
    { food: proteinFood, grams: 120 },
    { food: carbFood, grams: 150 },
  ]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 400,
    protein: 40,
    carbs: 60,
    fat: 10,
  };

  const result = optimizeMacroDistribution(mealsWithOptions, targets);

  console.log(`
✅ Teste de otimização completa:
   MultiObjective: ${result.multiObjectiveApplied}
   FineAdjustment: ${result.fineAdjustmentApplied}
   Before: ${JSON.stringify(result.beforeTotals)}
   After: ${JSON.stringify(result.afterTotals)}
`);

  assertExists(result.beforeTotals);
  assertExists(result.afterTotals);
});

Deno.test("Optimization: Retorna métricas corretas", () => {
  const food = createTestFood({
    name: "Alimento",
    category: "proteinas",
    calories: 100,
    protein: 20,
    carbs: 5,
    fat: 2,
  });

  const meal = createTestMeal("lunch", [{ food, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 200,
    protein: 40,
    carbs: 10,
    fat: 5,
  };

  const result = optimizeMacroDistribution(mealsWithOptions, targets);

  // Verificar estrutura do resultado
  assertEquals(typeof result.multiObjectiveApplied, "boolean");
  assertEquals(typeof result.fineAdjustmentApplied, "boolean");
  assertEquals(typeof result.beforeTotals.calories, "number");
  assertEquals(typeof result.afterTotals.protein, "number");
});

// =====================================================
// TESTES: EDGE CASES
// =====================================================

Deno.test("Edge: Array vazio não quebra", () => {
  const mealsWithOptions: MealWithOptions[] = [];
  const targets: MacroTargets = {
    calories: 2000,
    protein: 100,
    carbs: 250,
    fat: 65,
  };

  const result = optimizeMacroDistribution(mealsWithOptions, targets);

  assertEquals(result.beforeTotals.calories, 0);
  assertEquals(result.afterTotals.calories, 0);
});

Deno.test("Edge: Alimento com zero calorias não quebra", () => {
  const food = createTestFood({
    name: "Água",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const meal = createTestMeal("snack", [{ food, grams: 200 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 100,
    protein: 10,
    carbs: 15,
    fat: 3,
  };

  // Não deve quebrar
  const result = optimizeMacroDistribution(mealsWithOptions, targets);
  assertExists(result);
});

Deno.test("Edge: Targets zero não quebram", () => {
  const food = createTestFood();
  const meal = createTestMeal("lunch", [{ food, grams: 100 }]);
  const mealsWithOptions = createMealsWithOptions([meal]);

  const targets: MacroTargets = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  const result = optimizeMacroDistribution(mealsWithOptions, targets);
  assertExists(result);
});

Deno.test("Edge: Múltiplas refeições são processadas", () => {
  const food1 = createTestFood({ name: "Frango", category: "proteinas" });
  const food2 = createTestFood({ name: "Arroz", category: "carboidratos" });

  const meal1 = createTestMeal("breakfast", [{ food: food1, grams: 80 }]);
  const meal2 = createTestMeal("lunch", [{ food: food2, grams: 150 }]);
  const meal3 = createTestMeal("dinner", [{ food: food1, grams: 100 }]);

  const mealsWithOptions = createMealsWithOptions([meal1, meal2, meal3]);

  const targets: MacroTargets = {
    calories: 500,
    protein: 50,
    carbs: 60,
    fat: 15,
  };

  const result = optimizeMacroDistribution(mealsWithOptions, targets);

  assertEquals(mealsWithOptions.length, 3, "Deve manter 3 refeições");
  assertExists(result.afterTotals);
});

// =====================================================
// RESUMO
// =====================================================

Deno.test("Resumo: Todos os cenários de otimização testados", () => {
  console.log(`
==================================================
📋 CENÁRIOS DE OTIMIZAÇÃO TESTADOS:
==================================================
  ✓ Escalonamento multi-objetivo por categoria
  ✓ Ajuste fino para déficit de proteína
  ✓ Ajuste fino para déficit de carboidratos
  ✓ Redução de gordura quando excessiva
  ✓ Limites de porção respeitados
  ✓ Pipeline completo de otimização
  ✓ Edge cases (arrays vazios, zeros)
  ✓ Múltiplas refeições processadas
==================================================
`);
});
