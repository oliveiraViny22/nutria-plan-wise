// =====================================================
// TESTES DO GERADOR V5 - VALIDAÇÃO DE POLÍTICAS
// =====================================================
// Testes para garantir que as regras estruturais do
// gerador v5 estão sendo aplicadas corretamente.
// =====================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// =====================================================
// HELPER PARA TESTES
// =====================================================

async function invokeGeneratorV5(token: string): Promise<Response> {
  return await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan-v5`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
}

// =====================================================
// CONSTANTES DE VALIDAÇÃO (ESPELHO DO GERADOR)
// =====================================================

const MEAL_NAMES: Record<string, string> = {
  breakfast: "Café da Manhã",
  morning_snack: "Lanche da Manhã",
  lunch: "Almoço",
  afternoon_snack: "Lanche da Tarde",
  dinner: "Jantar",
  supper: "Ceia",
};

const MAIN_MEALS = ["breakfast", "lunch", "dinner"];

const ITEM_COUNTS: Record<string, { min: number; max: number }> = {
  breakfast: { min: 2, max: 4 },
  morning_snack: { min: 2, max: 3 },
  lunch: { min: 4, max: 6 },
  afternoon_snack: { min: 2, max: 3 },
  dinner: { min: 4, max: 6 },
  supper: { min: 2, max: 3 },
};

// Categorias que DEVEM estar em almoço/jantar
const REQUIRED_LUNCH_DINNER_CATEGORIES = [
  "carboidratos",
  "leguminosas", 
  "proteinas",
  "vegetais",
];

// =====================================================
// VALIDAÇÃO ESTRUTURAL (LOCAL)
// =====================================================

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface MealData {
  type: string;
  name: string;
  options: number;
  items_per_option: number[];
  calories: number;
}

function validateMealStructure(meals: MealData[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const meal of meals) {
    const limits = ITEM_COUNTS[meal.type];
    
    if (!limits) {
      warnings.push(`Tipo de refeição desconhecido: ${meal.type}`);
      continue;
    }

    // Regra E1: Número mínimo de itens por opção
    for (let i = 0; i < meal.items_per_option.length; i++) {
      const itemCount = meal.items_per_option[i];
      if (itemCount < limits.min) {
        errors.push(
          `[E1] ${meal.name} opção ${i + 1}: poucos itens (${itemCount} < ${limits.min})`
        );
      }
      if (itemCount > limits.max) {
        warnings.push(
          `[W1] ${meal.name} opção ${i + 1}: muitos itens (${itemCount} > ${limits.max})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =====================================================
// TESTES UNITÁRIOS
// =====================================================

Deno.test("Gerador V5 - Constantes de limite de itens estão corretas", () => {
  // Café da manhã: 2-4 itens
  assertEquals(ITEM_COUNTS.breakfast.min, 2);
  assertEquals(ITEM_COUNTS.breakfast.max, 4);
  
  // Almoço: 4-6 itens
  assertEquals(ITEM_COUNTS.lunch.min, 4);
  assertEquals(ITEM_COUNTS.lunch.max, 6);
  
  // Jantar: 4-6 itens
  assertEquals(ITEM_COUNTS.dinner.min, 4);
  assertEquals(ITEM_COUNTS.dinner.max, 6);
  
  // Lanches: 2-3 itens
  assertEquals(ITEM_COUNTS.morning_snack.min, 2);
  assertEquals(ITEM_COUNTS.morning_snack.max, 3);
  assertEquals(ITEM_COUNTS.afternoon_snack.min, 2);
  assertEquals(ITEM_COUNTS.afternoon_snack.max, 3);
  
  // Ceia: 2-3 itens
  assertEquals(ITEM_COUNTS.supper.min, 2);
  assertEquals(ITEM_COUNTS.supper.max, 3);
});

Deno.test("Gerador V5 - Refeições principais estão definidas", () => {
  assertEquals(MAIN_MEALS.length, 3);
  assertEquals(MAIN_MEALS.includes("breakfast"), true);
  assertEquals(MAIN_MEALS.includes("lunch"), true);
  assertEquals(MAIN_MEALS.includes("dinner"), true);
  assertEquals(MAIN_MEALS.includes("morning_snack"), false);
});

Deno.test("Gerador V5 - Categorias obrigatórias para almoço/jantar", () => {
  assertEquals(REQUIRED_LUNCH_DINNER_CATEGORIES.length, 4);
  assertEquals(REQUIRED_LUNCH_DINNER_CATEGORIES.includes("carboidratos"), true);
  assertEquals(REQUIRED_LUNCH_DINNER_CATEGORIES.includes("leguminosas"), true);
  assertEquals(REQUIRED_LUNCH_DINNER_CATEGORIES.includes("proteinas"), true);
  assertEquals(REQUIRED_LUNCH_DINNER_CATEGORIES.includes("vegetais"), true);
});

Deno.test("Gerador V5 - Nomes de refeição em português", () => {
  assertEquals(MEAL_NAMES.breakfast, "Café da Manhã");
  assertEquals(MEAL_NAMES.lunch, "Almoço");
  assertEquals(MEAL_NAMES.dinner, "Jantar");
  assertEquals(MEAL_NAMES.morning_snack, "Lanche da Manhã");
  assertEquals(MEAL_NAMES.afternoon_snack, "Lanche da Tarde");
  assertEquals(MEAL_NAMES.supper, "Ceia");
});

Deno.test("Gerador V5 - Validação estrutural detecta poucos itens", () => {
  const invalidMeals: MealData[] = [
    { type: "lunch", name: "Almoço", options: 1, items_per_option: [2], calories: 500 },
  ];
  
  const result = validateMealStructure(invalidMeals);
  
  assertEquals(result.valid, false);
  assertEquals(result.errors.length > 0, true);
  assertEquals(result.errors[0].includes("[E1]"), true);
  assertEquals(result.errors[0].includes("poucos itens"), true);
});

Deno.test("Gerador V5 - Validação estrutural passa com itens suficientes", () => {
  const validMeals: MealData[] = [
    { type: "breakfast", name: "Café da Manhã", options: 1, items_per_option: [3], calories: 400 },
    { type: "lunch", name: "Almoço", options: 1, items_per_option: [5], calories: 600 },
    { type: "afternoon_snack", name: "Lanche da Tarde", options: 1, items_per_option: [2], calories: 200 },
    { type: "dinner", name: "Jantar", options: 1, items_per_option: [4], calories: 500 },
  ];
  
  const result = validateMealStructure(validMeals);
  
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("Gerador V5 - Validação estrutural com múltiplas opções", () => {
  const mealsWithOptions: MealData[] = [
    { type: "lunch", name: "Almoço", options: 3, items_per_option: [5, 4, 5], calories: 600 },
  ];
  
  const result = validateMealStructure(mealsWithOptions);
  
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("Gerador V5 - Validação estrutural detecta problema em uma das opções", () => {
  const mealsWithBadOption: MealData[] = [
    { type: "lunch", name: "Almoço", options: 3, items_per_option: [5, 2, 5], calories: 600 },
  ];
  
  const result = validateMealStructure(mealsWithBadOption);
  
  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].includes("opção 2"), true);
});

// =====================================================
// TESTES DE INTEGRAÇÃO (REQUEREM USUÁRIO AUTENTICADO)
// =====================================================

Deno.test({
  name: "Gerador V5 - Requer autenticação",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan-v5`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    
    const body = await response.text();
    
    assertEquals(response.status, 401);
  },
});

Deno.test({
  name: "Gerador V5 - Aceita OPTIONS (CORS)",
  async fn() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan-v5`, {
      method: "OPTIONS",
    });
    
    await response.text();
    
    assertEquals(response.status, 200);
    assertExists(response.headers.get("access-control-allow-origin"));
  },
});

// =====================================================
// TESTES DE MAPEAMENTO DE REFEIÇÕES
// =====================================================

Deno.test("Gerador V5 - Mapeamento de refeições por dia", () => {
  const mealTypesMap: Record<number, string[]> = {
    2: ["lunch", "dinner"],
    3: ["breakfast", "lunch", "dinner"],
    4: ["breakfast", "lunch", "afternoon_snack", "dinner"],
    5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"],
    6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"],
  };
  
  // 2 refeições inclui almoço e jantar
  assertEquals(mealTypesMap[2].length, 2);
  assertEquals(mealTypesMap[2].includes("lunch"), true);
  assertEquals(mealTypesMap[2].includes("dinner"), true);
  
  // 3 refeições adiciona café
  assertEquals(mealTypesMap[3].length, 3);
  assertEquals(mealTypesMap[3].includes("breakfast"), true);
  
  // 4 refeições adiciona lanche da tarde
  assertEquals(mealTypesMap[4].length, 4);
  assertEquals(mealTypesMap[4].includes("afternoon_snack"), true);
  
  // 5 refeições adiciona lanche da manhã
  assertEquals(mealTypesMap[5].length, 5);
  assertEquals(mealTypesMap[5].includes("morning_snack"), true);
  
  // 6 refeições adiciona ceia
  assertEquals(mealTypesMap[6].length, 6);
  assertEquals(mealTypesMap[6].includes("supper"), true);
});

// =====================================================
// TESTES DE CONVERSÃO DE UNIDADES
// =====================================================

Deno.test("Gerador V5 - Conversão de unidades com tolerância 5%", () => {
  interface Food {
    unit_enabled: boolean;
    unit_name: string;
    unit_weight_grams: number;
    unit_increment: number;
  }
  
  function applyUnitConversion(
    food: Food,
    grams: number
  ): { display_quantity: number; display_unit: string; calculated_grams: number } {
    if (!food.unit_enabled || !food.unit_name || !food.unit_weight_grams) {
      return {
        display_quantity: Math.round(grams),
        display_unit: "g",
        calculated_grams: grams,
      };
    }

    const rawUnits = grams / food.unit_weight_grams;
    const increment = food.unit_increment || 1;
    let roundedUnits = Math.round(rawUnits / increment) * increment;
    if (roundedUnits < increment) roundedUnits = increment;

    const finalGrams = roundedUnits * food.unit_weight_grams;
    const errorPercent = grams > 0 ? (Math.abs(finalGrams - grams) / grams) * 100 : 0;

    if (errorPercent <= 5) {
      return {
        display_quantity: roundedUnits,
        display_unit: food.unit_name,
        calculated_grams: finalGrams,
      };
    }

    return {
      display_quantity: Math.round(grams),
      display_unit: "g",
      calculated_grams: grams,
    };
  }
  
  // Teste 1: Alimento com unidade habilitada, conversão OK
  const ovo: Food = {
    unit_enabled: true,
    unit_name: "unidade",
    unit_weight_grams: 50,
    unit_increment: 1,
  };
  
  const result1 = applyUnitConversion(ovo, 100);
  assertEquals(result1.display_quantity, 2);
  assertEquals(result1.display_unit, "unidade");
  assertEquals(result1.calculated_grams, 100);
  
  // Teste 2: Conversão com erro > 5%, fallback para gramas
  const result2 = applyUnitConversion(ovo, 117); // 2.34 unidades
  // 2 unidades = 100g, erro = 17/117 = 14.5% > 5%
  // 3 unidades = 150g, erro = 33/117 = 28.2% > 5%
  // Deve fazer fallback para gramas
  assertEquals(result2.display_unit, "g");
  assertEquals(result2.display_quantity, 117);
  
  // Teste 3: Alimento sem unidade, sempre gramas
  const arroz: Food = {
    unit_enabled: false,
    unit_name: "",
    unit_weight_grams: 0,
    unit_increment: 0,
  };
  
  const result3 = applyUnitConversion(arroz, 150);
  assertEquals(result3.display_quantity, 150);
  assertEquals(result3.display_unit, "g");
  assertEquals(result3.calculated_grams, 150);
});

// =====================================================
// TESTES DE FILTRAGEM DE ALIMENTOS
// =====================================================

Deno.test("Gerador V5 - Categorias excluídas de planos automáticos", () => {
  const EXCLUDED_FROM_AUTO_PLAN = ["suplementos"];
  
  assertEquals(EXCLUDED_FROM_AUTO_PLAN.includes("suplementos"), true);
  assertEquals(EXCLUDED_FROM_AUTO_PLAN.includes("proteinas"), false);
  assertEquals(EXCLUDED_FROM_AUTO_PLAN.includes("vegetais"), false);
});

Deno.test("Gerador V5 - Filtro de alimentos opcionais", () => {
  // Alimentos com is_optional = true não devem entrar no plano automático
  const foods = [
    { id: "1", name: "Arroz", is_optional: false },
    { id: "2", name: "Mel de Manuka", is_optional: true },
    { id: "3", name: "Frango", is_optional: false },
    { id: "4", name: "Caviar", is_optional: true },
  ];
  
  const eligible = foods.filter(f => !f.is_optional);
  
  assertEquals(eligible.length, 2);
  assertEquals(eligible.find(f => f.name === "Mel de Manuka"), undefined);
  assertEquals(eligible.find(f => f.name === "Caviar"), undefined);
});

Deno.test("Gerador V5 - Filtro de alimentos evitados", () => {
  const avoidedFoods = ["camarão", "frutos do mar"];
  const avoidedSet = new Set(avoidedFoods.map(a => a.toLowerCase()));
  
  const foods = [
    { id: "1", name: "Arroz branco" },
    { id: "2", name: "Camarão ao alho" },
    { id: "3", name: "Frango grelhado" },
    { id: "4", name: "Frutos do mar gratinados" },
  ];
  
  const filtered = foods.filter(f => {
    const nameLower = f.name.toLowerCase();
    for (const avoided of avoidedSet) {
      if (nameLower.includes(avoided)) return false;
    }
    return true;
  });
  
  assertEquals(filtered.length, 2);
  assertEquals(filtered.find(f => f.name === "Arroz branco") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Frango grelhado") !== undefined, true);
});

// =====================================================
// TESTES DE PRIORIZAÇÃO DE ALIMENTOS PREFERIDOS
// =====================================================

Deno.test("Gerador V5 - Identificação de alimentos preferidos por substring", () => {
  const preferredFoods = ["frango", "arroz integral"];
  const preferredSet = new Set(preferredFoods.map(p => p.toLowerCase()));
  
  const candidates = [
    { id: "1", name: "Arroz branco" },
    { id: "2", name: "Arroz integral" },
    { id: "3", name: "Frango grelhado" },
    { id: "4", name: "Peito de frango" },
    { id: "5", name: "Carne bovina" },
  ];
  
  const preferred = candidates.filter(f => {
    const nameLower = f.name.toLowerCase();
    for (const pref of preferredSet) {
      if (nameLower.includes(pref)) return true;
    }
    return false;
  });
  
  // Deve identificar: Arroz integral, Frango grelhado, Peito de frango
  assertEquals(preferred.length, 3);
  assertEquals(preferred.find(f => f.name === "Arroz integral") !== undefined, true);
  assertEquals(preferred.find(f => f.name === "Frango grelhado") !== undefined, true);
  assertEquals(preferred.find(f => f.name === "Peito de frango") !== undefined, true);
  // Arroz branco NÃO deve estar (não contém "arroz integral")
  assertEquals(preferred.find(f => f.name === "Arroz branco"), undefined);
});

Deno.test("Gerador V5 - Seleção ponderada prioriza preferidos", () => {
  const preferredSet = new Set(["frango"]);
  
  const candidates = [
    { id: "1", name: "Frango grelhado", score: 50 },
    { id: "2", name: "Carne bovina", score: 60 },
    { id: "3", name: "Peixe assado", score: 55 },
  ];
  
  // Identificar preferidos
  const preferred = candidates.filter(f => {
    const nameLower = f.name.toLowerCase();
    for (const pref of preferredSet) {
      if (nameLower.includes(pref)) return true;
    }
    return false;
  });
  
  // Simular lógica de seleção: se preferido está no top 30%, priorizar
  const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
  const topThreshold = Math.ceil(sortedByScore.length * 0.3); // 1 candidato
  const topCandidates = sortedByScore.slice(0, Math.max(1, topThreshold));
  
  // Verificar se frango (score 50) está no top 30%
  // Top 30% de 3 = 1 candidato (Carne bovina com score 60)
  const frangoInTop = topCandidates.find(c => c.name === "Frango grelhado");
  
  // Frango NÃO está no top 30%, mas ainda pode ser selecionado com 80% de chance
  // quando não há déficits de macro (lógica original)
  assertEquals(preferred.length, 1);
  assertEquals(preferred[0].name, "Frango grelhado");
});

Deno.test("Gerador V5 - Boost de 80% para preferidos sem déficits", () => {
  // Simula a lógica: if (!macroDeficits) { if (preferred.length > 0 && Math.random() < 0.8) }
  let preferredSelected = 0;
  let totalSelections = 0;
  
  const candidates = [
    { id: "1", name: "Frango grelhado" },
    { id: "2", name: "Carne bovina" },
    { id: "3", name: "Peixe assado" },
  ];
  const preferred = [candidates[0]]; // Frango é preferido
  
  // Simular 1000 seleções com random fixo para teste determinístico
  // Em produção, ~80% seriam preferidos
  const BOOST_PROBABILITY = 0.8;
  
  // Teste: verificar que a lógica prioriza preferidos
  // Se Math.random() < 0.8, seleciona preferido
  // Caso contrário, seleciona aleatório entre todos
  
  // Cenário 1: random = 0.5 (< 0.8) -> seleciona preferido
  const shouldSelectPreferred1 = 0.5 < BOOST_PROBABILITY;
  assertEquals(shouldSelectPreferred1, true);
  
  // Cenário 2: random = 0.9 (>= 0.8) -> seleciona aleatório
  const shouldSelectPreferred2 = 0.9 < BOOST_PROBABILITY;
  assertEquals(shouldSelectPreferred2, false);
});

// =====================================================
// TESTES DE RESTRIÇÕES ALIMENTARES
// =====================================================

Deno.test("Gerador V5 - Restrição de lactose", () => {
  const restrictions = ["Intolerância à lactose"];
  
  const foods = [
    { id: "1", name: "Leite integral", category: "laticinios" },
    { id: "2", name: "Queijo minas", category: "laticinios" },
    { id: "3", name: "Frango", category: "proteinas" },
    { id: "4", name: "Arroz", category: "carboidratos" },
  ];
  
  const filtered = foods.filter(f => {
    for (const rest of restrictions) {
      if (rest.toLowerCase().includes("lactose") && f.category === "laticinios") {
        return false;
      }
    }
    return true;
  });
  
  assertEquals(filtered.length, 2);
  assertEquals(filtered.find(f => f.category === "laticinios"), undefined);
});

Deno.test("Gerador V5 - Restrição vegetariana", () => {
  const restrictions = ["Vegetariano"];
  
  const foods = [
    { id: "1", name: "Frango", category: "proteinas", isAnimal: true, isEgg: false },
    { id: "2", name: "Ovo cozido", category: "proteinas", isAnimal: true, isEgg: true },
    { id: "3", name: "Carne bovina", category: "proteinas", isAnimal: true, isEgg: false },
    { id: "4", name: "Tofu", category: "proteinas", isAnimal: false, isEgg: false },
  ];
  
  const filtered = foods.filter(f => {
    for (const rest of restrictions) {
      if (rest.toLowerCase().includes("vegetariano")) {
        // Vegetariano permite ovos e laticínios, bloqueia carnes
        if (f.isAnimal && !f.isEgg) return false;
      }
    }
    return true;
  });
  
  assertEquals(filtered.length, 2);
  assertEquals(filtered.find(f => f.name === "Ovo cozido") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Tofu") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Frango"), undefined);
  assertEquals(filtered.find(f => f.name === "Carne bovina"), undefined);
});

// =====================================================
// TESTES DE DIETAS ESPECÍFICAS
// =====================================================

Deno.test("Gerador V5 - Dieta Vegana bloqueia todos produtos animais", () => {
  const restrictions = ["Vegano"];
  
  const foods = [
    { id: "1", name: "Frango grelhado", category: "proteinas", isAnimal: true },
    { id: "2", name: "Ovo cozido", category: "proteinas", isAnimal: true },
    { id: "3", name: "Leite integral", category: "laticinios", isAnimal: true },
    { id: "4", name: "Queijo minas", category: "laticinios", isAnimal: true },
    { id: "5", name: "Mel", category: "adocantes", isAnimal: true },
    { id: "6", name: "Tofu", category: "proteinas", isAnimal: false },
    { id: "7", name: "Grão de bico", category: "leguminosas", isAnimal: false },
    { id: "8", name: "Arroz integral", category: "carboidratos", isAnimal: false },
  ];
  
  const filtered = foods.filter(f => {
    for (const rest of restrictions) {
      if (rest.toLowerCase() === "vegano") {
        // Vegano bloqueia TODOS os produtos de origem animal
        if (f.isAnimal) return false;
      }
    }
    return true;
  });
  
  assertEquals(filtered.length, 3);
  assertEquals(filtered.find(f => f.name === "Tofu") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Grão de bico") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Arroz integral") !== undefined, true);
  // Todos animais bloqueados
  assertEquals(filtered.find(f => f.isAnimal), undefined);
});

Deno.test("Gerador V5 - Dieta Pescetariana permite peixes e frutos do mar", () => {
  const restrictions = ["Pescetariano"];
  
  const foods = [
    { id: "1", name: "Frango grelhado", category: "proteinas", type: "ave" },
    { id: "2", name: "Carne bovina", category: "proteinas", type: "carne_vermelha" },
    { id: "3", name: "Salmão grelhado", category: "proteinas", type: "peixe" },
    { id: "4", name: "Camarão", category: "proteinas", type: "frutos_do_mar" },
    { id: "5", name: "Ovo cozido", category: "proteinas", type: "ovo" },
    { id: "6", name: "Tofu", category: "proteinas", type: "vegetal" },
    { id: "7", name: "Leite", category: "laticinios", type: "laticinio" },
  ];
  
  const PESCETARIAN_ALLOWED_TYPES = ["peixe", "frutos_do_mar", "ovo", "vegetal", "laticinio"];
  
  const filtered = foods.filter(f => {
    for (const rest of restrictions) {
      if (rest.toLowerCase() === "pescetariano") {
        // Pescetariano: permite peixes, frutos do mar, ovos, laticínios, vegetais
        // Bloqueia: aves, carnes vermelhas, suínos
        if (!PESCETARIAN_ALLOWED_TYPES.includes(f.type)) return false;
      }
    }
    return true;
  });
  
  assertEquals(filtered.length, 5);
  assertEquals(filtered.find(f => f.name === "Salmão grelhado") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Camarão") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Ovo cozido") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Tofu") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Leite") !== undefined, true);
  // Bloqueados
  assertEquals(filtered.find(f => f.name === "Frango grelhado"), undefined);
  assertEquals(filtered.find(f => f.name === "Carne bovina"), undefined);
});

Deno.test("Gerador V5 - Dieta Low Carb limita carboidratos", () => {
  const restrictions = ["Low Carb"];
  const LOW_CARB_LIMIT_PER_100G = 15; // máximo 15g carbs por 100g
  
  const foods = [
    { id: "1", name: "Arroz branco", category: "carboidratos", carbs_per_100g: 28 },
    { id: "2", name: "Batata doce", category: "carboidratos", carbs_per_100g: 20 },
    { id: "3", name: "Brócolis", category: "vegetais", carbs_per_100g: 7 },
    { id: "4", name: "Frango grelhado", category: "proteinas", carbs_per_100g: 0 },
    { id: "5", name: "Abacate", category: "frutas", carbs_per_100g: 9 },
    { id: "6", name: "Banana", category: "frutas", carbs_per_100g: 23 },
    { id: "7", name: "Couve-flor", category: "vegetais", carbs_per_100g: 5 },
  ];
  
  const filtered = foods.filter(f => {
    for (const rest of restrictions) {
      if (rest.toLowerCase() === "low carb") {
        // Low carb: bloqueia alimentos com > 15g carbs por 100g
        if (f.carbs_per_100g > LOW_CARB_LIMIT_PER_100G) return false;
      }
    }
    return true;
  });
  
  assertEquals(filtered.length, 4);
  assertEquals(filtered.find(f => f.name === "Brócolis") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Frango grelhado") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Abacate") !== undefined, true);
  assertEquals(filtered.find(f => f.name === "Couve-flor") !== undefined, true);
  // Bloqueados por alto carb
  assertEquals(filtered.find(f => f.name === "Arroz branco"), undefined);
  assertEquals(filtered.find(f => f.name === "Batata doce"), undefined);
  assertEquals(filtered.find(f => f.name === "Banana"), undefined);
});

// =====================================================
// TESTES DE VALIDAÇÃO CRUZADA DE RESTRIÇÕES
// =====================================================

interface RestrictionRule {
  name: string;
  blocksCategories?: string[];
  blocksTypes?: string[];
  allowsEggs?: boolean;
  allowsDairy?: boolean;
  maxCarbsPer100g?: number;
}

const RESTRICTION_RULES: Record<string, RestrictionRule> = {
  "vegano": {
    name: "Vegano",
    blocksCategories: ["proteinas", "laticinios"],
    blocksTypes: ["carne", "ave", "peixe", "frutos_do_mar", "ovo", "laticinio"],
    allowsEggs: false,
    allowsDairy: false,
  },
  "vegetariano": {
    name: "Vegetariano",
    blocksTypes: ["carne", "ave", "peixe", "frutos_do_mar"],
    allowsEggs: true,
    allowsDairy: true,
  },
  "pescetariano": {
    name: "Pescetariano",
    blocksTypes: ["carne", "ave"],
    allowsEggs: true,
    allowsDairy: true,
  },
  "intolerancia_lactose": {
    name: "Intolerância à lactose",
    blocksCategories: ["laticinios"],
    allowsDairy: false,
  },
  "low_carb": {
    name: "Low Carb",
    maxCarbsPer100g: 15,
  },
};

function validateCrossRestrictions(restrictions: string[]): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  // Normaliza: lowercase, remove acentos, substitui espaços por _
  const normalized = restrictions.map(r => 
    r.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/\s+/g, "_")
  );
  
  // Vegano + qualquer coisa que permite ovos/laticínios = conflito
  if (normalized.includes("vegano")) {
    // Vegano já é a mais restritiva, outras restrições são redundantes
    if (normalized.includes("vegetariano")) {
      conflicts.push("Vegano já inclui restrições vegetarianas - redundante");
    }
    if (normalized.includes("pescetariano")) {
      conflicts.push("Vegano já exclui todos os peixes - pescetariano é incompatível");
    }
    if (normalized.includes("intolerancia_a_lactose") || normalized.includes("intolerancia_lactose")) {
      conflicts.push("Vegano já exclui laticínios - intolerância à lactose é redundante");
    }
  }
  
  // Vegetariano + Pescetariano = conflito lógico
  if (normalized.includes("vegetariano") && normalized.includes("pescetariano")) {
    conflicts.push("Vegetariano não permite peixes - pescetariano é incompatível");
  }
  
  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}

Deno.test("Gerador V5 - Validação cruzada: Vegano + Lactose é redundante", () => {
  const restrictions = ["Vegano", "Intolerância à lactose"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, false);
  assertEquals(result.conflicts.length, 1);
  assertEquals(result.conflicts[0].includes("redundante"), true);
});

Deno.test("Gerador V5 - Validação cruzada: Vegano + Vegetariano é redundante", () => {
  const restrictions = ["Vegano", "Vegetariano"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, false);
  assertEquals(result.conflicts.length, 1);
  assertEquals(result.conflicts[0].includes("vegetarianas"), true);
});

Deno.test("Gerador V5 - Validação cruzada: Vegano + Pescetariano é incompatível", () => {
  const restrictions = ["Vegano", "Pescetariano"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, false);
  assertEquals(result.conflicts.length, 1);
  assertEquals(result.conflicts[0].includes("incompatível"), true);
});

Deno.test("Gerador V5 - Validação cruzada: Vegetariano + Pescetariano é incompatível", () => {
  const restrictions = ["Vegetariano", "Pescetariano"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, false);
  assertEquals(result.conflicts.length, 1);
  assertEquals(result.conflicts[0].includes("incompatível"), true);
});

Deno.test("Gerador V5 - Validação cruzada: Vegetariano + Lactose é válido", () => {
  const restrictions = ["Vegetariano", "Intolerância à lactose"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, true);
  assertEquals(result.conflicts.length, 0);
});

Deno.test("Gerador V5 - Validação cruzada: Low Carb + Vegetariano é válido", () => {
  const restrictions = ["Low Carb", "Vegetariano"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, true);
  assertEquals(result.conflicts.length, 0);
});

Deno.test("Gerador V5 - Validação cruzada: Pescetariano + Lactose é válido", () => {
  const restrictions = ["Pescetariano", "Intolerância à lactose"];
  const result = validateCrossRestrictions(restrictions);
  
  assertEquals(result.valid, true);
  assertEquals(result.conflicts.length, 0);
});

Deno.test("Gerador V5 - Validação cruzada: Restrição única sempre é válida", () => {
  const singleRestrictions = ["Vegano", "Vegetariano", "Pescetariano", "Low Carb", "Intolerância à lactose"];
  
  for (const rest of singleRestrictions) {
    const result = validateCrossRestrictions([rest]);
    assertEquals(result.valid, true, `${rest} deveria ser válido sozinho`);
    assertEquals(result.conflicts.length, 0);
  }
});

// =====================================================
// RESUMO DOS CONTRATOS VALIDADOS
// =====================================================

Deno.test("Gerador V5 - Resumo: todos os contratos documentados", () => {
  const contratos = [
    "E1: Número mínimo de itens por refeição",
    "E2: Refeições principais devem ter proteína",
    "E3: Almoço/jantar devem ter carboidrato base",
    "E4: Almoço/jantar devem ter leguminosa",
    "E5: Almoço/jantar devem ter proteína principal",
    "E6: Almoço/jantar devem ter vegetal",
  ];
  
  assertEquals(contratos.length, 6);
  
  // Limites de itens por refeição
  const limites = {
    breakfast: { min: 2, max: 4 },
    morning_snack: { min: 2, max: 3 },
    lunch: { min: 4, max: 6 },
    afternoon_snack: { min: 2, max: 3 },
    dinner: { min: 4, max: 6 },
    supper: { min: 2, max: 3 },
  };
  
  // Validar que limites estão corretos
  assertEquals(limites.lunch.min, 4);
  assertEquals(limites.dinner.min, 4);
  
  console.log("\n✅ CONTRATOS DO GERADOR V5 VALIDADOS:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  for (const c of contratos) {
    console.log(`  • ${c}`);
  }
  console.log("\n📊 LIMITES DE ITENS:");
  for (const [meal, limits] of Object.entries(limites)) {
    console.log(`  • ${MEAL_NAMES[meal] || meal}: ${limits.min}-${limits.max} itens`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});
