-- Add professional_onboarding_completed column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS professional_onboarding_completed boolean DEFAULT false;