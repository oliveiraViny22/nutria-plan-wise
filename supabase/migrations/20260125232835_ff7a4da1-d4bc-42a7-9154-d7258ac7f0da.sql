-- Fix RLS policies for meal_template_roles to allow admin updates
DROP POLICY IF EXISTS "Admins can manage meal_template_roles" ON meal_template_roles;

CREATE POLICY "Admins can manage meal_template_roles"
ON meal_template_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also fix meal_role_food_categories for admin management
DROP POLICY IF EXISTS "Admins can manage meal_role_food_categories" ON meal_role_food_categories;

CREATE POLICY "Admins can manage meal_role_food_categories"
ON meal_role_food_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also fix meal_templates for admin management
DROP POLICY IF EXISTS "Admins can manage meal_templates" ON meal_templates;

CREATE POLICY "Admins can manage meal_templates"
ON meal_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));