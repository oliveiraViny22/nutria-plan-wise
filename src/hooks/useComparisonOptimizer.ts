// =====================================================
// COMPARADOR DE OTIMIZADORES
// =====================================================
// Executa os 4 otimizadores em paralelo e retorna
// resultados para comparação lado a lado:
// 1. Rápido (Brute Force puro)
// 2. Contratos (Brute Force + contratos nutricionais)
// 3. IA (ai-rebalance Edge Function)
// 4. Híbrido (IA + Brute Force)
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getCategoryLimits } from '@/lib/optimizer-limits';

// =====================================================
// CONTRACTS & CONSTANTS
// =====================================================

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

const CONTRACT = {
  CALORIE_TOLERANCE_PERCENT: 5,
  MAX_FAT_PERCENT_OF_CALORIES: 30,
  MIN_PROTEIN_MAIN_MEAL_GRAMS: 20,
  MIN_PROTEIN_SNACK_GRAMS: 5,
  MIN_CARBS_PERCENT: 90,
  MIN_PROTEIN_PERCENT: 95,
} as const;

const MAIN_MEALS = ['lunch', 'dinner', 'almoço', 'jantar', 'almoco'];
const SNACK_MEALS = ['morning_snack', 'afternoon_snack', 'lanche_manha', 'lanche_tarde', 'lanche'];


// =====================================================
// INTERFACES
// =====================================================

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface FoodItem {
  id: string;
  meal_option_food_id: string;
  meal_id: string;
  meal_name: string;
  name: string;
  quantity_grams: number;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string;
}

interface MealTotals {
  meal_id: string;
  meal_name: string;
  protein: number;
}

interface ContractViolation {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

interface OptimizerResult {
  name: string;
  icon: 'zap' | 'shield' | 'sparkles' | 'brain';
  color: string;
  macros: MacroTargets;
  changes: Array<{
    meal_option_food_id: string;
    food_name: string;
    old_quantity: number;
    new_quantity: number;
  }>;
  violations: ContractViolation[];
  score: number; // 0-100 score for ranking
  quantities: Map<string, number>;
}

export interface NutritionalAnalysis {
  recommendedIndex: number;
  recommendedName: string;
  reasoning: string;
  highlights: string[];
  tradeoffs: Array<{
    optimizerName: string;
    pros: string[];
    cons: string[];
  }>;
}

export interface ComparisonPreview {
  planId: string;
  targets: MacroTargets;
  before: MacroTargets;
  results: OptimizerResult[];
  foods: FoodItem[];
  analysis: NutritionalAnalysis;
}

interface OptimizerSettings {
  protein_weight: number;
  carbs_weight: number;
  fat_weight: number;
  calories_weight: number;
}

const DEFAULT_SETTINGS: OptimizerSettings = {
  protein_weight: 3.0,
  carbs_weight: 1.0,
  fat_weight: 1.0,
  calories_weight: 1.5,
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

// getCategoryLimits is now imported from @/lib/optimizer-limits

function calcMacros(food: FoodItem, grams: number): MacroTargets {
  const m = grams / 100;
  return {
    calories: food.calories_per_100g * m,
    protein: food.protein_per_100g * m,
    carbs: food.carbs_per_100g * m,
    fat: food.fat_per_100g * m,
  };
}

function calcTotalMacros(foods: FoodItem[], quantities: Map<string, number>): MacroTargets {
  let total: MacroTargets = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const food of foods) {
    const qty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
    const macros = calcMacros(food, qty);
    total.calories += macros.calories;
    total.protein += macros.protein;
    total.carbs += macros.carbs;
    total.fat += macros.fat;
  }
  return total;
}

function calcMealTotals(foods: FoodItem[], quantities: Map<string, number>): MealTotals[] {
  const map = new Map<string, MealTotals>();
  for (const food of foods) {
    const qty = quantities.get(food.meal_option_food_id) || food.quantity_grams;
    const macros = calcMacros(food, qty);
    if (!map.has(food.meal_id)) {
      map.set(food.meal_id, { meal_id: food.meal_id, meal_name: food.meal_name, protein: 0 });
    }
    map.get(food.meal_id)!.protein += macros.protein;
  }
  return Array.from(map.values());
}

function checkViolations(totals: MacroTargets, targets: MacroTargets, mealTotals: MealTotals[]): ContractViolation[] {
  const violations: ContractViolation[] = [];
  
  const calPct = targets.calories > 0 ? (totals.calories / targets.calories) * 100 : 0;
  if (Math.abs(calPct - 100) > CONTRACT.CALORIE_TOLERANCE_PERCENT) {
    violations.push({ code: 'CAL', message: `Calorias ${Math.round(calPct)}% da meta`, severity: 'error' });
  }
  
  const protPct = targets.protein > 0 ? (totals.protein / targets.protein) * 100 : 0;
  if (protPct < CONTRACT.MIN_PROTEIN_PERCENT) {
    violations.push({ code: 'PROT', message: `Proteína ${Math.round(protPct)}% (mín ${CONTRACT.MIN_PROTEIN_PERCENT}%)`, severity: 'error' });
  }
  
  const carbPct = targets.carbs > 0 ? (totals.carbs / targets.carbs) * 100 : 0;
  if (carbPct < CONTRACT.MIN_CARBS_PERCENT) {
    violations.push({ code: 'CARB', message: `Carboidratos ${Math.round(carbPct)}%`, severity: 'warning' });
  }
  
  const fatCal = totals.fat * KCAL_PER_GRAM.fat;
  const fatPct = totals.calories > 0 ? (fatCal / totals.calories) * 100 : 0;
  if (fatPct > CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) {
    violations.push({ code: 'FAT', message: `Gordura ${Math.round(fatPct)}% das cal (máx ${CONTRACT.MAX_FAT_PERCENT_OF_CALORIES}%)`, severity: 'error' });
  }
  
  for (const meal of mealTotals) {
    const norm = meal.meal_name.toLowerCase();
    const isMain = MAIN_MEALS.some(m => norm.includes(m));
    const isSnack = SNACK_MEALS.some(m => norm.includes(m));
    if (isMain && meal.protein < CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
      violations.push({ code: 'MEAL', message: `${meal.meal_name}: ${Math.round(meal.protein)}g prot`, severity: 'warning' });
    } else if (isSnack && meal.protein < CONTRACT.MIN_PROTEIN_SNACK_GRAMS) {
      violations.push({ code: 'SNACK', message: `${meal.meal_name}: ${Math.round(meal.protein)}g prot`, severity: 'warning' });
    }
  }
  
  return violations;
}

function calcScore(macros: MacroTargets, targets: MacroTargets, violations: ContractViolation[]): number {
  let score = 100;
  
  // Penalize macro deviations
  const calDev = Math.abs(macros.calories - targets.calories) / targets.calories;
  const protDev = Math.abs(macros.protein - targets.protein) / targets.protein;
  const carbDev = Math.abs(macros.carbs - targets.carbs) / targets.carbs;
  const fatDev = Math.abs(macros.fat - targets.fat) / targets.fat;
  
  score -= calDev * 20;
  score -= protDev * 30;
  score -= carbDev * 15;
  score -= fatDev * 15;
  
  // Penalize violations
  for (const v of violations) {
    score -= v.severity === 'error' ? 10 : 5;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// =====================================================
// NUTRITIONAL ANALYSIS FUNCTION
// =====================================================

function generateNutritionalAnalysis(
  results: OptimizerResult[],
  targets: MacroTargets,
  before: MacroTargets,
  objective: string
): NutritionalAnalysis {
  if (results.length === 0) {
    return {
      recommendedIndex: 0,
      recommendedName: 'Nenhum',
      reasoning: 'Nenhum resultado disponível para análise.',
      highlights: [],
      tradeoffs: [],
    };
  }

  // Build tradeoffs for each optimizer
  const tradeoffs = results.map(result => {
    const pros: string[] = [];
    const cons: string[] = [];
    
    // Analyze macro precision
    const protDiff = result.macros.protein - targets.protein;
    const carbDiff = result.macros.carbs - targets.carbs;
    const fatDiff = result.macros.fat - targets.fat;
    const calDiff = result.macros.calories - targets.calories;
    
    // Protein analysis
    if (Math.abs(protDiff) <= 3) {
      pros.push('Proteína precisa (±3g da meta)');
    } else if (protDiff > 0 && protDiff <= 10) {
      pros.push(`+${Math.round(protDiff)}g de proteína extra`);
    } else if (protDiff < -5) {
      cons.push(`${Math.round(protDiff)}g abaixo na proteína`);
    }
    
    // Carbs analysis
    if (Math.abs(carbDiff) <= 5) {
      pros.push('Carboidratos bem balanceados');
    } else if (carbDiff > 10) {
      cons.push(`+${Math.round(carbDiff)}g de carb (excesso energético)`);
    } else if (carbDiff < -10) {
      cons.push(`${Math.round(carbDiff)}g de carb (déficit energético)`);
    }
    
    // Fat analysis
    if (Math.abs(fatDiff) <= 3) {
      pros.push('Gordura dentro da meta');
    } else if (fatDiff > 5) {
      cons.push(`+${Math.round(fatDiff)}g de gordura`);
    } else if (fatDiff < -5) {
      pros.push(`${Math.abs(Math.round(fatDiff))}g menos gordura`);
    }
    
    // Calorie analysis
    const calPct = (result.macros.calories / targets.calories) * 100;
    if (calPct >= 98 && calPct <= 102) {
      pros.push('Calorias exatas');
    } else if (calPct > 105) {
      cons.push(`${Math.round(calPct - 100)}% acima das calorias`);
    } else if (calPct < 95) {
      cons.push(`${Math.round(100 - calPct)}% abaixo das calorias`);
    }
    
    // Violation analysis
    if (result.violations.length === 0) {
      pros.push('Nenhuma violação nutricional');
    } else {
      const errors = result.violations.filter(v => v.severity === 'error').length;
      const warnings = result.violations.filter(v => v.severity === 'warning').length;
      if (errors > 0) cons.push(`${errors} violação(ões) crítica(s)`);
      if (warnings > 0) cons.push(`${warnings} alerta(s)`);
    }
    
    // Changes analysis
    if (result.changes.length <= 3) {
      pros.push('Poucas alterações necessárias');
    } else if (result.changes.length > 10) {
      cons.push(`${result.changes.length} alimentos alterados`);
    }
    
    return {
      optimizerName: result.name,
      pros,
      cons,
    };
  });

  // Determine recommended optimizer based on objective and constraints
  let recommendedIndex = 0;
  let reasoning = '';
  const highlights: string[] = [];

  const bestResult = results[0]; // Already sorted by score
  
  // Analyze based on objective
  if (objective === 'cut' || objective === 'lose_weight') {
    // For cutting: prioritize protein retention and calorie control
    const proteinPreservers = results.filter(r => 
      r.macros.protein >= targets.protein * 0.95 && 
      r.macros.calories <= targets.calories * 1.02
    );
    
    if (proteinPreservers.length > 0) {
      // Find the one with lowest fat
      const bestForCut = proteinPreservers.reduce((best, curr) => 
        curr.macros.fat < best.macros.fat ? curr : best
      );
      recommendedIndex = results.findIndex(r => r.name === bestForCut.name);
      reasoning = `Para **cutting**, o "${bestForCut.name}" é recomendado por preservar proteína (${bestForCut.macros.protein}g ≥95% da meta) ` +
        `mantendo calorias controladas e minimizando gordura (${bestForCut.macros.fat}g).`;
      highlights.push('✓ Preserva massa muscular');
      highlights.push('✓ Controle calórico adequado');
      if (bestForCut.macros.fat <= targets.fat) {
        highlights.push('✓ Gordura dentro do limite');
      }
    } else {
      reasoning = `Nenhum otimizador atinge as metas ideais para cutting. O "${bestResult.name}" tem o melhor equilíbrio geral.`;
      highlights.push('⚠ Considere ajustar metas');
    }
  } else if (objective === 'bulk' || objective === 'gain_muscle') {
    // For bulking: prioritize protein and adequate calories
    const muscleBuilders = results.filter(r => 
      r.macros.protein >= targets.protein * 0.95 && 
      r.macros.calories >= targets.calories * 0.98
    );
    
    if (muscleBuilders.length > 0) {
      // Find the one with best protein/calorie ratio
      const bestForBulk = muscleBuilders.reduce((best, curr) => {
        const currRatio = curr.macros.protein / curr.macros.calories;
        const bestRatio = best.macros.protein / best.macros.calories;
        return currRatio > bestRatio ? curr : best;
      });
      recommendedIndex = results.findIndex(r => r.name === bestForBulk.name);
      reasoning = `Para **bulk**, o "${bestForBulk.name}" é ideal por garantir proteína suficiente (${bestForBulk.macros.protein}g) ` +
        `com calorias adequadas (${bestForBulk.macros.calories} kcal) para suportar o anabolismo.`;
      highlights.push('✓ Proteína otimizada para ganho');
      highlights.push('✓ Calorias para suportar treino');
      highlights.push('✓ Energia distribuída');
    } else {
      reasoning = `Para bulk, o "${bestResult.name}" oferece o melhor balanço entre proteína e calorias disponíveis.`;
    }
  } else {
    // For maintenance: prioritize balance and minimal violations
    const balanced = results.filter(r => 
      r.violations.length === 0 &&
      Math.abs(r.macros.calories - targets.calories) / targets.calories < 0.03
    );
    
    if (balanced.length > 0) {
      const bestBalanced = balanced[0];
      recommendedIndex = results.findIndex(r => r.name === bestBalanced.name);
      reasoning = `Para **manutenção**, o "${bestBalanced.name}" oferece o equilíbrio ideal: ` +
        `macros precisos (${bestBalanced.macros.calories} kcal) sem violar contratos nutricionais.`;
      highlights.push('✓ Macros equilibrados');
      highlights.push('✓ Sustentável a longo prazo');
      highlights.push('✓ Sem restrições extremas');
    } else if (results.some(r => r.violations.length === 0)) {
      const noViolations = results.filter(r => r.violations.length === 0)[0];
      recommendedIndex = results.findIndex(r => r.name === noViolations.name);
      reasoning = `O "${noViolations.name}" é recomendado por respeitar todos os contratos nutricionais, essencial para manutenção.`;
      highlights.push('✓ Todos os contratos respeitados');
    } else {
      reasoning = `O "${bestResult.name}" tem a melhor pontuação geral (${bestResult.score}/100) para manutenção.`;
    }
  }

  // Add comparative insight
  if (results.length >= 2) {
    const scoreDiff = results[0].score - results[results.length - 1].score;
    if (scoreDiff <= 5) {
      highlights.push('📊 Resultados muito próximos - escolha por preferência');
    } else if (scoreDiff >= 20) {
      highlights.push(`📊 Diferença significativa: ${results[0].name} claramente superior`);
    }
  }

  return {
    recommendedIndex,
    recommendedName: results[recommendedIndex]?.name || 'Nenhum',
    reasoning,
    highlights,
    tradeoffs,
  };
}

// =====================================================
// BRUTE FORCE OPTIMIZER (Simple)
// =====================================================

function optimizeBruteForce(foods: FoodItem[], targets: MacroTargets, settings: OptimizerSettings): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const f of foods) quantities.set(f.meal_option_food_id, f.quantity_grams);
  
  const calcError = (totals: MacroTargets) => {
    return (
      Math.abs(totals.calories - targets.calories) / targets.calories * settings.calories_weight +
      Math.abs(totals.protein - targets.protein) / targets.protein * settings.protein_weight +
      Math.abs(totals.carbs - targets.carbs) / targets.carbs * settings.carbs_weight +
      Math.abs(totals.fat - targets.fat) / targets.fat * settings.fat_weight
    );
  };
  
  let currentError = calcError(calcTotalMacros(foods, quantities));
  const steps = [50, 20, 10, 5, 2, 1];
  
  for (const step of steps) {
    let improved = true;
    let iter = 0;
    while (improved && iter < 150) {
      improved = false;
      iter++;
      for (const food of foods) {
        const curr = quantities.get(food.meal_option_food_id)!;
        const limits = getCategoryLimits(food.category);
        
        // Try increase
        quantities.set(food.meal_option_food_id, Math.min(curr + step, limits.max));
        let err = calcError(calcTotalMacros(foods, quantities));
        if (err < currentError) { currentError = err; improved = true; continue; }
        
        // Try decrease
        quantities.set(food.meal_option_food_id, Math.max(curr - step, limits.min));
        err = calcError(calcTotalMacros(foods, quantities));
        if (err < currentError) { currentError = err; improved = true; continue; }
        
        quantities.set(food.meal_option_food_id, curr);
      }
    }
  }
  
  for (const food of foods) {
    const q = quantities.get(food.meal_option_food_id)!;
    const limits = getCategoryLimits(food.category);
    quantities.set(food.meal_option_food_id, Math.max(limits.min, Math.min(limits.max, Math.round(q))));
  }
  
  return quantities;
}

// =====================================================
// CONTRACT-AWARE OPTIMIZER
// =====================================================

function optimizeWithContracts(foods: FoodItem[], targets: MacroTargets, settings: OptimizerSettings): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const f of foods) quantities.set(f.meal_option_food_id, f.quantity_grams);
  
  const calcError = (totals: MacroTargets, mealTotals: MealTotals[]) => {
    let err = (
      Math.abs(totals.calories - targets.calories) / targets.calories * settings.calories_weight +
      Math.abs(totals.protein - targets.protein) / targets.protein * settings.protein_weight +
      Math.abs(totals.carbs - targets.carbs) / targets.carbs * settings.carbs_weight +
      Math.abs(totals.fat - targets.fat) / targets.fat * settings.fat_weight
    );
    
    // Contract penalties
    const protPct = (totals.protein / targets.protein) * 100;
    if (protPct < CONTRACT.MIN_PROTEIN_PERCENT) err += (CONTRACT.MIN_PROTEIN_PERCENT - protPct) * 0.5;
    
    const carbPct = (totals.carbs / targets.carbs) * 100;
    if (carbPct < CONTRACT.MIN_CARBS_PERCENT) err += (CONTRACT.MIN_CARBS_PERCENT - carbPct) * 0.3;
    
    const fatCal = totals.fat * KCAL_PER_GRAM.fat;
    const fatPct = totals.calories > 0 ? (fatCal / totals.calories) * 100 : 0;
    if (fatPct > CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) err += (fatPct - CONTRACT.MAX_FAT_PERCENT_OF_CALORIES) * 0.5;
    
    for (const meal of mealTotals) {
      const norm = meal.meal_name.toLowerCase();
      const isMain = MAIN_MEALS.some(m => norm.includes(m));
      if (isMain && meal.protein < CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS) {
        err += (CONTRACT.MIN_PROTEIN_MAIN_MEAL_GRAMS - meal.protein) * 0.2;
      }
    }
    
    return err;
  };
  
  let currentError = calcError(calcTotalMacros(foods, quantities), calcMealTotals(foods, quantities));
  const steps = [50, 20, 10, 5, 2, 1];
  
  for (const step of steps) {
    let improved = true;
    let iter = 0;
    while (improved && iter < 150) {
      improved = false;
      iter++;
      for (const food of foods) {
        const curr = quantities.get(food.meal_option_food_id)!;
        const limits = getCategoryLimits(food.category);
        
        quantities.set(food.meal_option_food_id, Math.min(curr + step, limits.max));
        let err = calcError(calcTotalMacros(foods, quantities), calcMealTotals(foods, quantities));
        if (err < currentError) { currentError = err; improved = true; continue; }
        
        quantities.set(food.meal_option_food_id, Math.max(curr - step, limits.min));
        err = calcError(calcTotalMacros(foods, quantities), calcMealTotals(foods, quantities));
        if (err < currentError) { currentError = err; improved = true; continue; }
        
        quantities.set(food.meal_option_food_id, curr);
      }
    }
  }
  
  for (const food of foods) {
    const q = quantities.get(food.meal_option_food_id)!;
    const limits = getCategoryLimits(food.category);
    quantities.set(food.meal_option_food_id, Math.max(limits.min, Math.min(limits.max, Math.round(q))));
  }
  
  return quantities;
}

// =====================================================
// MAIN HOOK
// =====================================================

export function useComparisonOptimizer() {
  const [isComparing, setIsComparing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [preview, setPreview] = useState<ComparisonPreview | null>(null);
  const [settings, setSettings] = useState<OptimizerSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'optimizer_macro_settings')
          .maybeSingle();
        if (!error && data?.value) {
          setSettings({ ...DEFAULT_SETTINGS, ...(data.value as object) });
        }
      } catch (err) {
        console.error('[Comparison] Error loading settings:', err);
      }
    };
    loadSettings();
  }, []);

  const generateComparison = useCallback(async (
    planId: string, 
    targets: MacroTargets,
    objective: string = 'maintain'
  ) => {
    setIsComparing(true);
    setPreview(null);
    
    try {
      // 1. Fetch foods
      const { data: meals } = await supabase
        .from('meals')
        .select('id, name')
        .eq('diet_plan_id', planId);
      
      if (!meals?.length) {
        toast.error('Nenhuma refeição encontrada');
        return null;
      }
      
      const mealIds = meals.map(m => m.id);
      const mealNameMap = new Map(meals.map(m => [m.id, m.name]));
      
      const { data: options } = await supabase
        .from('meal_options')
        .select('id, meal_id')
        .in('meal_id', mealIds)
        .eq('option_number', 1);
      
      if (!options?.length) {
        toast.error('Nenhuma opção encontrada');
        return null;
      }
      
      const optionIds = options.map(o => o.id);
      const optionToMeal = new Map(options.map(o => [o.id, o.meal_id]));
      
      const { data: optionFoods } = await supabase
        .from('meal_option_foods')
        .select(`
          id, meal_option_id, quantity_grams,
          food:foods(id, name, calories, protein, carbs, fat, serving_size, category)
        `)
        .in('meal_option_id', optionIds);
      
      if (!optionFoods?.length) {
        toast.error('Nenhum alimento encontrado');
        return null;
      }
      
      // Parse foods
      const foods: FoodItem[] = optionFoods.map(of => {
        const food = of.food as any;
        const ss = (food.serving_size || '100g').toLowerCase();
        const mealId = optionToMeal.get(of.meal_option_id) || '';
        
        let base = 100;
        const m = ss.match(/(\d+)\s*(g|ml)/);
        if (m) base = parseInt(m[1], 10);
        if (base <= 0 || isNaN(base)) base = 100;
        
        return {
          id: food.id,
          meal_option_food_id: of.id,
          meal_id: mealId,
          meal_name: mealNameMap.get(mealId) || 'Refeição',
          name: food.name,
          quantity_grams: of.quantity_grams,
          calories_per_100g: (food.calories / base) * 100,
          protein_per_100g: (food.protein / base) * 100,
          carbs_per_100g: (food.carbs / base) * 100,
          fat_per_100g: (food.fat / base) * 100,
          category: food.category,
        };
      });
      
      // Calculate before
      const beforeQty = new Map<string, number>();
      for (const f of foods) beforeQty.set(f.meal_option_food_id, f.quantity_grams);
      const beforeMacros = calcTotalMacros(foods, beforeQty);
      
      console.log('[Comparison] Running 4 optimizers in parallel...');
      
      // Run optimizers in parallel
      const results: OptimizerResult[] = [];
      
      // 1. Brute Force (Rápido)
      const bruteQty = optimizeBruteForce(foods, targets, settings);
      const bruteMacros = calcTotalMacros(foods, bruteQty);
      const bruteViolations = checkViolations(bruteMacros, targets, calcMealTotals(foods, bruteQty));
      results.push({
        name: 'Rápido',
        icon: 'zap',
        color: 'amber',
        macros: { 
          calories: Math.round(bruteMacros.calories),
          protein: Math.round(bruteMacros.protein),
          carbs: Math.round(bruteMacros.carbs),
          fat: Math.round(bruteMacros.fat),
        },
        changes: foods.filter(f => Math.abs((bruteQty.get(f.meal_option_food_id) || f.quantity_grams) - f.quantity_grams) >= 1)
          .map(f => ({
            meal_option_food_id: f.meal_option_food_id,
            food_name: f.name,
            old_quantity: f.quantity_grams,
            new_quantity: bruteQty.get(f.meal_option_food_id) || f.quantity_grams,
          })),
        violations: bruteViolations,
        score: calcScore(bruteMacros, targets, bruteViolations),
        quantities: bruteQty,
      });
      
      // 2. Contratos
      const contractQty = optimizeWithContracts(foods, targets, settings);
      const contractMacros = calcTotalMacros(foods, contractQty);
      const contractViolations = checkViolations(contractMacros, targets, calcMealTotals(foods, contractQty));
      results.push({
        name: 'Contratos',
        icon: 'shield',
        color: 'emerald',
        macros: {
          calories: Math.round(contractMacros.calories),
          protein: Math.round(contractMacros.protein),
          carbs: Math.round(contractMacros.carbs),
          fat: Math.round(contractMacros.fat),
        },
        changes: foods.filter(f => Math.abs((contractQty.get(f.meal_option_food_id) || f.quantity_grams) - f.quantity_grams) >= 1)
          .map(f => ({
            meal_option_food_id: f.meal_option_food_id,
            food_name: f.name,
            old_quantity: f.quantity_grams,
            new_quantity: contractQty.get(f.meal_option_food_id) || f.quantity_grams,
          })),
        violations: contractViolations,
        score: calcScore(contractMacros, targets, contractViolations),
        quantities: contractQty,
      });
      
      // 3. AI Only
      try {
        const aiResponse = await supabase.functions.invoke('ai-rebalance', {
          body: { planId, targets, goal: objective },
        });
        
        if (!aiResponse.error && aiResponse.data?.success) {
          const aiData = aiResponse.data;
          const aiMacros = {
            calories: Math.round(aiData.after?.calories || beforeMacros.calories),
            protein: Math.round(aiData.after?.protein || beforeMacros.protein),
            carbs: Math.round(aiData.after?.carbs || beforeMacros.carbs),
            fat: Math.round(aiData.after?.fat || beforeMacros.fat),
          };
          
          // Build AI quantities from changes
          const aiQty = new Map(beforeQty);
          const aiChanges = aiData.changes || [];
          for (const change of aiChanges) {
            aiQty.set(change.meal_option_food_id, change.new_quantity);
          }
          
          const aiViolations = checkViolations(aiMacros, targets, calcMealTotals(foods, aiQty));
          results.push({
            name: 'IA',
            icon: 'brain',
            color: 'blue',
            macros: aiMacros,
            changes: aiChanges,
            violations: aiViolations,
            score: calcScore(aiMacros, targets, aiViolations),
            quantities: aiQty,
          });
        } else {
          console.warn('[Comparison] AI optimizer failed:', aiResponse.error);
        }
      } catch (err) {
        console.error('[Comparison] AI error:', err);
      }
      
      // 4. Hybrid (AI + Brute Force refinement)
      try {
        const aiResponse = await supabase.functions.invoke('ai-rebalance', {
          body: { planId, targets, goal: objective },
        });
        
        if (!aiResponse.error && aiResponse.data?.success) {
          // Apply AI changes first
          const hybridQty = new Map(beforeQty);
          const aiChanges = aiResponse.data.changes || [];
          for (const change of aiChanges) {
            hybridQty.set(change.meal_option_food_id, change.new_quantity);
          }
          
          // Create foods with AI quantities as starting point
          const foodsWithAI = foods.map(f => ({
            ...f,
            quantity_grams: hybridQty.get(f.meal_option_food_id) || f.quantity_grams,
          }));
          
          // Run brute force on top
          const refinedQty = optimizeWithContracts(foodsWithAI, targets, settings);
          
          // Map back to original food IDs
          const finalQty = new Map<string, number>();
          for (const f of foodsWithAI) {
            finalQty.set(f.meal_option_food_id, refinedQty.get(f.meal_option_food_id) || f.quantity_grams);
          }
          
          const hybridMacros = calcTotalMacros(foods, finalQty);
          const hybridViolations = checkViolations(hybridMacros, targets, calcMealTotals(foods, finalQty));
          
          results.push({
            name: 'Híbrido',
            icon: 'sparkles',
            color: 'purple',
            macros: {
              calories: Math.round(hybridMacros.calories),
              protein: Math.round(hybridMacros.protein),
              carbs: Math.round(hybridMacros.carbs),
              fat: Math.round(hybridMacros.fat),
            },
            changes: foods.filter(f => Math.abs((finalQty.get(f.meal_option_food_id) || f.quantity_grams) - f.quantity_grams) >= 1)
              .map(f => ({
                meal_option_food_id: f.meal_option_food_id,
                food_name: f.name,
                old_quantity: f.quantity_grams,
                new_quantity: finalQty.get(f.meal_option_food_id) || f.quantity_grams,
              })),
            violations: hybridViolations,
            score: calcScore(hybridMacros, targets, hybridViolations),
            quantities: finalQty,
          });
        }
      } catch (err) {
        console.error('[Comparison] Hybrid error:', err);
      }
      
      // Sort by score descending
      results.sort((a, b) => b.score - a.score);
      
      // Generate nutritional analysis
      const beforeRounded = {
        calories: Math.round(beforeMacros.calories),
        protein: Math.round(beforeMacros.protein),
        carbs: Math.round(beforeMacros.carbs),
        fat: Math.round(beforeMacros.fat),
      };
      const analysis = generateNutritionalAnalysis(results, targets, beforeRounded, objective);
      
      console.log('[Comparison] Analysis:', { recommended: analysis.recommendedName, reasoning: analysis.reasoning });
      
      const previewResult: ComparisonPreview = {
        planId,
        targets,
        before: beforeRounded,
        results,
        foods,
        analysis,
      };
      
      console.log('[Comparison] Results:', results.map(r => ({ name: r.name, score: r.score })));
      
      setPreview(previewResult);
      return previewResult;
    } catch (error: any) {
      console.error('[Comparison] Error:', error);
      toast.error('Erro ao comparar: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsComparing(false);
    }
  }, [settings]);

  const applyResult = useCallback(async (resultIndex: number) => {
    if (!preview || !preview.results[resultIndex]) {
      toast.error('Resultado não encontrado');
      return null;
    }

    setIsApplying(true);
    const result = preview.results[resultIndex];
    
    try {
      console.log(`[Comparison] Applying ${result.name}...`);
      
      // Apply changes
      for (const change of result.changes) {
        await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: change.new_quantity })
          .eq('id', change.meal_option_food_id);
      }
      
      // Recalculate option and plan totals
      const { data: meals } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', preview.planId);
      
      if (meals) {
        const mealIds = meals.map(m => m.id);
        
        const { data: options } = await supabase
          .from('meal_options')
          .select('id')
          .in('meal_id', mealIds)
          .eq('option_number', 1);
        
        if (options) {
          for (const opt of options) {
            const { data: optFoods } = await supabase
              .from('meal_option_foods')
              .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
              .eq('meal_option_id', opt.id);
            
            if (optFoods) {
              let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
              for (const of_ of optFoods) {
                const food = of_.food as any;
                const ss = (food.serving_size || '100g').toLowerCase();
                let base = 100;
                const m = ss.match(/(\d+)\s*(g|ml)/);
                if (m) base = parseInt(m[1], 10);
                if (base <= 0 || isNaN(base)) base = 100;
                
                const mult = of_.quantity_grams / base;
                totals.calories += Math.round(food.calories * mult);
                totals.protein += Math.round(food.protein * mult);
                totals.carbs += Math.round(food.carbs * mult);
                totals.fat += Math.round(food.fat * mult);
              }
              
              await supabase
                .from('meal_options')
                .update({
                  total_calories: totals.calories,
                  total_protein: totals.protein,
                  total_carbs: totals.carbs,
                  total_fat: totals.fat,
                })
                .eq('id', opt.id);
            }
          }
          
          // Update plan totals
          const { data: allOpts } = await supabase
            .from('meal_options')
            .select('total_calories, total_protein, total_carbs, total_fat')
            .in('meal_id', mealIds)
            .eq('option_number', 1);
          
          if (allOpts) {
            const planTotals = allOpts.reduce(
              (acc, o) => ({
                calories: acc.calories + (o.total_calories || 0),
                protein: acc.protein + (o.total_protein || 0),
                carbs: acc.carbs + (o.total_carbs || 0),
                fat: acc.fat + (o.total_fat || 0),
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );
            
            await supabase
              .from('diet_plans')
              .update({
                total_calories: planTotals.calories,
                total_protein: planTotals.protein,
                total_carbs: planTotals.carbs,
                total_fat: planTotals.fat,
              })
              .eq('id', preview.planId);
          }
        }
      }
      
      toast.success(`Otimização "${result.name}" aplicada com sucesso!`);
      setPreview(null);
      return { success: true, appliedResult: result };
    } catch (error: any) {
      console.error('[Comparison] Apply error:', error);
      toast.error('Erro ao aplicar: ' + (error.message || 'Erro desconhecido'));
      return null;
    } finally {
      setIsApplying(false);
    }
  }, [preview]);

  const cancelComparison = useCallback(() => {
    setPreview(null);
  }, []);

  return {
    isComparing,
    isApplying,
    preview,
    generateComparison,
    applyResult,
    cancelComparison,
  };
}
