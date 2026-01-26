-- Remover view com SECURITY DEFINER (problema de segurança)
DROP VIEW IF EXISTS public.foods_public;

-- Verificar extensões no public schema e mover para extensions
-- As extensões devem estar no schema 'extensions', não no 'public'