-- Add snack_preference column to profiles table
-- Allows users with 4 meals to choose between morning or afternoon snack
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS snack_preference text DEFAULT 'afternoon_snack';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.snack_preference IS 'For 4 meals/day: morning_snack or afternoon_snack preference';