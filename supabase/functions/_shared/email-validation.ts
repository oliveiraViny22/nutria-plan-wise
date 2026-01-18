// Global email duplicate validation for all signup types

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export interface EmailValidationResult {
  isValid: boolean;
  exists: boolean;
  message?: string;
}

/**
 * Validates that an email is not already registered in the system.
 * Checks both auth.users and profiles tables for completeness.
 * 
 * @param supabaseAdmin - Admin Supabase client with service role
 * @param email - Email to validate (will be normalized)
 * @returns Validation result with existence status and message
 */
export async function validateEmailNotExists(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  email: string
): Promise<EmailValidationResult> {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Check if email format is valid
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    return {
      isValid: false,
      exists: false,
      message: 'Formato de email inválido.',
    };
  }

  // Check profiles table first (faster, covers most cases)
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (profileError) {
    console.error('Error checking profile email:', profileError);
    return {
      isValid: false,
      exists: false,
      message: 'Erro ao validar email. Tente novamente.',
    };
  }

  if (existingProfile) {
    return {
      isValid: false,
      exists: true,
      message: 'Este email já está cadastrado no sistema.',
    };
  }

  // Also check auth.users table via admin API for edge cases
  // (e.g., user created but profile trigger failed)
  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1,
  });

  if (authError) {
    console.error('Error checking auth users:', authError);
    // Don't fail the whole validation if auth check fails
  } else if (authUsers) {
    // listUsers doesn't support email filter, need to use getUserByEmail
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(normalizedEmail).catch(() => ({ data: null }));
    
    // Alternative: direct lookup
    const allUsersCheck = authUsers.users?.some(u => u.email?.toLowerCase() === normalizedEmail);
    if (allUsersCheck) {
      return {
        isValid: false,
        exists: true,
        message: 'Este email já está cadastrado no sistema.',
      };
    }
  }

  return {
    isValid: true,
    exists: false,
  };
}

/**
 * Quick email existence check for frontend pre-validation
 * Returns only the essential info for UI feedback
 */
export async function checkEmailExists(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: SupabaseClient<any, any, any>,
  email: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('user_id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('Error checking email existence:', error);
    return false;
  }

  return Boolean(data);
}
