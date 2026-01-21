import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "admin@nutriaplan.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is an admin
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: adminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!adminRole) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all profiles user_ids
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, email");

    const profileUserIds = new Set(profiles?.map(p => p.user_id) || []);

    // Get all auth users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      throw authError;
    }

    const authUsers = authData.users || [];
    const deletedUsers: string[] = [];
    const skippedUsers: string[] = [];

    for (const authUser of authUsers) {
      // Skip admin
      if (authUser.email === ADMIN_EMAIL) {
        skippedUsers.push(`${authUser.email} (admin protected)`);
        continue;
      }

      // Check if auth user has a corresponding profile
      if (!profileUserIds.has(authUser.id)) {
        // Orphan auth user - delete it
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        
        if (deleteError) {
          console.error(`Failed to delete orphan user ${authUser.email}:`, deleteError);
          skippedUsers.push(`${authUser.email} (delete failed)`);
        } else {
          deletedUsers.push(authUser.email || authUser.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: deletedUsers,
        skipped: skippedUsers,
        message: `Cleaned up ${deletedUsers.length} orphan auth users`
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in cleanup-orphan-users:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
