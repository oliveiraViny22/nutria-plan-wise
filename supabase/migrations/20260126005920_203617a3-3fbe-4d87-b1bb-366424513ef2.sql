-- 1. PRIMEIRO remover constraint existente
ALTER TABLE public.meal_anchor_foods 
DROP CONSTRAINT IF EXISTS meal_anchor_foods_option_number_check;

-- 2. Alterar o valor padrão de option_number para 0 (todas as opções)
ALTER TABLE public.meal_anchor_foods 
ALTER COLUMN option_number SET DEFAULT 0;

-- 3. Atualizar âncoras existentes para usar 0 (compatibilidade retroativa)
UPDATE public.meal_anchor_foods 
SET option_number = 0 
WHERE option_number = 1;

-- 4. Criar nova constraint que permite 0
ALTER TABLE public.meal_anchor_foods 
ADD CONSTRAINT meal_anchor_foods_option_number_check CHECK (option_number BETWEEN 0 AND 10);

-- 5. Comentário atualizado
COMMENT ON COLUMN public.meal_anchor_foods.option_number IS 'Número da opção de refeição. 0 = todas as opções, 1-10 = opção específica.';