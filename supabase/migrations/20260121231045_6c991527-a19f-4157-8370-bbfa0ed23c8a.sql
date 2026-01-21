-- =====================================================
-- CHECK CONSTRAINT para foods.category
-- Garante que apenas categorias canônicas sejam aceitas
-- =====================================================

-- Remove constraint antiga se existir
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_category_check;

-- Adiciona CHECK constraint com categorias canônicas
ALTER TABLE public.foods ADD CONSTRAINT foods_category_check 
CHECK (category IN (
  'carboidratos',
  'proteinas',
  'gorduras',
  'vegetais',
  'frutas',
  'laticinios',
  'leguminosas',
  'suplementos',
  'mistos'
));

-- Adiciona comentário explicativo
COMMENT ON CONSTRAINT foods_category_check ON public.foods IS 
'Restringe categorias às 9 categorias canônicas do sistema: carboidratos, proteinas, gorduras, vegetais, frutas, laticinios, leguminosas, suplementos, mistos';