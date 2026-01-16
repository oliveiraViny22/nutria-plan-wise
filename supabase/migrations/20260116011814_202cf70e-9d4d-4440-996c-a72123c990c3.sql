-- Update can_use_feature to give admins unlimited access
CREATE OR REPLACE FUNCTION public.can_use_feature(_user_id uuid, _feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_plan RECORD;
  v_usage RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin - admins have unlimited access
  SELECT public.has_role(_user_id, 'admin') INTO v_is_admin;
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;

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
$function$;