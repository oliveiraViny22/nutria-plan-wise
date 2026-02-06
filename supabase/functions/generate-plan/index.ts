// =====================================================
// GERADOR DE PLANO ALIMENTAR v5 - ULTRA COMPACTO
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";
import { getCategoryLimits, getScaleLimits, SNACK_CATEGORY_LIMITS } from "../_shared/category-limits.ts";
import { validateGeneratedPlan, fatPercentOfCalories, GENERATOR_CONTRACT, type MacroTargets } from "../_shared/nutrition-contracts.ts";

interface Food { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; category: string; is_optional: boolean | null; unit_name: string | null; unit_weight_grams: number | null; unit_increment: number | null; unit_enabled: boolean | null; }
interface FoodSelection { food: Food; role_name: string; quantity_grams: number; display_quantity: number; display_unit: string; }
interface MealResult { meal_type: string; meal_name: string; foods: FoodSelection[]; totals: { calories: number; protein: number; carbs: number; fat: number; }; }
interface MealWithOptions { mealType: string; options: MealResult[]; }
interface AnchorFood { meal_type: string; option_number: number; role_name: string; default_quantity_grams: number; food: Food; }

const MEAL_NAMES: Record<string, string> = { breakfast: "Café da Manhã", morning_snack: "Lanche da Manhã", lunch: "Almoço", afternoon_snack: "Lanche da Tarde", dinner: "Jantar", supper: "Ceia" };
const MEAL_TYPES: Record<number, string[]> = { 2: ["lunch", "dinner"], 3: ["breakfast", "lunch", "dinner"], 4: ["breakfast", "lunch", "afternoon_snack", "dinner"], 5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"], 6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"] };
const ITEM_COUNTS: Record<string, { min: number; max: number }> = { breakfast: { min: 2, max: 4 }, morning_snack: { min: 2, max: 3 }, lunch: { min: 4, max: 6 }, afternoon_snack: { min: 2, max: 3 }, dinner: { min: 4, max: 6 }, supper: { min: 2, max: 3 } };
const MAIN_MEALS = ["breakfast", "lunch", "dinner"];
const SNACK_MEALS = ["morning_snack", "afternoon_snack", "supper"];
const CANONICAL_CATS = ["carboidratos", "proteinas", "gorduras", "vegetais", "frutas", "laticinios", "leguminosas", "mistos"];
// Palavras-chave para detectar alimentos similares (evitar duplicação)
const SIMILAR_FOOD_GROUPS: string[][] = [
  ["iogurte", "yogurt"],
  ["leite"],
  ["queijo"],
  ["frango", "peito de frango"],
  ["arroz"],
  ["feijão", "feijao"],
  ["banana"],
  ["maçã", "maca"],
];

// =====================================================
// REGRAS DE BLOQUEIO DE ALIMENTOS GORDOS (v5.8.2)
// Aplicado tanto em âncoras quanto em seleção aleatória
// =====================================================
const FATTY_FOOD_RULES = {
  MAX_FAT_PROTEIN: 8,      // Proteínas com >8g gordura/100g → bloqueadas
  MAX_FAT_DAIRY: 8,        // Laticínios com >8g gordura/100g → bloqueadas  
  MAX_FAT_CARBS: 5,        // Carboidratos com >5g gordura/100g → bloqueadas
  MAX_FAT_GENERIC: 15,     // Qualquer alimento >15g gordura/100g → bloqueado (exceto categoria gorduras)
  BLOCKED_KEYWORDS: ["oleaginosa", "castanha", "amendoim", "nozes", "amêndoa", "linhaça", "chia", "coco", "queijo amarelo", "queijo prato", "queijo mussarela", "queijo cheddar", "queijo parmesão", "queijo gorgonzola", "bacon", "linguiça"],
  // Categoria gorduras tem limite próprio de quantidade, não de bloqueio
  BLOCKED_CATEGORIES_AS_RANDOM: ["gorduras"], // Não selecionar aleatoriamente
};

/**
 * Verifica se um alimento deve ser bloqueado como âncora primária
 * devido ao alto teor de gordura ou tipo problemático.
 */
function isFattyAnchor(f: Food): boolean {
  const cat = (f.category || "").toLowerCase();
  const name = f.name.toLowerCase();
  
  // Regra 1: Palavras-chave bloqueadas (oleaginosas, queijos gordos, etc.)
  if (FATTY_FOOD_RULES.BLOCKED_KEYWORDS.some(kw => name.includes(kw))) {
    return true;
  }
  
  // Regra 2: Proteínas com >8g gordura/100g
  if (cat === "proteinas" && f.fat > FATTY_FOOD_RULES.MAX_FAT_PROTEIN) {
    return true;
  }
  
  // Regra 3: Laticínios com >8g gordura/100g
  if (cat === "laticinios" && f.fat > FATTY_FOOD_RULES.MAX_FAT_DAIRY) {
    return true;
  }
  
  // Regra 4: Carboidratos com >5g gordura/100g
  if (cat === "carboidratos" && f.fat > FATTY_FOOD_RULES.MAX_FAT_CARBS) {
    return true;
  }
  
  return false;
}

/**
 * Verifica se um alimento deve ser bloqueado na seleção ALEATÓRIA
 * (regras mais rigorosas que âncoras - evita gorduras não-intencionais)
 */
function isFattyForRandomSelection(f: Food): boolean {
  const cat = (f.category || "").toLowerCase();
  const name = f.name.toLowerCase();
  
  // Regra 1: Bloquear categoria gorduras na seleção aleatória
  // (gorduras devem vir apenas de âncoras ou fontes controladas)
  if (FATTY_FOOD_RULES.BLOCKED_CATEGORIES_AS_RANDOM.includes(cat)) {
    return true;
  }
  
  // Regra 2: Mesmas palavras-chave das âncoras
  if (FATTY_FOOD_RULES.BLOCKED_KEYWORDS.some(kw => name.includes(kw))) {
    return true;
  }
  
  // Regra 3: Proteínas com gordura excessiva
  if (cat === "proteinas" && f.fat > FATTY_FOOD_RULES.MAX_FAT_PROTEIN) {
    return true;
  }
  
  // Regra 4: Laticínios com gordura excessiva
  if (cat === "laticinios" && f.fat > FATTY_FOOD_RULES.MAX_FAT_DAIRY) {
    return true;
  }
  
  // Regra 5: Carboidratos com gordura excessiva
  if (cat === "carboidratos" && f.fat > FATTY_FOOD_RULES.MAX_FAT_CARBS) {
    return true;
  }
  
  // Regra 6: Qualquer alimento genérico com >15g gordura/100g
  if (f.fat > FATTY_FOOD_RULES.MAX_FAT_GENERIC) {
    return true;
  }
  
  return false;
}

/**
 * Verifica se dois alimentos são "similares" (mesma família)
 * para evitar duplicação (ex: dois tipos de iogurte)
 */
function getFoodGroup(name: string): string | null {
  const n = name.toLowerCase();
  for (const group of SIMILAR_FOOD_GROUPS) {
    if (group.some(kw => n.includes(kw))) {
      return group[0]; // Retorna o identificador do grupo
    }
  }
  return null;
}

function hasSimilarFood(name: string, usedGroups: Set<string>): boolean {
  const group = getFoodGroup(name);
  return group !== null && usedGroups.has(group);
}

const log = (m: string, d?: unknown) => console.log(JSON.stringify({ ts: new Date().toISOString(), m, ...(d && typeof d === "object" ? d : {}) }));

function unitConv(f: Food, g: number): { display_quantity: number; display_unit: string; calculated_grams: number } {
  if (!f.unit_enabled || !f.unit_name || !f.unit_weight_grams) return { display_quantity: Math.round(g), display_unit: "g", calculated_grams: g };
  const u = Math.round(g / f.unit_weight_grams / (f.unit_increment || 1)) * (f.unit_increment || 1);
  const fg = Math.max(f.unit_increment || 1, u) * f.unit_weight_grams;
  return Math.abs(fg - g) / g <= 0.15 ? { display_quantity: Math.max(f.unit_increment || 1, u), display_unit: f.unit_name, calculated_grams: fg } : { display_quantity: Math.round(g), display_unit: "g", calculated_grams: g };
}

function filterFoods(all: Food[], avoided: string[], restrictions: string[]): Food[] {
  const av = new Set(avoided.map(a => a.toLowerCase()));
  return all.filter(f => {
    const c = (f.category || "").toLowerCase(), n = f.name.toLowerCase();
    if (!CANONICAL_CATS.includes(c) || c === "suplementos" || f.is_optional) return false;
    if (av.has(n) || [...av].some(a => n.includes(a))) return false;
    for (const r of restrictions) {
      const rl = r.toLowerCase();
      if (rl.includes("lactose") && c === "laticinios") return false;
      if (rl.includes("gluten") && (n.includes("trigo") || n.includes("pão"))) return false;
      if (rl.includes("vegano") && (c === "proteinas" || c === "laticinios")) return false;
    }
    return true;
  });
}

async function loadData(sb: any) {
  const [{ data: templates }, { data: roles }, { data: cats }, { data: anchors }] = await Promise.all([
    sb.from("meal_templates").select("*").eq("is_active", true),
    sb.from("meal_template_roles").select("*").order("sort_order"),
    sb.from("meal_role_food_categories").select("role_id, category"),
    sb.from("meal_anchor_foods").select("*, food:foods(id, name, calories, protein, carbs, fat, category, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled)").eq("is_active", true).order("sort_order"),
  ]);
  const catMap = new Map<string, string[]>();
  for (const c of cats || []) { if (!catMap.has(c.role_id)) catMap.set(c.role_id, []); catMap.get(c.role_id)!.push(c.category); }
  const tplMap = new Map<string, { roles: any[] }>();
  for (const t of templates || []) tplMap.set(t.meal_type, { roles: (roles || []).filter((r: any) => r.template_id === t.id).map((r: any) => ({ ...r, categories: catMap.get(r.id) || [] })) });
  const ancMap = new Map<string, Map<string, AnchorFood[]>>();
  for (const a of anchors || []) { if (!a.food) continue; if (!ancMap.has(a.meal_type)) ancMap.set(a.meal_type, new Map()); const rm = ancMap.get(a.meal_type)!; if (!rm.has(a.role_name)) rm.set(a.role_name, []); rm.get(a.role_name)!.push(a); }
  return { tplMap, ancMap };
}

function buildMeal(mt: string, opt: number, roles: any[], foods: Food[], anchors: Map<string, AnchorFood[]>, usedG: Set<string>, usedP: Set<string>, pref: string[]): MealResult {
  const sel: FoodSelection[] = [], usedM = new Set<string>(), filled = new Set<string>(), combined = new Set([...usedG, ...usedP]);
  const usedGroups = new Set<string>(); // Rastrear grupos similares (ex: iogurte)
  const prefSet = new Set(pref.map(p => p.toLowerCase()));
  const isSnack = SNACK_MEALS.includes(mt);
  
  // Helper para aplicar limites de quantidade baseado no tipo de refeição
  const applyQuantityLimits = (food: Food, baseQty: number): number => {
    const cat = (food.category || "").toLowerCase();
    const limits = getCategoryLimits(cat, isSnack);
    const clampedQty = Math.max(limits.min, Math.min(limits.max, baseQty));
    return Math.round(clampedQty / 5) * 5; // Arredondar para múltiplo de 5
  };
  
  // Helper para registrar grupo de alimento usado
  const registerFoodGroup = (food: Food) => {
    const group = getFoodGroup(food.name);
    if (group) usedGroups.add(group);
  };
  
  // Anchors first - aplicar filtro de âncoras gordas (v5.8.1) + detecção de duplicados
  for (const [rn, ancs] of anchors.entries()) {
    if (filled.has(rn.split("_")[0])) continue;
    // Filtrar âncoras: excluir usadas + gordas + similares já usadas
    const avail = ancs.filter(a => 
      !combined.has(a.food.id) && 
      (a.option_number === 0 || a.option_number === opt) &&
      !isFattyAnchor(a.food) &&
      !hasSimilarFood(a.food.name, usedGroups)
    );
    const anc = avail.find(a => a.option_number === opt) || avail[0];
    if (anc?.food) {
      const qty = applyQuantityLimits(anc.food, anc.default_quantity_grams);
      const cv = unitConv(anc.food, qty);
      sel.push({ food: anc.food, role_name: rn, quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit });
      usedM.add(anc.food.id); filled.add(rn.split("_")[0]);
      registerFoodGroup(anc.food);
    }
  }
  
  // Required roles - aplicar filtro de gordura (v5.8.2) + detecção de duplicados
  for (const r of roles.filter((r: any) => r.is_required && !filled.has(r.role_name.split("_")[0]))) {
    const roleCats: string[] = r.categories ?? [];
    // Filtrar: excluir usados + gordos + similares já usados
    const cands = foods.filter(f => 
      !combined.has(f.id) && 
      !usedM.has(f.id) && 
      roleCats.includes((f.category || "").toLowerCase()) &&
      !isFattyForRandomSelection(f) &&
      !hasSimilarFood(f.name, usedGroups)
    );
    if (cands.length === 0) {
      log("NoCandidates", { mealType: mt, roleName: r.role_name, roleCats, usedMCount: usedM.size });
    }
    const pCands = cands.filter(f => [...prefSet].some(p => f.name.toLowerCase().includes(p)));
    const pool = pCands.length > 0 && Math.random() < 0.8 ? pCands : cands;
    const f = pool[Math.floor(Math.random() * pool.length)];
    if (f) { 
      const baseQty = Math.round(((r.min_quantity_grams + r.max_quantity_grams) / 2) / 5) * 5;
      const qty = applyQuantityLimits(f, baseQty);
      const cv = unitConv(f, qty); 
      sel.push({ food: f, role_name: r.role_name, quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit }); 
      usedM.add(f.id);
      registerFoodGroup(f);
    }
  }
  
  // Optional roles to fill target - aplicar filtro de gordura (v5.8.2) + detecção de duplicados
  const tgt = ITEM_COUNTS[mt] || { min: 2, max: 4 }, need = Math.max(0, (Math.floor(Math.random() * (tgt.max - tgt.min + 1)) + tgt.min) - sel.length);
  const optRoles = roles.filter((r: any) => !r.is_required && !filled.has(r.role_name.split("_")[0])).sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(optRoles.length, need); i++) {
    const r = optRoles[i];
    const roleCats: string[] = r.categories ?? [];
    // Filtrar: excluir usados + gordos + similares já usados
    const cands = foods.filter(f => 
      !combined.has(f.id) && 
      !usedM.has(f.id) && 
      roleCats.includes((f.category || "").toLowerCase()) &&
      !isFattyForRandomSelection(f) &&
      !hasSimilarFood(f.name, usedGroups)
    );
    const f = cands[Math.floor(Math.random() * cands.length)];
    if (f) { 
      const baseQty = Math.round(((r.min_quantity_grams + r.max_quantity_grams) / 2) / 5) * 5;
      const qty = applyQuantityLimits(f, baseQty);
      const cv = unitConv(f, qty); 
      sel.push({ food: f, role_name: r.role_name, quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit }); 
      usedM.add(f.id);
      registerFoodGroup(f);
    }
  }
  let cals = 0, prot = 0, carbs = 0, fat = 0;
  for (const s of sel) { const m = s.quantity_grams / 100; cals += s.food.calories * m; prot += s.food.protein * m; carbs += s.food.carbs * m; fat += s.food.fat * m; }
  return { meal_type: mt, meal_name: MEAL_NAMES[mt] || mt, foods: sel, totals: { calories: Math.round(cals), protein: Math.round(prot * 10) / 10, carbs: Math.round(carbs * 10) / 10, fat: Math.round(fat * 10) / 10 } };
}

function totals(mwo: MealWithOptions[]): MacroTargets {
  return totalsForOption(mwo, 0);
}

function totalsForOption(mwo: MealWithOptions[], optionIndex: number): MacroTargets {
  let c = 0, p = 0, cb = 0, f = 0;
  for (const m of mwo) {
    const opt = m.options[optionIndex] || m.options[0];
    if (opt) { c += opt.totals.calories; p += opt.totals.protein; cb += opt.totals.carbs; f += opt.totals.fat; }
  }
  return { calories: Math.round(c), protein: Math.round(p * 10) / 10, carbs: Math.round(cb * 10) / 10, fat: Math.round(f * 10) / 10 };
}

/**
 * Valida contratos nutricionais para TODAS as opções de refeição
 * Retorna warnings se alguma opção violar os contratos
 */
function validateNutritionalContracts(mwo: MealWithOptions[], targets: MacroTargets): { isValid: boolean; warnings: string[]; metrics: Record<string, any> } {
  const warnings: string[] = [];
  const metrics: Record<string, any> = {};
  let isValid = true;
  
  // Determinar quantas opções existem (máximo entre todas as refeições)
  const maxOptions = Math.max(...mwo.map(m => m.options.length), 1);
  
  // Índices de refeições principais (não-lanches)
  const mainMealIndices = mwo
    .map((m, i) => MAIN_MEALS.includes(m.mealType) ? i : -1)
    .filter(i => i >= 0);
  
  for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
    const optTotals = totalsForOption(mwo, optIdx);
    const optLabel = `Opção ${optIdx + 1}`;
    
    // Coletar proteína por refeição para esta opção
    const mealProteinValues = mwo.map(m => {
      const opt = m.options[optIdx] || m.options[0];
      return opt?.totals.protein || 0;
    });
    
    const validation = validateGeneratedPlan(optTotals, targets, mealProteinValues, mainMealIndices);
    
    if (!validation.isValid) {
      isValid = false;
      for (const error of validation.errors) {
        warnings.push(`[${optLabel}] ${error}`);
      }
    }
    
    metrics[`option_${optIdx + 1}`] = validation.metrics;
  }
  
  // Log estruturado para debugging
  if (warnings.length > 0) {
    log("NutritionalWarnings", { warnings, metrics });
  }
  
  return { isValid, warnings, metrics };
}

/**
 * Escalona porções para atingir calorias alvo
 * Usa 3 iterações para convergir dentro de ±10%
 */
function scale(mwo: MealWithOptions[], targetCals: number): void {
  for (let iter = 0; iter < 3; iter++) {
    const current = totals(mwo);
    if (Math.abs(current.calories - targetCals) / targetCals <= 0.1) break;
    
    const factor = targetCals / (current.calories || 1);
    const limits = getScaleLimits();
    
    for (const m of mwo) {
      for (const opt of m.options) {
        for (const f of opt.foods) {
          const newQty = Math.round(f.quantity_grams * factor / 5) * 5;
          const minQty = limits.minPortionGrams;
          const maxQty = limits.maxPortionGrams;
          f.quantity_grams = Math.max(minQty, Math.min(maxQty, newQty));
        }
        // Recalcular totais da opção
        let cals = 0, prot = 0, carbs = 0, fat = 0;
        for (const s of opt.foods) {
          const m = s.quantity_grams / 100;
          cals += s.food.calories * m;
          prot += s.food.protein * m;
          carbs += s.food.carbs * m;
          fat += s.food.fat * m;
        }
        opt.totals = { calories: Math.round(cals), protein: Math.round(prot * 10) / 10, carbs: Math.round(carbs * 10) / 10, fat: Math.round(fat * 10) / 10 };
      }
    }
  }
}

async function save(sb: any, uid: string, mwo: MealWithOptions[]): Promise<string> {
  const t = totals(mwo);
  
  // Validar que temos totais válidos
  if (!t.calories || isNaN(t.calories)) {
    throw new Error("Invalid totals calculated - no calories");
  }
  
  await sb.from("diet_plans").update({ status: "archived" }).eq("user_id", uid).eq("status", "active");
  
  const { data: plan, error: planError } = await sb.from("diet_plans").insert({ 
    user_id: uid, 
    status: "active", 
    total_calories: t.calories, 
    total_protein: t.protein, 
    total_carbs: t.carbs, 
    total_fat: t.fat 
  }).select().single();
  
  if (planError || !plan) {
    log("SaveError", { error: planError?.message || "Plan insert failed" });
    throw new Error(planError?.message || "Failed to create diet plan");
  }
  
  for (let i = 0; i < mwo.length; i++) {
    const mw = mwo[i], o1 = mw.options[0]; 
    if (!o1 || !o1.foods || o1.foods.length === 0) continue;
    
    const { data: meal, error: mealError } = await sb.from("meals").insert({ 
      diet_plan_id: plan.id, 
      name: o1.meal_name, 
      sort_order: i + 1, 
      total_calories: o1.totals.calories, 
      total_protein: o1.totals.protein, 
      total_carbs: o1.totals.carbs, 
      total_fat: o1.totals.fat 
    }).select().single();
    
    if (mealError || !meal) {
      log("MealError", { error: mealError?.message, mealType: mw.mealType });
      continue;
    }
    
    for (let j = 0; j < mw.options.length; j++) {
      const opt = mw.options[j];
      if (!opt.foods || opt.foods.length === 0) continue;
      
      const { data: mo, error: moError } = await sb.from("meal_options").insert({ 
        meal_id: meal.id, 
        option_number: j + 1, 
        name: j === 0 ? "Opção Principal" : `Opção ${j + 1}`, 
        total_calories: opt.totals.calories, 
        total_protein: opt.totals.protein, 
        total_carbs: opt.totals.carbs, 
        total_fat: opt.totals.fat 
      }).select().single();
      
      if (moError || !mo) continue;
      
      for (const f of opt.foods) {
        await sb.from("meal_option_foods").insert({ 
          meal_option_id: mo.id, 
          food_id: f.food.id, 
          quantity_grams: f.quantity_grams, 
          display_quantity: f.display_quantity, 
          display_unit: f.display_unit, 
          calculated_grams: f.quantity_grams, 
          unit_locked: true 
        });
      }
    }
  }
  return plan.id;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("authorization");
    if (!auth) return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, cors);
    const { data: { user } } = await sb.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, cors);
    log("Start", { uid: user.id });

    const [{ data: profile }, { data: planLim }, { data: canUse }, { data: allFoods }] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", user.id).single(),
      sb.rpc("get_user_plan", { _user_id: user.id }),
      sb.rpc("can_use_feature", { _user_id: user.id, _feature: "diet" }),
      sb.from("foods").select("id, name, calories, protein, carbs, fat, category, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled").eq("review_status", "approved").eq("is_active", true),
    ]);
    if (!profile?.onboarding_completed) return createErrorResponse("Complete o onboarding", 400, cors);
    if (!canUse) return createErrorResponse(`Limite de dietas atingido`, 403, cors, { code: "DIET_LIMIT_REACHED", upgradeRequired: true });

    const optLim = planLim?.[0]?.meal_options_limit ?? 1;
    const mTypes = MEAL_TYPES[profile.meals_per_day || 4] || MEAL_TYPES[4];
    const { tplMap, ancMap } = await loadData(sb);
    const foods = filterFoods(allFoods as Food[] || [], profile.avoided_foods || [], profile.restrictions || []);
    log("Data", { foods: foods.length, meals: mTypes.length });

    // Se o filtro removeu tudo (restrições/evitados/catálogo vazio), não adianta seguir.
    if (foods.length === 0) {
      log("NoFoodsAvailable", {
        avoidedCount: (profile.avoided_foods || []).length,
        restrictions: profile.restrictions || [],
      });
      return createErrorResponse(
        "Não há alimentos disponíveis para gerar seu plano. Revise restrições/alimentos evitados e tente novamente.",
        400,
        cors,
        { code: "NO_FOODS_AVAILABLE" },
      );
    }

    const mwo: MealWithOptions[] = [], usedG = new Set<string>();
    for (const mt of mTypes) {
      const tpl = tplMap.get(mt);
      if (!tpl) continue;
      const ancs = ancMap.get(mt) || new Map();
      const opts: MealResult[] = [], usedP = new Set<string>();
      for (let o = 1; o <= optLim; o++) {
        const meal = buildMeal(mt, o, tpl.roles, foods, ancs, usedG, usedP, profile.preferred_foods || []);
        for (const f of meal.foods) usedP.add(f.food.id);
        opts.push(meal);
      }
      mwo.push({ mealType: mt, options: opts });
      if (opts[0]) for (const f of opts[0].foods) usedG.add(f.food.id);
    }

    // Se nenhum template/meal gerou itens, retorne erro de cliente (não 500).
    if (mwo.length === 0 || mwo.every(m => !(m.options?.[0]?.foods?.length))) {
      log("NoMealsGenerated", { mwoCount: mwo.length, mealsPerDay: profile.meals_per_day || 4 });
      return createErrorResponse(
        "Não foi possível montar refeições para o seu plano no momento. Tente novamente mais tarde.",
        400,
        cors,
        { code: "NO_MEALS_GENERATED" },
      );
    }

    // Validação prévia: evita cair em save() com calorias 0/NaN (que vira 500 no catch).
    const preTotals = totals(mwo);
    if (!preTotals.calories || isNaN(preTotals.calories)) {
      log("InvalidPreTotals", { preTotals });
      return createErrorResponse(
        "Falha ao calcular o total do plano. Ajuste preferências/restrições e tente novamente.",
        400,
        cors,
        { code: "INVALID_PLAN_TOTALS" },
      );
    }

    const tgt: MacroTargets = { calories: profile.daily_calories || 2000, protein: profile.protein_target || 100, carbs: profile.carbs_target || 250, fat: profile.fat_target || 65 };
    scale(mwo, tgt.calories);

    // Validar contratos nutricionais ANTES de salvar
    const validation = validateNutritionalContracts(mwo, tgt);
    
    const planId = await save(sb, user.id, mwo);
    await sb.rpc("increment_usage", { _user_id: user.id, _feature: "diet" });
    log("Done", { planId, valid: validation.isValid, warningsCount: validation.warnings.length });

    const fin = totals(mwo);
    return createSuccessResponse({ 
      plan_id: planId, 
      totals: fin, 
      targets: tgt, 
      options_per_meal: optLim, 
      meals: mwo.map(m => ({ type: m.mealType, name: m.options[0]?.meal_name, calories: m.options[0]?.totals.calories })),
      // Incluir validação no response para debugging e UI
      validation: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        metrics: validation.metrics,
      }
    }, cors);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("Err", { e: getErrorForLogging(e), msg });

    // Erros “esperados” de geração (não devem virar 500 / tela em branco)
    if (msg.includes("Invalid totals calculated - no calories")) {
      return createErrorResponse(
        "Não foi possível gerar o plano com os dados atuais. Revise restrições/alimentos evitados e tente novamente.",
        400,
        cors,
        { code: "INVALID_PLAN_TOTALS" },
      );
    }

    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, cors);
  }
});
