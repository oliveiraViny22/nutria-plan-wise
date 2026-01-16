-- =====================================================
-- ATUALIZAÇÃO DE PLANOS COMERCIAIS E ESTRUTURA
-- =====================================================

-- 1. LIMPAR TABELAS (conforme especificado)
TRUNCATE TABLE plans CASCADE;
TRUNCATE TABLE subscriptions CASCADE;
TRUNCATE TABLE user_usage CASCADE;

-- 2. CRIAR ENUM user_type SE NÃO EXISTIR
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
    CREATE TYPE public.user_type AS ENUM ('aluno', 'usuario', 'profissional');
  END IF;
END $$;

-- 3. CRIAR ENUM plan_type_commercial SE NÃO EXISTIR
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type_commercial') THEN
    CREATE TYPE public.plan_type_commercial AS ENUM ('gratuito', 'plano_pessoal_pago', 'premium', 'profissional');
  END IF;
END $$;

-- 4. ADICIONAR COLUNA user_type AO PERFIL (imutável)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS user_type public.user_type DEFAULT 'usuario';

-- 5. MIGRAR DADOS EXISTENTES DO account_type PARA user_type
UPDATE profiles 
SET user_type = CASE 
  WHEN account_type = 'aluno' THEN 'aluno'::public.user_type
  WHEN account_type = 'profissional' THEN 'profissional'::public.user_type
  ELSE 'usuario'::public.user_type
END
WHERE user_type IS NULL OR user_type = 'usuario';

-- 6. ADICIONAR COLUNAS STRIPE À TABELA PLANS
ALTER TABLE plans 
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS description TEXT;

-- 7. RECRIAR OS 4 PLANOS COMERCIAIS CORRETOS
INSERT INTO plans (
  name, 
  type, 
  description,
  diet_limit, 
  substitution_limit, 
  adjustment_limit, 
  chat_messages_per_day, 
  patients_limit, 
  has_chat, 
  history_days, 
  price_monthly, 
  price_quarterly, 
  price_semiannual, 
  price_annual,
  stripe_product_id,
  stripe_price_monthly,
  stripe_price_quarterly,
  stripe_price_semiannual,
  stripe_price_annual,
  is_active
) VALUES 
-- GRATUITO
(
  'gratuito', 
  'personal', 
  'Plano gratuito - visualização apenas',
  1, -- 1 dieta (criada no onboarding)
  0, -- sem substituições
  0, -- sem ajustes
  0, -- sem chat
  0, 
  false, 
  7, 
  0, 0, 0, 0,
  NULL, NULL, NULL, NULL, NULL,
  true
),
-- PLANO PESSOAL PAGO
(
  'plano_pessoal_pago', 
  'personal', 
  'Autonomia total para criar e editar planos',
  12, -- 12 dietas/mês
  120, -- 120 substituições
  12, -- 12 ajustes
  50, -- 50 mensagens chat/dia
  0, 
  true, 
  365, 
  29.90, 
  76.23, -- 29.90 * 3 * 0.85 (15% desc)
  134.55, -- 29.90 * 6 * 0.75 (25% desc)
  233.22, -- 29.90 * 12 * 0.65 (35% desc)
  'prod_TnuWrYqNQ9d0ir',
  'price_1SqIhQIT6G6s8uYgDZq6TKBK',
  NULL, NULL, NULL,
  true
),
-- PREMIUM
(
  'premium', 
  'personal', 
  'Simulações com IA sem alterar o plano oficial',
  0, -- não pode criar dietas novas
  0, -- sem substituições no plano oficial
  0, -- sem ajustes no plano oficial
  100, -- 100 mensagens chat/dia para simulações
  0, 
  true, 
  365, 
  49.90, 
  127.25, -- 49.90 * 3 * 0.85
  224.55, -- 49.90 * 6 * 0.75
  389.22, -- 49.90 * 12 * 0.65
  'prod_TnuWHN8aWTvey1',
  'price_1SqIheIT6G6s8uYgMs29t4uJ',
  NULL, NULL, NULL,
  true
),
-- PROFISSIONAL
(
  'profissional', 
  'professional', 
  'Gerenciamento de alunos, IA clínica, até 50 alunos',
  999, -- ilimitado na prática
  999, 
  999, 
  200, -- 200 mensagens chat/dia
  50, -- até 50 alunos
  true, 
  9999, 
  99.90, 
  254.75, -- 99.90 * 3 * 0.85
  449.55, -- 99.90 * 6 * 0.75
  779.22, -- 99.90 * 12 * 0.65
  'prod_TnuWh5A9WUc7ja',
  'price_1SqIhtIT6G6s8uYgNuoGbZ6C',
  NULL, NULL, NULL,
  true
);

-- 8. ATUALIZAR ESTRUTURA DA TABELA SUBSCRIPTIONS
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- 9. CRIAR FUNÇÃO PARA VERIFICAR PERMISSÕES BASEADO EM user_type + plan
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE (
  user_type public.user_type,
  plan_name TEXT,
  can_create_plan BOOLEAN,
  can_edit_plan BOOLEAN,
  can_view_plan BOOLEAN,
  can_substitute BOOLEAN,
  can_adjust BOOLEAN,
  can_use_ai BOOLEAN,
  can_use_simulations BOOLEAN,
  can_manage_students BOOLEAN,
  can_send_requests BOOLEAN,
  is_linked_to_professional BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type public.user_type;
  v_plan_name TEXT;
  v_is_linked BOOLEAN;
BEGIN
  -- Obter tipo de usuário
  SELECT p.user_type, p.professional_id IS NOT NULL
  INTO v_user_type, v_is_linked
  FROM profiles p
  WHERE p.user_id = _user_id;
  
  -- Obter plano comercial ativo
  SELECT pl.name INTO v_plan_name
  FROM subscriptions s
  JOIN plans pl ON pl.id = s.plan_id
  WHERE s.user_id = _user_id 
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Se não tem assinatura, assume gratuito
  IF v_plan_name IS NULL THEN
    v_plan_name := 'gratuito';
  END IF;
  
  -- Retornar permissões baseadas em user_type + plan
  RETURN QUERY
  SELECT 
    COALESCE(v_user_type, 'usuario'::public.user_type) AS user_type,
    v_plan_name AS plan_name,
    -- can_create_plan: usuario + plano_pessoal_pago ou profissional + profissional
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_user_type = 'profissional' AND v_plan_name = 'profissional' THEN TRUE
      WHEN v_user_type = 'usuario' AND v_plan_name = 'plano_pessoal_pago' THEN TRUE
      ELSE FALSE
    END AS can_create_plan,
    -- can_edit_plan
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_user_type = 'profissional' AND v_plan_name = 'profissional' THEN TRUE
      WHEN v_user_type = 'usuario' AND v_plan_name = 'plano_pessoal_pago' THEN TRUE
      ELSE FALSE
    END AS can_edit_plan,
    -- can_view_plan: todos podem
    TRUE AS can_view_plan,
    -- can_substitute
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_user_type = 'profissional' AND v_plan_name = 'profissional' THEN TRUE
      WHEN v_user_type = 'usuario' AND v_plan_name = 'plano_pessoal_pago' THEN TRUE
      ELSE FALSE
    END AS can_substitute,
    -- can_adjust
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_user_type = 'profissional' AND v_plan_name = 'profissional' THEN TRUE
      WHEN v_user_type = 'usuario' AND v_plan_name = 'plano_pessoal_pago' THEN TRUE
      ELSE FALSE
    END AS can_adjust,
    -- can_use_ai
    CASE 
      WHEN v_plan_name IN ('plano_pessoal_pago', 'premium', 'profissional') THEN TRUE
      WHEN v_user_type = 'aluno' THEN TRUE -- IA educacional
      ELSE FALSE
    END AS can_use_ai,
    -- can_use_simulations: apenas premium
    (v_plan_name = 'premium') AS can_use_simulations,
    -- can_manage_students: profissional + plano profissional
    (v_user_type = 'profissional' AND v_plan_name = 'profissional') AS can_manage_students,
    -- can_send_requests: aluno vinculado
    (v_user_type = 'aluno' AND v_is_linked) AS can_send_requests,
    -- is_linked_to_professional
    COALESCE(v_is_linked, FALSE) AS is_linked_to_professional;
END;
$$;

-- 10. CRIAR FUNÇÃO PARA VERIFICAR USO E LIMITES
CREATE OR REPLACE FUNCTION public.check_feature_limit(_user_id UUID, _feature TEXT)
RETURNS TABLE (
  allowed BOOLEAN,
  current_usage INTEGER,
  max_limit INTEGER,
  upgrade_required BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_plan plans%ROWTYPE;
  v_usage user_usage%ROWTYPE;
  v_current INTEGER;
  v_limit INTEGER;
BEGIN
  -- Obter plano ativo
  SELECT s.plan_id INTO v_plan_id
  FROM subscriptions s
  WHERE s.user_id = _user_id AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Se não tem plano, buscar gratuito
  IF v_plan_id IS NULL THEN
    SELECT * INTO v_plan FROM plans WHERE name = 'gratuito' LIMIT 1;
  ELSE
    SELECT * INTO v_plan FROM plans WHERE id = v_plan_id;
  END IF;
  
  -- Obter uso atual
  SELECT * INTO v_usage FROM user_usage WHERE user_id = _user_id;
  
  -- Determinar limite e uso baseado na feature
  CASE _feature
    WHEN 'diet' THEN
      v_current := COALESCE(v_usage.diets_used, 0);
      v_limit := v_plan.diet_limit;
    WHEN 'substitution' THEN
      v_current := COALESCE(v_usage.substitutions_used, 0);
      v_limit := v_plan.substitution_limit;
    WHEN 'adjustment' THEN
      v_current := COALESCE(v_usage.adjustments_used, 0);
      v_limit := v_plan.adjustment_limit;
    WHEN 'chat' THEN
      v_current := COALESCE(v_usage.chat_messages_today, 0);
      v_limit := v_plan.chat_messages_per_day;
    ELSE
      v_current := 0;
      v_limit := 0;
  END CASE;
  
  RETURN QUERY
  SELECT 
    (v_current < v_limit) AS allowed,
    v_current AS current_usage,
    v_limit AS max_limit,
    (v_current >= v_limit) AS upgrade_required;
END;
$$;

-- 11. CRIAR ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_plan ON subscriptions(user_id, plan_id, status);

-- 12. GARANTIR QUE RLS ESTÁ CORRETO
-- Política para plans (leitura pública de planos ativos)
DROP POLICY IF EXISTS "Anyone can view active plans" ON plans;
CREATE POLICY "Anyone can view active plans" ON plans
  FOR SELECT USING (is_active = true);