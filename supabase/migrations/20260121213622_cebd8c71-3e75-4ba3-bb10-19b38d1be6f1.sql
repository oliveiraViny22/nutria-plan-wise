-- =====================================================
-- FUNÇÃO HELPER: Verificar se pode ver suplementos (CORRIGIDO v2)
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_view_supplements(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admins sempre podem ver
    has_role(_user_id, 'admin'::app_role)
    -- Profissionais sempre podem ver
    OR has_role(_user_id, 'professional'::app_role)
    -- Usuários com assinatura ativa (não gratuita) podem ver
    OR EXISTS (
      SELECT 1 FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = _user_id
      AND s.status IN ('active', 'trial')
      AND p.type != 'gratuito'
    )
  )
$$;

-- =====================================================
-- FUNÇÃO HELPER: Obter alimentos visíveis por contexto
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_visible_foods_for_user(_user_id uuid)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.*
  FROM foods f
  WHERE
    -- Alimentos aprovados e ativos
    (f.review_status = 'approved' AND f.is_active = true)
    -- Excluir suplementos se usuário não tem permissão
    AND (
      f.type != 'supplement'
      OR can_view_supplements(_user_id)
    )
  UNION
  -- Alimentos pendentes criados pelo próprio profissional
  SELECT f.*
  FROM foods f
  WHERE
    f.created_by_type = 'professional'
    AND f.created_by_id = _user_id
    AND f.review_status = 'pending'
    AND has_role(_user_id, 'professional'::app_role)
$$;

-- =====================================================
-- FUNÇÃO HELPER: Verificar visibilidade de alimento (v2)
-- =====================================================

CREATE OR REPLACE FUNCTION public.can_view_food(
  _user_id uuid,
  _food_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM foods f
    WHERE f.id = _food_id
    AND (
      -- Alimentos aprovados e ativos são visíveis para todos (exceto suplementos com regra)
      (
        f.review_status = 'approved' 
        AND f.is_active = true
        AND (f.type != 'supplement' OR can_view_supplements(_user_id))
      )
      -- Admins veem tudo
      OR has_role(_user_id, 'admin'::app_role)
      -- Profissionais veem seus próprios pendentes
      OR (
        f.created_by_type = 'professional'
        AND f.created_by_id = _user_id
        AND has_role(_user_id, 'professional'::app_role)
      )
    )
  )
$$;