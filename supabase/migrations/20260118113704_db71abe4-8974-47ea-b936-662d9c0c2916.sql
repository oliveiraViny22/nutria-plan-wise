
-- Add missing indexes to optimize RLS policy joins that are causing timeouts

-- Index on meal_option_foods.food_id for the JOIN to foods
CREATE INDEX IF NOT EXISTS idx_meal_option_foods_food_id 
ON public.meal_option_foods(food_id);

-- Index on meals.diet_plan_id for JOINs in RLS policies
CREATE INDEX IF NOT EXISTS idx_meals_diet_plan_id 
ON public.meals(diet_plan_id);

-- Index on diet_plans.user_id for RLS policy lookups
CREATE INDEX IF NOT EXISTS idx_diet_plans_user_id 
ON public.diet_plans(user_id);

-- Index on profiles.user_id for RLS policy lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles(user_id);

-- Index on profiles.professional_id for professional RLS lookups
CREATE INDEX IF NOT EXISTS idx_profiles_professional_id 
ON public.profiles(professional_id);

-- Index on professional_students for faster lookups
CREATE INDEX IF NOT EXISTS idx_professional_students_professional_id 
ON public.professional_students(professional_id);

CREATE INDEX IF NOT EXISTS idx_professional_students_student_id 
ON public.professional_students(student_id);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_professional_students_status_lookup 
ON public.professional_students(professional_id, student_id, status);
