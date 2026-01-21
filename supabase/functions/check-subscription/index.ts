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

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    const userId =
      !claimsError && claimsData?.claims?.sub
        ? claimsData.claims.sub
        : (await supabaseAuth.auth.getUser()).data.user?.id;

    if (!userId) {
      log.warn("Auth failed", { claimsError: claimsError?.message });
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
    log.info("User authenticated", { userId: user.id });

    // V2: profiles table no longer has professional_id
    // Check if user has professional role instead
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isProfessional = (roles ?? []).some((r: { role: string }) => r.role === 'professional');
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === 'admin');

    log.info("Checked user roles", { isProfessional, isAdmin });

    // V2: Fetch subscription with plan details
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
      log.info("No active subscription found");
      
      return createSuccessResponse({
        subscribed: false,
        plan: null,
        usage: null,
        accountType: isProfessional ? 'professional' : 'personal',
        isLinkedToProfessional: false, // V2: no more linked students in core
        studentAccess: null,
      }, corsHeaders);
    }

    log.info("Subscription found", { 
      planName: subscription.plan?.name, 
      status: subscription.status 
    });

    const planType = subscription.plan?.type || 'gratuito';
    const isSubscribed = subscription.status === 'active' || subscription.status === 'trial';

    // V2: Get or create usage record
    let { data: usage } = await supabaseAdmin
      .from('user_usage')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Reset chat messages if new day
    if (usage && new Date(usage.last_chat_reset) < new Date(new Date().toDateString())) {
      await supabaseAdmin
        .from('user_usage')
        .update({
          chat_messages_today: 0,
          last_chat_reset: new Date().toISOString().split('T')[0],
        })
        .eq('user_id', user.id);
      
      usage = { ...usage, chat_messages_today: 0 };
    }

    return createSuccessResponse({
      subscribed: isSubscribed,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        periodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      plan: subscription.plan,
      usage: usage ? {
        diets_used: usage.diets_used || 0,
        substitutions_used: usage.substitutions_used || 0,
        adjustments_used: usage.adjustments_used || 0,
        chat_messages_today: usage.chat_messages_today || 0,
        meal_options_override: usage.meal_options_override,
      } : {
        diets_used: 0,
        substitutions_used: 0,
        adjustments_used: 0,
        chat_messages_today: 0,
        meal_options_override: null,
      },
      accountType: planType,
      isLinkedToProfessional: false, // V2: professional features dormant
      studentAccess: null, // V2: professional features dormant
    }, corsHeaders);
  } catch (error) {
    log.error("Unexpected error", getErrorDetails(error));
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
