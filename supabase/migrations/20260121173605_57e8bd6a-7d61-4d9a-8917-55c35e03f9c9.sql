-- Add meal_options_limit column to plans table
-- Free plan: 1 option, Paid plans: 3 options (configurable)
ALTER TABLE public.plans 
ADD COLUMN meal_options_limit integer NOT NULL DEFAULT 3;

-- Update free plan to have only 1 option
UPDATE public.plans 
SET meal_options_limit = 1 
WHERE name = 'gratuito';

-- Update paid personal plan to have 3 options
UPDATE public.plans 
SET meal_options_limit = 3 
WHERE name = 'plano_pessoal_pago';

-- Update professional plan to have 3 options
UPDATE public.plans 
SET meal_options_limit = 3 
WHERE name = 'profissional';

-- Add comment for documentation
COMMENT ON COLUMN public.plans.meal_options_limit IS 'Maximum number of meal options per meal for this plan';