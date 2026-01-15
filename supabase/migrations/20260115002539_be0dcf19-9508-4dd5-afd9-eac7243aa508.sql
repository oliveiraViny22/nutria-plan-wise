-- Drop existing restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can insert their own diet plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Users can view their own diet plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Users can update their own diet plans" ON public.diet_plans;
DROP POLICY IF EXISTS "Users can delete their own diet plans" ON public.diet_plans;

-- Recreate as permissive policies (default)
CREATE POLICY "Users can insert their own diet plans"
ON public.diet_plans FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own diet plans"
ON public.diet_plans FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own diet plans"
ON public.diet_plans FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own diet plans"
ON public.diet_plans FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Also add service role bypass for edge functions
CREATE POLICY "Service role can manage diet plans"
ON public.diet_plans FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Do the same for meals table
DROP POLICY IF EXISTS "Users can insert meals to their diet plans" ON public.meals;
DROP POLICY IF EXISTS "Users can view meals of their diet plans" ON public.meals;
DROP POLICY IF EXISTS "Users can update meals of their diet plans" ON public.meals;
DROP POLICY IF EXISTS "Users can delete meals of their diet plans" ON public.meals;

CREATE POLICY "Users can insert meals to their diet plans"
ON public.meals FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Users can view meals of their diet plans"
ON public.meals FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Users can update meals of their diet plans"
ON public.meals FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Users can delete meals of their diet plans"
ON public.meals FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Service role can manage meals"
ON public.meals FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Same for meal_foods
DROP POLICY IF EXISTS "Users can insert meal_foods to their meals" ON public.meal_foods;
DROP POLICY IF EXISTS "Users can view meal_foods of their meals" ON public.meal_foods;
DROP POLICY IF EXISTS "Users can update meal_foods of their meals" ON public.meal_foods;
DROP POLICY IF EXISTS "Users can delete meal_foods of their meals" ON public.meal_foods;

CREATE POLICY "Users can insert meal_foods to their meals"
ON public.meal_foods FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM meals JOIN diet_plans ON diet_plans.id = meals.diet_plan_id WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Users can view meal_foods of their meals"
ON public.meal_foods FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM meals JOIN diet_plans ON diet_plans.id = meals.diet_plan_id WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Users can update meal_foods of their meals"
ON public.meal_foods FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM meals JOIN diet_plans ON diet_plans.id = meals.diet_plan_id WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Users can delete meal_foods of their meals"
ON public.meal_foods FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM meals JOIN diet_plans ON diet_plans.id = meals.diet_plan_id WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()));

CREATE POLICY "Service role can manage meal_foods"
ON public.meal_foods FOR ALL
TO service_role
USING (true)
WITH CHECK (true);