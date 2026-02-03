-- =====================================================
-- SISTEMA DE FEATURE FLAGS
-- =====================================================
-- Permite ativar/desativar funcionalidades sem deploy
-- Usa system_settings com categoria 'feature_flags'
-- =====================================================

-- Feature flags iniciais para funcionalidades críticas
INSERT INTO system_settings (key, value, category, description, is_sensitive)
VALUES 
  -- Rebalanceador v2 (para futuras refatorações)
  ('rebalancer_v2_enabled', 'false'::jsonb, 'feature_flags', 
   'Ativa o motor de rebalanceamento v2. Quando false, usa o motor atual.', false),
  
  -- Suplementos v2 (migração futura)
  ('supplements_v2_enabled', 'false'::jsonb, 'feature_flags',
   'Ativa o sistema de suplementação v2. Quando false, usa lógica atual.', false),
  
  -- Shadow mode para comparação A/B
  ('shadow_mode_enabled', 'false'::jsonb, 'feature_flags',
   'Executa ambas as versões (v1 e v2) e loga diferenças sem afetar usuários.', false),
  
  -- Circuit breaker para OpenAI
  ('openai_circuit_breaker_enabled', 'true'::jsonb, 'feature_flags',
   'Ativa circuit breaker para chamadas OpenAI. Fallback após 3 falhas consecutivas.', false),
  
  -- Métricas detalhadas
  ('detailed_metrics_enabled', 'true'::jsonb, 'feature_flags',
   'Persiste métricas detalhadas (iterações, convergência) em ai_usage_logs.', false),
  
  -- Rollout percentual do gerador v5.8
  ('generator_v58_rollout_percent', '100'::jsonb, 'feature_flags',
   'Percentual de usuários que usam generator v5.8 (0-100).', false)

ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

-- Função helper para ler feature flags (retorna boolean)
CREATE OR REPLACE FUNCTION public.get_feature_flag(_flag_key text, _default_value boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value INTO v_value
  FROM system_settings
  WHERE key = _flag_key
  AND category = 'feature_flags';
  
  IF v_value IS NULL THEN
    RETURN _default_value;
  END IF;
  
  -- Suporta 'true', 'false', true, false
  IF v_value::text = 'true' OR v_value::text = '"true"' THEN
    RETURN true;
  ELSIF v_value::text = 'false' OR v_value::text = '"false"' THEN
    RETURN false;
  ELSE
    RETURN _default_value;
  END IF;
END;
$$;

-- Função helper para ler rollout percentual
CREATE OR REPLACE FUNCTION public.get_rollout_percent(_flag_key text, _default_value integer DEFAULT 0)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT value INTO v_value
  FROM system_settings
  WHERE key = _flag_key
  AND category = 'feature_flags';
  
  IF v_value IS NULL THEN
    RETURN _default_value;
  END IF;
  
  -- Tentar converter para inteiro
  BEGIN
    RETURN (v_value::text)::integer;
  EXCEPTION WHEN OTHERS THEN
    RETURN _default_value;
  END;
END;
$$;

-- Função para verificar se usuário está no rollout percentual
CREATE OR REPLACE FUNCTION public.is_in_rollout(_user_id uuid, _flag_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_percent integer;
  v_user_bucket integer;
BEGIN
  v_percent := get_rollout_percent(_flag_key, 0);
  
  -- 0% = ninguém, 100% = todos
  IF v_percent <= 0 THEN RETURN false; END IF;
  IF v_percent >= 100 THEN RETURN true; END IF;
  
  -- Calcular bucket do usuário (0-99) baseado no UUID
  v_user_bucket := abs(('x' || substr(_user_id::text, 1, 8))::bit(32)::integer) % 100;
  
  RETURN v_user_bucket < v_percent;
END;
$$;