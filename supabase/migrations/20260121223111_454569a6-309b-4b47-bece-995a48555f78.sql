-- FASE 1: Migração definitiva para categorias canônicas

-- 1. Migrar todos os dados para categorias canônicas
UPDATE foods SET category = 'carboidratos'
WHERE category IN ('Carboidratos', 'cereais_tuberculos', 'cereais', 'tuberculos');

UPDATE foods SET category = 'proteinas'
WHERE category IN ('Proteínas', 'proteinas_animais', 'proteinas_vegetais', 'carnes', 'peixes', 'ovos');

UPDATE foods SET category = 'gorduras'
WHERE category IN ('Gorduras', 'oleos_oleaginosas', 'oleos', 'oleaginosas', 'nuts');

UPDATE foods SET category = 'vegetais'
WHERE category IN ('hortalicas_folhosas', 'legumes', 'verduras', 'Vegetais', 'hortalicas', 'folhosos');

UPDATE foods SET category = 'frutas'
WHERE category IN ('Frutas', 'frutas_frescas', 'frutas_secas');

UPDATE foods SET category = 'laticinios'
WHERE category IN ('Laticínios', 'laticinios', 'Laticinios', 'leite', 'queijos', 'iogurtes');

UPDATE foods SET category = 'leguminosas'
WHERE category IN ('Leguminosas', 'feijoes', 'graos');

UPDATE foods SET category = 'suplementos'
WHERE category IN ('Suplementos', 'supplement', 'supplements');

UPDATE foods SET category = 'mistos'
WHERE category IN ('Mistos', 'mixed', 'outros', 'Outros', 'preparacoes', 'refeicoes_prontas');

-- 2. Qualquer categoria restante não mapeada vai para 'mistos'
UPDATE foods SET category = 'mistos'
WHERE category IS NULL 
   OR category NOT IN ('carboidratos', 'proteinas', 'gorduras', 'vegetais', 'frutas', 'laticinios', 'leguminosas', 'suplementos', 'mistos');

-- 3. Adicionar constraint para travar categorias inválidas
ALTER TABLE foods DROP CONSTRAINT IF EXISTS foods_category_check;
ALTER TABLE foods ADD CONSTRAINT foods_category_check 
CHECK (category IN ('carboidratos', 'proteinas', 'gorduras', 'vegetais', 'frutas', 'laticinios', 'leguminosas', 'suplementos', 'mistos'));

-- 4. Tornar coluna NOT NULL
ALTER TABLE foods ALTER COLUMN category SET NOT NULL;