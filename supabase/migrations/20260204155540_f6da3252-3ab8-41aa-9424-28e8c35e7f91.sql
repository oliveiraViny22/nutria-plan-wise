-- =====================================================
-- MIGRAÇÃO: Catálogo de Suplementação Dinâmico
-- =====================================================

-- 1. Adicionar colunas de suplementação à tabela foods
ALTER TABLE public.foods 
ADD COLUMN IF NOT EXISTS is_supplement_item BOOLEAN DEFAULT FALSE;

ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS supplement_portion TEXT DEFAULT NULL;

ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS supplement_notes TEXT DEFAULT NULL;

ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS supplement_min_portion NUMERIC DEFAULT 0.5;

ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS supplement_max_portion NUMERIC DEFAULT 2;

-- 2. Criar índice para busca rápida de itens de suplementação
CREATE INDEX IF NOT EXISTS idx_foods_supplement_items 
ON public.foods (is_supplement_item) 
WHERE is_supplement_item = TRUE;

-- 3. Marcar itens existentes como itens de suplementação (por nome canônico)
-- Suplementos
UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (1 scoop)',
  supplement_notes = 'Alta absorção, ideal pós-treino',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'whey_protein_isolado';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (1 scoop)',
  supplement_notes = 'Custo-benefício, versátil',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'whey_protein_concentrado';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (1 scoop)',
  supplement_notes = 'Liberação lenta (6-8h), ideal antes de dormir',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'caseina';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '40g (2 scoops)',
  supplement_notes = 'Proteína de ovo, absorção média',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'albumina';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g',
  supplement_notes = 'Carboidrato de rápida absorção',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'maltodextrina';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g',
  supplement_notes = 'Recuperação glicogênica imediata',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'dextrose';

-- Alimentos práticos para shakes
UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (2 colheres)',
  supplement_notes = 'Gordura saudável + proteína vegetal',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name LIKE '%pasta%amendoim%' OR name ILIKE '%pasta de amendoim%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (10 unidades)',
  supplement_notes = 'Gordura saudável + minerais',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'castanha_de_caju' OR name ILIKE 'castanha de caju';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '20g (4 unidades)',
  supplement_notes = 'Rica em selênio + gordura saudável',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'castanha_do_para' OR name ILIKE 'castanha do pará';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (6 unidades)',
  supplement_notes = 'Ômega-3 vegetal + antioxidantes',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'nozes' OR name ILIKE 'nozes';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '30g (20 unidades)',
  supplement_notes = 'Vitamina E + magnésio',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'amendoas' OR name ILIKE 'amêndoas';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '100g (1/2 unidade)',
  supplement_notes = 'Gordura monoinsaturada',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'abacate' OR name ILIKE 'abacate';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '1 unidade (100g)',
  supplement_notes = 'Carboidrato de rápida absorção + potássio',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'banana' OR name ILIKE 'banana';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '40g (4 colheres)',
  supplement_notes = 'Fibras + carboidrato complexo',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name LIKE '%aveia%flocos%' OR name ILIKE '%aveia em flocos%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '20g (1 colher)',
  supplement_notes = 'Carboidrato simples natural',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'mel' OR name ILIKE 'mel';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '170g (1 pote)',
  supplement_notes = 'Alto teor proteico + probióticos',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name LIKE '%iogurte%grego%natural%' OR name ILIKE '%iogurte grego natural%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '1 unidade (50g)',
  supplement_notes = 'Proteína completa + gordura',
  supplement_min_portion = 1,
  supplement_max_portion = 3
WHERE canonical_name LIKE '%ovo%cozido%' OR name ILIKE '%ovo cozido%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '100g',
  supplement_notes = 'Alto teor proteico + cálcio',
  supplement_min_portion = 0.5,
  supplement_max_portion = 2
WHERE canonical_name = 'queijo_cottage' OR name ILIKE '%queijo cottage%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '100g',
  supplement_notes = 'Proteína + cálcio',
  supplement_min_portion = 0.5,
  supplement_max_portion = 1.5
WHERE canonical_name = 'ricota' OR name ILIKE 'ricota';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '200ml',
  supplement_notes = 'Base líquida para shakes',
  supplement_min_portion = 0.75,
  supplement_max_portion = 2
WHERE canonical_name LIKE '%leite%desnatado%' OR name ILIKE '%leite desnatado%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '200ml',
  supplement_notes = 'Mais calórico, ideal para ganho de massa',
  supplement_min_portion = 0.75,
  supplement_max_portion = 2
WHERE canonical_name LIKE '%leite%integral%' OR name ILIKE '%leite integral%';

UPDATE public.foods SET 
  is_supplement_item = TRUE,
  supplement_portion = '200ml',
  supplement_notes = 'Baixo em calorias, alternativa vegana',
  supplement_min_portion = 1,
  supplement_max_portion = 2
WHERE canonical_name LIKE '%leite%amendoas%' OR name ILIKE '%leite de amêndoas%';