
-- P0-1: Migrar cooldown de diet_plans para profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS objective_change_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS objective_locked_until TIMESTAMP WITH TIME ZONE;

-- Migrar dados existentes: pegar o maior change_count e locked_until de cada user
UPDATE public.profiles p
SET 
  objective_change_count = sub.max_count,
  objective_locked_until = sub.max_locked
FROM (
  SELECT 
    user_id,
    COALESCE(MAX(objective_change_count), 0) AS max_count,
    MAX(objective_locked_until) AS max_locked
  FROM public.diet_plans
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id;

-- P0-2: Dropar a versão antiga (2 args) de apply_objective_change
DROP FUNCTION IF EXISTS public.apply_objective_change(uuid, text);

-- Recriar apply_objective_change lendo/escrevendo em profiles
CREATE OR REPLACE FUNCTION public.apply_objective_change(_user_id uuid, _new_goal text, _keep_plan_active boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_eligibility RECORD;
    v_old_plan RECORD;
    v_policy RECORD;
    v_user_plan RECORD;
    v_profile RECORD;
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
    
    -- Obter dados de cooldown do perfil
    SELECT objective_change_count, objective_locked_until 
    INTO v_profile
    FROM profiles
    WHERE user_id = _user_id;
    
    -- Obter plano ativo atual
    SELECT * INTO v_old_plan
    FROM diet_plans
    WHERE user_id = _user_id AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Obter tipo de plano do usuário
    SELECT * INTO v_user_plan FROM get_user_plan(_user_id);
    
    -- Calcular novo change_count a partir do perfil
    v_new_change_count := COALESCE(v_profile.objective_change_count, 0) + 1;
    
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
    
    -- Atualizar plano atual se existir
    IF v_old_plan IS NOT NULL THEN
        IF _keep_plan_active THEN
            -- Manter plano ativo para otimização posterior (não toca no status)
            NULL;
        ELSE
            -- Encerrar plano atual
            UPDATE diet_plans
            SET status = 'inactive',
                updated_at = now()
            WHERE id = v_old_plan.id;
        END IF;
    END IF;
    
    -- Atualizar perfil: objetivo, metas E cooldown
    UPDATE profiles
    SET goal = _new_goal,
        daily_calories = (v_targets->>'calories')::INTEGER,
        protein_target = (v_targets->>'protein')::INTEGER,
        carbs_target = (v_targets->>'carbs')::INTEGER,
        fat_target = (v_targets->>'fat')::INTEGER,
        objective_change_count = v_new_change_count,
        objective_locked_until = v_new_locked_until,
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
        'targets', v_targets,
        'plan_kept_active', _keep_plan_active
    );
END;
$function$;

-- Recriar check_objective_change_eligibility lendo de profiles
CREATE OR REPLACE FUNCTION public.check_objective_change_eligibility(_user_id uuid)
 RETURNS TABLE(can_change boolean, locked_until timestamp with time zone, next_cooldown_days integer, change_count integer, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_profile RECORD;
    v_user_plan RECORD;
    v_policy RECORD;
    v_is_student BOOLEAN;
    v_change_count INTEGER;
BEGIN
    -- Verificar se é aluno vinculado
    SELECT EXISTS (
        SELECT 1 FROM professional_students 
        WHERE student_id = _user_id AND status = 'active'
    ) INTO v_is_student;
    
    IF v_is_student THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            NULL::TIMESTAMP WITH TIME ZONE,
            NULL::INTEGER,
            0::INTEGER,
            'Alunos devem solicitar alteração ao profissional'::TEXT;
        RETURN;
    END IF;
    
    -- Obter dados do perfil (cooldown agora vive aqui)
    SELECT objective_change_count, objective_locked_until
    INTO v_profile
    FROM profiles
    WHERE user_id = _user_id;
    
    v_change_count := COALESCE(v_profile.objective_change_count, 0);
    
    -- Obter tipo de plano do usuário
    SELECT * INTO v_user_plan FROM get_user_plan(_user_id);
    
    -- Se plano gratuito, não pode alterar
    IF v_user_plan.plan_type = 'gratuito' THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            NULL::TIMESTAMP WITH TIME ZONE,
            NULL::INTEGER,
            v_change_count,
            'Plano gratuito não permite alteração de objetivo'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar se está em período de cooldown
    IF v_profile.objective_locked_until IS NOT NULL AND v_profile.objective_locked_until > now() THEN
        SELECT cooldown_days INTO v_policy
        FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT
          AND change_number = v_change_count + 1
        ORDER BY change_number
        LIMIT 1;
        
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            v_profile.objective_locked_until,
            COALESCE(v_policy.cooldown_days, 90)::INTEGER,
            v_change_count,
            'Em período de cooldown'::TEXT;
        RETURN;
    END IF;
    
    -- Buscar política para próxima alteração
    SELECT cooldown_days INTO v_policy
    FROM objective_change_policies
    WHERE profile_type = v_user_plan.plan_type::TEXT
      AND change_number = v_change_count + 1
    ORDER BY change_number
    LIMIT 1;
    
    IF v_policy IS NULL THEN
        SELECT cooldown_days INTO v_policy
        FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT
        ORDER BY change_number DESC
        LIMIT 1;
    END IF;
    
    RETURN QUERY SELECT 
        TRUE::BOOLEAN,
        NULL::TIMESTAMP WITH TIME ZONE,
        COALESCE(v_policy.cooldown_days, 90)::INTEGER,
        v_change_count,
        'Alteração permitida'::TEXT;
END;
$function$;
