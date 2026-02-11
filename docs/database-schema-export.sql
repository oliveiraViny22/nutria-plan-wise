-- =============================================
-- NutriaPlan Database Schema Export (COMPLETO v2)
-- Generated: 2026-02-10
-- Supabase Project: iplgqpnwfgnqaaeqxnrx
-- Inclui: Enums, Tabelas, Índices, Constraints Únicos,
--         Funções, Triggers, RLS Policies, Storage
-- =============================================
-- ORDEM DE EXECUÇÃO:
--   1. Enums
--   2. Tabelas (com FKs)
--   3. Índices e Constraints Únicos
--   4. Funções
--   5. Triggers (public + auth)
--   6. RLS (ENABLE + Policies)
--   7. Storage Buckets
-- =============================================

-- =============================================
-- 1. ENUMS
-- =============================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'professional');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'daily_status') THEN
    CREATE TYPE public.daily_status AS ENUM ('no_records', 'partial', 'complete');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_status') THEN
    CREATE TYPE public.meal_status AS ENUM ('pending', 'confirmed', 'skipped', 'out_of_plan', 'late_confirmed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_type') THEN
    CREATE TYPE public.plan_type AS ENUM ('gratuito', 'plano_pessoal_pago', 'profissional');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');
  END IF;
END $$;

-- =============================================
-- 2. TABELAS (com Foreign Keys)
-- =============================================

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    email TEXT,
    name TEXT,
    age INTEGER,
    sex TEXT,
    weight NUMERIC,
    height NUMERIC,
    activity_level TEXT,
    goal TEXT,
    daily_calories INTEGER,
    protein_target INTEGER,
    carbs_target INTEGER,
    fat_target INTEGER,
    meals_per_day INTEGER DEFAULT 4,
    preferences TEXT[],
    restrictions TEXT[],
    preferred_foods TEXT[] DEFAULT '{}',
    avoided_foods TEXT[] DEFAULT '{}',
    include_supplements BOOLEAN DEFAULT FALSE,
    snack_preference TEXT DEFAULT 'afternoon_snack',
    evening_meal_preference TEXT DEFAULT 'no_preference',
    last_evening_meal TEXT DEFAULT 'dinner',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    objective_change_count INTEGER NOT NULL DEFAULT 0,
    objective_locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Plans (subscription tiers)
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type public.plan_type NOT NULL,
    description TEXT,
    price_monthly NUMERIC,
    diet_limit INTEGER NOT NULL DEFAULT 1,
    substitution_limit INTEGER NOT NULL DEFAULT 0,
    adjustment_limit INTEGER NOT NULL DEFAULT 0,
    chat_messages_per_day INTEGER NOT NULL DEFAULT 0,
    has_chat BOOLEAN NOT NULL DEFAULT FALSE,
    meal_options_limit INTEGER NOT NULL DEFAULT 3,
    stripe_product_id TEXT,
    stripe_price_monthly TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    status public.subscription_status NOT NULL DEFAULT 'trial',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    grace_period_end TIMESTAMP WITH TIME ZONE,
    last_reconciled TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- User Usage (limits tracking)
CREATE TABLE IF NOT EXISTS public.user_usage (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id),
    diets_used INTEGER NOT NULL DEFAULT 0,
    substitutions_used INTEGER NOT NULL DEFAULT 0,
    adjustments_used INTEGER NOT NULL DEFAULT 0,
    chat_messages_today INTEGER NOT NULL DEFAULT 0,
    last_chat_reset DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_options_override INTEGER,
    period_start DATE NOT NULL DEFAULT CURRENT_DATE,
    period_end DATE NOT NULL DEFAULT (CURRENT_DATE + '1 mon'::INTERVAL),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Foods catalog
CREATE TABLE IF NOT EXISTS public.foods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    canonical_name TEXT,
    category TEXT NOT NULL,
    calories NUMERIC NOT NULL,
    protein NUMERIC NOT NULL,
    carbs NUMERIC NOT NULL,
    fat NUMERIC NOT NULL,
    serving_size TEXT DEFAULT '100g',
    type TEXT DEFAULT 'food',
    dietary_profile TEXT,
    origin TEXT DEFAULT 'manual',
    confidence_level TEXT DEFAULT 'high',
    review_status TEXT DEFAULT 'approved',
    is_active BOOLEAN DEFAULT TRUE,
    is_optional BOOLEAN DEFAULT FALSE,
    is_supplement_item BOOLEAN DEFAULT FALSE,
    supplement_portion TEXT,
    supplement_notes TEXT,
    supplement_min_portion NUMERIC DEFAULT 0.5,
    supplement_max_portion NUMERIC DEFAULT 2,
    unit_enabled BOOLEAN DEFAULT FALSE,
    unit_name TEXT,
    unit_weight_grams NUMERIC,
    unit_increment NUMERIC DEFAULT 1,
    created_by_type TEXT DEFAULT 'system',
    created_by_id UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Diet Plans
CREATE TABLE IF NOT EXISTS public.diet_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    status TEXT NOT NULL DEFAULT 'active',
    total_calories INTEGER NOT NULL,
    total_protein NUMERIC NOT NULL,
    total_carbs NUMERIC NOT NULL,
    total_fat NUMERIC NOT NULL,
    is_saved BOOLEAN NOT NULL DEFAULT FALSE,
    objective_change_count INTEGER NOT NULL DEFAULT 0,
    objective_locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meals
CREATE TABLE IF NOT EXISTS public.meals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    total_calories NUMERIC DEFAULT 0,
    total_protein NUMERIC DEFAULT 0,
    total_carbs NUMERIC DEFAULT 0,
    total_fat NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Options
CREATE TABLE IF NOT EXISTS public.meal_options (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    option_number INTEGER NOT NULL DEFAULT 1,
    name TEXT,
    total_calories NUMERIC DEFAULT 0,
    total_protein NUMERIC DEFAULT 0,
    total_carbs NUMERIC DEFAULT 0,
    total_fat NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (meal_id, option_number)
);

-- Meal Option Foods
CREATE TABLE IF NOT EXISTS public.meal_option_foods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_option_id UUID NOT NULL REFERENCES public.meal_options(id) ON DELETE CASCADE,
    food_id UUID NOT NULL REFERENCES public.foods(id),
    quantity_grams NUMERIC NOT NULL,
    display_quantity NUMERIC,
    display_unit TEXT,
    calculated_grams NUMERIC,
    unit_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Daily Logs
CREATE TABLE IF NOT EXISTS public.daily_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id),
    log_date DATE NOT NULL,
    status public.daily_status NOT NULL DEFAULT 'no_records',
    total_calories_consumed NUMERIC DEFAULT 0,
    total_protein_consumed NUMERIC DEFAULT 0,
    total_carbs_consumed NUMERIC DEFAULT 0,
    total_fat_consumed NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, log_date)
);

-- Meal Logs
CREATE TABLE IF NOT EXISTS public.meal_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
    meal_id UUID NOT NULL REFERENCES public.meals(id),
    status public.meal_status NOT NULL DEFAULT 'pending',
    confirmed_option_id UUID REFERENCES public.meal_options(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    calories_consumed NUMERIC DEFAULT 0,
    protein_consumed NUMERIC DEFAULT 0,
    carbs_consumed NUMERIC DEFAULT 0,
    fat_consumed NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (daily_log_id, meal_id)
);

-- Weight Logs
CREATE TABLE IF NOT EXISTS public.weight_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    weight_kg NUMERIC NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, log_date)
);

-- Body Measurements
CREATE TABLE IF NOT EXISTS public.body_measurements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    waist_cm NUMERIC,
    hip_cm NUMERIC,
    chest_cm NUMERIC,
    arm_cm NUMERIC,
    thigh_cm NUMERIC,
    calf_cm NUMERIC,
    body_fat_percent NUMERIC,
    recorded_by UUID REFERENCES public.profiles(user_id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, measurement_date)
);

-- Professional Students
CREATE TABLE IF NOT EXISTS public.professional_students (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id),
    student_id UUID NOT NULL REFERENCES public.profiles(user_id),
    status TEXT NOT NULL DEFAULT 'pending',
    student_confirmed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (professional_id, student_id)
);

-- Objective Change Policies
CREATE TABLE IF NOT EXISTS public.objective_change_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_type TEXT NOT NULL,
    change_number INTEGER NOT NULL,
    cooldown_days INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (profile_type, change_number)
);

-- Objective Change Requests
CREATE TABLE IF NOT EXISTS public.objective_change_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    current_goal TEXT NOT NULL,
    requested_goal TEXT NOT NULL,
    justification TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    professional_response TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Templates
CREATE TABLE IF NOT EXISTS public.meal_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    description TEXT,
    min_items INTEGER NOT NULL DEFAULT 2,
    max_items INTEGER NOT NULL DEFAULT 6,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Template Roles
CREATE TABLE IF NOT EXISTS public.meal_template_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES public.meal_templates(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    min_quantity_grams INTEGER NOT NULL DEFAULT 50,
    max_quantity_grams INTEGER NOT NULL DEFAULT 300,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Role Food Categories
CREATE TABLE IF NOT EXISTS public.meal_role_food_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES public.meal_template_roles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Anchor Foods (1092 âncoras ativas)
CREATE TABLE IF NOT EXISTS public.meal_anchor_foods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_type TEXT NOT NULL,
    food_id UUID NOT NULL REFERENCES public.foods(id),
    role_name TEXT NOT NULL,
    option_number INTEGER NOT NULL DEFAULT 0,
    goal_type TEXT,
    dietary_profile TEXT,
    default_quantity_grams INTEGER NOT NULL DEFAULT 100,
    sort_order INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: uma âncora por meal_type + option + food + goal
CREATE UNIQUE INDEX IF NOT EXISTS meal_anchor_foods_unique_per_goal 
ON public.meal_anchor_foods (meal_type, option_number, food_id, goal_type);

-- Meal Contextual Blocks
CREATE TABLE IF NOT EXISTS public.meal_contextual_blocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_type TEXT NOT NULL,
    food_id UUID REFERENCES public.foods(id),
    keyword TEXT,
    rule_type TEXT NOT NULL DEFAULT 'block',
    scope TEXT NOT NULL DEFAULT 'specific',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Food Block Overrides
CREATE TABLE IF NOT EXISTS public.food_block_overrides (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    food_id UUID NOT NULL UNIQUE REFERENCES public.foods(id),
    is_unblocked BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Food Imports
CREATE TABLE IF NOT EXISTS public.food_imports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    imported_by UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- System Settings
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin Audit Log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Usage Logs
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    function_name TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC DEFAULT 0,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Conversion Events
CREATE TABLE IF NOT EXISTS public.conversion_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    feature_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook Events
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 3. ÍNDICES
-- =============================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- plans (name UNIQUE já criado inline)

-- subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status) WHERE (status = ANY (ARRAY['active'::subscription_status, 'trial'::subscription_status]));

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);

-- user_usage
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON public.user_usage (user_id);

-- foods
CREATE INDEX IF NOT EXISTS idx_foods_name ON public.foods (name);
CREATE INDEX IF NOT EXISTS idx_foods_canonical_name ON public.foods (canonical_name);
CREATE INDEX IF NOT EXISTS idx_foods_category ON public.foods (category);
CREATE INDEX IF NOT EXISTS idx_foods_type ON public.foods (type);
CREATE INDEX IF NOT EXISTS idx_foods_is_active ON public.foods (is_active);
CREATE INDEX IF NOT EXISTS idx_foods_origin ON public.foods (origin);
CREATE INDEX IF NOT EXISTS idx_foods_review_status ON public.foods (review_status);
CREATE INDEX IF NOT EXISTS idx_foods_dietary_profile ON public.foods (dietary_profile) WHERE (dietary_profile IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_foods_supplement_items ON public.foods (is_supplement_item) WHERE (is_supplement_item = true);

-- diet_plans
CREATE INDEX IF NOT EXISTS idx_diet_plans_user_id ON public.diet_plans (user_id);
CREATE INDEX IF NOT EXISTS idx_diet_plans_user_status ON public.diet_plans (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_diet_plans_one_active ON public.diet_plans (user_id) WHERE (status = 'active');

-- meals
CREATE INDEX IF NOT EXISTS idx_meals_diet_plan_id ON public.meals (diet_plan_id);

-- meal_options
CREATE INDEX IF NOT EXISTS idx_meal_options_meal_id ON public.meal_options (meal_id);

-- meal_option_foods
CREATE INDEX IF NOT EXISTS idx_meal_option_foods_meal_option_id ON public.meal_option_foods (meal_option_id);
CREATE INDEX IF NOT EXISTS idx_meal_option_foods_food_id ON public.meal_option_foods (food_id);

-- daily_logs
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs (user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_daily_logs_diet_plan_id ON public.daily_logs (diet_plan_id);

-- meal_logs
CREATE INDEX IF NOT EXISTS idx_meal_logs_daily_log_id ON public.meal_logs (daily_log_id);

-- body_measurements
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON public.body_measurements (user_id, measurement_date DESC);

-- professional_students
CREATE INDEX IF NOT EXISTS idx_professional_students_professional_id ON public.professional_students (professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_students_student_id ON public.professional_students (student_id);
CREATE INDEX IF NOT EXISTS idx_professional_students_status ON public.professional_students (status);
CREATE INDEX IF NOT EXISTS idx_professional_students_student_confirmed ON public.professional_students (student_confirmed);

-- weight_logs
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON public.weight_logs (user_id, log_date DESC);

-- meal_templates
CREATE INDEX IF NOT EXISTS idx_meal_templates_meal_type ON public.meal_templates (meal_type) WHERE (is_active = true);

-- meal_template_roles
CREATE INDEX IF NOT EXISTS idx_meal_template_roles_template ON public.meal_template_roles (template_id);

-- meal_role_food_categories
CREATE INDEX IF NOT EXISTS idx_meal_role_food_categories_role ON public.meal_role_food_categories (role_id);

-- meal_anchor_foods
CREATE INDEX IF NOT EXISTS idx_meal_anchor_foods_meal_type ON public.meal_anchor_foods (meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_anchor_foods_meal_type_option ON public.meal_anchor_foods (meal_type, option_number);
CREATE INDEX IF NOT EXISTS idx_meal_anchor_foods_active ON public.meal_anchor_foods (is_active) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_meal_anchor_foods_goal_type ON public.meal_anchor_foods (goal_type) WHERE (goal_type IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_meal_anchor_foods_dietary_profile ON public.meal_anchor_foods (dietary_profile) WHERE (is_active = true);

-- meal_contextual_blocks
CREATE INDEX IF NOT EXISTS idx_meal_contextual_blocks_meal_type ON public.meal_contextual_blocks (meal_type) WHERE (is_active = true);
CREATE INDEX IF NOT EXISTS idx_meal_contextual_blocks_food_id ON public.meal_contextual_blocks (food_id) WHERE (food_id IS NOT NULL);

-- food_block_overrides
CREATE INDEX IF NOT EXISTS idx_food_block_overrides_food_id ON public.food_block_overrides (food_id);
CREATE INDEX IF NOT EXISTS idx_food_block_overrides_unblocked ON public.food_block_overrides (is_unblocked) WHERE (is_unblocked = true);

-- food_imports
CREATE INDEX IF NOT EXISTS idx_food_imports_status ON public.food_imports (status);
CREATE INDEX IF NOT EXISTS idx_food_imports_created_at ON public.food_imports (created_at DESC);

-- admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_id ON public.admin_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON public.admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);

-- ai_usage_logs
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_function ON public.ai_usage_logs (function_name);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs (created_at DESC);

-- conversion_events
CREATE INDEX IF NOT EXISTS idx_conversion_events_user ON public.conversion_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversion_events_feature ON public.conversion_events (feature_key, created_at DESC);

-- webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events (event_id);

-- =============================================
-- 4. FUNÇÕES
-- =============================================

-- Remove accents from text
CREATE OR REPLACE FUNCTION public.remove_accents(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE STRICT
SET search_path = public
AS $$
  SELECT translate(
    input_text,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiioooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

-- Generate canonical name for foods
CREATE OR REPLACE FUNCTION public.generate_canonical_name(food_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        public.remove_accents(food_name),
        '[^a-zA-Z0-9\s]', '', 'g'
      ),
      '\s+', '_', 'g'
    )
  );
END;
$$;

-- Set canonical name trigger function
CREATE OR REPLACE FUNCTION public.set_canonical_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.canonical_name IS NULL OR NEW.canonical_name = '' THEN
    NEW.canonical_name := public.generate_canonical_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$$;

-- Update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Check if user has role (SECURITY DEFINER - evita recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
END;
$$;

-- Get user plan
CREATE OR REPLACE FUNCTION public.get_user_plan(_user_id UUID)
RETURNS TABLE(
    plan_id UUID,
    plan_name TEXT,
    plan_type plan_type,
    subscription_status subscription_status,
    diet_limit INTEGER,
    substitution_limit INTEGER,
    adjustment_limit INTEGER,
    chat_messages_per_day INTEGER,
    has_chat BOOLEAN,
    meal_options_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as plan_id,
    p.name as plan_name,
    p.type as plan_type,
    COALESCE(s.status, 'trial'::subscription_status) as subscription_status,
    p.diet_limit,
    p.substitution_limit,
    p.adjustment_limit,
    p.chat_messages_per_day,
    p.has_chat,
    p.meal_options_limit
  FROM subscriptions s
  JOIN plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      p.id as plan_id,
      p.name as plan_name,
      p.type as plan_type,
      'trial'::subscription_status as subscription_status,
      p.diet_limit,
      p.substitution_limit,
      p.adjustment_limit,
      p.chat_messages_per_day,
      p.has_chat,
      p.meal_options_limit
    FROM plans p
    WHERE p.type = 'gratuito'
      AND p.is_active = true
    LIMIT 1;
  END IF;
END;
$$;

-- Check if user can use feature
CREATE OR REPLACE FUNCTION public.can_use_feature(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_usage RECORD;
BEGIN
    IF public.has_role(_user_id, 'admin'::app_role) THEN
        RETURN TRUE;
    END IF;

    SELECT p.* INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_plan IS NULL THEN
        SELECT * INTO v_plan 
        FROM public.plans 
        WHERE type = 'gratuito' AND is_active = true 
        LIMIT 1;
    END IF;
    
    IF v_plan IS NULL THEN
        RETURN FALSE;
    END IF;
    
    SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
    
    IF v_usage IS NULL THEN
        INSERT INTO public.user_usage (user_id, diets_used, substitutions_used, adjustments_used, chat_messages_today, last_chat_reset)
        VALUES (_user_id, 0, 0, 0, 0, CURRENT_DATE)
        ON CONFLICT (user_id) DO NOTHING;
        RETURN TRUE;
    END IF;
    
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
                UPDATE public.user_usage 
                SET chat_messages_today = 0, last_chat_reset = CURRENT_DATE 
                WHERE user_id = _user_id;
                RETURN TRUE;
            END IF;
            RETURN v_usage.chat_messages_today < v_plan.chat_messages_per_day;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

-- Get usage info
CREATE OR REPLACE FUNCTION public.get_usage_info(_user_id UUID, _feature TEXT)
RETURNS TABLE(current_usage INTEGER, max_limit INTEGER, allowed BOOLEAN)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_usage RECORD;
    v_current integer;
    v_max integer;
BEGIN
    IF public.has_role(_user_id, 'admin'::app_role) THEN
        SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
        CASE _feature
            WHEN 'diet' THEN v_current := COALESCE(v_usage.diets_used, 0);
            WHEN 'substitution' THEN v_current := COALESCE(v_usage.substitutions_used, 0);
            WHEN 'adjustment' THEN v_current := COALESCE(v_usage.adjustments_used, 0);
            WHEN 'chat' THEN
                IF v_usage IS NOT NULL AND v_usage.last_chat_reset < CURRENT_DATE THEN
                    v_current := 0;
                ELSE
                    v_current := COALESCE(v_usage.chat_messages_today, 0);
                END IF;
            ELSE v_current := 0;
        END CASE;
        RETURN QUERY SELECT v_current, 999999, TRUE;
        RETURN;
    END IF;

    SELECT p.* INTO v_plan
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = _user_id
    AND s.status IN ('active', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;
    
    IF v_plan IS NULL THEN
        SELECT * INTO v_plan FROM public.plans WHERE type = 'gratuito' AND is_active = true LIMIT 1;
    END IF;
    
    SELECT * INTO v_usage FROM public.user_usage WHERE user_id = _user_id;
    
    CASE _feature
        WHEN 'diet' THEN
            v_current := COALESCE(v_usage.diets_used, 0);
            v_max := COALESCE(v_plan.diet_limit, 0);
        WHEN 'substitution' THEN
            v_current := COALESCE(v_usage.substitutions_used, 0);
            v_max := COALESCE(v_plan.substitution_limit, 0);
        WHEN 'adjustment' THEN
            v_current := COALESCE(v_usage.adjustments_used, 0);
            v_max := COALESCE(v_plan.adjustment_limit, 0);
        WHEN 'chat' THEN
            IF v_usage IS NOT NULL AND v_usage.last_chat_reset < CURRENT_DATE THEN
                v_current := 0;
            ELSE
                v_current := COALESCE(v_usage.chat_messages_today, 0);
            END IF;
            v_max := COALESCE(v_plan.chat_messages_per_day, 0);
        ELSE
            v_current := 0;
            v_max := 0;
    END CASE;
    
    RETURN QUERY SELECT v_current, v_max, (v_current < v_max AND (v_plan.has_chat OR _feature != 'chat'));
END;
$$;

-- Increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_usage (user_id)
    VALUES (_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
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
$$;

-- Reset monthly usage
CREATE OR REPLACE FUNCTION public.reset_monthly_usage(_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Calculate nutritional targets (Mifflin-St Jeor)
CREATE OR REPLACE FUNCTION public.calculate_nutritional_targets(_user_id UUID, _goal TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile profiles%ROWTYPE;
  _bmr numeric;
  _tdee numeric;
  _calories integer;
  _protein integer;
  _carbs integer;
  _fat integer;
  _activity_multiplier numeric;
  _calorie_adjustment integer;
  _weight numeric;
  _protein_per_kg numeric;
  _fat_ratio numeric;
BEGIN
  SELECT * INTO _profile FROM profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Profile not found');
  END IF;

  _weight := COALESCE(_profile.weight, 70);

  IF _profile.sex = 'male' THEN
    _bmr := 10 * _weight + 6.25 * COALESCE(_profile.height, 170) - 5 * COALESCE(_profile.age, 30) + 5;
  ELSE
    _bmr := 10 * _weight + 6.25 * COALESCE(_profile.height, 160) - 5 * COALESCE(_profile.age, 30) - 161;
  END IF;

  _activity_multiplier := CASE _profile.activity_level
    WHEN 'sedentary' THEN 1.2
    WHEN 'light' THEN 1.375
    WHEN 'moderate' THEN 1.55
    WHEN 'active' THEN 1.725
    WHEN 'very_active' THEN 1.9
    ELSE 1.55
  END;

  _tdee := _bmr * _activity_multiplier;

  _calorie_adjustment := CASE _goal
    WHEN 'lose_weight' THEN -500
    WHEN 'maintain' THEN 0
    WHEN 'gain_muscle' THEN 300
    ELSE 0
  END;

  _calories := ROUND(_tdee + _calorie_adjustment);

  _protein_per_kg := CASE _goal
    WHEN 'gain_muscle' THEN 2.0
    WHEN 'lose_weight' THEN 2.0
    WHEN 'maintain' THEN 1.4
    ELSE 1.4
  END;

  _protein := ROUND(_weight * _protein_per_kg);
  IF _protein > ROUND(_weight * 3.0) THEN
    _protein := ROUND(_weight * 3.0);
  END IF;

  _fat_ratio := CASE _goal
    WHEN 'gain_muscle' THEN 0.20
    WHEN 'lose_weight' THEN 0.30
    WHEN 'maintain' THEN 0.25
    ELSE 0.25
  END;

  _fat := ROUND((_calories * _fat_ratio) / 9);
  _carbs := ROUND((_calories - (_protein * 4) - (_fat * 9)) / 4);
  IF _carbs < 50 THEN _carbs := 50; END IF;

  RETURN json_build_object(
    'calories', _calories,
    'protein', _protein,
    'carbs', _carbs,
    'fat', _fat,
    'bmr', ROUND(_bmr),
    'tdee', ROUND(_tdee)
  );
END;
$$;

-- Check objective change eligibility
CREATE OR REPLACE FUNCTION public.check_objective_change_eligibility(_user_id UUID)
RETURNS TABLE(can_change BOOLEAN, locked_until TIMESTAMP WITH TIME ZONE, next_cooldown_days INTEGER, change_count INTEGER, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_user_plan RECORD;
    v_policy RECORD;
    v_is_student BOOLEAN;
    v_change_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM professional_students 
        WHERE student_id = _user_id AND status = 'active'
    ) INTO v_is_student;
    
    IF v_is_student THEN
        RETURN QUERY SELECT FALSE::BOOLEAN, NULL::TIMESTAMP WITH TIME ZONE, NULL::INTEGER, 0::INTEGER, 'Alunos devem solicitar alteração ao profissional'::TEXT;
        RETURN;
    END IF;
    
    SELECT objective_change_count, objective_locked_until INTO v_profile FROM profiles WHERE user_id = _user_id;
    v_change_count := COALESCE(v_profile.objective_change_count, 0);
    
    SELECT * INTO v_user_plan FROM get_user_plan(_user_id);
    
    IF v_user_plan.plan_type = 'gratuito' THEN
        RETURN QUERY SELECT FALSE::BOOLEAN, NULL::TIMESTAMP WITH TIME ZONE, NULL::INTEGER, v_change_count, 'Plano gratuito não permite alteração de objetivo'::TEXT;
        RETURN;
    END IF;
    
    IF v_profile.objective_locked_until IS NOT NULL AND v_profile.objective_locked_until > now() THEN
        SELECT cooldown_days INTO v_policy FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT AND change_number = v_change_count + 1
        ORDER BY change_number LIMIT 1;
        
        RETURN QUERY SELECT FALSE::BOOLEAN, v_profile.objective_locked_until, COALESCE(v_policy.cooldown_days, 90)::INTEGER, v_change_count, 'Em período de cooldown'::TEXT;
        RETURN;
    END IF;
    
    SELECT cooldown_days INTO v_policy FROM objective_change_policies
    WHERE profile_type = v_user_plan.plan_type::TEXT AND change_number = v_change_count + 1
    ORDER BY change_number LIMIT 1;
    
    IF v_policy IS NULL THEN
        SELECT cooldown_days INTO v_policy FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT ORDER BY change_number DESC LIMIT 1;
    END IF;
    
    RETURN QUERY SELECT TRUE::BOOLEAN, NULL::TIMESTAMP WITH TIME ZONE, COALESCE(v_policy.cooldown_days, 90)::INTEGER, v_change_count, 'Alteração permitida'::TEXT;
END;
$$;

-- Apply objective change
CREATE OR REPLACE FUNCTION public.apply_objective_change(_user_id UUID, _new_goal TEXT, _keep_plan_active BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eligibility RECORD;
    v_old_plan RECORD;
    v_policy RECORD;
    v_user_plan RECORD;
    v_profile RECORD;
    v_new_locked_until TIMESTAMP WITH TIME ZONE;
    v_new_change_count INTEGER;
    v_targets JSON;
BEGIN
    SELECT * INTO v_eligibility FROM check_objective_change_eligibility(_user_id);
    
    IF NOT v_eligibility.can_change THEN
        RETURN jsonb_build_object('success', FALSE, 'error', v_eligibility.reason, 'locked_until', v_eligibility.locked_until);
    END IF;
    
    SELECT objective_change_count, objective_locked_until INTO v_profile FROM profiles WHERE user_id = _user_id;
    SELECT * INTO v_old_plan FROM diet_plans WHERE user_id = _user_id AND status = 'active' ORDER BY created_at DESC LIMIT 1;
    SELECT * INTO v_user_plan FROM get_user_plan(_user_id);
    
    v_new_change_count := COALESCE(v_profile.objective_change_count, 0) + 1;
    
    SELECT cooldown_days INTO v_policy FROM objective_change_policies
    WHERE profile_type = v_user_plan.plan_type::TEXT AND change_number = v_new_change_count
    ORDER BY change_number LIMIT 1;
    
    IF v_policy IS NULL THEN
        SELECT cooldown_days INTO v_policy FROM objective_change_policies
        WHERE profile_type = v_user_plan.plan_type::TEXT ORDER BY change_number DESC LIMIT 1;
    END IF;
    
    v_new_locked_until := now() + (COALESCE(v_policy.cooldown_days, 90) || ' days')::INTERVAL;
    v_targets := calculate_nutritional_targets(_user_id, _new_goal);
    
    IF v_old_plan IS NOT NULL AND NOT _keep_plan_active THEN
        UPDATE diet_plans SET status = 'inactive', updated_at = now() WHERE id = v_old_plan.id;
    END IF;
    
    UPDATE profiles
    SET goal = _new_goal,
        daily_calories = (v_targets->>'calories')::INTEGER,
        protein_target = (v_targets->>'protein')::INTEGER,
        carbs_target = (v_targets->>'carbs')::INTEGER,
        fat_target = (v_targets->>'fat')::INTEGER,
        objective_change_count = v_new_change_count,
        objective_locked_until = v_new_locked_until,
        updated_at = now()
    WHERE user_id = _user_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Objetivo alterado com sucesso.',
        'new_goal', _new_goal,
        'previous_change_count', v_new_change_count - 1,
        'new_change_count', v_new_change_count,
        'next_locked_until', v_new_locked_until,
        'cooldown_days', COALESCE(v_policy.cooldown_days, 90),
        'targets', v_targets,
        'plan_kept_active', _keep_plan_active
    );
END;
$$;

-- Confirm meal consumption (atômico: meal_log + daily_log)
CREATE OR REPLACE FUNCTION public.confirm_meal_consumption(
    _user_id UUID, _meal_id UUID, _option_id UUID, _status TEXT, _log_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _diet_plan_id UUID;
  _daily_log_id UUID;
  _meal_log_id UUID;
  _option_data RECORD;
  _total_meals INT;
  _confirmed_meals INT;
  _new_daily_status daily_status;
  _meal_status_value meal_status;
BEGIN
  _meal_status_value := _status::meal_status;
  SELECT diet_plan_id INTO _diet_plan_id FROM meals WHERE id = _meal_id;
  IF _diet_plan_id IS NULL THEN RAISE EXCEPTION 'Meal not found'; END IF;

  INSERT INTO daily_logs (user_id, diet_plan_id, log_date, status)
  VALUES (_user_id, _diet_plan_id, _log_date, 'no_records'::daily_status)
  ON CONFLICT (user_id, log_date) DO NOTHING;

  SELECT id INTO _daily_log_id FROM daily_logs WHERE user_id = _user_id AND log_date = _log_date;

  IF _option_id IS NOT NULL THEN
    SELECT total_calories, total_protein, total_carbs, total_fat INTO _option_data FROM meal_options WHERE id = _option_id;
  END IF;

  SELECT id INTO _meal_log_id FROM meal_logs WHERE daily_log_id = _daily_log_id AND meal_id = _meal_id;

  IF _meal_log_id IS NULL THEN
    INSERT INTO meal_logs (daily_log_id, meal_id, status, confirmed_option_id, confirmed_at, calories_consumed, protein_consumed, carbs_consumed, fat_consumed)
    VALUES (_daily_log_id, _meal_id, _meal_status_value, _option_id,
      CASE WHEN _meal_status_value IN ('confirmed', 'late_confirmed') THEN NOW() ELSE NULL END,
      COALESCE(_option_data.total_calories, 0), COALESCE(_option_data.total_protein, 0),
      COALESCE(_option_data.total_carbs, 0), COALESCE(_option_data.total_fat, 0))
    RETURNING id INTO _meal_log_id;
  ELSE
    UPDATE meal_logs SET status = _meal_status_value, confirmed_option_id = _option_id,
      confirmed_at = CASE WHEN _meal_status_value IN ('confirmed', 'late_confirmed') THEN NOW() ELSE confirmed_at END,
      calories_consumed = COALESCE(_option_data.total_calories, 0), protein_consumed = COALESCE(_option_data.total_protein, 0),
      carbs_consumed = COALESCE(_option_data.total_carbs, 0), fat_consumed = COALESCE(_option_data.total_fat, 0)
    WHERE id = _meal_log_id;
  END IF;

  SELECT COUNT(*) INTO _total_meals FROM meals WHERE diet_plan_id = _diet_plan_id;
  SELECT COUNT(*) INTO _confirmed_meals FROM meal_logs WHERE daily_log_id = _daily_log_id AND status != 'pending';

  IF _confirmed_meals = 0 THEN _new_daily_status := 'no_records'::daily_status;
  ELSIF _confirmed_meals >= _total_meals THEN _new_daily_status := 'complete'::daily_status;
  ELSE _new_daily_status := 'partial'::daily_status;
  END IF;

  UPDATE daily_logs SET status = _new_daily_status,
    total_calories_consumed = (SELECT COALESCE(SUM(calories_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    total_protein_consumed = (SELECT COALESCE(SUM(protein_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    total_carbs_consumed = (SELECT COALESCE(SUM(carbs_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    total_fat_consumed = (SELECT COALESCE(SUM(fat_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    updated_at = NOW()
  WHERE id = _daily_log_id;

  RETURN json_build_object('success', true, 'daily_log_id', _daily_log_id, 'meal_log_id', _meal_log_id, 'status', _meal_status_value::text, 'daily_status', _new_daily_status::text);
END;
$$;

-- Convert grams to unit
CREATE OR REPLACE FUNCTION public.convert_grams_to_unit(
    _grams NUMERIC, _unit_weight_grams NUMERIC, _unit_increment NUMERIC, _tolerance_percent NUMERIC DEFAULT 5
)
RETURNS TABLE(success BOOLEAN, display_quantity NUMERIC, calculated_grams NUMERIC, error_percent NUMERIC, fallback_to_grams BOOLEAN)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_raw_units NUMERIC;
    v_rounded_units NUMERIC;
    v_final_grams NUMERIC;
    v_error_percent NUMERIC;
BEGIN
    IF _unit_weight_grams IS NULL OR _unit_weight_grams <= 0 THEN
        RETURN QUERY SELECT FALSE, _grams, _grams, 0::NUMERIC, TRUE;
        RETURN;
    END IF;
    IF _unit_increment IS NULL OR _unit_increment <= 0 THEN _unit_increment := 1; END IF;
    
    v_raw_units := _grams / _unit_weight_grams;
    v_rounded_units := ROUND(v_raw_units / _unit_increment) * _unit_increment;
    IF v_rounded_units < _unit_increment THEN v_rounded_units := _unit_increment; END IF;
    v_final_grams := v_rounded_units * _unit_weight_grams;
    v_error_percent := ABS(v_final_grams - _grams) / NULLIF(_grams, 0) * 100;
    
    IF v_error_percent <= _tolerance_percent THEN
        RETURN QUERY SELECT TRUE, v_rounded_units, v_final_grams, v_error_percent, FALSE;
    ELSE
        RETURN QUERY SELECT FALSE, _grams, _grams, v_error_percent, TRUE;
    END IF;
END;
$$;

-- Get feature flag
CREATE OR REPLACE FUNCTION public.get_feature_flag(_flag_key TEXT, _default_value BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value FROM system_settings WHERE key = _flag_key AND category = 'feature_flags';
  IF v_value IS NULL THEN RETURN _default_value; END IF;
  IF v_value::text = 'true' OR v_value::text = '"true"' THEN RETURN true;
  ELSIF v_value::text = 'false' OR v_value::text = '"false"' THEN RETURN false;
  ELSE RETURN _default_value;
  END IF;
END;
$$;

-- Get rollout percent
CREATE OR REPLACE FUNCTION public.get_rollout_percent(_flag_key TEXT, _default_value INTEGER DEFAULT 0)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_value JSONB;
BEGIN
  SELECT value INTO v_value FROM system_settings WHERE key = _flag_key AND category = 'feature_flags';
  IF v_value IS NULL THEN RETURN _default_value; END IF;
  BEGIN RETURN (v_value::text)::integer;
  EXCEPTION WHEN OTHERS THEN RETURN _default_value;
  END;
END;
$$;

-- Is user in rollout
CREATE OR REPLACE FUNCTION public.is_in_rollout(_user_id UUID, _flag_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_percent integer;
  v_user_bucket integer;
BEGIN
  v_percent := get_rollout_percent(_flag_key, 0);
  IF v_percent <= 0 THEN RETURN false; END IF;
  IF v_percent >= 100 THEN RETURN true; END IF;
  v_user_bucket := abs(('x' || substr(_user_id::text, 1, 8))::bit(32)::integer) % 100;
  RETURN v_user_bucket < v_percent;
END;
$$;

-- Can view supplements
CREATE OR REPLACE FUNCTION public.can_view_supplements(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    has_role(_user_id, 'admin'::app_role)
    OR has_role(_user_id, 'professional'::app_role)
    OR EXISTS (
      SELECT 1 FROM subscriptions s
      JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = _user_id AND s.status IN ('active', 'trial') AND p.type != 'gratuito'
    )
  )
$$;

-- Can view food
CREATE OR REPLACE FUNCTION public.can_view_food(_user_id UUID, _food_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM foods f
    WHERE f.id = _food_id
    AND (
      (f.review_status = 'approved' AND f.is_active = true AND (f.type != 'supplement' OR can_view_supplements(_user_id)))
      OR has_role(_user_id, 'admin'::app_role)
      OR (f.created_by_type = 'professional' AND f.created_by_id = _user_id AND has_role(_user_id, 'professional'::app_role))
    )
  )
$$;

-- Get visible foods for user
CREATE OR REPLACE FUNCTION public.get_visible_foods_for_user(_user_id UUID)
RETURNS SETOF foods
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.* FROM foods f
  WHERE (f.review_status = 'approved' AND f.is_active = true)
    AND (f.type != 'supplement' OR can_view_supplements(_user_id))
  UNION
  SELECT f.* FROM foods f
  WHERE f.created_by_type = 'professional' AND f.created_by_id = _user_id
    AND f.review_status = 'pending' AND has_role(_user_id, 'professional'::app_role)
$$;

-- Handle new user (trigger function para auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    INSERT INTO public.profiles (user_id, email) VALUES (NEW.id, NEW.email);
    SELECT id INTO free_plan_id FROM public.plans WHERE type = 'gratuito' LIMIT 1;
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
        VALUES (NEW.id, free_plan_id, 'trial', now(), now() + INTERVAL '30 days');
    END IF;
    INSERT INTO public.user_usage (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

-- Handle subscription upgrade
CREATE OR REPLACE FUNCTION public.handle_subscription_upgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_plan_type TEXT;
    v_new_plan_type TEXT;
BEGIN
    IF OLD.plan_id = NEW.plan_id THEN RETURN NEW; END IF;
    SELECT type::TEXT INTO v_old_plan_type FROM plans WHERE id = OLD.plan_id;
    SELECT type::TEXT INTO v_new_plan_type FROM plans WHERE id = NEW.plan_id;
    IF v_old_plan_type = 'gratuito' AND v_new_plan_type != 'gratuito' THEN
        PERFORM reset_monthly_usage(NEW.user_id);
    END IF;
    RETURN NEW;
END;
$$;

-- =============================================
-- 5. TRIGGERS
-- =============================================

-- auth.users → cria profile + subscription + usage
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- foods → canonical_name automático
DROP TRIGGER IF EXISTS trigger_set_canonical_name ON public.foods;
CREATE TRIGGER trigger_set_canonical_name
    BEFORE INSERT OR UPDATE ON public.foods
    FOR EACH ROW EXECUTE FUNCTION public.set_canonical_name();

-- subscriptions → reset usage ao fazer upgrade
DROP TRIGGER IF EXISTS on_subscription_upgrade ON public.subscriptions;
CREATE TRIGGER on_subscription_upgrade
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_upgrade();

-- updated_at automático em todas as tabelas com updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_usage_updated_at ON public.user_usage;
CREATE TRIGGER update_user_usage_updated_at
    BEFORE UPDATE ON public.user_usage
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_diet_plans_updated_at ON public.diet_plans;
CREATE TRIGGER update_diet_plans_updated_at
    BEFORE UPDATE ON public.diet_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_logs_updated_at ON public.daily_logs;
CREATE TRIGGER update_daily_logs_updated_at
    BEFORE UPDATE ON public.daily_logs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_professional_students_updated_at ON public.professional_students;
CREATE TRIGGER update_professional_students_updated_at
    BEFORE UPDATE ON public.professional_students
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_objective_change_policies_updated_at ON public.objective_change_policies;
CREATE TRIGGER update_objective_change_policies_updated_at
    BEFORE UPDATE ON public.objective_change_policies
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_objective_change_requests_updated_at ON public.objective_change_requests;
CREATE TRIGGER update_objective_change_requests_updated_at
    BEFORE UPDATE ON public.objective_change_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_templates_updated_at ON public.meal_templates;
CREATE TRIGGER update_meal_templates_updated_at
    BEFORE UPDATE ON public.meal_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_anchor_foods_updated_at ON public.meal_anchor_foods;
CREATE TRIGGER update_meal_anchor_foods_updated_at
    BEFORE UPDATE ON public.meal_anchor_foods
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meal_contextual_blocks_updated_at ON public.meal_contextual_blocks;
CREATE TRIGGER update_meal_contextual_blocks_updated_at
    BEFORE UPDATE ON public.meal_contextual_blocks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_food_block_overrides_updated_at ON public.food_block_overrides;
CREATE TRIGGER update_food_block_overrides_updated_at
    BEFORE UPDATE ON public.food_block_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS em todas as tabelas
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
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_change_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_template_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_role_food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_anchor_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_contextual_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_block_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - PROFILES
-- =============================================
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
CREATE POLICY "Users can delete own profile" ON public.profiles FOR DELETE USING (auth.uid() = user_id AND user_id != '8cdd8f22-a342-4425-9ce8-05bd6c3ce9c5'::uuid);
DROP POLICY IF EXISTS "Service role full access to profiles" ON public.profiles;
CREATE POLICY "Service role full access to profiles" ON public.profiles FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - PLANS
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view active plans" ON public.plans;
CREATE POLICY "Authenticated users can view active plans" ON public.plans FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Service role full access to plans" ON public.plans;
CREATE POLICY "Service role full access to plans" ON public.plans FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - SUBSCRIPTIONS
-- =============================================
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own subscription" ON public.subscriptions;
CREATE POLICY "Users can delete own subscription" ON public.subscriptions FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access to subscriptions" ON public.subscriptions;
CREATE POLICY "Service role full access to subscriptions" ON public.subscriptions FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - USER ROLES
-- =============================================
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own roles" ON public.user_roles;
CREATE POLICY "Users can delete own roles" ON public.user_roles FOR DELETE USING (auth.uid() = user_id AND user_id != '8cdd8f22-a342-4425-9ce8-05bd6c3ce9c5'::uuid);
DROP POLICY IF EXISTS "Service role full access to user_roles" ON public.user_roles;
CREATE POLICY "Service role full access to user_roles" ON public.user_roles FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - USER USAGE
-- =============================================
DROP POLICY IF EXISTS "Users can view own usage" ON public.user_usage;
CREATE POLICY "Users can view own usage" ON public.user_usage FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own usage" ON public.user_usage;
CREATE POLICY "Users can insert own usage" ON public.user_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own usage" ON public.user_usage;
CREATE POLICY "Users can update own usage" ON public.user_usage FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own usage" ON public.user_usage;
CREATE POLICY "Users can delete own usage" ON public.user_usage FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access to user_usage" ON public.user_usage;
CREATE POLICY "Service role full access to user_usage" ON public.user_usage FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - FOODS
-- =============================================
DROP POLICY IF EXISTS "Anyone can view foods" ON public.foods;
CREATE POLICY "Anyone can view foods" ON public.foods FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can insert foods" ON public.foods;
CREATE POLICY "Admins can insert foods" ON public.foods FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update foods" ON public.foods;
CREATE POLICY "Admins can update foods" ON public.foods FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can delete foods" ON public.foods;
CREATE POLICY "Admins can delete foods" ON public.foods FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to foods" ON public.foods;
CREATE POLICY "Service role full access to foods" ON public.foods FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - DIET PLANS
-- =============================================
DROP POLICY IF EXISTS "Users can view own diet plans" ON public.diet_plans;
CREATE POLICY "Users can view own diet plans" ON public.diet_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own diet plans" ON public.diet_plans;
CREATE POLICY "Users can insert own diet plans" ON public.diet_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own diet plans" ON public.diet_plans;
CREATE POLICY "Users can update own diet plans" ON public.diet_plans FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own diet plans" ON public.diet_plans;
CREATE POLICY "Users can delete own diet plans" ON public.diet_plans FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access to diet_plans" ON public.diet_plans;
CREATE POLICY "Service role full access to diet_plans" ON public.diet_plans FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - MEALS
-- =============================================
DROP POLICY IF EXISTS "Users can view own meals" ON public.meals;
CREATE POLICY "Users can view own meals" ON public.meals FOR SELECT USING (EXISTS (SELECT 1 FROM diet_plans dp WHERE dp.id = meals.diet_plan_id AND dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage own meals" ON public.meals;
CREATE POLICY "Users can manage own meals" ON public.meals FOR ALL USING (EXISTS (SELECT 1 FROM diet_plans dp WHERE dp.id = meals.diet_plan_id AND dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access to meals" ON public.meals;
CREATE POLICY "Service role full access to meals" ON public.meals FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - MEAL OPTIONS
-- =============================================
DROP POLICY IF EXISTS "Users can view own meal options" ON public.meal_options;
CREATE POLICY "Users can view own meal options" ON public.meal_options FOR SELECT USING (EXISTS (SELECT 1 FROM meals m JOIN diet_plans dp ON dp.id = m.diet_plan_id WHERE m.id = meal_options.meal_id AND dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage own meal options" ON public.meal_options;
CREATE POLICY "Users can manage own meal options" ON public.meal_options FOR ALL USING (EXISTS (SELECT 1 FROM meals m JOIN diet_plans dp ON dp.id = m.diet_plan_id WHERE m.id = meal_options.meal_id AND dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access to meal_options" ON public.meal_options;
CREATE POLICY "Service role full access to meal_options" ON public.meal_options FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - MEAL OPTION FOODS
-- =============================================
DROP POLICY IF EXISTS "Users can view own meal option foods" ON public.meal_option_foods;
CREATE POLICY "Users can view own meal option foods" ON public.meal_option_foods FOR SELECT USING (meal_option_id IN (SELECT mo.id FROM meal_options mo JOIN meals m ON m.id = mo.meal_id JOIN diet_plans dp ON dp.id = m.diet_plan_id WHERE dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own meal option foods" ON public.meal_option_foods;
CREATE POLICY "Users can insert own meal option foods" ON public.meal_option_foods FOR INSERT WITH CHECK (meal_option_id IN (SELECT mo.id FROM meal_options mo JOIN meals m ON m.id = mo.meal_id JOIN diet_plans dp ON dp.id = m.diet_plan_id WHERE dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own meal option foods" ON public.meal_option_foods;
CREATE POLICY "Users can update own meal option foods" ON public.meal_option_foods FOR UPDATE USING (meal_option_id IN (SELECT mo.id FROM meal_options mo JOIN meals m ON m.id = mo.meal_id JOIN diet_plans dp ON dp.id = m.diet_plan_id WHERE dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own meal option foods" ON public.meal_option_foods;
CREATE POLICY "Users can delete own meal option foods" ON public.meal_option_foods FOR DELETE USING (meal_option_id IN (SELECT mo.id FROM meal_options mo JOIN meals m ON m.id = mo.meal_id JOIN diet_plans dp ON dp.id = m.diet_plan_id WHERE dp.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access to meal_option_foods" ON public.meal_option_foods;
CREATE POLICY "Service role full access to meal_option_foods" ON public.meal_option_foods FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - DAILY LOGS
-- =============================================
DROP POLICY IF EXISTS "Users can view own daily logs" ON public.daily_logs;
CREATE POLICY "Users can view own daily logs" ON public.daily_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage own daily logs" ON public.daily_logs;
CREATE POLICY "Users can manage own daily logs" ON public.daily_logs FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access to daily_logs" ON public.daily_logs;
CREATE POLICY "Service role full access to daily_logs" ON public.daily_logs FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - MEAL LOGS
-- =============================================
DROP POLICY IF EXISTS "Users can view own meal logs" ON public.meal_logs;
CREATE POLICY "Users can view own meal logs" ON public.meal_logs FOR SELECT USING (EXISTS (SELECT 1 FROM daily_logs dl WHERE dl.id = meal_logs.daily_log_id AND dl.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage own meal logs" ON public.meal_logs;
CREATE POLICY "Users can manage own meal logs" ON public.meal_logs FOR ALL USING (EXISTS (SELECT 1 FROM daily_logs dl WHERE dl.id = meal_logs.daily_log_id AND dl.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role full access to meal_logs" ON public.meal_logs;
CREATE POLICY "Service role full access to meal_logs" ON public.meal_logs FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - WEIGHT LOGS
-- =============================================
DROP POLICY IF EXISTS "Users can view own weight logs" ON public.weight_logs;
CREATE POLICY "Users can view own weight logs" ON public.weight_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own weight logs" ON public.weight_logs;
CREATE POLICY "Users can insert own weight logs" ON public.weight_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own weight logs" ON public.weight_logs;
CREATE POLICY "Users can update own weight logs" ON public.weight_logs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own weight logs" ON public.weight_logs;
CREATE POLICY "Users can delete own weight logs" ON public.weight_logs FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access to weight_logs" ON public.weight_logs;
CREATE POLICY "Service role full access to weight_logs" ON public.weight_logs FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - BODY MEASUREMENTS
-- =============================================
DROP POLICY IF EXISTS "Users can view own measurements" ON public.body_measurements;
CREATE POLICY "Users can view own measurements" ON public.body_measurements FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own measurements" ON public.body_measurements;
CREATE POLICY "Users can insert own measurements" ON public.body_measurements FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own measurements" ON public.body_measurements;
CREATE POLICY "Users can update own measurements" ON public.body_measurements FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own measurements" ON public.body_measurements;
CREATE POLICY "Users can delete own measurements" ON public.body_measurements FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Professionals can view student measurements" ON public.body_measurements;
CREATE POLICY "Professionals can view student measurements" ON public.body_measurements FOR SELECT USING (EXISTS (SELECT 1 FROM professional_students ps WHERE ps.student_id = body_measurements.user_id AND ps.professional_id = auth.uid() AND ps.status = 'active'));
DROP POLICY IF EXISTS "Professionals can insert student measurements" ON public.body_measurements;
CREATE POLICY "Professionals can insert student measurements" ON public.body_measurements FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM professional_students ps WHERE ps.student_id = body_measurements.user_id AND ps.professional_id = auth.uid() AND ps.status = 'active') AND recorded_by = auth.uid());
DROP POLICY IF EXISTS "Professionals can update student measurements" ON public.body_measurements;
CREATE POLICY "Professionals can update student measurements" ON public.body_measurements FOR UPDATE USING (EXISTS (SELECT 1 FROM professional_students ps WHERE ps.student_id = body_measurements.user_id AND ps.professional_id = auth.uid() AND ps.status = 'active') AND recorded_by = auth.uid());
DROP POLICY IF EXISTS "Service role full access to body_measurements" ON public.body_measurements;
CREATE POLICY "Service role full access to body_measurements" ON public.body_measurements FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - PROFESSIONAL STUDENTS
-- =============================================
DROP POLICY IF EXISTS "Professionals can view own students" ON public.professional_students;
CREATE POLICY "Professionals can view own students" ON public.professional_students FOR SELECT USING (professional_id = auth.uid() AND has_role(auth.uid(), 'professional'::app_role));
DROP POLICY IF EXISTS "Professionals can add students" ON public.professional_students;
CREATE POLICY "Professionals can add students" ON public.professional_students FOR INSERT WITH CHECK (professional_id = auth.uid() AND has_role(auth.uid(), 'professional'::app_role));
DROP POLICY IF EXISTS "Professionals can update own students" ON public.professional_students;
CREATE POLICY "Professionals can update own students" ON public.professional_students FOR UPDATE USING (professional_id = auth.uid() AND has_role(auth.uid(), 'professional'::app_role));
DROP POLICY IF EXISTS "Professionals can delete own students" ON public.professional_students;
CREATE POLICY "Professionals can delete own students" ON public.professional_students FOR DELETE USING (professional_id = auth.uid() AND has_role(auth.uid(), 'professional'::app_role));
DROP POLICY IF EXISTS "Students can view own professional relationship" ON public.professional_students;
CREATE POLICY "Students can view own professional relationship" ON public.professional_students FOR SELECT USING (student_id = auth.uid());
DROP POLICY IF EXISTS "Students can view their pending links" ON public.professional_students;
CREATE POLICY "Students can view their pending links" ON public.professional_students FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Students can confirm their own link" ON public.professional_students;
CREATE POLICY "Students can confirm their own link" ON public.professional_students FOR UPDATE USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id AND student_confirmed = true);
DROP POLICY IF EXISTS "Service role full access to professional_students" ON public.professional_students;
CREATE POLICY "Service role full access to professional_students" ON public.professional_students FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - OBJECTIVE CHANGE POLICIES
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view objective_change_policies" ON public.objective_change_policies;
CREATE POLICY "Authenticated users can view objective_change_policies" ON public.objective_change_policies FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Admins can manage objective_change_policies" ON public.objective_change_policies;
CREATE POLICY "Admins can manage objective_change_policies" ON public.objective_change_policies FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to objective_change_policies" ON public.objective_change_policies;
CREATE POLICY "Service role full access to objective_change_policies" ON public.objective_change_policies FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - OBJECTIVE CHANGE REQUESTS
-- =============================================
DROP POLICY IF EXISTS "Students can create own requests" ON public.objective_change_requests;
CREATE POLICY "Students can create own requests" ON public.objective_change_requests FOR INSERT WITH CHECK (auth.uid() = student_id);
DROP POLICY IF EXISTS "Students can view own requests" ON public.objective_change_requests;
CREATE POLICY "Students can view own requests" ON public.objective_change_requests FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Professionals can view student requests" ON public.objective_change_requests;
CREATE POLICY "Professionals can view student requests" ON public.objective_change_requests FOR SELECT USING (auth.uid() = professional_id AND has_role(auth.uid(), 'professional'::app_role));
DROP POLICY IF EXISTS "Professionals can update student requests" ON public.objective_change_requests;
CREATE POLICY "Professionals can update student requests" ON public.objective_change_requests FOR UPDATE USING (auth.uid() = professional_id AND has_role(auth.uid(), 'professional'::app_role));
DROP POLICY IF EXISTS "Service role full access to objective_change_requests" ON public.objective_change_requests;
CREATE POLICY "Service role full access to objective_change_requests" ON public.objective_change_requests FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - MEAL TEMPLATES / ROLES / CATEGORIES
-- =============================================
DROP POLICY IF EXISTS "Anyone can view meal_templates" ON public.meal_templates;
CREATE POLICY "Anyone can view meal_templates" ON public.meal_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage meal_templates" ON public.meal_templates;
CREATE POLICY "Admins can manage meal_templates" ON public.meal_templates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to meal_templates" ON public.meal_templates;
CREATE POLICY "Service role full access to meal_templates" ON public.meal_templates FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can view meal_template_roles" ON public.meal_template_roles;
CREATE POLICY "Anyone can view meal_template_roles" ON public.meal_template_roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage meal_template_roles" ON public.meal_template_roles;
CREATE POLICY "Admins can manage meal_template_roles" ON public.meal_template_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to meal_template_roles" ON public.meal_template_roles;
CREATE POLICY "Service role full access to meal_template_roles" ON public.meal_template_roles FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Anyone can view meal_role_food_categories" ON public.meal_role_food_categories;
CREATE POLICY "Anyone can view meal_role_food_categories" ON public.meal_role_food_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage meal_role_food_categories" ON public.meal_role_food_categories;
CREATE POLICY "Admins can manage meal_role_food_categories" ON public.meal_role_food_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to meal_role_food_categories" ON public.meal_role_food_categories;
CREATE POLICY "Service role full access to meal_role_food_categories" ON public.meal_role_food_categories FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - MEAL ANCHOR FOODS
-- =============================================
DROP POLICY IF EXISTS "Everyone can read active anchors" ON public.meal_anchor_foods;
CREATE POLICY "Everyone can read active anchors" ON public.meal_anchor_foods FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins manage anchor foods" ON public.meal_anchor_foods;
CREATE POLICY "Admins manage anchor foods" ON public.meal_anchor_foods FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - MEAL CONTEXTUAL BLOCKS
-- =============================================
DROP POLICY IF EXISTS "Everyone can read active contextual blocks" ON public.meal_contextual_blocks;
CREATE POLICY "Everyone can read active contextual blocks" ON public.meal_contextual_blocks FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admins can manage contextual blocks" ON public.meal_contextual_blocks;
CREATE POLICY "Admins can manage contextual blocks" ON public.meal_contextual_blocks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - FOOD BLOCK OVERRIDES
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can read overrides" ON public.food_block_overrides;
CREATE POLICY "Authenticated users can read overrides" ON public.food_block_overrides FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage food block overrides" ON public.food_block_overrides;
CREATE POLICY "Admins can manage food block overrides" ON public.food_block_overrides FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - FOOD IMPORTS
-- =============================================
DROP POLICY IF EXISTS "Admins can view food imports" ON public.food_imports;
CREATE POLICY "Admins can view food imports" ON public.food_imports FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to food_imports" ON public.food_imports;
CREATE POLICY "Service role full access to food_imports" ON public.food_imports FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - SYSTEM SETTINGS
-- =============================================
DROP POLICY IF EXISTS "Admins can view system_settings" ON public.system_settings;
CREATE POLICY "Admins can view system_settings" ON public.system_settings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can insert system_settings" ON public.system_settings;
CREATE POLICY "Admins can insert system_settings" ON public.system_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can update system_settings" ON public.system_settings;
CREATE POLICY "Admins can update system_settings" ON public.system_settings FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to system_settings" ON public.system_settings;
CREATE POLICY "Service role full access to system_settings" ON public.system_settings FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - ADMIN AUDIT LOG
-- =============================================
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_log FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to admin_audit_log" ON public.admin_audit_log;
CREATE POLICY "Service role full access to admin_audit_log" ON public.admin_audit_log FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - AI USAGE LOGS
-- =============================================
DROP POLICY IF EXISTS "Admins can view ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Admins can view ai_usage_logs" ON public.ai_usage_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Service role full access to ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Service role full access to ai_usage_logs" ON public.ai_usage_logs FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- RLS POLICIES - CONVERSION EVENTS
-- =============================================
DROP POLICY IF EXISTS "Users can read own conversion events" ON public.conversion_events;
CREATE POLICY "Users can read own conversion events" ON public.conversion_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own conversion events" ON public.conversion_events;
CREATE POLICY "Users can insert own conversion events" ON public.conversion_events FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can read all conversion events" ON public.conversion_events;
CREATE POLICY "Admins can read all conversion events" ON public.conversion_events FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- RLS POLICIES - WEBHOOK EVENTS
-- =============================================
DROP POLICY IF EXISTS "Service role full access to webhook_events" ON public.webhook_events;
CREATE POLICY "Service role full access to webhook_events" ON public.webhook_events FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- 7. STORAGE BUCKETS
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('adherence-reports', 'adherence-reports', false) ON CONFLICT (id) DO NOTHING;

-- =============================================
-- FIM DO SCHEMA EXPORT COMPLETO (IDEMPOTENTE)
-- Tabelas: 24 | Funções: 20 | Triggers: 16 | Índices: 60+
-- Pode ser executado múltiplas vezes sem erro.
-- =============================================
