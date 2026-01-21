-- ==============================================
-- MIGRAÇÃO: Normalizar processing_level para snake_case
-- e adicionar constraint para garantir consistência
-- ==============================================

-- 1. Normalizar valores existentes para snake_case
UPDATE foods SET processing_level = 'in_natura' WHERE processing_level = 'In natura';
UPDATE foods SET processing_level = 'minimamente_processado' WHERE processing_level = 'Minimamente processado';
UPDATE foods SET processing_level = 'processado' WHERE processing_level = 'Processado';
UPDATE foods SET processing_level = 'ultraprocessado' WHERE processing_level = 'Ultraprocessado';
UPDATE foods SET processing_level = 'suplemento' WHERE processing_level = 'Suplemento';

-- 2. Definir processing_level para alimentos NULL baseado na categoria
-- Suplementos -> suplemento
UPDATE foods 
SET processing_level = 'suplemento' 
WHERE processing_level IS NULL AND category = 'suplementos';

-- Alimentos de origem natural (frutas, vegetais, leguminosas) -> in_natura por padrão
UPDATE foods 
SET processing_level = 'in_natura' 
WHERE processing_level IS NULL AND category IN ('frutas', 'vegetais', 'leguminosas');

-- Laticínios -> minimamente_processado por padrão
UPDATE foods 
SET processing_level = 'minimamente_processado' 
WHERE processing_level IS NULL AND category = 'laticinios';

-- Proteínas (carnes) -> in_natura por padrão
UPDATE foods 
SET processing_level = 'in_natura' 
WHERE processing_level IS NULL AND category = 'proteinas';

-- Carboidratos e gorduras -> minimamente_processado por padrão
UPDATE foods 
SET processing_level = 'minimamente_processado' 
WHERE processing_level IS NULL AND category IN ('carboidratos', 'gorduras');

-- Mistos -> processado por padrão (são preparações)
UPDATE foods 
SET processing_level = 'processado' 
WHERE processing_level IS NULL AND category = 'mistos';

-- 3. Garantir que não sobrou nenhum NULL (fallback)
UPDATE foods 
SET processing_level = 'minimamente_processado' 
WHERE processing_level IS NULL;

-- 4. Adicionar constraint para garantir valores válidos
ALTER TABLE foods ADD CONSTRAINT foods_processing_level_check
CHECK (processing_level IN ('in_natura', 'minimamente_processado', 'processado', 'ultraprocessado', 'suplemento'));