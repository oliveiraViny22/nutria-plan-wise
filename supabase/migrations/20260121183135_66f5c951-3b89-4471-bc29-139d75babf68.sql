-- Create get_usage_info function to return current usage and limits
CREATE OR REPLACE FUNCTION public.get_usage_info(_user_id uuid, _feature text)
RETURNS TABLE(current_usage integer, max_limit integer, allowed boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_plan RECORD;
    v_usage RECORD;
    v_current integer;
    v_max integer;
BEGIN
    -- Get user's plan from subscription
    SELECT p.* INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    -- If no subscription, use free plan as fallback
    IF v_plan IS NULL THEN
        SELECT * INTO v_plan 
        FROM public.plans 
        WHERE type = 'gratuito' AND is_active = true 
        LIMIT 1;
    END IF;
    
    -- Get user's usage
    SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
    
    -- Determine current and max based on feature
    CASE _feature
        WHEN 'diet' THEN
            v_current := COALESCE(v_usage.diets_used, 0);
            v_max := COALESCE(v_plan.diet_limit, 0);
        WHEN 'substitution' THEN
            v_current := COALESCE(v_usage.substitutions_used, 0);
            v_max := COALESCE(v_plan.substitution_limit, 0);
        WHEN 'adjustment' THEN
            v_current := COALESCE(v_usage.adjustments_used, 0);
            v_max := COALESCE(v_plan.adjustment_limit, 0);
        WHEN 'chat' THEN
            -- Reset chat count if new day
            IF v_usage IS NOT NULL AND v_usage.last_chat_reset < CURRENT_DATE THEN
                v_current := 0;
            ELSE
                v_current := COALESCE(v_usage.chat_messages_today, 0);
            END IF;
            v_max := COALESCE(v_plan.chat_messages_per_day, 0);
        ELSE
            v_current := 0;
            v_max := 0;
    END CASE;
    
    RETURN QUERY SELECT v_current, v_max, (v_current < v_max AND (v_plan.has_chat OR _feature != 'chat'));
END;
$function$;