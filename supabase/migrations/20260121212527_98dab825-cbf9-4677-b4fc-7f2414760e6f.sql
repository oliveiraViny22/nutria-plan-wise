-- Corrigir search_path das funções criadas
ALTER FUNCTION public.remove_accents(text) SET search_path = public;
ALTER FUNCTION public.generate_canonical_name(text) SET search_path = public;
ALTER FUNCTION public.set_canonical_name() SET search_path = public;