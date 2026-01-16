-- Atualizar planos com valores e limites conforme especificações
-- gratuito: R$0 - 3 mensagens/dia
-- premium (aluno): R$4,90/mês - 10 mensagens/dia  
-- plano_pessoal_pago: R$14,90/mês - 30 mensagens/dia
-- profissional: R$99/mês - 100 mensagens/dia

-- Primeiro, atualizar o plano gratuito
UPDATE plans 
SET 
  chat_messages_per_day = 3,
  has_chat = true,
  price_monthly = 0,
  price_quarterly = 0,
  price_semiannual = 0,
  price_annual = 0,
  description = 'IA educacional básica'
WHERE name = 'gratuito';

-- Atualizar premium (que será usado para alunos vinculados)
UPDATE plans 
SET 
  chat_messages_per_day = 10,
  has_chat = true,
  price_monthly = 4.90,
  price_quarterly = 12.50,  -- 3 meses com ~15% desconto
  price_semiannual = 22.00, -- 6 meses com ~25% desconto
  price_annual = 38.20,     -- 12 meses com ~35% desconto
  description = 'IA educacional ampliada para alunos'
WHERE name = 'premium';

-- Atualizar plano pessoal pago
UPDATE plans 
SET 
  chat_messages_per_day = 30,
  has_chat = true,
  price_monthly = 14.90,
  price_quarterly = 37.99,  -- ~15% desconto
  price_semiannual = 67.05, -- ~25% desconto  
  price_annual = 116.22,    -- ~35% desconto
  description = 'IA completa com autonomia total'
WHERE name = 'plano_pessoal_pago';

-- Atualizar profissional
UPDATE plans 
SET 
  chat_messages_per_day = 100,
  has_chat = true,
  price_monthly = 99.00,
  price_quarterly = 252.45, -- ~15% desconto
  price_semiannual = 445.50, -- ~25% desconto
  price_annual = 772.20,     -- ~35% desconto
  description = 'IA como assistente clínica'
WHERE name = 'profissional';

-- Atualizar a função get_user_permissions para incluir o plano nas permissões de IA
CREATE OR REPLACE FUNCTION get_user_permissions(_user_id UUID)
RETURNS TABLE (
  user_type user_type,
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
  v_user_type user_type;
  v_plan_name TEXT;
  v_is_linked BOOLEAN;
  v_has_active_sub BOOLEAN;
BEGIN
  -- Buscar tipo de usuário e se está vinculado a profissional
  SELECT 
    COALESCE(p.user_type, 'usuario'),
    p.professional_id IS NOT NULL
  INTO v_user_type, v_is_linked
  FROM profiles p
  WHERE p.user_id = _user_id;

  -- Buscar plano ativo
  SELECT pl.name INTO v_plan_name
  FROM subscriptions s
  JOIN plans pl ON s.plan_id = pl.id
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Default para gratuito se não houver assinatura
  v_plan_name := COALESCE(v_plan_name, 'gratuito');

  -- Retornar permissões baseadas no tipo e plano
  RETURN QUERY
  SELECT 
    COALESCE(v_user_type, 'usuario'::user_type),
    v_plan_name,
    -- can_create_plan: apenas plano_pessoal_pago, premium (não vinculado) e profissional
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_edit_plan: mesmo que create
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_view_plan: todos
    TRUE,
    -- can_substitute: plano_pessoal_pago e profissional
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_adjust: plano_pessoal_pago e profissional  
    CASE 
      WHEN v_is_linked THEN FALSE
      WHEN v_plan_name IN ('plano_pessoal_pago', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_use_ai: todos os planos têm acesso à IA (com comportamento diferente)
    TRUE,
    -- can_use_simulations: premium e profissional
    CASE 
      WHEN v_plan_name IN ('premium', 'profissional') THEN TRUE
      ELSE FALSE
    END,
    -- can_manage_students: apenas profissional
    CASE 
      WHEN v_plan_name = 'profissional' THEN TRUE
      ELSE FALSE
    END,
    -- can_send_requests: alunos vinculados
    v_is_linked,
    -- is_linked
    v_is_linked;
END;
$$;