
-- ===========================================
-- DATABASE RESET: Keep only admin and foods
-- ===========================================

-- Store admin user_id for preservation
DO $$
DECLARE
    admin_user_id UUID := '8cdd8f22-a342-4425-9ce8-05bd6c3ce9c5';
BEGIN
    -- Delete meal_logs (depends on daily_logs)
    DELETE FROM public.meal_logs WHERE daily_log_id IN (
        SELECT id FROM public.daily_logs WHERE user_id != admin_user_id
    );
    
    -- Delete daily_logs
    DELETE FROM public.daily_logs WHERE user_id != admin_user_id;
    
    -- Delete meal_option_foods (depends on meal_options)
    DELETE FROM public.meal_option_foods WHERE meal_option_id IN (
        SELECT mo.id FROM public.meal_options mo
        JOIN public.meals m ON m.id = mo.meal_id
        JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
        WHERE dp.user_id != admin_user_id
    );
    
    -- Delete meal_options (depends on meals)
    DELETE FROM public.meal_options WHERE meal_id IN (
        SELECT m.id FROM public.meals m
        JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
        WHERE dp.user_id != admin_user_id
    );
    
    -- Delete meals (depends on diet_plans)
    DELETE FROM public.meals WHERE diet_plan_id IN (
        SELECT id FROM public.diet_plans WHERE user_id != admin_user_id
    );
    
    -- Delete diet_plans
    DELETE FROM public.diet_plans WHERE user_id != admin_user_id;
    
    -- Delete professional_students
    DELETE FROM public.professional_students WHERE professional_id != admin_user_id AND student_id != admin_user_id;
    
    -- Delete subscriptions
    DELETE FROM public.subscriptions WHERE user_id != admin_user_id;
    
    -- Delete user_usage
    DELETE FROM public.user_usage WHERE user_id != admin_user_id;
    
    -- Delete user_roles (except admin)
    DELETE FROM public.user_roles WHERE user_id != admin_user_id;
    
    -- Delete profiles (except admin)
    DELETE FROM public.profiles WHERE user_id != admin_user_id;
    
    -- Clear admin audit log (optional - keep for history)
    -- DELETE FROM public.admin_audit_log;
    
    -- Clear AI usage logs
    DELETE FROM public.ai_usage_logs WHERE user_id != admin_user_id;
    
    -- Clear food imports history
    DELETE FROM public.food_imports;
    
    -- Clear webhook events
    DELETE FROM public.webhook_events;
END $$;

-- ===========================================
-- Add RLS policy for users to delete own profile
-- ===========================================

-- Allow users to delete their own profile
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (
    auth.uid() = user_id 
    AND user_id != '8cdd8f22-a342-4425-9ce8-05bd6c3ce9c5'::uuid  -- Protect admin
);

-- Allow users to delete their own roles
DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;
CREATE POLICY "Users can delete own roles" 
ON public.user_roles 
FOR DELETE 
USING (
    auth.uid() = user_id 
    AND user_id != '8cdd8f22-a342-4425-9ce8-05bd6c3ce9c5'::uuid  -- Protect admin
);

-- Allow users to delete their own usage
DROP POLICY IF EXISTS "Users can delete own usage" ON public.user_usage;
CREATE POLICY "Users can delete own usage" 
ON public.user_usage 
FOR DELETE 
USING (auth.uid() = user_id);

-- Allow users to delete their own subscription
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.subscriptions;
CREATE POLICY "Users can delete own subscription" 
ON public.subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);
