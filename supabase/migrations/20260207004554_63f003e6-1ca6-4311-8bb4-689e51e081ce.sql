
-- Atualizar a constraint da tabela foods para incluir as novas categorias

-- Remover a constraint atual
ALTER TABLE foods 
DROP CONSTRAINT IF EXISTS foods_category_check;

-- Adicionar nova constraint expandida
ALTER TABLE foods 
ADD CONSTRAINT foods_category_check CHECK (
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
