
-- =============================================
-- NUTRIAPLAN DATABASE V2 - COMPLETE RESET (FIXED)
-- =============================================
-- Removed processing_level CHECK constraint to preserve existing data
-- =============================================

-- 1. DROP EXISTING OBJECTS (in correct order due to dependencies)
-- =============================================

-- Drop existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
DROP TRIGGER IF EXISTS update_diet_plans_updated_at ON public.diet_plans;
DROP TRIGGER IF EXISTS update_daily_logs_updated_at ON public.daily_logs;
DROP TRIGGER IF EXISTS validate_meal_option ON public.meal_options;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_profile() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.validate_meal_option_equivalence() CASCADE;
DROP FUNCTION IF EXISTS public.create_subscription_for_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_subscription() CASCADE;
DROP FUNCTION IF EXISTS public.can_use_feature(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.increment_usage(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_plan(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role) CASCADE;
DROP FUNCTION IF EXISTS public.convert_grams_to_unit(NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.confirm_meal_consumption(UUID, UUID, UUID, TEXT, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.apply_unit_conversion(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_adherence_metrics(UUID, UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.can_create_plan(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_edit_plan(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.check_feature_limit(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_professional_subscription_state(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_access_level(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_student_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_permissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.has_active_license(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.professional_manages_meal(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.professional_manages_meal_option(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reset_monthly_usage(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_meal(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.user_owns_meal_option(UUID, UUID) CASCADE;

-- Drop existing tables (reverse dependency order)
DROP TABLE IF EXISTS public.adherence_report_files CASCADE;
DROP TABLE IF EXISTS public.adherence_alerts CASCADE;
DROP TABLE IF EXISTS public.adherence_alert_configs CASCADE;
DROP TABLE IF EXISTS public.adherence_metrics CASCADE;
DROP TABLE IF EXISTS public.ai_suggestions CASCADE;
DROP TABLE IF EXISTS public.plan_versions CASCADE;
DROP TABLE IF EXISTS public.plan_history CASCADE;
DROP TABLE IF EXISTS public.student_requests CASCADE;
DROP TABLE IF EXISTS public.professional_students CASCADE;
DROP TABLE IF EXISTS public.professional_licenses CASCADE;
DROP TABLE IF EXISTS public.admin_audit_log CASCADE;
DROP TABLE IF EXISTS public.food_imports CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.weight_logs CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.meal_logs CASCADE;
DROP TABLE IF EXISTS public.daily_logs CASCADE;
DROP TABLE IF EXISTS public.meal_option_foods CASCADE;
DROP TABLE IF EXISTS public.meal_foods CASCADE;
DROP TABLE IF EXISTS public.meal_options CASCADE;
DROP TABLE IF EXISTS public.meals CASCADE;
DROP TABLE IF EXISTS public.diet_plans CASCADE;
DROP TABLE IF EXISTS public.webhook_events CASCADE;
DROP TABLE IF EXISTS public.user_usage CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop existing enums (will recreate)
DROP TYPE IF EXISTS public.daily_status CASCADE;
DROP TYPE IF EXISTS public.meal_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.subscription_status CASCADE;
DROP TYPE IF EXISTS public.plan_type CASCADE;
DROP TYPE IF EXISTS public.billing_cycle CASCADE;
DROP TYPE IF EXISTS public.account_type CASCADE;
DROP TYPE IF EXISTS public.user_type CASCADE;
DROP TYPE IF EXISTS public.plan_type_commercial CASCADE;

-- 2. CREATE ENUMS
-- =============================================

CREATE TYPE public.plan_type AS ENUM ('gratuito', 'plano_pessoal_pago', 'profissional');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'professional');
CREATE TYPE public.meal_status AS ENUM ('pending', 'confirmed', 'skipped', 'out_of_plan', 'late_confirmed');
CREATE TYPE public.daily_status AS ENUM ('no_records', 'partial', 'complete');

-- 3. CREATE TABLES
-- =============================================

-- 3.1 PROFILES (user extended data)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    age INTEGER CHECK (age >= 1 AND age <= 120),
    sex TEXT CHECK (sex IN ('M', 'F')),
    weight NUMERIC(5,2) CHECK (weight > 0),
    height NUMERIC(5,2) CHECK (height > 0),
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal TEXT CHECK (goal IN ('lose', 'maintain', 'gain')),
    daily_calories INTEGER CHECK (daily_calories > 0),
    protein_target INTEGER CHECK (protein_target >= 0),
    carbs_target INTEGER CHECK (carbs_target >= 0),
    fat_target INTEGER CHECK (fat_target >= 0),
    meals_per_day INTEGER DEFAULT 4 CHECK (meals_per_day >= 1 AND meals_per_day <= 8),
    restrictions TEXT[],
    preferences TEXT[],
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 PLANS (commercial plans - Stripe integration)
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type public.plan_type NOT NULL,
    description TEXT,
    price_monthly NUMERIC(10,2),
    stripe_product_id TEXT,
    stripe_price_monthly TEXT,
    diet_limit INTEGER NOT NULL DEFAULT 1,
    substitution_limit INTEGER NOT NULL DEFAULT 0,
    adjustment_limit INTEGER NOT NULL DEFAULT 0,
    chat_messages_per_day INTEGER NOT NULL DEFAULT 0,
    has_chat BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 SUBSCRIPTIONS (user subscriptions - Stripe sync)
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
    status public.subscription_status NOT NULL DEFAULT 'trial',
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 USER_ROLES (admin/professional roles)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);

-- 3.5 USER_USAGE (feature limits tracking)
CREATE TABLE public.user_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    diets_used INTEGER NOT NULL DEFAULT 0,
    substitutions_used INTEGER NOT NULL DEFAULT 0,
    adjustments_used INTEGER NOT NULL DEFAULT 0,
    chat_messages_today INTEGER NOT NULL DEFAULT 0,
    last_chat_reset DATE NOT NULL DEFAULT CURRENT_DATE,
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    period_end DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 WEBHOOK_EVENTS (Stripe idempotency)
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 FOODS (nutritional catalog - PRESERVE DATA)
-- First backup existing data
CREATE TEMP TABLE foods_backup AS SELECT * FROM public.foods;

DROP TABLE IF EXISTS public.foods CASCADE;

-- Create foods table WITHOUT processing_level CHECK constraint to preserve existing data
CREATE TABLE public.foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    calories NUMERIC(8,2) NOT NULL CHECK (calories >= 0),
    protein NUMERIC(8,2) NOT NULL CHECK (protein >= 0),
    carbs NUMERIC(8,2) NOT NULL CHECK (carbs >= 0),
    fat NUMERIC(8,2) NOT NULL CHECK (fat >= 0),
    serving_size TEXT DEFAULT '100g',
    unit_name TEXT,
    unit_weight_grams NUMERIC(8,2) CHECK (unit_weight_grams > 0),
    unit_increment NUMERIC(8,2) DEFAULT 1 CHECK (unit_increment > 0),
    unit_enabled BOOLEAN DEFAULT FALSE,
    processing_level TEXT, -- No CHECK constraint to preserve existing data variations
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restore foods data
INSERT INTO public.foods (id, name, category, calories, protein, carbs, fat, serving_size, unit_name, unit_weight_grams, unit_increment, unit_enabled, processing_level, created_at)
SELECT id, name, category, calories, protein, carbs, fat, serving_size, unit_name, unit_weight_grams, unit_increment, unit_enabled, processing_level, COALESCE(created_at, now())
FROM foods_backup;

DROP TABLE foods_backup;

-- 3.8 DIET_PLANS (user meal plans)
CREATE TABLE public.diet_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    total_calories INTEGER NOT NULL CHECK (total_calories > 0),
    total_protein NUMERIC(8,2) NOT NULL CHECK (total_protein >= 0),
    total_carbs NUMERIC(8,2) NOT NULL CHECK (total_carbs >= 0),
    total_fat NUMERIC(8,2) NOT NULL CHECK (total_fat >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9 MEALS (meals within a plan)
CREATE TABLE public.meals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    total_calories NUMERIC(8,2) DEFAULT 0,
    total_protein NUMERIC(8,2) DEFAULT 0,
    total_carbs NUMERIC(8,2) DEFAULT 0,
    total_fat NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.10 MEAL_OPTIONS (alternative options per meal)
CREATE TABLE public.meal_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    option_number INTEGER NOT NULL DEFAULT 1 CHECK (option_number >= 1),
    name TEXT,
    total_calories NUMERIC(8,2) DEFAULT 0,
    total_protein NUMERIC(8,2) DEFAULT 0,
    total_carbs NUMERIC(8,2) DEFAULT 0,
    total_fat NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(meal_id, option_number)
);

-- 3.11 MEAL_OPTION_FOODS (foods in each option)
CREATE TABLE public.meal_option_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meal_option_id UUID NOT NULL REFERENCES public.meal_options(id) ON DELETE CASCADE,
    food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
    quantity_grams NUMERIC(8,2) NOT NULL CHECK (quantity_grams > 0),
    display_quantity NUMERIC(8,2),
    display_unit TEXT,
    calculated_grams NUMERIC(8,2),
    unit_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 DAILY_LOGS (daily adherence tracking)
CREATE TABLE public.daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    status public.daily_status NOT NULL DEFAULT 'no_records',
    total_calories_consumed NUMERIC(8,2) DEFAULT 0,
    total_protein_consumed NUMERIC(8,2) DEFAULT 0,
    total_carbs_consumed NUMERIC(8,2) DEFAULT 0,
    total_fat_consumed NUMERIC(8,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, log_date)
);

-- 3.13 MEAL_LOGS (meal confirmation tracking)
CREATE TABLE public.meal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    confirmed_option_id UUID REFERENCES public.meal_options(id) ON DELETE SET NULL,
    status public.meal_status NOT NULL DEFAULT 'pending',
    confirmed_at TIMESTAMPTZ,
    calories_consumed NUMERIC(8,2) DEFAULT 0,
    protein_consumed NUMERIC(8,2) DEFAULT 0,
    carbs_consumed NUMERIC(8,2) DEFAULT 0,
    fat_consumed NUMERIC(8,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(daily_log_id, meal_id)
);

-- 4. CREATE INDEXES
-- =============================================

CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status) WHERE status IN ('active', 'trial');
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX idx_foods_category ON public.foods(category);
CREATE INDEX idx_foods_name ON public.foods(name);
CREATE UNIQUE INDEX idx_diet_plans_one_active ON public.diet_plans(user_id) WHERE status = 'active';
CREATE INDEX idx_diet_plans_user_id ON public.diet_plans(user_id);
CREATE INDEX idx_meals_diet_plan_id ON public.meals(diet_plan_id);
CREATE INDEX idx_meal_options_meal_id ON public.meal_options(meal_id);
CREATE INDEX idx_meal_option_foods_meal_option_id ON public.meal_option_foods(meal_option_id);
CREATE INDEX idx_meal_option_foods_food_id ON public.meal_option_foods(food_id);
CREATE INDEX idx_daily_logs_user_date ON public.daily_logs(user_id, log_date);
CREATE INDEX idx_daily_logs_diet_plan_id ON public.daily_logs(diet_plan_id);
CREATE INDEX idx_meal_logs_daily_log_id ON public.meal_logs(daily_log_id);
CREATE INDEX idx_webhook_events_event_id ON public.webhook_events(event_id);

-- 5. ENABLE RLS
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_option_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- 6. CREATE RLS POLICIES
-- =============================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to profiles" ON public.profiles
    FOR ALL USING (auth.role() = 'service_role');

-- PLANS (public read)
CREATE POLICY "Anyone can view active plans" ON public.plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Service role full access to plans" ON public.plans
    FOR ALL USING (auth.role() = 'service_role');

-- SUBSCRIPTIONS
CREATE POLICY "Users can view own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to subscriptions" ON public.subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- USER_ROLES
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to user_roles" ON public.user_roles
    FOR ALL USING (auth.role() = 'service_role');

-- USER_USAGE
CREATE POLICY "Users can view own usage" ON public.user_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON public.user_usage
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to user_usage" ON public.user_usage
    FOR ALL USING (auth.role() = 'service_role');

-- FOODS (public read)
CREATE POLICY "Anyone can view foods" ON public.foods
    FOR SELECT USING (true);

CREATE POLICY "Service role full access to foods" ON public.foods
    FOR ALL USING (auth.role() = 'service_role');

-- DIET_PLANS
CREATE POLICY "Users can view own diet plans" ON public.diet_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diet plans" ON public.diet_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diet plans" ON public.diet_plans
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diet plans" ON public.diet_plans
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to diet_plans" ON public.diet_plans
    FOR ALL USING (auth.role() = 'service_role');

-- MEALS
CREATE POLICY "Users can view own meals" ON public.meals
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.diet_plans dp 
            WHERE dp.id = meals.diet_plan_id 
            AND dp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own meals" ON public.meals
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.diet_plans dp 
            WHERE dp.id = meals.diet_plan_id 
            AND dp.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to meals" ON public.meals
    FOR ALL USING (auth.role() = 'service_role');

-- MEAL_OPTIONS
CREATE POLICY "Users can view own meal options" ON public.meal_options
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.meals m
            JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
            WHERE m.id = meal_options.meal_id 
            AND dp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own meal options" ON public.meal_options
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.meals m
            JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
            WHERE m.id = meal_options.meal_id 
            AND dp.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to meal_options" ON public.meal_options
    FOR ALL USING (auth.role() = 'service_role');

-- MEAL_OPTION_FOODS
CREATE POLICY "Users can view own meal option foods" ON public.meal_option_foods
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.meal_options mo
            JOIN public.meals m ON m.id = mo.meal_id
            JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
            WHERE mo.id = meal_option_foods.meal_option_id 
            AND dp.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own meal option foods" ON public.meal_option_foods
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.meal_options mo
            JOIN public.meals m ON m.id = mo.meal_id
            JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
            WHERE mo.id = meal_option_foods.meal_option_id 
            AND dp.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to meal_option_foods" ON public.meal_option_foods
    FOR ALL USING (auth.role() = 'service_role');

-- DAILY_LOGS
CREATE POLICY "Users can view own daily logs" ON public.daily_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own daily logs" ON public.daily_logs
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to daily_logs" ON public.daily_logs
    FOR ALL USING (auth.role() = 'service_role');

-- MEAL_LOGS
CREATE POLICY "Users can view own meal logs" ON public.meal_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.daily_logs dl 
            WHERE dl.id = meal_logs.daily_log_id 
            AND dl.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own meal logs" ON public.meal_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.daily_logs dl 
            WHERE dl.id = meal_logs.daily_log_id 
            AND dl.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to meal_logs" ON public.meal_logs
    FOR ALL USING (auth.role() = 'service_role');

-- WEBHOOK_EVENTS (service role only)
CREATE POLICY "Service role full access to webhook_events" ON public.webhook_events
    FOR ALL USING (auth.role() = 'service_role');

-- 7. CREATE FUNCTIONS
-- =============================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Handle new user (create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    -- Get free plan
    SELECT id INTO free_plan_id FROM public.plans WHERE type = 'gratuito' LIMIT 1;
    
    -- Create subscription (only if free plan exists)
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
        VALUES (NEW.id, free_plan_id, 'trial', now(), now() + INTERVAL '30 days');
    END IF;
    
    -- Create usage tracking
    INSERT INTO public.user_usage (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. CREATE TRIGGERS
-- =============================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_diet_plans_updated_at
    BEFORE UPDATE ON public.diet_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_logs_updated_at
    BEFORE UPDATE ON public.daily_logs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_usage_updated_at
    BEFORE UPDATE ON public.user_usage
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. INSERT DEFAULT PLANS
-- =============================================

INSERT INTO public.plans (name, type, description, price_monthly, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, has_chat, is_active)
VALUES 
    ('Gratuito', 'gratuito', 'Plano gratuito com funcionalidades básicas', 0, 1, 0, 0, 0, false, true),
    ('Plano Pessoal', 'plano_pessoal_pago', 'Plano pago com todas as funcionalidades', 29.90, 999, 999, 999, 50, true, true),
    ('Profissional', 'profissional', 'Plano para nutricionistas (dormant)', 99.90, 999, 999, 999, 999, true, false);

-- 10. HELPER FUNCTIONS
-- =============================================

-- Check if user can use a feature based on plan limits
CREATE OR REPLACE FUNCTION public.can_use_feature(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan RECORD;
    v_usage RECORD;
BEGIN
    -- Get user's plan
    SELECT p.* INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_plan IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get user's usage
    SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
    
    IF v_usage IS NULL THEN
        RETURN TRUE; -- No usage record means first use
    END IF;
    
    -- Check limits based on feature
    CASE _feature
        WHEN 'diet' THEN
            RETURN v_usage.diets_used < v_plan.diet_limit;
        WHEN 'substitution' THEN
            RETURN v_usage.substitutions_used < v_plan.substitution_limit;
        WHEN 'adjustment' THEN
            RETURN v_usage.adjustments_used < v_plan.adjustment_limit;
        WHEN 'chat' THEN
            IF NOT v_plan.has_chat THEN
                RETURN FALSE;
            END IF;
            IF v_usage.last_chat_reset < CURRENT_DATE THEN
                RETURN TRUE; -- Reset for new day
            END IF;
            RETURN v_usage.chat_messages_today < v_plan.chat_messages_per_day;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Increment usage counter
CREATE OR REPLACE FUNCTION public.increment_usage(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Ensure usage record exists
    INSERT INTO public.user_usage (user_id)
    VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    -- Increment the appropriate counter
    CASE _feature
        WHEN 'diet' THEN
            UPDATE public.user_usage SET diets_used = diets_used + 1, updated_at = now() WHERE user_id = _user_id;
        WHEN 'substitution' THEN
            UPDATE public.user_usage SET substitutions_used = substitutions_used + 1, updated_at = now() WHERE user_id = _user_id;
        WHEN 'adjustment' THEN
            UPDATE public.user_usage SET adjustments_used = adjustments_used + 1, updated_at = now() WHERE user_id = _user_id;
        WHEN 'chat' THEN
            UPDATE public.user_usage 
            SET chat_messages_today = CASE 
                WHEN last_chat_reset < CURRENT_DATE THEN 1 
                ELSE chat_messages_today + 1 
            END,
            last_chat_reset = CURRENT_DATE,
            updated_at = now()
            WHERE user_id = _user_id;
        ELSE
            RETURN FALSE;
    END CASE;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Get user's current plan info
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id UUID)
RETURNS TABLE(
    plan_id UUID,
    plan_name TEXT,
    plan_type public.plan_type,
    subscription_status public.subscription_status,
    diet_limit INTEGER,
    substitution_limit INTEGER,
    adjustment_limit INTEGER,
    chat_messages_per_day INTEGER,
    has_chat BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.type,
        s.status,
        p.diet_limit,
        p.substitution_limit,
        p.adjustment_limit,
        p.chat_messages_per_day,
        p.has_chat
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Unit conversion helper
CREATE OR REPLACE FUNCTION public.convert_grams_to_unit(
    _grams NUMERIC,
    _unit_weight_grams NUMERIC,
    _unit_increment NUMERIC,
    _tolerance_percent NUMERIC DEFAULT 5
)
RETURNS TABLE(
    success BOOLEAN,
    display_quantity NUMERIC,
    calculated_grams NUMERIC,
    error_percent NUMERIC,
    fallback_to_grams BOOLEAN
) AS $$
DECLARE
    v_raw_units NUMERIC;
    v_rounded_units NUMERIC;
    v_final_grams NUMERIC;
    v_error_percent NUMERIC;
BEGIN
    -- Validations
    IF _unit_weight_grams IS NULL OR _unit_weight_grams <= 0 THEN
        RETURN QUERY SELECT FALSE, _grams, _grams, 0::NUMERIC, TRUE;
        RETURN;
    END IF;
    
    IF _unit_increment IS NULL OR _unit_increment <= 0 THEN
        _unit_increment := 1;
    END IF;
    
    -- Calculate raw units
    v_raw_units := _grams / _unit_weight_grams;
    
    -- Round to nearest increment
    v_rounded_units := ROUND(v_raw_units / _unit_increment) * _unit_increment;
    
    -- Ensure minimum of 1 increment
    IF v_rounded_units < _unit_increment THEN
        v_rounded_units := _unit_increment;
    END IF;
    
    -- Calculate final grams
    v_final_grams := v_rounded_units * _unit_weight_grams;
    
    -- Calculate error percentage
    v_error_percent := ABS(v_final_grams - _grams) / NULLIF(_grams, 0) * 100;
    
    -- Check tolerance
    IF v_error_percent <= _tolerance_percent THEN
        RETURN QUERY SELECT TRUE, v_rounded_units, v_final_grams, v_error_percent, FALSE;
    ELSE
        RETURN QUERY SELECT FALSE, _grams, _grams, v_error_percent, TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- Confirm meal consumption
CREATE OR REPLACE FUNCTION public.confirm_meal_consumption(
    _user_id UUID,
    _meal_id UUID,
    _option_id UUID,
    _status TEXT,
    _log_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
    v_daily_log_id UUID;
    v_diet_plan_id UUID;
    v_option_macros RECORD;
    v_meal_status public.meal_status;
BEGIN
    -- Validate status
    v_meal_status := _status::public.meal_status;
    
    -- Get diet plan
    SELECT dp.id INTO v_diet_plan_id
    FROM public.meals m
    JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
    WHERE m.id = _meal_id AND dp.user_id = _user_id;
    
    IF v_diet_plan_id IS NULL THEN
        RAISE EXCEPTION 'Meal not found or does not belong to user';
    END IF;
    
    -- Create or get daily log
    INSERT INTO public.daily_logs (user_id, diet_plan_id, log_date, status)
    VALUES (_user_id, v_diet_plan_id, _log_date, 'partial')
    ON CONFLICT (user_id, log_date) 
    DO UPDATE SET updated_at = now()
    RETURNING id INTO v_daily_log_id;
    
    -- Get option macros if confirmed
    IF _option_id IS NOT NULL AND v_meal_status = 'confirmed' THEN
        SELECT total_calories, total_protein, total_carbs, total_fat
        INTO v_option_macros
        FROM public.meal_options WHERE id = _option_id;
    END IF;
    
    -- Upsert meal log
    INSERT INTO public.meal_logs (
        daily_log_id, meal_id, confirmed_option_id, status, confirmed_at,
        calories_consumed, protein_consumed, carbs_consumed, fat_consumed
    ) VALUES (
        v_daily_log_id, _meal_id,
        CASE WHEN v_meal_status IN ('confirmed', 'late_confirmed') THEN _option_id ELSE NULL END,
        v_meal_status,
        CASE WHEN v_meal_status != 'pending' THEN now() ELSE NULL END,
        COALESCE(v_option_macros.total_calories, 0),
        COALESCE(v_option_macros.total_protein, 0),
        COALESCE(v_option_macros.total_carbs, 0),
        COALESCE(v_option_macros.total_fat, 0)
    )
    ON CONFLICT (daily_log_id, meal_id)
    DO UPDATE SET
        confirmed_option_id = EXCLUDED.confirmed_option_id,
        status = EXCLUDED.status,
        confirmed_at = EXCLUDED.confirmed_at,
        calories_consumed = EXCLUDED.calories_consumed,
        protein_consumed = EXCLUDED.protein_consumed,
        carbs_consumed = EXCLUDED.carbs_consumed,
        fat_consumed = EXCLUDED.fat_consumed;
    
    -- Update daily totals
    UPDATE public.daily_logs SET
        total_calories_consumed = (
            SELECT COALESCE(SUM(calories_consumed), 0) FROM public.meal_logs WHERE daily_log_id = v_daily_log_id
        ),
        total_protein_consumed = (
            SELECT COALESCE(SUM(protein_consumed), 0) FROM public.meal_logs WHERE daily_log_id = v_daily_log_id
        ),
        total_carbs_consumed = (
            SELECT COALESCE(SUM(carbs_consumed), 0) FROM public.meal_logs WHERE daily_log_id = v_daily_log_id
        ),
        total_fat_consumed = (
            SELECT COALESCE(SUM(fat_consumed), 0) FROM public.meal_logs WHERE daily_log_id = v_daily_log_id
        ),
        status = CASE 
            WHEN NOT EXISTS (SELECT 1 FROM public.meal_logs WHERE daily_log_id = v_daily_log_id AND status = 'pending')
            THEN 'complete'
            ELSE 'partial'
        END,
        updated_at = now()
    WHERE id = v_daily_log_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'daily_log_id', v_daily_log_id,
        'status', v_meal_status::TEXT
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
