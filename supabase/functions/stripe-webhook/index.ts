import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { CLIENT_ERRORS } from "../_shared/security.ts";
import { createLogger, getErrorDetails } from "../_shared/logger.ts";

const GRACE_PERIOD_DAYS = 7;
const log = createLogger('stripe-webhook');

// ─── Helpers ────────────────────────────────────────────────────────

type Admin = SupabaseClient<Record<string, unknown>, string, Record<string, unknown>>;

async function isEventProcessed(db: Admin, eventId: string): Promise<boolean> {
  const { data } = await db
    .from('webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  return Boolean(data);
}

async function markEventProcessed(db: Admin, eventId: string, eventType: string): Promise<void> {
  await db.from('webhook_events').insert({
    event_id: eventId,
    event_type: eventType,
    processed_at: new Date().toISOString(),
  } as Record<string, unknown>);
}

function gracePeriodEnd(): string {
  const d = new Date();
  d.setDate(d.getDate() + GRACE_PERIOD_DAYS);
  return d.toISOString();
}

async function findUserByEmail(db: Admin, email: string) {
  const { data } = await db.from('profiles').select('user_id').eq('email', email).single();
  return data?.user_id as string | null;
}

async function updateSubscription(db: Admin, userId: string, fields: Record<string, unknown>) {
  const { error } = await db
    .from('subscriptions')
    .update({ ...fields, last_reconciled: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(`Subscription update failed: ${error.message}`);
}

// ─── Event handlers ─────────────────────────────────────────────────

async function handleCheckoutCompleted(db: Admin, session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;

  if (!userId || !planId) {
    log.warn("Missing metadata", { userId, planId });
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(now.getMonth() + 1);

  const { error } = await db.from('subscriptions').upsert({
    user_id: userId,
    plan_id: planId,
    status: 'active',
    stripe_subscription_id: session.subscription as string,
    stripe_customer_id: session.customer as string,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    grace_period_end: null,
    last_reconciled: now.toISOString(),
  }, { onConflict: 'user_id' });

  if (error) throw new Error(`Subscription upsert failed: ${error.message}`);
  log.info("Subscription activated", { userId, planId });

  await db.rpc('reset_monthly_usage', { _user_id: userId });

  await db.from('user_usage').upsert({
    user_id: userId,
    period_start: now.toISOString().split('T')[0],
    period_end: periodEnd.toISOString().split('T')[0],
  }, { onConflict: 'user_id' });

  log.info("Usage reset completed", { userId });
}

async function handleSubscriptionUpdated(db: Admin, stripe: Stripe, subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (!('email' in customer) || !customer.email) return;

  const userId = await findUserByEmail(db, customer.email);
  if (!userId) return;

  let newStatus: string;
  let gpEnd: string | null = null;

  switch (subscription.status) {
    case 'active':
      newStatus = 'active';
      break;
    case 'past_due': {
      const { data: cur } = await db
        .from('subscriptions')
        .select('status, grace_period_end')
        .eq('user_id', userId)
        .single();

      if (cur?.status === 'active') {
        newStatus = 'past_due';
        gpEnd = gracePeriodEnd();
      } else if (cur?.status === 'past_due' && cur.grace_period_end && new Date(cur.grace_period_end) < new Date()) {
        newStatus = 'canceled';
      } else {
        newStatus = 'past_due';
        gpEnd = cur?.grace_period_end ?? null;
      }
      break;
    }
    case 'canceled':
      newStatus = 'canceled';
      break;
    default:
      newStatus = 'expired';
  }

  const fields: Record<string, unknown> = {
    status: newStatus,
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
  if (gpEnd) fields.grace_period_end = gpEnd;

  await updateSubscription(db, userId, fields);
  log.info("Subscription status updated", { userId, status: newStatus });
}

async function handleSubscriptionDeleted(db: Admin, stripe: Stripe, subscription: Stripe.Subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer as string);
  if (!('email' in customer) || !customer.email) return;

  const userId = await findUserByEmail(db, customer.email);
  if (!userId) return;

  // Check if professional — professionals get canceled, regular users downgrade to free
  const { data: roles } = await db.from('user_roles').select('role').eq('user_id', userId);
  const isProfessional = roles?.some(r => r.role === 'professional');

  if (isProfessional) {
    await updateSubscription(db, userId, { status: 'canceled' });
    log.info("Professional subscription canceled");
  } else {
    const { data: freePlan } = await db
      .from('plans')
      .select('id')
      .eq('type', 'gratuito')
      .eq('is_active', true)
      .single();

    if (freePlan) {
      await updateSubscription(db, userId, {
        status: 'active',
        plan_id: freePlan.id,
        stripe_subscription_id: null,
        stripe_customer_id: null,
        grace_period_end: null,
      });
    }
    log.info("Downgraded to free plan");
  }
}

async function handlePaymentFailed(db: Admin, stripe: Stripe, invoice: Stripe.Invoice) {
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  if (!('email' in customer) || !customer.email) return;

  const userId = await findUserByEmail(db, customer.email);
  if (!userId) return;

  const { data: cur } = await db
    .from('subscriptions')
    .select('status, grace_period_end')
    .eq('user_id', userId)
    .single();

  let newStatus = 'past_due';
  let gpEnd: string | null = null;

  if (cur?.status === 'active') {
    gpEnd = gracePeriodEnd();
  } else if (cur?.status === 'past_due' && cur.grace_period_end && new Date(cur.grace_period_end) < new Date()) {
    newStatus = 'canceled';
  } else {
    gpEnd = cur?.grace_period_end ?? null;
  }

  const fields: Record<string, unknown> = { status: newStatus };
  if (gpEnd) fields.grace_period_end = gpEnd;

  await updateSubscription(db, userId, fields);
  log.info("Payment failure handled", { userId, status: newStatus });
}

async function handlePaymentSucceeded(db: Admin, stripe: Stripe, invoice: Stripe.Invoice) {
  const customer = await stripe.customers.retrieve(invoice.customer as string);
  if (!('email' in customer) || !customer.email) return;

  const userId = await findUserByEmail(db, customer.email);
  if (!userId) return;

  await updateSubscription(db, userId, { status: 'active', grace_period_end: null });
  log.info("Subscription reactivated", { userId });
}

// ─── Main ───────────────────────────────────────────────────────────

serve(async (req) => {
  try {
    log.info("Webhook received");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      log.error("STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: CLIENT_ERRORS.WEBHOOK_ERROR }), { status: 500 });
    }

    if (!signature) {
      log.error("Missing stripe-signature header");
      return new Response(JSON.stringify({ error: CLIENT_ERRORS.INVALID_SIGNATURE }), { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      log.error("Signature verification failed", getErrorDetails(err));
      return new Response(JSON.stringify({ error: CLIENT_ERRORS.INVALID_SIGNATURE }), { status: 400 });
    }

    // Idempotency
    if (await isEventProcessed(db, event.id)) {
      log.info("Event already processed", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, skipped: true }), { status: 200 });
    }

    log.info("Processing event", { type: event.type, eventId: event.id });

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(db, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(db, stripe, event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(db, stripe, event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(db, stripe, event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(db, stripe, event.data.object as Stripe.Invoice);
        break;
    }

    await markEventProcessed(db, event.id, event.type);
    log.info("Event processed", { eventId: event.id });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    log.error("Webhook processing failed", getErrorDetails(error));
    return new Response(JSON.stringify({ error: CLIENT_ERRORS.SERVER_ERROR }), { status: 500 });
  }
});
