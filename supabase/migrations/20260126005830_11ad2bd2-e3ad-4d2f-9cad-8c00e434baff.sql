-- Adicionar coluna 'option' à tabela meal_anchor_foods para suportar distribuição por opção de refeição
ALTER TABLE public.meal_anchor_foods 
ADD COLUMN IF NOT EXISTS option_number integer NOT NULL DEFAULT 1;

-- Adicionar constraint para garantir valores válidos (1, 2 ou 3)
ALTER TABLE public.meal_anchor_foods 
ADD CONSTRAINT meal_anchor_foods_option_number_check CHECK (option_number BETWEEN 1 AND 10);

-- Criar índice para melhorar performance de buscas por tipo de refeição e opção
CREATE INDEX IF NOT EXISTS idx_meal_anchor_foods_meal_type_option 
ON public.meal_anchor_foods(meal_type, option_number);

-- Comentário explicativo
COMMENT ON COLUMN public.meal_anchor_foods.option_number IS 'Número da opção de refeição (1-10). Âncoras com mesmo meal_type mas option_number diferentes permitem diferentes combinações por opção.';