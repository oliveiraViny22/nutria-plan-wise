import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, validate, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";
import { createLogger, getErrorDetails } from "../_shared/logger.ts";

const log = createLogger('validate-email');

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info("Email validation request started");
    
    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      log.warn("Invalid JSON body");
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!validate.isObject(body)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const { email } = body as { email: unknown };
    
    if (!validate.isEmail(email)) {
      log.warn("Invalid email format", { email: typeof email });
      return createErrorResponse('Formato de email inválido', 400, corsHeaders);
    }
    
    const normalizedEmail = (email as string).toLowerCase().trim();
    log.info("Validating email", { email: normalizedEmail });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check profiles table
    const { data: existingProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (profileError) {
      log.error("Error checking profile", getErrorDetails(profileError));
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    if (existingProfile) {
      log.info("Email already exists in profiles", { email: normalizedEmail });
      return createSuccessResponse({
        exists: true,
        available: false,
        message: 'Este email já está cadastrado no sistema.',
      }, corsHeaders);
    }

    log.info("Email is available", { email: normalizedEmail });
    return createSuccessResponse({
      exists: false,
      available: true,
    }, corsHeaders);
    
  } catch (error) {
    log.error("Unexpected error", getErrorDetails(error));
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
