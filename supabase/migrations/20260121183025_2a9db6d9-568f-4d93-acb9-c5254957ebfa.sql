-- Fix can_use_feature to use free plan as fallback for users without subscription
CREATE OR REPLACE FUNCTION public.can_use_feature(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_plan RECORD;
    v_usage RECORD;
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
    
    -- If still no plan found (shouldn't happen), deny access
    IF v_plan IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user's usage, create if not exists
    SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
    
    IF v_usage IS NULL THEN
        -- First usage, create record
        INSERT INTO public.user_usage (user_id, diets_used, substitutions_used, adjustments_used, chat_messages_today, last_chat_reset)
        VALUES (_user_id, 0, 0, 0, 0, CURRENT_DATE)
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Return true for first use (limit not yet reached)
        RETURN TRUE;
    END IF;
    
    -- Check limits based on feature
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