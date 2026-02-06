-- Template: Ceia Padrão
INSERT INTO meal_templates (meal_type, name, description, min_items, max_items, is_active)
VALUES ('supper', 'Ceia Padrão', 'Refeição leve antes de dormir - proteína + fruta/carb leve', 2, 3, true);

-- Roles para Ceia
WITH tpl AS (SELECT id FROM meal_templates WHERE meal_type = 'supper' AND name = 'Ceia Padrão')
INSERT INTO meal_template_roles (template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order)
SELECT tpl.id, role_name, is_required, min_qty, max_qty, sort_order
FROM tpl, (VALUES
  ('proteina_principal', true, 50, 150, 1),
  ('fruta', false, 80, 150, 2),
  ('carboidrato_base', false, 30, 100, 3)
) AS roles(role_name, is_required, min_qty, max_qty, sort_order);

-- Categorias para cada Role
WITH roles AS (
  SELECT r.id, r.role_name 
  FROM meal_template_roles r
  JOIN meal_templates t ON t.id = r.template_id
  WHERE t.meal_type = 'supper' AND t.name = 'Ceia Padrão'
)
INSERT INTO meal_role_food_categories (role_id, category, priority)
SELECT r.id, cat.category, cat.priority
FROM roles r
JOIN (VALUES
  ('proteina_principal', 'proteinas', 1),
  ('proteina_principal', 'laticinios', 2),
  ('fruta', 'frutas', 1),
  ('carboidrato_base', 'carboidratos', 1)
) AS cat(role_name, category, priority) ON r.role_name = cat.role_name;