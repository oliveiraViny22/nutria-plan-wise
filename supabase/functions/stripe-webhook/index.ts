import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");
    
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
    
    // SECURITY: Always require webhook signature verification in production
    if (!webhookSecret) {
      logStep("ERROR: STRIPE_WEBHOOK_SECRET is not configured");
      return new Response(
        JSON.stringify({ error: "Webhook configuration error" }), 
        { status: 500 }
      );
    }

    if (!signature) {
      logStep("ERROR: Missing stripe-signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature" }), 
        { status: 400 }
      );
    }

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Signature verified successfully");
    } catch (err) {
      const errInfo = err instanceof Error
        ? { name: err.name, message: err.message }
        : { message: String(err) };

      logStep("Webhook signature verification failed", errInfo);
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Event type", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { sessionId: session.id });
        
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id;
        const billingCycle = session.metadata?.billing_cycle as 'monthly' | 'quarterly' | 'semiannual' | 'annual';
        
        if (!userId || !planId) {
          logStep("Missing metadata", { userId, planId });
          break;
        }

        // Calculate period end based on billing cycle
        const now = new Date();
        let periodEnd = new Date(now);
        switch (billingCycle) {
          case 'quarterly':
            periodEnd.setMonth(now.getMonth() + 3);
            break;
          case 'semiannual':
            periodEnd.setMonth(now.getMonth() + 6);
            break;
          case 'annual':
            periodEnd.setFullYear(now.getFullYear() + 1);
            break;
          default:
            periodEnd.setMonth(now.getMonth() + 1);
        }

        // Upsert subscription
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
          }, {
            onConflict: 'user_id',
          });

        if (subError) {
          logStep("Error upserting subscription", { error: subError });
        } else {
          logStep("Subscription activated", { userId, planId });
        }

        // Reset user usage for new period
        await supabaseAdmin.rpc('reset_monthly_usage', { _user_id: userId });
        
        // Initialize usage if doesn't exist
        await supabaseAdmin
          .from('user_usage')
          .upsert({
            user_id: userId,
            period_start: now.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
          }, {
            onConflict: 'user_id',
          });

        logStep("Usage reset", { userId });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { subscriptionId: subscription.id });
        
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if ('email' in customer && customer.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', customer.email)
            .single();

          if (profile) {
            const status = subscription.status === 'active' ? 'active' : 
                          subscription.status === 'past_due' ? 'past_due' :
                          subscription.status === 'canceled' ? 'canceled' : 'expired';

            await supabaseAdmin
              .from('subscriptions')
              .update({
                status,
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
                cancel_at_period_end: subscription.cancel_at_period_end,
              })
              .eq('user_id', profile.user_id);

            logStep("Subscription status updated", { userId: profile.user_id, status });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });
        
        const customerId = subscription.customer as string;
        const customer = await stripe.customers.retrieve(customerId);
        
        if ('email' in customer && customer.email) {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('email', customer.email)
            .single();

          if (profile) {
            // Get account type
            const { data: roles } = await supabaseAdmin
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.user_id);

            const isProfessional = roles?.some(r => r.role === 'professional');

            if (isProfessional) {
              // Professional loses access completely
              await supabaseAdmin
                .from('subscriptions')
                .update({ status: 'expired' })
                .eq('user_id', profile.user_id);
            } else {
              // Personal gets downgraded to free
              const { data: freePlan } = await supabaseAdmin
                .from('plans')
                .select('id')
                .eq('name', 'free')
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
                  })
                  .eq('user_id', profile.user_id);
              }
            }
            
            logStep("Subscription canceled handled", { userId: profile.user_id, isProfessional });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { invoiceId: invoice.id });
        
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
              .update({ status: 'past_due' })
              .eq('user_id', profile.user_id);

            logStep("Subscription marked as past_due", { userId: profile.user_id });
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});
