
-- P1 Gap 4: Fix apply_objective_change to also persist nutritional targets
CREATE OR REPLACE FUNCTION public.apply_objective_change(_user_id UUID, _new_goal TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eligibility RECORD;
    v_old_plan RECORD;
    v_policy RECORD;
    v_user_plan RECORD;
    v_new_locked_until TIMESTAMP WITH TIME ZONE;
    v_new_change_count INTEGER;
    v_targets JSON;
BEGIN
    -- Verificar elegibilidade
    SELECT * INTO v_eligibility FROM check_objective_change_eligibility(_user_id);
    
    IF NOT v_eligibility.can_change THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', v_eligibility.reason,
            'locked_until', v_eligibility.locked_until
        );
    END IF;
    
    -- Obter plano ativo atual
    SELECT * INTO v_old_plan
    FROM diet_plans
    WHERE user_id = _user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Obter tipo de plano do usuário
    SELECT * INTO v_user_plan FROM get_user_plan(_user_id);
    
    -- Calcular novo change_count
    v_new_change_count := COALESCE(v_old_plan.objective_change_count, 0) + 1;
    
    -- Buscar política de cooldown
    SELECT cooldown_days INTO v_policy
    FROM objective_change_policies
    WHERE profile_type = v_user_plan.plan_type::TEXT
      AND change_number = v_new_change_count
    ORDER BY change_number
    LIMIT 1;
    
    IF v_policy IS NULL THEN
        SELECT cooldown_days INTO v_policy
        FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT
        ORDER BY change_number DESC
        LIMIT 1;
    END IF;
    
    v_new_locked_until := now() + (COALESCE(v_policy.cooldown_days, 90) || ' days')::INTERVAL;
    
    -- Calcular novas metas nutricionais
    v_targets := calculate_nutritional_targets(_user_id, _new_goal);
    
    -- Encerrar plano atual se existir
    IF v_old_plan IS NOT NULL THEN
        UPDATE diet_plans
        SET status = 'inactive',
            objective_change_count = v_new_change_count,
            objective_locked_until = v_new_locked_until,
            updated_at = now()
        WHERE id = v_old_plan.id;
    END IF;
    
    -- Atualizar perfil com novo objetivo E novas metas nutricionais
    UPDATE profiles
    SET goal = _new_goal,
        daily_calories = (v_targets->>'calories')::INTEGER,
        protein_target = (v_targets->>'protein')::INTEGER,
        carbs_target = (v_targets->>'carbs')::INTEGER,
        fat_target = (v_targets->>'fat')::INTEGER,
        updated_at = now()
    WHERE user_id = _user_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Objetivo alterado com sucesso.',
        'new_goal', _new_goal,
        'previous_change_count', v_new_change_count - 1,
        'new_change_count', v_new_change_count,
        'next_locked_until', v_new_locked_until,
        'cooldown_days', COALESCE(v_policy.cooldown_days, 90),
        'targets', v_targets
    );
END;
$$;

-- P1 Gap 3: Create trigger to reset usage when subscription plan changes (upgrade)
CREATE OR REPLACE FUNCTION public.handle_subscription_upgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_plan_type TEXT;
    v_new_plan_type TEXT;
BEGIN
    -- Only act on plan_id changes
    IF OLD.plan_id = NEW.plan_id THEN
        RETURN NEW;
    END IF;
    
    -- Get old and new plan types
    SELECT type::TEXT INTO v_old_plan_type FROM plans WHERE id = OLD.plan_id;
    SELECT type::TEXT INTO v_new_plan_type FROM plans WHERE id = NEW.plan_id;
    
    -- Reset usage when upgrading from gratuito to a paid plan
    IF v_old_plan_type = 'gratuito' AND v_new_plan_type != 'gratuito' THEN
        PERFORM reset_monthly_usage(NEW.user_id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Attach trigger to subscriptions table
DROP TRIGGER IF EXISTS on_subscription_upgrade ON subscriptions;
CREATE TRIGGER on_subscription_upgrade
    AFTER UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION handle_subscription_upgrade();
