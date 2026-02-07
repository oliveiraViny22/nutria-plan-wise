
-- Fix race condition in confirm_meal_consumption by using UPSERT pattern
CREATE OR REPLACE FUNCTION public.confirm_meal_consumption(_user_id uuid, _meal_id uuid, _option_id uuid, _status text, _log_date date DEFAULT CURRENT_DATE)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Cast text to meal_status enum
  _meal_status_value := _status::meal_status;

  -- Get diet plan ID from meal
  SELECT diet_plan_id INTO _diet_plan_id
  FROM meals
  WHERE id = _meal_id;

  IF _diet_plan_id IS NULL THEN
    RAISE EXCEPTION 'Meal not found';
  END IF;

  -- UPSERT daily log to avoid race condition (INSERT ... ON CONFLICT)
  INSERT INTO daily_logs (user_id, diet_plan_id, log_date, status)
  VALUES (_user_id, _diet_plan_id, _log_date, 'no_records'::daily_status)
  ON CONFLICT (user_id, log_date) DO NOTHING;

  -- Now safely retrieve the daily log id
  SELECT id INTO _daily_log_id
  FROM daily_logs
  WHERE user_id = _user_id
    AND log_date = _log_date;

  -- Get option nutritional data if confirming
  IF _option_id IS NOT NULL THEN
    SELECT total_calories, total_protein, total_carbs, total_fat
    INTO _option_data
    FROM meal_options
    WHERE id = _option_id;
  END IF;

  -- Check if meal log exists
  SELECT id INTO _meal_log_id
  FROM meal_logs
  WHERE daily_log_id = _daily_log_id
    AND meal_id = _meal_id;

  IF _meal_log_id IS NULL THEN
    -- Insert new meal log
    INSERT INTO meal_logs (
      daily_log_id,
      meal_id,
      status,
      confirmed_option_id,
      confirmed_at,
      calories_consumed,
      protein_consumed,
      carbs_consumed,
      fat_consumed
    )
    VALUES (
      _daily_log_id,
      _meal_id,
      _meal_status_value,
      _option_id,
      CASE WHEN _meal_status_value IN ('confirmed', 'late_confirmed') THEN NOW() ELSE NULL END,
      COALESCE(_option_data.total_calories, 0),
      COALESCE(_option_data.total_protein, 0),
      COALESCE(_option_data.total_carbs, 0),
      COALESCE(_option_data.total_fat, 0)
    )
    RETURNING id INTO _meal_log_id;
  ELSE
    -- Update existing meal log
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

  -- Count total meals in plan and confirmed meals
  SELECT COUNT(*) INTO _total_meals
  FROM meals
  WHERE diet_plan_id = _diet_plan_id;

  SELECT COUNT(*) INTO _confirmed_meals
  FROM meal_logs
  WHERE daily_log_id = _daily_log_id
    AND status != 'pending';

  -- Determine daily status
  IF _confirmed_meals = 0 THEN
    _new_daily_status := 'no_records'::daily_status;
  ELSIF _confirmed_meals >= _total_meals THEN
    _new_daily_status := 'complete'::daily_status;
  ELSE
    _new_daily_status := 'partial'::daily_status;
  END IF;

  -- Update daily log totals and status
  UPDATE daily_logs
  SET status = _new_daily_status,
      total_calories_consumed = (
        SELECT COALESCE(SUM(calories_consumed), 0)
        FROM meal_logs
        WHERE daily_log_id = _daily_log_id
          AND status IN ('confirmed', 'late_confirmed')
      ),
      total_protein_consumed = (
        SELECT COALESCE(SUM(protein_consumed), 0)
        FROM meal_logs
        WHERE daily_log_id = _daily_log_id
          AND status IN ('confirmed', 'late_confirmed')
      ),
      total_carbs_consumed = (
        SELECT COALESCE(SUM(carbs_consumed), 0)
        FROM meal_logs
        WHERE daily_log_id = _daily_log_id
          AND status IN ('confirmed', 'late_confirmed')
      ),
      total_fat_consumed = (
        SELECT COALESCE(SUM(fat_consumed), 0)
        FROM meal_logs
        WHERE daily_log_id = _daily_log_id
          AND status IN ('confirmed', 'late_confirmed')
      ),
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
$function$;
