-- CORREÇÃO 1: Remover 'gorduras' do papel proteina_leve para lanches
-- O papel proteina_leve deve aceitar apenas laticínios (iogurte, queijo cottage, etc.)
-- Não faz sentido óleos ou castanhas serem considerados "proteína leve"

DELETE FROM meal_role_food_categories 
WHERE role_id IN (
  SELECT mtr.id 
  FROM meal_template_roles mtr
  JOIN meal_templates mt ON mt.id = mtr.template_id
  WHERE mtr.role_name = 'proteina_leve' AND mt.meal_type IN ('morning_snack', 'afternoon_snack')
) AND category = 'gorduras';

-- CORREÇÃO 2: Adicionar 'proteinas' ao proteina_leve para permitir ovos nos lanches
INSERT INTO meal_role_food_categories (role_id, category, priority)
SELECT mtr.id, 'proteinas', 2
FROM meal_template_roles mtr
JOIN meal_templates mt ON mt.id = mtr.template_id
WHERE mtr.role_name = 'proteina_leve' AND mt.meal_type IN ('morning_snack', 'afternoon_snack')
ON CONFLICT DO NOTHING;

-- CORREÇÃO 3: Marcar óleos puros como "opcionais" (não entram em geração automática)
-- Óleos são temperos, não itens principais
UPDATE foods SET is_optional = true
WHERE category = 'gorduras' AND (
  name ILIKE '%óleo%' OR 
  name ILIKE '%manteiga%' OR 
  name ILIKE '%creme de leite%' OR
  name ILIKE '%tahine%' OR
  name ILIKE '%azeite%'
);

-- CORREÇÃO 4: Corrigir dados nutricionais incorretos do Óleo de Girassol
-- Óleo puro não tem proteína nem carboidrato
UPDATE foods 
SET protein = 0, carbs = 0, fat = 100, calories = 884
WHERE name ILIKE '%óleo%';