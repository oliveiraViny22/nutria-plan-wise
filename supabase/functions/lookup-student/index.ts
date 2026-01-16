import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

/**
 * Secure edge function for professionals to look up students by email.
 * This runs server-side with service role, bypassing RLS for the lookup,
 * but enforces proper authorization checks.
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LOOKUP-STUDENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");
    
    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    if (!validate.isObject(body)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    const { email } = body as { email: unknown };
    
    // Validate email format
    if (!validate.isEmail(email)) {
      logStep("Invalid email format");
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!validate.maxLength(normalizedEmail, 255)) {
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    logStep("Request validated", { email: normalizedEmail });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { persistSession: false } 
    });
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Auth failed", { error: userError?.message });
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }

    const professionalId = userData.user.id;
    logStep("User authenticated", { professionalId });

    // AUTHORIZATION: Verify the caller is a professional with active license
    const { data: hasRole } = await supabaseAdmin.rpc('has_role', {
      _user_id: professionalId,
      _role: 'professional'
    });
    
    if (!hasRole) {
      logStep("User is not a professional");
      return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
    }
    
    const { data: hasLicense } = await supabaseAdmin.rpc('has_active_license', {
      _user_id: professionalId
    });
    
    if (!hasLicense) {
      logStep("Professional has no active license");
      return createErrorResponse(CLIENT_ERRORS.FORBIDDEN, 403, corsHeaders);
    }
    
    // Check if professional has capacity (student limit)
    const { data: license } = await supabaseAdmin
      .from('professional_licenses')
      .select('max_students')
      .eq('user_id', professionalId)
      .single();
    
    const { data: currentCount } = await supabaseAdmin.rpc('get_student_count', {
      _professional_id: professionalId
    });
    
    if (license && currentCount !== null && currentCount >= license.max_students) {
      logStep("Student limit reached", { current: currentCount, max: license.max_students });
      return createErrorResponse(
        'Limite de alunos atingido',
        403,
        corsHeaders,
        { limitReached: true }
      );
    }

    // Use service role to lookup student by email (bypasses RLS intentionally)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', normalizedEmail)
      .single();

    if (profileError || !profile) {
      logStep("Student not found", { email: normalizedEmail });
      return createErrorResponse(
        'Aluno não encontrado. O usuário precisa se cadastrar primeiro.',
        404,
        corsHeaders
      );
    }

    // Check if already linked to this professional
    const { data: existingLink } = await supabaseAdmin
      .from('professional_students')
      .select('id, status')
      .eq('professional_id', professionalId)
      .eq('student_id', profile.user_id)
      .single();

    if (existingLink) {
      logStep("Student already linked", { status: existingLink.status });
      return createErrorResponse(
        'Este aluno já está na sua lista.',
        409,
        corsHeaders,
        { alreadyLinked: true }
      );
    }

    logStep("Student found and available", { studentId: profile.user_id });

    // Return only the student's user_id - the client will use this to create the link
    return createSuccessResponse({
      student_id: profile.user_id,
      can_add: true,
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
