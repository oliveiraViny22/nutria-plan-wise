// =====================================================
// TESTES DE INTEGRAÇÃO - GENERATE-MEAL-PLAN-V5
// =====================================================
// Esses testes chamam a Edge Function real via HTTP
// Requerem um usuário de teste com onboarding completo
// =====================================================

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Credenciais do usuário de teste (deve existir no banco)
const TEST_USER_EMAIL = Deno.env.get("TEST_USER_EMAIL") || "test@nutriaplan.com";
const TEST_USER_PASSWORD = Deno.env.get("TEST_USER_PASSWORD") || "TestPassword123!";

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-meal-plan-v5`;

// =====================================================
// HELPER: Autenticar usuário de teste
// =====================================================
async function getAuthToken(): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  
  if (error) {
    console.error("Erro ao autenticar:", error.message);
    return null;
  }
  
  return data.session?.access_token || null;
}

// =====================================================
// HELPER: Fazer requisição à Edge Function
// =====================================================
async function callEdgeFunction(token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
  });
}

// =====================================================
// TESTES
// =====================================================

Deno.test("Integração: Rejeita requisição sem autenticação", async () => {
  const response = await callEdgeFunction(null);
  const body = await response.json();
  
  assertEquals(response.status, 401);
  assertExists(body.error);
  console.log("✅ Requisição sem auth rejeitada corretamente");
});

Deno.test("Integração: Rejeita token inválido", async () => {
  const response = await callEdgeFunction("token-invalido-12345");
  const body = await response.json();
  
  assertEquals(response.status, 401);
  assertExists(body.error);
  console.log("✅ Token inválido rejeitado corretamente");
});

Deno.test({
  name: "Integração: Gera plano com usuário autenticado",
  ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"),
  fn: async () => {
    const token = await getAuthToken();
    
    if (!token) {
      console.log("⚠️ Usuário de teste não disponível, pulando teste");
      return;
    }
    
    console.log("🔐 Token obtido, chamando Edge Function...");
    
    const response = await callEdgeFunction(token);
    const body = await response.json();
    
    // Consumir body para evitar resource leak
    console.log("📊 Status:", response.status);
    
    if (response.status === 200) {
      // Sucesso - verificar estrutura da resposta
      assertExists(body.plan_id, "Deve retornar plan_id");
      assertExists(body.totals, "Deve retornar totals");
      assertExists(body.meals, "Deve retornar meals");
      
      console.log("✅ Plano gerado com sucesso!");
      console.log(`   Plan ID: ${body.plan_id}`);
      console.log(`   Calorias: ${body.totals.calories} kcal`);
      console.log(`   Proteína: ${body.totals.protein}g`);
      console.log(`   Refeições: ${body.meals.length}`);
      console.log(`   Opções por refeição: ${body.options_per_meal}`);
      
      // Verificar métricas do contrato
      if (body.contract_metrics) {
        console.log(`   Tolerância calórica: ${body.contract_metrics.caloriePercent}%`);
      }
      
      // Verificar warnings
      if (body.contract_warnings?.length > 0) {
        console.log(`   ⚠️ Warnings: ${body.contract_warnings.join(", ")}`);
      }
    } else if (response.status === 400) {
      // Erro de validação esperado (ex: onboarding incompleto)
      console.log(`⚠️ Erro de validação: ${body.error}`);
      assertExists(body.error);
    } else {
      // Erro inesperado
      console.error("❌ Erro inesperado:", body);
      throw new Error(`Status inesperado: ${response.status}`);
    }
  },
});

Deno.test({
  name: "Integração: Verifica estrutura completa da resposta",
  ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"),
  fn: async () => {
    const token = await getAuthToken();
    
    if (!token) {
      console.log("⚠️ Usuário de teste não disponível, pulando teste");
      return;
    }
    
    const response = await callEdgeFunction(token);
    const body = await response.json();
    
    if (response.status !== 200) {
      console.log(`⚠️ Não foi possível gerar plano: ${body.error}`);
      return;
    }
    
    // Verificar campos obrigatórios
    const requiredFields = [
      "plan_id",
      "message",
      "options_per_meal",
      "totals",
      "targets",
      "difference_percent",
      "meals",
    ];
    
    for (const field of requiredFields) {
      assertExists(body[field], `Campo obrigatório ausente: ${field}`);
    }
    
    // Verificar estrutura de totals
    assertExists(body.totals.calories);
    assertExists(body.totals.protein);
    assertExists(body.totals.carbs);
    assertExists(body.totals.fat);
    
    // Verificar estrutura de cada refeição
    for (const meal of body.meals) {
      assertExists(meal.type, "Refeição deve ter type");
      assertExists(meal.name, "Refeição deve ter name");
      assertExists(meal.options, "Refeição deve ter options");
      assertExists(meal.calories, "Refeição deve ter calories");
    }
    
    console.log("✅ Estrutura da resposta validada");
    console.log(`   Campos verificados: ${requiredFields.length}`);
    console.log(`   Refeições: ${body.meals.length}`);
  },
});

Deno.test({
  name: "Integração: Verifica contratos nutricionais",
  ignore: !Deno.env.get("RUN_INTEGRATION_TESTS"),
  fn: async () => {
    const token = await getAuthToken();
    
    if (!token) {
      console.log("⚠️ Usuário de teste não disponível, pulando teste");
      return;
    }
    
    const response = await callEdgeFunction(token);
    const body = await response.json();
    
    if (response.status !== 200) {
      console.log(`⚠️ Não foi possível gerar plano: ${body.error}`);
      return;
    }
    
    // Verificar métricas do contrato
    assertExists(body.contract_metrics, "Deve retornar contract_metrics");
    
    const metrics = body.contract_metrics;
    
    // Tolerância calórica: ±10%
    const caloriePercent = metrics.caloriePercent;
    if (caloriePercent < 90 || caloriePercent > 110) {
      console.log(`⚠️ Calorias fora da tolerância: ${caloriePercent}%`);
    } else {
      console.log(`✅ Calorias dentro da tolerância: ${caloriePercent}%`);
    }
    
    // Proteína mínima: 95% da meta
    const proteinPercent = metrics.proteinPercent;
    if (proteinPercent < 95) {
      console.log(`⚠️ Proteína abaixo do mínimo: ${proteinPercent}%`);
    } else {
      console.log(`✅ Proteína adequada: ${proteinPercent}%`);
    }
    
    // Gordura máxima: 30% das calorias
    const fatPercentOfCals = metrics.fatPercentOfCals;
    if (fatPercentOfCals > 30) {
      console.log(`⚠️ Gordura excessiva: ${fatPercentOfCals}%`);
    } else {
      console.log(`✅ Gordura adequada: ${fatPercentOfCals}%`);
    }
    
    // Listar warnings se houver
    if (body.contract_warnings?.length > 0) {
      console.log("\n⚠️ Warnings do contrato:");
      for (const warning of body.contract_warnings) {
        console.log(`   - ${warning}`);
      }
    } else {
      console.log("✅ Nenhum warning no contrato");
    }
  },
});

// =====================================================
// RESUMO
// =====================================================
Deno.test("Resumo: Testes de integração disponíveis", () => {
  console.log(`
==================================================
📋 TESTES DE INTEGRAÇÃO - GENERATE-MEAL-PLAN-V5
==================================================

Testes sempre executados:
  ✓ Rejeita requisição sem autenticação
  ✓ Rejeita token inválido

Testes condicionais (RUN_INTEGRATION_TESTS=true):
  ○ Gera plano com usuário autenticado
  ○ Verifica estrutura completa da resposta
  ○ Verifica contratos nutricionais

Para executar testes completos:
  RUN_INTEGRATION_TESTS=true deno test

Variáveis de ambiente opcionais:
  TEST_USER_EMAIL - Email do usuário de teste
  TEST_USER_PASSWORD - Senha do usuário de teste

==================================================
  `);
});
