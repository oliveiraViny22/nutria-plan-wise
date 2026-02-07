/**
 * Testes de auditoria para a regra de equivalência calórica entre opções
 * Verifica se todas as 3 opções de cada refeição têm ±5% de variância
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertLessOrEqual } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { 
  GENERATOR_CONTRACT,
  type MacroTargets 
} from "../_shared/nutrition-contracts.ts";

// =====================================================
// Constantes de teste
// =====================================================

const MAX_VARIANCE = GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT / 100; // 0.05

// Simula estrutura de MealWithOptions
interface FoodSelection {
  food: { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; category: string; };
  role_name: string;
  quantity_grams: number;
}

interface MealOption {
  totals: { calories: number; protein: number; carbs: number; fat: number; };
  foods: FoodSelection[];
}

interface MealWithOptions {
  mealType: string;
  options: MealOption[];
}

// Funções auxiliares de validação (espelho das funções do gerador)
function validateOptionCalorieEquivalence(mwo: MealWithOptions[]): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  for (const meal of mwo) {
    if (meal.options.length <= 1) continue;
    
    const optionCalories = meal.options.map(opt => opt.totals.calories);
    const avgCalories = optionCalories.reduce((a, b) => a + b, 0) / optionCalories.length;
    
    for (let optIdx = 0; optIdx < meal.options.length; optIdx++) {
      const cals = optionCalories[optIdx];
      const variance = Math.abs(cals - avgCalories) / avgCalories;
      
      if (variance > MAX_VARIANCE) {
        warnings.push(
          `[${meal.mealType}] Opção ${optIdx + 1} com ${cals} kcal ` +
          `(${Math.round(variance * 100)}% de variância da média ${Math.round(avgCalories)} kcal)`
        );
      }
    }
  }
  
  return { isValid: warnings.length === 0, warnings };
}

// =====================================================
// Testes do contrato MAX_OPTION_CALORIE_VARIANCE_PERCENT
// =====================================================

Deno.test("GENERATOR_CONTRACT - MAX_OPTION_CALORIE_VARIANCE_PERCENT é 5%", () => {
  assertEquals(GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT, 5);
});

// =====================================================
// Testes de equivalência calórica
// =====================================================

Deno.test("Opções com <5% variância passam validação", () => {
  const meal: MealWithOptions = {
    mealType: "lunch",
    options: [
      { totals: { calories: 600, protein: 40, carbs: 60, fat: 20 }, foods: [] },
      { totals: { calories: 615, protein: 38, carbs: 62, fat: 22 }, foods: [] }, // +2.5%
      { totals: { calories: 585, protein: 42, carbs: 58, fat: 18 }, foods: [] }, // -2.5%
    ]
  };
  
  const result = validateOptionCalorieEquivalence([meal]);
  assertEquals(result.isValid, true, "Variância <5% deve passar");
  assertEquals(result.warnings.length, 0);
});

Deno.test("Opções com exatamente 5% variância passam validação", () => {
  // Média = 600, tolerância = 30 (5%)
  const meal: MealWithOptions = {
    mealType: "dinner",
    options: [
      { totals: { calories: 600, protein: 40, carbs: 60, fat: 20 }, foods: [] },
      { totals: { calories: 630, protein: 38, carbs: 62, fat: 22 }, foods: [] }, // +5%
      { totals: { calories: 570, protein: 42, carbs: 58, fat: 18 }, foods: [] }, // -5%
    ]
  };
  
  const result = validateOptionCalorieEquivalence([meal]);
  assertEquals(result.isValid, true, "Variância exata de 5% deve passar");
});

Deno.test("Opções com >5% variância falham validação", () => {
  const meal: MealWithOptions = {
    mealType: "lunch",
    options: [
      { totals: { calories: 600, protein: 40, carbs: 60, fat: 20 }, foods: [] },
      { totals: { calories: 700, protein: 38, carbs: 62, fat: 22 }, foods: [] }, // +16.7%
      { totals: { calories: 500, protein: 42, carbs: 58, fat: 18 }, foods: [] }, // -16.7%
    ]
  };
  
  const result = validateOptionCalorieEquivalence([meal]);
  assertEquals(result.isValid, false, "Variância >5% deve falhar");
  assertEquals(result.warnings.length, 2, "Deve ter 2 warnings (opções 2 e 3 fora da tolerância)");
});

Deno.test("Refeição com apenas 1 opção é ignorada (sem validação)", () => {
  const meal: MealWithOptions = {
    mealType: "breakfast",
    options: [
      { totals: { calories: 400, protein: 20, carbs: 50, fat: 15 }, foods: [] },
    ]
  };
  
  const result = validateOptionCalorieEquivalence([meal]);
  assertEquals(result.isValid, true, "Refeição com 1 opção deve passar automaticamente");
  assertEquals(result.warnings.length, 0);
});

Deno.test("Múltiplas refeições - algumas válidas, algumas inválidas", () => {
  const meals: MealWithOptions[] = [
    {
      mealType: "breakfast",
      options: [
        { totals: { calories: 400, protein: 20, carbs: 50, fat: 15 }, foods: [] },
        { totals: { calories: 410, protein: 21, carbs: 51, fat: 14 }, foods: [] }, // +2.5% OK
        { totals: { calories: 390, protein: 19, carbs: 49, fat: 16 }, foods: [] }, // -2.5% OK
      ]
    },
    {
      mealType: "lunch",
      options: [
        { totals: { calories: 700, protein: 50, carbs: 70, fat: 25 }, foods: [] },
        { totals: { calories: 800, protein: 45, carbs: 80, fat: 30 }, foods: [] }, // +14% FALHA
        { totals: { calories: 600, protein: 55, carbs: 60, fat: 20 }, foods: [] }, // -14% FALHA
      ]
    },
    {
      mealType: "afternoon_snack",
      options: [
        { totals: { calories: 200, protein: 10, carbs: 25, fat: 8 }, foods: [] },
        { totals: { calories: 205, protein: 11, carbs: 26, fat: 7 }, foods: [] }, // OK
      ]
    },
  ];
  
  const result = validateOptionCalorieEquivalence(meals);
  assertEquals(result.isValid, false, "Lunch inválido deve falhar o plano");
  assertEquals(result.warnings.length, 2, "Apenas lunch tem opções fora da tolerância");
  assertEquals(result.warnings.some(w => w.includes("lunch")), true);
});

// =====================================================
// Testes de cenários reais
// =====================================================

Deno.test("Cenário real: variância de 14.5% como no caso reportado", () => {
  // Reproduz o cenário do admin@nutriaplan.com onde o consumo foi 14.5% abaixo da meta
  const meals: MealWithOptions[] = [
    {
      mealType: "breakfast",
      options: [
        { totals: { calories: 550, protein: 30, carbs: 70, fat: 18 }, foods: [] },
        { totals: { calories: 480, protein: 25, carbs: 60, fat: 16 }, foods: [] }, // -12.7%
        { totals: { calories: 470, protein: 24, carbs: 58, fat: 15 }, foods: [] }, // -14.5%
      ]
    },
  ];
  
  const result = validateOptionCalorieEquivalence(meals);
  assertEquals(result.isValid, false, "14.5% de variância deve falhar");
  assertEquals(result.warnings.length >= 1, true, "Deve ter pelo menos 1 warning");
});

Deno.test("Cenário ideal: todas opções dentro de 3% da referência", () => {
  const meals: MealWithOptions[] = [
    {
      mealType: "breakfast",
      options: [
        { totals: { calories: 450, protein: 25, carbs: 55, fat: 15 }, foods: [] },
        { totals: { calories: 460, protein: 26, carbs: 56, fat: 14 }, foods: [] }, // +2.2%
        { totals: { calories: 440, protein: 24, carbs: 54, fat: 16 }, foods: [] }, // -2.2%
      ]
    },
    {
      mealType: "lunch",
      options: [
        { totals: { calories: 680, protein: 45, carbs: 85, fat: 20 }, foods: [] },
        { totals: { calories: 695, protein: 46, carbs: 87, fat: 19 }, foods: [] }, // +2.2%
        { totals: { calories: 670, protein: 44, carbs: 83, fat: 21 }, foods: [] }, // -1.5%
      ]
    },
    {
      mealType: "dinner",
      options: [
        { totals: { calories: 620, protein: 40, carbs: 75, fat: 18 }, foods: [] },
        { totals: { calories: 630, protein: 41, carbs: 76, fat: 17 }, foods: [] }, // +1.6%
        { totals: { calories: 615, protein: 39, carbs: 74, fat: 19 }, foods: [] }, // -0.8%
      ]
    },
  ];
  
  const result = validateOptionCalorieEquivalence(meals);
  assertEquals(result.isValid, true, "Variância <3% deve passar com folga");
  assertEquals(result.warnings.length, 0);
});

// =====================================================
// Testes de edge cases
// =====================================================

Deno.test("Edge case: opção com 0 calorias", () => {
  const meal: MealWithOptions = {
    mealType: "snack",
    options: [
      { totals: { calories: 200, protein: 10, carbs: 25, fat: 8 }, foods: [] },
      { totals: { calories: 0, protein: 0, carbs: 0, fat: 0 }, foods: [] }, // Vazio
      { totals: { calories: 210, protein: 11, carbs: 26, fat: 7 }, foods: [] },
    ]
  };
  
  const result = validateOptionCalorieEquivalence([meal]);
  // Média = (200+0+210)/3 = 136.7
  // Opção 2 (0 kcal) tem 100% de variância → FALHA
  assertEquals(result.isValid, false, "Opção vazia deve falhar validação");
});

Deno.test("Edge case: plano sem refeições", () => {
  const result = validateOptionCalorieEquivalence([]);
  assertEquals(result.isValid, true, "Plano vazio deve passar (nada a validar)");
  assertEquals(result.warnings.length, 0);
});

Deno.test("Edge case: refeição sem opções", () => {
  const meal: MealWithOptions = {
    mealType: "lunch",
    options: []
  };
  
  const result = validateOptionCalorieEquivalence([meal]);
  assertEquals(result.isValid, true, "Refeição sem opções deve passar");
});

// =====================================================
// Teste de cálculo de variância
// =====================================================

Deno.test("Cálculo de variância: fórmula correta", () => {
  // Opções: 600, 630, 570
  // Média: 600
  // Variância Opção 1: |600-600|/600 = 0%
  // Variância Opção 2: |630-600|/600 = 5%
  // Variância Opção 3: |570-600|/600 = 5%
  
  const meal: MealWithOptions = {
    mealType: "test",
    options: [
      { totals: { calories: 600, protein: 0, carbs: 0, fat: 0 }, foods: [] },
      { totals: { calories: 630, protein: 0, carbs: 0, fat: 0 }, foods: [] },
      { totals: { calories: 570, protein: 0, carbs: 0, fat: 0 }, foods: [] },
    ]
  };
  
  const optionCalories = meal.options.map(opt => opt.totals.calories);
  const avgCalories = optionCalories.reduce((a, b) => a + b, 0) / optionCalories.length;
  
  assertEquals(avgCalories, 600, "Média deve ser 600");
  
  const variance1 = Math.abs(600 - 600) / 600;
  const variance2 = Math.abs(630 - 600) / 600;
  const variance3 = Math.abs(570 - 600) / 600;
  
  assertEquals(variance1, 0, "Variância Opção 1 = 0%");
  assertEquals(variance2, 0.05, "Variância Opção 2 = 5%");
  assertEquals(variance3, 0.05, "Variância Opção 3 = 5%");
  
  // Todas <= MAX_VARIANCE (5%)
  assertLessOrEqual(variance1, MAX_VARIANCE);
  assertLessOrEqual(variance2, MAX_VARIANCE);
  assertLessOrEqual(variance3, MAX_VARIANCE);
});
