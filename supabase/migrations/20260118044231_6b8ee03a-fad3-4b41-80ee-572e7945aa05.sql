-- Fix get_user_permissions to remove permissive fallbacks and reflect real limits
-- Also update get_student_access_level to properly check grace period via past_due + grace_period_end

CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id uuid)
RETURNS TABLE(
  user_type user_type, 
  plan_name text, 
  can_create_plan boolean, 
  can_edit_plan boolean, 
  can_view_plan boolean, 
  can_substitute boolean, 
  can_adjust boolean, 
  can_use_ai boolean, 
  can_use_simulations boolean, 
  can_manage_students boolean, 
  can_send_requests boolean, 
  is_linked_to_professional boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type user_type;
  v_plan_name TEXT;
  v_is_linked BOOLEAN;
  v_has_active_sub BOOLEAN;
  v_has_chat BOOLEAN;
BEGIN
  -- Get user type and professional link
  SELECT 
    COALESCE(p.user_type, 'usuario'),
    p.professional_id IS NOT NULL
  INTO v_user_type, v_is_linked
  FROM profiles p
  WHERE p.user_id = _user_id;

  -- Get active plan details
  SELECT pl.name, pl.has_chat INTO v_plan_name, v_has_chat
  FROM subscriptions s
  JOIN plans pl ON s.plan_id = pl.id
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- No fallback to 'gratuito' - if no subscription, return restricted permissions
  IF v_plan_name IS NULL THEN
    v_plan_name := 'sem_plano';
    v_has_chat := false;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(v_user_type, 'usuario'::user_type),
    v_plan_name,
    -- can_create_plan: only paid plans and not linked students
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_edit_plan: same as create
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_view_plan: only if has any valid subscription
    v_plan_name != 'sem_plano',
    -- can_substitute: paid plans only
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_adjust: paid plans only
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_use_ai: based on has_chat flag from plan
    v_has_chat,
    -- can_use_simulations: premium and professional only
    v_plan_name IN ('premium', 'profissional'),
    -- can_manage_students: professional only
    v_plan_name = 'profissional',
    -- can_send_requests: linked students only
    v_is_linked,
    -- is_linked
    v_is_linked;
END;
$$;

-- Update get_student_access_level to check grace_period via past_due + grace_period_end
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
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professional_id uuid;
  v_sub_status text;
  v_grace_period_end timestamptz;
  v_is_in_grace boolean;
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
  SELECT s.status::text, s.grace_period_end
  INTO v_sub_status, v_grace_period_end
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = v_professional_id
    AND p.type = 'professional'
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- If no subscription found, treat as suspended
  IF v_sub_status IS NULL THEN
    RETURN QUERY SELECT 
      false,
      'suspended'::text,
      false,
      false,
      false,
      false,
      false,
      'suspended'::text;
    RETURN;
  END IF;
  
  -- Check if in grace period (past_due with valid grace_period_end)
  v_is_in_grace := (v_sub_status = 'past_due' AND v_grace_period_end IS NOT NULL AND v_grace_period_end > now());
  
  -- Return access based on professional status
  IF v_sub_status IN ('active', 'trial') THEN
    RETURN QUERY SELECT 
      true,
      'full'::text,
      true,
      true,
      true,
      true,
      true,
      v_sub_status;
  ELSIF v_is_in_grace THEN
    RETURN QUERY SELECT 
      true,
      'read_only'::text,
      true,
      true,
      false, -- NO chat during grace period
      false,
      false,
      'past_due'::text;
  ELSE
    RETURN QUERY SELECT 
      false,
      'suspended'::text,
      false,
      false,
      false,
      false,
      false,
      v_sub_status;
  END IF;
END;
$$;