-- Add unique constraint on user_id for subscription upsert to work
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);