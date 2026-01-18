-- Drop the existing check constraints and recreate with new values
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_category_check;
ALTER TABLE public.foods DROP CONSTRAINT IF EXISTS foods_processing_level_check;

-- Add new check constraint for category with both new and legacy values
ALTER TABLE public.foods ADD CONSTRAINT foods_category_check CHECK (
  category IS NULL OR category IN (
    'Carboidratos', 'Proteínas', 'Gorduras', 'Frutas', 'Vegetais',
    'Leguminosas', 'Laticínios', 'Suplementos', 'Mistos',
    'frutas', 'hortaliças_folhosas', 'legumes', 'cereais_tubérculos',
    'leguminosas', 'proteínas_animais', 'laticínios', 'óleos_oleaginosas', 'suplementos'
  )
);

-- Add new check constraint for processing_level with both new and legacy values
ALTER TABLE public.foods ADD CONSTRAINT foods_processing_level_check CHECK (
  processing_level IS NULL OR processing_level IN (
    'In natura', 'Minimamente processado', 'Processado', 'Ultraprocessado', 'Suplemento',
    'in_natura', 'minimamente_processado', 'processado', 'ultraprocessado', 'suplemento'
  )
);