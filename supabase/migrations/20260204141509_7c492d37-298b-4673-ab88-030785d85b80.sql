-- Adiciona campo para escolha do tipo de refeição noturna única
-- 'dinner' = jantar tradicional (refeição quente)
-- 'supper' = ceia (refeição leve/fria)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_evening_meal TEXT DEFAULT 'dinner' 
CHECK (last_evening_meal IN ('dinner', 'supper'));

COMMENT ON COLUMN public.profiles.last_evening_meal IS 'Tipo de refeição noturna única para usuários com 3-5 refeições/dia: dinner (jantar quente) ou supper (ceia leve)';