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

// Valid food categories and processing levels
const VALID_CATEGORIES = [
  'frutas', 'hortaliças_folhosas', 'legumes', 'cereais_tubérculos',
  'leguminosas', 'proteínas_animais', 'laticínios', 'óleos_oleaginosas', 'suplementos'
];

const VALID_PROCESSING_LEVELS = [
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

      case 'delete_user':
        result = await deleteUser(supabaseAdmin, userId, params.targetUserId, req.headers);
        break;

      case 'get_plans':
        result = await getPlans(supabaseAdmin);
        break;

      case 'update_plan':
        result = await updatePlan(supabaseAdmin, userId, params.planId, params.updates, req.headers);
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
    const message = error instanceof Error ? error.message : String(error);
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

function validateFoodCSV(rows: Record<string, unknown>[]): { valid: boolean; errors: string[]; validRows: FoodRow[] } {
  const errors: string[] = [];
  const validRows: FoodRow[] = [];

  const requiredColumns = ['name', 'calories', 'protein', 'carbs', 'fat'];
  
  if (!rows || rows.length === 0) {
    return { valid: false, errors: ['Arquivo vazio ou inválido'], validRows: [] };
  }

  // Check if first row has required columns
  const firstRow = rows[0];
  const missingColumns = requiredColumns.filter(col => !(col in firstRow));
  
  if (missingColumns.length > 0) {
    return { 
      valid: false, 
      errors: [`Colunas obrigatórias ausentes: ${missingColumns.join(', ')}`], 
      validRows: [] 
    };
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2; // +2 because of header row and 0-indexing
    const rowErrors: string[] = [];

    // Validate name
    if (!row.name || String(row.name).trim() === '') {
      rowErrors.push(`Linha ${rowNum}: nome é obrigatório`);
    }

    // Validate numeric fields
    const numericFields = ['calories', 'protein', 'carbs', 'fat'];
    numericFields.forEach(field => {
      const value = Number(row[field]);
      if (isNaN(value) || value < 0) {
        rowErrors.push(`Linha ${rowNum}: ${field} deve ser um número >= 0`);
      }
    });

    // Validate category if provided
    if (row.category && !VALID_CATEGORIES.includes(String(row.category))) {
      rowErrors.push(`Linha ${rowNum}: categoria inválida "${row.category}"`);
    }

    // Validate processing_level if provided
    if (row.processing_level && !VALID_PROCESSING_LEVELS.includes(String(row.processing_level))) {
      rowErrors.push(`Linha ${rowNum}: nível de processamento inválido "${row.processing_level}"`);
    }

    if (rowErrors.length === 0) {
      validRows.push({
        name: String(row.name).trim(),
        calories: Number(row.calories),
        protein: Number(row.protein),
        carbs: Number(row.carbs),
        fat: Number(row.fat),
        serving_size: row.serving_size ? String(row.serving_size) : '100g',
        category: row.category ? String(row.category) : null,
        processing_level: row.processing_level ? String(row.processing_level) : 'in_natura',
      } as FoodRow);
    } else {
      errors.push(...rowErrors);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, 20), // Limit errors shown
    validRows
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
