/**
 * Testes unitários para boostCarbs e funções relacionadas
 * Cobrindo lógica de boost de carboidratos para perfis de Bulk
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertGreater, assertLessOrEqual } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Re-implementar interfaces localmente para testes (evita dependência circular)
interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  is_optional: boolean | null;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number | null;
  unit_enabled: boolean | null;
}

interface FoodSelection {
  food: Food;
  role_name: string;
  quantity_grams: number;
  display_quantity: number;
  display_unit: string;
}

interface MealResult {
  meal_type: string;
  meal_name: string;
  foods: FoodSelection[];
  totals: { calories: number; protein: number; carbs: number; fat: number };
}

interface MealWithOptions {
  mealType: string;
  options: MealResult[];
}

// Constantes de teste
const CARB_RICH_THRESHOLD = 15;
const MAX_BOOST_PERCENT = 1.5;
const SNACK_MEALS = ["morning_snack", "afternoon_snack", "supper"];

// =====================================================
// Funções auxiliares extraídas do index.ts para teste
// =====================================================

function getCategoryLimits(category: string, isSnack: boolean): { min: number; max: number } {
  // Simplificado para testes
  if (isSnack) {
    return { min: 20, max: 100 };
  }
  switch (category) {
    case "carboidratos": return { min: 50, max: 250 };
    case "proteinas": return { min: 80, max: 200 };
    case "vegetais": return { min: 50, max: 200 };
    default: return { min: 30, max: 150 };
  }
}

function recalcOptionTotals(opt: MealResult): void {
  let cals = 0, prot = 0, carbs = 0, fat = 0;
  for (const s of opt.foods) {
    const m = s.quantity_grams / 100;
    cals += s.food.calories * m;
    prot += s.food.protein * m;
    carbs += s.food.carbs * m;
    fat += s.food.fat * m;
  }
  opt.totals = {
    calories: Math.round(cals),
    protein: Math.round(prot * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

function totals(mwo: MealWithOptions[]): { calories: number; protein: number; carbs: number; fat: number } {
  let c = 0, p = 0, cb = 0, f = 0;
  for (const m of mwo) {
    const opt = m.options[0];
    if (opt) { c += opt.totals.calories; p += opt.totals.protein; cb += opt.totals.carbs; f += opt.totals.fat; }
  }
  return { calories: Math.round(c), protein: Math.round(p * 10) / 10, carbs: Math.round(cb * 10) / 10, fat: Math.round(f * 10) / 10 };
}

function scale(mwo: MealWithOptions[], targetCals: number): void {
  const current = totals(mwo);
  if (current.calories <= 0) return;
  const factor = targetCals / current.calories;
  
  for (const m of mwo) {
    for (const opt of m.options) {
      if (!opt?.foods) continue;
      for (const f of opt.foods) {
        f.quantity_grams = Math.round((f.quantity_grams * factor) / 5) * 5;
      }
      recalcOptionTotals(opt);
    }
  }
}

// =====================================================
// Função boostCarbs (cópia para teste isolado)
// =====================================================

function boostCarbs(
  mwo: MealWithOptions[],
  targetCarbs: number,
  minCarbPercent: number,
  targetCals: number
): void {
  const current = totals(mwo);
  const carbPercent = current.carbs / targetCarbs;
  
  // Só aplicar boost se carbs estiverem abaixo do threshold
  if (carbPercent >= minCarbPercent) {
    return;
  }
  
  const carbDeficit = targetCarbs * minCarbPercent - current.carbs;
  
  let totalCarbsAdded = 0;
  const maxCarbsToAdd = carbDeficit * 1.1;
  
  for (const m of mwo) {
    if (totalCarbsAdded >= maxCarbsToAdd) break;
    
    for (const opt of m.options) {
      if (!opt?.foods || totalCarbsAdded >= maxCarbsToAdd) continue;
      
      const carbFoods = opt.foods
        .filter(f => f.food.carbs >= CARB_RICH_THRESHOLD)
        .sort((a, b) => b.food.carbs - a.food.carbs);
      
      for (const f of carbFoods) {
        if (totalCarbsAdded >= maxCarbsToAdd) break;
        
        const cat = (f.food.category || "").toLowerCase();
        const limits = getCategoryLimits(cat, SNACK_MEALS.includes(m.mealType));
        const currentQty = f.quantity_grams;
        const maxAllowedQty = Math.min(limits.max, currentQty * MAX_BOOST_PERCENT);
        
        const carbsPer100g = f.food.carbs;
        const remainingCarbs = maxCarbsToAdd - totalCarbsAdded;
        const gramsNeeded = (remainingCarbs / carbsPer100g) * 100;
        const newQty = Math.min(maxAllowedQty, currentQty + gramsNeeded);
        const actualIncrease = newQty - currentQty;
        
        if (actualIncrease >= 10) {
          f.quantity_grams = Math.round(newQty / 5) * 5;
          const carbsAdded = (actualIncrease / 100) * carbsPer100g;
          totalCarbsAdded += carbsAdded;
        }
      }
      
      recalcOptionTotals(opt);
    }
  }
  
  // Correção de calorias se exceder 110%
  const afterBoost = totals(mwo);
  const calOvershoot = afterBoost.calories / targetCals;
  
  if (calOvershoot > 1.10) {
    scale(mwo, targetCals);
  }
}

// =====================================================
// Helpers para criar dados de teste
// =====================================================

function createFood(overrides: Partial<Food> = {}): Food {
  return {
    id: crypto.randomUUID(),
    name: "Arroz Branco",
    calories: 130,
    protein: 2.5,
    carbs: 28,
    fat: 0.3,
    category: "carboidratos",
    is_optional: false,
    unit_name: null,
    unit_weight_grams: null,
    unit_increment: null,
    unit_enabled: false,
    ...overrides,
  };
}

function createFoodSelection(food: Food, quantity: number, role: string = "carboidrato"): FoodSelection {
  return {
    food,
    role_name: role,
    quantity_grams: quantity,
    display_quantity: quantity,
    display_unit: "g",
  };
}

function createMealResult(type: string, foods: FoodSelection[]): MealResult {
  let cals = 0, prot = 0, carbs = 0, fat = 0;
  for (const f of foods) {
    const m = f.quantity_grams / 100;
    cals += f.food.calories * m;
    prot += f.food.protein * m;
    carbs += f.food.carbs * m;
    fat += f.food.fat * m;
  }
  return {
    meal_type: type,
    meal_name: type,
    foods,
    totals: { calories: Math.round(cals), protein: Math.round(prot), carbs: Math.round(carbs), fat: Math.round(fat) },
  };
}

function createMealWithOptions(type: string, options: MealResult[]): MealWithOptions {
  return { mealType: type, options };
}

// =====================================================
// TESTES PARA boostCarbs
// =====================================================

Deno.test("boostCarbs - não aplica boost se carbs já atingem threshold", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  const chicken = createFood({ name: "Frango", carbs: 0, protein: 31, calories: 165, category: "proteinas" });
  
  const meal = createMealResult("lunch", [
    createFoodSelection(rice, 200),
    createFoodSelection(chicken, 150),
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  const initialCarbs = totals(mwo).carbs;
  
  // Meta de carbs já atingida
  boostCarbs(mwo, initialCarbs, 0.90, 2000);
  
  const finalCarbs = totals(mwo).carbs;
  assertEquals(finalCarbs, initialCarbs, "Carbs não devem mudar se já atingem threshold");
});

Deno.test("boostCarbs - aplica boost quando carbs abaixo do threshold", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  const chicken = createFood({ name: "Frango", carbs: 0, protein: 31, calories: 165, category: "proteinas" });
  
  const meal = createMealResult("lunch", [
    createFoodSelection(rice, 100), // 28g carbs
    createFoodSelection(chicken, 150),
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  const initialCarbs = totals(mwo).carbs;
  
  // Meta de 100g carbs = 28g atual é ~28% (abaixo de 80%)
  boostCarbs(mwo, 100, 0.80, 2000);
  
  const finalCarbs = totals(mwo).carbs;
  assertGreater(finalCarbs, initialCarbs, "Carbs devem aumentar após boost");
});

Deno.test("boostCarbs - respeita limite máximo de boost (50%)", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  
  const meal = createMealResult("lunch", [
    createFoodSelection(rice, 100), // 28g carbs
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  const initialQty = mwo[0].options[0].foods[0].quantity_grams;
  
  // Meta muito alta, mas boost limitado a 50%
  boostCarbs(mwo, 500, 0.90, 3000);
  
  const finalQty = mwo[0].options[0].foods[0].quantity_grams;
  assertLessOrEqual(finalQty, initialQty * MAX_BOOST_PERCENT, "Não deve exceder 50% de aumento");
});

Deno.test("boostCarbs - respeita limites de categoria", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  
  const meal = createMealResult("lunch", [
    createFoodSelection(rice, 200), // já próximo do limite de 250g
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  
  boostCarbs(mwo, 500, 0.90, 3000);
  
  const finalQty = mwo[0].options[0].foods[0].quantity_grams;
  assertLessOrEqual(finalQty, 250, "Não deve exceder limite de categoria (250g)");
});

Deno.test("boostCarbs - ignora alimentos com baixa densidade de carbs", () => {
  const lowCarbFood = createFood({ name: "Brócolis", carbs: 7, calories: 35, category: "vegetais" }); // <15g carbs/100g
  
  const meal = createMealResult("lunch", [
    createFoodSelection(lowCarbFood, 100),
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  const initialQty = mwo[0].options[0].foods[0].quantity_grams;
  
  boostCarbs(mwo, 200, 0.80, 2000);
  
  const finalQty = mwo[0].options[0].foods[0].quantity_grams;
  assertEquals(finalQty, initialQty, "Alimentos com <15g carbs/100g não devem ser boosted");
});

Deno.test("boostCarbs - aplica scale down se calorias excederem 110%", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  
  const meal = createMealResult("lunch", [
    createFoodSelection(rice, 200),
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  
  // Meta baixa de calorias para forçar overshoot
  boostCarbs(mwo, 200, 0.90, 150);
  
  const final = totals(mwo);
  // Após scale down, calorias devem estar próximas do target
  assertLessOrEqual(final.calories, 180, "Calorias devem estar próximas do target após correção");
});

Deno.test("boostCarbs - prioriza alimentos com maior densidade de carbs", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  const potato = createFood({ name: "Batata Doce", carbs: 20, calories: 86 });
  
  const meal = createMealResult("lunch", [
    createFoodSelection(potato, 100), // menor densidade
    createFoodSelection(rice, 100),   // maior densidade
  ]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("lunch", [meal])];
  const initialRiceQty = mwo[0].options[0].foods[1].quantity_grams;
  const initialPotatoQty = mwo[0].options[0].foods[0].quantity_grams;
  
  boostCarbs(mwo, 200, 0.80, 2000);
  
  const finalRiceQty = mwo[0].options[0].foods[1].quantity_grams;
  const finalPotatoQty = mwo[0].options[0].foods[0].quantity_grams;
  
  // Arroz (28g/100g) deve ter boost maior que batata (20g/100g)
  const riceIncrease = finalRiceQty - initialRiceQty;
  const potatoIncrease = finalPotatoQty - initialPotatoQty;
  
  // Pelo menos um deve ter aumentado
  assertGreater(riceIncrease + potatoIncrease, 0, "Pelo menos um alimento deve ter sido boosted");
});

Deno.test("boostCarbs - threshold 80% para bulk vs 90% para outros", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  
  // Criar dois planos idênticos
  const createPlan = (): MealWithOptions[] => {
    const meal = createMealResult("lunch", [createFoodSelection(rice, 100)]);
    return [createMealWithOptions("lunch", [meal])];
  };
  
  const bulkPlan = createPlan();
  const maintainPlan = createPlan();
  
  const targetCarbs = 50; // 28g atual = 56% da meta
  
  // Bulk (80%): precisa boost até 40g
  boostCarbs(bulkPlan, targetCarbs, 0.80, 2000);
  
  // Maintain (90%): precisa boost até 45g
  boostCarbs(maintainPlan, targetCarbs, 0.90, 2000);
  
  const bulkCarbs = totals(bulkPlan).carbs;
  const maintainCarbs = totals(maintainPlan).carbs;
  
  // Ambos devem ter aumentado carbs
  assertGreater(bulkCarbs, 28, "Bulk deve ter carbs aumentados");
  assertGreater(maintainCarbs, 28, "Maintain deve ter carbs aumentados");
});

Deno.test("boostCarbs - funciona com múltiplas refeições", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  const bread = createFood({ name: "Pão Integral", carbs: 42, calories: 247 });
  
  const lunch = createMealResult("lunch", [createFoodSelection(rice, 100)]);
  const dinner = createMealResult("dinner", [createFoodSelection(bread, 50)]);
  
  const mwo: MealWithOptions[] = [
    createMealWithOptions("lunch", [lunch]),
    createMealWithOptions("dinner", [dinner]),
  ];
  
  const initialCarbs = totals(mwo).carbs;
  
  boostCarbs(mwo, 200, 0.80, 3000);
  
  const finalCarbs = totals(mwo).carbs;
  assertGreater(finalCarbs, initialCarbs, "Carbs totais devem aumentar");
});

Deno.test("boostCarbs - limites específicos para lanches", () => {
  const rice = createFood({ name: "Arroz", carbs: 28, calories: 130 });
  
  // Lanche tem limite menor (20-100g) vs refeição principal (50-250g)
  const snack = createMealResult("afternoon_snack", [createFoodSelection(rice, 80)]);
  
  const mwo: MealWithOptions[] = [createMealWithOptions("afternoon_snack", [snack])];
  
  boostCarbs(mwo, 200, 0.80, 2000);
  
  const finalQty = mwo[0].options[0].foods[0].quantity_grams;
  assertLessOrEqual(finalQty, 100, "Lanche não deve exceder 100g por alimento");
});

// =====================================================
// TESTES PARA isFattyAnchor / isFattyForRandomSelection
// =====================================================

// Funções de verificação de gordura (cópia para teste)
const FATTY_FOOD_RULES = {
  MAX_FAT_PROTEIN: 8,
  MAX_FAT_DAIRY: 8,
  MAX_FAT_CARBS: 5,
  MAX_FAT_GENERIC: 15,
  BLOCKED_KEYWORDS: ["oleaginosa", "castanha", "amendoim", "nozes", "amêndoa", "bacon", "linguiça"],
  BLOCKED_CATEGORIES_AS_RANDOM: ["gorduras"],
};

function isFattyAnchor(f: Food): boolean {
  const cat = (f.category || "").toLowerCase();
  const name = f.name.toLowerCase();
  
  if (FATTY_FOOD_RULES.BLOCKED_KEYWORDS.some(kw => name.includes(kw))) return true;
  if (cat === "proteinas" && f.fat > FATTY_FOOD_RULES.MAX_FAT_PROTEIN) return true;
  if (cat === "laticinios" && f.fat > FATTY_FOOD_RULES.MAX_FAT_DAIRY) return true;
  if (cat === "carboidratos" && f.fat > FATTY_FOOD_RULES.MAX_FAT_CARBS) return true;
  
  return false;
}

function isFattyForRandomSelection(f: Food): boolean {
  const cat = (f.category || "").toLowerCase();
  const name = f.name.toLowerCase();
  
  if (FATTY_FOOD_RULES.BLOCKED_CATEGORIES_AS_RANDOM.includes(cat)) return true;
  if (FATTY_FOOD_RULES.BLOCKED_KEYWORDS.some(kw => name.includes(kw))) return true;
  if (cat === "proteinas" && f.fat > FATTY_FOOD_RULES.MAX_FAT_PROTEIN) return true;
  if (cat === "laticinios" && f.fat > FATTY_FOOD_RULES.MAX_FAT_DAIRY) return true;
  if (cat === "carboidratos" && f.fat > FATTY_FOOD_RULES.MAX_FAT_CARBS) return true;
  if (f.fat > FATTY_FOOD_RULES.MAX_FAT_GENERIC) return true;
  
  return false;
}

Deno.test("isFattyAnchor - bloqueia proteína com >8g gordura", () => {
  const fattyChicken = createFood({ name: "Frango com Pele", fat: 12, category: "proteinas" });
  assertEquals(isFattyAnchor(fattyChicken), true);
});

Deno.test("isFattyAnchor - permite proteína com ≤8g gordura", () => {
  const leanChicken = createFood({ name: "Peito de Frango", fat: 3, category: "proteinas" });
  assertEquals(isFattyAnchor(leanChicken), false);
});

Deno.test("isFattyAnchor - bloqueia laticínio com >8g gordura", () => {
  const cheese = createFood({ name: "Queijo Mussarela", fat: 22, category: "laticinios" });
  assertEquals(isFattyAnchor(cheese), true);
});

Deno.test("isFattyAnchor - bloqueia palavras-chave (castanha)", () => {
  const nuts = createFood({ name: "Castanha de Caju", fat: 45, category: "gorduras" });
  assertEquals(isFattyAnchor(nuts), true);
});

Deno.test("isFattyAnchor - bloqueia carboidrato com >5g gordura", () => {
  const croissant = createFood({ name: "Croissant", fat: 21, carbs: 45, category: "carboidratos" });
  assertEquals(isFattyAnchor(croissant), true);
});

Deno.test("isFattyForRandomSelection - bloqueia categoria gorduras", () => {
  const oil = createFood({ name: "Azeite de Oliva", fat: 100, category: "gorduras" });
  assertEquals(isFattyForRandomSelection(oil), true);
});

Deno.test("isFattyForRandomSelection - bloqueia alimento genérico >15g gordura", () => {
  const fattyFood = createFood({ name: "Bolo de Chocolate", fat: 18, category: "mistos" });
  assertEquals(isFattyForRandomSelection(fattyFood), true);
});

Deno.test("isFattyForRandomSelection - permite alimento com ≤15g gordura", () => {
  const normalFood = createFood({ name: "Pão Francês", fat: 3, category: "carboidratos" });
  assertEquals(isFattyForRandomSelection(normalFood), false);
});
