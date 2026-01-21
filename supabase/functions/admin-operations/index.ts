import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-OPERATIONS] ${step}${detailsStr}`);
};

// Valid food categories and processing levels (new nutritional model)
const VALID_CATEGORIES = [
  'Carboidratos', 'Proteínas', 'Gorduras', 'Frutas', 'Vegetais',
  'Leguminosas', 'Laticínios', 'Suplementos', 'Mistos',
  // Legacy categories for backward compatibility
  'frutas', 'hortaliças_folhosas', 'legumes', 'cereais_tubérculos',
  'leguminosas', 'proteínas_animais', 'laticínios', 'óleos_oleaginosas', 'suplementos'
];

const VALID_PROCESSING_LEVELS = [
  'In natura', 'Minimamente processado', 'Processado', 'Ultraprocessado', 'Suplemento',
  // Legacy levels for backward compatibility
  'in_natura', 'minimamente_processado', 'processado', 'ultraprocessado', 'suplemento'
];

interface FoodRow {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size?: string;
  category?: string;
  processing_level?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Autenticação necessária");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Usuário não autenticado");
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Check if user is admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', {
      _user_id: userId,
      _role: 'admin'
    });

    if (!isAdmin) {
      logStep("Access denied - not admin", { userId });
      return new Response(
        JSON.stringify({ error: "Acesso negado. Apenas administradores podem acessar." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Admin access verified");

    const body = await req.json();
    const { action, ...params } = body;
    logStep("Action requested", { action });

    let result: unknown;

    switch (action) {
      case 'get_settings':
        result = await getSettings(supabaseAdmin, params.category);
        break;

      case 'update_setting':
        result = await updateSetting(supabaseAdmin, userId, params.key, params.value, req.headers);
        break;

      case 'get_food_imports':
        result = await getFoodImports(supabaseAdmin);
        break;

      case 'validate_food_csv':
        result = await validateFoodCSV(params.rows);
        break;

      case 'import_foods':
        result = await importFoods(supabaseAdmin, userId, params.importId, params.foods);
        break;

      case 'create_import_record':
        result = await createImportRecord(supabaseAdmin, userId, params.filename, params.totalRows);
        break;

      case 'get_audit_logs':
        result = await getAuditLogs(supabaseAdmin, params.limit || 50, params.offset || 0);
        break;

      case 'get_food_template':
        result = getFoodTemplate();
        break;

      case 'change_user_password':
        result = await changeUserPassword(supabaseAdmin, userId, params.targetUserId, params.newPassword, req.headers);
        break;

      case 'preview_delete_user':
        result = await previewDeleteUser(supabaseAdmin, params.targetUserId);
        break;

      case 'delete_user':
        result = await deleteUser(supabaseAdmin, userId, params.targetUserId, req.headers);
        break;

      case 'get_plans':
        result = await getPlans(supabaseAdmin);
        break;

      case 'update_plan':
        result = await updatePlan(supabaseAdmin, userId, params.planId, params.updates, req.headers);
        break;

      case 'search_foods':
        result = await searchFoods(supabaseAdmin, params.query, params.limit, params.offset);
        break;

      case 'update_food':
        result = await updateFood(supabaseAdmin, userId, params.foodId, params.updates, req.headers);
        break;

      case 'batch_update_foods':
        result = await batchUpdateFoods(supabaseAdmin, userId, params.updates, req.headers);
        break;

      case 'delete_food':
        result = await deleteFood(supabaseAdmin, userId, params.foodId, req.headers);
        break;

      case 'normalize_food_names':
        result = await normalizeFoodNames(supabaseAdmin, userId, req.headers);
        break;

      case 'get_user_usage':
        result = await getUserUsage(supabaseAdmin, params.userId);
        break;

      case 'update_user_usage':
        result = await updateUserUsage(supabaseAdmin, userId, params.targetUserId, params.updates, req.headers);
        break;

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    logStep("Action completed", { action });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    // Handle various error formats (Error, Supabase error object, string, etc.)
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Supabase errors have a 'message' property
      message = (error as { message?: string; error?: string }).message 
        || (error as { message?: string; error?: string }).error 
        || JSON.stringify(error);
    } else {
      message = String(error);
    }
    logStep("ERROR", { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// deno-lint-ignore no-explicit-any
async function getSettings(supabase: any, category?: string) {
  let query = supabase.from('system_settings').select('*');
  
  if (category) {
    query = query.eq('category', category);
  }
  
  const { data, error } = await query.order('category').order('key');
  
  if (error) throw error;
  return { settings: data };
}

// deno-lint-ignore no-explicit-any
async function updateSetting(
  supabase: any,
  userId: string,
  key: string,
  value: unknown,
  headers: Headers
) {
  // Get old value for audit
  const { data: oldSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();

  // Update setting
  const { data, error } = await supabase
    .from('system_settings')
    .update({
      value: value,
      updated_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('key', key)
    .select()
    .single();

  if (error) throw error;

  // Create audit log
  await supabase.from('admin_audit_log').insert({
    user_id: userId,
    action: 'update_setting',
    entity_type: 'system_settings',
    entity_id: key,
    old_value: oldSetting?.value,
    new_value: value,
    user_agent: headers.get('user-agent'),
  });

  return { setting: data };
}

// deno-lint-ignore no-explicit-any
async function getFoodImports(supabase: any) {
  const { data, error } = await supabase
    .from('food_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return { imports: data };
}

// Average nutritional values for estimating missing data (per 100g)
const AVERAGE_NUTRITIONAL_VALUES = {
  calories: 150,  // Average kcal
  protein: 8,     // Average grams
  carbs: 20,      // Average grams
  fat: 5,         // Average grams
};

function validateFoodCSV(rows: Record<string, unknown>[]): { valid: boolean; errors: string[]; validRows: FoodRow[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validRows: FoodRow[] = [];

  const allColumns = ['name', 'calories', 'protein', 'carbs', 'fat', 'serving_size', 'category', 'processing_level'];
  
  if (!rows || rows.length === 0) {
    return { valid: false, errors: ['Arquivo vazio ou inválido'], validRows: [], warnings: [] };
  }

  // Check if first row has at least the name column
  const firstRow = rows[0];
  if (!('name' in firstRow)) {
    return { 
      valid: false, 
      errors: ['Coluna "name" é obrigatória'], 
      validRows: [],
      warnings: []
    };
  }

  // Warn about missing optional columns
  const missingColumns = allColumns.filter(col => !(col in firstRow));
  if (missingColumns.length > 0) {
    warnings.push(`Colunas ausentes serão preenchidas com valores padrão: ${missingColumns.join(', ')}`);
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because of header row and 0-indexing
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];

    // Validate name - this is the only truly required field
    if (!row.name || String(row.name).trim() === '') {
      rowErrors.push(`Linha ${rowNum}: nome é obrigatório`);
    }

    // Parse and validate/estimate numeric fields
    const numericFields = ['calories', 'protein', 'carbs', 'fat'] as const;
    const parsedValues: Record<string, number> = {};
    
    numericFields.forEach(field => {
      const rawValue = row[field];
      if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
        // Use average value and warn
        parsedValues[field] = AVERAGE_NUTRITIONAL_VALUES[field];
        rowWarnings.push(`Linha ${rowNum}: ${field} ausente, usando valor médio (${AVERAGE_NUTRITIONAL_VALUES[field]})`);
      } else {
        const value = Number(rawValue);
        if (isNaN(value) || value < 0) {
          // Try to use average if invalid
          parsedValues[field] = AVERAGE_NUTRITIONAL_VALUES[field];
          rowWarnings.push(`Linha ${rowNum}: ${field} inválido, usando valor médio (${AVERAGE_NUTRITIONAL_VALUES[field]})`);
        } else {
          parsedValues[field] = value;
        }
      }
    });

    // Validate category if provided
    let category: string | null = null;
    if (row.category && String(row.category).trim() !== '') {
      if (VALID_CATEGORIES.includes(String(row.category))) {
        category = String(row.category);
      } else {
        rowWarnings.push(`Linha ${rowNum}: categoria inválida "${row.category}", será ignorada`);
      }
    }

    // Validate processing_level if provided
    let processingLevel = 'in_natura';
    if (row.processing_level && String(row.processing_level).trim() !== '') {
      if (VALID_PROCESSING_LEVELS.includes(String(row.processing_level))) {
        processingLevel = String(row.processing_level);
      } else {
        rowWarnings.push(`Linha ${rowNum}: nível de processamento inválido "${row.processing_level}", usando "in_natura"`);
      }
    }

    if (rowErrors.length === 0) {
      validRows.push({
        name: String(row.name).trim(),
        calories: parsedValues.calories,
        protein: parsedValues.protein,
        carbs: parsedValues.carbs,
        fat: parsedValues.fat,
        serving_size: row.serving_size && String(row.serving_size).trim() !== '' 
          ? String(row.serving_size) 
          : '100g',
        category: category,
        processing_level: processingLevel,
      } as FoodRow);
      warnings.push(...rowWarnings);
    } else {
      errors.push(...rowErrors);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, 20), // Limit errors shown
    validRows,
    warnings: warnings.slice(0, 30) // Limit warnings shown
  };
}

// deno-lint-ignore no-explicit-any
async function createImportRecord(
  supabase: any,
  userId: string,
  filename: string,
  totalRows: number
) {
  const { data, error } = await supabase
    .from('food_imports')
    .insert({
      filename,
      total_rows: totalRows,
      imported_by: userId,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return { import: data };
}

// deno-lint-ignore no-explicit-any
async function importFoods(
  supabase: any,
  userId: string,
  importId: string,
  foods: FoodRow[]
) {
  // Update import status to processing
  await supabase
    .from('food_imports')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', importId);

  let importedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  // Insert foods in batches
  const batchSize = 100;
  for (let i = 0; i < foods.length; i += batchSize) {
    const batch = foods.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('foods')
      .upsert(
        batch.map(f => ({
          name: f.name,
          calories: f.calories,
          protein: f.protein,
          carbs: f.carbs,
          fat: f.fat,
          serving_size: f.serving_size || '100g',
          category: f.category,
          processing_level: f.processing_level || 'in_natura'
        })),
        { onConflict: 'name' }
      )
      .select();

    if (error) {
      failedCount += batch.length;
      errors.push(`Erro no lote ${Math.floor(i / batchSize) + 1}: ${error.message}`);
    } else {
      importedCount += data?.length || 0;
    }
  }

  // Update import record
  const finalStatus = failedCount === 0 ? 'completed' : (importedCount > 0 ? 'completed' : 'failed');
  
  await supabase
    .from('food_imports')
    .update({
      status: finalStatus,
      imported_rows: importedCount,
      failed_rows: failedCount,
      errors: errors,
      completed_at: new Date().toISOString()
    })
    .eq('id', importId);

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: userId,
    action: 'import_foods',
    entity_type: 'foods',
    entity_id: importId,
    new_value: { imported: importedCount, failed: failedCount }
  });

  return {
    success: true,
    imported: importedCount,
    failed: failedCount,
    errors
  };
}

// deno-lint-ignore no-explicit-any
async function getAuditLogs(
  supabase: any,
  limit: number,
  offset: number
) {
  const { data, error, count } = await supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { logs: data, total: count };
}

function getFoodTemplate() {
  const headers = ['name', 'calories', 'protein', 'carbs', 'fat', 'serving_size', 'category', 'processing_level'];
  const exampleRow = ['Arroz branco cozido', '128', '2.5', '28', '0.2', '100g', 'cereais_tubérculos', 'minimamente_processado'];
  
  return {
    headers,
    exampleRow,
    validCategories: VALID_CATEGORIES,
    validProcessingLevels: VALID_PROCESSING_LEVELS,
    csvContent: [headers.join(','), exampleRow.join(',')].join('\n')
  };
}

// deno-lint-ignore no-explicit-any
async function changeUserPassword(
  supabase: any,
  adminId: string,
  targetUserId: string,
  newPassword: string,
  headers: Headers
) {
  if (!targetUserId || !newPassword) {
    throw new Error('ID do usuário e nova senha são obrigatórios');
  }

  if (newPassword.length < 8) {
    throw new Error('A senha deve ter pelo menos 8 caracteres');
  }

  logStep('Changing password for user', { targetUserId });

  const { error } = await supabase.auth.admin.updateUserById(
    targetUserId,
    { password: newPassword }
  );

  if (error) {
    logStep('Error changing password', { error: error.message });
    throw new Error(`Erro ao alterar senha: ${error.message}`);
  }

  // Also reset must_change_password flag
  await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('user_id', targetUserId);

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'change_user_password',
    entity_type: 'user',
    entity_id: targetUserId,
    user_agent: headers.get('user-agent'),
  });

  logStep('Password changed successfully', { targetUserId });
  return { success: true };
}

// deno-lint-ignore no-explicit-any
async function deleteUser(
  supabase: any,
  adminId: string,
  targetUserId: string,
  headers: Headers
) {
  if (!targetUserId) {
    throw new Error('ID do usuário é obrigatório');
  }

  // Prevent deleting yourself
  if (targetUserId === adminId) {
    throw new Error('Você não pode excluir sua própria conta');
  }

  // Prevent deleting system admin
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('email, name')
    .eq('user_id', targetUserId)
    .single();

  if (targetProfile?.email === 'admin@nutriai.app') {
    throw new Error('Não é possível excluir a conta de administrador do sistema');
  }

  logStep('Starting complete user deletion', { targetUserId, email: targetProfile?.email });

  const deletionStats: Record<string, number> = {};

  try {
    // 1. Get all diet_plan IDs for this user (needed for cascading deletes)
    const { data: dietPlans } = await supabase
      .from('diet_plans')
      .select('id')
      .eq('user_id', targetUserId);
    
    const dietPlanIds = dietPlans?.map((dp: { id: string }) => dp.id) || [];
    logStep('Found diet plans', { count: dietPlanIds.length });

    // 2. Get all daily_log IDs for this user
    const { data: dailyLogs } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', targetUserId);
    
    const dailyLogIds = dailyLogs?.map((dl: { id: string }) => dl.id) || [];

    // 3. Get all meal IDs from user's diet plans
    const { data: meals } = await supabase
      .from('meals')
      .select('id')
      .in('diet_plan_id', dietPlanIds.length > 0 ? dietPlanIds : ['00000000-0000-0000-0000-000000000000']);
    
    const mealIds = meals?.map((m: { id: string }) => m.id) || [];

    // 4. Get all meal_option IDs
    const { data: mealOptions } = await supabase
      .from('meal_options')
      .select('id')
      .in('meal_id', mealIds.length > 0 ? mealIds : ['00000000-0000-0000-0000-000000000000']);
    
    const mealOptionIds = mealOptions?.map((mo: { id: string }) => mo.id) || [];

    // === START DELETION (order matters due to FK relationships) ===

    // Delete meal_logs (depends on daily_logs)
    if (dailyLogIds.length > 0) {
      const { count } = await supabase
        .from('meal_logs')
        .delete({ count: 'exact' })
        .in('daily_log_id', dailyLogIds);
      deletionStats['meal_logs'] = count || 0;
    }

    // Delete daily_logs
    {
      const { count } = await supabase
        .from('daily_logs')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['daily_logs'] = count || 0;
    }

    // Delete meal_option_foods (depends on meal_options)
    if (mealOptionIds.length > 0) {
      const { count } = await supabase
        .from('meal_option_foods')
        .delete({ count: 'exact' })
        .in('meal_option_id', mealOptionIds);
      deletionStats['meal_option_foods'] = count || 0;
    }

    // Delete meal_options (depends on meals)
    if (mealIds.length > 0) {
      const { count } = await supabase
        .from('meal_options')
        .delete({ count: 'exact' })
        .in('meal_id', mealIds);
      deletionStats['meal_options'] = count || 0;
    }

    // Delete meal_foods (depends on meals)
    if (mealIds.length > 0) {
      const { count } = await supabase
        .from('meal_foods')
        .delete({ count: 'exact' })
        .in('meal_id', mealIds);
      deletionStats['meal_foods'] = count || 0;
    }

    // Delete meals (depends on diet_plans)
    if (dietPlanIds.length > 0) {
      const { count } = await supabase
        .from('meals')
        .delete({ count: 'exact' })
        .in('diet_plan_id', dietPlanIds);
      deletionStats['meals'] = count || 0;
    }

    // Delete ai_suggestions (depends on diet_plans)
    if (dietPlanIds.length > 0) {
      const { count } = await supabase
        .from('ai_suggestions')
        .delete({ count: 'exact' })
        .in('diet_plan_id', dietPlanIds);
      deletionStats['ai_suggestions'] = count || 0;
    }

    // Delete plan_versions (depends on diet_plans)
    if (dietPlanIds.length > 0) {
      const { count } = await supabase
        .from('plan_versions')
        .delete({ count: 'exact' })
        .in('diet_plan_id', dietPlanIds);
      deletionStats['plan_versions'] = count || 0;
    }

    // Delete adherence_metrics (depends on diet_plans)
    {
      const { count } = await supabase
        .from('adherence_metrics')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['adherence_metrics'] = count || 0;
    }

    // Delete diet_plans
    {
      const { count } = await supabase
        .from('diet_plans')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['diet_plans'] = count || 0;
    }

    // Delete chat_messages
    {
      const { count } = await supabase
        .from('chat_messages')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['chat_messages'] = count || 0;
    }

    // Delete weight_logs
    {
      const { count } = await supabase
        .from('weight_logs')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['weight_logs'] = count || 0;
    }

    // Delete plan_history
    {
      const { count } = await supabase
        .from('plan_history')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['plan_history'] = count || 0;
    }

    // Delete adherence_report_files
    {
      const { count } = await supabase
        .from('adherence_report_files')
        .delete({ count: 'exact' })
        .or(`user_id.eq.${targetUserId},student_id.eq.${targetUserId}`);
      deletionStats['adherence_report_files'] = count || 0;
    }

    // Delete subscriptions
    {
      const { count } = await supabase
        .from('subscriptions')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['subscriptions'] = count || 0;
    }

    // Delete user_usage
    {
      const { count } = await supabase
        .from('user_usage')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['user_usage'] = count || 0;
    }

    // Delete user_roles
    {
      const { count } = await supabase
        .from('user_roles')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['user_roles'] = count || 0;
    }

    // Delete professional_students (as student or professional)
    {
      const { count } = await supabase
        .from('professional_students')
        .delete({ count: 'exact' })
        .or(`student_id.eq.${targetUserId},professional_id.eq.${targetUserId}`);
      deletionStats['professional_students'] = count || 0;
    }

    // Delete professional_licenses
    {
      const { count } = await supabase
        .from('professional_licenses')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['professional_licenses'] = count || 0;
    }

    // Delete student_requests (as student or professional)
    {
      const { count } = await supabase
        .from('student_requests')
        .delete({ count: 'exact' })
        .or(`student_id.eq.${targetUserId},professional_id.eq.${targetUserId}`);
      deletionStats['student_requests'] = count || 0;
    }

    // Delete adherence_alert_configs
    {
      const { count } = await supabase
        .from('adherence_alert_configs')
        .delete({ count: 'exact' })
        .eq('professional_id', targetUserId);
      deletionStats['adherence_alert_configs'] = count || 0;
    }

    // Delete adherence_alerts (as student or professional)
    {
      const { count } = await supabase
        .from('adherence_alerts')
        .delete({ count: 'exact' })
        .or(`student_id.eq.${targetUserId},professional_id.eq.${targetUserId}`);
      deletionStats['adherence_alerts'] = count || 0;
    }

    // Delete profile
    {
      const { count } = await supabase
        .from('profiles')
        .delete({ count: 'exact' })
        .eq('user_id', targetUserId);
      deletionStats['profiles'] = count || 0;
    }

    logStep('All user data deleted from tables', deletionStats);

    // Finally, delete from auth
    const { error } = await supabase.auth.admin.deleteUser(targetUserId);

    if (error) {
      logStep('Error deleting auth user', { error: error.message });
      throw new Error(`Erro ao excluir conta de autenticação: ${error.message}`);
    }

    // Audit log with full deletion stats
    await supabase.from('admin_audit_log').insert({
      user_id: adminId,
      action: 'delete_user_complete',
      entity_type: 'user',
      entity_id: targetUserId,
      old_value: {
        profile: targetProfile,
        deletion_stats: deletionStats
      },
      user_agent: headers.get('user-agent'),
    });

    logStep('User deleted completely', { targetUserId, stats: deletionStats });
    return { success: true, deletedRecords: deletionStats };

  } catch (error) {
    logStep('Error during user deletion', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

// deno-lint-ignore no-explicit-any
async function getPlans(supabase: any) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('type')
    .order('name');

  if (error) throw error;
  return { plans: data };
}

// deno-lint-ignore no-explicit-any
async function updatePlan(
  supabase: any,
  adminId: string,
  planId: string,
  updates: Record<string, unknown>,
  headers: Headers
) {
  if (!planId) {
    throw new Error('ID do plano é obrigatório');
  }

  logStep('Updating plan', { planId, updates });

  // Get old values for audit
  const { data: oldPlan } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .single();

  // Update plan
  const { data, error } = await supabase
    .from('plans')
    .update(updates)
    .eq('id', planId)
    .select()
    .single();

  if (error) {
    logStep('Error updating plan', { error: error.message });
    throw new Error(`Erro ao atualizar plano: ${error.message}`);
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'update_plan',
    entity_type: 'plan',
    entity_id: planId,
    old_value: oldPlan,
    new_value: updates,
    user_agent: headers.get('user-agent'),
  });

  logStep('Plan updated successfully', { planId });
  return { plan: data };
}

// deno-lint-ignore no-explicit-any
async function previewDeleteUser(
  supabase: any,
  targetUserId: string
) {
  if (!targetUserId) {
    throw new Error('ID do usuário é obrigatório');
  }

  logStep('Previewing user deletion', { targetUserId });

  // Get user profile info
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('name, email, account_type, user_type, professional_id, created_at')
    .eq('user_id', targetUserId)
    .single();

  if (!userProfile) {
    throw new Error('Usuário não encontrado');
  }

  // Prevent preview for system admin
  if (userProfile.email === 'admin@nutriai.app') {
    throw new Error('Não é possível excluir a conta de administrador do sistema');
  }

  const preview: Record<string, number> = {};

  // Get diet_plan IDs
  const { data: dietPlans, count: dietPlansCount } = await supabase
    .from('diet_plans')
    .select('id', { count: 'exact', head: false })
    .eq('user_id', targetUserId);
  
  preview['diet_plans'] = dietPlansCount || 0;
  const dietPlanIds = dietPlans?.map((dp: { id: string }) => dp.id) || [];

  // Get daily_logs count
  const { count: dailyLogsCount } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  preview['daily_logs'] = dailyLogsCount || 0;

  // Get meal_logs count (via daily_logs)
  if (dailyLogsCount && dailyLogsCount > 0) {
    const { data: dailyLogs } = await supabase
      .from('daily_logs')
      .select('id')
      .eq('user_id', targetUserId);
    const dailyLogIds = dailyLogs?.map((dl: { id: string }) => dl.id) || [];
    
    if (dailyLogIds.length > 0) {
      const { count: mealLogsCount } = await supabase
        .from('meal_logs')
        .select('id', { count: 'exact', head: true })
        .in('daily_log_id', dailyLogIds);
      preview['meal_logs'] = mealLogsCount || 0;
    }
  }

  // Get meals and related counts
  if (dietPlanIds.length > 0) {
    const { data: meals, count: mealsCount } = await supabase
      .from('meals')
      .select('id', { count: 'exact', head: false })
      .in('diet_plan_id', dietPlanIds);
    preview['meals'] = mealsCount || 0;
    
    const mealIds = meals?.map((m: { id: string }) => m.id) || [];
    
    if (mealIds.length > 0) {
      const { count: mealOptionsCount } = await supabase
        .from('meal_options')
        .select('id', { count: 'exact', head: true })
        .in('meal_id', mealIds);
      preview['meal_options'] = mealOptionsCount || 0;

      const { count: mealFoodsCount } = await supabase
        .from('meal_foods')
        .select('id', { count: 'exact', head: true })
        .in('meal_id', mealIds);
      preview['meal_foods'] = mealFoodsCount || 0;
    }

    const { count: aiSuggestionsCount } = await supabase
      .from('ai_suggestions')
      .select('id', { count: 'exact', head: true })
      .in('diet_plan_id', dietPlanIds);
    preview['ai_suggestions'] = aiSuggestionsCount || 0;

    const { count: planVersionsCount } = await supabase
      .from('plan_versions')
      .select('id', { count: 'exact', head: true })
      .in('diet_plan_id', dietPlanIds);
    preview['plan_versions'] = planVersionsCount || 0;
  }

  // Other tables with user_id
  const { count: chatMessagesCount } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  preview['chat_messages'] = chatMessagesCount || 0;

  const { count: weightLogsCount } = await supabase
    .from('weight_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  preview['weight_logs'] = weightLogsCount || 0;

  const { count: adherenceMetricsCount } = await supabase
    .from('adherence_metrics')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  preview['adherence_metrics'] = adherenceMetricsCount || 0;

  const { count: subscriptionsCount } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  preview['subscriptions'] = subscriptionsCount || 0;

  const { count: userRolesCount } = await supabase
    .from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);
  preview['user_roles'] = userRolesCount || 0;

  // Professional-related (as professional or student)
  const { count: professionalStudentsCount } = await supabase
    .from('professional_students')
    .select('id', { count: 'exact', head: true })
    .or(`student_id.eq.${targetUserId},professional_id.eq.${targetUserId}`);
  preview['professional_students'] = professionalStudentsCount || 0;

  const { count: studentRequestsCount } = await supabase
    .from('student_requests')
    .select('id', { count: 'exact', head: true })
    .or(`student_id.eq.${targetUserId},professional_id.eq.${targetUserId}`);
  preview['student_requests'] = studentRequestsCount || 0;

  // Calculate totals
  const totalRecords = Object.values(preview).reduce((sum, count) => sum + count, 0);

  logStep('Delete preview generated', { targetUserId, totalRecords });

  return {
    user: userProfile,
    records: preview,
    totalRecords,
  };
}

// deno-lint-ignore no-explicit-any
async function searchFoods(
  supabase: any,
  query: string,
  limit: number = 50,
  offset: number = 0
) {
  logStep('Searching foods', { query, limit, offset });

  let dbQuery = supabase
    .from('foods')
    .select('*', { count: 'exact' });

  if (query && query.trim() !== '') {
    dbQuery = dbQuery.ilike('name', `%${query.trim()}%`);
  }

  const { data, error, count } = await dbQuery
    .order('name')
    .range(offset, offset + limit - 1);

  if (error) {
    logStep('Error searching foods', { error: error.message });
    throw new Error(`Erro ao buscar alimentos: ${error.message}`);
  }

  return { foods: data || [], total: count || 0 };
}

// deno-lint-ignore no-explicit-any
async function updateFood(
  supabase: any,
  adminId: string,
  foodId: string,
  updates: Record<string, unknown>,
  headers: Headers
) {
  if (!foodId) {
    throw new Error('ID do alimento é obrigatório');
  }

  logStep('Updating food', { foodId, updates });

  // Validate updates
  const allowedFields = ['name', 'calories', 'protein', 'carbs', 'fat', 'serving_size', 'category', 'processing_level'];
  const filteredUpdates: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      if (key === 'category') {
        if (value && !VALID_CATEGORIES.includes(String(value))) {
          throw new Error(`Categoria inválida: ${value}`);
        }
        filteredUpdates[key] = value || null;
      } else if (key === 'processing_level') {
        if (value && !VALID_PROCESSING_LEVELS.includes(String(value))) {
          throw new Error(`Nível de processamento inválido: ${value}`);
        }
        filteredUpdates[key] = value || 'in_natura';
      } else if (['calories', 'protein', 'carbs', 'fat'].includes(key)) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < 0) {
          throw new Error(`${key} deve ser um número >= 0`);
        }
        filteredUpdates[key] = numValue;
      } else {
        filteredUpdates[key] = value;
      }
    }
  }

  if (Object.keys(filteredUpdates).length === 0) {
    throw new Error('Nenhum campo válido para atualizar');
  }

  // Get old values for audit
  const { data: oldFood } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .single();

  const { data, error } = await supabase
    .from('foods')
    .update(filteredUpdates)
    .eq('id', foodId)
    .select()
    .single();

  if (error) {
    logStep('Error updating food', { error: error.message });
    throw new Error(`Erro ao atualizar alimento: ${error.message}`);
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'update_food',
    entity_type: 'food',
    entity_id: foodId,
    old_value: oldFood,
    new_value: data,
    user_agent: headers.get('user-agent'),
  });

  logStep('Food updated successfully', { foodId });
  return { food: data };
}

// Batch update foods for migration
// deno-lint-ignore no-explicit-any
async function batchUpdateFoods(
  supabase: any,
  adminId: string,
  updates: Array<{ foodId: string; updates: { category?: string; processing_level?: string } }>,
  headers: Headers
) {
  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    throw new Error('Lista de atualizações é obrigatória');
  }

  logStep('Batch updating foods', { count: updates.length });

  const results = {
    success: 0,
    failed: 0,
    errors: [] as Array<{ foodId: string; error: string }>,
  };

  for (const item of updates) {
    try {
      const { foodId, updates: foodUpdates } = item;
      
      if (!foodId) {
        results.failed++;
        results.errors.push({ foodId: 'unknown', error: 'ID do alimento não fornecido' });
        continue;
      }

      // Validate updates
      const filteredUpdates: Record<string, unknown> = {};

      if (foodUpdates.category !== undefined) {
        if (foodUpdates.category && !VALID_CATEGORIES.includes(foodUpdates.category)) {
          results.failed++;
          results.errors.push({ foodId, error: `Categoria inválida: ${foodUpdates.category}` });
          continue;
        }
        filteredUpdates.category = foodUpdates.category || null;
      }

      if (foodUpdates.processing_level !== undefined) {
        if (foodUpdates.processing_level && !VALID_PROCESSING_LEVELS.includes(foodUpdates.processing_level)) {
          results.failed++;
          results.errors.push({ foodId, error: `Nível de processamento inválido: ${foodUpdates.processing_level}` });
          continue;
        }
        filteredUpdates.processing_level = foodUpdates.processing_level || 'in_natura';
      }

      if (Object.keys(filteredUpdates).length === 0) {
        results.failed++;
        results.errors.push({ foodId, error: 'Nenhum campo válido para atualizar' });
        continue;
      }

      // Update the food
      const { error } = await supabase
        .from('foods')
        .update(filteredUpdates)
        .eq('id', foodId);

      if (error) {
        results.failed++;
        results.errors.push({ foodId, error: error.message });
      } else {
        results.success++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ 
        foodId: item.foodId || 'unknown', 
        error: err instanceof Error ? err.message : 'Erro desconhecido' 
      });
    }
  }

  // Single audit log entry for the batch operation
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'batch_update_foods',
    entity_type: 'food',
    entity_id: null,
    new_value: { 
      total: updates.length, 
      success: results.success, 
      failed: results.failed 
    },
    user_agent: headers.get('user-agent'),
  });

  logStep('Batch update completed', results);
  return results;
}

// deno-lint-ignore no-explicit-any
async function deleteFood(
  supabase: any,
  adminId: string,
  foodId: string,
  headers: Headers
) {
  if (!foodId) {
    throw new Error('ID do alimento é obrigatório');
  }

  logStep('Deleting food', { foodId });

  // Get food data for audit before deleting
  const { data: oldFood, error: fetchError } = await supabase
    .from('foods')
    .select('*')
    .eq('id', foodId)
    .single();

  if (fetchError) {
    throw new Error(`Alimento não encontrado: ${fetchError.message}`);
  }

  // Check if food is in use
  const { count: mealFoodsCount } = await supabase
    .from('meal_foods')
    .select('id', { count: 'exact', head: true })
    .eq('food_id', foodId);

  const { count: mealOptionFoodsCount } = await supabase
    .from('meal_option_foods')
    .select('id', { count: 'exact', head: true })
    .eq('food_id', foodId);

  if ((mealFoodsCount || 0) > 0 || (mealOptionFoodsCount || 0) > 0) {
    throw new Error(`Este alimento está em uso em ${(mealFoodsCount || 0) + (mealOptionFoodsCount || 0)} refeições e não pode ser excluído`);
  }

  const { error } = await supabase
    .from('foods')
    .delete()
    .eq('id', foodId);

  if (error) {
    logStep('Error deleting food', { error: error.message });
    throw new Error(`Erro ao excluir alimento: ${error.message}`);
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'delete_food',
    entity_type: 'food',
    entity_id: foodId,
    old_value: oldFood,
    user_agent: headers.get('user-agent'),
  });

  logStep('Food deleted successfully', { foodId });
  return { success: true };
}

// Normalize food names helper
function normalizeText(text: string): string {
  // Trim and remove extra spaces
  let normalized = text.trim().replace(/\s+/g, ' ');
  
  // Title case with exceptions for common prepositions/articles in Portuguese
  const lowerWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'sem', 'ao', 'à', 'a', 'o', 'para']);
  
  normalized = normalized
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Always capitalize first word
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      // Keep prepositions/articles lowercase
      if (lowerWords.has(word)) {
        return word;
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
  
  // Fix common patterns
  normalized = normalized
    // Percentages
    .replace(/(\d)\s*%/g, '$1%')
    // Units
    .replace(/(\d)\s*(g|kg|ml|l|mg)\b/gi, '$1$2')
    // Parentheses spacing
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
  
  return normalized;
}

// deno-lint-ignore no-explicit-any
async function normalizeFoodNames(
  supabase: any,
  adminId: string,
  headers: Headers
) {
  logStep('Starting food names normalization');

  // Fetch all foods
  const { data: foods, error: fetchError } = await supabase
    .from('foods')
    .select('id, name')
    .order('name');

  if (fetchError) {
    throw new Error(`Erro ao buscar alimentos: ${fetchError.message}`);
  }

  if (!foods || foods.length === 0) {
    return { updated: 0, unchanged: 0, total: 0, examples: [] };
  }

  const results = {
    updated: 0,
    unchanged: 0,
    total: foods.length,
    examples: [] as Array<{ id: string; old_name: string; new_name: string }>,
  };

  for (const food of foods) {
    const normalizedName = normalizeText(food.name);
    
    if (normalizedName !== food.name) {
      const { error: updateError } = await supabase
        .from('foods')
        .update({ name: normalizedName })
        .eq('id', food.id);

      if (!updateError) {
        results.updated++;
        // Keep first 10 examples
        if (results.examples.length < 10) {
          results.examples.push({
            id: food.id,
            old_name: food.name,
            new_name: normalizedName,
          });
        }
      }
    } else {
      results.unchanged++;
    }
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'normalize_food_names',
    entity_type: 'food',
    entity_id: null,
    new_value: { 
      total: results.total, 
      updated: results.updated, 
      unchanged: results.unchanged 
    },
    user_agent: headers.get('user-agent'),
  });

  logStep('Food names normalization completed', results);
  return results;
}

// deno-lint-ignore no-explicit-any
async function getUserUsage(supabase: any, targetUserId: string) {
  logStep('Getting user usage', { targetUserId });

  const { data: usage, error } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', targetUserId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Erro ao buscar uso: ${error.message}`);
  }

  // If no usage record exists, return default values
  if (!usage) {
    return {
      usage: {
        user_id: targetUserId,
        diets_used: 0,
        substitutions_used: 0,
        adjustments_used: 0,
        chat_messages_today: 0,
        period_start: new Date().toISOString().split('T')[0],
        period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        last_chat_reset: new Date().toISOString().split('T')[0],
      }
    };
  }

  return { usage };
}

// deno-lint-ignore no-explicit-any
async function updateUserUsage(
  supabase: any,
  adminId: string,
  targetUserId: string,
  updates: {
    diets_used?: number;
    substitutions_used?: number;
    adjustments_used?: number;
    chat_messages_today?: number;
  },
  headers: Headers
) {
  logStep('Updating user usage', { targetUserId, updates });

  // First check if usage record exists
  const { data: existingUsage } = await supabase
    .from('user_usage')
    .select('*')
    .eq('user_id', targetUserId)
    .single();

  let result;
  let oldValue = null;

  if (existingUsage) {
    oldValue = {
      diets_used: existingUsage.diets_used,
      substitutions_used: existingUsage.substitutions_used,
      adjustments_used: existingUsage.adjustments_used,
      chat_messages_today: existingUsage.chat_messages_today,
    };

    const { data, error } = await supabase
      .from('user_usage')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', targetUserId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar uso: ${error.message}`);
    }
    result = data;
  } else {
    // Create new usage record
    const { data, error } = await supabase
      .from('user_usage')
      .insert({
        user_id: targetUserId,
        diets_used: updates.diets_used ?? 0,
        substitutions_used: updates.substitutions_used ?? 0,
        adjustments_used: updates.adjustments_used ?? 0,
        chat_messages_today: updates.chat_messages_today ?? 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar registro de uso: ${error.message}`);
    }
    result = data;
  }

  // Audit log
  await supabase.from('admin_audit_log').insert({
    user_id: adminId,
    action: 'update_user_usage',
    entity_type: 'user_usage',
    entity_id: targetUserId,
    old_value: oldValue,
    new_value: updates,
    user_agent: headers.get('user-agent'),
  });

  logStep('User usage updated', { targetUserId });
  return { usage: result };
}
