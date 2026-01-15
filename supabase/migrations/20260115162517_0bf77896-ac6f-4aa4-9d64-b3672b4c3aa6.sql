-- 1. Add meals_per_day to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS meals_per_day INTEGER DEFAULT 4 CHECK (meals_per_day >= 2 AND meals_per_day <= 6);

-- 2. Create plan_history table to track changes
CREATE TABLE public.plan_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    diet_plan_id UUID REFERENCES public.diet_plans(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'meal_changed', 'food_substituted', 'rebalanced', 'goal_changed')),
    description TEXT NOT NULL,
    previous_values JSONB,
    new_values JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.plan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own history"
ON public.plan_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
ON public.plan_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Create weight_logs table for progress tracking
CREATE TABLE public.weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight < 500),
    logged_at DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, logged_at)
);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weight logs"
ON public.weight_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weight logs"
ON public.weight_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own weight logs"
ON public.weight_logs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own weight logs"
ON public.weight_logs FOR DELETE
USING (auth.uid() = user_id);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_plan_history_user ON public.plan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_history_created ON public.plan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON public.weight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_date ON public.weight_logs(logged_at DESC);