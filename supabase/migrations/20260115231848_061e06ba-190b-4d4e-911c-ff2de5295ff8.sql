-- Function to create subscription and usage for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  free_plan_id UUID := '48b13c53-3703-422b-9324-8ffd41946120';
BEGIN
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
$$;

-- Trigger to auto-create subscription on user signup
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();