
-- P0-1: Fix apply_objective_change to persist cooldown fields
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
    
    -- Fallback para política máxima se não encontrou específica
    IF v_policy IS NULL THEN
        SELECT cooldown_days INTO v_policy
        FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT
        ORDER BY change_number DESC
        LIMIT 1;
    END IF;
    
    -- Calcular novo locked_until
    v_new_locked_until := now() + (COALESCE(v_policy.cooldown_days, 90) || ' days')::INTERVAL;
    
    -- Encerrar plano atual se existir
    IF v_old_plan IS NOT NULL THEN
        UPDATE diet_plans
        SET status = 'inactive',
            objective_change_count = v_new_change_count,
            objective_locked_until = v_new_locked_until,
            updated_at = now()
        WHERE id = v_old_plan.id;
    END IF;
    
    -- Atualizar perfil com novo objetivo
    UPDATE profiles
    SET goal = _new_goal,
        updated_at = now()
    WHERE user_id = _user_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Objetivo alterado com sucesso.',
        'new_goal', _new_goal,
        'previous_change_count', v_new_change_count - 1,
        'new_change_count', v_new_change_count,
        'next_locked_until', v_new_locked_until,
        'cooldown_days', COALESCE(v_policy.cooldown_days, 90)
    );
END;
$$;

-- P0-3: Fix calculate_nutritional_targets to use g/kg instead of calorie ratios
CREATE OR REPLACE FUNCTION public.calculate_nutritional_targets(_user_id UUID, _goal TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile profiles%ROWTYPE;
  _bmr numeric;
  _tdee numeric;
  _calories integer;
  _protein integer;
  _carbs integer;
  _fat integer;
  _activity_multiplier numeric;
  _calorie_adjustment integer;
  _weight numeric;
  _protein_per_kg numeric;
  _fat_ratio numeric;
BEGIN
  SELECT * INTO _profile FROM profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Profile not found');
  END IF;

  _weight := COALESCE(_profile.weight, 70);

  -- BMR (Mifflin-St Jeor)
  IF _profile.sex = 'male' THEN
    _bmr := 10 * _weight + 6.25 * COALESCE(_profile.height, 170) - 5 * COALESCE(_profile.age, 30) + 5;
  ELSE
    _bmr := 10 * _weight + 6.25 * COALESCE(_profile.height, 160) - 5 * COALESCE(_profile.age, 30) - 161;
  END IF;

  -- Activity multiplier
  _activity_multiplier := CASE _profile.activity_level
    WHEN 'sedentary' THEN 1.2
    WHEN 'light' THEN 1.375
    WHEN 'moderate' THEN 1.55
    WHEN 'active' THEN 1.725
    WHEN 'very_active' THEN 1.9
    ELSE 1.55
  END;

  _tdee := _bmr * _activity_multiplier;

  -- Calorie adjustment based on goal
  _calorie_adjustment := CASE _goal
    WHEN 'lose_weight' THEN -500
    WHEN 'maintain' THEN 0
    WHEN 'gain_muscle' THEN 300
    ELSE 0
  END;

  _calories := ROUND(_tdee + _calorie_adjustment);

  -- Protein: g/kg based on goal
  -- Hipertrofia: 2.0g/kg, Emagrecimento: 2.0g/kg, Manutenção: 1.4g/kg
  _protein_per_kg := CASE _goal
    WHEN 'gain_muscle' THEN 2.0
    WHEN 'lose_weight' THEN 2.0
    WHEN 'maintain' THEN 1.4
    ELSE 1.4
  END;

  _protein := ROUND(_weight * _protein_per_kg);

  -- Safety cap: max 3.0g/kg
  IF _protein > ROUND(_weight * 3.0) THEN
    _protein := ROUND(_weight * 3.0);
  END IF;

  -- Fat: percentage of total calories
  -- Ganho: 20%, Perda: 30%, Manutenção: 25%
  _fat_ratio := CASE _goal
    WHEN 'gain_muscle' THEN 0.20
    WHEN 'lose_weight' THEN 0.30
    WHEN 'maintain' THEN 0.25
    ELSE 0.25
  END;

  _fat := ROUND((_calories * _fat_ratio) / 9);

  -- Carbs: fill remaining calories
  _carbs := ROUND((_calories - (_protein * 4) - (_fat * 9)) / 4);

  -- Ensure carbs don't go negative
  IF _carbs < 50 THEN
    _carbs := 50;
  END IF;

  RETURN json_build_object(
    'calories', _calories,
    'protein', _protein,
    'carbs', _carbs,
    'fat', _fat,
    'bmr', ROUND(_bmr),
    'tdee', ROUND(_tdee)
  );
END;
$$;
