-- Atualizar constraint para aceitar 'draft' como status válido
ALTER TABLE public.diet_plans DROP CONSTRAINT IF EXISTS diet_plans_status_check;
ALTER TABLE public.diet_plans ADD CONSTRAINT diet_plans_status_check 
CHECK (status IN ('draft', 'active', 'archived', 'completed'));