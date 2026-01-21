-- Atualizar plano gratuito para permitir apenas 1 opção de refeição
UPDATE public.plans 
SET meal_options_limit = 1 
WHERE type = 'gratuito';

-- Adicionar coluna para override de opções por usuário na tabela user_usage
ALTER TABLE public.user_usage 
ADD COLUMN IF NOT EXISTS meal_options_override integer DEFAULT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.user_usage.meal_options_override IS 'Override individual do limite de opções por refeição. NULL = usa o limite do plano.';