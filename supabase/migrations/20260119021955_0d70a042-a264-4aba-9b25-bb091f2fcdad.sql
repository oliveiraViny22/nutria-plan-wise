-- ========================================================
-- MIGRAÇÃO: Sistema de Conversão Determinística de Unidades
-- ========================================================
-- PRINCÍPIO: Gramas são a verdade nutricional, unidades são apresentação

-- 1) Adicionar colunas na tabela foods para configuração de unidades
ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS unit_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unit_weight_grams NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unit_increment NUMERIC DEFAULT 1 CHECK (unit_increment > 0),
ADD COLUMN IF NOT EXISTS unit_enabled BOOLEAN DEFAULT FALSE;

-- Comentários para documentação
COMMENT ON COLUMN public.foods.unit_name IS 'Nome da unidade de exibição (ex: ovo, fatia, unidade). NULL = exibe em gramas';
COMMENT ON COLUMN public.foods.unit_weight_grams IS 'Peso médio em gramas de 1 unidade. Usado para conversão determinística';
COMMENT ON COLUMN public.foods.unit_increment IS 'Incremento permitido (ex: 1 = inteiro, 0.5 = meio). Default: 1';
COMMENT ON COLUMN public.foods.unit_enabled IS 'Se TRUE, permite exibição em unidades. FALSE = sempre exibe em gramas';

-- 2) Adicionar colunas em meal_option_foods para persistir a conversão
ALTER TABLE public.meal_option_foods
ADD COLUMN IF NOT EXISTS display_quantity NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS display_unit TEXT DEFAULT 'g',
ADD COLUMN IF NOT EXISTS calculated_grams NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unit_conversion_locked BOOLEAN DEFAULT FALSE;

-- Comentários
COMMENT ON COLUMN public.meal_option_foods.display_quantity IS 'Quantidade para exibição ao usuário (em unidades ou gramas)';
COMMENT ON COLUMN public.meal_option_foods.display_unit IS 'Unidade de exibição: "g" ou unit_name do alimento';
COMMENT ON COLUMN public.meal_option_foods.calculated_grams IS 'Gramas finais após arredondamento. Fonte de verdade nutricional';
COMMENT ON COLUMN public.meal_option_foods.unit_conversion_locked IS 'Se TRUE, conversão não será reavaliada pela IA. Decisão única e persistida';

-- 3) Adicionar mesmas colunas em meal_foods (para compatibilidade)
ALTER TABLE public.meal_foods
ADD COLUMN IF NOT EXISTS display_quantity NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS display_unit TEXT DEFAULT 'g',
ADD COLUMN IF NOT EXISTS calculated_grams NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unit_conversion_locked BOOLEAN DEFAULT FALSE;

-- 4) Criar função determinística de conversão gramas → unidades
CREATE OR REPLACE FUNCTION public.convert_grams_to_unit(
  _grams NUMERIC,
  _unit_weight_grams NUMERIC,
  _unit_increment NUMERIC,
  _tolerance_percent NUMERIC DEFAULT 5
)
RETURNS TABLE(
  success BOOLEAN,
  display_quantity NUMERIC,
  calculated_grams NUMERIC,
  error_percent NUMERIC,
  fallback_to_grams BOOLEAN
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_raw_units NUMERIC;
  v_rounded_units NUMERIC;
  v_final_grams NUMERIC;
  v_error_percent NUMERIC;
BEGIN
  -- Validações de entrada
  IF _unit_weight_grams IS NULL OR _unit_weight_grams <= 0 THEN
    RETURN QUERY SELECT 
      FALSE,
      _grams,
      _grams,
      0::NUMERIC,
      TRUE;
    RETURN;
  END IF;
  
  IF _unit_increment IS NULL OR _unit_increment <= 0 THEN
    _unit_increment := 1;
  END IF;
  
  -- Calcular quantidade bruta de unidades
  v_raw_units := _grams / _unit_weight_grams;
  
  -- Arredondar para o incremento mais próximo
  v_rounded_units := ROUND(v_raw_units / _unit_increment) * _unit_increment;
  
  -- Garantir mínimo de 1 incremento
  IF v_rounded_units < _unit_increment THEN
    v_rounded_units := _unit_increment;
  END IF;
  
  -- Calcular gramas finais após arredondamento
  v_final_grams := v_rounded_units * _unit_weight_grams;
  
  -- Calcular erro percentual
  v_error_percent := ABS(v_final_grams - _grams) / NULLIF(_grams, 0) * 100;
  
  -- Verificar tolerância
  IF v_error_percent <= _tolerance_percent THEN
    RETURN QUERY SELECT 
      TRUE,
      v_rounded_units,
      v_final_grams,
      v_error_percent,
      FALSE;
  ELSE
    -- Fallback para gramas quando erro excede tolerância
    RETURN QUERY SELECT 
      FALSE,
      _grams,
      _grams,
      v_error_percent,
      TRUE;
  END IF;
END;
$$;

-- 5) Criar função para aplicar conversão a um alimento específico
CREATE OR REPLACE FUNCTION public.apply_unit_conversion(
  _food_id UUID,
  _quantity_grams NUMERIC
)
RETURNS TABLE(
  display_quantity NUMERIC,
  display_unit TEXT,
  calculated_grams NUMERIC,
  conversion_applied BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_food RECORD;
  v_conversion RECORD;
BEGIN
  -- Buscar configuração de unidade do alimento
  SELECT unit_enabled, unit_name, unit_weight_grams, unit_increment
  INTO v_food
  FROM public.foods
  WHERE id = _food_id;
  
  -- Se não tem unidade habilitada, retornar gramas
  IF NOT COALESCE(v_food.unit_enabled, FALSE) OR v_food.unit_name IS NULL THEN
    RETURN QUERY SELECT 
      _quantity_grams,
      'g'::TEXT,
      _quantity_grams,
      FALSE;
    RETURN;
  END IF;
  
  -- Aplicar conversão determinística
  SELECT * INTO v_conversion
  FROM public.convert_grams_to_unit(
    _quantity_grams,
    v_food.unit_weight_grams,
    v_food.unit_increment,
    5 -- tolerância de 5%
  );
  
  IF v_conversion.success THEN
    RETURN QUERY SELECT 
      v_conversion.display_quantity,
      v_food.unit_name,
      v_conversion.calculated_grams,
      TRUE;
  ELSE
    -- Fallback para gramas
    RETURN QUERY SELECT 
      _quantity_grams,
      'g'::TEXT,
      _quantity_grams,
      FALSE;
  END IF;
END;
$$;

-- 6) Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_foods_unit_enabled ON public.foods(unit_enabled) WHERE unit_enabled = TRUE;

-- 7) Popular dados iniciais de unidades comuns (exemplos)
-- Apenas para alimentos que claramente usam unidades naturais
UPDATE public.foods SET
  unit_name = 'unidade',
  unit_weight_grams = 50,
  unit_increment = 1,
  unit_enabled = TRUE
WHERE LOWER(name) LIKE '%ovo%' AND unit_name IS NULL;

UPDATE public.foods SET
  unit_name = 'fatia',
  unit_weight_grams = 25,
  unit_increment = 1,
  unit_enabled = TRUE
WHERE (LOWER(name) LIKE '%pão de forma%' OR LOWER(name) LIKE '%pao de forma%') AND unit_name IS NULL;

UPDATE public.foods SET
  unit_name = 'unidade',
  unit_weight_grams = 120,
  unit_increment = 1,
  unit_enabled = TRUE
WHERE LOWER(name) LIKE '%banana%' AND unit_name IS NULL;

UPDATE public.foods SET
  unit_name = 'unidade',
  unit_weight_grams = 180,
  unit_increment = 1,
  unit_enabled = TRUE
WHERE LOWER(name) LIKE '%maçã%' OR LOWER(name) LIKE '%maca%' AND unit_name IS NULL;

UPDATE public.foods SET
  unit_name = 'unidade',
  unit_weight_grams = 150,
  unit_increment = 1,
  unit_enabled = TRUE
WHERE LOWER(name) LIKE '%laranja%' AND unit_name IS NULL;