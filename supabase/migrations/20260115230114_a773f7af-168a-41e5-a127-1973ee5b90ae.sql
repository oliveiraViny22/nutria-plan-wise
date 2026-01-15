-- Create enum for plan types
CREATE TYPE public.plan_type AS ENUM ('personal', 'professional');

-- Create enum for subscription status
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');

-- Create enum for billing cycle
CREATE TYPE public.billing_cycle AS ENUM ('monthly', 'quarterly', 'semiannual', 'annual');

-- Create plans table
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type plan_type NOT NULL,
  diet_limit INTEGER NOT NULL DEFAULT 0,
  substitution_limit INTEGER NOT NULL DEFAULT 0,
  adjustment_limit INTEGER NOT NULL DEFAULT 0,
  chat_messages_per_day INTEGER NOT NULL DEFAULT 0,
  patients_limit INTEGER NOT NULL DEFAULT 0,
  has_chat BOOLEAN NOT NULL DEFAULT false,
  history_days INTEGER NOT NULL DEFAULT 7,
  price_monthly NUMERIC(10,2) DEFAULT 0,
  price_quarterly NUMERIC(10,2) DEFAULT 0,
  price_semiannual NUMERIC(10,2) DEFAULT 0,
  price_annual NUMERIC(10,2) DEFAULT 0,
  stripe_price_monthly TEXT,
  stripe_price_quarterly TEXT,
  stripe_price_semiannual TEXT,
  stripe_price_annual TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans"
ON public.plans FOR SELECT
USING (is_active = true);

-- Populate personal plans
INSERT INTO public.plans (name, type, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, patients_limit, has_chat, history_days, price_monthly, price_quarterly, price_semiannual, price_annual) VALUES
('free', 'personal', 1, 3, 0, 0, 0, false, 7, 0, 0, 0, 0),
('basic', 'personal', 4, 30, 1, 0, 0, false, 90, 19.90, 49.90, 89.90, 149.90),
('pro', 'personal', 12, 120, 4, 20, 0, true, 9999, 39.90, 99.90, 179.90, 299.90);

-- Populate professional plans
INSERT INTO public.plans (name, type, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, patients_limit, has_chat, history_days, price_monthly, price_quarterly, price_semiannual, price_annual) VALUES
('basic', 'professional', 30, 150, 15, 0, 15, false, 180, 99.90, 269.90, 479.90, 899.90),
('pro', 'professional', 120, 600, 60, 50, 60, true, 9999, 199.90, 539.90, 959.90, 1799.90);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  status subscription_status NOT NULL DEFAULT 'trial',
  billing_cycle billing_cycle,
  provider TEXT,
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  current_period_start DATE,
  current_period_end DATE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view their own subscription"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own subscription (for cancel)
CREATE POLICY "Users can update their own subscription"
ON public.subscriptions FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can manage all subscriptions
CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions FOR ALL
USING (true)
WITH CHECK (true);

-- Create user_usage table
CREATE TABLE public.user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,
  period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
  diets_used INTEGER NOT NULL DEFAULT 0,
  substitutions_used INTEGER NOT NULL DEFAULT 0,
  adjustments_used INTEGER NOT NULL DEFAULT 0,
  chat_messages_today INTEGER NOT NULL DEFAULT 0,
  last_chat_reset DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_usage
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON public.user_usage FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own usage
CREATE POLICY "Users can update their own usage"
ON public.user_usage FOR UPDATE
USING (auth.uid() = user_id);

-- Service role can manage all usage
CREATE POLICY "Service role can manage usage"
ON public.user_usage FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX idx_plans_type ON public.plans(type);

-- Function to get user's current plan with limits
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id UUID)
RETURNS TABLE (
  plan_id UUID,
  plan_name TEXT,
  plan_type plan_type,
  subscription_status subscription_status,
  diet_limit INTEGER,
  substitution_limit INTEGER,
  adjustment_limit INTEGER,
  chat_messages_per_day INTEGER,
  patients_limit INTEGER,
  has_chat BOOLEAN,
  history_days INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.name,
    p.type,
    COALESCE(s.status, 'active'::subscription_status),
    p.diet_limit,
    p.substitution_limit,
    p.adjustment_limit,
    p.chat_messages_per_day,
    p.patients_limit,
    p.has_chat,
    p.history_days
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1
$$;

-- Function to check if user can perform action
CREATE OR REPLACE FUNCTION public.can_use_feature(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_usage RECORD;
BEGIN
  -- Get user's plan
  SELECT * INTO v_plan FROM public.get_user_plan(_user_id);
  
  IF v_plan IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's usage
  SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
  
  IF v_usage IS NULL THEN
    -- Create usage record if doesn't exist
    INSERT INTO public.user_usage (user_id) VALUES (_user_id);
    SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
  END IF;
  
  -- Check feature limits
  CASE _feature
    WHEN 'diet' THEN
      RETURN v_usage.diets_used < v_plan.diet_limit;
    WHEN 'substitution' THEN
      RETURN v_usage.substitutions_used < v_plan.substitution_limit;
    WHEN 'adjustment' THEN
      RETURN v_usage.adjustments_used < v_plan.adjustment_limit;
    WHEN 'chat' THEN
      IF NOT v_plan.has_chat THEN
        RETURN FALSE;
      END IF;
      -- Reset chat count if new day
      IF v_usage.last_chat_reset < CURRENT_DATE THEN
        UPDATE public.user_usage 
        SET chat_messages_today = 0, last_chat_reset = CURRENT_DATE
        WHERE user_id = _user_id;
        RETURN TRUE;
      END IF;
      RETURN v_usage.chat_messages_today < v_plan.chat_messages_per_day;
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure usage record exists
  INSERT INTO public.user_usage (user_id)
  VALUES (_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Increment the appropriate counter
  CASE _feature
    WHEN 'diet' THEN
      UPDATE public.user_usage SET diets_used = diets_used + 1, updated_at = now() WHERE user_id = _user_id;
    WHEN 'substitution' THEN
      UPDATE public.user_usage SET substitutions_used = substitutions_used + 1, updated_at = now() WHERE user_id = _user_id;
    WHEN 'adjustment' THEN
      UPDATE public.user_usage SET adjustments_used = adjustments_used + 1, updated_at = now() WHERE user_id = _user_id;
    WHEN 'chat' THEN
      -- Reset if new day
      UPDATE public.user_usage 
      SET chat_messages_today = CASE 
        WHEN last_chat_reset < CURRENT_DATE THEN 1 
        ELSE chat_messages_today + 1 
      END,
      last_chat_reset = CURRENT_DATE,
      updated_at = now()
      WHERE user_id = _user_id;
    ELSE
      RETURN FALSE;
  END CASE;
  
  RETURN TRUE;
END;
$$;

-- Function to reset monthly usage
CREATE OR REPLACE FUNCTION public.reset_monthly_usage(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_usage
  SET 
    diets_used = 0,
    substitutions_used = 0,
    adjustments_used = 0,
    period_start = CURRENT_DATE,
    period_end = CURRENT_DATE + INTERVAL '1 month',
    updated_at = now()
  WHERE user_id = _user_id;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_usage_updated_at
BEFORE UPDATE ON public.user_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();