// Delete account edge function - v4 (improved error handling)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const ADMIN_EMAIL = "admin@nutriaplan.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface DeletionLog {
  step: string;
  success: boolean;
  error?: string;
  rowsAffected?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const deletionLogs: DeletionLog[] = [];

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Autenticação necessária" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ error: "Falha na autenticação" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent admin deletion
    if (user.email === ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const userId = user.id;

    console.log(`Starting account deletion for user: ${userId} (${user.email})`);

    // Helper function to safely delete and log
    async function safeDelete(
      step: string,
      deleteOperation: () => PromiseLike<{ error: unknown; count?: number | null }>
    ): Promise<void> {
      try {
        const { error, count } = await deleteOperation();
        if (error) {
          deletionLogs.push({ step, success: false, error: String(error) });
          console.error(`Error in ${step}:`, error);
        } else {
          deletionLogs.push({ step, success: true, rowsAffected: count ?? undefined });
          console.log(`${step}: success`);
        }
      } catch (err) {
        deletionLogs.push({ step, success: false, error: String(err) });
        console.error(`Exception in ${step}:`, err);
      }
    }

    // Delete all user data in order (respecting foreign keys)
    
    // 1. Get daily_log IDs and delete meal_logs
    const { data: dailyLogs } = await supabaseAdmin
      .from("daily_logs")
      .select("id")
      .eq("user_id", userId);
    
    if (dailyLogs && dailyLogs.length > 0) {
      const dailyLogIds = dailyLogs.map(dl => dl.id);
      await safeDelete("meal_logs", () => 
        supabaseAdmin.from("meal_logs").delete().in("daily_log_id", dailyLogIds)
      );
    }
    
    // 2. Delete daily_logs
    await safeDelete("daily_logs", () => 
      supabaseAdmin.from("daily_logs").delete().eq("user_id", userId)
    );
    
    // 3. Get diet plan hierarchy and delete
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
          await safeDelete("meal_option_foods", () => 
            supabaseAdmin.from("meal_option_foods").delete().in("meal_option_id", optionIds)
          );
        }
        
        await safeDelete("meal_options", () => 
          supabaseAdmin.from("meal_options").delete().in("meal_id", mealIds)
        );
      }
      
      await safeDelete("meals", () => 
        supabaseAdmin.from("meals").delete().in("diet_plan_id", planIds)
      );
    }
    
    // 4. Delete diet_plans
    await safeDelete("diet_plans", () => 
      supabaseAdmin.from("diet_plans").delete().eq("user_id", userId)
    );
    
    // 5. Delete professional_students (both as professional and student)
    await safeDelete("professional_students_as_professional", () => 
      supabaseAdmin.from("professional_students").delete().eq("professional_id", userId)
    );
    await safeDelete("professional_students_as_student", () => 
      supabaseAdmin.from("professional_students").delete().eq("student_id", userId)
    );
    
    // 6. Delete subscriptions
    await safeDelete("subscriptions", () => 
      supabaseAdmin.from("subscriptions").delete().eq("user_id", userId)
    );
    
    // 7. Delete user_usage
    await safeDelete("user_usage", () => 
      supabaseAdmin.from("user_usage").delete().eq("user_id", userId)
    );
    
    // 8. Delete user_roles
    await safeDelete("user_roles", () => 
      supabaseAdmin.from("user_roles").delete().eq("user_id", userId)
    );
    
    // 9. Delete AI usage logs
    await safeDelete("ai_usage_logs", () => 
      supabaseAdmin.from("ai_usage_logs").delete().eq("user_id", userId)
    );
    
    // 10. Delete objective change requests (both as student and professional)
    await safeDelete("objective_change_requests_as_student", () => 
      supabaseAdmin.from("objective_change_requests").delete().eq("student_id", userId)
    );
    await safeDelete("objective_change_requests_as_professional", () => 
      supabaseAdmin.from("objective_change_requests").delete().eq("professional_id", userId)
    );
    
    // 11. Delete conversion events
    await safeDelete("conversion_events", () => 
      supabaseAdmin.from("conversion_events").delete().eq("user_id", userId)
    );
    
    // 12. Delete weight_logs
    await safeDelete("weight_logs", () => 
      supabaseAdmin.from("weight_logs").delete().eq("user_id", userId)
    );
    
    // 13. Delete body_measurements
    await safeDelete("body_measurements", () => 
      supabaseAdmin.from("body_measurements").delete().eq("user_id", userId)
    );
    
    // 12. Delete profile (CRITICAL - must succeed before auth deletion)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("user_id", userId);
    
    if (profileError) {
      deletionLogs.push({ step: "profiles", success: false, error: String(profileError) });
      console.error("Error deleting profile:", profileError);
      // Continue anyway - try to delete auth user
    } else {
      deletionLogs.push({ step: "profiles", success: true });
      console.log("profiles: success");
    }
    
    // 13. Finally, delete from auth.users (MOST CRITICAL)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      deletionLogs.push({ step: "auth.users", success: false, error: deleteAuthError.message });
      console.error("CRITICAL: Error deleting auth user:", deleteAuthError.message);
      console.log("Deletion logs:", JSON.stringify(deletionLogs, null, 2));
      
      return new Response(
        JSON.stringify({ 
          error: "Erro ao excluir conta. Por favor, entre em contato com o suporte.",
          details: deletionLogs.filter(l => !l.success)
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    deletionLogs.push({ step: "auth.users", success: true });
    console.log(`Account deletion completed successfully for user: ${userId}`);
    console.log("Deletion logs:", JSON.stringify(deletionLogs, null, 2));

    return new Response(
      JSON.stringify({ success: true, message: "Account deleted successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in delete-account:", error instanceof Error ? error.message : String(error));
    console.log("Deletion logs at error:", JSON.stringify(deletionLogs, null, 2));
    
    return new Response(
      JSON.stringify({ error: "Ocorreu um erro ao processar sua requisição" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
