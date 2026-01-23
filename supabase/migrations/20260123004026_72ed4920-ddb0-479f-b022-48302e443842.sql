-- =====================================================
-- COOLDOWN PROGRESSIVO DE ALTERAÇÃO DE OBJETIVO
-- =====================================================

-- 1. Criar tabela de políticas de cooldown
CREATE TABLE public.objective_change_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_type TEXT NOT NULL, -- 'plano_pessoal_pago', 'profissional'
    change_number INTEGER NOT NULL, -- 1, 2, 3, etc.
    cooldown_days INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(profile_type, change_number)
);

-- 2. Adicionar campos na tabela diet_plans
ALTER TABLE public.diet_plans 
ADD COLUMN IF NOT EXISTS objective_change_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.diet_plans 
ADD COLUMN IF NOT EXISTS objective_locked_until TIMESTAMP WITH TIME ZONE;

-- 3. Criar tabela de solicitações de alteração de objetivo (para alunos)
CREATE TABLE public.objective_change_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    current_goal TEXT NOT NULL,
    requested_goal TEXT NOT NULL,
    justification TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    professional_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.objective_change_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_change_requests ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para objective_change_policies
CREATE POLICY "Admins can manage objective_change_policies"
ON public.objective_change_policies
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view objective_change_policies"
ON public.objective_change_policies
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role full access to objective_change_policies"
ON public.objective_change_policies
FOR ALL
USING (auth.role() = 'service_role'::text);

-- 6. Políticas RLS para objective_change_requests
CREATE POLICY "Students can create own requests"
ON public.objective_change_requests
FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can view own requests"
ON public.objective_change_requests
FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Professionals can view student requests"
ON public.objective_change_requests
FOR SELECT
USING (
    auth.uid() = professional_id 
    AND has_role(auth.uid(), 'professional'::app_role)
);

CREATE POLICY "Professionals can update student requests"
ON public.objective_change_requests
FOR UPDATE
USING (
    auth.uid() = professional_id 
    AND has_role(auth.uid(), 'professional'::app_role)
);

CREATE POLICY "Service role full access to objective_change_requests"
ON public.objective_change_requests
FOR ALL
USING (auth.role() = 'service_role'::text);

-- 7. Trigger para updated_at
CREATE TRIGGER update_objective_change_policies_updated_at
BEFORE UPDATE ON public.objective_change_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_objective_change_requests_updated_at
BEFORE UPDATE ON public.objective_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Inserir políticas padrão
INSERT INTO public.objective_change_policies (profile_type, change_number, cooldown_days) VALUES
('plano_pessoal_pago', 1, 14),
('plano_pessoal_pago', 2, 30),
('plano_pessoal_pago', 3, 60),
('plano_pessoal_pago', 4, 90),
('profissional', 1, 7),
('profissional', 2, 14),
('profissional', 3, 30),
('profissional', 4, 60)
ON CONFLICT (profile_type, change_number) DO NOTHING;

-- 9. Função RPC para verificar se pode alterar objetivo
CREATE OR REPLACE FUNCTION public.check_objective_change_eligibility(_user_id UUID)
RETURNS TABLE(
    can_change BOOLEAN,
    locked_until TIMESTAMP WITH TIME ZONE,
    next_cooldown_days INTEGER,
    change_count INTEGER,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_plan RECORD;
    v_user_plan RECORD;
    v_policy RECORD;
    v_is_student BOOLEAN;
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
    
    -- Obter plano ativo do usuário
    SELECT dp.* INTO v_plan
    FROM diet_plans dp
    WHERE dp.user_id = _user_id AND dp.status = 'active'
    ORDER BY dp.created_at DESC
    LIMIT 1;
    
    -- Obter tipo de plano do usuário
    SELECT * INTO v_user_plan FROM get_user_plan(_user_id);
    
    -- Se não tem plano ativo, pode criar novo
    IF v_plan IS NULL THEN
        RETURN QUERY SELECT 
            TRUE::BOOLEAN,
            NULL::TIMESTAMP WITH TIME ZONE,
            14::INTEGER,
            0::INTEGER,
            'Nenhum plano ativo'::TEXT;
        RETURN;
    END IF;
    
    -- Se plano gratuito, não pode alterar
    IF v_user_plan.plan_type = 'gratuito' THEN
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            NULL::TIMESTAMP WITH TIME ZONE,
            NULL::INTEGER,
            v_plan.objective_change_count,
            'Plano gratuito não permite alteração de objetivo'::TEXT;
        RETURN;
    END IF;
    
    -- Verificar se está em período de cooldown
    IF v_plan.objective_locked_until IS NOT NULL AND v_plan.objective_locked_until > now() THEN
        -- Buscar próximo cooldown
        SELECT cooldown_days INTO v_policy
        FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT
          AND change_number = v_plan.objective_change_count + 1
        ORDER BY change_number
        LIMIT 1;
        
        RETURN QUERY SELECT 
            FALSE::BOOLEAN,
            v_plan.objective_locked_until,
            COALESCE(v_policy.cooldown_days, 90)::INTEGER,
            v_plan.objective_change_count,
            'Em período de cooldown'::TEXT;
        RETURN;
    END IF;
    
    -- Buscar política para próxima alteração
    SELECT cooldown_days INTO v_policy
    FROM objective_change_policies
    WHERE profile_type = v_user_plan.plan_type::TEXT
      AND change_number = v_plan.objective_change_count + 1
    ORDER BY change_number
    LIMIT 1;
    
    -- Se não encontrou política específica, usar a maior disponível
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
        v_plan.objective_change_count,
        'Alteração permitida'::TEXT;
END;
$$;

-- 10. Função RPC para aplicar alteração de objetivo
CREATE OR REPLACE FUNCTION public.apply_objective_change(_user_id UUID, _new_goal TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_eligibility RECORD;
    v_old_plan RECORD;
    v_policy RECORD;
    v_user_plan RECORD;
    v_new_locked_until TIMESTAMP WITH TIME ZONE;
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
    
    -- Buscar política de cooldown
    SELECT cooldown_days INTO v_policy
    FROM objective_change_policies
    WHERE profile_type = v_user_plan.plan_type::TEXT
      AND change_number = COALESCE(v_old_plan.objective_change_count, 0) + 1
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
        'message', 'Objetivo alterado com sucesso. Um novo plano será gerado.',
        'new_goal', _new_goal,
        'previous_change_count', COALESCE(v_old_plan.objective_change_count, 0),
        'next_locked_until', v_new_locked_until,
        'cooldown_days', COALESCE(v_policy.cooldown_days, 90)
    );
END;
$$;