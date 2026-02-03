-- Atualizar limites de frutas nos lanches (máximo 150g ao invés de 200g)
UPDATE meal_template_roles 
SET max_quantity_grams = 150
WHERE role_name = 'fruta' 
AND template_id IN (
  SELECT id FROM meal_templates 
  WHERE meal_type IN ('morning_snack', 'afternoon_snack')
);

-- Adicionar comentário para documentar a mudança
COMMENT ON TABLE meal_template_roles IS 'v5.8: Limite de frutas em lanches reduzido para 150g para evitar porções excessivas';