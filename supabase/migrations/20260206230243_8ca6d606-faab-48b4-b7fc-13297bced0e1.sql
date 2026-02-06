-- Template: Café da Manhã Padrão
INSERT INTO meal_templates (meal_type, name, description, min_items, max_items, is_active)
VALUES ('breakfast', 'Café da Manhã Padrão', 'Template padrão para café da manhã equilibrado', 2, 4, true);

-- Roles para Café da Manhã
WITH tpl AS (SELECT id FROM meal_templates WHERE meal_type = 'breakfast' AND name = 'Café da Manhã Padrão')
INSERT INTO meal_template_roles (template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order)
SELECT tpl.id, role_name, is_required, min_qty, max_qty, sort_order
FROM tpl, (VALUES
  ('carboidrato_base', true, 30, 150, 1),
  ('proteina_principal', true, 50, 150, 2),
  ('fruta', false, 80, 150, 3),
  ('laticinios', false, 100, 250, 4),
  ('gordura', false, 5, 20, 5)
) AS roles(role_name, is_required, min_qty, max_qty, sort_order);

-- Categorias para cada Role (usando apenas categorias válidas)
WITH roles AS (
  SELECT r.id, r.role_name 
  FROM meal_template_roles r
  JOIN meal_templates t ON t.id = r.template_id
  WHERE t.meal_type = 'breakfast' AND t.name = 'Café da Manhã Padrão'
)
INSERT INTO meal_role_food_categories (role_id, category, priority)
SELECT r.id, cat.category, cat.priority
FROM roles r
JOIN (VALUES
  ('carboidrato_base', 'carboidratos', 1),
  ('proteina_principal', 'proteinas', 1),
  ('fruta', 'frutas', 1),
  ('laticinios', 'laticinios', 1),
  ('gordura', 'gorduras', 1)
) AS cat(role_name, category, priority) ON r.role_name = cat.role_name;