
-- =====================================================
-- TEMPLATES E ÂNCORAS PARA LANCHES (morning_snack / afternoon_snack)
-- =====================================================

-- 1. CRIAR TEMPLATES
INSERT INTO meal_templates (meal_type, name, description, min_items, max_items, is_active)
VALUES 
  ('morning_snack', 'Lanche da Manhã Padrão', 'Lanche leve para manter energia até o almoço', 2, 3, true),
  ('afternoon_snack', 'Lanche da Tarde Padrão', 'Lanche equilibrado para energia à tarde', 2, 3, true);

-- 2. CRIAR ROLES PARA CADA TEMPLATE
-- Morning Snack
WITH tpl AS (SELECT id FROM meal_templates WHERE meal_type = 'morning_snack' AND name = 'Lanche da Manhã Padrão')
INSERT INTO meal_template_roles (template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order)
SELECT tpl.id, role_name, is_required, min_g, max_g, sort_order
FROM tpl, (VALUES 
  ('proteina_principal', true, 30, 150, 1),
  ('fruta', true, 80, 200, 2),
  ('gordura', false, 10, 30, 3)
) AS roles(role_name, is_required, min_g, max_g, sort_order);

-- Afternoon Snack
WITH tpl AS (SELECT id FROM meal_templates WHERE meal_type = 'afternoon_snack' AND name = 'Lanche da Tarde Padrão')
INSERT INTO meal_template_roles (template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order)
SELECT tpl.id, role_name, is_required, min_g, max_g, sort_order
FROM tpl, (VALUES 
  ('proteina_principal', true, 30, 150, 1),
  ('carboidrato_base', false, 30, 100, 2),
  ('fruta', true, 80, 200, 3),
  ('gordura', false, 10, 30, 4)
) AS roles(role_name, is_required, min_g, max_g, sort_order);

-- 3. MAPEAR CATEGORIAS PARA OS ROLES
WITH roles AS (
  SELECT r.id, r.role_name, t.meal_type
  FROM meal_template_roles r
  JOIN meal_templates t ON t.id = r.template_id
  WHERE t.meal_type IN ('morning_snack', 'afternoon_snack')
)
INSERT INTO meal_role_food_categories (role_id, category, priority)
SELECT r.id, cat.category, cat.priority
FROM roles r
CROSS JOIN LATERAL (
  SELECT category, priority FROM (VALUES
    ('proteina_principal', 'proteinas', 1),
    ('proteina_principal', 'laticinios', 2),
    ('fruta', 'frutas', 1),
    ('gordura', 'gorduras', 1),
    ('carboidrato_base', 'carboidratos', 1)
  ) AS cat_map(role_name, category, priority)
  WHERE cat_map.role_name = r.role_name
) cat;

-- 4. CRIAR ANCHOR FOODS PARA LANCHES
-- =====================================================
-- CUTTING - MORNING SNACK (opções 1-9)
-- =====================================================
INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type, is_active)
VALUES
-- Opção 1: ovo cozido + maçã
('morning_snack', 1, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'cut', true),
('morning_snack', 1, '4ce8a886-63be-47cc-bdf3-d1218b4c7309', 'fruta', 120, 2, 'cut', true),
-- Opção 2: ovo cozido + morango
('morning_snack', 2, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'cut', true),
('morning_snack', 2, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 150, 2, 'cut', true),
-- Opção 3: queijo minas + maçã
('morning_snack', 3, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 50, 1, 'cut', true),
('morning_snack', 3, '4ce8a886-63be-47cc-bdf3-d1218b4c7309', 'fruta', 120, 2, 'cut', true),
-- Opção 4: queijo cottage + morango
('morning_snack', 4, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 80, 1, 'cut', true),
('morning_snack', 4, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 150, 2, 'cut', true),
-- Opção 5: iogurte natural + morango
('morning_snack', 5, 'c717ea31-8507-4135-a0df-6c0227a5e15e', 'proteina_principal', 150, 1, 'cut', true),
('morning_snack', 5, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 100, 2, 'cut', true),
-- Opção 6: iogurte grego + mamão
('morning_snack', 6, 'dd941c85-7bbc-4f2a-8a33-81d5c0df1f6d', 'proteina_principal', 120, 1, 'cut', true),
('morning_snack', 6, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 150, 2, 'cut', true),
-- Opção 7: banana + castanhas
('morning_snack', 7, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 1, 'cut', true),
('morning_snack', 7, '6cb9f882-d9df-4ce8-89d9-4c48108c15ca', 'gordura', 20, 2, 'cut', true),
-- Opção 8: aveia + morango
('morning_snack', 8, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 30, 1, 'cut', true),
('morning_snack', 8, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 150, 2, 'cut', true),
-- Opção 9: pera + queijo cottage
('morning_snack', 9, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 80, 1, 'cut', true),
('morning_snack', 9, '46ea446b-c42e-43fd-9ffb-fcd00a00cd72', 'fruta', 150, 2, 'cut', true);

-- =====================================================
-- CUTTING - AFTERNOON SNACK (opções 1-9)
-- =====================================================
INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type, is_active)
VALUES
-- Opção 1: ovo cozido + pera
('afternoon_snack', 1, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'cut', true),
('afternoon_snack', 1, '46ea446b-c42e-43fd-9ffb-fcd00a00cd72', 'fruta', 150, 2, 'cut', true),
-- Opção 2: ovo cozido + mamão
('afternoon_snack', 2, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'cut', true),
('afternoon_snack', 2, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 200, 2, 'cut', true),
-- Opção 3: queijo minas + morango
('afternoon_snack', 3, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 50, 1, 'cut', true),
('afternoon_snack', 3, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 150, 2, 'cut', true),
-- Opção 4: queijo cottage + mamão
('afternoon_snack', 4, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 80, 1, 'cut', true),
('afternoon_snack', 4, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 200, 2, 'cut', true),
-- Opção 5: iogurte natural + maçã
('afternoon_snack', 5, 'c717ea31-8507-4135-a0df-6c0227a5e15e', 'proteina_principal', 150, 1, 'cut', true),
('afternoon_snack', 5, '4ce8a886-63be-47cc-bdf3-d1218b4c7309', 'fruta', 120, 2, 'cut', true),
-- Opção 6: iogurte grego + morango
('afternoon_snack', 6, 'dd941c85-7bbc-4f2a-8a33-81d5c0df1f6d', 'proteina_principal', 120, 1, 'cut', true),
('afternoon_snack', 6, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 150, 2, 'cut', true),
-- Opção 7: banana + queijo cottage
('afternoon_snack', 7, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 80, 1, 'cut', true),
('afternoon_snack', 7, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 2, 'cut', true),
-- Opção 8: aveia + mamão
('afternoon_snack', 8, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 30, 1, 'cut', true),
('afternoon_snack', 8, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 200, 2, 'cut', true),
-- Opção 9: castanhas + pera
('afternoon_snack', 9, '6cb9f882-d9df-4ce8-89d9-4c48108c15ca', 'gordura', 25, 1, 'cut', true),
('afternoon_snack', 9, '46ea446b-c42e-43fd-9ffb-fcd00a00cd72', 'fruta', 150, 2, 'cut', true);

-- =====================================================
-- MANUTENÇÃO - MORNING SNACK (opções 10-18)
-- =====================================================
INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type, is_active)
VALUES
-- Opção 10: ovo cozido + banana
('morning_snack', 10, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'maintain', true),
('morning_snack', 10, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 2, 'maintain', true),
-- Opção 11: queijo minas + banana
('morning_snack', 11, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 60, 1, 'maintain', true),
('morning_snack', 11, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 2, 'maintain', true),
-- Opção 12: iogurte natural + banana
('morning_snack', 12, 'c717ea31-8507-4135-a0df-6c0227a5e15e', 'proteina_principal', 170, 1, 'maintain', true),
('morning_snack', 12, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 2, 'maintain', true),
-- Opção 13: iogurte grego + aveia + morango
('morning_snack', 13, 'dd941c85-7bbc-4f2a-8a33-81d5c0df1f6d', 'proteina_principal', 120, 1, 'maintain', true),
('morning_snack', 13, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 25, 2, 'maintain', true),
('morning_snack', 13, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 100, 3, 'maintain', true),
-- Opção 14: pão integral + queijo minas
('morning_snack', 14, 'dd7a0218-da18-4992-89be-b7e81f93f585', 'carboidrato_base', 50, 1, 'maintain', true),
('morning_snack', 14, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 40, 2, 'maintain', true),
-- Opção 15: pão integral + ovo cozido
('morning_snack', 15, 'dd7a0218-da18-4992-89be-b7e81f93f585', 'carboidrato_base', 50, 1, 'maintain', true),
('morning_snack', 15, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'maintain', true),
-- Opção 16: tapioca + queijo minas
('morning_snack', 16, 'b6b11a63-b195-4bba-b19c-8c5582b11225', 'carboidrato_base', 50, 1, 'maintain', true),
('morning_snack', 16, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 50, 2, 'maintain', true),
-- Opção 17: aveia + banana
('morning_snack', 17, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 40, 1, 'maintain', true),
('morning_snack', 17, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 2, 'maintain', true),
-- Opção 18: banana + castanhas
('morning_snack', 18, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 1, 'maintain', true),
('morning_snack', 18, '6cb9f882-d9df-4ce8-89d9-4c48108c15ca', 'gordura', 25, 2, 'maintain', true);

-- =====================================================
-- MANUTENÇÃO - AFTERNOON SNACK (opções 10-18)
-- =====================================================
INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type, is_active)
VALUES
-- Opção 10: ovo cozido + mamão
('afternoon_snack', 10, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'maintain', true),
('afternoon_snack', 10, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 200, 2, 'maintain', true),
-- Opção 11: queijo minas + mamão
('afternoon_snack', 11, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 60, 1, 'maintain', true),
('afternoon_snack', 11, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 200, 2, 'maintain', true),
-- Opção 12: queijo cottage + morango
('afternoon_snack', 12, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 100, 1, 'maintain', true),
('afternoon_snack', 12, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 150, 2, 'maintain', true),
-- Opção 13: cuscuz + ovo cozido
('afternoon_snack', 13, '037bf943-67fc-42d6-8f56-8db1ad05e8b6', 'carboidrato_base', 80, 1, 'maintain', true),
('afternoon_snack', 13, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'maintain', true),
-- Opção 14: morango + queijo minas
('afternoon_snack', 14, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 50, 1, 'maintain', true),
('afternoon_snack', 14, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 200, 2, 'maintain', true),
-- Opção 15: mamão + iogurte natural
('afternoon_snack', 15, 'c717ea31-8507-4135-a0df-6c0227a5e15e', 'proteina_principal', 170, 1, 'maintain', true),
('afternoon_snack', 15, 'b9456e65-a1d6-4e86-9d26-0a4a3a8d8f28', 'fruta', 200, 2, 'maintain', true),
-- Opção 16: pera + queijo cottage
('afternoon_snack', 16, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 100, 1, 'maintain', true),
('afternoon_snack', 16, '46ea446b-c42e-43fd-9ffb-fcd00a00cd72', 'fruta', 150, 2, 'maintain', true),
-- Opção 17: ovo cozido + morango
('afternoon_snack', 17, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'maintain', true),
('afternoon_snack', 17, '8fc49243-d163-4f0f-a3b0-f464dcc2a35e', 'fruta', 200, 2, 'maintain', true),
-- Opção 18: ovo mexido + banana
('afternoon_snack', 18, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'maintain', true),
('afternoon_snack', 18, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 2, 'maintain', true);

-- =====================================================
-- HIPERTROFIA - MORNING SNACK (opções 19-27)
-- =====================================================
INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type, is_active)
VALUES
-- Opção 19: ovo + banana
('morning_snack', 19, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 90, 1, 'bulk', true),
('morning_snack', 19, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 150, 2, 'bulk', true),
-- Opção 20: batata-doce + ovo cozido
('morning_snack', 20, 'cb57b49c-fc72-4e53-8389-6ac7feba06c2', 'carboidrato_base', 150, 1, 'bulk', true),
('morning_snack', 20, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 90, 2, 'bulk', true),
-- Opção 21: iogurte grego + aveia + banana
('morning_snack', 21, 'dd941c85-7bbc-4f2a-8a33-81d5c0df1f6d', 'proteina_principal', 150, 1, 'bulk', true),
('morning_snack', 21, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 40, 2, 'bulk', true),
('morning_snack', 21, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 3, 'bulk', true),
-- Opção 22: whey protein + aveia + banana
('morning_snack', 22, '43c44da4-fac8-47f2-911b-f55be8c93167', 'proteina_principal', 30, 1, 'bulk', true),
('morning_snack', 22, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 50, 2, 'bulk', true),
('morning_snack', 22, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 3, 'bulk', true),
-- Opção 23: pão integral + ovo + queijo muçarela
('morning_snack', 23, 'dd7a0218-da18-4992-89be-b7e81f93f585', 'carboidrato_base', 75, 1, 'bulk', true),
('morning_snack', 23, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'bulk', true),
('morning_snack', 23, 'a4480770-d89e-4012-ae69-1a99d8f1934a', 'gordura', 30, 3, 'bulk', true),
-- Opção 24: pão francês + ovo + queijo
('morning_snack', 24, 'aa16f763-b7c5-4323-8dfe-7fdccb96bbce', 'carboidrato_base', 75, 1, 'bulk', true),
('morning_snack', 24, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'bulk', true),
('morning_snack', 24, 'a4480770-d89e-4012-ae69-1a99d8f1934a', 'gordura', 30, 3, 'bulk', true),
-- Opção 25: cuscuz + ovo + banana
('morning_snack', 25, '037bf943-67fc-42d6-8f56-8db1ad05e8b6', 'carboidrato_base', 120, 1, 'bulk', true),
('morning_snack', 25, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'bulk', true),
('morning_snack', 25, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 3, 'bulk', true),
-- Opção 26: aveia + banana + castanhas
('morning_snack', 26, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 50, 1, 'bulk', true),
('morning_snack', 26, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 2, 'bulk', true),
('morning_snack', 26, '6cb9f882-d9df-4ce8-89d9-4c48108c15ca', 'gordura', 25, 3, 'bulk', true),
-- Opção 27: pão integral + ovo cozido + banana
('morning_snack', 27, 'dd7a0218-da18-4992-89be-b7e81f93f585', 'carboidrato_base', 75, 1, 'bulk', true),
('morning_snack', 27, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'bulk', true),
('morning_snack', 27, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 3, 'bulk', true);

-- =====================================================
-- HIPERTROFIA - AFTERNOON SNACK (opções 19-27)
-- =====================================================
INSERT INTO meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order, goal_type, is_active)
VALUES
-- Opção 19: ovo + banana-da-terra
('afternoon_snack', 19, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 90, 1, 'bulk', true),
('afternoon_snack', 19, '08c339ef-7ee7-4ec5-bbfc-6913b4116b13', 'carboidrato_base', 150, 2, 'bulk', true),
-- Opção 20: inhame + ovo cozido
('afternoon_snack', 20, '1f5198b1-1219-4ac4-9c01-47bc94fcd107', 'carboidrato_base', 150, 1, 'bulk', true),
('afternoon_snack', 20, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 90, 2, 'bulk', true),
-- Opção 21: banana-da-terra + queijo minas
('afternoon_snack', 21, '08c339ef-7ee7-4ec5-bbfc-6913b4116b13', 'carboidrato_base', 150, 1, 'bulk', true),
('afternoon_snack', 21, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 60, 2, 'bulk', true),
-- Opção 22: batata-doce + queijo minas
('afternoon_snack', 22, 'cb57b49c-fc72-4e53-8389-6ac7feba06c2', 'carboidrato_base', 150, 1, 'bulk', true),
('afternoon_snack', 22, '94704997-5123-4a69-be06-d055d32894a0', 'proteina_principal', 60, 2, 'bulk', true),
-- Opção 23: inhame + queijo cottage
('afternoon_snack', 23, '1f5198b1-1219-4ac4-9c01-47bc94fcd107', 'carboidrato_base', 150, 1, 'bulk', true),
('afternoon_snack', 23, 'b1d2fab1-137a-4448-b2ff-02df42a54354', 'proteina_principal', 100, 2, 'bulk', true),
-- Opção 24: ovo + banana-da-terra (variação)
('afternoon_snack', 24, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 90, 1, 'bulk', true),
('afternoon_snack', 24, '08c339ef-7ee7-4ec5-bbfc-6913b4116b13', 'carboidrato_base', 180, 2, 'bulk', true),
-- Opção 25: ovo cozido + aveia + banana
('afternoon_snack', 25, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 1, 'bulk', true),
('afternoon_snack', 25, '53d4ea90-5acf-4a5b-b453-333edb9ea501', 'carboidrato_base', 40, 2, 'bulk', true),
('afternoon_snack', 25, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 3, 'bulk', true),
-- Opção 26: cuscuz + ovo cozido + banana
('afternoon_snack', 26, '037bf943-67fc-42d6-8f56-8db1ad05e8b6', 'carboidrato_base', 120, 1, 'bulk', true),
('afternoon_snack', 26, '4d4a3665-d666-4361-9115-187755bacb4b', 'proteina_principal', 60, 2, 'bulk', true),
('afternoon_snack', 26, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 100, 3, 'bulk', true),
-- Opção 27: iogurte grego + banana + castanhas
('afternoon_snack', 27, 'dd941c85-7bbc-4f2a-8a33-81d5c0df1f6d', 'proteina_principal', 150, 1, 'bulk', true),
('afternoon_snack', 27, '8a194e4c-4f4b-4caf-8c49-28b551a26098', 'fruta', 120, 2, 'bulk', true),
('afternoon_snack', 27, '6cb9f882-d9df-4ce8-89d9-4c48108c15ca', 'gordura', 25, 3, 'bulk', true);
