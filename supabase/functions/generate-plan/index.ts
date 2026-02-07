// =====================================================
// GERADOR DE PLANO ALIMENTAR v5 - ULTRA COMPACTO
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";
import { getCategoryLimits, getScaleLimits, SNACK_CATEGORY_LIMITS } from "../_shared/category-limits.ts";
import { validateGeneratedPlan, fatPercentOfCalories, GENERATOR_CONTRACT, mapGoalToObjective, type MacroTargets, type GeneratorObjective } from "../_shared/nutrition-contracts.ts";
import { 
  GenerationState, 
  LimitStatus, 
  createInitialGeneratorDiagnostics, 
  type GeneratorDiagnostics, 
  type FoodGenerationDiagnostic 
} from "../_shared/diagnostics.ts";

interface Food { id: string; name: string; calories: number; protein: number; carbs: number; fat: number; category: string; is_optional: boolean | null; unit_name: string | null; unit_weight_grams: number | null; unit_increment: number | null; unit_enabled: boolean | null; dietary_profile: string | null; }
interface FoodSelection { food: Food; role_name: string; quantity_grams: number; display_quantity: number; display_unit: string; }
interface MealResult { meal_type: string; meal_name: string; foods: FoodSelection[]; totals: { calories: number; protein: number; carbs: number; fat: number; }; }
interface MealWithOptions { mealType: string; options: MealResult[]; }
interface AnchorFood { meal_type: string; option_number: number; role_name: string; default_quantity_grams: number; food: Food; }

const MEAL_NAMES: Record<string, string> = { breakfast: "Café da Manhã", morning_snack: "Lanche da Manhã", lunch: "Almoço", afternoon_snack: "Lanche da Tarde", dinner: "Jantar", supper: "Ceia" };
const MEAL_TYPES: Record<number, string[]> = { 2: ["lunch", "dinner"], 3: ["breakfast", "lunch", "dinner"], 4: ["breakfast", "lunch", "afternoon_snack", "dinner"], 5: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"], 6: ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner", "supper"] };
const ITEM_COUNTS: Record<string, { min: number; max: number }> = { breakfast: { min: 2, max: 4 }, morning_snack: { min: 2, max: 3 }, lunch: { min: 4, max: 6 }, afternoon_snack: { min: 2, max: 3 }, dinner: { min: 4, max: 6 }, supper: { min: 2, max: 3 } };
const MAIN_MEALS = ["breakfast", "lunch", "dinner"];
const SNACK_MEALS = ["morning_snack", "afternoon_snack", "supper"];
const CANONICAL_CATS = ["carboidratos", "proteinas", "gorduras", "vegetais", "frutas", "laticinios", "leguminosas", "mistos", "peixes", "frutos_do_mar", "tuberculos", "cereais", "graos", "oleaginosas", "ovos", "cogumelos", "queijos", "sementes", "bebidas", "condimentos", "veganos", "receitas"];
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
// REGRAS DE BLOQUEIO DE ALIMENTOS (v5.13)
// Aplicado tanto em âncoras quanto em seleção aleatória
// =====================================================
const FATTY_FOOD_RULES = {
  MAX_FAT_PROTEIN: 8,      // Proteínas com >8g gordura/100g → bloqueadas
  MAX_FAT_DAIRY: 8,        // Laticínios com >8g gordura/100g → bloqueadas  
  MAX_FAT_CARBS: 5,        // Carboidratos com >5g gordura/100g → bloqueadas
  MAX_FAT_LEGUMES: 6,      // v5.21: Leguminosas com >6g gordura/100g → bloqueadas (ex: soja)
  MAX_FAT_GENERIC: 15,     // Qualquer alimento >15g gordura/100g → bloqueado (exceto categoria gorduras)
  BLOCKED_KEYWORDS: [
    // Oleaginosas e sementes gordurosas
    "oleaginosa", "castanha", "amendoim", "nozes", "amêndoa", "linhaça", "chia", "coco",
    // Queijos gordos
    "queijo amarelo", "queijo prato", "queijo mussarela", "queijo cheddar", "queijo parmesão", "queijo gorgonzola", "queijo brie", "queijo feta",
    // Carnes processadas
    "bacon", "linguiça",
    // v5.21: Leguminosas atípicas com alta gordura
    "soja em grão"
  ],
  // Categoria gorduras tem limite próprio de quantidade, não de bloqueio
  BLOCKED_CATEGORIES_AS_RANDOM: ["gorduras"], // Não selecionar aleatoriamente
};

// =====================================================
// REGRAS CONTEXTUAIS DE ALIMENTOS (v5.23)
// Alimentos bloqueados em tipos específicos de refeição
// =====================================================
const CONTEXTUAL_BLOCK_RULES = {
  // Alimentos NÃO permitidos em lanches (muito pesados para snacks)
  // v5.23: Expandido para incluir frutos do mar e ostras
  BLOCKED_IN_SNACKS: [
    "sobrecoxa", "coxa de frango", "coxinha", "pernil", "costela", "picanha", "cupim",
    // v5.23: Frutos do mar não são adequados para lanches
    "ostra", "mexilhão", "lula", "polvo", "lagosta", "caranguejo", "siri", "vieira", "camarão"
  ],
  
  // Alimentos NÃO permitidos no café da manhã (proteínas de almoço/jantar)
  // v5.20: Expandido para incluir peixes, frutos do mar e arroz
  BLOCKED_IN_BREAKFAST: [
    // Carnes
    "seitan", "tempeh", "tofu", "carne bovina", "carne suína", "patinho", "acém", "alcatra", "fraldinha",
    // Peixes e frutos do mar (não são típicos de café da manhã brasileiro)
    "peixe branco", "salmão", "tilápia", "atum", "bacalhau", "camarão", "robalo", "sardinha", "merluza",
    "lula", "polvo", "ostra", "mexilhão", "lagosta", "caranguejo", "siri", "vieira", "dourado", "pescada",
    "namorado", "linguado", "corvina", "anchova", "badejo", "cherne", "garoupa", "tainha",
    // Leguminosas (mais adequadas para almoço/jantar)
    "lentilha", "grão-de-bico", "feijão",
    // Arroz (não é típico de café da manhã brasileiro)
    "arroz"
  ],
  
  // Alimentos NÃO permitidos no lanche da manhã (v5.20)
  // Mesmos critérios do café da manhã
  BLOCKED_IN_MORNING_SNACK: [
    // Peixes e frutos do mar
    "peixe branco", "salmão", "tilápia", "atum", "bacalhau", "camarão", "robalo", "sardinha", "merluza",
    "lula", "polvo", "ostra", "mexilhão", "lagosta", "caranguejo", "siri", "vieira", "dourado", "pescada",
    // Leguminosas e arroz
    "lentilha", "grão-de-bico", "feijão", "arroz"
  ],
  
  // v5.23: Alimentos NÃO permitidos no lanche da tarde (frutos do mar)
  BLOCKED_IN_AFTERNOON_SNACK: [
    "ostra", "mexilhão", "lula", "polvo", "lagosta", "caranguejo", "siri", "vieira", "camarão",
    "peixe branco", "salmão", "tilápia", "atum", "bacalhau", "robalo", "sardinha", "merluza"
  ],
  
  // v5.23: Alimentos NÃO adequados para ceia (muito leves/folhosos sem substância)
  BLOCKED_IN_SUPPER: [
    // Vegetais de folha puros não são adequados como item principal de ceia
    "alface", "rúcula", "agrião", "espinafre cru", "acelga"
  ],
  
  // Palavras-chave que indicam RECEITAS (não são alimentos simples)
  RECIPE_KEYWORDS: ["mingau", "vitamina de", "shake de", "smoothie", "sanduíche", "wrap", "tapioca recheada", "crepioca", "omelete", "panqueca", "pizza", "lasanha", "escondidinho", "estrogonofe", "moqueca", "feijoada", "risoto"],
};

/**
 * Normaliza categoria para comparação consistente:
 * Remove acentos, lowercase, trim.
 * Ex: "Laticínios" -> "laticinios"
 */
function normalizeCategory(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  
  // Regra 2: Proteínas ou Peixes com >8g gordura/100g
  if ((cat === "proteinas" || cat === "peixes") && f.fat > FATTY_FOOD_RULES.MAX_FAT_PROTEIN) {
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
  
  // Regra 5: v5.21 - Leguminosas com >6g gordura/100g (ex: soja)
  if (cat === "leguminosas" && f.fat > FATTY_FOOD_RULES.MAX_FAT_LEGUMES) {
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
  
  // Regra 3: Proteínas ou Peixes com gordura excessiva
  if ((cat === "proteinas" || cat === "peixes") && f.fat > FATTY_FOOD_RULES.MAX_FAT_PROTEIN) {
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
  
  // Regra 6: v5.21 - Leguminosas com gordura excessiva (ex: soja)
  if (cat === "leguminosas" && f.fat > FATTY_FOOD_RULES.MAX_FAT_LEGUMES) {
    return true;
  }
  
  // Regra 7: Qualquer alimento genérico com >15g gordura/100g
  if (f.fat > FATTY_FOOD_RULES.MAX_FAT_GENERIC) {
    return true;
  }
  
  return false;
}

/**
 * Verifica se um alimento deve ser bloqueado para um tipo específico de refeição.
 * Ex: Sobrecoxa é pesada demais para lanches; Seitan é inadequado para café
 * v5.23: Expandido para bloquear frutos do mar em lanches e folhosos na ceia
 */
function isBlockedForMealType(f: Food, mealType: string): boolean {
  const name = f.name.toLowerCase();
  const isSnack = SNACK_MEALS.includes(mealType);
  const isBreakfast = mealType === "breakfast";
  const isMorningSnack = mealType === "morning_snack";
  const isAfternoonSnack = mealType === "afternoon_snack";
  const isSupper = mealType === "supper";
  
  // Alimentos pesados bloqueados em lanches (inclui frutos do mar)
  if (isSnack && CONTEXTUAL_BLOCK_RULES.BLOCKED_IN_SNACKS.some(kw => name.includes(kw))) {
    return true;
  }
  
  // Proteínas de almoço/jantar bloqueadas no café da manhã (v5.16)
  if (isBreakfast && CONTEXTUAL_BLOCK_RULES.BLOCKED_IN_BREAKFAST.some(kw => name.includes(kw))) {
    return true;
  }
  
  // v5.20: Frutos do mar, arroz e leguminosas bloqueados no lanche da manhã também
  if (isMorningSnack && CONTEXTUAL_BLOCK_RULES.BLOCKED_IN_MORNING_SNACK.some(kw => name.includes(kw))) {
    return true;
  }
  
  // v5.23: Frutos do mar e peixes bloqueados no lanche da tarde
  if (isAfternoonSnack && CONTEXTUAL_BLOCK_RULES.BLOCKED_IN_AFTERNOON_SNACK.some(kw => name.includes(kw))) {
    return true;
  }
  
  // v5.23: Vegetais de folha puros bloqueados na ceia (não têm substância sozinhos)
  if (isSupper && CONTEXTUAL_BLOCK_RULES.BLOCKED_IN_SUPPER.some(kw => name.includes(kw))) {
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

/**
 * Normaliza e valida restrições, detectando redundâncias e incompatibilidades.
 * Ex: Vegano + Lactose é redundante; Vegano + Pescetariano é incompatível.
 */
function validateCrossRestrictions(restrictions: string[]): { normalized: string[]; warnings: string[] } {
  const normalized = restrictions.map(r => r.toLowerCase().trim());
  const warnings: string[] = [];
  
  const has = (kw: string) => normalized.some(r => r.includes(kw));
  
  // Redundâncias: Vegano já exclui laticínios
  if (has("vegano") && has("lactose")) {
    warnings.push("Vegano já exclui laticínios (redundante com intolerância à lactose)");
  }
  
  // Incompatibilidades
  if (has("vegano") && has("pescetariano")) {
    warnings.push("Vegano e Pescetariano são incompatíveis - usando Vegano");
  }
  
  return { normalized, warnings };
}

function filterFoods(all: Food[], avoided: string[], restrictions: string[]): Food[] {
  const av = new Set(avoided.map(a => a.toLowerCase()));
  const { normalized: restr, warnings } = validateCrossRestrictions(restrictions);
  
  if (warnings.length > 0) {
    log("RestrictionWarnings", { warnings });
  }
  
  const hasLowCarb = restr.some(r => r.includes("low carb") || r.includes("lowcarb") || r.includes("baixo carb"));
  const hasVegano = restr.some(r => r.includes("vegano"));
  const hasVegetariano = restr.some(r => r.includes("vegetariano"));
  const hasPescetariano = restr.some(r => r.includes("pescetariano"));
  const hasLactose = restr.some(r => r.includes("lactose"));
  const hasGluten = restr.some(r => r.includes("gluten") || r.includes("glúten"));
  
  // v5.27: Filtrar alimentos por dietary_profile
  // Alimentos com dietary_profile específico só aparecem para usuários compatíveis
  const isProfileCompatible = (foodProfile: string | null): boolean => {
    // NULL = universal, sempre compatível
    if (!foodProfile) return true;
    
    const fp = foodProfile.toLowerCase();
    
    // Alimentos veganos/vegetarianos: apenas para usuários com essas restrições
    if (fp === "vegetarian" || fp === "vegan") {
      return hasVegano || hasVegetariano;
    }
    
    // Alimentos lactose_free: para usuários com intolerância à lactose OU veganos/vegetarianos
    if (fp === "lactose_free") {
      return hasLactose || hasVegano || hasVegetariano;
    }
    
    // Alimentos pescatarian: para pescetarianos
    if (fp === "pescatarian") {
      return hasPescetariano;
    }
    
    // Alimentos low_carb: para usuários low carb
    if (fp === "low_carb") {
      return hasLowCarb;
    }
    
    // 'standard' ou outros: compatíveis com todos
    return true;
  };
  
  return all.filter(f => {
    const c = (f.category || "").toLowerCase(), n = f.name.toLowerCase();
    
    // Filtros base
    if (!CANONICAL_CATS.includes(c) || c === "suplementos" || f.is_optional) return false;
    if (av.has(n) || [...av].some(a => n.includes(a))) return false;
    
    // v5.27: Filtrar por dietary_profile do alimento
    if (!isProfileCompatible(f.dietary_profile)) return false;
    
    // BLOQUEIO DE RECEITAS (v5.13): o sistema não sugere receitas prontas
    if (CONTEXTUAL_BLOCK_RULES.RECIPE_KEYWORDS.some(kw => n.includes(kw))) {
      return false;
    }
    
    // Low Carb: bloquear alimentos com >15g carbs/100g
    if (hasLowCarb && f.carbs > 15) return false;
    
    // Lactose: bloquear laticínios e queijos
    if (hasLactose && (c === "laticinios" || c === "queijos")) return false;
    
    // Glúten: bloquear trigo, pão, massas
    if (hasGluten && (n.includes("trigo") || n.includes("pão") || n.includes("pao") || n.includes("massa") || n.includes("macarrão"))) return false;
    
    // Vegano: bloquear proteínas animais, peixes, ovos, laticínios, queijos, frutos do mar
    if (hasVegano && (c === "proteinas" || c === "peixes" || c === "ovos" || c === "laticinios" || c === "queijos" || c === "frutos_do_mar")) return false;
    
    // Pescetariano (se não for vegano): bloquear carnes (categoria proteínas que NÃO são peixes), permitir peixes e frutos do mar
    if (hasPescetariano && !hasVegano && c === "proteinas") {
      // Verificar se é peixe pelo nome (categoria ainda é proteínas no legado)
      const isPeixe = n.includes("peixe") || n.includes("salmão") || n.includes("salmon") || 
                      n.includes("atum") || n.includes("tilápia") || n.includes("tilapia") ||
                      n.includes("sardinha") || n.includes("bacalhau") || n.includes("camarão") ||
                      n.includes("merluza") || n.includes("robalo");
      if (!isPeixe) return false;
    }
    // Peixes e frutos_do_mar sempre permitidos para pescetariano
    // (já estão na categoria correta, não precisam de checagem adicional)
    
    return true;
  });
}

/**
 * v5.24: loadData agora aceita goal E restrições do usuário para filtrar âncoras
 * - goal_type: NULL = universal, específico = só para aquele objetivo
 * - dietary_profile: NULL = universal, específico = só para aquele perfil dietético
 * 
 * Lógica de perfil dietético:
 * - Usuário sem restrições especiais: apenas âncoras 'standard' ou NULL
 * - Usuário vegetariano: âncoras 'vegetarian', 'vegan', ou NULL
 * - Usuário vegano: apenas âncoras 'vegan' ou NULL
 * - Usuário pescetariano: âncoras 'pescatarian', 'standard', ou NULL
 */
async function loadData(sb: any, userGoal?: string, restrictions?: string[]) {
  // Mapear goal do perfil para goal_type do banco
  const goalTypeMap: Record<string, string> = {
    "gain_muscle": "bulk",
    "lose_weight": "cut",
    "maintain": "maintain",
  };
  const mappedGoalType = userGoal ? goalTypeMap[userGoal] || null : null;
  
  // v5.24: Determinar perfil dietético baseado nas restrições
  const restr = (restrictions || []).map(r => r.toLowerCase().trim());
  const isVegan = restr.some(r => r.includes("vegano"));
  const isVegetarian = restr.some(r => r.includes("vegetariano"));
  const isPescatarian = restr.some(r => r.includes("pescetariano"));
  
  // Construir filtro de dietary_profile
  // NULL = universal (sempre incluído)
  let dietaryProfileFilter: string;
  if (isVegan) {
    // Veganos: apenas âncoras veganas ou universais
    dietaryProfileFilter = "dietary_profile.is.null,dietary_profile.eq.vegan";
  } else if (isVegetarian) {
    // Vegetarianos: âncoras vegetarianas, veganas ou universais
    dietaryProfileFilter = "dietary_profile.is.null,dietary_profile.eq.vegetarian,dietary_profile.eq.vegan";
  } else if (isPescatarian) {
    // Pescetarianos: âncoras pescetarianas, standard ou universais
    dietaryProfileFilter = "dietary_profile.is.null,dietary_profile.eq.pescatarian,dietary_profile.eq.standard";
  } else {
    // Usuários padrão: apenas âncoras standard ou universais (EXCLUI vegano, vegetariano, pescetariano)
    dietaryProfileFilter = "dietary_profile.is.null,dietary_profile.eq.standard";
  }
  
  const [{ data: templates }, { data: roles }, { data: cats }, { data: anchors }] = await Promise.all([
    sb.from("meal_templates").select("*").eq("is_active", true),
    sb.from("meal_template_roles").select("*").order("sort_order"),
    sb.from("meal_role_food_categories").select("role_id, category"),
    // v5.24: Filtrar âncoras por goal_type E dietary_profile
    // v5.27: Incluir dietary_profile do food para consistência
    sb.from("meal_anchor_foods")
      .select("*, food:foods(id, name, calories, protein, carbs, fat, category, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled, dietary_profile)")
      .eq("is_active", true)
      .or(mappedGoalType ? `goal_type.is.null,goal_type.eq.${mappedGoalType}` : "goal_type.is.null")
      .or(dietaryProfileFilter)
      .order("sort_order"),
  ]);

  log("AnchorFilter", { 
    userGoal, 
    mappedGoalType, 
    dietaryProfile: isVegan ? "vegan" : isVegetarian ? "vegetarian" : isPescatarian ? "pescatarian" : "standard",
    anchorsLoaded: anchors?.length || 0 
  });

  const catMap = new Map<string, string[]>();
  for (const c of cats || []) {
    const cat = normalizeCategory((c as any).category);
    if (!cat) continue;
    if (!catMap.has((c as any).role_id)) catMap.set((c as any).role_id, []);
    catMap.get((c as any).role_id)!.push(cat);
  }

  const tplMap = new Map<string, { roles: any[] }>();
  for (const t of templates || []) {
    tplMap.set((t as any).meal_type, {
      roles: (roles || [])
        .filter((r: any) => r.template_id === (t as any).id)
        .map((r: any) => ({ ...r, categories: catMap.get(r.id) || [] })),
    });
  }

  const ancMap = new Map<string, Map<string, AnchorFood[]>>();
  for (const a of anchors || []) {
    if (!(a as any).food) continue;
    if (!ancMap.has((a as any).meal_type)) ancMap.set((a as any).meal_type, new Map());
    const rm = ancMap.get((a as any).meal_type)!;
    if (!rm.has((a as any).role_name)) rm.set((a as any).role_name, []);
    rm.get((a as any).role_name)!.push(a as any);
  }

  return { tplMap, ancMap };
}

// v5.15: Adicionado objetivo para ajustes de bulk
function buildMeal(mt: string, opt: number, roles: any[], foods: Food[], anchors: Map<string, AnchorFood[]>, usedG: Set<string>, usedP: Set<string>, pref: string[], objective: GeneratorObjective = "maintain"): MealResult {
  const sel: FoodSelection[] = [], usedM = new Set<string>(), filled = new Set<string>(), combined = new Set([...usedG, ...usedP]);
  const usedGroups = new Set<string>(); // Rastrear grupos similares (ex: iogurte)
  const prefSet = new Set(pref.map(p => p.toLowerCase()));
  const isSnack = SNACK_MEALS.includes(mt);
  const isMainMeal = MAIN_MEALS.includes(mt);
  const isBulk = objective === "bulk";
  
  // v5.15: LIMITE MÁXIMO DE PROTEÍNA EM LANCHES (15g) para evitar excesso
  const MAX_SNACK_PROTEIN = 15;
  
  // Contrato: proteína mínima por tipo de refeição
  const minProteinRequired = isMainMeal 
    ? GENERATOR_CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS  // 20g
    : GENERATOR_CONTRACT.MIN_PROTEIN_SNACK_GRAMS;     // 5g
  
  // v5.15: Multiplicador de porção para carboidratos em bulk
  const BULK_CARB_MULTIPLIER = isBulk ? 1.25 : 1.0; // +25% de carbs para bulk
  
  // Helper para aplicar limites de quantidade baseado no tipo de refeição
  const applyQuantityLimits = (food: Food, baseQty: number, applyBulkBoost = false): number => {
    const cat = (food.category || "").toLowerCase();
    const limits = getCategoryLimits(cat, isSnack);
    
    // v5.15: Aplicar boost de carbs para bulk na montagem inicial
    let adjustedQty = baseQty;
    if (applyBulkBoost && isBulk && (cat === "carboidratos" || cat === "leguminosas")) {
      adjustedQty = Math.round(baseQty * BULK_CARB_MULTIPLIER);
    }
    
    const clampedQty = Math.max(limits.min, Math.min(limits.max, adjustedQty));
    return Math.round(clampedQty / 5) * 5; // Arredondar para múltiplo de 5
  };
  
  // Helper para registrar grupo de alimento usado
  const registerFoodGroup = (food: Food) => {
    const group = getFoodGroup(food.name);
    if (group) usedGroups.add(group);
  };
  
  // Helper para calcular proteína atual da refeição
  const getCurrentProtein = (): number => {
    let prot = 0;
    for (const s of sel) {
      prot += s.food.protein * (s.quantity_grams / 100);
    }
    return prot;
  };
  
  // v5.15: Verificar se adicionar alimento excederia limite de proteína em lanche
  // v5.21: Não aplicar para categorias de baixa proteína (frutas, vegetais, gorduras)
  const LOW_PROTEIN_CATEGORIES = ["frutas", "vegetais", "gorduras", "carboidratos"];
  
  const wouldExceedSnackProtein = (food: Food, grams: number): boolean => {
    if (!isSnack) return false;
    // v5.21: Não penalizar categorias de baixa proteína
    const cat = (food.category || "").toLowerCase();
    if (LOW_PROTEIN_CATEGORIES.includes(cat)) return false;
    
    const currentProt = getCurrentProtein();
    const addedProt = (food.protein * grams) / 100;
    return (currentProt + addedProt) > MAX_SNACK_PROTEIN;
  };
  
  // v5.15: Calcular quantidade máxima para não exceder proteína em lanche
  // v5.21: Não aplicar para categorias de baixa proteína
  const getMaxQtyForSnackProtein = (food: Food, baseQty: number): number => {
    if (!isSnack || food.protein <= 0) return baseQty;
    // v5.21: Não limitar categorias de baixa proteína
    const cat = (food.category || "").toLowerCase();
    if (LOW_PROTEIN_CATEGORIES.includes(cat)) return baseQty;
    
    const currentProt = getCurrentProtein();
    const remainingProt = Math.max(0, MAX_SNACK_PROTEIN - currentProt);
    const maxGramsForProtein = (remainingProt / food.protein) * 100;
    return Math.min(baseQty, Math.max(20, maxGramsForProtein)); // Mínimo 20g
  };
  
  // Anchors first - aplicar filtro de âncoras gordas (v5.8.1) + detecção de duplicados
  // v5.15: Aplicar limite de proteína em lanches e boost de carbs para bulk
  for (const [rn, ancs] of anchors.entries()) {
    if (filled.has(rn.split("_")[0])) continue;
    
    // v5.15: Em lanches, pular âncoras proteicas se já atingiu limite
    if (isSnack && rn.includes("proteina") && getCurrentProtein() >= MAX_SNACK_PROTEIN) {
      log("SnackProteinLimitReached", { mealType: mt, role: rn, currentProtein: getCurrentProtein() });
      continue;
    }
    
    // Filtrar âncoras: excluir usadas + gordas + similares já usadas + bloqueio contextual
    const avail = ancs.filter(a => 
      !combined.has(a.food.id) && 
      (a.option_number === 0 || a.option_number === opt) &&
      !isFattyAnchor(a.food) &&
      !hasSimilarFood(a.food.name, usedGroups) &&
      !isBlockedForMealType(a.food, mt) &&
      // v5.15: Em lanches, excluir se excederia proteína
      !wouldExceedSnackProtein(a.food, a.default_quantity_grams)
    );
    const anc = avail.find(a => a.option_number === opt) || avail[0];
    if (anc?.food) {
      // v5.15: Aplicar limite de proteína em lanches + boost de carbs para bulk
      const isCarb = (anc.food.category || "").toLowerCase() === "carboidratos" || 
                     (anc.food.category || "").toLowerCase() === "leguminosas";
      let baseQty = anc.default_quantity_grams;
      
      // Limitar quantidade para não exceder proteína em lanche
      if (isSnack && anc.food.protein > 0) {
        baseQty = getMaxQtyForSnackProtein(anc.food, baseQty);
      }
      
      const qty = applyQuantityLimits(anc.food, baseQty, isCarb);
      const cv = unitConv(anc.food, qty);
      sel.push({ food: anc.food, role_name: rn, quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit });
      usedM.add(anc.food.id); filled.add(rn.split("_")[0]);
      registerFoodGroup(anc.food);
    }
  }
  
  // Required roles - aplicar filtro de gordura (v5.8.2) + detecção de duplicados + bloqueio contextual
  // v5.15: Aplicar limite de proteína em lanches e boost de carbs para bulk
  for (const r of roles.filter((r: any) => r.is_required && !filled.has(r.role_name.split("_")[0]))) {
    const roleCats: string[] = r.categories ?? [];
    
    // v5.15: Em lanches, pular roles de proteína se já atingiu limite
    if (isSnack && r.role_name.includes("proteina") && getCurrentProtein() >= MAX_SNACK_PROTEIN) {
      log("SnackProteinLimitReached", { mealType: mt, role: r.role_name, currentProtein: getCurrentProtein() });
      continue;
    }
    
    // Filtrar: excluir usados + gordos + similares já usados + bloqueio por tipo de refeição
    const cands = foods.filter(f => 
      !combined.has(f.id) && 
      !usedM.has(f.id) && 
      roleCats.includes(normalizeCategory(f.category)) &&
      !isFattyForRandomSelection(f) &&
      !hasSimilarFood(f.name, usedGroups) &&
      !isBlockedForMealType(f, mt) &&
      // v5.15: Em lanches, excluir se excederia proteína
      !wouldExceedSnackProtein(f, (r.min_quantity_grams + r.max_quantity_grams) / 2)
    );
    if (cands.length === 0) {
      log("NoCandidates", { mealType: mt, roleName: r.role_name, roleCats, usedMCount: usedM.size });
    }
    const pCands = cands.filter(f => [...prefSet].some(p => f.name.toLowerCase().includes(p)));
    const pool = pCands.length > 0 && Math.random() < 0.8 ? pCands : cands;
    const f = pool[Math.floor(Math.random() * pool.length)];
    if (f) { 
      const isCarb = (f.category || "").toLowerCase() === "carboidratos" || 
                     (f.category || "").toLowerCase() === "leguminosas";
      let baseQty = Math.round(((r.min_quantity_grams + r.max_quantity_grams) / 2) / 5) * 5;
      
      // v5.15: Limitar quantidade para não exceder proteína em lanche
      if (isSnack && f.protein > 0) {
        baseQty = getMaxQtyForSnackProtein(f, baseQty);
      }
      
      const qty = applyQuantityLimits(f, baseQty, isCarb);
      const cv = unitConv(f, qty); 
      sel.push({ food: f, role_name: r.role_name, quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit }); 
      usedM.add(f.id);
      registerFoodGroup(f);
    }
  }
  
  // Optional roles to fill target - aplicar filtro de gordura (v5.8.2) + detecção de duplicados + bloqueio contextual
  // v5.15: Aplicar limite de proteína em lanches e boost de carbs para bulk
  const tgt = ITEM_COUNTS[mt] || { min: 2, max: 4 }, need = Math.max(0, (Math.floor(Math.random() * (tgt.max - tgt.min + 1)) + tgt.min) - sel.length);
  const optRoles = roles.filter((r: any) => !r.is_required && !filled.has(r.role_name.split("_")[0])).sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(optRoles.length, need); i++) {
    const r = optRoles[i];
    const roleCats: string[] = r.categories ?? [];
    
    // v5.15: Em lanches, pular roles de proteína se já atingiu limite
    if (isSnack && r.role_name.includes("proteina") && getCurrentProtein() >= MAX_SNACK_PROTEIN) {
      continue;
    }
    
    // Filtrar: excluir usados + gordos + similares já usados + bloqueio por tipo de refeição
    const cands = foods.filter(f => 
      !combined.has(f.id) && 
      !usedM.has(f.id) && 
      roleCats.includes(normalizeCategory(f.category)) &&
      !isFattyForRandomSelection(f) &&
      !hasSimilarFood(f.name, usedGroups) &&
      !isBlockedForMealType(f, mt) &&
      // v5.15: Em lanches, excluir se excederia proteína
      !wouldExceedSnackProtein(f, (r.min_quantity_grams + r.max_quantity_grams) / 2)
    );
    const f = cands[Math.floor(Math.random() * cands.length)];
    if (f) {
      const isCarb = (f.category || "").toLowerCase() === "carboidratos" || 
                     (f.category || "").toLowerCase() === "leguminosas";
      let baseQty = Math.round(((r.min_quantity_grams + r.max_quantity_grams) / 2) / 5) * 5;
      
      // v5.15: Limitar quantidade para não exceder proteína em lanche
      if (isSnack && f.protein > 0) {
        baseQty = getMaxQtyForSnackProtein(f, baseQty);
      }
      
      const qty = applyQuantityLimits(f, baseQty, isCarb);
      const cv = unitConv(f, qty); 
      sel.push({ food: f, role_name: r.role_name, quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit }); 
      usedM.add(f.id);
      registerFoodGroup(f);
    }
  }
  
  // =====================================================
  // GARANTIA DE PROTEÍNA MÍNIMA POR REFEIÇÃO (v5.12)
  // Se a refeição está abaixo do mínimo de proteína, adicionar
  // ou aumentar alimento proteico
  // =====================================================
  let currentProtein = getCurrentProtein();
  if (currentProtein < minProteinRequired) {
    const proteinDeficit = minProteinRequired - currentProtein;
    
    // Tentar aumentar porção de alimento proteico existente
    const proteinFoods = sel.filter(s => s.food.protein >= 15); // Alimentos com boa densidade proteica
    if (proteinFoods.length > 0) {
      // Ordenar por densidade proteica (maior primeiro)
      proteinFoods.sort((a, b) => b.food.protein - a.food.protein);
      const targetFood = proteinFoods[0];
      
      // Calcular quanto precisa adicionar
      const gramsNeeded = (proteinDeficit / targetFood.food.protein) * 100;
      const cat = (targetFood.food.category || "").toLowerCase();
      const limits = getCategoryLimits(cat, isSnack);
      const newQty = Math.min(limits.max, targetFood.quantity_grams + gramsNeeded);
      const actualIncrease = newQty - targetFood.quantity_grams;
      
      if (actualIncrease >= 5) {
        targetFood.quantity_grams = Math.round(newQty / 5) * 5;
        const cv = unitConv(targetFood.food, targetFood.quantity_grams);
        targetFood.display_quantity = cv.display_quantity;
        targetFood.display_unit = cv.display_unit;
        
        log("ProteinBoost", { 
          mealType: mt,
          food: targetFood.food.name, 
          addedGrams: Math.round(actualIncrease),
          newProtein: Math.round(getCurrentProtein() * 10) / 10,
          minRequired: minProteinRequired
        });
      }
    } else if (!isSnack) {
      // Se não há alimento proteico e é refeição principal, tentar adicionar um
      // v5.16: Respeitar bloqueio contextual (ex: não usar Seitan no café)
      const proteinCands = foods.filter(f => 
        !combined.has(f.id) && 
        !usedM.has(f.id) && 
        f.protein >= 20 && // Alta densidade proteica
        !isFattyForRandomSelection(f) &&
        !hasSimilarFood(f.name, usedGroups) &&
        !isBlockedForMealType(f, mt) // v5.16: Bloqueio contextual
      );
      
      if (proteinCands.length > 0) {
        // Priorizar preferidos
        const pCands = proteinCands.filter(f => [...prefSet].some(p => f.name.toLowerCase().includes(p)));
        const pool = pCands.length > 0 ? pCands : proteinCands;
        const f = pool[Math.floor(Math.random() * pool.length)];
        
        if (f) {
          const baseQty = Math.round((proteinDeficit / f.protein) * 100 / 5) * 5;
          const qty = applyQuantityLimits(f, Math.max(50, baseQty)); // Mínimo 50g
          const cv = unitConv(f, qty);
          sel.push({ food: f, role_name: "proteina_boost", quantity_grams: cv.calculated_grams, display_quantity: cv.display_quantity, display_unit: cv.display_unit });
          usedM.add(f.id);
          registerFoodGroup(f);
          
          log("ProteinFoodAdded", { 
            mealType: mt,
            food: f.name, 
            qty: qty,
            proteinAdded: Math.round(f.protein * qty / 100 * 10) / 10
          });
        }
      }
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
 * Obtém número máximo de opções entre todas as refeições
 */
function getMaxOptionCount(mwo: MealWithOptions[]): number {
  return Math.max(...mwo.map(m => m.options.length), 1);
}

/**
 * Valida contratos nutricionais para TODAS as opções de refeição
 * Retorna warnings se alguma opção violar os contratos
 * 
 * @param objective - Objetivo do perfil para validação de carboidratos (80% bulk, 90% outros)
 */
function validateNutritionalContracts(
  mwo: MealWithOptions[], 
  targets: MacroTargets,
  objective: GeneratorObjective = "maintain"
): { isValid: boolean; warnings: string[]; metrics: Record<string, any> } {
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
    
    // Passa o objetivo para usar threshold de carbs correto
    const validation = validateGeneratedPlan(optTotals, targets, mealProteinValues, mainMealIndices, objective);
    
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
    log("NutritionalWarnings", { warnings, metrics, objective });
  }
  
  return { isValid, warnings, metrics };
}

/**
 * Escalona porções para atingir calorias alvo
 * v5.15: REDUÇÃO ATIVA DE PROTEÍNA + ESCALONAMENTO AGRESSIVO PARA BULK
 * 
 * Estratégia:
 *   0. (v5.15) Se proteína inicial > 95% da meta, REDUZIR porções de alimentos proteicos
 *   1. Calcular quanto de proteína resultaria do scaling proporcional
 *   2. Se proteína resultante excederia 110% da meta, escalar apenas não-proteicos
 *   3. Para bulk com alta demanda calórica, usar limites expandidos e mais iterações
 */
/**
 * Escala UMA opção específica para atingir as metas de calorias
 * v5.28: Extração para permitir scaling independente por opção
 */
function scaleOption(
  mwo: MealWithOptions[],
  optionIndex: number,
  targetCals: number,
  targetProtein: number | undefined,
  objective: GeneratorObjective,
  isBulk: boolean,
  isHighDemand: boolean,
  generatorDiagnostics: GeneratorDiagnostics
): void {
  const PROTEIN_MAX_PERCENT = 1.10;
  const PROTEIN_DENSE_RATIO = 0.25;
  
  const MAX_ITERATIONS = isBulk && isHighDemand ? 8 : 5;
  const MAX_CARB_COMPENSATION = isBulk && isHighDemand ? 4.0 : 2.5;
  const CONVERGENCE_THRESHOLD = isBulk ? 0.12 : 0.08;
  
  // Calcular totais para ESTA opção específica
  const getOptionTotals = () => totalsForOption(mwo, optionIndex);
  
  // Redução de proteína inicial se necessário
  const initialTotals = getOptionTotals();
  const initialProteinPercent = targetProtein ? (initialTotals.protein / targetProtein) : 0;
  const initialCaloriePercent = initialTotals.calories / targetCals;
  
  if (targetProtein && initialProteinPercent > 0.95 && initialCaloriePercent < 0.60) {
    const targetProteinForScaling = targetProtein * 0.70;
    const proteinExcess = initialTotals.protein - targetProteinForScaling;
    
    if (proteinExcess > 0) {
      const proteinFoodsToReduce: { food: FoodSelection; mealType: string }[] = [];
      
      for (const m of mwo) {
        const opt = m.options[optionIndex];
        if (!opt?.foods) continue;
        for (const f of opt.foods) {
          if (!f || typeof f.quantity_grams !== 'number') continue;
          const proteinRatio = f.food.calories > 0 
            ? (f.food.protein * 4) / f.food.calories
            : 0;
          if (proteinRatio > PROTEIN_DENSE_RATIO && f.food.protein >= 10) {
            proteinFoodsToReduce.push({ food: f, mealType: m.mealType });
          }
        }
      }
      
      proteinFoodsToReduce.sort((a, b) => b.food.food.protein - a.food.food.protein);
      
      let remainingExcess = proteinExcess;
      
      for (const { food: f, mealType } of proteinFoodsToReduce) {
        if (remainingExcess <= 0) break;
        
        const cat = (f.food.category || "").toLowerCase();
        const isSnack = SNACK_MEALS.includes(mealType);
        const limits = getCategoryLimits(cat, isSnack);
        const currentQty = f.quantity_grams;
        const minQty = limits.min;
        
        if (currentQty <= minQty) continue;
        
        const maxRemovableGrams = currentQty - minQty;
        const proteinPer100g = f.food.protein || 0;
        const maxRemovableProtein = (maxRemovableGrams / 100) * proteinPer100g;
        
        const proteinToRemove = Math.min(maxRemovableProtein, remainingExcess);
        const gramsToRemove = (proteinToRemove / proteinPer100g) * 100;
        
        if (gramsToRemove >= 10) {
          const newQty = Math.max(minQty, Math.round((currentQty - gramsToRemove) / 5) * 5);
          const actualReduction = currentQty - newQty;
          const actualProteinRemoved = (actualReduction / 100) * proteinPer100g;
          
          f.quantity_grams = newQty;
          remainingExcess -= actualProteinRemoved;
        }
      }
      
      // Recalcular totais após redução
      for (const m of mwo) {
        const opt = m.options[optionIndex];
        if (opt) recalcOptionTotals(opt);
      }
    }
  }
  
  // Loop de scaling para esta opção
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const current = getOptionTotals();
    const proteinPercent = targetProtein ? (current.protein / targetProtein) : 0;
    
    if (!current.calories || isNaN(current.calories)) return;
    
    if (Math.abs(current.calories - targetCals) / targetCals <= CONVERGENCE_THRESHOLD) break;
    
    const calorieDeficit = current.calories < targetCals;
    const overallFactor = targetCals / (current.calories || 1);
    
    const projectedProtein = current.protein * overallFactor;
    const wouldExceedProtein = targetProtein && projectedProtein > targetProtein * PROTEIN_MAX_PERCENT;
    
    let carbCaloriesTotal = 0;
    
    for (const m of mwo) {
      const opt = m.options[optionIndex];
      if (!opt || !opt.foods) continue;
      for (const f of opt.foods) {
        if (!f || typeof f.quantity_grams !== 'number') continue;
        const proteinRatio = f.food.calories > 0 
          ? (f.food.protein * 4) / f.food.calories
          : 0;
        if (proteinRatio <= PROTEIN_DENSE_RATIO) {
          carbCaloriesTotal += (f.quantity_grams / 100) * f.food.calories;
        }
      }
    }
    
    const calorieGap = targetCals - current.calories;
    const carbCompensationFactor = carbCaloriesTotal > 0 
      ? Math.min(MAX_CARB_COMPENSATION, 1 + (calorieGap / carbCaloriesTotal))
      : overallFactor;
    
    for (const m of mwo) {
      const isSnack = SNACK_MEALS.includes(m.mealType);
      const opt = m.options[optionIndex];
      if (!opt || !opt.foods) continue;
      
      for (const f of opt.foods) {
        if (!f || typeof f.quantity_grams !== 'number') continue;
        
        const proteinRatio = f.food.calories > 0 
          ? (f.food.protein * 4) / f.food.calories
          : 0;
        const isProteinDense = proteinRatio > PROTEIN_DENSE_RATIO;
        
        let itemFactor = overallFactor;
        
        if (wouldExceedProtein && calorieDeficit) {
          if (isProteinDense) {
            itemFactor = 1.0;
          } else {
            itemFactor = carbCompensationFactor;
          }
        }
        
        const cat = (f.food.category || "").toLowerCase();
        const catLimits = getCategoryLimits(cat, isSnack);
        
        let maxQty = catLimits.max;
        if (isBulk && isHighDemand && (cat === "carboidratos" || cat === "leguminosas")) {
          maxQty = Math.round(catLimits.max * 1.5);
        }
        
        const newQty = Math.round(f.quantity_grams * itemFactor / 5) * 5;
        f.quantity_grams = Math.max(catLimits.min, Math.min(maxQty, newQty));
      }
      recalcOptionTotals(opt);
    }
  }
  
  // Fallback de injeção para bulk
  const postScaleTotals = getOptionTotals();
  const postScaleCaloriePercent = postScaleTotals.calories / targetCals;
  const postScaleProteinPercent = targetProtein ? (postScaleTotals.protein / targetProtein) : 0;
  
  const isStalled = postScaleCaloriePercent < 0.88 && postScaleProteinPercent > 0.98;
  
  if (isStalled && isBulk) {
    const calorieDeficit = targetCals - postScaleTotals.calories;
    const estimatedCarbGramsNeeded = (calorieDeficit / 1.0) * 0.8;
    
    let carbsInjected = 0;
    const maxCarbsToInject = estimatedCarbGramsNeeded;
    
    for (const m of mwo) {
      if (carbsInjected >= maxCarbsToInject) break;
      
      const opt = m.options[optionIndex];
      if (!opt?.foods || carbsInjected >= maxCarbsToInject) continue;
      
      for (const f of opt.foods) {
        if (carbsInjected >= maxCarbsToInject) break;
        
        const cat = (f.food.category || "").toLowerCase();
        if (cat !== "carboidratos" && cat !== "leguminosas") continue;
        
        const isSnack = SNACK_MEALS.includes(m.mealType);
        const catLimits = getCategoryLimits(cat, isSnack);
        const aggressiveMax = Math.round(catLimits.max * 2.0);
        
        const currentQty = f.quantity_grams;
        if (currentQty >= aggressiveMax) continue;
        
        const carbsPer100g = f.food.carbs || 0;
        if (carbsPer100g < 15) continue;
        
        const remainingCarbs = maxCarbsToInject - carbsInjected;
        const gramsToAdd = Math.min(
          aggressiveMax - currentQty,
          (remainingCarbs / carbsPer100g) * 100,
          100
        );
        
        if (gramsToAdd >= 10) {
          const newQty = Math.round((currentQty + gramsToAdd) / 5) * 5;
          const actualIncrease = newQty - currentQty;
          
          f.quantity_grams = newQty;
          carbsInjected += actualIncrease;
          
          generatorDiagnostics.generationState = GenerationState.FORCED_CARB_INJECTION;
          generatorDiagnostics.carbInjectionApplied = true;
          generatorDiagnostics.carbsInjectedGrams += actualIncrease;
          generatorDiagnostics.limitsExpanded = true;
        }
      }
      recalcOptionTotals(opt);
    }
  }
}

/**
 * Escalona porções para atingir calorias alvo
 * v5.28: REFATORADO PARA ESCALAR CADA OPÇÃO INDEPENDENTEMENTE
 * 
 * Antes: Calculava fator baseado na Opção 1 e aplicava a todas
 * Agora: Cada opção é escalada individualmente para suas próprias metas
 */
function scale(mwo: MealWithOptions[], targetCals: number, targetProtein?: number, objective: GeneratorObjective = "maintain", generatorDiagnostics: GeneratorDiagnostics = createInitialGeneratorDiagnostics()): void {
  const isBulk = objective === "bulk";
  const initialCalorieGapPercent = Math.abs(targetCals - totals(mwo).calories) / targetCals;
  const isHighDemand = initialCalorieGapPercent > 0.25;
  
  // Inicializar diagnóstico
  generatorDiagnostics.scaleIterations = 0;
  
  if (isBulk && isHighDemand) {
    log("ScaleBulkMode", { calorieGapPercent: Math.round(initialCalorieGapPercent * 100), objective });
  }
  
  // Obter número máximo de opções
  const maxOptions = getMaxOptionCount(mwo);
  
  // Escalar CADA opção independentemente
  for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
    log("ScaleOptionStart", { optionIndex: optIdx + 1, targetCals });
    
    const beforeTotals = totalsForOption(mwo, optIdx);
    
    scaleOption(mwo, optIdx, targetCals, targetProtein, objective, isBulk, isHighDemand, generatorDiagnostics);
    
    const afterTotals = totalsForOption(mwo, optIdx);
    
    log("ScaleOptionEnd", { 
      optionIndex: optIdx + 1, 
      beforeCals: beforeTotals.calories,
      afterCals: afterTotals.calories,
      caloriePercent: Math.round((afterTotals.calories / targetCals) * 100)
    });
  }
  
  // Log final com todas as opções
  const finalTotals = totals(mwo);
  log("ScaleFinal", {
    option1Calories: finalTotals.calories,
    option1Protein: Math.round(finalTotals.protein * 10) / 10,
    proteinPercent: targetProtein ? Math.round((finalTotals.protein / targetProtein) * 100) : null,
    objective,
    optionsProcessed: maxOptions
  });
}

/**
 * Recalcula os totais de uma opção de refeição
 */
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
    fat: Math.round(fat * 10) / 10 
  };
}

// =====================================================
// EQUALIZAÇÃO CALÓRICA ENTRE OPÇÕES v5.30
// =====================================================
// Garante que todas as opções de uma refeição tenham
// calorias dentro de ±5% (GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT)
// =====================================================

/**
 * Equaliza as calorias entre todas as opções de cada refeição.
 * Usa a Opção 1 como referência e ajusta as demais proporcionalmente.
 * 
 * Estratégia:
 * 1. Para cada refeição, calcula a média calórica das opções
 * 2. Identifica opções fora da tolerância de ±5%
 * 3. Escala proporcionalmente os alimentos dessas opções
 */
function equalizeOptionCalories(mwo: MealWithOptions[]): { adjusted: number; warnings: string[] } {
  const MAX_VARIANCE = GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT / 100; // 0.05
  const warnings: string[] = [];
  let totalAdjusted = 0;
  
  for (const meal of mwo) {
    if (meal.options.length <= 1) continue; // Nada a equalizar
    
    // Usar Opção 1 como referência (é a que foi mais otimizada)
    const referenceCalories = meal.options[0]?.totals.calories;
    if (!referenceCalories || referenceCalories <= 0) continue;
    
    for (let optIdx = 1; optIdx < meal.options.length; optIdx++) {
      const opt = meal.options[optIdx];
      if (!opt?.foods || opt.foods.length === 0) continue;
      
      const currentCalories = opt.totals.calories;
      const variance = Math.abs(currentCalories - referenceCalories) / referenceCalories;
      
      // Se já está dentro da tolerância, pular
      if (variance <= MAX_VARIANCE) continue;
      
      // Calcular fator de escala para atingir as calorias de referência
      const scaleFactor = referenceCalories / currentCalories;
      
      log("OptionCalorieEqualization", {
        mealType: meal.mealType,
        option: optIdx + 1,
        currentCals: currentCalories,
        targetCals: referenceCalories,
        variance: Math.round(variance * 100),
        scaleFactor: Math.round(scaleFactor * 100) / 100,
      });
      
      // Aplicar escala proporcional a todos os alimentos da opção
      for (const f of opt.foods) {
        const isSnack = SNACK_MEALS.includes(meal.mealType);
        const cat = (f.food.category || "").toLowerCase();
        const limits = getCategoryLimits(cat, isSnack);
        
        const newQty = Math.round(f.quantity_grams * scaleFactor / 5) * 5;
        f.quantity_grams = Math.max(limits.min, Math.min(limits.max, newQty));
      }
      
      recalcOptionTotals(opt);
      totalAdjusted++;
      
      // Verificar se ficou dentro da tolerância após ajuste
      const newVariance = Math.abs(opt.totals.calories - referenceCalories) / referenceCalories;
      if (newVariance > MAX_VARIANCE) {
        warnings.push(
          `[${MEAL_NAMES[meal.mealType] || meal.mealType}] Opção ${optIdx + 1} não pôde ser equalizada: ` +
          `${opt.totals.calories} kcal vs ${referenceCalories} kcal (${Math.round(newVariance * 100)}% variância)`
        );
      }
      
      log("OptionCalorieEqualizationResult", {
        mealType: meal.mealType,
        option: optIdx + 1,
        newCals: opt.totals.calories,
        newVariance: Math.round(newVariance * 100),
        withinTolerance: newVariance <= MAX_VARIANCE,
      });
    }
  }
  
  if (totalAdjusted > 0) {
    log("EqualizationComplete", { optionsAdjusted: totalAdjusted, warnings: warnings.length });
  }
  
  return { adjusted: totalAdjusted, warnings };
}

/**
 * Valida se todas as opções de cada refeição têm calorias equivalentes (±5%)
 */
function validateOptionCalorieEquivalence(mwo: MealWithOptions[]): { isValid: boolean; warnings: string[] } {
  const MAX_VARIANCE = GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT / 100;
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
          `[${MEAL_NAMES[meal.mealType] || meal.mealType}] Opção ${optIdx + 1} com ${cals} kcal ` +
          `(${Math.round(variance * 100)}% de variância da média ${Math.round(avgCalories)} kcal, máximo: ${GENERATOR_CONTRACT.MAX_OPTION_CALORIE_VARIANCE_PERCENT}%)`
        );
      }
    }
  }
  
  return { isValid: warnings.length === 0, warnings };
}

/**
 * Boost de carboidratos: aumenta porções de alimentos ricos em carbs
 * quando o plano está abaixo do threshold mínimo.
 * v5.14: Modo agressivo para bulk com alta demanda
 * 
 * @param mwo - Plano de refeições
 * @param targetCarbs - Meta de carboidratos
 * @param minCarbPercent - Percentual mínimo de carbs (ex: 0.80 para 80%)
 * @param targetCals - Meta de calorias (para não exceder)
 * @param objective - Objetivo do perfil (bulk/maintain/cut)
 */
/**
 * Boost de carboidratos: aumenta porções de alimentos ricos em carbs
 * quando o plano está abaixo do threshold mínimo.
 * v5.22: Aplica boost POR OPÇÃO, não apenas na agregação geral
 */
function boostCarbs(
  mwo: MealWithOptions[],
  targetCarbs: number,
  minCarbPercent: number,
  targetCals: number,
  objective: GeneratorObjective = "maintain"
): void {
  const isBulk = objective === "bulk";
  const maxOptions = Math.max(...mwo.map(m => m.options.length), 1);
  
  // v5.22: Verificar e aplicar boost para CADA opção individualmente
  for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
    const optTotals = totalsForOption(mwo, optIdx);
    const carbPercent = optTotals.carbs / targetCarbs;
    
    // Só aplicar boost se carbs desta opção estiverem abaixo do threshold
    if (carbPercent >= minCarbPercent) {
      if (optIdx === 0) {
        log("CarbBoostSkip", { option: optIdx + 1, carbPercent: Math.round(carbPercent * 100), threshold: minCarbPercent * 100 });
      }
      continue;
    }
    
    log("CarbBoostOptionStart", { 
      option: optIdx + 1, 
      carbPercent: Math.round(carbPercent * 100), 
      threshold: minCarbPercent * 100,
      currentCarbs: Math.round(optTotals.carbs)
    });
    
    boostCarbsForOption(mwo, optIdx, targetCarbs, minCarbPercent, targetCals, objective);
  }
}

/**
 * v5.22: Boost de carboidratos para uma opção específica
 */
function boostCarbsForOption(
  mwo: MealWithOptions[],
  optIdx: number,
  targetCarbs: number,
  minCarbPercent: number,
  targetCals: number,
  objective: GeneratorObjective
): void {
  const isBulk = objective === "bulk";
  const optTotals = totalsForOption(mwo, optIdx);
  const carbPercent = optTotals.carbs / targetCarbs;
  const isHighDemand = carbPercent < 0.70; // <70% de carbs = alta demanda
  
  const carbFloorGrams = targetCarbs * minCarbPercent;
  const carbDeficit = carbFloorGrams - optTotals.carbs;
  
  // Para bulk com alta demanda, usar parâmetros mais agressivos
  const CARB_RICH_THRESHOLD = 15; // g carbs per 100g
  const MAX_BOOST_PERCENT = isBulk && isHighDemand ? 2.5 : 1.5;
  const LIMIT_MULTIPLIER = isBulk && isHighDemand ? 1.5 : 1.0;

  let totalCarbsAdded = 0;
  const maxCarbsToAdd = carbDeficit * 1.2; // Permite overshoot de 20%

  // ==========================================
  // PASSO 1: BOOST INICIAL - Apenas para a opção específica
  // ==========================================
  for (const m of mwo) {
    if (totalCarbsAdded >= maxCarbsToAdd) break;

    // v5.22: Operar apenas na opção específica (optIdx)
    const opt = m.options[optIdx];
    if (!opt?.foods) continue;

    const carbFoods = opt.foods
      .filter((f) => f.food.carbs >= CARB_RICH_THRESHOLD)
      .sort((a, b) => b.food.carbs - a.food.carbs);

    for (const f of carbFoods) {
      if (totalCarbsAdded >= maxCarbsToAdd) break;

      const cat = (f.food.category || "").toLowerCase();
      const limits = getCategoryLimits(cat, SNACK_MEALS.includes(m.mealType));
      const currentQty = f.quantity_grams;
      const expandedMax = Math.round(limits.max * LIMIT_MULTIPLIER);
      const maxAllowedQty = Math.min(expandedMax, currentQty * MAX_BOOST_PERCENT);

      const carbsPer100g = f.food.carbs;
      const remainingCarbs = maxCarbsToAdd - totalCarbsAdded;
      const gramsNeeded = (remainingCarbs / carbsPer100g) * 100;
      const newQty = Math.min(maxAllowedQty, currentQty + gramsNeeded);
      const actualIncrease = newQty - currentQty;

      if (actualIncrease >= 10) {
        f.quantity_grams = Math.round(newQty / 5) * 5;
        const carbsAdded = (actualIncrease / 100) * carbsPer100g;
        totalCarbsAdded += carbsAdded;

        log("CarbBoostFood", {
          option: optIdx + 1,
          food: f.food.name,
          oldQty: currentQty,
          newQty: f.quantity_grams,
          carbsAdded: Math.round(carbsAdded),
        });
      }
    }

    recalcOptionTotals(opt);
  }

  // ==========================================
  // PASSO 2: GARANTIR PISO DE CARBS (v5.22: para a opção específica)
  // ==========================================
  const MAX_CAL_OVERSHOOT = 1.10;
  const CARB_FLOOR_EPS = 0.5;

  // v5.22: Helpers operam na opção específica (optIdx)
  const getOptionFoods = () =>
    mwo.flatMap((m) => {
      const opt = m.options[optIdx];
      if (!opt?.foods) return [] as Array<{ mealType: string; foodSel: FoodSelection }>;
      return opt.foods.map((foodSel) => ({ mealType: m.mealType, foodSel }));
    });

  const recalcOptionTotalsForIdx = () => {
    for (const m of mwo) {
      const opt = m.options[optIdx];
      if (opt) recalcOptionTotals(opt);
    }
  };

  const reduceCaloriesPreferNonCarb = (excessCalories: number) => {
    const items = getOptionFoods()
      .filter(({ foodSel }) => foodSel.food.carbs < CARB_RICH_THRESHOLD)
      .sort((a, b) => {
        const aCals = a.foodSel.food.calories || 0;
        const bCals = b.foodSel.food.calories || 0;
        const aCarb = a.foodSel.food.carbs || 0;
        const bCarb = b.foodSel.food.carbs || 0;
        const aRatio = aCals > 0 ? aCarb / aCals : 0;
        const bRatio = bCals > 0 ? bCarb / bCals : 0;
        if (aRatio !== bRatio) return aRatio - bRatio;
        return bCals - aCals;
      });

    let remaining = excessCalories;

    for (const { mealType, foodSel } of items) {
      if (remaining <= 0) break;

      const cat = (foodSel.food.category || "").toLowerCase();
      const limits = getCategoryLimits(cat, SNACK_MEALS.includes(mealType));
      const currentQty = foodSel.quantity_grams;
      const minQty = limits.min;
      if (currentQty <= minQty) continue;

      const calsPer100g = foodSel.food.calories || 0;
      if (calsPer100g <= 0) continue;

      const step = 5;
      const maxReducible = currentQty - minQty;
      const gramsToRemove = Math.min(maxReducible, Math.max(step, Math.ceil(((remaining * 100) / calsPer100g) / step) * step));

      if (gramsToRemove <= 0) continue;

      foodSel.quantity_grams = Math.round((currentQty - gramsToRemove) / 5) * 5;
      const calsRemoved = (gramsToRemove / 100) * calsPer100g;
      remaining -= calsRemoved;
    }

    recalcOptionTotalsForIdx();
  };

  const topUpCarbsToFloor = (neededCarbs: number) => {
    const expandedMax = isBulk && isHighDemand ? 1.5 : 1.0;
    const items = getOptionFoods()
      .filter(({ foodSel }) => foodSel.food.carbs >= CARB_RICH_THRESHOLD)
      .sort((a, b) => b.foodSel.food.carbs - a.foodSel.food.carbs);

    let remainingCarbs = neededCarbs;

    for (const { mealType, foodSel } of items) {
      if (remainingCarbs <= 0) break;

      const cat = (foodSel.food.category || "").toLowerCase();
      const limits = getCategoryLimits(cat, SNACK_MEALS.includes(mealType));
      const currentQty = foodSel.quantity_grams;
      const maxQty = Math.round(limits.max * expandedMax); // v5.22: Usar limite expandido para bulk
      if (currentQty >= maxQty) continue;

      const carbsPer100g = foodSel.food.carbs || 0;
      if (carbsPer100g <= 0) continue;

      const gramsNeeded = (remainingCarbs / carbsPer100g) * 100;
      const gramsToAdd = Math.min(maxQty - currentQty, Math.max(5, Math.round(gramsNeeded / 5) * 5));
      if (gramsToAdd <= 0) continue;

      foodSel.quantity_grams = Math.round((currentQty + gramsToAdd) / 5) * 5;
      const carbsAdded = (gramsToAdd / 100) * carbsPer100g;
      remainingCarbs -= carbsAdded;

      log("CarbBoostTopUp", {
        option: optIdx + 1,
        food: foodSel.food.name,
        addedGrams: gramsToAdd,
        approxCarbsAdded: Math.round(carbsAdded),
      });
    }

    recalcOptionTotalsForIdx();
  };

  // Loop para convergir piso de carbs
  for (let attempt = 0; attempt < 5; attempt++) {
    const t = totalsForOption(mwo, optIdx);
    const maxAllowedCals = targetCals * MAX_CAL_OVERSHOOT;

    const carbsOk = t.carbs + CARB_FLOOR_EPS >= carbFloorGrams;
    const calsOk = t.calories <= maxAllowedCals;

    if (carbsOk && calsOk) break;

    if (!calsOk) {
      reduceCaloriesPreferNonCarb(t.calories - maxAllowedCals);
      continue;
    }

    const needed = Math.max(0, carbFloorGrams - t.carbs);
    topUpCarbsToFloor(needed);
  }

  const afterBoost = totalsForOption(mwo, optIdx);
  log("CarbBoostOptionEnd", {
    option: optIdx + 1,
    carbsAdded: Math.round(totalCarbsAdded),
    newCarbs: afterBoost.carbs,
    newCarbPercent: Math.round((afterBoost.carbs / targetCarbs) * 100),
  });
}

// =====================================================
// FAT FILLER v5.20: Sistema inteligente de gordura
// Injeta azeite/abacate quando gordura < 90% da meta
// =====================================================
const FAT_FILLER_CONFIG = {
  // IDs dos alimentos "coringa" de gordura (da tabela foods)
  AZEITE_ID: "58de144e-5581-4da6-84b9-6854e24358d3",
  ABACATE_ID: "17a20117-4ced-466d-a47e-e0ea5d63bdaf",
  // Threshold para ativar o filler (ex: 90% = ativa se fat < 90% da meta)
  MIN_FAT_THRESHOLD: 0.90,
  // Porções padrão
  AZEITE_PORTION: { min: 5, max: 15, default: 10 },   // 10g = ~10g gordura
  ABACATE_PORTION: { min: 30, max: 80, default: 50 }, // 50g = ~7.5g gordura
};

/**
 * fillFat: Injeta fontes de gordura quando o macro de fat está abaixo da meta.
 * v5.28: Opera POR OPÇÃO para garantir que cada opção atinja a meta de gordura
 */
async function fillFat(
  mwo: MealWithOptions[],
  targetFat: number,
  sb: any
): Promise<void> {
  // Buscar alimentos coringa DIRETAMENTE do banco (não da lista filtrada)
  const { data: fatFoods } = await sb
    .from("foods")
    .select("id, name, calories, protein, carbs, fat, category, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled")
    .in("id", [FAT_FILLER_CONFIG.AZEITE_ID, FAT_FILLER_CONFIG.ABACATE_ID])
    .eq("is_active", true);
  
  const azeite = (fatFoods as Food[] || []).find(f => f.id === FAT_FILLER_CONFIG.AZEITE_ID);
  const abacate = (fatFoods as Food[] || []).find(f => f.id === FAT_FILLER_CONFIG.ABACATE_ID);
  
  if (!azeite && !abacate) {
    log("FatFillerNoFoods", { azeiteId: FAT_FILLER_CONFIG.AZEITE_ID, abacateId: FAT_FILLER_CONFIG.ABACATE_ID, found: fatFoods?.length || 0 });
    return;
  }
  
  // Identificar refeições principais elegíveis (almoço e jantar)
  const mainMeals = mwo.filter(m => m.mealType === "lunch" || m.mealType === "dinner");
  
  if (mainMeals.length === 0) {
    log("FatFillerNoMainMeals");
    return;
  }
  
  const maxOptions = getMaxOptionCount(mwo);
  
  // v5.28: Aplicar fat filler para CADA opção individualmente
  for (let optIdx = 0; optIdx < maxOptions; optIdx++) {
    const optTotals = totalsForOption(mwo, optIdx);
    const fatPercent = optTotals.fat / targetFat;
    
    // Só aplicar filler se gordura desta opção estiver abaixo do threshold
    if (fatPercent >= FAT_FILLER_CONFIG.MIN_FAT_THRESHOLD) {
      if (optIdx === 0) {
        log("FatFillerSkip", { option: optIdx + 1, fatPercent: Math.round(fatPercent * 100), threshold: FAT_FILLER_CONFIG.MIN_FAT_THRESHOLD * 100 });
      }
      continue;
    }
    
    const fatDeficit = (targetFat * FAT_FILLER_CONFIG.MIN_FAT_THRESHOLD) - optTotals.fat;
    
    log("FatFillerStart", {
      option: optIdx + 1,
      currentFat: Math.round(optTotals.fat * 10) / 10,
      targetFat,
      fatPercent: Math.round(fatPercent * 100),
      deficit: Math.round(fatDeficit * 10) / 10,
    });
    
    const useAbacate = abacate && fatDeficit >= 5 && fatDeficit <= 12;
    const useAzeite = azeite && (fatDeficit < 5 || fatDeficit > 12 || !abacate);
    
    let fatAdded = 0;
    const fatToAdd = fatDeficit;
    
    for (const m of mainMeals) {
      if (fatAdded >= fatToAdd) break;
      
      const opt = m.options[optIdx];
      if (!opt?.foods || fatAdded >= fatToAdd) continue;
      
      const hasAzeite = opt.foods.some(f => f.food.id === FAT_FILLER_CONFIG.AZEITE_ID);
      const hasAbacate = opt.foods.some(f => f.food.id === FAT_FILLER_CONFIG.ABACATE_ID);
      
      if (useAzeite && azeite && !hasAzeite) {
        const remainingFat = fatToAdd - fatAdded;
        const gramsNeeded = Math.min(
          FAT_FILLER_CONFIG.AZEITE_PORTION.max,
          Math.max(FAT_FILLER_CONFIG.AZEITE_PORTION.min, Math.round(remainingFat))
        );
        
        const fatFromAzeite = (gramsNeeded / 100) * azeite.fat;
        
        opt.foods.push({
          food: azeite,
          role_name: "gordura",
          quantity_grams: gramsNeeded,
          display_quantity: gramsNeeded,
          display_unit: "ml",
        });
        
        fatAdded += fatFromAzeite;
        
        log("FatFillerAzeite", {
          option: optIdx + 1,
          mealType: m.mealType,
          grams: gramsNeeded,
          fatAdded: Math.round(fatFromAzeite * 10) / 10,
        });
        
        recalcOptionTotals(opt);
        
      } else if (useAbacate && abacate && !hasAbacate) {
        const remainingFat = fatToAdd - fatAdded;
        const gramsNeeded = Math.min(
          FAT_FILLER_CONFIG.ABACATE_PORTION.max,
          Math.max(FAT_FILLER_CONFIG.ABACATE_PORTION.min, Math.round((remainingFat / 15) * 100))
        );
        
        const fatFromAbacate = (gramsNeeded / 100) * abacate.fat;
        
        opt.foods.push({
          food: abacate,
          role_name: "gordura",
          quantity_grams: gramsNeeded,
          display_quantity: gramsNeeded,
          display_unit: "g",
        });
        
        fatAdded += fatFromAbacate;
        
        log("FatFillerAbacate", {
          option: optIdx + 1,
          mealType: m.mealType,
          grams: gramsNeeded,
          fatAdded: Math.round(fatFromAbacate * 10) / 10,
        });
        
        recalcOptionTotals(opt);
      }
    }
    
    const afterFiller = totalsForOption(mwo, optIdx);
    log("FatFillerEnd", {
      option: optIdx + 1,
      fatAdded: Math.round(fatAdded * 10) / 10,
      newFat: Math.round(afterFiller.fat * 10) / 10,
      newFatPercent: Math.round((afterFiller.fat / targetFat) * 100),
    });
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
      sb.from("foods").select("id, name, calories, protein, carbs, fat, category, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled, dietary_profile").eq("review_status", "approved").eq("is_active", true),
    ]);
    if (!profile?.onboarding_completed) return createErrorResponse("Complete o onboarding", 400, cors);
    if (!canUse) return createErrorResponse(`Limite de dietas atingido`, 403, cors, { code: "DIET_LIMIT_REACHED", upgradeRequired: true });

    const optLim = planLim?.[0]?.meal_options_limit ?? 1;
    const mTypes = MEAL_TYPES[profile.meals_per_day || 4] || MEAL_TYPES[4];
    
    // v5.24: Passar goal E restrições do perfil para filtrar âncoras por objetivo e perfil dietético
    const { tplMap, ancMap } = await loadData(sb, profile.goal, profile.restrictions || []);
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
    
    // v5.15: Determinar objetivo ANTES de construir refeições para aplicar regras específicas
    const objective = mapGoalToObjective(profile.goal);
    log("ObjectiveMapped", { goal: profile.goal, objective });
    
    // Debug: listar templates disponíveis
    log("TemplateDebug", { 
      mTypes, 
      tplMapKeys: [...tplMap.keys()], 
      ancMapKeys: [...ancMap.keys()],
      sampleFoodCats: foods.slice(0, 10).map(f => ({ name: f.name, cat: f.category, normCat: normalizeCategory(f.category) }))
    });
    
    for (const mt of mTypes) {
      const tpl = tplMap.get(mt);
      if (!tpl) {
        log("NoTemplateForMealType", { mealType: mt });
        continue;
      }
      
      // Debug: roles para este meal type
      log("RolesForMealType", { 
        mealType: mt, 
        rolesCount: tpl.roles.length,
        roles: tpl.roles.map((r: any) => ({ name: r.role_name, required: r.is_required, cats: r.categories }))
      });
      
      const ancs = ancMap.get(mt) || new Map();
      const opts: MealResult[] = [], usedP = new Set<string>();
      for (let o = 1; o <= optLim; o++) {
        // v5.15: Passar objetivo para buildMeal aplicar boost de carbs e limite de proteína
        const meal = buildMeal(mt, o, tpl.roles, foods, ancs, usedG, usedP, profile.preferred_foods || [], objective);
        log("MealBuilt", { mealType: mt, option: o, foodsCount: meal.foods.length, totals: meal.totals });
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
    
    // =====================================================
    // DIAGNÓSTICO: Inicializar diagnóstico do gerador
    // =====================================================
    const generatorDiagnostics = createInitialGeneratorDiagnostics();
    
    // Debug: totais ANTES do scale
    const preScaleTotals = totals(mwo);
    log("PreScaleTotals", { ...preScaleTotals });
    
    scale(mwo, tgt.calories, tgt.protein, objective, generatorDiagnostics);
    
    // Debug: totais APÓS o scale
    const postScaleTotals = totals(mwo);
    log("PostScaleTotals", { ...postScaleTotals, targetCals: tgt.calories });

    // Boost de carboidratos para perfis bulk ou quando há déficit grande
    const carbsMinThreshold = objective === "bulk" ? 0.80 : 0.90;
    boostCarbs(mwo, tgt.carbs, carbsMinThreshold, tgt.calories, objective);
    
    // Debug: totais APÓS o boost de carbs
    const postBoostTotals = totals(mwo);
    log("PostBoostTotals", { ...postBoostTotals, objective });
    
    // v5.22: Fat Filler - Injetar gordura quando abaixo da meta (busca direta do banco)
    await fillFat(mwo, tgt.fat, sb);
    
    // Debug: totais APÓS o fat filler
    const postFatFillerTotals = totals(mwo);
    log("PostFatFillerTotals", { ...postFatFillerTotals });

    // =====================================================
    // v5.30: EQUALIZAÇÃO CALÓRICA ENTRE OPÇÕES
    // Garante que todas as opções de cada refeição tenham ±5% de variância
    // =====================================================
    const equalization = equalizeOptionCalories(mwo);
    if (equalization.adjusted > 0) {
      log("CalorieEqualizationApplied", { 
        optionsAdjusted: equalization.adjusted, 
        warnings: equalization.warnings 
      });
    }
    
    // Debug: totais APÓS a equalização
    const postEqualizationTotals = totals(mwo);
    log("PostEqualizationTotals", { ...postEqualizationTotals });

    // Validar contratos nutricionais ANTES de salvar (com objetivo para threshold de carbs)
    const validation = validateNutritionalContracts(mwo, tgt, objective);
    
    // v5.30: Validar equivalência calórica entre opções
    const optionEquivalence = validateOptionCalorieEquivalence(mwo);
    
    // Adicionar warnings de equivalência à validação principal
    if (!optionEquivalence.isValid) {
      validation.warnings.push(...optionEquivalence.warnings);
      // Nota: Não bloqueia o salvamento, apenas adiciona warnings
      log("OptionEquivalenceWarnings", { warnings: optionEquivalence.warnings });
    }
    
    // C1: BLOQUEAR salvamento se validação principal falhar
    if (!validation.isValid) {
      log("ValidationFailed", { 
        warnings: validation.warnings, 
        metrics: validation.metrics,
        objective,
        diagnostics: generatorDiagnostics
      });
      return createErrorResponse(
        `Plano não atende aos contratos nutricionais: ${validation.warnings.slice(0, 3).join("; ")}${validation.warnings.length > 3 ? ` (+ ${validation.warnings.length - 3} avisos)` : ""}`,
        400,
        cors,
        { 
          code: "NUTRITIONAL_VALIDATION_FAILED",
          validation: validation,
          diagnostics: generatorDiagnostics,
        }
      );
    }
    
    const planId = await save(sb, user.id, mwo);
    await sb.rpc("increment_usage", { _user_id: user.id, _feature: "diet" });
    log("Done", { 
      planId, 
      valid: validation.isValid, 
      warningsCount: validation.warnings.length, 
      objective,
      diagnostics: {
        generationState: generatorDiagnostics.generationState,
        stallFallbackTriggered: generatorDiagnostics.stallFallbackTriggered,
        carbInjectionApplied: generatorDiagnostics.carbInjectionApplied,
        limitsExpanded: generatorDiagnostics.limitsExpanded,
        scaleIterations: generatorDiagnostics.scaleIterations,
      }
    });

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
        objective,
        // v5.30: Incluir status de equivalência calórica entre opções
        optionEquivalence: {
          isValid: optionEquivalence.isValid,
          optionsEqualized: equalization.adjusted,
        },
      },
      // =====================================================
      // DIAGNÓSTICO: Expor no output para observabilidade
      // =====================================================
      diagnostics: {
        generationState: generatorDiagnostics.generationState,
        limitsExpanded: generatorDiagnostics.limitsExpanded,
        carbInjectionApplied: generatorDiagnostics.carbInjectionApplied,
        stallFallbackTriggered: generatorDiagnostics.stallFallbackTriggered,
        carbsInjectedGrams: generatorDiagnostics.carbsInjectedGrams,
        scaleIterations: generatorDiagnostics.scaleIterations,
        expandedLimitFoodsCount: generatorDiagnostics.expandedLimitFoods.length,
        // v5.30: Diagnóstico de equalização
        optionsEqualized: equalization.adjusted,
        equalizationWarnings: equalization.warnings.length,
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
