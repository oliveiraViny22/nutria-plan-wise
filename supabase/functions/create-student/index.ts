import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

/**
 * Secure edge function for professionals to create new student accounts.
 * Creates the auth user, profile, and links them to the professional.
 */

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STUDENT] ${step}${detailsStr}`);
};

interface StudentData {
  // Access credentials
  email: string;
  password: string;
  name: string;
  
  // Physical data
  age: number;
  sex: 'male' | 'female' | 'other';
  height: number;
  weight: number;
  
  // Activity and goals
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose_weight' | 'maintain' | 'gain_muscle';
  meals_per_day: number;
  
  // Nutritional data
  preferences: string[];
  restrictions: string[];
  
  // Optional health conditions
  health_conditions?: string;
}

// Activity level multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Calorie adjustments for goals
const GOAL_ADJUSTMENTS: Record<string, number> = {
  lose_weight: -500,
  maintain: 0,
  gain_muscle: 300,
};

function calculateTargets(data: StudentData) {
  const { age, sex, height, weight, activity_level, goal } = data;
  
  // Mifflin-St Jeor Equation
  const bmr = sex === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  const activityMultiplier = ACTIVITY_MULTIPLIERS[activity_level] || 1.55;
  const tdee = bmr * activityMultiplier;
  
  const calorieAdjustment = GOAL_ADJUSTMENTS[goal] || 0;
  const calories = Math.round(tdee + calorieAdjustment);

  // Macro distribution based on goal
  let proteinRatio = 0.3;
  let carbsRatio = 0.4;
  let fatRatio = 0.3;

  if (goal === 'gain_muscle') {
    proteinRatio = 0.35;
    carbsRatio = 0.45;
    fatRatio = 0.2;
  } else if (goal === 'lose_weight') {
    proteinRatio = 0.35;
    carbsRatio = 0.35;
    fatRatio = 0.3;
  }

  return {
    calories,
    protein: Math.round((calories * proteinRatio) / 4),
    carbs: Math.round((calories * carbsRatio) / 4),
    fat: Math.round((calories * fatRatio) / 9),
  };
}

function validateStudentData(data: unknown): data is StudentData {
  if (!validate.isObject(data)) return false;
  
  const d = data as Record<string, unknown>;
  
  // Required string fields
  if (!validate.isEmail(d.email)) return false;
  if (!validate.isNonEmptyString(d.password) || !validate.maxLength(d.password as string, 128)) return false;
  if (!validate.isNonEmptyString(d.name) || !validate.maxLength(d.name as string, 100)) return false;
  
  // Numeric fields
  if (!validate.isNumber(d.age) || !validate.isInRange(d.age as number, 10, 120)) return false;
  if (!validate.isNumber(d.height) || !validate.isInRange(d.height as number, 100, 250)) return false;
  if (!validate.isNumber(d.weight) || !validate.isInRange(d.weight as number, 20, 400)) return false;
  if (!validate.isNumber(d.meals_per_day) || !validate.isInRange(d.meals_per_day as number, 2, 6)) return false;
  
  // Enum fields
  if (!validate.isEnum(d.sex, ['male', 'female', 'other'])) return false;
  if (!validate.isEnum(d.activity_level, ['sedentary', 'light', 'moderate', 'active', 'very_active'])) return false;
  if (!validate.isEnum(d.goal, ['lose_weight', 'maintain', 'gain_muscle'])) return false;
  
  // Arrays
  if (!validate.isArray(d.preferences)) return false;
  if (!validate.isArray(d.restrictions)) return false;
  
  return true;
}

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
    
    if (!validateStudentData(body)) {
      logStep("Invalid student data");
      return createErrorResponse("Dados do aluno inválidos ou incompletos", 400, corsHeaders);
    }
    
    const studentData = body as StudentData;
    const normalizedEmail = studentData.email.toLowerCase().trim();
    
    logStep("Request validated", { email: normalizedEmail, name: studentData.name });

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
    
    // Check student limit
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

    // Check if email already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .eq('email', normalizedEmail)
      .single();

    if (existingProfile) {
      logStep("Email already exists", { email: normalizedEmail });
      return createErrorResponse(
        'Este email já está cadastrado no sistema.',
        409,
        corsHeaders,
        { emailExists: true }
      );
    }

    // Create auth user
    logStep("Creating auth user");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: studentData.password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: studentData.name,
        created_by_professional: professionalId,
      },
    });

    if (authError || !authData.user) {
      logStep("Failed to create auth user", { error: authError?.message });
      return createErrorResponse(
        'Erro ao criar usuário. Verifique se a senha atende aos requisitos.',
        400,
        corsHeaders
      );
    }

    const studentUserId = authData.user.id;
    logStep("Auth user created", { studentUserId });

    // Calculate nutritional targets
    const targets = calculateTargets(studentData);
    logStep("Calculated targets", targets);

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update the profile with all data
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name: studentData.name,
        email: normalizedEmail,
        age: studentData.age,
        sex: studentData.sex,
        height: studentData.height,
        weight: studentData.weight,
        activity_level: studentData.activity_level,
        goal: studentData.goal,
        meals_per_day: studentData.meals_per_day,
        preferences: studentData.preferences,
        restrictions: studentData.restrictions,
        daily_calories: targets.calories,
        protein_target: targets.protein,
        carbs_target: targets.carbs,
        fat_target: targets.fat,
        professional_id: professionalId,
        onboarding_completed: true, // Mark as completed since professional filled all data
      })
      .eq('user_id', studentUserId);

    if (profileError) {
      logStep("Failed to update profile", { error: profileError.message });
      // Try to clean up the auth user
      await supabaseAdmin.auth.admin.deleteUser(studentUserId);
      return createErrorResponse(
        'Erro ao criar perfil do aluno.',
        500,
        corsHeaders
      );
    }

    // Add student role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: studentUserId,
        role: 'student',
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      logStep("Warning: Failed to add student role", { error: roleError.message });
    }

    // Link student to professional
    const { error: linkError } = await supabaseAdmin
      .from('professional_students')
      .insert({
        professional_id: professionalId,
        student_id: studentUserId,
        status: 'active',
      });

    if (linkError) {
      logStep("Failed to link student", { error: linkError.message });
      // Try to clean up
      await supabaseAdmin.auth.admin.deleteUser(studentUserId);
      return createErrorResponse(
        'Erro ao vincular aluno.',
        500,
        corsHeaders
      );
    }

    // Log initial weight
    await supabaseAdmin.from('weight_logs').insert({
      user_id: studentUserId,
      weight: studentData.weight,
      logged_at: new Date().toISOString().split('T')[0],
      notes: 'Peso inicial do cadastro pelo profissional',
    });

    logStep("Student created successfully", { studentUserId });

    return createSuccessResponse({
      student_id: studentUserId,
      email: normalizedEmail,
      name: studentData.name,
      targets,
      message: 'Aluno cadastrado com sucesso!',
    }, corsHeaders);
    
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
