/**
 * Testes unitários para validateGeneratedPlan
 * Cobrindo diferentes objetivos (cut/maintain/bulk) e contratos nutricionais
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { 
  validateGeneratedPlan, 
  mapGoalToObjective,
  GENERATOR_CONTRACT,
  type MacroTargets,
  type GeneratorObjective 
} from "../_shared/nutrition-contracts.ts";

// =====================================================
// Testes para mapGoalToObjective
// =====================================================

Deno.test("mapGoalToObjective - mapeia lose_weight para cut", () => {
  assertEquals(mapGoalToObjective("lose_weight"), "cut");
  assertEquals(mapGoalToObjective("emagrecer"), "cut");
});

Deno.test("mapGoalToObjective - mapeia gain_muscle para bulk", () => {
  assertEquals(mapGoalToObjective("gain_muscle"), "bulk");
  assertEquals(mapGoalToObjective("ganhar_massa"), "bulk");
});

Deno.test("mapGoalToObjective - mapeia outros para maintain", () => {
  assertEquals(mapGoalToObjective("maintain"), "maintain");
  assertEquals(mapGoalToObjective("manter"), "maintain");
  assertEquals(mapGoalToObjective(null), "maintain");
  assertEquals(mapGoalToObjective(undefined), "maintain");
  assertEquals(mapGoalToObjective(""), "maintain");
});

// =====================================================
// Testes para validateGeneratedPlan - Calorias
// =====================================================

Deno.test("validateGeneratedPlan - calorias dentro da tolerância (±10%) passa", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 50 };
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateGeneratedPlan - calorias +9% passa (dentro da tolerância)", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2180, protein: 150, carbs: 250, fat: 50 };
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, true);
});

Deno.test("validateGeneratedPlan - calorias +15% falha (fora da tolerância)", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2300, protein: 150, carbs: 250, fat: 50 };
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, false);
  assertEquals(result.errors.some(e => e.includes("[G0]")), true);
});

// =====================================================
// Testes para validateGeneratedPlan - Proteína
// =====================================================

Deno.test("validateGeneratedPlan - proteína 95% da meta passa", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2000, protein: 143, carbs: 250, fat: 50 }; // 95.3%
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, true);
});

Deno.test("validateGeneratedPlan - proteína 90% da meta falha", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2000, protein: 135, carbs: 250, fat: 50 }; // 90%
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, false);
  assertEquals(result.errors.some(e => e.includes("[G1]") && e.includes("Proteína total")), true);
});

Deno.test("validateGeneratedPlan - refeição principal sem proteína mínima falha", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 50 };
  
  // Refeição 0 (índice principal) tem apenas 15g de proteína (mínimo: 20g)
  const result = validateGeneratedPlan(totals, targets, [15, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, false);
  assertEquals(result.errors.some(e => e.includes("[G1]") && e.includes("Refeição 1")), true);
});

// =====================================================
// Testes para validateGeneratedPlan - Carboidratos por objetivo
// =====================================================

Deno.test("validateGeneratedPlan - MAINTAIN: carbs 90% passa, 85% falha", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  
  // 90% deve passar
  const totals90: MacroTargets = { calories: 2000, protein: 150, carbs: 225, fat: 50 }; // 90%
  const result90 = validateGeneratedPlan(totals90, targets, [30, 50, 50], [0, 1, 2], "maintain");
  assertEquals(result90.isValid, true, "90% carbs deve passar para maintain");
  
  // 85% deve falhar
  const totals85: MacroTargets = { calories: 2000, protein: 150, carbs: 212, fat: 50 }; // 84.8%
  const result85 = validateGeneratedPlan(totals85, targets, [30, 50, 50], [0, 1, 2], "maintain");
  assertEquals(result85.isValid, false, "85% carbs deve falhar para maintain");
  assertEquals(result85.errors.some(e => e.includes("[G7]")), true);
});

Deno.test("validateGeneratedPlan - CUT: carbs 90% passa, 85% falha", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  
  // 90% deve passar
  const totals90: MacroTargets = { calories: 2000, protein: 150, carbs: 225, fat: 50 };
  const result90 = validateGeneratedPlan(totals90, targets, [30, 50, 50], [0, 1, 2], "cut");
  assertEquals(result90.isValid, true, "90% carbs deve passar para cut");
  
  // 85% deve falhar
  const totals85: MacroTargets = { calories: 2000, protein: 150, carbs: 212, fat: 50 };
  const result85 = validateGeneratedPlan(totals85, targets, [30, 50, 50], [0, 1, 2], "cut");
  assertEquals(result85.isValid, false, "85% carbs deve falhar para cut");
});

Deno.test("validateGeneratedPlan - BULK: carbs 80% passa, 75% falha", () => {
  const targets: MacroTargets = { calories: 2500, protein: 180, carbs: 300, fat: 80 };
  
  // 80% deve passar para bulk
  const totals80: MacroTargets = { calories: 2500, protein: 180, carbs: 240, fat: 60 }; // 80%
  const result80 = validateGeneratedPlan(totals80, targets, [40, 60, 60], [0, 1, 2], "bulk");
  assertEquals(result80.isValid, true, "80% carbs deve passar para bulk");
  
  // 75% deve falhar para bulk
  const totals75: MacroTargets = { calories: 2500, protein: 180, carbs: 225, fat: 60 }; // 75%
  const result75 = validateGeneratedPlan(totals75, targets, [40, 60, 60], [0, 1, 2], "bulk");
  assertEquals(result75.isValid, false, "75% carbs deve falhar para bulk");
  assertEquals(result75.errors.some(e => e.includes("[G7]") && e.includes("bulk")), true);
});

Deno.test("validateGeneratedPlan - BULK permite 85% carbs que falharia em cut/maintain", () => {
  const targets: MacroTargets = { calories: 2500, protein: 180, carbs: 300, fat: 80 };
  const totals: MacroTargets = { calories: 2500, protein: 180, carbs: 255, fat: 60 }; // 85%
  
  // 85% passa para bulk
  const resultBulk = validateGeneratedPlan(totals, targets, [40, 60, 60], [0, 1, 2], "bulk");
  assertEquals(resultBulk.isValid, true, "85% carbs deve passar para bulk");
  
  // 85% falha para maintain
  const resultMaintain = validateGeneratedPlan(totals, targets, [40, 60, 60], [0, 1, 2], "maintain");
  assertEquals(resultMaintain.isValid, false, "85% carbs deve falhar para maintain");
});

// =====================================================
// Testes para validateGeneratedPlan - Gordura
// =====================================================

Deno.test("validateGeneratedPlan - gordura 25% das calorias passa", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  // 55g fat * 9 = 495 kcal / 2000 = 24.75%
  const totals: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 55 };
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, true);
});

Deno.test("validateGeneratedPlan - gordura 35% das calorias falha", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  // 78g fat * 9 = 702 kcal / 2000 = 35.1%
  const totals: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 78 };
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, false);
  assertEquals(result.errors.some(e => e.includes("[G4]")), true);
});

// =====================================================
// Testes para métricas retornadas
// =====================================================

Deno.test("validateGeneratedPlan - retorna métricas corretas", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2100, protein: 160, carbs: 260, fat: 60 };
  
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2], "maintain");
  
  assertExists(result.metrics);
  assertEquals(result.metrics.totalCalories, 2100);
  assertEquals(result.metrics.totalProtein, 160);
  assertEquals(result.metrics.totalCarbs, 260);
  assertEquals(result.metrics.totalFat, 60);
  assertEquals(result.metrics.caloriePercent, 105); // 2100/2000 * 100
  assertEquals(result.metrics.proteinPercent, 106.7); // 160/150 * 100
  assertEquals(result.metrics.carbsPercent, 104); // 260/250 * 100
  // fatPercentOfCals: (60 * 9) / 2100 * 100 = 25.7%
  assertEquals(result.metrics.fatPercentOfCals, 25.7);
});

// =====================================================
// Testes de integração - múltiplas violações
// =====================================================

Deno.test("validateGeneratedPlan - múltiplas violações são reportadas", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  // Plano ruim: calorias altas, proteína baixa, gordura alta
  const totals: MacroTargets = { calories: 2500, protein: 120, carbs: 200, fat: 100 };
  
  const result = validateGeneratedPlan(totals, targets, [10, 30, 30], [0, 1, 2], "maintain");
  
  assertEquals(result.isValid, false);
  // Deve ter pelo menos 3 erros: calorias, proteína total, gordura
  assertEquals(result.errors.length >= 3, true);
});

Deno.test("validateGeneratedPlan - objetivo default é maintain", () => {
  const targets: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65 };
  const totals: MacroTargets = { calories: 2000, protein: 150, carbs: 212, fat: 50 }; // 85% carbs
  
  // Sem objetivo explícito, deve usar maintain (90% threshold)
  const result = validateGeneratedPlan(totals, targets, [30, 50, 50], [0, 1, 2]);
  
  assertEquals(result.isValid, false, "Sem objetivo deve usar maintain (90% carbs)");
  assertEquals(result.errors.some(e => e.includes("[G7]")), true);
});
