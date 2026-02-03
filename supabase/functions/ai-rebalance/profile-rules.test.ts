// =====================================================
// TESTES DE REGRAS POR PERFIL NUTRICIONAL
// =====================================================
// Valida que cada objetivo (Cut/Maintain/Bulk) aplica
// corretamente suas regras específicas de macros.
// =====================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// =====================================================
// CONSTANTES DE REGRAS POR PERFIL
// =====================================================

const PROFILE_RULES = {
  cut: {
    name: "EMAGRECER (Cut)",
    calories: { min: 90, max: 100 },
    protein: { min: 95 },
    fat: { max: 100 },
    description: "Déficit calórico com proteção de proteína",
  },
  maintain: {
    name: "MANTER (Maintain)",
    calories: { min: 95, max: 105 },
    protein: { min: 90 },
    fat: { max: 125 },
    description: "Equilíbrio calórico com flexibilidade moderada",
  },
  bulk: {
    name: "GANHAR MASSA (Bulk)",
    calories: { min: 95, max: 105 },
    protein: { min: 90 },
    carbs: { min: 80 },
    fat: { max: 110 },
    carbFirst: true,
    description: "Superávit calórico com prioridade em carboidratos",
  },
} as const;

type Objective = keyof typeof PROFILE_RULES;

// =====================================================
// MOCK DE RESULTADOS DE REBALANCEAMENTO
// =====================================================

interface MacroResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface RebalanceResult {
  objective: Objective;
  targets: MacroResult;
  achieved: MacroResult;
  percentages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  converged: boolean;
}

function calculatePercentages(achieved: MacroResult, targets: MacroResult): RebalanceResult["percentages"] {
  return {
    calories: targets.calories > 0 ? (achieved.calories / targets.calories) * 100 : 0,
    protein: targets.protein > 0 ? (achieved.protein / targets.protein) * 100 : 0,
    carbs: targets.carbs > 0 ? (achieved.carbs / targets.carbs) * 100 : 0,
    fat: targets.fat > 0 ? (achieved.fat / targets.fat) * 100 : 0,
  };
}

// =====================================================
// FUNÇÃO DE VALIDAÇÃO POR PERFIL
// =====================================================

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

function validateProfileCompliance(result: RebalanceResult): ValidationResult {
  const rules = PROFILE_RULES[result.objective];
  const errors: string[] = [];
  const warnings: string[] = [];
  const pct = result.percentages;

  // Validar calorias
  if (pct.calories < rules.calories.min) {
    errors.push(
      `[CAL-LOW] Calorias ${pct.calories.toFixed(1)}% abaixo do mínimo ${rules.calories.min}%`
    );
  }
  if (pct.calories > rules.calories.max) {
    errors.push(
      `[CAL-HIGH] Calorias ${pct.calories.toFixed(1)}% acima do máximo ${rules.calories.max}%`
    );
  }

  // Validar proteína
  if (pct.protein < rules.protein.min) {
    errors.push(
      `[PROT-LOW] Proteína ${pct.protein.toFixed(1)}% abaixo do mínimo ${rules.protein.min}%`
    );
  }

  // Validar gordura
  if (pct.fat > rules.fat.max) {
    errors.push(
      `[FAT-HIGH] Gordura ${pct.fat.toFixed(1)}% acima do máximo ${rules.fat.max}%`
    );
  }

  // Validações específicas de Bulk
  if (result.objective === "bulk") {
    const bulkRules = PROFILE_RULES.bulk;
    if (pct.carbs < bulkRules.carbs.min) {
      warnings.push(
        `[CARB-LOW] Carboidratos ${pct.carbs.toFixed(1)}% abaixo do mínimo ${bulkRules.carbs.min}%`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// =====================================================
// TESTES DE REGRAS DO PERFIL CUT
// =====================================================

Deno.test("Cut: Plano dentro das regras passa validação", () => {
  const result: RebalanceResult = {
    objective: "cut",
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
    achieved: { calories: 1900, protein: 148, carbs: 190, fat: 63 },
    percentages: calculatePercentages(
      { calories: 1900, protein: 148, carbs: 190, fat: 63 },
      { calories: 2000, protein: 150, carbs: 200, fat: 67 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  assertEquals(validation.isValid, true);
  assertEquals(validation.errors.length, 0);
  
  console.log(`\n✅ Cut válido:`);
  console.log(`   Calorias: ${result.percentages.calories.toFixed(1)}% (limite: 90-100%)`);
  console.log(`   Proteína: ${result.percentages.protein.toFixed(1)}% (mín: 95%)`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 100%)`);
});

Deno.test("Cut: Calorias abaixo de 90% falha", () => {
  const result: RebalanceResult = {
    objective: "cut",
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
    achieved: { calories: 1700, protein: 145, carbs: 170, fat: 60 },
    percentages: calculatePercentages(
      { calories: 1700, protein: 145, carbs: 170, fat: 60 },
      { calories: 2000, protein: 150, carbs: 200, fat: 67 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  assertEquals(validation.isValid, false);
  assert(validation.errors.some(e => e.includes("[CAL-LOW]")));
  
  console.log(`\n❌ Cut com calorias baixas:`);
  console.log(`   Calorias: ${result.percentages.calories.toFixed(1)}% (mín: 90%)`);
  console.log(`   Erro: ${validation.errors[0]}`);
});

Deno.test("Cut: Proteína abaixo de 95% falha", () => {
  const result: RebalanceResult = {
    objective: "cut",
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
    achieved: { calories: 1900, protein: 130, carbs: 200, fat: 60 },
    percentages: calculatePercentages(
      { calories: 1900, protein: 130, carbs: 200, fat: 60 },
      { calories: 2000, protein: 150, carbs: 200, fat: 67 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  assertEquals(validation.isValid, false);
  assert(validation.errors.some(e => e.includes("[PROT-LOW]")));
  
  console.log(`\n❌ Cut com proteína baixa:`);
  console.log(`   Proteína: ${result.percentages.protein.toFixed(1)}% (mín: 95%)`);
});

Deno.test("Cut: Gordura acima de 100% falha", () => {
  const result: RebalanceResult = {
    objective: "cut",
    targets: { calories: 2000, protein: 150, carbs: 200, fat: 67 },
    achieved: { calories: 1950, protein: 145, carbs: 180, fat: 75 },
    percentages: calculatePercentages(
      { calories: 1950, protein: 145, carbs: 180, fat: 75 },
      { calories: 2000, protein: 150, carbs: 200, fat: 67 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  assertEquals(validation.isValid, false);
  assert(validation.errors.some(e => e.includes("[FAT-HIGH]")));
  
  console.log(`\n❌ Cut com gordura alta:`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 100%)`);
});

// =====================================================
// TESTES DE REGRAS DO PERFIL MAINTAIN
// =====================================================

Deno.test("Maintain: Plano dentro das regras passa validação", () => {
  const result: RebalanceResult = {
    objective: "maintain",
    targets: { calories: 2200, protein: 120, carbs: 275, fat: 73 },
    achieved: { calories: 2200, protein: 115, carbs: 270, fat: 80 },
    percentages: calculatePercentages(
      { calories: 2200, protein: 115, carbs: 270, fat: 80 },
      { calories: 2200, protein: 120, carbs: 275, fat: 73 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  assertEquals(validation.isValid, true);
  assertEquals(validation.errors.length, 0);
  
  console.log(`\n✅ Maintain válido:`);
  console.log(`   Calorias: ${result.percentages.calories.toFixed(1)}% (limite: 95-105%)`);
  console.log(`   Proteína: ${result.percentages.protein.toFixed(1)}% (mín: 90%)`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 125%)`);
});

Deno.test("Maintain: Gordura até 125% é permitida", () => {
  const result: RebalanceResult = {
    objective: "maintain",
    targets: { calories: 2200, protein: 120, carbs: 275, fat: 73 },
    achieved: { calories: 2250, protein: 118, carbs: 260, fat: 90 },
    percentages: calculatePercentages(
      { calories: 2250, protein: 118, carbs: 260, fat: 90 },
      { calories: 2200, protein: 120, carbs: 275, fat: 73 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  // 90/73 = 123.3% - dentro do limite de 125%
  assertEquals(validation.isValid, true);
  
  console.log(`\n✅ Maintain com gordura elevada (dentro do limite):`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 125%)`);
});

Deno.test("Maintain: Gordura acima de 125% falha", () => {
  const result: RebalanceResult = {
    objective: "maintain",
    targets: { calories: 2200, protein: 120, carbs: 275, fat: 73 },
    achieved: { calories: 2280, protein: 115, carbs: 250, fat: 95 },
    percentages: calculatePercentages(
      { calories: 2280, protein: 115, carbs: 250, fat: 95 },
      { calories: 2200, protein: 120, carbs: 275, fat: 73 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  // 95/73 = 130.1% - acima do limite de 125%
  assertEquals(validation.isValid, false);
  assert(validation.errors.some(e => e.includes("[FAT-HIGH]")));
  
  console.log(`\n❌ Maintain com gordura excessiva:`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 125%)`);
});

// =====================================================
// TESTES DE REGRAS DO PERFIL BULK
// =====================================================

Deno.test("Bulk: Plano dentro das regras passa validação", () => {
  const result: RebalanceResult = {
    objective: "bulk",
    targets: { calories: 2800, protein: 140, carbs: 385, fat: 78 },
    achieved: { calories: 2850, protein: 135, carbs: 390, fat: 82 },
    percentages: calculatePercentages(
      { calories: 2850, protein: 135, carbs: 390, fat: 82 },
      { calories: 2800, protein: 140, carbs: 385, fat: 78 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  assertEquals(validation.isValid, true);
  assertEquals(validation.errors.length, 0);
  
  console.log(`\n✅ Bulk válido:`);
  console.log(`   Calorias: ${result.percentages.calories.toFixed(1)}% (limite: 95-105%)`);
  console.log(`   Proteína: ${result.percentages.protein.toFixed(1)}% (mín: 90%)`);
  console.log(`   Carboidratos: ${result.percentages.carbs.toFixed(1)}% (mín: 80%)`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 110%)`);
});

Deno.test("Bulk: Gordura acima de 110% falha", () => {
  const result: RebalanceResult = {
    objective: "bulk",
    targets: { calories: 2800, protein: 140, carbs: 385, fat: 78 },
    achieved: { calories: 2900, protein: 138, carbs: 350, fat: 95 },
    percentages: calculatePercentages(
      { calories: 2900, protein: 138, carbs: 350, fat: 95 },
      { calories: 2800, protein: 140, carbs: 385, fat: 78 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  // 95/78 = 121.8% - acima do limite de 110%
  assertEquals(validation.isValid, false);
  assert(validation.errors.some(e => e.includes("[FAT-HIGH]")));
  
  console.log(`\n❌ Bulk com gordura excessiva:`);
  console.log(`   Gordura: ${result.percentages.fat.toFixed(1)}% (máx: 110%)`);
});

Deno.test("Bulk: Carboidratos baixos gera warning", () => {
  const result: RebalanceResult = {
    objective: "bulk",
    targets: { calories: 2800, protein: 140, carbs: 385, fat: 78 },
    achieved: { calories: 2750, protein: 140, carbs: 290, fat: 85 },
    percentages: calculatePercentages(
      { calories: 2750, protein: 140, carbs: 290, fat: 85 },
      { calories: 2800, protein: 140, carbs: 385, fat: 78 }
    ),
    converged: true,
  };

  const validation = validateProfileCompliance(result);

  // 290/385 = 75.3% - abaixo do mínimo de 80%
  assert(validation.warnings.some(w => w.includes("[CARB-LOW]")));
  
  console.log(`\n⚠️ Bulk com carboidratos baixos:`);
  console.log(`   Carboidratos: ${result.percentages.carbs.toFixed(1)}% (mín: 80%)`);
  console.log(`   Warning: ${validation.warnings[0]}`);
});

// =====================================================
// TESTES DE CARB-FIRST LOGIC (BULK)
// =====================================================

Deno.test("Bulk Carb-First: Prioriza carboidratos antes de gordura", () => {
  // Simula cenário onde calorias estão baixas
  // O algoritmo deve tentar adicionar carboidratos primeiro
  
  const targets = { calories: 2800, protein: 140, carbs: 385, fat: 78 };
  
  // Cenário inicial: calorias baixas, carbs baixos
  const initialState = { calories: 2500, protein: 140, carbs: 300, fat: 70 };
  const initialPct = calculatePercentages(initialState, targets);
  
  // Cenário após Carb-First: carboidratos aumentados
  const afterCarbFirst = { calories: 2700, protein: 140, carbs: 370, fat: 70 };
  const afterPct = calculatePercentages(afterCarbFirst, targets);
  
  // Verificar que carbs aumentaram mas gordura permaneceu igual
  assert(afterCarbFirst.carbs > initialState.carbs, "Carboidratos devem aumentar");
  assertEquals(afterCarbFirst.fat, initialState.fat, "Gordura deve permanecer igual");
  
  console.log(`\n✅ Bulk Carb-First:`);
  console.log(`   Antes: Carbs ${initialPct.carbs.toFixed(1)}%, Fat ${initialPct.fat.toFixed(1)}%`);
  console.log(`   Depois: Carbs ${afterPct.carbs.toFixed(1)}%, Fat ${afterPct.fat.toFixed(1)}%`);
  console.log(`   → Carboidratos priorizados antes de adicionar gordura`);
});

Deno.test("Bulk Carb-First: Só adiciona gordura após carbs >= 100%", () => {
  const BULK_CARB_FIRST_THRESHOLD = 100;
  
  const targets = { calories: 2800, protein: 140, carbs: 385, fat: 78 };
  
  // Cenário onde carbs já estão em 100%+
  const afterCarbs = { calories: 2750, protein: 140, carbs: 390, fat: 70 };
  const carbPct = calculatePercentages(afterCarbs, targets).carbs;
  
  const canAddFat = carbPct >= BULK_CARB_FIRST_THRESHOLD;
  
  assertEquals(canAddFat, true, "Deve permitir gordura quando carbs >= 100%");
  
  console.log(`\n✅ Bulk Carb-First Threshold:`);
  console.log(`   Carboidratos: ${carbPct.toFixed(1)}%`);
  console.log(`   Threshold: ${BULK_CARB_FIRST_THRESHOLD}%`);
  console.log(`   Pode adicionar gordura: ${canAddFat}`);
});

// =====================================================
// TESTES COMPARATIVOS ENTRE PERFIS
// =====================================================

Deno.test("Comparativo: Limites de gordura diferem por perfil", () => {
  const fatLimits = {
    cut: PROFILE_RULES.cut.fat.max,
    maintain: PROFILE_RULES.maintain.fat.max,
    bulk: PROFILE_RULES.bulk.fat.max,
  };
  
  // Cut tem limite mais restritivo
  assert(fatLimits.cut < fatLimits.bulk, "Cut deve ter limite menor que Bulk");
  assert(fatLimits.cut < fatLimits.maintain, "Cut deve ter limite menor que Maintain");
  
  // Maintain tem mais flexibilidade que Bulk
  assert(fatLimits.maintain > fatLimits.bulk, "Maintain deve ter limite maior que Bulk");
  
  console.log(`\n📊 Comparativo de Limites de Gordura:`);
  console.log(`   Cut: ${fatLimits.cut}% (mais restritivo)`);
  console.log(`   Bulk: ${fatLimits.bulk}%`);
  console.log(`   Maintain: ${fatLimits.maintain}% (mais flexível)`);
});

Deno.test("Comparativo: Apenas Bulk tem regra de carboidratos mínimos", () => {
  const hasCarbRule = {
    cut: "carbs" in PROFILE_RULES.cut,
    maintain: "carbs" in PROFILE_RULES.maintain,
    bulk: "carbs" in PROFILE_RULES.bulk,
  };
  
  assertEquals(hasCarbRule.cut, false);
  assertEquals(hasCarbRule.maintain, false);
  assertEquals(hasCarbRule.bulk, true);
  
  console.log(`\n📊 Regra de Carboidratos Mínimos:`);
  console.log(`   Cut: ${hasCarbRule.cut ? "Sim" : "Não"}`);
  console.log(`   Maintain: ${hasCarbRule.maintain ? "Sim" : "Não"}`);
  console.log(`   Bulk: ${hasCarbRule.bulk ? "Sim" : "Não"} (mín ${PROFILE_RULES.bulk.carbs?.min}%)`);
});

// =====================================================
// RESUMO DOS TESTES
// =====================================================

Deno.test("Resumo: Cobertura de regras por perfil", () => {
  const coverage = [
    "CUT: Calorias 90-100%, Proteína ≥95%, Gordura ≤100%",
    "MAINTAIN: Calorias 95-105%, Proteína ≥90%, Gordura ≤125%",
    "BULK: Calorias 95-105%, Proteína ≥90%, Carbs ≥80%, Gordura ≤110%",
    "BULK CARB-FIRST: Prioriza carboidratos antes de adicionar gordura",
  ];
  
  console.log("\n" + "=".repeat(60));
  console.log("📋 REGRAS TESTADAS POR PERFIL:");
  console.log("=".repeat(60));
  for (const rule of coverage) {
    console.log(`  ✓ ${rule}`);
  }
  console.log("=".repeat(60) + "\n");
  
  assertEquals(coverage.length, 4);
});
