import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders, CLIENT_ERRORS, getErrorForLogging, createErrorResponse, createSuccessResponse } from "../_shared/security.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECONCILE-SUBSCRIPTIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Reconciliation started");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get all subscriptions that need reconciliation
    // Either never reconciled or not reconciled in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .not('stripe_subscription_id', 'is', null)
      .or(`last_reconciled.is.null,last_reconciled.lt.${oneHourAgo}`)
      .limit(50);

    if (subError) {
      logStep("Error fetching subscriptions", { error: subError.message });
      return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
    }

    logStep("Found subscriptions to reconcile", { count: subscriptions?.length || 0 });

    const results = {
      processed: 0,
      updated: 0,
      errors: 0,
      graceExpired: 0,
      suspended: 0,
    };

    for (const sub of subscriptions || []) {
      try {
        results.processed++;

        // Check grace period expiration first
        if (sub.status === 'past_due' && sub.grace_period_end) {
          if (new Date(sub.grace_period_end) < new Date()) {
            // Grace period expired - cancel
            await supabaseAdmin
              .from('subscriptions')
              .update({
                status: 'canceled',
                last_reconciled: new Date().toISOString(),
              })
              .eq('id', sub.id);

            results.graceExpired++;
            results.suspended++;
            logStep("Grace period expired, canceled", { userId: sub.user_id });
            continue;
          }
        }

        // Fetch current status from Stripe
        if (!sub.stripe_subscription_id) {
          continue;
        }

        let stripeSubscription: Stripe.Subscription;
        try {
          stripeSubscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        } catch (stripeError) {
          logStep("Could not fetch from Stripe", { 
            subscriptionId: sub.stripe_subscription_id,
            error: getErrorForLogging(stripeError),
          });
          
          // Mark as canceled if Stripe subscription doesn't exist
          if ((stripeError as { statusCode?: number }).statusCode === 404) {
            await supabaseAdmin
              .from('subscriptions')
              .update({
                status: 'canceled',
                last_reconciled: new Date().toISOString(),
              })
              .eq('id', sub.id);
            results.suspended++;
          }
          continue;
        }

        // Determine correct status based on Stripe
        let correctStatus: string;
        switch (stripeSubscription.status) {
          case 'active':
            correctStatus = 'active';
            break;
          case 'past_due':
            correctStatus = 'past_due';
            break;
          case 'canceled':
          case 'incomplete_expired':
          case 'unpaid':
            correctStatus = 'canceled';
            break;
          case 'trialing':
            correctStatus = 'trial';
            break;
          default:
            correctStatus = sub.status;
        }

        // Update if status differs or needs refresh
        const needsUpdate = 
          sub.status !== correctStatus ||
          sub.current_period_end !== new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0] ||
          sub.cancel_at_period_end !== stripeSubscription.cancel_at_period_end;

        if (needsUpdate) {
          const updateData: Record<string, unknown> = {
            status: correctStatus,
            current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0],
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
            last_reconciled: new Date().toISOString(),
          };

          // Set grace period if entering past_due
          if (correctStatus === 'past_due' && !sub.grace_period_end) {
            const gracePeriodEnd = new Date();
            gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
            updateData.grace_period_end = gracePeriodEnd.toISOString();
          }

          // Clear grace period if back to active
          if (correctStatus === 'active') {
            updateData.grace_period_end = null;
          }

          await supabaseAdmin
            .from('subscriptions')
            .update(updateData)
            .eq('id', sub.id);

          results.updated++;
          logStep("Subscription updated", { 
            userId: sub.user_id, 
            oldStatus: sub.status, 
            newStatus: correctStatus,
          });

          if (correctStatus === 'canceled') {
            results.suspended++;
          }
        } else {
          // Just update last_reconciled
          await supabaseAdmin
            .from('subscriptions')
            .update({ last_reconciled: new Date().toISOString() })
            .eq('id', sub.id);
        }
      } catch (error) {
        results.errors++;
        logStep("Error processing subscription", { 
          subscriptionId: sub.id, 
          error: getErrorForLogging(error),
        });
      }
    }

    logStep("Reconciliation completed", results);

    return createSuccessResponse({
      success: true,
      results,
    }, corsHeaders);
  } catch (error) {
    logStep("ERROR", { message: getErrorForLogging(error) });
    return createErrorResponse(CLIENT_ERRORS.SERVER_ERROR, 500, corsHeaders);
  }
});
