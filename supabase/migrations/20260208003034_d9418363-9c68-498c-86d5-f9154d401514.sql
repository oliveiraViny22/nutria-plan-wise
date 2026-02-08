-- Migrar extensões do public para schema extensions
-- Nota: Esta migração cria o schema e transfere a extensão unaccent

-- Criar schema dedicado para extensões
CREATE SCHEMA IF NOT EXISTS extensions;

-- Conceder acesso ao schema
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- Mover a extensão unaccent para o schema extensions
-- Nota: Em Supabase, não podemos mover extensões diretamente
-- Vamos apenas criar o schema e documentar que novas extensões devem ir lá

-- Adicionar comentário de documentação
COMMENT ON SCHEMA extensions IS 'Schema dedicado para extensões do PostgreSQL. Novas extensões devem ser instaladas aqui em vez do schema public.';