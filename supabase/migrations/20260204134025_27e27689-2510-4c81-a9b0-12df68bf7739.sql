
-- Tornar o papel "gordura" do almoço opcional (não obrigatório)
-- Isso evita que o abacate apareça sempre no almoço e jantar

UPDATE meal_template_roles 
SET is_required = false
WHERE id = '598ecc60-73ff-445a-86f1-cea46ba4199e'
AND role_name = 'gordura';

-- Adicionar comentário no audit log
INSERT INTO admin_audit_log (user_id, action, entity_type, entity_id, old_value, new_value)
SELECT 
  '8cdd8f22-a342-4425-9ce8-05bd6c3ce9c5',
  'update',
  'meal_template_roles',
  '598ecc60-73ff-445a-86f1-cea46ba4199e',
  '{"is_required": true}'::jsonb,
  '{"is_required": false, "reason": "Evitar abacate duplicado no almoço e jantar"}'::jsonb;
