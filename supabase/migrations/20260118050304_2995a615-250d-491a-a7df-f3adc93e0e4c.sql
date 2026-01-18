-- Add is_test and must_change_password columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS created_by text;

-- Create index for filtering test data
CREATE INDEX IF NOT EXISTS idx_profiles_is_test ON public.profiles(is_test) WHERE is_test = true;

-- Add comment explaining the columns
COMMENT ON COLUMN public.profiles.is_test IS 'Marks test accounts that should be excluded from production metrics';
COMMENT ON COLUMN public.profiles.must_change_password IS 'Forces user to change password on next login';
COMMENT ON COLUMN public.profiles.created_by IS 'Identifies who/what created the account (e.g., system_test_seed)';