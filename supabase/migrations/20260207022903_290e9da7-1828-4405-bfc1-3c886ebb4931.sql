-- =====================================================
-- Segmentação de Âncoras por Perfil Dietético (v5.24)
-- =====================================================

-- Adicionar coluna dietary_profile para segmentar âncoras por tipo de dieta
-- Valores: 'standard' (padrão), 'vegetarian', 'vegan', 'pescatarian', 'mediterranean'
-- NULL = universal (aplica a todos, como era antes)
ALTER TABLE public.meal_anchor_foods 
ADD COLUMN dietary_profile TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.meal_anchor_foods.dietary_profile IS 
'Perfil dietético da âncora: standard (padrão brasileiro), vegetarian, vegan, pescatarian, mediterranean. NULL = universal.';

-- Índice para melhorar consultas por perfil
CREATE INDEX idx_meal_anchor_foods_dietary_profile 
ON public.meal_anchor_foods(dietary_profile) 
WHERE is_active = true;