import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { docType } = await req.json();
    
    let settingKey: string;
    let filename: string;
    let fallbackTitle: string;

    if (docType === 'technical') {
      settingKey = 'documentation_technical';
      filename = 'DOCUMENTACAO_TECNICA_NUTRIAPLAN.txt';
      fallbackTitle = 'DOCUMENTAÇÃO TÉCNICA - NUTRIAPLAN';
    } else if (docType === 'commercial') {
      settingKey = 'documentation_commercial';
      filename = 'DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.txt';
      fallbackTitle = 'DOCUMENTAÇÃO COMERCIAL - NUTRIAPLAN';
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid docType. Use "technical" or "commercial"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch documentation content from system_settings
    const { data: setting, error: settingError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', settingKey)
      .single();

    let content: string;

    if (settingError || !setting) {
      console.log(`[generate-documentation-pdf] No setting found for ${settingKey}, using fallback`);
      content = `${fallbackTitle}\n\nDocumentação não configurada.\n\nPor favor, configure a documentação nas configurações do sistema (key: ${settingKey}).\n\nGerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`;
    } else {
      // The value is stored as JSON, extract the string content
      const rawValue = setting.value;
      if (typeof rawValue === 'string') {
        content = rawValue;
      } else if (rawValue && typeof rawValue === 'object' && 'content' in rawValue) {
        content = (rawValue as { content: string }).content;
      } else {
        content = JSON.stringify(rawValue, null, 2);
      }
      
      // Add generation timestamp header
      const header = `================================================================================\n${fallbackTitle}\nGerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}\n================================================================================\n\n`;
      content = header + content;
    }

    console.log(`[generate-documentation-pdf] Generated ${docType} TXT for admin ${user.email}`);

    return new Response(content, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('[generate-documentation-pdf] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
