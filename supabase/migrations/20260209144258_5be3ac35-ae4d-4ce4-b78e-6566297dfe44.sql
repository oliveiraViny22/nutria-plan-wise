
-- P0: Add missing columns to subscriptions table for webhook compatibility
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS grace_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_reconciled timestamp with time zone;

-- Create reset_monthly_usage RPC used by stripe-webhook on checkout completion
CREATE OR REPLACE FUNCTION public.reset_monthly_usage(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.user_usage
  SET 
    diets_used = 0,
    substitutions_used = 0,
    adjustments_used = 0,
    chat_messages_today = 0,
    last_chat_reset = CURRENT_DATE,
    period_start = CURRENT_DATE,
    period_end = CURRENT_DATE + INTERVAL '1 month',
    updated_at = now()
  WHERE user_id = _user_id;
END;
$$;
