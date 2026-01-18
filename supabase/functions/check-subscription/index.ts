import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.90.1";
import { getCorsHeaders, CLIENT_ERRORS, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";
import { createLogger, getErrorDetails } from "../_shared/logger.ts";

const log = createLogger('check-subscription');

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log.info("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      log.error("Missing required env", {
        hasUrl: Boolean(supabaseUrl),
        hasAnon: Boolean(supabaseAnonKey),
        hasServiceRole: Boolean(supabaseServiceRoleKey),
      });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // Pricing page is public; treat unauthenticated requests as “not subscribed”
      return createSuccessResponse(
        {
          subscribed: false,
          plan: null,
          usage: null,
          accountType: "personal",
          unauthenticated: true,
        },
        corsHeaders
      );
    }

    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return createSuccessResponse(
        {
          subscribed: false,
          plan: null,
          usage: null,
          accountType: "personal",
          unauthenticated: true,
        },
        corsHeaders
      );
    }

    // Auth client bound to this request's JWT (signing-keys compatible)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Validate JWT using signing keys compatible method
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    // Fallback for older GoTrue behavior / edge-runtime quirks
    const userId =
      !claimsError && claimsData?.claims?.sub
        ? claimsData.claims.sub
        : (await supabaseAuth.auth.getUser()).data.user?.id;

    if (!userId) {
      logStep("Auth failed", {
        claimsError: claimsError?.message,
      });
      // Same as above: return a safe “not subscribed” response instead of 401
      return createSuccessResponse(
        {
          subscribed: false,
          plan: null,
          usage: null,
          accountType: "personal",
          unauthenticated: true,
        },
        corsHeaders
      );
    }

    const user = { id: userId };
    logStep("User authenticated", { userId: user.id });

    // Check if user is linked to a professional (student)
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('professional_id')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const isLinkedToProfessional = Boolean(profileData?.professional_id);
    log.info("Checked professional link", { isLinkedToProfessional });

    // Get student access level if linked to professional
    let studentAccess = null;
    if (isLinkedToProfessional) {
      const { data: accessData } = await supabaseAdmin
        .rpc('get_student_access_level', { _student_id: user.id });
      
      if (accessData && accessData.length > 0) {
        studentAccess = {
          hasAccess: accessData[0].has_access,
          accessLevel: accessData[0].access_level,
          canViewPlan: accessData[0].can_view_plan,
          canViewHistory: accessData[0].can_view_history,
          canUseChat: accessData[0].can_use_chat,
          canGenerate: accessData[0].can_generate,
          canSubstitute: accessData[0].can_substitute,
          professionalStatus: accessData[0].professional_status,
        };
        log.info("Student access level", studentAccess);
      }
    }

    // Get user's subscription with plan details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'trial', 'past_due', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      log.info("No active subscription found");
      
      // Check if user has roles to determine account type
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isProfessional = (roles ?? []).some((r: { role: string }) => r.role === 'professional');
      
      return createSuccessResponse({
        subscribed: false,
        plan: null,
        usage: null,
        accountType: isProfessional ? 'professional' : 'personal',
        isLinkedToProfessional,
        studentAccess,
      }, corsHeaders);
    }

    log.info("Subscription found", { 
      planName: subscription.plan?.name, 
      status: subscription.status 
    });

    const planType = subscription.plan?.type || 'personal';
    const isSubscribed = subscription.status === 'active' || subscription.status === 'trial';
    const shouldSyncProfessional =
      planType === 'professional' && ['active', 'trial', 'past_due'].includes(subscription.status);

    // Keep entitlements (role + license) in sync for professional accounts
    if (shouldSyncProfessional) {
      try {
        // Ensure professional role exists
        const { error: roleUpsertError } = await supabaseAdmin
          .from('user_roles')
          .upsert({ user_id: user.id, role: 'professional' }, { onConflict: 'user_id,role' });

        if (roleUpsertError) {
          log.warn('Failed to upsert professional role', { error: roleUpsertError.message });
        } else {
          log.info('Professional role ensured');
        }

        // Ensure professional license exists/updated - always monthly
        const licenseType = 'monthly';
        const startsAt = subscription.current_period_start || new Date().toISOString().split('T')[0];
        const expiresAt = subscription.current_period_end || new Date().toISOString().split('T')[0];
        const maxStudents = subscription.plan?.patients_limit ?? 0;

        const { data: existingLicense, error: existingLicenseError } = await supabaseAdmin
          .from('professional_licenses')
          .select('id')
          .eq('user_id', user.id)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingLicenseError) {
          log.warn('Failed to check existing license', { error: existingLicenseError.message });
        }

        if (existingLicense?.id) {
          const { error: licenseUpdateError } = await supabaseAdmin
            .from('professional_licenses')
            .update({
              license_type: licenseType,
              starts_at: startsAt,
              expires_at: expiresAt,
              max_students: maxStudents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingLicense.id);

          if (licenseUpdateError) {
            log.warn('Failed to update license', { error: licenseUpdateError.message });
          } else {
            log.info('Professional license updated', { expiresAt, maxStudents });
          }
        } else {
          const { error: licenseInsertError } = await supabaseAdmin
            .from('professional_licenses')
            .insert({
              user_id: user.id,
              license_type: licenseType,
              starts_at: startsAt,
              expires_at: expiresAt,
              max_students: maxStudents,
              updated_at: new Date().toISOString(),
            });

          if (licenseInsertError) {
            log.warn('Failed to insert license', { error: licenseInsertError.message });
          } else {
            log.info('Professional license created', { expiresAt, maxStudents });
          }
        }
      } catch (syncError) {
        log.error('Entitlement sync error', getErrorDetails(syncError));
      }
    }

    // Get usage data
    const { data: usage } = await supabaseAdmin
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Reset chat if new day
    if (usage && new Date(usage.last_chat_reset) < new Date(new Date().toDateString())) {
      await supabaseAdmin
        .from('user_usage')
        .update({
          chat_messages_today: 0,
          last_chat_reset: new Date().toISOString().split('T')[0],
        })
        .eq('user_id', user.id);
    }

    return createSuccessResponse({
      subscribed: isSubscribed,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billingCycle: subscription.billing_cycle,
        periodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        gracePeriodEnd: subscription.grace_period_end,
      },
      plan: subscription.plan,
      usage: usage || {
        diets_used: 0,
        substitutions_used: 0,
        adjustments_used: 0,
        chat_messages_today: 0,
      },
      accountType: planType,
      isLinkedToProfessional,
      studentAccess,
    }, corsHeaders);
  } catch (error) {
    log.error("Unexpected error", getErrorDetails(error));
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
