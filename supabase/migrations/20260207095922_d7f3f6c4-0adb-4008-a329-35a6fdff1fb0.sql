-- Add dietary_profile column to foods table
-- This allows filtering foods by dietary preference (vegan, vegetarian, pescetarian, etc.)
-- NULL or 'standard' means the food is suitable for all users

ALTER TABLE public.foods
ADD COLUMN IF NOT EXISTS dietary_profile TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.foods.dietary_profile IS 
'Dietary profile restriction: vegan, vegetarian, pescetarian, lactose_free, mediterranean, low_carb, or NULL for standard/universal foods';

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_foods_dietary_profile ON public.foods(dietary_profile) WHERE dietary_profile IS NOT NULL;

-- Categorize problematic foods that should be restricted to specific dietary profiles

-- Tofu and soy-based proteins -> vegetarian/vegan only
UPDATE public.foods SET dietary_profile = 'vegetarian' 
WHERE LOWER(name) LIKE '%tofu%' 
   OR LOWER(name) LIKE '%tempeh%'
   OR LOWER(name) LIKE '%seitan%'
   OR LOWER(name) LIKE '%proteína de soja%'
   OR LOWER(name) LIKE '%soja texturizada%';

-- Plant-based milks -> lactose_free/vegan
UPDATE public.foods SET dietary_profile = 'lactose_free'
WHERE LOWER(name) LIKE '%leite de aveia%'
   OR LOWER(name) LIKE '%leite de amêndoa%'
   OR LOWER(name) LIKE '%leite de coco%'
   OR LOWER(name) LIKE '%leite de soja%'
   OR LOWER(name) LIKE '%leite vegetal%'
   OR LOWER(name) LIKE '%bebida vegetal%';

-- Exotic grains typically associated with specific diets
UPDATE public.foods SET dietary_profile = 'vegetarian'
WHERE LOWER(name) LIKE '%painço%'
   OR LOWER(name) LIKE '%amaranto%'
   OR LOWER(name) LIKE '%teff%'
   OR LOWER(name) LIKE '%sorgo%'
   OR LOWER(name) LIKE '%trigo sarraceno%';

-- Ultra-processed meats -> mark for potential filtering (optional: could add processing_level check instead)
-- Note: These stay as NULL (standard) but should be filtered by processing_level in generator

-- Verify the updates
SELECT name, dietary_profile, category 
FROM public.foods 
WHERE dietary_profile IS NOT NULL 
ORDER BY dietary_profile, name
LIMIT 50;