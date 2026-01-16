-- Add released_to_student field to diet_plans
ALTER TABLE public.diet_plans 
ADD COLUMN IF NOT EXISTS released_to_student boolean NOT NULL DEFAULT false;

-- Add RLS policy for professionals to view their students' diet plans
CREATE POLICY "Professionals can view their students diet plans"
ON public.diet_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.professional_students ps
    WHERE ps.student_id = diet_plans.user_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
);

-- Add RLS policy for professionals to manage their students' diet plans
CREATE POLICY "Professionals can manage their students diet plans"
ON public.diet_plans
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.professional_students ps
    WHERE ps.student_id = diet_plans.user_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.professional_students ps
    WHERE ps.student_id = diet_plans.user_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
);

-- Add RLS policy for professionals to view their students' meals
CREATE POLICY "Professionals can view their students meals"
ON public.meals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.diet_plans dp
    JOIN public.professional_students ps ON ps.student_id = dp.user_id
    WHERE dp.id = meals.diet_plan_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
);

-- Add RLS policy for professionals to manage their students' meals
CREATE POLICY "Professionals can manage their students meals"
ON public.meals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.diet_plans dp
    JOIN public.professional_students ps ON ps.student_id = dp.user_id
    WHERE dp.id = meals.diet_plan_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.diet_plans dp
    JOIN public.professional_students ps ON ps.student_id = dp.user_id
    WHERE dp.id = meals.diet_plan_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
);

-- Add RLS policy for professionals to view their students' meal_foods
CREATE POLICY "Professionals can view their students meal_foods"
ON public.meal_foods
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
    JOIN public.professional_students ps ON ps.student_id = dp.user_id
    WHERE m.id = meal_foods.meal_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
);

-- Add RLS policy for professionals to manage their students' meal_foods
CREATE POLICY "Professionals can manage their students meal_foods"
ON public.meal_foods
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
    JOIN public.professional_students ps ON ps.student_id = dp.user_id
    WHERE m.id = meal_foods.meal_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meals m
    JOIN public.diet_plans dp ON dp.id = m.diet_plan_id
    JOIN public.professional_students ps ON ps.student_id = dp.user_id
    WHERE m.id = meal_foods.meal_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
    AND has_role(auth.uid(), 'professional'::app_role)
    AND has_active_license(auth.uid())
  )
);