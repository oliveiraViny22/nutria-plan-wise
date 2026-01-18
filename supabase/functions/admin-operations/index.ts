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
