-- Adicionar campos para alimentos preferidos e evitados no perfil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_foods TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS avoided_foods TEXT[] DEFAULT '{}';