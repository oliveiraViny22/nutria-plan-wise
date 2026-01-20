-- Drop old constraint and add new one with v2 values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_goal_check;

-- Add new constraint with v2 goal values
ALTER TABLE public.profiles ADD CONSTRAINT profiles_goal_check 
CHECK (goal IS NULL OR goal IN ('lose_weight', 'maintain', 'gain_muscle'));