-- Remove remaining overly permissive policies with USING(true)

-- adherence_alerts - already has proper policies, just remove service role
DROP POLICY IF EXISTS "Service role can manage alerts" ON public.adherence_alerts;

-- adherence_metrics - same
DROP POLICY IF EXISTS "Service can manage adherence metrics" ON public.adherence_metrics;

-- diet_plans - remove service role policy
DROP POLICY IF EXISTS "Service role can manage diet plans" ON public.diet_plans;

-- meals - remove service role policy  
DROP POLICY IF EXISTS "Service role can manage meals" ON public.meals;

-- meal_foods - remove service role policy
DROP POLICY IF EXISTS "Service role can manage meal_foods" ON public.meal_foods;

-- subscriptions - this one is needed for webhooks, but we'll keep it since webhook uses service_role
-- user_usage - this one is needed for edge functions

-- Note: subscriptions and user_usage policies with USING(true) are intentional 
-- because they're managed by edge functions with service_role key