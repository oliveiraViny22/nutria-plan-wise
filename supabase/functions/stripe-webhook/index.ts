import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { CLIENT_ERRORS } from "../_shared/security.ts";
import { createLogger, getErrorDetails } from "../_shared/logger.ts";

const GRACE_PERIOD_DAYS = 7;
const log = createLogger('stripe-webhook');

// Check if event was already processed (idempotency)
// deno-lint-ignore no-explicit-any
async function isEventProcessed(supabaseAdmin: SupabaseClient<any, any, any>, eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  
  return Boolean(data);
}

// Mark event as processed
// deno-lint-ignore no-explicit-any
async function markEventProcessed(
  supabaseAdmin: SupabaseClient<any, any, any>, 
  eventId: string, 
  eventType: string,
  payload?: unknown
): Promise<void> {
  await supabaseAdmin
    .from('webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      payload: payload ? JSON.stringify(payload) : null,
      processed_at: new Date().toISOString(),
    } as Record<string, unknown>);
}

// Calculate grace period end date
function calculateGracePeriodEnd(): string {
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);
  return gracePeriodEnd.toISOString();
}

serve(async (req) => {
  try {
    log.info("Webhook received");
    
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    let event: Stripe.Event;
    
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    // SECURITY: Always require webhook signature verification
    if (!webhookSecret) {
      log.error("STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: CLIENT_ERRORS.WEBHOOK_ERROR }), 
        { status: 500 }
      );
    }

    if (!signature) {
      log.error("Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: CLIENT_ERRORS.INVALID_SIGNATURE }), 
        { status: 400 }
      );
    }

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      log.info("Signature verified successfully");
    } catch (err) {
      log.error("Webhook signature verification failed", getErrorDetails(err));
      return new Response(
        JSON.stringify({ error: CLIENT_ERRORS.INVALID_SIGNATURE }), 
        { status: 400 }
      );
    }

    // Idempotency check - skip if already processed
    if (await isEventProcessed(supabaseAdmin, event.id)) {
      log.info("Event already processed, skipping", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 });
    }

    log.info("Processing event", { type: event.type, eventId: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        log.info("Checkout completed", { sessionId: session.id });
        
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        // Always monthly - ignore any other billing_cycle in metadata
        const billingCycle = 'monthly';
        
        if (!userId || !planId) {
          log.warn("Missing metadata", { userId, planId });
          break;
        }

        const now = new Date();
        const periodEnd = new Date(now);
        // Always monthly period
        periodEnd.setMonth(now.getMonth() + 1);

        const { error: subError } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan_id: planId,
            status: 'active',
            billing_cycle: billingCycle,
            provider: 'stripe',
            provider_subscription_id: session.subscription as string,
            provider_customer_id: session.customer as string,
            current_period_start: now.toISOString().split('T')[0],
            current_period_end: periodEnd.toISOString().split('T')[0],
            grace_period_end: null,
            last_reconciled: now.toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (subError) {
          log.error("Error upserting subscription", { error: subError.message });
          throw new Error(`Subscription upsert failed: ${subError.message}`);
        } else {
          log.info("Subscription activated", { userId, planId });
        }

        await supabaseAdmin.rpc('reset_monthly_usage', { _user_id: userId });
        
        await supabaseAdmin
          .from('user_usage')
          .upsert({
            user_id: userId,
            period_start: now.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
          }, {
            onConflict: 'user_id',
          });

        log.info("Usage reset completed", { userId });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        log.info("Subscription updated", { subscriptionId: subscription.id, stripeStatus: subscription.status });
        
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if ('email' in customer && customer.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', customer.email)
            .single();

          if (profile) {
            let newStatus: string;
            let gracePeriodEnd: string | null = null;

            switch (subscription.status) {
              case 'active':
                newStatus = 'active';
                break;
              case 'past_due':
                const { data: currentSub } = await supabaseAdmin
                  .from('subscriptions')
                  .select('status, grace_period_end')
                  .eq('user_id', profile.user_id)
                  .single();

                if (currentSub?.status === 'active') {
                  // Use past_due instead of grace_period (which isn't in the enum)
                  newStatus = 'past_due';
                  gracePeriodEnd = calculateGracePeriodEnd();
                  log.info("Entering grace period", { gracePeriodEnd });
                } else if (currentSub?.status === 'past_due') {
                  if (currentSub.grace_period_end && new Date(currentSub.grace_period_end) < new Date()) {
                    newStatus = 'canceled';
                    log.info("Grace period expired, canceling");
                  } else {
                    newStatus = 'past_due';
                    gracePeriodEnd = currentSub.grace_period_end;
                  }
                } else {
                  newStatus = 'past_due';
                }
                break;
              case 'canceled':
                newStatus = 'canceled';
                break;
              case 'unpaid':
                newStatus = 'expired';
                break;
              default:
                newStatus = 'expired';
            }

            const updateData: Record<string, unknown> = {
              status: newStatus,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
              cancel_at_period_end: subscription.cancel_at_period_end,
              last_reconciled: new Date().toISOString(),
            };

            if (gracePeriodEnd) {
              updateData.grace_period_end = gracePeriodEnd;
            }

            const { error: updateError } = await supabaseAdmin
              .from('subscriptions')
              .update(updateData)
              .eq('user_id', profile.user_id);

            if (updateError) {
              log.error("Error updating subscription", { error: updateError.message });
              throw new Error(`Subscription update failed: ${updateError.message}`);
            }

            log.info("Subscription status updated", { status: newStatus });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        log.info("Subscription deleted", { subscriptionId: subscription.id });
        
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if ('email' in customer && customer.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', customer.email)
            .single();

          if (profile) {
            const { data: roles } = await supabaseAdmin
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.user_id);

            const isProfessional = roles?.some(r => r.role === 'professional');

            if (isProfessional) {
              await supabaseAdmin
                .from('subscriptions')
                .update({ 
                  status: 'suspended',
                  last_reconciled: new Date().toISOString(),
                })
                .eq('user_id', profile.user_id);
              
              log.info("Professional subscription suspended");
            } else {
              const { data: freePlan } = await supabaseAdmin
                .from('plans')
                .select('id')
                .eq('name', 'gratuito')
                .eq('type', 'personal')
                .single();

              if (freePlan) {
                await supabaseAdmin
                  .from('subscriptions')
                  .update({
                    status: 'active',
                    plan_id: freePlan.id,
                    provider: null,
                    provider_subscription_id: null,
                    stripe_price_id: null,
                    grace_period_end: null,
                    last_reconciled: new Date().toISOString(),
                  })
                  .eq('user_id', profile.user_id);
              }
              
              log.info("Downgraded to free plan");
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        log.info("Payment failed", { invoiceId: invoice.id });
        
        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if ('email' in customer && customer.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', customer.email)
            .single();

          if (profile) {
            const { data: currentSub } = await supabaseAdmin
              .from('subscriptions')
              .select('status, grace_period_end')
              .eq('user_id', profile.user_id)
              .single();

            let newStatus = 'past_due';
            let gracePeriodEnd: string | null = null;

            if (currentSub?.status === 'active') {
              // Use past_due with grace_period_end instead of non-existent grace_period status
              newStatus = 'past_due';
              gracePeriodEnd = calculateGracePeriodEnd();
              log.info("Entering grace period due to payment failure");
            } else if (currentSub?.status === 'past_due') {
              if (currentSub.grace_period_end && new Date(currentSub.grace_period_end) < new Date()) {
                newStatus = 'canceled';
                log.info("Grace period expired, canceling");
              } else {
                newStatus = 'past_due';
                gracePeriodEnd = currentSub.grace_period_end;
              }
            }

            const updateData: Record<string, unknown> = {
              status: newStatus,
              last_reconciled: new Date().toISOString(),
            };

            if (gracePeriodEnd) {
              updateData.grace_period_end = gracePeriodEnd;
            }

            const { error: updateError } = await supabaseAdmin
              .from('subscriptions')
              .update(updateData)
              .eq('user_id', profile.user_id);

            if (updateError) {
              log.error("Error updating subscription", { error: updateError.message });
              throw new Error(`Subscription update failed: ${updateError.message}`);
            }

            log.info("Subscription status updated", { status: newStatus });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        log.info("Payment succeeded", { invoiceId: invoice.id });
        
        const customerId = invoice.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if ('email' in customer && customer.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', customer.email)
            .single();

          if (profile) {
            await supabaseAdmin
              .from('subscriptions')
              .update({ 
                status: 'active',
                grace_period_end: null,
                last_reconciled: new Date().toISOString(),
              })
              .eq('user_id', profile.user_id);

            log.info("Subscription reactivated after successful payment");
          }
        }
        break;
      }
    }

    // Mark event as processed after successful handling
    await markEventProcessed(supabaseAdmin, event.id, event.type, { processed: true });
    log.info("Event processed and marked", { eventId: event.id });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    log.error("Webhook processing failed", getErrorDetails(error));
    // Return 500 to trigger Stripe retry
    return new Response(
      JSON.stringify({ error: CLIENT_ERRORS.SERVER_ERROR }), 
      { status: 500 }
    );
  }
});
