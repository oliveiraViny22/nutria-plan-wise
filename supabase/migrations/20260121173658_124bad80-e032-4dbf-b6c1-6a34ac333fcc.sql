-- Drop and recreate get_user_plan function to include meal_options_limit
DROP FUNCTION IF EXISTS public.get_user_plan(uuid);

CREATE FUNCTION public.get_user_plan(_user_id uuid)
RETURNS TABLE(
  plan_id uuid,
  plan_name text,
  plan_type plan_type,
  subscription_status subscription_status,
  diet_limit integer,
  substitution_limit integer,
  adjustment_limit integer,
  chat_messages_per_day integer,
  has_chat boolean,
  meal_options_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.name as plan_name,
    p.type as plan_type,
    COALESCE(s.status, 'trial'::subscription_status) as subscription_status,
    p.diet_limit,
    p.substitution_limit,
    p.adjustment_limit,
    p.chat_messages_per_day,
    p.has_chat,
    p.meal_options_limit
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no subscription found, return free plan defaults
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.id as plan_id,
      p.name as plan_name,
      p.type as plan_type,
      'trial'::subscription_status as subscription_status,
      p.diet_limit,
      p.substitution_limit,
      p.adjustment_limit,
      p.chat_messages_per_day,
      p.has_chat,
      p.meal_options_limit
    FROM plans p
    WHERE p.name = 'gratuito'
      AND p.is_active = true
    LIMIT 1;
  END IF;
END;
$$;