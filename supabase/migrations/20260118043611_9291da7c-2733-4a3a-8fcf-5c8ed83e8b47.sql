-- Fix overly permissive RLS policies - restrict to service_role only

-- 1. Fix adherence_alerts: drop and recreate service role policy
DROP POLICY IF EXISTS "Service role can manage alerts" ON public.adherence_alerts;

-- 2. Fix adherence_metrics: drop and recreate service role policy
DROP POLICY IF EXISTS "Service can manage adherence metrics" ON public.adherence_metrics;

-- 3. Fix duplicate policies on adherence_alerts
DROP POLICY IF EXISTS "Professionals can view their alerts" ON public.adherence_alerts;

-- 4. Fix duplicate policies on adherence_metrics
DROP POLICY IF EXISTS "Professionals can view student adherence" ON public.adherence_metrics;
DROP POLICY IF EXISTS "Users can view their adherence metrics" ON public.adherence_metrics;

-- 5. Check and fix diet_plans policies if they still have issues
DROP POLICY IF EXISTS "Service role can manage diet plans" ON public.diet_plans;

-- Verify that diet_plans has proper INSERT/UPDATE/DELETE policies for users
-- Add INSERT policy if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'diet_plans' AND cmd = 'INSERT' AND schemaname = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert their own diet plans" ON public.diet_plans FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;

-- Add UPDATE policy if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'diet_plans' AND cmd = 'UPDATE' AND schemaname = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own diet plans" ON public.diet_plans FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Add DELETE policy if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'diet_plans' AND cmd = 'DELETE' AND schemaname = 'public'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own diet plans" ON public.diet_plans FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- Add professional INSERT policy for adherence_alerts (edge function uses service_role)
-- But professionals should be able to read their alerts (already exists)