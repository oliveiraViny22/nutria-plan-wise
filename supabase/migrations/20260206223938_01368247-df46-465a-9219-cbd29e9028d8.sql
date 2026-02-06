-- Remove the option_number check constraint to allow more options
ALTER TABLE public.meal_anchor_foods DROP CONSTRAINT IF EXISTS meal_anchor_foods_option_number_check;