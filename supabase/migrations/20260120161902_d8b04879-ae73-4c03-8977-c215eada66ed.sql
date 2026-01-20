-- Drop old constraint and add new one with v2 values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sex_check;

-- Add new constraint with v2 sex values
ALTER TABLE public.profiles ADD CONSTRAINT profiles_sex_check 
CHECK (sex IS NULL OR sex IN ('male', 'female', 'other'));