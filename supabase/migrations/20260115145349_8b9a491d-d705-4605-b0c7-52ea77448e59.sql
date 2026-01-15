-- 1. Add processing_level column to foods table
ALTER TABLE public.foods 
ADD COLUMN IF NOT EXISTS processing_level text DEFAULT 'in_natura';

-- 2. Migrate ALL legacy categories to new taxonomy
UPDATE public.foods SET category = 'cereais_tubérculos' WHERE category IN ('cereais', 'carboidratos');
UPDATE public.foods SET category = 'proteínas_animais' WHERE category = 'proteínas';
UPDATE public.foods SET category = 'óleos_oleaginosas' WHERE category IN ('oleaginosas', 'gorduras');
UPDATE public.foods SET category = 'leguminosas' WHERE category = 'legumes';
UPDATE public.foods SET category = 'hortaliças_folhosas' WHERE category = 'vegetais';
UPDATE public.foods SET category = 'laticínios' WHERE category = 'laticinios';

-- 3. Add constraint for valid processing levels
ALTER TABLE public.foods 
ADD CONSTRAINT foods_processing_level_check 
CHECK (processing_level IN ('in_natura', 'minimamente_processado', 'processado', 'ultraprocessado', 'suplemento'));

-- 4. Insert supplements (with duplicate check)
INSERT INTO public.foods (name, calories, protein, carbs, fat, serving_size, category, processing_level)
SELECT * FROM (VALUES
  ('Whey Protein Concentrado', 120, 24, 3, 1.5, '30g', 'suplementos', 'suplemento'),
  ('Whey Protein Isolado', 110, 27, 1, 0.5, '30g', 'suplementos', 'suplemento'),
  ('Whey Protein Hidrolisado', 115, 26, 2, 0.5, '30g', 'suplementos', 'suplemento'),
  ('Blend Proteico Animal', 125, 25, 4, 2, '30g', 'suplementos', 'suplemento'),
  ('Blend Proteico Vegetal', 120, 22, 5, 2, '30g', 'suplementos', 'suplemento'),
  ('Blend Proteico Misto', 122, 24, 4, 1.5, '30g', 'suplementos', 'suplemento'),
  ('Proteína Isolada de Ervilha', 110, 24, 2, 1, '30g', 'suplementos', 'suplemento'),
  ('Proteína Isolada de Arroz', 115, 23, 3, 1, '30g', 'suplementos', 'suplemento'),
  ('Proteína Isolada de Soja', 112, 25, 2, 0.5, '30g', 'suplementos', 'suplemento'),
  ('Hipercalórico', 380, 15, 70, 4, '100g', 'suplementos', 'suplemento'),
  ('Maltodextrina', 380, 0, 95, 0, '100g', 'suplementos', 'suplemento'),
  ('Dextrose', 360, 0, 90, 0, '100g', 'suplementos', 'suplemento'),
  ('Creatina Alimentar', 0, 0, 0, 0, '5g', 'suplementos', 'suplemento'),
  ('Bebida Proteica Pronta', 160, 25, 8, 3, '330ml', 'suplementos', 'suplemento')
) AS v(name, calories, protein, carbs, fat, serving_size, category, processing_level)
WHERE NOT EXISTS (SELECT 1 FROM public.foods f WHERE LOWER(f.name) = LOWER(v.name));

-- 5. Add constraint for valid categories (after all migrations)
ALTER TABLE public.foods 
ADD CONSTRAINT foods_category_check 
CHECK (category IN ('frutas', 'hortaliças_folhosas', 'legumes', 'cereais_tubérculos', 'leguminosas', 'proteínas_animais', 'laticínios', 'óleos_oleaginosas', 'suplementos'));