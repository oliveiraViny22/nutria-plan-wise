
-- RPC to calculate nutritional targets based on profile and goal
-- This centralizes the logic that was duplicated in the frontend
CREATE OR REPLACE FUNCTION public.calculate_nutritional_targets(
  _user_id uuid,
  _goal text
)
RETURNS json
LANGUAGE plpgsql
STABLE
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
  _protein_ratio numeric;
  _carbs_ratio numeric;
  _fat_ratio numeric;
BEGIN
  SELECT * INTO _profile FROM profiles WHERE user_id = _user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Profile not found');
  END IF;

  -- BMR (Mifflin-St Jeor)
  IF _profile.sex = 'male' THEN
    _bmr := 10 * COALESCE(_profile.weight, 70) + 6.25 * COALESCE(_profile.height, 170) - 5 * COALESCE(_profile.age, 30) + 5;
  ELSE
    _bmr := 10 * COALESCE(_profile.weight, 60) + 6.25 * COALESCE(_profile.height, 160) - 5 * COALESCE(_profile.age, 30) - 161;
  END IF;

  -- Activity multiplier
  _activity_multiplier := CASE _profile.activity_level
    WHEN 'sedentary' THEN 1.2
    WHEN 'light' THEN 1.375
    WHEN 'moderate' THEN 1.55
    WHEN 'active' THEN 1.725
    WHEN 'very_active' THEN 1.9
    ELSE 1.55
  END;

  _tdee := _bmr * _activity_multiplier;

  -- Calorie adjustment based on goal
  _calorie_adjustment := CASE _goal
    WHEN 'lose_weight' THEN -500
    WHEN 'maintain' THEN 0
    WHEN 'gain_muscle' THEN 300
    ELSE 0
  END;

  _calories := ROUND(_tdee + _calorie_adjustment);

  -- Macro ratios based on goal
  IF _goal = 'gain_muscle' THEN
    _protein_ratio := 0.35; _carbs_ratio := 0.45; _fat_ratio := 0.20;
  ELSIF _goal = 'lose_weight' THEN
    _protein_ratio := 0.35; _carbs_ratio := 0.35; _fat_ratio := 0.30;
  ELSE
    _protein_ratio := 0.30; _carbs_ratio := 0.40; _fat_ratio := 0.30;
  END IF;

  _protein := ROUND((_calories * _protein_ratio) / 4);
  _carbs := ROUND((_calories * _carbs_ratio) / 4);
  _fat := ROUND((_calories * _fat_ratio) / 9);

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

-- Enable realtime on objective_change_requests for professional notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.objective_change_requests;
