-- Add is_saved column to diet_plans to track if user has explicitly saved their plan
ALTER TABLE public.diet_plans 
ADD COLUMN IF NOT EXISTS is_saved BOOLEAN NOT NULL DEFAULT false;

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.diet_plans.is_saved IS 'Indicates if user has explicitly saved/confirmed their meal plan. Macros and quantities are hidden until saved.';

-- Update existing plans to be considered "saved" (for backward compatibility)
UPDATE public.diet_plans SET is_saved = true WHERE is_saved = false;