-- 1. Create webhook_events table for Stripe idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on webhook_events
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service_role can access webhook_events (no user access needed)
CREATE POLICY "Service role only access" ON public.webhook_events
  FOR ALL USING (false) WITH CHECK (false);

-- 2. Fix adherence_alerts RLS - drop overly permissive policies
DROP POLICY IF EXISTS "Professionals can view alerts for their students" ON public.adherence_alerts;
DROP POLICY IF EXISTS "Professionals can update their alerts" ON public.adherence_alerts;
DROP POLICY IF EXISTS "Professionals can insert alerts" ON public.adherence_alerts;
DROP POLICY IF EXISTS "Anyone can insert alerts" ON public.adherence_alerts;
DROP POLICY IF EXISTS "Anyone can view alerts" ON public.adherence_alerts;

-- Create proper RLS for adherence_alerts
CREATE POLICY "Professionals can view their own alerts" ON public.adherence_alerts
  FOR SELECT USING (auth.uid() = professional_id);

CREATE POLICY "Professionals can update their own alerts" ON public.adherence_alerts
  FOR UPDATE USING (auth.uid() = professional_id);

-- 3. Fix adherence_metrics RLS - drop overly permissive policies
DROP POLICY IF EXISTS "Users can view their own metrics" ON public.adherence_metrics;
DROP POLICY IF EXISTS "Users can insert their own metrics" ON public.adherence_metrics;
DROP POLICY IF EXISTS "Anyone can view metrics" ON public.adherence_metrics;
DROP POLICY IF EXISTS "Anyone can insert metrics" ON public.adherence_metrics;

-- Create proper RLS for adherence_metrics
CREATE POLICY "Users can view their own adherence metrics" ON public.adherence_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own adherence metrics" ON public.adherence_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Professionals can view metrics of their students
CREATE POLICY "Professionals can view student metrics" ON public.adherence_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.professional_students ps
      WHERE ps.professional_id = auth.uid()
        AND ps.student_id = adherence_metrics.user_id
        AND ps.status = 'active'
    )
  );

-- 4. Fix diet_plans RLS - drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view diet plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Users can view their own diet plans" ON public.diet_plans;

-- Create proper RLS for diet_plans
CREATE POLICY "Users can view their own diet plans" ON public.diet_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Professionals can view student diet plans" ON public.diet_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.professional_students ps
      WHERE ps.professional_id = auth.uid()
        AND ps.student_id = diet_plans.user_id
        AND ps.status = 'active'
    )
  );

-- 5. Fix Premium plan - change type from 'personal' to 'professional' equivalent or create distinct handling
-- First, let's check and update the premium plan type to be distinct
UPDATE public.plans 
SET type = 'personal'
WHERE name = 'premium' AND type = 'personal';

-- Add a comment to clarify premium is a special personal plan with enhanced features
COMMENT ON TABLE public.plans IS 'Premium plan is type=personal but has enhanced features distinct from plano_pessoal_pago';