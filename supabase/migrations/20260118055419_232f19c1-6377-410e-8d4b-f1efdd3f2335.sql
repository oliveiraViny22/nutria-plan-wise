
-- Corrigir função calculate_adherence_metrics com aliases para evitar ambiguidade na coluna status
CREATE OR REPLACE FUNCTION public.calculate_adherence_metrics(_user_id uuid, _diet_plan_id uuid, _period_start date, _period_end date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  SELECT COUNT(DISTINCT dl.log_date) INTO v_days_with_records
  FROM daily_logs dl
  WHERE dl.user_id = _user_id 
    AND dl.diet_plan_id = _diet_plan_id
    AND dl.log_date BETWEEN _period_start AND _period_end
    AND dl.status != 'SEM_REGISTROS';
  
  SELECT 
    COUNT(*) FILTER (WHERE ml.status = 'CONFIRMADA'),
    COUNT(*) FILTER (WHERE ml.status = 'PULADA'),
    COUNT(*) FILTER (WHERE ml.status = 'FORA_DO_PLANO'),
    COUNT(*) FILTER (WHERE ml.status = 'CONFIRMADA_TARDIA'),
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
$function$;
