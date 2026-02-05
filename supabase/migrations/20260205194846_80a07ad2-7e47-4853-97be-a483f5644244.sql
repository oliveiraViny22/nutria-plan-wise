-- Remove orphan user from auth.users
-- This user's data was partially deleted but the auth record remained
DELETE FROM auth.users WHERE id = 'afae45c2-37c4-431f-bb2c-0a447e9d6266';