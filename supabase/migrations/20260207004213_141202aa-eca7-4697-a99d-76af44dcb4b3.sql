
-- Remover a constraint atual
ALTER TABLE meal_role_food_categories 
DROP CONSTRAINT IF EXISTS valid_category;

-- Adicionar nova constraint expandida com todas as categorias
ALTER TABLE meal_role_food_categories 
ADD CONSTRAINT valid_category CHECK (
  category = ANY (ARRAY[
    -- Categorias base
    'carboidratos',
    'proteinas', 
    'gorduras',
    'vegetais',
    'frutas',
    'laticinios',
    'leguminosas',
    'suplementos',
    'mistos',
    -- Novas categorias expandidas
    'peixes',
    'frutos_do_mar',
    'tuberculos',
    'cereais',
    'graos',
    'oleaginosas',
    'ovos',
    'cogumelos',
    'queijos',
    'sementes',
    'bebidas',
    'condimentos',
    'veganos',
    'receitas'
  ])
);
