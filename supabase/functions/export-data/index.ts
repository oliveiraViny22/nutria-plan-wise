import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonToCsv(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

const ADMIN_EMAILS = ["admin@nutriaplan.com", "admin@nutriaplan.com.br"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Não autorizado");

    // Check admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    const isAdmin = (roles && roles.length > 0) || ADMIN_EMAILS.includes(user.email || "");
    if (!isAdmin) throw new Error("Acesso negado");

    const { entity } = await req.json();

    let csvData = "";
    let filename = "";

    switch (entity) {
      case "profiles": {
        const { data } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false });
        csvData = jsonToCsv(data || []);
        filename = "usuarios.csv";
        break;
      }
      case "foods": {
        const { data } = await supabaseAdmin.from("foods").select("*").order("name");
        csvData = jsonToCsv(data || []);
        filename = "alimentos.csv";
        break;
      }
      case "diet_plans": {
        const { data } = await supabaseAdmin.from("diet_plans").select("*").order("created_at", { ascending: false });
        csvData = jsonToCsv(data || []);
        filename = "planos_alimentares.csv";
        break;
      }
      case "subscriptions": {
        const { data } = await supabaseAdmin.from("subscriptions").select("*, plans(name, type)").order("created_at", { ascending: false });
        csvData = jsonToCsv(data || []);
        filename = "assinaturas.csv";
        break;
      }
      case "audit_logs": {
        const { data } = await supabaseAdmin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(5000);
        csvData = jsonToCsv(data || []);
        filename = "logs_auditoria.csv";
        break;
      }
      case "ai_usage": {
        const { data } = await supabaseAdmin.from("ai_usage_logs").select("*").order("created_at", { ascending: false }).limit(5000);
        csvData = jsonToCsv(data || []);
        filename = "logs_ia.csv";
        break;
      }
      case "weight_logs": {
        const { data } = await supabaseAdmin.from("weight_logs").select("*").order("created_at", { ascending: false });
        csvData = jsonToCsv(data || []);
        filename = "registros_peso.csv";
        break;
      }
      case "user_usage": {
        const { data } = await supabaseAdmin.from("user_usage").select("*").order("updated_at", { ascending: false });
        csvData = jsonToCsv(data || []);
        filename = "uso_usuarios.csv";
        break;
      }
      case "plans": {
        const { data } = await supabaseAdmin.from("plans").select("*");
        csvData = jsonToCsv(data || []);
        filename = "planos.csv";
        break;
      }
      case "system_settings": {
        const { data } = await supabaseAdmin.from("system_settings").select("*");
        csvData = jsonToCsv(data || []);
        filename = "configuracoes.csv";
        break;
      }
      case "professional_students": {
        const { data } = await supabaseAdmin.from("professional_students").select("*").order("created_at", { ascending: false });
        csvData = jsonToCsv(data || []);
        filename = "profissionais_alunos.csv";
        break;
      }
      case "all": {
        // Export all tables into a single JSON with table names as keys
        const tables = [
          "profiles", "foods", "diet_plans", "subscriptions", "admin_audit_log",
          "ai_usage_logs", "weight_logs", "user_usage", "plans", "system_settings",
          "professional_students",
        ];
        const allData: Record<string, unknown[]> = {};
        for (const table of tables) {
          const { data } = await supabaseAdmin.from(table).select("*").limit(10000);
          allData[table] = data || [];
        }
        return new Response(JSON.stringify({ tables: allData, filename: "export_completo.json" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default:
        throw new Error(`Entidade desconhecida: ${entity}`);
    }

    return new Response(JSON.stringify({ csv: csvData, filename }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
