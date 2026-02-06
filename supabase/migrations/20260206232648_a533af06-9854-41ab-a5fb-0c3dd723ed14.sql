
-- Adicionar role 'vegetal' ao template de Ceia Padrão
WITH tpl AS (SELECT id FROM meal_templates WHERE meal_type = 'supper' AND name = 'Ceia Padrão')
INSERT INTO meal_template_roles (template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order)
SELECT tpl.id, 'vegetal', false, 50, 200, 4
FROM tpl;

-- Adicionar categoria para o role vegetal
WITH role AS (
  SELECT r.id 
  FROM meal_template_roles r
  JOIN meal_templates t ON t.id = r.template_id
  WHERE t.meal_type = 'supper' AND t.name = 'Ceia Padrão' AND r.role_name = 'vegetal'
)
INSERT INTO meal_role_food_categories (role_id, category, priority)
SELECT role.id, 'vegetais', 1
FROM role;
