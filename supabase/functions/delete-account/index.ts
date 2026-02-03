import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, CLIENT_ERRORS, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const ADMIN_EMAIL = "admin@nutriaplan.com";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Client with user's token to get their identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    // Prevent admin deletion
    if (user.email === ADMIN_EMAIL) {
      return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const userId = user.id;

    // Delete all user data in order (respecting foreign keys)
    
    // 1. Delete meal_logs via daily_logs
    const { data: dailyLogs } = await supabaseAdmin
      .from("daily_logs")
      .select("id")
      .eq("user_id", userId);
    
    if (dailyLogs && dailyLogs.length > 0) {
      const dailyLogIds = dailyLogs.map(dl => dl.id);
      await supabaseAdmin.from("meal_logs").delete().in("daily_log_id", dailyLogIds);
    }
    
    // 2. Delete daily_logs
    await supabaseAdmin.from("daily_logs").delete().eq("user_id", userId);
    
    // 3. Delete meal_option_foods via diet_plans
    const { data: dietPlans } = await supabaseAdmin
      .from("diet_plans")
      .select("id")
      .eq("user_id", userId);
    
    if (dietPlans && dietPlans.length > 0) {
      const planIds = dietPlans.map(dp => dp.id);
      
      const { data: meals } = await supabaseAdmin
        .from("meals")
        .select("id")
        .in("diet_plan_id", planIds);
      
      if (meals && meals.length > 0) {
        const mealIds = meals.map(m => m.id);
        
        const { data: mealOptions } = await supabaseAdmin
          .from("meal_options")
          .select("id")
          .in("meal_id", mealIds);
        
        if (mealOptions && mealOptions.length > 0) {
          const optionIds = mealOptions.map(mo => mo.id);
          await supabaseAdmin.from("meal_option_foods").delete().in("meal_option_id", optionIds);
        }
        
        await supabaseAdmin.from("meal_options").delete().in("meal_id", mealIds);
      }
      
      await supabaseAdmin.from("meals").delete().in("diet_plan_id", planIds);
    }
    
    // 4. Delete diet_plans
    await supabaseAdmin.from("diet_plans").delete().eq("user_id", userId);
    
    // 5. Delete professional_students (both as professional and student)
    await supabaseAdmin.from("professional_students").delete().eq("professional_id", userId);
    await supabaseAdmin.from("professional_students").delete().eq("student_id", userId);
    
    // 6. Delete subscriptions
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
    
    // 7. Delete user_usage
    await supabaseAdmin.from("user_usage").delete().eq("user_id", userId);
    
    // 8. Delete user_roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    
    // 9. Delete AI usage logs
    await supabaseAdmin.from("ai_usage_logs").delete().eq("user_id", userId);
    
    // 10. Delete profile
    await supabaseAdmin.from("profiles").delete().eq("user_id", userId);
    
    // 11. Finally, delete from auth.users
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error("Error deleting auth user:", getErrorForLogging(deleteAuthError));
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    return createSuccessResponse({ success: true, message: "Account deleted successfully" }, corsHeaders);

  } catch (error) {
    console.error("Error in delete-account:", getErrorForLogging(error));
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
