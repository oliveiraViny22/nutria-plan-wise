
-- =====================================================
-- MEAL PLAN ENGINE WITH ADHERENCE LEARNING - COMPLETE
-- =====================================================

-- 1. Plan Versions Table (for versioning approved plans)
CREATE TABLE public.plan_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(diet_plan_id, version_number)
);

-- 2. Meal Options Table (1-3 nutritionally equivalent options per meal)
CREATE TABLE public.meal_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  option_number INTEGER NOT NULL CHECK (option_number BETWEEN 1 AND 3),
  name TEXT,
  total_calories NUMERIC NOT NULL DEFAULT 0,
  total_protein NUMERIC NOT NULL DEFAULT 0,
  total_carbs NUMERIC NOT NULL DEFAULT 0,
  total_fat NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(meal_id, option_number)
);

-- 3. Meal Option Foods Table (foods within an option)
CREATE TABLE public.meal_option_foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_option_id UUID NOT NULL REFERENCES public.meal_options(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Daily Logs Table (one per user per day)
CREATE TABLE public.daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id),
  plan_version INTEGER NOT NULL DEFAULT 1,
  log_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'SEM_REGISTROS' CHECK (status IN ('SEM_REGISTROS', 'PARCIAL', 'COMPLETO')),
  total_calories_consumed NUMERIC DEFAULT 0,
  total_protein_consumed NUMERIC DEFAULT 0,
  total_carbs_consumed NUMERIC DEFAULT 0,
  total_fat_consumed NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- 5. Meal Logs Table (per-meal confirmation)
CREATE TABLE public.meal_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id),
  confirmed_option_id UUID REFERENCES public.meal_options(id),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONFIRMADA', 'PULADA', 'FORA_DO_PLANO', 'CONFIRMADA_TARDIA')),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  calories_consumed NUMERIC DEFAULT 0,
  protein_consumed NUMERIC DEFAULT 0,
  carbs_consumed NUMERIC DEFAULT 0,
  fat_consumed NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(daily_log_id, meal_id)
);

-- 6. Adherence Metrics Table (aggregated metrics)
CREATE TABLE public.adherence_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  plan_version INTEGER NOT NULL DEFAULT 1,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 0,
  days_with_records INTEGER NOT NULL DEFAULT 0,
  overall_adherence_rate NUMERIC DEFAULT 0,
  meals_confirmed INTEGER DEFAULT 0,
  meals_skipped INTEGER DEFAULT 0,
  meals_out_of_plan INTEGER DEFAULT 0,
  meals_late_confirmed INTEGER DEFAULT 0,
  adherence_by_meal JSONB DEFAULT '{}',
  adherence_by_option JSONB DEFAULT '{}',
  exception_distribution JSONB DEFAULT '{}',
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, diet_plan_id, plan_version, period_start, period_end)
);

-- 7. AI Suggestions Table (draft proposals)
CREATE TABLE public.ai_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  diet_plan_id UUID NOT NULL REFERENCES public.diet_plans(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
    'ADD_OPTION', 'REMOVE_OPTION', 'SIMPLIFY_OPTION', 
    'ADJUST_SCHEDULE', 'REDUCE_MEALS', 'REORGANIZE_MEALS', 
    'CONTEXTUAL_OPTION'
  )),
  hypothesis TEXT NOT NULL,
  rationale TEXT NOT NULL,
  proposed_changes JSONB NOT NULL,
  adherence_data_used JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EDITED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Enable RLS on all new tables
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_option_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for plan_versions
CREATE POLICY "Users can view their plan versions" ON public.plan_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diet_plans dp 
      WHERE dp.id = plan_versions.diet_plan_id 
      AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can view student plan versions" ON public.plan_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diet_plans dp
      JOIN profiles p ON p.user_id = dp.user_id
      WHERE dp.id = plan_versions.diet_plan_id 
      AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can manage plan versions" ON public.plan_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM diet_plans dp
      JOIN profiles p ON p.user_id = dp.user_id
      WHERE dp.id = plan_versions.diet_plan_id 
      AND p.professional_id = auth.uid()
    )
  );

-- 10. RLS Policies for meal_options
CREATE POLICY "Users can view meal options" ON public.meal_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN diet_plans dp ON dp.id = m.diet_plan_id
      WHERE m.id = meal_options.meal_id 
      AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can view student meal options" ON public.meal_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN diet_plans dp ON dp.id = m.diet_plan_id
      JOIN profiles p ON p.user_id = dp.user_id
      WHERE m.id = meal_options.meal_id 
      AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can manage meal options" ON public.meal_options
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN diet_plans dp ON dp.id = m.diet_plan_id
      JOIN profiles p ON p.user_id = dp.user_id
      WHERE m.id = meal_options.meal_id 
      AND p.professional_id = auth.uid()
    )
  );

-- 11. RLS Policies for meal_option_foods
CREATE POLICY "Users can view meal option foods" ON public.meal_option_foods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meal_options mo
      JOIN meals m ON m.id = mo.meal_id
      JOIN diet_plans dp ON dp.id = m.diet_plan_id
      WHERE mo.id = meal_option_foods.meal_option_id 
      AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can view student meal option foods" ON public.meal_option_foods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meal_options mo
      JOIN meals m ON m.id = mo.meal_id
      JOIN diet_plans dp ON dp.id = m.diet_plan_id
      JOIN profiles p ON p.user_id = dp.user_id
      WHERE mo.id = meal_option_foods.meal_option_id 
      AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can manage meal option foods" ON public.meal_option_foods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM meal_options mo
      JOIN meals m ON m.id = mo.meal_id
      JOIN diet_plans dp ON dp.id = m.diet_plan_id
      JOIN profiles p ON p.user_id = dp.user_id
      WHERE mo.id = meal_option_foods.meal_option_id 
      AND p.professional_id = auth.uid()
    )
  );

-- 12. RLS Policies for daily_logs
CREATE POLICY "Users can manage their daily logs" ON public.daily_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Professionals can view student daily logs" ON public.daily_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = daily_logs.user_id 
      AND p.professional_id = auth.uid()
    )
  );

-- 13. RLS Policies for meal_logs
CREATE POLICY "Users can manage their meal logs" ON public.meal_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM daily_logs dl 
      WHERE dl.id = meal_logs.daily_log_id 
      AND dl.user_id = auth.uid()
    )
  );

CREATE POLICY "Professionals can view student meal logs" ON public.meal_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM daily_logs dl
      JOIN profiles p ON p.user_id = dl.user_id
      WHERE dl.id = meal_logs.daily_log_id 
      AND p.professional_id = auth.uid()
    )
  );

-- 14. RLS Policies for adherence_metrics
CREATE POLICY "Users can view their adherence metrics" ON public.adherence_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Professionals can view student adherence" ON public.adherence_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = adherence_metrics.user_id 
      AND p.professional_id = auth.uid()
    )
  );

CREATE POLICY "Service can manage adherence metrics" ON public.adherence_metrics
  FOR ALL USING (true) WITH CHECK (true);

-- 15. RLS Policies for ai_suggestions
CREATE POLICY "Users can view their suggestions" ON public.ai_suggestions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Professionals can manage student suggestions" ON public.ai_suggestions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.user_id = ai_suggestions.user_id 
      AND p.professional_id = auth.uid()
    )
  );

-- 16. Function to validate nutritional equivalence between options
CREATE OR REPLACE FUNCTION public.validate_meal_option_equivalence()
RETURNS TRIGGER AS $$
DECLARE
  v_first_option RECORD;
  v_protein_diff NUMERIC;
  v_carbs_diff NUMERIC;
  v_fat_diff NUMERIC;
  v_calories_diff NUMERIC;
BEGIN
  SELECT total_protein, total_carbs, total_fat, total_calories
  INTO v_first_option
  FROM public.meal_options
  WHERE meal_id = NEW.meal_id AND option_number = 1
  LIMIT 1;
  
  IF v_first_option IS NULL OR NEW.option_number = 1 THEN
    RETURN NEW;
  END IF;
  
  v_protein_diff := ABS(NEW.total_protein - v_first_option.total_protein);
  v_carbs_diff := ABS(NEW.total_carbs - v_first_option.total_carbs);
  v_fat_diff := ABS(NEW.total_fat - v_first_option.total_fat);
  v_calories_diff := ABS(NEW.total_calories - v_first_option.total_calories) / NULLIF(v_first_option.total_calories, 0) * 100;
  
  IF v_protein_diff > 5 THEN
    RAISE EXCEPTION 'Protein difference exceeds 5g limit: %', v_protein_diff;
  END IF;
  
  IF v_carbs_diff > 10 THEN
    RAISE EXCEPTION 'Carbs difference exceeds 10g limit: %', v_carbs_diff;
  END IF;
  
  IF v_fat_diff > 3 THEN
    RAISE EXCEPTION 'Fat difference exceeds 3g limit: %', v_fat_diff;
  END IF;
  
  IF v_calories_diff > 10 THEN
    RAISE EXCEPTION 'Calories difference exceeds 10 percent limit: %', v_calories_diff;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_option_equivalence
  BEFORE INSERT OR UPDATE ON public.meal_options
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_meal_option_equivalence();

-- 17. Function to calculate adherence metrics
CREATE OR REPLACE FUNCTION public.calculate_adherence_metrics(
  _user_id UUID,
  _diet_plan_id UUID,
  _period_start DATE,
  _period_end DATE
) RETURNS JSONB AS $$
DECLARE
  v_plan_version INTEGER;
  v_total_days INTEGER;
  v_days_with_records INTEGER;
  v_meals_confirmed INTEGER;
  v_meals_skipped INTEGER;
  v_meals_out_of_plan INTEGER;
  v_meals_late INTEGER;
  v_total_meals INTEGER;
  v_adherence_rate NUMERIC;
  v_adherence_by_meal JSONB;
  v_adherence_by_option JSONB;
  v_exception_distribution JSONB;
BEGIN
  SELECT COALESCE(MAX(version_number), 1) INTO v_plan_version
  FROM plan_versions WHERE diet_plan_id = _diet_plan_id;
  
  v_total_days := _period_end - _period_start + 1;
  
  SELECT COUNT(DISTINCT log_date) INTO v_days_with_records
  FROM daily_logs
  WHERE user_id = _user_id 
    AND diet_plan_id = _diet_plan_id
    AND log_date BETWEEN _period_start AND _period_end
    AND status != 'SEM_REGISTROS';
  
  SELECT 
    COUNT(*) FILTER (WHERE status = 'CONFIRMADA'),
    COUNT(*) FILTER (WHERE status = 'PULADA'),
    COUNT(*) FILTER (WHERE status = 'FORA_DO_PLANO'),
    COUNT(*) FILTER (WHERE status = 'CONFIRMADA_TARDIA'),
    COUNT(*)
  INTO v_meals_confirmed, v_meals_skipped, v_meals_out_of_plan, v_meals_late, v_total_meals
  FROM meal_logs ml
  JOIN daily_logs dl ON dl.id = ml.daily_log_id
  WHERE dl.user_id = _user_id 
    AND dl.diet_plan_id = _diet_plan_id
    AND dl.log_date BETWEEN _period_start AND _period_end;
  
  IF v_total_meals > 0 THEN
    v_adherence_rate := (v_meals_confirmed + v_meals_late)::NUMERIC / v_total_meals * 100;
  ELSE
    v_adherence_rate := 0;
  END IF;
  
  SELECT jsonb_object_agg(
    meal_name,
    jsonb_build_object(
      'total', total_count,
      'confirmed', confirmed_count,
      'rate', CASE WHEN total_count > 0 THEN ROUND(confirmed_count::NUMERIC / total_count * 100, 2) ELSE 0 END
    )
  ) INTO v_adherence_by_meal
  FROM (
    SELECT 
      m.name AS meal_name,
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE ml.status IN ('CONFIRMADA', 'CONFIRMADA_TARDIA')) AS confirmed_count
    FROM meal_logs ml
    JOIN daily_logs dl ON dl.id = ml.daily_log_id
    JOIN meals m ON m.id = ml.meal_id
    WHERE dl.user_id = _user_id 
      AND dl.diet_plan_id = _diet_plan_id
      AND dl.log_date BETWEEN _period_start AND _period_end
    GROUP BY m.name
  ) meal_stats;
  
  SELECT jsonb_object_agg(
    option_id::TEXT,
    jsonb_build_object(
      'meal', meal_name,
      'option_number', option_number,
      'times_selected', times_selected
    )
  ) INTO v_adherence_by_option
  FROM (
    SELECT 
      mo.id AS option_id,
      m.name AS meal_name,
      mo.option_number,
      COUNT(*) AS times_selected
    FROM meal_logs ml
    JOIN daily_logs dl ON dl.id = ml.daily_log_id
    JOIN meal_options mo ON mo.id = ml.confirmed_option_id
    JOIN meals m ON m.id = mo.meal_id
    WHERE dl.user_id = _user_id 
      AND dl.diet_plan_id = _diet_plan_id
      AND dl.log_date BETWEEN _period_start AND _period_end
      AND ml.confirmed_option_id IS NOT NULL
    GROUP BY mo.id, m.name, mo.option_number
  ) option_stats;
  
  v_exception_distribution := jsonb_build_object(
    'PULADA', v_meals_skipped,
    'FORA_DO_PLANO', v_meals_out_of_plan,
    'CONFIRMADA_TARDIA', v_meals_late
  );
  
  INSERT INTO adherence_metrics (
    user_id, diet_plan_id, plan_version, period_start, period_end,
    total_days, days_with_records, overall_adherence_rate,
    meals_confirmed, meals_skipped, meals_out_of_plan, meals_late_confirmed,
    adherence_by_meal, adherence_by_option, exception_distribution
  ) VALUES (
    _user_id, _diet_plan_id, v_plan_version, _period_start, _period_end,
    v_total_days, v_days_with_records, v_adherence_rate,
    v_meals_confirmed, v_meals_skipped, v_meals_out_of_plan, v_meals_late,
    COALESCE(v_adherence_by_meal, '{}'), COALESCE(v_adherence_by_option, '{}'), v_exception_distribution
  )
  ON CONFLICT (user_id, diet_plan_id, plan_version, period_start, period_end)
  DO UPDATE SET
    total_days = EXCLUDED.total_days,
    days_with_records = EXCLUDED.days_with_records,
    overall_adherence_rate = EXCLUDED.overall_adherence_rate,
    meals_confirmed = EXCLUDED.meals_confirmed,
    meals_skipped = EXCLUDED.meals_skipped,
    meals_out_of_plan = EXCLUDED.meals_out_of_plan,
    meals_late_confirmed = EXCLUDED.meals_late_confirmed,
    adherence_by_meal = EXCLUDED.adherence_by_meal,
    adherence_by_option = EXCLUDED.adherence_by_option,
    exception_distribution = EXCLUDED.exception_distribution,
    calculated_at = now();
  
  RETURN jsonb_build_object(
    'total_days', v_total_days,
    'days_with_records', v_days_with_records,
    'adherence_rate', v_adherence_rate,
    'meals_confirmed', v_meals_confirmed,
    'meals_skipped', v_meals_skipped,
    'meals_out_of_plan', v_meals_out_of_plan,
    'meals_late', v_meals_late,
    'adherence_by_meal', v_adherence_by_meal,
    'adherence_by_option', v_adherence_by_option
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 18. Function to confirm meal consumption
CREATE OR REPLACE FUNCTION public.confirm_meal_consumption(
  _user_id UUID,
  _meal_id UUID,
  _option_id UUID,
  _status TEXT,
  _log_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE
  v_daily_log_id UUID;
  v_diet_plan_id UUID;
  v_option_macros RECORD;
  v_is_late BOOLEAN;
  v_final_status TEXT;
BEGIN
  IF _status NOT IN ('CONFIRMADA', 'PULADA', 'FORA_DO_PLANO') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;
  
  SELECT dp.id INTO v_diet_plan_id
  FROM meals m
  JOIN diet_plans dp ON dp.id = m.diet_plan_id
  WHERE m.id = _meal_id AND dp.user_id = _user_id;
  
  IF v_diet_plan_id IS NULL THEN
    RAISE EXCEPTION 'Meal not found or does not belong to user';
  END IF;
  
  v_is_late := _log_date < CURRENT_DATE;
  v_final_status := CASE WHEN v_is_late AND _status = 'CONFIRMADA' THEN 'CONFIRMADA_TARDIA' ELSE _status END;
  
  INSERT INTO daily_logs (user_id, diet_plan_id, log_date, status)
  VALUES (_user_id, v_diet_plan_id, _log_date, 'PARCIAL')
  ON CONFLICT (user_id, log_date) 
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_daily_log_id;
  
  IF _option_id IS NOT NULL AND _status = 'CONFIRMADA' THEN
    SELECT total_calories, total_protein, total_carbs, total_fat
    INTO v_option_macros
    FROM meal_options WHERE id = _option_id;
  END IF;
  
  INSERT INTO meal_logs (
    daily_log_id, meal_id, confirmed_option_id, status, confirmed_at,
    calories_consumed, protein_consumed, carbs_consumed, fat_consumed
  ) VALUES (
    v_daily_log_id, _meal_id, 
    CASE WHEN v_final_status IN ('CONFIRMADA', 'CONFIRMADA_TARDIA') THEN _option_id ELSE NULL END,
    v_final_status, 
    CASE WHEN v_final_status != 'PENDENTE' THEN now() ELSE NULL END,
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
  
  UPDATE daily_logs dl SET
    total_calories_consumed = (
      SELECT COALESCE(SUM(calories_consumed), 0) FROM meal_logs WHERE daily_log_id = v_daily_log_id
    ),
    total_protein_consumed = (
      SELECT COALESCE(SUM(protein_consumed), 0) FROM meal_logs WHERE daily_log_id = v_daily_log_id
    ),
    total_carbs_consumed = (
      SELECT COALESCE(SUM(carbs_consumed), 0) FROM meal_logs WHERE daily_log_id = v_daily_log_id
    ),
    total_fat_consumed = (
      SELECT COALESCE(SUM(fat_consumed), 0) FROM meal_logs WHERE daily_log_id = v_daily_log_id
    ),
    status = CASE 
      WHEN NOT EXISTS (SELECT 1 FROM meal_logs ml2 WHERE ml2.daily_log_id = v_daily_log_id AND ml2.status = 'PENDENTE')
      THEN 'COMPLETO'
      ELSE 'PARCIAL'
    END,
    updated_at = now()
  WHERE id = v_daily_log_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'daily_log_id', v_daily_log_id,
    'status', v_final_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 19. Create indexes for performance
CREATE INDEX idx_meal_options_meal_id ON public.meal_options(meal_id);
CREATE INDEX idx_meal_option_foods_option_id ON public.meal_option_foods(meal_option_id);
CREATE INDEX idx_daily_logs_user_date ON public.daily_logs(user_id, log_date);
CREATE INDEX idx_meal_logs_daily_log_id ON public.meal_logs(daily_log_id);
CREATE INDEX idx_adherence_metrics_user_plan ON public.adherence_metrics(user_id, diet_plan_id);
CREATE INDEX idx_ai_suggestions_user_status ON public.ai_suggestions(user_id, status);

-- 20. Trigger for updated_at on daily_logs
CREATE TRIGGER update_daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
