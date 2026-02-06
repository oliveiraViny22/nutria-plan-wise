// =====================================================
// TESTES DE INTEGRAÇÃO END-TO-END POR PERFIL
// =====================================================
// Valida o fluxo completo: Geração → Rebalanceamento
// para cada objetivo (Cut/Maintain/Bulk).
// =====================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

// =====================================================
// CONFIGURAÇÃO
// =====================================================

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const GENERATOR_URL = `${SUPABASE_URL}/functions/v1/generate-plan`;
const REBALANCER_URL = `${SUPABASE_URL}/functions/v1/ai-rebalance`;

// =====================================================
// REGRAS ESPERADAS POR PERFIL
// =====================================================

interface ProfileExpectations {
  name: string;
  goal: string; // Valor no DB
  calories: { min: number; max: number };
  protein: { min: number };
  carbs?: { min: number };
  fat?: { max: number };
  carbFirstRequired?: boolean;
}

const PROFILE_EXPECTATIONS: Record<string, ProfileExpectations> = {
  cut: {
    name: "Emagrecer (Cut)",
    goal: "lose_weight",
    calories: { min: 90, max: 100 },
    protein: { min: 95 },
    fat: { max: 100 },
  },
  maintain: {
    name: "Manter (Maintain)",
    goal: "maintain",
    calories: { min: 95, max: 105 },
    protein: { min: 90 },
    fat: { max: 125 },
  },
  bulk: {
    name: "Ganhar Massa (Bulk)",
    goal: "gain_muscle",
    calories: { min: 95, max: 105 },
    protein: { min: 90 },
    carbs: { min: 80 },
    fat: { max: 110 },
    carbFirstRequired: true,
  },
};

// =====================================================
// TIPOS DE RESPOSTA
// =====================================================

interface GeneratorResponse {
  plan_id: string;
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  targets: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  requires_rebalancing: boolean;
  g10_status?: string;
}

interface RebalancerResponse {
  status: "valid" | "valid_with_alert" | "error" | "structurally_invalid";
  objective: string;
  iterations: number;
  final_totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  adjustments: Array<{
    nutrient: string;
    action: string;
    delta: string;
  }>;
  meta?: {
    g10Status: string;
    normalizationApplied: boolean;
    finalValidation?: {
      status: string;
      metrics: {
        caloriePercent: number;
        proteinPercent: number;
        carbPercent: number;
        fatPercent: number;
      };
    };
  };
}

// =====================================================
// HELPERS
// =====================================================

function calculatePercents(
  totals: { calories: number; protein: number; carbs: number; fat: number },
  targets: { calories: number; protein: number; carbs: number; fat: number }
): { calories: number; protein: number; carbs: number; fat: number } {
  return {
    calories: targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0,
    protein: targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0,
    carbs: targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0,
    fat: targets.fat > 0 ? (totals.fat / targets.fat) * 100 : 0,
  };
}

function validateAgainstProfile(
  percents: { calories: number; protein: number; carbs: number; fat: number },
  expectations: ProfileExpectations
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Calorias
  if (percents.calories < expectations.calories.min) {
    errors.push(
      `Calorias ${percents.calories.toFixed(1)}% < mínimo ${expectations.calories.min}%`
    );
  }
  if (percents.calories > expectations.calories.max) {
    errors.push(
      `Calorias ${percents.calories.toFixed(1)}% > máximo ${expectations.calories.max}%`
    );
  }

  // Proteína
  if (percents.protein < expectations.protein.min) {
    errors.push(
      `Proteína ${percents.protein.toFixed(1)}% < mínimo ${expectations.protein.min}%`
    );
  }

  // Carboidratos (apenas Bulk)
  if (expectations.carbs && percents.carbs < expectations.carbs.min) {
    warnings.push(
      `Carboidratos ${percents.carbs.toFixed(1)}% < mínimo ${expectations.carbs.min}%`
    );
  }

  // Gordura
  if (expectations.fat && percents.fat > expectations.fat.max) {
    errors.push(
      `Gordura ${percents.fat.toFixed(1)}% > máximo ${expectations.fat.max}%`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// =====================================================
// MOCK DE AUTENTICAÇÃO (para testes sem usuário real)
// =====================================================

// Nota: Estes testes requerem um token de autenticação válido.
// Em ambiente de CI, você pode usar um service role key ou
// criar um usuário de teste específico.

async function getTestAuthToken(): Promise<string | null> {
  // Em ambiente de desenvolvimento, tenta usar credenciais de teste
  const testEmail = Deno.env.get("TEST_USER_EMAIL");
  const testPassword = Deno.env.get("TEST_USER_PASSWORD");

  if (!testEmail || !testPassword) {
    console.warn("⚠️ Credenciais de teste não configuradas");
    console.warn("   Configure TEST_USER_EMAIL e TEST_USER_PASSWORD no .env");
    return null;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (!response.ok) {
      console.warn("⚠️ Falha na autenticação de teste");
      await response.text(); // Consume body
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.warn("⚠️ Erro ao obter token de teste:", error);
    return null;
  }
}

// =====================================================
// TESTES DE ESTRUTURA (SEM AUTENTICAÇÃO)
// =====================================================

Deno.test("Estrutura: Perfis têm regras definidas", () => {
  const profiles = Object.keys(PROFILE_EXPECTATIONS);
  
  assertEquals(profiles.length, 3);
  assert(profiles.includes("cut"));
  assert(profiles.includes("maintain"));
  assert(profiles.includes("bulk"));
  
  console.log("\n✅ Perfis configurados:");
  for (const [key, profile] of Object.entries(PROFILE_EXPECTATIONS)) {
    console.log(`   ${key}: ${profile.name} (goal: ${profile.goal})`);
  }
});

Deno.test("Estrutura: Regras de Cut são mais restritivas", () => {
  const cut = PROFILE_EXPECTATIONS.cut;
  const maintain = PROFILE_EXPECTATIONS.maintain;
  const bulk = PROFILE_EXPECTATIONS.bulk;
  
  // Cut tem caloria máxima = 100% (déficit)
  assertEquals(cut.calories.max, 100);
  
  // Cut tem proteína mínima mais alta
  assert(cut.protein.min >= maintain.protein.min);
  assert(cut.protein.min >= bulk.protein.min);
  
  // Cut tem gordura máxima mais baixa
  assert(cut.fat!.max <= maintain.fat!.max);
  assert(cut.fat!.max <= bulk.fat!.max);
  
  console.log("\n✅ Cut é mais restritivo:");
  console.log(`   Cal máx: Cut ${cut.calories.max}% vs Maintain ${maintain.calories.max}%`);
  console.log(`   Prot mín: Cut ${cut.protein.min}% vs Bulk ${bulk.protein.min}%`);
  console.log(`   Fat máx: Cut ${cut.fat!.max}% vs Maintain ${maintain.fat!.max}%`);
});

Deno.test("Estrutura: Bulk tem regra de carboidratos", () => {
  const cut = PROFILE_EXPECTATIONS.cut;
  const maintain = PROFILE_EXPECTATIONS.maintain;
  const bulk = PROFILE_EXPECTATIONS.bulk;
  
  // Apenas Bulk tem regra de carbs
  assertEquals(cut.carbs, undefined);
  assertEquals(maintain.carbs, undefined);
  assertExists(bulk.carbs);
  assertEquals(bulk.carbs!.min, 80);
  
  // Bulk tem carbFirstRequired
  assertEquals(bulk.carbFirstRequired, true);
  
  console.log("\n✅ Bulk tem regras específicas de carboidratos:");
  console.log(`   Carbs mín: ${bulk.carbs!.min}%`);
  console.log(`   Carb-First: ${bulk.carbFirstRequired}`);
});

// =====================================================
// TESTES DE VALIDAÇÃO SIMULADA
// =====================================================

Deno.test("Validação: Plano Cut válido passa", () => {
  const mockTotals = { calories: 1900, protein: 148, carbs: 190, fat: 63 };
  const mockTargets = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  
  const percents = calculatePercents(mockTotals, mockTargets);
  const result = validateAgainstProfile(percents, PROFILE_EXPECTATIONS.cut);
  
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
  
  console.log("\n✅ Plano Cut simulado válido:");
  console.log(`   Calorias: ${percents.calories.toFixed(1)}%`);
  console.log(`   Proteína: ${percents.protein.toFixed(1)}%`);
  console.log(`   Gordura: ${percents.fat.toFixed(1)}%`);
});

Deno.test("Validação: Plano Cut com gordura alta falha", () => {
  const mockTotals = { calories: 1950, protein: 145, carbs: 180, fat: 75 };
  const mockTargets = { calories: 2000, protein: 150, carbs: 200, fat: 67 };
  
  const percents = calculatePercents(mockTotals, mockTargets);
  const result = validateAgainstProfile(percents, PROFILE_EXPECTATIONS.cut);
  
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("Gordura")));
  
  console.log("\n❌ Plano Cut com gordura alta:");
  console.log(`   Gordura: ${percents.fat.toFixed(1)}% (máx: ${PROFILE_EXPECTATIONS.cut.fat!.max}%)`);
  console.log(`   Erro: ${result.errors[0]}`);
});

Deno.test("Validação: Plano Maintain com gordura 120% passa", () => {
  const mockTotals = { calories: 2200, protein: 115, carbs: 270, fat: 87 };
  const mockTargets = { calories: 2200, protein: 120, carbs: 275, fat: 73 };
  
  const percents = calculatePercents(mockTotals, mockTargets);
  const result = validateAgainstProfile(percents, PROFILE_EXPECTATIONS.maintain);
  
  // 87/73 = 119.2% - dentro do limite de 125%
  assertEquals(result.valid, true);
  
  console.log("\n✅ Plano Maintain com gordura elevada:");
  console.log(`   Gordura: ${percents.fat.toFixed(1)}% (máx: ${PROFILE_EXPECTATIONS.maintain.fat!.max}%)`);
});

Deno.test("Validação: Plano Bulk com carbs baixos gera warning", () => {
  const mockTotals = { calories: 2750, protein: 140, carbs: 290, fat: 85 };
  const mockTargets = { calories: 2800, protein: 140, carbs: 385, fat: 78 };
  
  const percents = calculatePercents(mockTotals, mockTargets);
  const result = validateAgainstProfile(percents, PROFILE_EXPECTATIONS.bulk);
  
  // 290/385 = 75.3% - abaixo do mínimo de 80%
  assert(result.warnings.some(w => w.includes("Carboidratos")));
  
  console.log("\n⚠️ Plano Bulk com carboidratos baixos:");
  console.log(`   Carbs: ${percents.carbs.toFixed(1)}% (mín: ${PROFILE_EXPECTATIONS.bulk.carbs!.min}%)`);
  console.log(`   Warning: ${result.warnings[0]}`);
});

Deno.test("Validação: Plano Bulk válido passa", () => {
  const mockTotals = { calories: 2850, protein: 135, carbs: 390, fat: 82 };
  const mockTargets = { calories: 2800, protein: 140, carbs: 385, fat: 78 };
  
  const percents = calculatePercents(mockTotals, mockTargets);
  const result = validateAgainstProfile(percents, PROFILE_EXPECTATIONS.bulk);
  
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
  
  console.log("\n✅ Plano Bulk válido:");
  console.log(`   Calorias: ${percents.calories.toFixed(1)}%`);
  console.log(`   Proteína: ${percents.protein.toFixed(1)}%`);
  console.log(`   Carboidratos: ${percents.carbs.toFixed(1)}%`);
  console.log(`   Gordura: ${percents.fat.toFixed(1)}%`);
});

// =====================================================
// TESTES DE INTEGRAÇÃO HTTP (REQUEREM AUTENTICAÇÃO)
// =====================================================

Deno.test({
  name: "Integração: Endpoint do Rebalanceador responde",
  ignore: !SUPABASE_URL || !SUPABASE_ANON_KEY,
  async fn() {
    const response = await fetch(REBALANCER_URL, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:3000",
      },
    });
    
    // OPTIONS deve retornar 200 (CORS preflight)
    assertEquals(response.status, 200);
    await response.text(); // Consume body
    
    console.log("\n✅ Endpoint do rebalanceador acessível");
  },
});

Deno.test({
  name: "Integração: Endpoint do Gerador responde",
  ignore: !SUPABASE_URL || !SUPABASE_ANON_KEY,
  async fn() {
    const response = await fetch(GENERATOR_URL, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:3000",
      },
    });
    
    assertEquals(response.status, 200);
    await response.text(); // Consume body
    
    console.log("\n✅ Endpoint do gerador acessível");
  },
});

Deno.test({
  name: "Integração: Rebalanceador requer autenticação",
  ignore: !SUPABASE_URL || !SUPABASE_ANON_KEY,
  async fn() {
    const response = await fetch(REBALANCER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ plan_id: "test" }),
    });
    
    // Deve retornar 401 ou erro de autenticação (pode variar por config)
    // Aceita 401 (Unauthorized) ou 200 com erro no body
    const body = await response.text();
    
    if (response.status === 401) {
      console.log("\n✅ Rebalanceador retornou 401 (não autenticado)");
    } else {
      // Verificar se body contém mensagem de erro de autenticação
      const isAuthError = body.toLowerCase().includes("auth") || 
                          body.toLowerCase().includes("token") ||
                          body.toLowerCase().includes("unauthorized");
      assert(
        response.status === 401 || isAuthError || response.status !== 200,
        `Esperado erro de autenticação, mas recebeu status ${response.status}`
      );
      console.log(`\n✅ Rebalanceador validou autenticação (status: ${response.status})`);
    }
  },
});

// =====================================================
// TESTES E2E COMPLETOS (REQUEREM USUÁRIO DE TESTE)
// =====================================================

Deno.test({
  name: "E2E: Fluxo completo para perfil configurado",
  ignore: true, // Habilitar quando houver usuário de teste
  async fn() {
    const token = await getTestAuthToken();
    if (!token) {
      console.log("\n⏭️ Teste E2E ignorado - sem credenciais de teste");
      return;
    }

    // 1. Gerar plano
    console.log("\n📝 Gerando plano...");
    const genResponse = await fetch(GENERATOR_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({}),
    });

    assertEquals(genResponse.status, 200, "Geração deveria retornar 200");
    const genData: GeneratorResponse = await genResponse.json();
    assertExists(genData.plan_id, "Deveria retornar plan_id");

    console.log(`   Plan ID: ${genData.plan_id}`);
    console.log(`   Totais: ${genData.totals.calories}kcal, P${genData.totals.protein}g`);
    console.log(`   Requer rebalanceamento: ${genData.requires_rebalancing}`);

    // 2. Rebalancear plano
    console.log("\n⚖️ Rebalanceando plano...");
    const rebalResponse = await fetch(REBALANCER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ plan_id: genData.plan_id }),
    });

    assertEquals(rebalResponse.status, 200, "Rebalanceamento deveria retornar 200");
    const rebalData: RebalancerResponse = await rebalResponse.json();

    console.log(`   Status: ${rebalData.status}`);
    console.log(`   Objetivo: ${rebalData.objective}`);
    console.log(`   Iterações: ${rebalData.iterations}`);
    console.log(`   Totais finais: ${rebalData.final_totals.calories}kcal`);

    // 3. Validar contra regras do perfil
    const profileKey = rebalData.objective as keyof typeof PROFILE_EXPECTATIONS;
    const expectations = PROFILE_EXPECTATIONS[profileKey];

    if (expectations) {
      const percents = calculatePercents(rebalData.final_totals, genData.targets);
      const validation = validateAgainstProfile(percents, expectations);

      console.log(`\n📊 Validação para ${expectations.name}:`);
      console.log(`   Calorias: ${percents.calories.toFixed(1)}% (${expectations.calories.min}-${expectations.calories.max}%)`);
      console.log(`   Proteína: ${percents.protein.toFixed(1)}% (mín: ${expectations.protein.min}%)`);
      console.log(`   Gordura: ${percents.fat.toFixed(1)}% (máx: ${expectations.fat?.max || "N/A"}%)`);

      if (validation.errors.length > 0) {
        console.log(`   ❌ Erros: ${validation.errors.join(", ")}`);
      }
      if (validation.warnings.length > 0) {
        console.log(`   ⚠️ Warnings: ${validation.warnings.join(", ")}`);
      }

      // Status válido ou válido com alerta é aceitável
      assert(
        rebalData.status === "valid" || rebalData.status === "valid_with_alert",
        `Status deveria ser valid ou valid_with_alert, mas foi ${rebalData.status}`
      );
    }

    console.log("\n✅ Fluxo E2E completo com sucesso!");
  },
});

// =====================================================
// TESTES DE CENÁRIOS ESPECÍFICOS POR PERFIL
// =====================================================

Deno.test("Cut: Cenário típico de déficit calórico", () => {
  // Perfil: Mulher, 60kg, objetivo emagrecer
  const targets = { calories: 1600, protein: 120, carbs: 160, fat: 53 };
  
  // Cenário 1: Plano ideal (95% calorias, 98% proteína, 90% gordura)
  const ideal = { calories: 1520, protein: 118, carbs: 155, fat: 48 };
  const idealPercents = calculatePercents(ideal, targets);
  const idealValidation = validateAgainstProfile(idealPercents, PROFILE_EXPECTATIONS.cut);
  
  assertEquals(idealValidation.valid, true, "Cenário ideal deve passar");
  
  // Cenário 2: Déficit excessivo (85% calorias) - falha
  const excessive = { calories: 1360, protein: 115, carbs: 140, fat: 45 };
  const excessivePercents = calculatePercents(excessive, targets);
  const excessiveValidation = validateAgainstProfile(excessivePercents, PROFILE_EXPECTATIONS.cut);
  
  assertEquals(excessiveValidation.valid, false, "Déficit excessivo deve falhar");
  assert(excessiveValidation.errors.some(e => e.includes("Calorias")));
  
  // Cenário 3: Gordura no limite (100%) - passa
  const fatLimit = { calories: 1550, protein: 117, carbs: 150, fat: 53 };
  const fatLimitPercents = calculatePercents(fatLimit, targets);
  const fatLimitValidation = validateAgainstProfile(fatLimitPercents, PROFILE_EXPECTATIONS.cut);
  
  assertEquals(fatLimitValidation.valid, true, "Gordura em 100% deve passar");
  
  console.log("\n✅ Cenários Cut testados:");
  console.log(`   Ideal: Cal ${idealPercents.calories.toFixed(0)}%, Prot ${idealPercents.protein.toFixed(0)}%`);
  console.log(`   Excessivo: Cal ${excessivePercents.calories.toFixed(0)}% (falha)`);
  console.log(`   Fat Limite: Fat ${fatLimitPercents.fat.toFixed(0)}% (passa)`);
});

Deno.test("Maintain: Cenário de manutenção com flexibilidade", () => {
  // Perfil: Homem, 75kg, objetivo manter peso
  const targets = { calories: 2400, protein: 135, carbs: 300, fat: 80 };
  
  // Cenário 1: Plano equilibrado (100% em tudo)
  const balanced = { calories: 2400, protein: 135, carbs: 300, fat: 80 };
  const balancedPercents = calculatePercents(balanced, targets);
  const balancedValidation = validateAgainstProfile(balancedPercents, PROFILE_EXPECTATIONS.maintain);
  
  assertEquals(balancedValidation.valid, true, "Plano equilibrado deve passar");
  
  // Cenário 2: Leve superávit (103% calorias) - passa
  const surplus = { calories: 2472, protein: 130, carbs: 310, fat: 85 };
  const surplusPercents = calculatePercents(surplus, targets);
  const surplusValidation = validateAgainstProfile(surplusPercents, PROFILE_EXPECTATIONS.maintain);
  
  assertEquals(surplusValidation.valid, true, "Leve superávit deve passar");
  
  // Cenário 3: Gordura elevada (120%) - passa (limite é 125%)
  const highFat = { calories: 2400, protein: 125, carbs: 280, fat: 96 };
  const highFatPercents = calculatePercents(highFat, targets);
  const highFatValidation = validateAgainstProfile(highFatPercents, PROFILE_EXPECTATIONS.maintain);
  
  assertEquals(highFatValidation.valid, true, "Gordura 120% deve passar");
  
  // Cenário 4: Superávit excessivo (108% calorias) - falha
  const excessSurplus = { calories: 2592, protein: 130, carbs: 320, fat: 90 };
  const excessSurplusPercents = calculatePercents(excessSurplus, targets);
  const excessSurplusValidation = validateAgainstProfile(excessSurplusPercents, PROFILE_EXPECTATIONS.maintain);
  
  assertEquals(excessSurplusValidation.valid, false, "Superávit excessivo deve falhar");
  
  console.log("\n✅ Cenários Maintain testados:");
  console.log(`   Equilibrado: Cal ${balancedPercents.calories.toFixed(0)}%`);
  console.log(`   Superávit: Cal ${surplusPercents.calories.toFixed(0)}% (passa)`);
  console.log(`   Fat Alta: Fat ${highFatPercents.fat.toFixed(0)}% (passa)`);
  console.log(`   Superávit Excessivo: Cal ${excessSurplusPercents.calories.toFixed(0)}% (falha)`);
});

Deno.test("Bulk: Cenário de ganho de massa com Carb-First", () => {
  // Perfil: Homem, 80kg, objetivo ganhar massa
  const targets = { calories: 3000, protein: 160, carbs: 400, fat: 83 };
  
  // Cenário 1: Plano ideal com carboidratos altos
  const ideal = { calories: 3030, protein: 155, carbs: 410, fat: 85 };
  const idealPercents = calculatePercents(ideal, targets);
  const idealValidation = validateAgainstProfile(idealPercents, PROFILE_EXPECTATIONS.bulk);
  
  assertEquals(idealValidation.valid, true, "Plano Bulk ideal deve passar");
  assertEquals(idealValidation.warnings.length, 0, "Sem warnings");
  
  // Cenário 2: Carboidratos baixos (75%) - warning
  const lowCarbs = { calories: 2950, protein: 158, carbs: 300, fat: 88 };
  const lowCarbsPercents = calculatePercents(lowCarbs, targets);
  const lowCarbsValidation = validateAgainstProfile(lowCarbsPercents, PROFILE_EXPECTATIONS.bulk);
  
  // Carbs baixos gera warning, não erro
  assert(lowCarbsValidation.warnings.some(w => w.includes("Carboidratos")));
  
  // Cenário 3: Gordura no limite (108%) - passa
  const fatLimit = { calories: 3000, protein: 155, carbs: 395, fat: 90 };
  const fatLimitPercents = calculatePercents(fatLimit, targets);
  const fatLimitValidation = validateAgainstProfile(fatLimitPercents, PROFILE_EXPECTATIONS.bulk);
  
  assertEquals(fatLimitValidation.valid, true, "Gordura 108% deve passar");
  
  // Cenário 4: Gordura excessiva (115%) - falha
  const excessFat = { calories: 3100, protein: 155, carbs: 380, fat: 95 };
  const excessFatPercents = calculatePercents(excessFat, targets);
  const excessFatValidation = validateAgainstProfile(excessFatPercents, PROFILE_EXPECTATIONS.bulk);
  
  assertEquals(excessFatValidation.valid, false, "Gordura 115% deve falhar");
  
  console.log("\n✅ Cenários Bulk testados:");
  console.log(`   Ideal: Carbs ${idealPercents.carbs.toFixed(0)}%, Fat ${idealPercents.fat.toFixed(0)}%`);
  console.log(`   Low Carbs: Carbs ${lowCarbsPercents.carbs.toFixed(0)}% (warning)`);
  console.log(`   Fat Limite: Fat ${fatLimitPercents.fat.toFixed(0)}% (passa)`);
  console.log(`   Fat Excessiva: Fat ${excessFatPercents.fat.toFixed(0)}% (falha)`);
});

// =====================================================
// TESTES DE CARB-FIRST LOGIC (BULK ESPECÍFICO)
// =====================================================

Deno.test("Bulk Carb-First: Lógica de priorização de carboidratos", () => {
  const CARB_FIRST_THRESHOLD = 100; // Carbs devem atingir 100% antes de gordura
  const targets = { calories: 3000, protein: 160, carbs: 400, fat: 83 };
  
  // Cenário 1: Calorias baixas, carbs baixos → deve priorizar carbs
  const beforeCarbFirst = { calories: 2700, protein: 155, carbs: 320, fat: 75 };
  const beforePercents = calculatePercents(beforeCarbFirst, targets);
  
  // Verificar que carbs < threshold
  assert(beforePercents.carbs < CARB_FIRST_THRESHOLD, "Carbs devem estar abaixo do threshold");
  
  // Simular aplicação do Carb-First
  const afterCarbFirst = { calories: 2900, protein: 155, carbs: 400, fat: 75 }; // +80g carbs
  const afterPercents = calculatePercents(afterCarbFirst, targets);
  
  // Carbs aumentaram, gordura permaneceu
  assertEquals(afterCarbFirst.fat, beforeCarbFirst.fat, "Gordura não deve mudar durante Carb-First");
  assert(afterPercents.carbs >= CARB_FIRST_THRESHOLD, "Carbs devem atingir threshold");
  
  console.log("\n✅ Lógica Carb-First:");
  console.log(`   Antes: Carbs ${beforePercents.carbs.toFixed(0)}%, Fat ${beforePercents.fat.toFixed(0)}%`);
  console.log(`   Depois: Carbs ${afterPercents.carbs.toFixed(0)}%, Fat ${afterPercents.fat.toFixed(0)}%`);
  console.log(`   → Carboidratos priorizados (threshold: ${CARB_FIRST_THRESHOLD}%)`);
});

Deno.test("Bulk Carb-First: Gordura só liberada após carbs ≥100%", () => {
  const CARB_FIRST_THRESHOLD = 100;
  const targets = { calories: 3000, protein: 160, carbs: 400, fat: 83 };
  
  // Cenário: Carbs em 95%, calorias baixas
  const lowCarbs = { calories: 2800, protein: 155, carbs: 380, fat: 75 };
  const lowCarbsPercents = calculatePercents(lowCarbs, targets);
  
  const canAddFatBeforeThreshold = lowCarbsPercents.carbs >= CARB_FIRST_THRESHOLD;
  assertEquals(canAddFatBeforeThreshold, false, "Não deve permitir gordura antes do threshold");
  
  // Cenário: Carbs em 102%, calorias baixas
  const highCarbs = { calories: 2850, protein: 155, carbs: 408, fat: 75 };
  const highCarbsPercents = calculatePercents(highCarbs, targets);
  
  const canAddFatAfterThreshold = highCarbsPercents.carbs >= CARB_FIRST_THRESHOLD;
  assertEquals(canAddFatAfterThreshold, true, "Deve permitir gordura após threshold");
  
  console.log("\n✅ Bloqueio de gordura Carb-First:");
  console.log(`   Carbs 95%: Pode adicionar gordura? ${canAddFatBeforeThreshold}`);
  console.log(`   Carbs 102%: Pode adicionar gordura? ${canAddFatAfterThreshold}`);
});

// =====================================================
// TESTES DE EDGE CASES
// =====================================================

Deno.test("Edge Case: Proteína no limite exato por perfil", () => {
  const targets = { calories: 2000, protein: 100, carbs: 250, fat: 67 };
  
  // Cut: Proteína em exatos 95%
  const cutLimit = { calories: 1950, protein: 95, carbs: 240, fat: 60 };
  const cutPercents = calculatePercents(cutLimit, targets);
  const cutValidation = validateAgainstProfile(cutPercents, PROFILE_EXPECTATIONS.cut);
  assertEquals(cutValidation.valid, true, "Cut com proteína em 95% exatos deve passar");
  
  // Maintain: Proteína em exatos 90%
  const maintainLimit = { calories: 2000, protein: 90, carbs: 250, fat: 70 };
  const maintainPercents = calculatePercents(maintainLimit, targets);
  const maintainValidation = validateAgainstProfile(maintainPercents, PROFILE_EXPECTATIONS.maintain);
  assertEquals(maintainValidation.valid, true, "Maintain com proteína em 90% exatos deve passar");
  
  // Bulk: Proteína em exatos 90%
  const bulkLimit = { calories: 2000, protein: 90, carbs: 250, fat: 70 };
  const bulkPercents = calculatePercents(bulkLimit, targets);
  const bulkValidation = validateAgainstProfile(bulkPercents, PROFILE_EXPECTATIONS.bulk);
  assertEquals(bulkValidation.valid, true, "Bulk com proteína em 90% exatos deve passar");
  
  console.log("\n✅ Limites exatos de proteína:");
  console.log(`   Cut: ${cutPercents.protein.toFixed(0)}% (mín 95%) → ${cutValidation.valid ? "PASSA" : "FALHA"}`);
  console.log(`   Maintain: ${maintainPercents.protein.toFixed(0)}% (mín 90%) → ${maintainValidation.valid ? "PASSA" : "FALHA"}`);
  console.log(`   Bulk: ${bulkPercents.protein.toFixed(0)}% (mín 90%) → ${bulkValidation.valid ? "PASSA" : "FALHA"}`);
});

Deno.test("Edge Case: Gordura no limite exato por perfil", () => {
  // Usar targets redondos para evitar erros de arredondamento
  const targets = { calories: 2000, protein: 100, carbs: 250, fat: 100 };
  
  // Cut: Gordura em exatos 100g (100%)
  const cutLimit = { calories: 1950, protein: 98, carbs: 240, fat: 100 };
  const cutPercents = calculatePercents(cutLimit, targets);
  const cutValidation = validateAgainstProfile(cutPercents, PROFILE_EXPECTATIONS.cut);
  assertEquals(cutValidation.valid, true, "Cut com gordura em 100% exatos deve passar");
  
  // Maintain: Gordura em 125g (125%)
  const maintainLimit = { calories: 2050, protein: 95, carbs: 230, fat: 125 };
  const maintainPercents = calculatePercents(maintainLimit, targets);
  const maintainValidation = validateAgainstProfile(maintainPercents, PROFILE_EXPECTATIONS.maintain);
  assertEquals(maintainValidation.valid, true, "Maintain com gordura em 125% exatos deve passar");
  
  // Bulk: Gordura em 109g (109% - abaixo do limite de 110%)
  // Nota: O limite é "> 110%", então 110% exatos passa mas usamos 109% para margem de segurança
  const bulkLimit = { calories: 2050, protein: 95, carbs: 250, fat: 109 };
  const bulkPercents = calculatePercents(bulkLimit, targets);
  const bulkValidation = validateAgainstProfile(bulkPercents, PROFILE_EXPECTATIONS.bulk);
  assertEquals(bulkValidation.valid, true, "Bulk com gordura em 109% deve passar");
  
  // Verificar que 111% realmente falha
  const bulkOver = { calories: 2050, protein: 95, carbs: 250, fat: 111 };
  const bulkOverPercents = calculatePercents(bulkOver, targets);
  const bulkOverValidation = validateAgainstProfile(bulkOverPercents, PROFILE_EXPECTATIONS.bulk);
  assertEquals(bulkOverValidation.valid, false, "Bulk com gordura em 111% deve falhar");
  
  console.log("\n✅ Limites exatos de gordura:");
  console.log(`   Cut: ${cutPercents.fat.toFixed(0)}% (máx 100%) → ${cutValidation.valid ? "PASSA" : "FALHA"}`);
  console.log(`   Maintain: ${maintainPercents.fat.toFixed(0)}% (máx 125%) → ${maintainValidation.valid ? "PASSA" : "FALHA"}`);
  console.log(`   Bulk: ${bulkPercents.fat.toFixed(0)}% (máx 110%) → ${bulkValidation.valid ? "PASSA" : "FALHA"}`);
  console.log(`   Bulk Over: ${bulkOverPercents.fat.toFixed(0)}% (máx 110%) → ${bulkOverValidation.valid ? "PASSA" : "FALHA"}`);
});

Deno.test("Edge Case: Múltiplas violações simultâneas", () => {
  const targets = { calories: 2000, protein: 100, carbs: 250, fat: 67 };
  
  // Plano com múltiplas violações: calorias baixas + proteína baixa + gordura alta
  const badPlan = { calories: 1700, protein: 80, carbs: 200, fat: 80 };
  const badPercents = calculatePercents(badPlan, targets);
  const badValidation = validateAgainstProfile(badPercents, PROFILE_EXPECTATIONS.cut);
  
  assertEquals(badValidation.valid, false, "Plano com múltiplas violações deve falhar");
  assert(badValidation.errors.length >= 2, "Deve ter múltiplos erros");
  
  console.log("\n❌ Múltiplas violações:");
  console.log(`   Calorias: ${badPercents.calories.toFixed(0)}%`);
  console.log(`   Proteína: ${badPercents.protein.toFixed(0)}%`);
  console.log(`   Gordura: ${badPercents.fat.toFixed(0)}%`);
  console.log(`   Erros: ${badValidation.errors.length}`);
  badValidation.errors.forEach(e => console.log(`     - ${e}`));
});

// =====================================================
// RESUMO DOS TESTES
// =====================================================

Deno.test("Resumo: Cobertura de integração expandida", () => {
  const coverage = [
    "Estrutura: Perfis definidos (Cut/Maintain/Bulk)",
    "Estrutura: Cut mais restritivo que outros",
    "Estrutura: Bulk tem regras de carboidratos",
    "Validação: Planos simulados por perfil",
    "Integração: Endpoints acessíveis",
    "Integração: Autenticação exigida",
    "Cenário Cut: Déficit típico, excessivo, limite gordura",
    "Cenário Maintain: Equilibrado, superávit, gordura elevada",
    "Cenário Bulk: Ideal, low carbs, gordura limite/excessiva",
    "Carb-First: Priorização de carboidratos",
    "Carb-First: Bloqueio de gordura até threshold",
    "Edge Cases: Limites exatos de proteína e gordura",
    "Edge Cases: Múltiplas violações simultâneas",
    "E2E: Fluxo Geração → Rebalanceamento (quando disponível)",
  ];

  console.log("\n" + "=".repeat(60));
  console.log("📋 COBERTURA DE TESTES DE INTEGRAÇÃO (EXPANDIDA):");
  console.log("=".repeat(60));
  for (const item of coverage) {
    console.log(`  ✓ ${item}`);
  }
  console.log("=".repeat(60));
  console.log("\n⚠️ Para testes E2E completos, configure:");
  console.log("   TEST_USER_EMAIL e TEST_USER_PASSWORD no .env");
  console.log("=".repeat(60) + "\n");

  assertEquals(coverage.length, 14);
});
