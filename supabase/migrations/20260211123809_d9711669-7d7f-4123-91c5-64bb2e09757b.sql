
-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS public.confirm_meal_consumption(uuid, uuid, uuid, text, date);

-- Recreate the function with correct signature
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
  _option_calories NUMERIC;
  _option_protein NUMERIC;
  _option_carbs NUMERIC;
  _option_fat NUMERIC;
  _total_meals INT;
  _confirmed_meals INT;
  _daily_status daily_status;
BEGIN
  -- Get active diet plan
  SELECT id INTO _diet_plan_id
  FROM diet_plans
  WHERE user_id = _user_id AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  IF _diet_plan_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum plano alimentar ativo encontrado';
  END IF;

  -- Verify meal belongs to this plan
  IF NOT EXISTS (SELECT 1 FROM meals WHERE id = _meal_id AND diet_plan_id = _diet_plan_id) THEN
    RAISE EXCEPTION 'Refeição não pertence ao plano ativo';
  END IF;

  -- Get or create daily log
  SELECT id INTO _daily_log_id
  FROM daily_logs
  WHERE user_id = _user_id AND diet_plan_id = _diet_plan_id AND log_date = _log_date;

  IF _daily_log_id IS NULL THEN
    INSERT INTO daily_logs (user_id, diet_plan_id, log_date, status)
    VALUES (_user_id, _diet_plan_id, _log_date, 'partial')
    RETURNING id INTO _daily_log_id;
  END IF;

  -- Get option nutritional data if confirming
  IF _status IN ('confirmed', 'late_confirmed') AND _option_id IS NOT NULL THEN
    SELECT total_calories, total_protein, total_carbs, total_fat
    INTO _option_calories, _option_protein, _option_carbs, _option_fat
    FROM meal_options
    WHERE id = _option_id AND meal_id = _meal_id;
  END IF;

  -- Upsert meal log
  INSERT INTO meal_logs (daily_log_id, meal_id, status, confirmed_option_id, confirmed_at,
    calories_consumed, protein_consumed, carbs_consumed, fat_consumed)
  VALUES (
    _daily_log_id, _meal_id, _status::meal_status,
    CASE WHEN _status IN ('confirmed', 'late_confirmed') THEN _option_id ELSE NULL END,
    CASE WHEN _status IN ('confirmed', 'late_confirmed') THEN NOW() ELSE NULL END,
    COALESCE(_option_calories, 0),
    COALESCE(_option_protein, 0),
    COALESCE(_option_carbs, 0),
    COALESCE(_option_fat, 0)
  )
  ON CONFLICT (daily_log_id, meal_id) DO UPDATE SET
    status = EXCLUDED.status,
    confirmed_option_id = EXCLUDED.confirmed_option_id,
    confirmed_at = EXCLUDED.confirmed_at,
    calories_consumed = EXCLUDED.calories_consumed,
    protein_consumed = EXCLUDED.protein_consumed,
    carbs_consumed = EXCLUDED.carbs_consumed,
    fat_consumed = EXCLUDED.fat_consumed
  RETURNING id INTO _meal_log_id;

  -- Update daily totals
  UPDATE daily_logs SET
    total_calories_consumed = (SELECT COALESCE(SUM(calories_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    total_protein_consumed = (SELECT COALESCE(SUM(protein_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    total_carbs_consumed = (SELECT COALESCE(SUM(carbs_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    total_fat_consumed = (SELECT COALESCE(SUM(fat_consumed), 0) FROM meal_logs WHERE daily_log_id = _daily_log_id AND status IN ('confirmed', 'late_confirmed')),
    updated_at = NOW()
  WHERE id = _daily_log_id;

  -- Calculate daily status
  SELECT COUNT(*) INTO _total_meals FROM meals WHERE diet_plan_id = _diet_plan_id;
  SELECT COUNT(*) INTO _confirmed_meals FROM meal_logs WHERE daily_log_id = _daily_log_id AND status != 'pending';

  IF _confirmed_meals >= _total_meals THEN
    _daily_status := 'complete';
  ELSIF _confirmed_meals > 0 THEN
    _daily_status := 'partial';
  ELSE
    _daily_status := 'no_records';
  END IF;

  UPDATE daily_logs SET status = _daily_status WHERE id = _daily_log_id;

  RETURN json_build_object(
    'daily_log_id', _daily_log_id,
    'meal_log_id', _meal_log_id,
    'status', _daily_status
  );
END;
$$;
