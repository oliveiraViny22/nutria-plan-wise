import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

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

    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    // Get user's subscription with plan details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'trial', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !subscription) {
      logStep("No active subscription found");
      
      // Check if user has roles to determine account type
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isProfessional = roles?.some(r => r.role === 'professional');
      
      return createSuccessResponse({
        subscribed: false,
        plan: null,
        usage: null,
        accountType: isProfessional ? 'professional' : 'personal',
      }, corsHeaders);
    }

    logStep("Subscription found", { 
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
          logStep('Failed to upsert professional role', { error: roleUpsertError.message });
        } else {
          logStep('Professional role ensured');
        }

        // Ensure professional license exists/updated
        const licenseType = subscription.billing_cycle === 'annual' ? 'annual' : 'monthly';
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
          logStep('Failed to check existing license', { error: existingLicenseError.message });
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
            logStep('Failed to update license', { error: licenseUpdateError.message });
          } else {
            logStep('Professional license updated', { expiresAt, maxStudents });
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
            logStep('Failed to insert license', { error: licenseInsertError.message });
          } else {
            logStep('Professional license created', { expiresAt, maxStudents });
          }
        }
      } catch (syncError) {
        logStep('Entitlement sync error', { message: getErrorForLogging(syncError) });
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
      },
      plan: subscription.plan,
      usage: usage || {
        diets_used: 0,
        substitutions_used: 0,
        adjustments_used: 0,
        chat_messages_today: 0,
      },
      accountType: planType,
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
