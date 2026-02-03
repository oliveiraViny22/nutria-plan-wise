// =====================================================
// GERADOR DE PLANO ALIMENTAR v5 - REFATORADO
// =====================================================
// Módulos separados para manutenibilidade:
// - types.ts: Tipos e interfaces
// - constants.ts: Constantes e configurações
// - logger.ts: Sistema de logging com níveis
// - unit-conversion.ts: Conversão gramas <-> unidades
// - food-filter.ts: Filtro de alimentos elegíveis
// - anchor-selection.ts: Seleção de alimentos âncora
// - template-loader.ts: Carregamento de templates (com cache)
// - meal-builder.ts: Construção de refeições
// - scaling.ts: Escala calórica e proteica
// - validation.ts: Validação estrutural e nutricional
// - database.ts: Operações de persistência
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  getCorsHeaders,
  CLIENT_ERRORS,
  getErrorForLogging,
  createErrorResponse,
  createSuccessResponse,
} from "../_shared/security.ts";
import { GENERATOR_CONTRACT } from "../_shared/nutrition-contracts.ts";

// Módulos internos
import type { Food, MacroTargets, MealWithOptions, MealResult, UserProfile } from "./types.ts";
import { MEAL_NAMES, MEAL_TYPES_MAP } from "./constants.ts";
import { logInfo, logError } from "./logger.ts";
import { filterEligibleFoods, validateFatShare, validateImplicitFat } from "./food-filter.ts";
import { loadAnchorFoods } from "./anchor-selection.ts";
import { loadTemplatesWithRoles } from "./template-loader.ts";
import { buildMealWithAnchors } from "./meal-builder.ts";
import { scaleToCalorieTarget, calculatePlanTotals } from "./scaling.ts";
import { validateStructure, validateNutritionalContracts } from "./validation.ts";
import { savePlanWithOptions } from "./database.ts";
import { optimizeMacroDistribution } from "./macro-optimization.ts";

// =====================================================
// HANDLER PRINCIPAL
// =====================================================

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    logInfo("Iniciando geração v5", { userId: user.id });

    // Carregar perfil e limites do plano em paralelo
    const [profileResult, planLimitsResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.rpc("get_user_plan", { _user_id: user.id }),
    ]);

    const { data: profile, error: profileError } = profileResult;
    if (profileError || !profile) {
      return createErrorResponse(CLIENT_ERRORS.NOT_FOUND, 404, corsHeaders);
    }

    if (!profile.onboarding_completed) {
      return createErrorResponse("Complete o onboarding primeiro", 400, corsHeaders);
    }

    // Determinar limite de opções do plano
    const planData = planLimitsResult.data?.[0];
    const mealOptionsLimit = planData?.meal_options_limit ?? 1;
    logInfo("Limite de opções do plano", { mealOptionsLimit, planName: planData?.plan_name });

    // Determinar refeições
    const mealsPerDay = profile.meals_per_day || 4;
    const mealTypes = MEAL_TYPES_MAP[mealsPerDay] || MEAL_TYPES_MAP[4];

    logInfo("Configuração", { mealsPerDay, mealTypes, mealOptionsLimit });

    // Carregar templates e âncoras em paralelo
    const [templates, anchorFoods] = await Promise.all([
      loadTemplatesWithRoles(supabase),
      loadAnchorFoods(supabase),
    ]);
    logInfo("Templates carregados", { count: templates.size });

    // Carregar alimentos
    const { data: allFoods, error: foodsError } = await supabase
      .from("foods")
      .select("id, name, calories, protein, carbs, fat, category, processing_level, is_optional, unit_name, unit_weight_grams, unit_increment, unit_enabled")
      .eq("review_status", "approved")
      .eq("is_active", true);

    if (foodsError) throw foodsError;

    logInfo("Alimentos carregados", { count: allFoods?.length || 0 });

    // Filtrar alimentos elegíveis
    const eligibleFoods = filterEligibleFoods(
      allFoods as Food[] || [],
      profile.avoided_foods || [],
      profile.restrictions || []
    );

    logInfo("Alimentos elegíveis", { count: eligibleFoods.length });

    // Gerar refeições com múltiplas opções
    const usedGlobalIds = new Set<string>();
    const mealsWithOptions: MealWithOptions[] = [];

    for (const mealType of mealTypes) {
      const templateData = templates.get(mealType);

      if (!templateData) {
        logInfo(`Template não encontrado para ${mealType}, usando fallback`);
        continue;
      }

      const mealAnchorsByRole = anchorFoods.get(mealType) || [];
      
      logInfo(`Âncoras para ${mealType}`, { 
        roles: mealAnchorsByRole.map(r => ({ 
          role: r.role_name, 
          count: r.anchors.length 
        })) 
      });

      const mealOptions: MealResult[] = [];
      const previousOptionsUsedIds = new Set<string>();

      // Gerar N opções para esta refeição
      for (let optNum = 1; optNum <= mealOptionsLimit; optNum++) {
        const meal = buildMealWithAnchors(
          mealType,
          optNum,
          templateData,
          eligibleFoods,
          usedGlobalIds,
          profile.preferred_foods || [],
          mealAnchorsByRole,
          previousOptionsUsedIds
        );
        
        // Rastrear alimentos usados
        for (const foodSel of meal.foods) {
          previousOptionsUsedIds.add(foodSel.food.id);
        }
        
        mealOptions.push(meal);

        logInfo(`Opção ${optNum} gerada para ${mealType}`, {
          items: meal.foods.length,
          foods: meal.foods.map(f => f.food.name),
          cals: meal.totals.calories,
        });
      }

      mealsWithOptions.push({ mealType, options: mealOptions });
      
      // Adicionar IDs da primeira opção ao global
      if (mealOptions[0]) {
        for (const food of mealOptions[0].foods) {
          usedGlobalIds.add(food.food.id);
        }
      }
    }

    // Extrair primeira opção de cada refeição para validação
    let meals: MealResult[] = mealsWithOptions.map(m => m.options[0]);

    // Definir alvos de macros (movido para antes das validações)
    const targets: MacroTargets = {
      calories: profile.daily_calories || 2000,
      protein: profile.protein_target || 100,
      carbs: profile.carbs_target || 250,
      fat: profile.fat_target || 65,
    };

    // NOVO v5.1: Validar dominância de gordura por alimento
    const allFoodsWithQuantity = meals.flatMap(m => 
      m.foods.map(f => ({ food: f.food, quantity_grams: f.quantity_grams }))
    );
    
    const fatShareValidation = validateFatShare(allFoodsWithQuantity, targets.fat);
    
    if (fatShareValidation.status === "FAIL") {
      logError("Dominância de gordura detectada", fatShareValidation);
      return createErrorResponse(
        `Plano estruturalmente inválido: ${fatShareValidation.food} contribui ${fatShareValidation.fatShare}% da gordura diária`,
        400,
        corsHeaders,
        { 
          code: "FAT_DOMINANCE_DETECTED", 
          details: fatShareValidation,
          action: "Regenerar plano ou trocar alimento por opção mais magra"
        }
      );
    }

    // REGRA G-10 PROGRESSIVA: Classificar gordura implícita
    const implicitFatValidation = validateImplicitFat(allFoodsWithQuantity, targets.fat);
    
    // REGENERATE: Excesso severo (>120%) → erro e regenerar
    if (implicitFatValidation.status === "REGENERATE") {
      logError("G-10 HARD FAIL: Excesso severo de gordura implícita", implicitFatValidation);
      return createErrorResponse(
        `Gordura implícita (${implicitFatValidation.totalImplicitFat}g) excede 120% da meta (${targets.fat}g). Regenerando plano.`,
        400,
        corsHeaders,
        { 
          code: "IMPLICIT_FAT_EXCEEDED", 
          details: implicitFatValidation,
          action: "Regenerar plano com proteínas mais magras"
        }
      );
    }
    
    // Metadata para passar ao rebalanceador
    const g10Metadata = {
      g10Status: implicitFatValidation.status, // PASS | ALLOW_REBALANCE
      implicitFatRatio: implicitFatValidation.ratio,
      implicitFatWarning: implicitFatValidation.warning,
    };
    
    logInfo("G-10 OK", { 
      implicitFat: implicitFatValidation.totalImplicitFat,
      maxAllowed: implicitFatValidation.maxAllowed,
      ratio: `${(implicitFatValidation.ratio * 100).toFixed(0)}%`,
      status: implicitFatValidation.status,
    });

    // Validar estrutura
    const validation = validateStructure(meals);

    if (!validation.valid) {
      logError("Validação estrutural falhou", { errors: validation.errors });
      return createErrorResponse(
        "Plano não atende requisitos estruturais",
        400,
        corsHeaders,
        { code: "STRUCTURAL_VALIDATION_FAILED", details: validation.errors }
      );
    }

    logInfo("Validação estrutural OK (incluindo fat share e G-10)");

    // Ajuste proporcional para fechar metas calóricas
    const scaleResult = scaleToCalorieTarget(mealsWithOptions, targets);
    
    logInfo("Ajuste calórico aplicado", {
      scaleFactor: scaleResult.scaleFactor.toFixed(3),
      before: scaleResult.beforeTotals,
      after: scaleResult.afterTotals,
      target: targets.calories,
      proteinAdjusted: scaleResult.proteinAdjusted,
    });
    
    // NOVA OTIMIZAÇÃO: Ajustar distribuição de macros
    const macroOptResult = optimizeMacroDistribution(mealsWithOptions, targets);
    
    logInfo("Otimização de macros aplicada", {
      multiObjectiveApplied: macroOptResult.multiObjectiveApplied,
      fineAdjustmentApplied: macroOptResult.fineAdjustmentApplied,
      beforeProtein: macroOptResult.beforeTotals.protein,
      afterProtein: macroOptResult.afterTotals.protein,
    });
    
    // Atualizar referência após ajuste
    meals = mealsWithOptions.map(m => m.options[0]);

    // Validar contratos nutricionais
    const nutritionalValidation = validateNutritionalContracts(mealsWithOptions, targets);
    
    if (nutritionalValidation.warnings.length > 0) {
      logInfo("Avisos nutricionais pós-ajuste", { 
        warnings: nutritionalValidation.warnings,
        metrics: nutritionalValidation.metrics 
      });
    }

    // Salvar plano
    const planId = await savePlanWithOptions(supabase, user.id, mealsWithOptions);

    logInfo("Plano salvo", { planId, optionsPerMeal: mealOptionsLimit });

    // Usar totais do resultado da otimização (após ambos os ajustes)
    const finalTotals = calculatePlanTotals(mealsWithOptions);
    const totalCals = finalTotals.calories;
    const totalProt = finalTotals.protein;
    const totalCarbs = finalTotals.carbs;
    const totalFat = finalTotals.fat;

    // Calcular diferença percentual final
    const finalDiffPercent = Math.abs((totalCals - targets.calories) / targets.calories * 100);
    const isWithinTolerance = finalDiffPercent <= GENERATOR_CONTRACT.CALORIE_TOLERANCE_PERCENT;

    return createSuccessResponse(
      {
        plan_id: planId,
        message: isWithinTolerance 
          ? `Plano gerado com ${mealOptionsLimit} opção(ões) por refeição. Calorias dentro da meta (${finalDiffPercent.toFixed(1)}% de diferença).`
          : `Plano gerado com ${mealOptionsLimit} opção(ões) por refeição. Rebalanceamento pode refinar os valores.`,
        requires_rebalancing: !isWithinTolerance || g10Metadata.g10Status === "ALLOW_REBALANCE",
        options_per_meal: mealOptionsLimit,
        scale_applied: scaleResult.scaleFactor !== 1,
        scale_factor: scaleResult.scaleFactor,
        scale_iterations: scaleResult.iterations,
        scale_converged: scaleResult.converged,
        protein_adjusted: scaleResult.proteinAdjusted,
        // NOVO: Metadados G-10 progressivo para o rebalanceador
        g10_status: g10Metadata.g10Status,
        implicit_fat_ratio: g10Metadata.implicitFatRatio,
        implicit_fat_warning: g10Metadata.implicitFatWarning,
        totals: {
          calories: totalCals,
          protein: totalProt,
          carbs: totalCarbs,
          fat: totalFat,
        },
        targets: {
          calories: profile.daily_calories,
          protein: profile.protein_target,
          carbs: profile.carbs_target,
          fat: profile.fat_target,
        },
        difference_percent: {
          calories: finalDiffPercent.toFixed(1),
          protein: targets.protein > 0 ? ((totalProt - targets.protein) / targets.protein * 100).toFixed(1) : "0",
          carbs: targets.carbs > 0 ? ((totalCarbs - targets.carbs) / targets.carbs * 100).toFixed(1) : "0",
          fat: targets.fat > 0 ? ((totalFat - targets.fat) / targets.fat * 100).toFixed(1) : "0",
        },
        contract_metrics: nutritionalValidation.metrics,
        contract_warnings: nutritionalValidation.warnings,
        meals: mealsWithOptions.map((m) => ({
          type: m.mealType,
          name: m.options[0]?.meal_name || MEAL_NAMES[m.mealType],
          options: m.options.length,
          items_per_option: m.options.map(o => o.foods.length),
          calories: m.options[0]?.totals.calories || 0,
        })),
      },
      corsHeaders
    );
  } catch (error) {
    logError("Erro fatal", { error: getErrorForLogging(error) });
    return createErrorResponse(
      CLIENT_ERRORS.SERVER_ERROR,
      500,
      corsHeaders
    );
  }
});
