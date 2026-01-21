-- Adicionar campos de governança na tabela foods
ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS canonical_name text,
ADD COLUMN IF NOT EXISTS type text DEFAULT 'food' CHECK (type IN ('food', 'supplement')),
ADD COLUMN IF NOT EXISTS origin text DEFAULT 'manual' CHECK (origin IN ('manual', 'ia_estimated', 'imported')),
ADD COLUMN IF NOT EXISTS confidence_level text DEFAULT 'high' CHECK (confidence_level IN ('high', 'medium', 'low')),
ADD COLUMN IF NOT EXISTS is_optional boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by_type text DEFAULT 'system' CHECK (created_by_type IN ('admin', 'professional', 'ai', 'system')),
ADD COLUMN IF NOT EXISTS created_by_id uuid,
ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_foods_canonical_name ON public.foods(canonical_name);
CREATE INDEX IF NOT EXISTS idx_foods_review_status ON public.foods(review_status);
CREATE INDEX IF NOT EXISTS idx_foods_type ON public.foods(type);
CREATE INDEX IF NOT EXISTS idx_foods_is_active ON public.foods(is_active);
CREATE INDEX IF NOT EXISTS idx_foods_origin ON public.foods(origin);

-- Função para remover acentos manualmente (sem depender de unaccent)
CREATE OR REPLACE FUNCTION public.remove_accents(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
AS $$
  SELECT translate(
    input_text,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

-- Função para gerar canonical_name automaticamente
CREATE OR REPLACE FUNCTION public.generate_canonical_name(food_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        public.remove_accents(food_name),
        '[^a-zA-Z0-9\s]', '', 'g'
      ),
      '\s+', '_', 'g'
    )
  );
END;
$$;

-- Trigger para popular canonical_name automaticamente
CREATE OR REPLACE FUNCTION public.set_canonical_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.canonical_name IS NULL OR NEW.canonical_name = '' THEN
    NEW.canonical_name := public.generate_canonical_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_canonical_name ON public.foods;
CREATE TRIGGER trigger_set_canonical_name
  BEFORE INSERT OR UPDATE ON public.foods
  FOR EACH ROW
  EXECUTE FUNCTION public.set_canonical_name();

-- Atualizar alimentos existentes com canonical_name
UPDATE public.foods 
SET canonical_name = public.generate_canonical_name(name)
WHERE canonical_name IS NULL;