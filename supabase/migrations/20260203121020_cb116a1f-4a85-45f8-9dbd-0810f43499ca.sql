-- Add include_supplements field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS include_supplements boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.include_supplements IS 'Whether to include supplement suggestions in meal plans';