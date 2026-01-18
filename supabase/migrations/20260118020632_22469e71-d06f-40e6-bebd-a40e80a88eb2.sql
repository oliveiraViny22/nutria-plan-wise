-- Add grace_period_end column to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP WITH TIME ZONE;

-- Add last_reconciled column for tracking
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS last_reconciled TIMESTAMP WITH TIME ZONE;

-- Create index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_reconcile 
ON public.subscriptions(status, last_reconciled);

-- Function to check if professional subscription allows student access
CREATE OR REPLACE FUNCTION public.get_professional_subscription_state(_professional_id uuid)
RETURNS TABLE(
  sub_status text,
  is_active boolean,
  is_grace_period boolean,
  is_suspended boolean,
  grace_end timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.status::text,
    s.status::text IN ('active', 'trial'),
    s.status::text = 'grace_period',
    s.status::text IN ('suspended', 'canceled', 'expired'),
    s.grace_period_end
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = _professional_id
    AND p.type = 'professional'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to check student access based on professional's subscription
CREATE OR REPLACE FUNCTION public.get_student_access_level(_student_id uuid)
RETURNS TABLE(
  has_access boolean,
  access_level text,
  can_view_plan boolean,
  can_view_history boolean,
  can_use_chat boolean,
  can_generate boolean,
  can_substitute boolean,
  professional_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professional_id uuid;
  v_prof_status text;
  v_is_active boolean;
  v_is_grace boolean;
  v_is_suspended boolean;
BEGIN
  -- Get professional ID from profile
  SELECT professional_id INTO v_professional_id
  FROM profiles
  WHERE user_id = _student_id;
  
  -- If not linked to professional, full access based on own subscription
  IF v_professional_id IS NULL THEN
    RETURN QUERY SELECT 
      true,
      'full'::text,
      true,
      true,
      true,
      true,
      true,
      NULL::text;
    RETURN;
  END IF;
  
  -- Get professional subscription state
  SELECT sub_status, is_active, is_grace_period, is_suspended
  INTO v_prof_status, v_is_active, v_is_grace, v_is_suspended
  FROM get_professional_subscription_state(v_professional_id);
  
  -- If no subscription found, treat as suspended
  IF v_prof_status IS NULL THEN
    v_is_suspended := true;
    v_prof_status := 'suspended';
  END IF;
  
  -- Return access based on professional status
  IF v_is_active THEN
    RETURN QUERY SELECT 
      true,
      'full'::text,
      true,
      true,
      true,
      true,
      true,
      v_prof_status;
  ELSIF v_is_grace THEN
    RETURN QUERY SELECT 
      true,
      'read_only'::text,
      true,
      true,
      false,
      false,
      false,
      v_prof_status;
  ELSE
    RETURN QUERY SELECT 
      false,
      'suspended'::text,
      false,
      false,
      false,
      false,
      false,
      v_prof_status;
  END IF;
END;
$$;

-- Update can_use_feature to check student access
CREATE OR REPLACE FUNCTION public.can_use_feature(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan RECORD;
  v_usage RECORD;
  v_is_admin BOOLEAN;
  v_student_access RECORD;
  v_is_linked_student BOOLEAN;
BEGIN
  -- Check if user is admin - admins have unlimited access
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

  -- Check if user is a linked student
  SELECT professional_id IS NOT NULL INTO v_is_linked_student
  FROM profiles WHERE user_id = _user_id;
  
  -- If linked student, check professional's subscription state
  IF v_is_linked_student THEN
    SELECT * INTO v_student_access FROM get_student_access_level(_user_id);
    
    -- No access if suspended
    IF NOT v_student_access.has_access THEN
      RETURN FALSE;
    END IF;
    
    -- Read-only during grace period
    IF v_student_access.access_level = 'read_only' THEN
      IF _feature IN ('chat', 'diet', 'substitution', 'adjustment') THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  -- Get user's plan
  SELECT * INTO v_plan FROM public.get_user_plan(_user_id);
  
  IF v_plan IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get user's usage
  SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
  
  IF v_usage IS NULL THEN
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