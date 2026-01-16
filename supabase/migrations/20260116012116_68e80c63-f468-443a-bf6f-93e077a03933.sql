-- First drop the old constraint
ALTER TABLE public.meals DROP CONSTRAINT IF EXISTS meals_name_check;

-- Update existing 'snack' meals to 'afternoon_snack' for compatibility
UPDATE public.meals SET name = 'afternoon_snack' WHERE name = 'snack';

-- Add new constraint with all 6 meal types
ALTER TABLE public.meals ADD CONSTRAINT meals_name_check 
CHECK (name = ANY (ARRAY['breakfast'::text, 'morning_snack'::text, 'lunch'::text, 'afternoon_snack'::text, 'dinner'::text, 'supper'::text]));