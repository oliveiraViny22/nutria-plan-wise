import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, validate, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const VALID_BILLING_CYCLES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
const VALID_PLAN_TYPES = ['personal', 'professional'] as const;

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
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
    
    const { planId, billingCycle, billing_cycle, plan_type } = body as { 
      planId: unknown; 
      billingCycle: unknown;
      billing_cycle: unknown;
      plan_type: unknown;
    };
    
    // Support both camelCase and snake_case for billing cycle
    const effectiveBillingCycle = billingCycle || billing_cycle;
    
    // Validate billingCycle is a valid enum
    if (!validate.isEnum(effectiveBillingCycle, [...VALID_BILLING_CYCLES])) {
      logStep("Invalid billingCycle", { billingCycle: effectiveBillingCycle });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    // Either planId (UUID) or plan_type must be provided
    const hasPlanId = validate.isUUID(planId);
    const hasPlanType = validate.isEnum(plan_type, [...VALID_PLAN_TYPES]);
    
    if (!hasPlanId && !hasPlanType) {
      logStep("Invalid planId or plan_type", { planId, plan_type });
      return createErrorResponse(CLIENT_ERRORS.INVALID_REQUEST, 400, corsHeaders);
    }
    
    logStep("Request validated", { planId, plan_type, billingCycle: effectiveBillingCycle });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse(CLIENT_ERRORS.AUTH_REQUIRED, 401, corsHeaders);
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      logStep("Auth failed", { error: userError?.message });
      return createErrorResponse(CLIENT_ERRORS.AUTH_FAILED, 401, corsHeaders);
    }
    
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch plan from Supabase
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch plan by ID or by type
    let planQuery = supabaseAdmin.from('plans').select('*');
    
    if (hasPlanId) {
      planQuery = planQuery.eq('id', planId);
    } else {
      // Look up by plan type - get the first active plan of this type
      planQuery = planQuery.eq('type', plan_type).eq('is_active', true);
    }
    
    const { data: planData, error: planError } = await planQuery.limit(1).single();

    if (planError || !planData) {
      logStep("Plan not found", { planId, plan_type, error: planError?.message });
      return createErrorResponse(CLIENT_ERRORS.NOT_FOUND, 404, corsHeaders);
    }
    
    const plan = planData;
    const resolvedPlanId = plan.id;
    logStep("Plan fetched", { planName: plan.name, planType: plan.type, planId: resolvedPlanId });

    // Get price based on billing cycle from database
    const priceColumnMap: Record<string, string> = {
      monthly: 'stripe_price_monthly',
      quarterly: 'stripe_price_quarterly',
      semiannual: 'stripe_price_semiannual',
      annual: 'stripe_price_annual',
    };
    
    const priceColumn = priceColumnMap[effectiveBillingCycle];
    const stripePriceId = plan[priceColumn] as string | null;
    
    if (!stripePriceId) {
      logStep("No Stripe price configured", { planName: plan.name, billingCycle: effectiveBillingCycle });
      return createErrorResponse(CLIENT_ERRORS.NOT_FOUND, 404, corsHeaders);
    }
    logStep("Price ID determined from database", { stripePriceId, billingCycle: effectiveBillingCycle });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://lovable.app";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      metadata: {
        user_id: user.id,
        plan_id: resolvedPlanId,
        billing_cycle: effectiveBillingCycle,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return createSuccessResponse({ url: session.url }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
