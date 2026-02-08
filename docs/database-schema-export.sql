-- =============================================
-- NutriaPlan Database Schema Export
-- Generated: 2026-02-08
-- Supabase Project: iplgqpnwfgnqaaeqxnrx
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'professional');
CREATE TYPE public.daily_status AS ENUM ('no_records', 'partial', 'complete');
CREATE TYPE public.meal_status AS ENUM ('pending', 'confirmed', 'skipped', 'out_of_plan', 'late_confirmed');
CREATE TYPE public.plan_type AS ENUM ('gratuito', 'plano_pessoal_pago', 'profissional');
CREATE TYPE public.subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');

-- =============================================
-- TABLES
-- =============================================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Plans (subscription tiers)
CREATE TABLE public.plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
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
CREATE TABLE public.subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    plan_id UUID NOT NULL REFERENCES public.plans(id),
    status public.subscription_status NOT NULL DEFAULT 'trial',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User Roles
CREATE TABLE public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    role public.app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- User Usage (limits tracking)
CREATE TABLE public.user_usage (
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
CREATE TABLE public.foods (
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
    processing_level TEXT,
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
CREATE TABLE public.diet_plans (
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
CREATE TABLE public.meals (
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
CREATE TABLE public.meal_options (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
    option_number INTEGER NOT NULL DEFAULT 1,
    name TEXT,
    total_calories NUMERIC DEFAULT 0,
    total_protein NUMERIC DEFAULT 0,
    total_carbs NUMERIC DEFAULT 0,
    total_fat NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Option Foods
CREATE TABLE public.meal_option_foods (
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
CREATE TABLE public.daily_logs (
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
CREATE TABLE public.meal_logs (
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Weight Logs
CREATE TABLE public.weight_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(user_id),
    weight_kg NUMERIC NOT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Body Measurements
CREATE TABLE public.body_measurements (
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Professional Students (link between professionals and students)
CREATE TABLE public.professional_students (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.profiles(user_id),
    student_id UUID NOT NULL REFERENCES public.profiles(user_id),
    status TEXT NOT NULL DEFAULT 'pending',
    student_confirmed BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Objective Change Policies
CREATE TABLE public.objective_change_policies (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_type TEXT NOT NULL,
    change_number INTEGER NOT NULL,
    cooldown_days INTEGER NOT NULL DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Objective Change Requests (students requesting goal changes)
CREATE TABLE public.objective_change_requests (
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
CREATE TABLE public.meal_templates (
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
CREATE TABLE public.meal_template_roles (
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
CREATE TABLE public.meal_role_food_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id UUID NOT NULL REFERENCES public.meal_template_roles(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Meal Anchor Foods
CREATE TABLE public.meal_anchor_foods (
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

-- Meal Contextual Blocks
CREATE TABLE public.meal_contextual_blocks (
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
CREATE TABLE public.food_block_overrides (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    food_id UUID NOT NULL UNIQUE REFERENCES public.foods(id),
    is_unblocked BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Food Imports
CREATE TABLE public.food_imports (
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
CREATE TABLE public.system_settings (
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
CREATE TABLE public.admin_audit_log (
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
CREATE TABLE public.ai_usage_logs (
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
CREATE TABLE public.conversion_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    feature_key TEXT NOT NULL,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook Events
CREATE TABLE public.webhook_events (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- FUNCTIONS
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

-- Check if user has role
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

-- Confirm meal consumption
CREATE OR REPLACE FUNCTION public.confirm_meal_consumption(
    _user_id UUID,
    _meal_id UUID,
    _option_id UUID,
    _status TEXT,
    _log_date DATE DEFAULT CURRENT_DATE
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

  SELECT diet_plan_id INTO _diet_plan_id
  FROM meals
  WHERE id = _meal_id;

  IF _diet_plan_id IS NULL THEN
    RAISE EXCEPTION 'Meal not found';
  END IF;

  INSERT INTO daily_logs (user_id, diet_plan_id, log_date, status)
  VALUES (_user_id, _diet_plan_id, _log_date, 'no_records'::daily_status)
  ON CONFLICT (user_id, log_date) DO NOTHING;

  SELECT id INTO _daily_log_id
  FROM daily_logs
  WHERE user_id = _user_id
    AND log_date = _log_date;

  IF _option_id IS NOT NULL THEN
    SELECT total_calories, total_protein, total_carbs, total_fat
    INTO _option_data
    FROM meal_options
    WHERE id = _option_id;
  END IF;

  SELECT id INTO _meal_log_id
  FROM meal_logs
  WHERE daily_log_id = _daily_log_id
    AND meal_id = _meal_id;

  IF _meal_log_id IS NULL THEN
    INSERT INTO meal_logs (
      daily_log_id, meal_id, status, confirmed_option_id, confirmed_at,
      calories_consumed, protein_consumed, carbs_consumed, fat_consumed
    )
    VALUES (
      _daily_log_id, _meal_id, _meal_status_value, _option_id,
      CASE WHEN _meal_status_value IN ('confirmed', 'late_confirmed') THEN NOW() ELSE NULL END,
      COALESCE(_option_data.total_calories, 0),
      COALESCE(_option_data.total_protein, 0),
      COALESCE(_option_data.total_carbs, 0),
      COALESCE(_option_data.total_fat, 0)
    )
    RETURNING id INTO _meal_log_id;
  ELSE
    UPDATE meal_logs
    SET status = _meal_status_value,
        confirmed_option_id = _option_id,
        confirmed_at = CASE WHEN _meal_status_value IN ('confirmed', 'late_confirmed') THEN NOW() ELSE confirmed_at END,
        calories_consumed = COALESCE(_option_data.total_calories, 0),
        protein_consumed = COALESCE(_option_data.total_protein, 0),
        carbs_consumed = COALESCE(_option_data.total_carbs, 0),
        fat_consumed = COALESCE(_option_data.total_fat, 0)
    WHERE id = _meal_log_id;
  END IF;

  SELECT COUNT(*) INTO _total_meals FROM meals WHERE diet_plan_id = _diet_plan_id;
  SELECT COUNT(*) INTO _confirmed_meals FROM meal_logs WHERE daily_log_id = _daily_log_id AND status != 'pending';

  IF _confirmed_meals = 0 THEN
    _new_daily_status := 'no_records'::daily_status;
  ELSIF _confirmed_meals >= _total_meals THEN
    _new_daily_status := 'complete'::daily_status;
  ELSE
    _new_daily_status := 'partial'::daily_status;
  END IF;

  UPDATE daily_logs
  SET status = _new_daily_status,
      total_calories_consumed = (SELECT COALESCE(SUM(calories_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
      total_protein_consumed = (SELECT COALESCE(SUM(protein_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
      total_carbs_consumed = (SELECT COALESCE(SUM(carbs_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
      total_fat_consumed = (SELECT COALESCE(SUM(fat_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
      updated_at = NOW()
  WHERE id = _daily_log_id;

  RETURN json_build_object(
    'success', true,
    'daily_log_id', _daily_log_id,
    'meal_log_id', _meal_log_id,
    'status', _meal_status_value::text,
    'daily_status', _new_daily_status::text
  );
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
  SELECT value INTO v_value
  FROM system_settings
  WHERE key = _flag_key
  AND category = 'feature_flags';
  
  IF v_value IS NULL THEN
    RETURN _default_value;
  END IF;
  
  IF v_value::text = 'true' OR v_value::text = '"true"' THEN
    RETURN true;
  ELSIF v_value::text = 'false' OR v_value::text = '"false"' THEN
    RETURN false;
  ELSE
    RETURN _default_value;
  END IF;
END;
$$;

-- Handle new user (trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    
    SELECT id INTO free_plan_id FROM public.plans WHERE type = 'gratuito' LIMIT 1;
    
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
        VALUES (NEW.id, free_plan_id, 'trial', now(), now() + INTERVAL '30 days');
    END IF;
    
    INSERT INTO public.user_usage (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-create profile, subscription, usage on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-generate canonical name for foods
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

CREATE TRIGGER set_food_canonical_name
    BEFORE INSERT OR UPDATE ON public.foods
    FOR EACH ROW EXECUTE FUNCTION public.set_canonical_name();

-- =============================================
-- RLS POLICIES (resumo - todas as tabelas têm RLS habilitado)
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

-- Exemplo de policies (padrão para maioria das tabelas)
-- Users can view/manage own data
-- Service role has full access
-- Admins have extended permissions via has_role() function

-- =============================================
-- SEED DATA - Plans
-- =============================================

INSERT INTO public.plans (name, type, description, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, has_chat, meal_options_limit)
VALUES 
    ('Gratuito', 'gratuito', 'Plano gratuito com recursos básicos', 1, 0, 0, 0, false, 3),
    ('Pessoal Pago', 'plano_pessoal_pago', 'Plano pessoal com recursos avançados', 5, 10, 5, 20, true, 5),
    ('Profissional', 'profissional', 'Plano para nutricionistas', 999, 999, 999, 100, true, 10)
ON CONFLICT DO NOTHING;
