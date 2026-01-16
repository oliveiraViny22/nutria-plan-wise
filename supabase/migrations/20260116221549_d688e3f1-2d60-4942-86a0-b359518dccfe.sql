-- Fix the trigger that creates subscription for new users
-- The old plan_id was hardcoded incorrectly

CREATE OR REPLACE FUNCTION public.create_subscription_for_user()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get the actual 'gratuito' plan id dynamically
  SELECT id INTO free_plan_id FROM public.plans WHERE name = 'gratuito' LIMIT 1;
  
  -- If no gratuito plan found, skip subscription creation
  IF free_plan_id IS NULL THEN
    RAISE WARNING 'No gratuito plan found, skipping subscription creation';
    RETURN NEW;
  END IF;

  -- Create trial subscription for new user
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    billing_cycle,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    free_plan_id,
    'trial',
    'monthly',
    now(),
    now() + INTERVAL '30 days'
  );
  
  -- Create usage tracking record
  INSERT INTO public.user_usage (
    user_id,
    diets_used,
    substitutions_used,
    adjustments_used,
    chat_messages_today,
    period_start,
    period_end,
    last_chat_reset
  ) VALUES (
    NEW.id,
    0,
    0,
    0,
    0,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 month',
    CURRENT_DATE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;