-- =============================================
-- NutriaPlan Database DATA Export (COMPLETO)
-- Generated: 2026-02-10
-- Total: 249 foods ativos, 22 inativos, 4 plans, 12 templates, 8 policies
-- Categorias: carboidratos(32), proteinas(36), peixes(12), frutas(37), 
--   vegetais(45), leguminosas(13), laticinios(29), gorduras(14),
--   oleaginosas(8), tuberculos(5), suplementos(16), mistos(2)
-- =============================================

-- =============================================
-- ORDEM DE IMPORTAÇÃO:
-- 1. Plans
-- 2. Objective Change Policies
-- 3. System Settings
-- 4. Foods (ativos)
-- 5. Foods (inativos)
-- 6. Meal Templates
-- 7. Meal Template Roles
-- 8. Meal Role Food Categories
-- 9. Meal Contextual Blocks
-- (Âncoras: 1092 registros - exportar via query separada)
-- =============================================

-- =============================================
-- PLANS DATA (4 registros)
-- =============================================

INSERT INTO public.plans (id, name, type, description, price_monthly, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, has_chat, meal_options_limit, is_active) VALUES
('3d921165-337e-4220-afc0-623d02163753', 'Gratuito', 'gratuito', 'Acompanhe seu plano alimentar e tire dúvidas com nossa IA educacional. Ideal para quem está começando.', 0.00, 1, 3, 1, 0, true, 1, true),
('3e58f582-ab43-4fc5-9ca7-2996f1f85acf', 'Plano Pessoal', 'plano_pessoal_pago', 'Plano pago com todas as funcionalidades', 29.90, 1, 999, 999, 999, true, 3, true),
('fd8dc0c5-2f16-4b1e-a772-dd6ffe30f3ac', 'Premium Aluno', 'plano_pessoal_pago', 'Para alunos vinculados a nutricionistas. Acesso ampliado ao chat com IA e histórico estendido.', 4.90, 0, 0, 0, 5, true, 3, true),
('77b91b5c-aac4-4c36-a8ae-f36b1f9c557b', 'Profissional', 'profissional', 'Plano para nutricionistas (dormant)', 99.90, 999, 999, 999, 999, true, 3, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, description = EXCLUDED.description;

-- =============================================
-- OBJECTIVE CHANGE POLICIES (8 registros)
-- =============================================

INSERT INTO public.objective_change_policies (id, profile_type, change_number, cooldown_days) VALUES
('e5bbdbdc-c7f8-49e2-b127-bb2eef0cd0fc', 'plano_pessoal_pago', 1, 14),
('c4f51d7e-4701-432f-a478-97a3844aa90c', 'plano_pessoal_pago', 2, 30),
('baf818d6-ed16-4003-b30d-271e00b629ac', 'plano_pessoal_pago', 3, 60),
('549b30be-5fb0-4d77-ac19-18fe742b59ed', 'plano_pessoal_pago', 4, 90),
('acab4584-5eba-45f0-a53c-03c7c06f0324', 'profissional', 1, 7),
('03544d67-11a0-435e-b8ad-165b2eb0b180', 'profissional', 2, 14),
('c0ad317a-7cc4-45fc-9dff-0ad1e36ee62d', 'profissional', 3, 30),
('dd112f1c-0ea1-4c83-8147-9bb0595c328d', 'profissional', 4, 60)
ON CONFLICT (id) DO UPDATE SET cooldown_days = EXCLUDED.cooldown_days;

-- =============================================
-- SYSTEM SETTINGS (15 registros - excluindo rate_limits transitórios)
-- =============================================

INSERT INTO public.system_settings (key, value, category, description, is_sensitive) VALUES
('site_name', '"NutriaPlan"', 'general', 'Nome do site', false),
('maintenance_mode', 'false', 'general', 'Modo de manutenção ativo', false),
('max_diet_plans_per_user', '5', 'limits', 'Máximo de planos por usuário', false),
('ai_model_default', '"gemini-2.5-flash"', 'ai', 'Modelo de IA padrão', false),
('enable_chat_feature', 'false', 'features', 'Habilitar chat com IA', false),
('enable_professional_signup', 'false', 'features', 'Permitir cadastro de profissionais', false),
('ai_food_validation_enabled', 'false', 'ai', 'Habilitar validação de importação de alimentos via IA', false),
('ai_food_audit_enabled', 'false', 'ai', 'Habilitar auditoria de classificação de alimentos via IA', false),
('ai_nutritional_chat_enabled', 'false', 'ai', 'Habilitar chat nutricional via IA', false),
('ai_meal_plan_enabled', 'true', 'ai', 'Habilitar geração de planos alimentares via IA', false),
('ai_plan_suggestions_enabled', 'true', 'ai', 'Habilitar sugestões de ajustes de plano via IA', false),
('ai_substitution_explanation_enabled', 'true', 'ai', 'Habilitar explicação de substituições via IA', false),
('openai_circuit_breaker_enabled', 'true', 'feature_flags', 'Ativa circuit breaker para chamadas OpenAI. Fallback após 3 falhas consecutivas.', false),
('detailed_metrics_enabled', 'true', 'feature_flags', 'Persiste métricas detalhadas (iterações, convergência) em ai_usage_logs.', false),
('generator_v58_rollout_percent', '100', 'feature_flags', 'Percentual de usuários que usam generator v5.8 (0-100).', false),
('optimizer_macro_settings', '{"fat_floor": 80, "fat_weight": 1, "carbs_floor": 90, "fat_ceiling": 100, "carbs_weight": 1, "carbs_ceiling": 105, "protein_floor": 98, "protein_weight": 3, "calories_weight": 1.5, "protein_ceiling": 103, "calories_tolerance": 5}', 'optimizer', 'Configurações de pisos e tetos de macros para o otimizador bruto', false)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- =============================================
-- MEAL TEMPLATES (12 registros)
-- =============================================

INSERT INTO public.meal_templates (id, name, meal_type, description, min_items, max_items, is_active) VALUES
('bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'Café da Manhã Padrão', 'breakfast', 'Template padrão para café da manhã equilibrado', 2, 4, true),
('df041732-6f44-4c92-9008-6c8cc8726fca', 'Lanche da Manhã Padrão', 'morning_snack', 'Lanche leve para manter energia até o almoço', 2, 3, true),
('8bcde5fe-089c-4f67-8390-4d4d1151b163', 'Almoço Padrão', 'lunch', 'Refeição principal do dia com proteína, carboidrato, leguminosa, vegetal e gordura', 3, 6, true),
('994c3279-6137-442b-bfbe-0e80f0292670', 'Almoço Low Carb', 'lunch', 'Template para dieta low carb - reduz carboidratos e aumenta gorduras boas', 3, 5, true),
('2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'Almoço Mediterrâneo', 'lunch', 'Template para dieta mediterrânea - peixes, azeite e vegetais', 4, 6, true),
('97ebef6f-79c9-4de1-9571-05c0971de9ed', 'Lanche da Tarde Padrão', 'afternoon_snack', 'Lanche equilibrado para energia à tarde', 2, 3, true),
('5d59d9e3-37b1-460a-8491-ae9ab068078d', 'Jantar Padrão', 'dinner', 'Refeição noturna equilibrada com proteína, carboidrato, leguminosa, vegetal e gordura', 3, 6, true),
('9591b5bf-b937-4835-961c-8de999e83beb', 'Jantar Low Carb', 'dinner', 'Template para dieta low carb - foco em proteínas e vegetais', 3, 5, true),
('2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'Jantar Mediterrâneo', 'dinner', 'Template para dieta mediterrânea - foco em peixes e leguminosas', 4, 6, true),
('673b8f25-d4b5-4396-bd3b-6b03821f192b', 'Ceia Padrão', 'supper', 'Refeição leve antes de dormir - proteína + fruta/carb leve', 2, 3, true),
('ed1ac800-2402-4c85-99a7-eb173d9a0b02', 'Lanche da Manhã Padrão', 'morning_snack', 'Lanche leve com laticínio, fruta e oleaginosas', 2, 4, false),
('414fb320-254b-4ca1-9e90-8a2d8d79fc70', 'Ceia Padrão', 'supper', 'Refeição leve antes de dormir com laticínio e fruta opcional', 1, 3, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- =============================================
-- FOODS DATA - ATIVOS (249 registros)
-- Inclui: processing_level, dietary_profile, supplement fields
-- =============================================

-- CARBOIDRATOS (32 ativos)
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, processing_level, dietary_profile, unit_enabled, unit_name, unit_weight_grams, unit_increment, is_supplement_item, supplement_portion, supplement_notes) VALUES
('Amaranto em grão', 'amaranto_em_grao', 'carboidratos', 371, 13.5, 65.2, 7, '100g', 'food', true, 'in_natura', 'vegetarian', false, NULL, NULL, 1, false, NULL, NULL),
('Arroz Branco Cozido', 'arroz_branco_cozido', 'carboidratos', 117, 3.3, 23.5, 1.1, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Arroz Integral', 'arroz_integral', 'carboidratos', 111, 2.6, 23, 0.9, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Aveia em Flocos', 'aveia_em_flocos', 'carboidratos', 379, 13, 67, 7, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, true, '40g (4 colheres)', 'Fibras + carboidrato complexo'),
('Aveia em Grão Cozido', 'aveia_em_grao_cozido', 'carboidratos', 105, 3.2, 20.2, 0.5, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Banana da Terra Cozida', 'banana_da_terra_cozida', 'carboidratos', 122, 1.03, 31.09, 0.04, '100g', 'food', true, 'minimamente_processado', NULL, true, 'unidade', 120, 1, false, NULL, NULL),
('Batata Inglesa Cozido', 'batata_inglesa_cozido', 'carboidratos', 128, 3.7, 25.5, 1.2, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Centeio Cozido', 'centeio_cozido', 'carboidratos', 118, 4.3, 24, 1.1, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Cevada Cozido', 'cevada_cozido', 'carboidratos', 123, 2.3, 28, 0.4, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Crepioca', 'crepioca', 'carboidratos', 145, 8.5, 20, 3.5, '100g', 'food', true, 'processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Cuscuz de Milho Cozido', 'cuscuz_de_milho_cozido', 'carboidratos', 125, 2.6, 26.3, 1, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Granola sem Açúcar', 'granola_sem_acucar', 'carboidratos', 429, 10, 66, 14, '100g', 'food', true, 'processado', NULL, true, 'colher de sopa', 15, 1, false, NULL, NULL),
('Inhame Cozido', 'inhame_cozido', 'carboidratos', 116, 1.5, 27.9, 0.1, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Macarrão Integral Cozido', 'macarrao_integral_cozido', 'carboidratos', 124, 5.3, 26.5, 0.5, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Mandioca Cozida', 'mandioca_cozida', 'carboidratos', 125, 0.6, 30.1, 0.3, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Milho Cozido', 'milho_cozido', 'carboidratos', 96, 3.2, 19, 1.4, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Pão de Batata-doce', 'pao_de_batata_doce', 'carboidratos', 238, 5.5, 42, 4.2, '100g', 'food', true, 'processado', NULL, true, 'fatia', 40, 1, false, NULL, NULL),
('Pão de Forma Integral', 'pao_de_forma_integral', 'carboidratos', 246, 9, 41, 4.2, '100g', 'food', true, 'processado', NULL, true, 'fatia', 30, 1, false, NULL, NULL),
('Pão Francês Integral', 'pao_frances_integral', 'carboidratos', 263, 8.1, 49.9, 2.9, '100g', 'food', true, 'processado', NULL, true, 'unidade', 50, 1, false, NULL, NULL),
('Quinoa Cozida', 'quinoa_cozida', 'carboidratos', 120, 4.4, 21.3, 1.9, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Tapioca', 'tapioca', 'carboidratos', 130, 0.5, 31, 0.1, '100g', 'food', true, 'minimamente_processado', NULL, true, 'unidade', 30, 1, false, NULL, NULL),
('Tapioca Pronta', 'tapioca_pronta', 'carboidratos', 130, 0.5, 31, 0.1, '100g', 'food', true, 'processado', NULL, true, 'unidade', 40, 1, false, NULL, NULL),
('Trigo Sarraceno Cozido', 'trigo_sarraceno_cozido', 'carboidratos', 92, 3.4, 19.9, 0.6, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Batata-Doce Cozida', 'batatadoce_cozida', 'carboidratos', 77, 1.4, 18.4, 0.14, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Cuscuz de Milho', 'cuscuz_de_milho', 'carboidratos', 112, 2.5, 25, 0.3, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Arroz Integral Cozido', 'arroz_integral_cozido', 'carboidratos', 112, 2.6, 23.5, 0.9, '100g', 'food', true, 'minimamente_processado', NULL, false, NULL, NULL, 1, false, NULL, NULL),
('Farinha de Aveia', 'farinha_de_aveia', 'carboidratos', 394, 14, 66, 8, '100g', 'food', true, 'minimamente_processado', NULL, true, 'colher de sopa', 15, 1, false, NULL, NULL),
('Mel', 'mel', 'carboidratos', 304, 0.3, 82, 0, '100g', 'food', true, 'in_natura', NULL, true, 'colher de sopa', 21, 0.5, false, NULL, NULL),
('Pão de Queijo', 'pao_de_queijo', 'carboidratos', 363, 5, 42, 19, '100g', 'food', true, 'processado', NULL, true, 'unidade', 25, 1, false, NULL, NULL),
('Polvilho', 'polvilho', 'carboidratos', 351, 0.4, 87, 0.1, '100g', 'food', true, 'minimamente_processado', NULL, true, 'colher de sopa', 15, 1, false, NULL, NULL),
('Wrap Integral', 'wrap_integral', 'carboidratos', 310, 9, 52, 8, '100g', 'food', true, 'processado', NULL, true, 'unidade', 45, 1, false, NULL, NULL),
('Biscoito de Arroz', 'biscoito_de_arroz', 'carboidratos', 381, 7, 84, 2.6, '100g', 'food', true, 'processado', NULL, true, 'unidade', 8, 1, false, NULL, NULL)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat, processing_level = EXCLUDED.processing_level, dietary_profile = EXCLUDED.dietary_profile;

-- NOTA: As demais categorias (proteinas, peixes, frutas, vegetais, leguminosas,
-- laticinios, gorduras, oleaginosas, tuberculos, suplementos, mistos) seguem o
-- mesmo formato. Para obter o dump completo de todos os 249 alimentos ativos,
-- execute a query:
--
-- SELECT 'INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, processing_level, dietary_profile, unit_enabled, unit_name, unit_weight_grams, unit_increment, is_supplement_item, supplement_portion, supplement_notes) VALUES (' ||
--   quote_literal(name) || ', ' || quote_literal(canonical_name) || ', ' || quote_literal(category) || ', ' ||
--   calories || ', ' || protein || ', ' || carbs || ', ' || fat || ', ' ||
--   quote_literal(coalesce(serving_size, '100g')) || ', ' || quote_literal(coalesce(type, 'food')) || ', ' ||
--   is_active || ', ' || coalesce(quote_literal(processing_level), 'NULL') || ', ' ||
--   coalesce(quote_literal(dietary_profile), 'NULL') || ', ' ||
--   unit_enabled || ', ' || coalesce(quote_literal(unit_name), 'NULL') || ', ' ||
--   coalesce(unit_weight_grams::text, 'NULL') || ', ' || coalesce(unit_increment::text, '1') || ', ' ||
--   is_supplement_item || ', ' || coalesce(quote_literal(supplement_portion), 'NULL') || ', ' ||
--   coalesce(quote_literal(supplement_notes), 'NULL') || ');'
-- FROM foods WHERE is_active = true ORDER BY category, name;

-- =============================================
-- OLEAGINOSAS (8 ativos - categoria expandida)
-- =============================================
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, processing_level, unit_enabled, unit_name, unit_weight_grams, unit_increment, is_supplement_item, supplement_portion, supplement_notes) VALUES
('Amêndoas', 'amendoas', 'oleaginosas', 579, 21, 22, 50, '100g', 'food', true, 'in_natura', true, 'unidade', 1, 1, true, '30g (20 unidades)', 'Vitamina E + magnésio'),
('Amendoim', 'amendoim', 'oleaginosas', 654, 9.6, 11.5, 63.3, '100g', 'food', true, 'in_natura', true, 'unidade', 1.5, 1, false, NULL, NULL),
('Avelã', 'avela', 'oleaginosas', 628, 15, 17, 61, '100g', 'food', true, 'in_natura', true, 'unidade', 1.5, 1, false, NULL, NULL),
('Castanha de Caju', 'castanha_de_caju', 'oleaginosas', 574, 18.2, 30.2, 43.8, '100g', 'food', true, 'in_natura', true, 'unidade', 2, 1, true, '30g (10 unidades)', 'Gordura saudável + minerais'),
('Castanha do Pará', 'castanha_do_para', 'oleaginosas', 656, 14, 12, 66, '100g', 'food', true, 'in_natura', true, 'unidade', 5, 1, true, '20g (4 unidades)', 'Rica em selênio + gordura saudável'),
('Nozes', 'nozes', 'oleaginosas', 654, 15.2, 13.7, 65.2, '100g', 'food', true, 'in_natura', true, 'unidade', 4, 1, true, '30g (6 unidades)', 'Ômega-3 vegetal + antioxidantes'),
('Pasta de Amendoim', 'pasta_de_amendoim', 'oleaginosas', 588, 25, 20, 50, '100g', 'food', true, 'processado', true, 'colher de sopa', 15, 0.5, false, NULL, NULL),
('Pistache', 'pistache', 'oleaginosas', 562, 20, 28, 45, '100g', 'food', true, 'in_natura', true, 'unidade', 1, 1, false, NULL, NULL)
ON CONFLICT (canonical_name) DO UPDATE SET category = EXCLUDED.category, calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- =============================================
-- TUBERCULOS (5 ativos - categoria expandida)
-- =============================================
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, processing_level, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Batata-Doce Cozida (tubérculo)', 'batata_doce_cozida_tuberculo', 'tuberculos', 77, 1.4, 18.4, 0.14, '100g', 'food', true, 'minimamente_processado', false, NULL, NULL, 1),
('Cará Cozido', 'cara_cozido', 'tuberculos', 97, 2, 22.5, 0.1, '100g', 'food', true, 'minimamente_processado', false, NULL, NULL, 1),
('Inhame Cozido (tubérculo)', 'inhame_cozido_tuberculo', 'tuberculos', 116, 1.5, 27.9, 0.1, '100g', 'food', true, 'minimamente_processado', false, NULL, NULL, 1),
('Mandioca Cozida (tubérculo)', 'mandioca_cozida_tuberculo', 'tuberculos', 125, 0.6, 30.1, 0.3, '100g', 'food', true, 'minimamente_processado', false, NULL, NULL, 1),
('Mandioquinha Cozida', 'mandioquinha_cozida', 'tuberculos', 125, 1.05, 24.1, 0.2, '100g', 'food', true, 'minimamente_processado', false, NULL, NULL, 1)
ON CONFLICT (canonical_name) DO UPDATE SET category = EXCLUDED.category, calories = EXCLUDED.calories;

-- =============================================
-- SUPLEMENTOS (16 ativos)
-- =============================================
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, processing_level, unit_enabled) VALUES
('Bebida Proteica Pronta', 'bebida_proteica_pronta', 'suplementos', 160, 25, 8, 3, '330ml', 'food', true, 'suplemento', false),
('Blend Proteico Animal', 'blend_proteico_animal', 'suplementos', 125, 25, 4, 2, '30g', 'food', true, 'suplemento', false),
('Blend Proteico Misto', 'blend_proteico_misto', 'suplementos', 122, 24, 4, 1.5, '30g', 'food', true, 'suplemento', false),
('Blend Proteico Vegetal', 'blend_proteico_vegetal', 'suplementos', 120, 22, 5, 2, '30g', 'food', true, 'suplemento', false),
('Creatina Alimentar', 'creatina_alimentar', 'suplementos', 0, 0, 0, 0, '5g', 'food', true, 'suplemento', false),
('Glutamina', 'glutamina', 'suplementos', 20, 5, 0, 0, '5g', 'food', true, 'suplemento', false),
('Hipercalórico', 'hipercalorico', 'suplementos', 380, 15, 65, 5, '100g', 'food', true, 'suplemento', false),
('Maltodextrina', 'maltodextrina', 'suplementos', 380, 0, 95, 0, '100g', 'food', true, 'suplemento', false),
('Multivitamínico', 'multivitaminico', 'suplementos', 5, 0, 1, 0, '1 cápsula', 'food', true, 'suplemento', false),
('Proteína de Arroz', 'proteina_de_arroz', 'suplementos', 110, 24, 2, 1, '30g', 'food', true, 'suplemento', false),
('Proteína de Ervilha', 'proteina_de_ervilha', 'suplementos', 115, 23, 3, 1.5, '30g', 'food', true, 'suplemento', false),
('Vitamina C', 'vitamina_c', 'suplementos', 5, 0, 1, 0, '1g', 'food', true, 'suplemento', false),
('Vitamina D3', 'vitamina_d3', 'suplementos', 0, 0, 0, 0, '1 cápsula', 'food', true, 'suplemento', false),
('Whey Protein Concentrado', 'whey_protein_concentrado', 'suplementos', 120, 24, 3, 1.5, '30g', 'food', true, 'suplemento', false),
('Whey Protein Hidrolisado', 'whey_protein_hidrolisado', 'suplementos', 115, 26, 2, 0.5, '30g', 'food', true, 'suplemento', false),
('Whey Protein Isolado', 'whey_protein_isolado', 'suplementos', 110, 27, 1, 0.5, '30g', 'food', true, 'suplemento', false)
ON CONFLICT (canonical_name) DO UPDATE SET category = EXCLUDED.category, calories = EXCLUDED.calories;

-- =============================================
-- FOODS INATIVOS (22 registros - para referência)
-- =============================================
-- Estes alimentos estão marcados como is_active=false:
-- Alcachofra Cozida (vegetais), Aspargos Cozidos (vegetais),
-- Atum em Água (proteinas), Batata Doce Crua (carboidratos),
-- Batata Inglesa Crua (carboidratos), Batata-doce Cozido (carboidratos),
-- Clara de ovo cozida (proteinas), Gema de ovo cozida (proteinas),
-- Kiwi (frutas), Leite de Amêndoas (mistos),
-- Leite Desnatado (laticinios), Leite Integral (laticinios),
-- Manga (frutas), Mingau de Aveia (carboidratos),
-- Óleo de Girassol (gorduras), Peito de Peru (proteinas),
-- Pipoca com Água (carboidratos), Quinoa Cozido (carboidratos),
-- Requeijão Cremoso (laticinios), Seitan (proteinas),
-- Tilápia Grelhada (proteinas), Trigo em Grão Cozido (carboidratos)

-- =============================================
-- MEAL CONTEXTUAL BLOCKS (bloqueios por refeição)
-- =============================================

INSERT INTO public.meal_contextual_blocks (meal_type, food_id, keyword, rule_type, scope, notes, is_active) 
SELECT 'breakfast', id, NULL, 'block', 'specific', 'Proteína pesada demais para café da manhã', true 
FROM public.foods WHERE canonical_name IN ('frango', 'frango_cozido', 'peito_de_frango', 'frango_desfiado', 'carne_bovina_magra', 'alcatra_grelhada', 'picanha_grelhada')
ON CONFLICT DO NOTHING;

INSERT INTO public.meal_contextual_blocks (meal_type, food_id, keyword, rule_type, scope, notes, is_active) 
SELECT 'lunch', id, NULL, 'prefer', 'specific', 'Priorizar como fonte de gordura no almoço', true 
FROM public.foods WHERE canonical_name = 'azeite_de_oliva'
ON CONFLICT DO NOTHING;

INSERT INTO public.meal_contextual_blocks (meal_type, food_id, keyword, rule_type, scope, notes, is_active) 
SELECT 'dinner', id, NULL, 'prefer', 'specific', 'Priorizar como fonte de gordura no jantar', true 
FROM public.foods WHERE canonical_name = 'azeite_de_oliva'
ON CONFLICT DO NOTHING;

INSERT INTO public.meal_contextual_blocks (meal_type, food_id, keyword, rule_type, scope, notes, is_active) 
SELECT 'breakfast', id, NULL, 'prefer', 'specific', 'Preferência de gordura para café da manhã', true 
FROM public.foods WHERE canonical_name = 'pasta_de_amendoim'
ON CONFLICT DO NOTHING;

-- =============================================
-- NOTA SOBRE ÂNCORAS (meal_anchor_foods)
-- =============================================
-- São 1092 âncoras ativas distribuídas por 6 meal_types e 8 role_names.
-- Dado o volume, a exportação das âncoras deve ser feita via query direta:
--
-- SELECT 'INSERT INTO public.meal_anchor_foods (meal_type, food_id, role_name, option_number, goal_type, dietary_profile, default_quantity_grams, sort_order, is_active) VALUES (' ||
--   quote_literal(meal_type) || ', ''' || food_id || ''', ' || quote_literal(role_name) || ', ' ||
--   option_number || ', ' || coalesce(quote_literal(goal_type), 'NULL') || ', ' ||
--   coalesce(quote_literal(dietary_profile), 'NULL') || ', ' ||
--   default_quantity_grams || ', ' || sort_order || ', ' || is_active || ');'
-- FROM meal_anchor_foods WHERE is_active = true
-- ORDER BY meal_type, role_name, option_number, sort_order;

-- =============================================
-- MEAL TEMPLATE ROLES (50 registros)
-- =============================================
INSERT INTO meal_template_roles (id, template_id, role_name, sort_order, is_required, min_quantity_grams, max_quantity_grams) VALUES
  -- Café da Manhã Padrão
  ('428edaa4-90ad-4c40-8f01-4f81ce14333e', 'bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'carboidrato_base', 1, true, 30, 150),
  ('96baee73-44c6-485d-ba7c-93a94c4d0e8f', 'bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'proteina_principal', 2, true, 50, 150),
  ('a4cc58e4-b82a-4bc2-9027-0245f3801cc0', 'bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'fruta', 3, false, 80, 150),
  ('21f85ec2-0933-44bd-910d-2a1cf186f98a', 'bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'laticinio', 4, false, 100, 250),
  ('4c006e20-293a-4fcf-b56e-3b28c80f4d13', 'bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'gordura', 5, false, 5, 20),
  ('9671581d-1b0e-4314-9294-877fe91479c8', 'bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'vegetal', 6, false, 30, 80),
  -- Lanche da Manhã Padrão
  ('45b0b8bb-737a-44cb-b6a6-5e28d7e1fc1e', 'df041732-6f44-4c92-9008-6c8cc8726fca', 'proteina_principal', 1, true, 30, 150),
  ('793ea169-79bc-45a4-8dae-dbca7e6bebe4', 'df041732-6f44-4c92-9008-6c8cc8726fca', 'fruta', 2, true, 80, 200),
  ('6ed72d64-2550-46ee-9470-10b4d8fe0e46', 'df041732-6f44-4c92-9008-6c8cc8726fca', 'gordura', 3, false, 10, 30),
  ('682b2cd7-5b4f-44ca-931b-1d05ab316715', 'df041732-6f44-4c92-9008-6c8cc8726fca', 'laticinio', 4, false, 80, 200),
  -- Ceia Padrão (inativa)
  ('b160c8bf-e7a2-477f-9334-832dd18a60d1', '414fb320-254b-4ca1-9e90-8a2d8d79fc70', 'laticinio', 1, true, 100, 200),
  ('5800bbff-60ac-40d4-9884-9ef212285a0a', '414fb320-254b-4ca1-9e90-8a2d8d79fc70', 'fruta', 2, false, 50, 100),
  ('0e8ec18a-707a-4436-b2e3-ebef2d8f5584', '414fb320-254b-4ca1-9e90-8a2d8d79fc70', 'oleaginosa', 3, false, 10, 20),
  -- Almoço Padrão
  ('f23ceda0-9fab-49b3-80f9-45c7cd7595d1', '8bcde5fe-089c-4f67-8390-4d4d1151b163', 'proteina_principal', 1, true, 100, 250),
  ('cdb1cf19-13f3-4fb5-963c-2bb3e7f8b0dd', '8bcde5fe-089c-4f67-8390-4d4d1151b163', 'carboidrato_base', 2, true, 100, 300),
  ('ac36efb9-6375-410f-8905-a36a4ea75945', '8bcde5fe-089c-4f67-8390-4d4d1151b163', 'leguminosa', 3, false, 60, 150),
  ('95e415af-5c23-4f9e-a38c-4f0b35495d35', '8bcde5fe-089c-4f67-8390-4d4d1151b163', 'vegetal', 4, true, 80, 200),
  ('cf7e612c-eb31-4707-8707-79795239176c', '8bcde5fe-089c-4f67-8390-4d4d1151b163', 'gordura', 5, false, 10, 30),
  -- Almoço Low Carb
  ('6ddb2897-7405-4b15-b550-63b293f4317f', '994c3279-6137-442b-bfbe-0e80f0292670', 'proteina_principal', 1, true, 150, 250),
  ('35458e43-12ee-4c7f-9503-54cf6ec0b523', '994c3279-6137-442b-bfbe-0e80f0292670', 'vegetal', 2, true, 150, 300),
  ('f07971c3-651b-4880-9339-21a725b5572e', '994c3279-6137-442b-bfbe-0e80f0292670', 'gordura', 3, true, 30, 80),
  ('33e65980-e08a-4c49-acc9-97618ca42486', '994c3279-6137-442b-bfbe-0e80f0292670', 'carboidrato_base', 4, false, 50, 100),
  -- Almoço Mediterrâneo
  ('cb9e1422-d638-4448-925a-67b8ca2a191e', '2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'proteina_principal', 1, true, 120, 200),
  ('78c7868e-e5e2-4f3f-8823-43d63d8dcd0c', '2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'carboidrato_base', 2, true, 100, 200),
  ('b7ba4d49-4aef-4583-b053-fb71843bfe86', '2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'leguminosa', 3, true, 80, 150),
  ('dd68458b-b549-4bdc-bef5-4a9d3066fbff', '2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'vegetal', 4, true, 100, 200),
  ('30fb861f-9ac7-422b-bbd4-4e6155966bb6', '2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'gordura', 5, true, 20, 50),
  -- Lanche da Tarde Padrão
  ('6df1e496-359b-4b04-b3ea-73fa0de78c7d', '97ebef6f-79c9-4de1-9571-05c0971de9ed', 'proteina_principal', 1, true, 30, 150),
  ('02ad0f7d-b353-404e-9160-a8ce40c09fdb', '97ebef6f-79c9-4de1-9571-05c0971de9ed', 'carboidrato_base', 2, false, 30, 100),
  ('55401163-5e38-41af-bf8f-f78b9ae64773', '97ebef6f-79c9-4de1-9571-05c0971de9ed', 'fruta', 3, true, 80, 200),
  ('66cf0172-695d-4ae6-b22a-a95eb3d463d3', '97ebef6f-79c9-4de1-9571-05c0971de9ed', 'gordura', 4, false, 10, 30),
  ('5aa2aa3d-faf5-4f99-8b26-b9f13e263cae', '97ebef6f-79c9-4de1-9571-05c0971de9ed', 'oleaginosa', 5, false, 10, 30),
  -- Jantar Padrão
  ('53db831c-c930-48e6-a85f-60f741cbb650', '5d59d9e3-37b1-460a-8491-ae9ab068078d', 'proteina_principal', 1, true, 100, 220),
  ('6c8abe73-98ce-4b9d-bed7-3ac5446ad3fd', '5d59d9e3-37b1-460a-8491-ae9ab068078d', 'carboidrato_base', 2, false, 80, 200),
  ('14fe629c-e01c-41e3-a52e-76cb05c2e07e', '5d59d9e3-37b1-460a-8491-ae9ab068078d', 'leguminosa', 3, false, 60, 150),
  ('e53f5c35-e868-42cd-8f54-89ca083e5df6', '5d59d9e3-37b1-460a-8491-ae9ab068078d', 'vegetal', 4, true, 100, 250),
  ('e2d955fc-aa96-4177-af6c-3d25c7a9ac6d', '5d59d9e3-37b1-460a-8491-ae9ab068078d', 'gordura', 5, false, 10, 25),
  -- Jantar Low Carb
  ('af43873e-0fef-4889-8767-30ac0d0f9368', '9591b5bf-b937-4835-961c-8de999e83beb', 'proteina_principal', 1, true, 150, 250),
  ('0476cef6-8a85-4446-a8b4-e38214bad303', '9591b5bf-b937-4835-961c-8de999e83beb', 'vegetal', 2, true, 150, 300),
  ('82767f53-75e2-4018-bf6a-b5959af89860', '9591b5bf-b937-4835-961c-8de999e83beb', 'gordura', 3, true, 30, 80),
  ('f4964c3b-a931-4a01-a84d-e815742532fc', '9591b5bf-b937-4835-961c-8de999e83beb', 'carboidrato_base', 4, false, 50, 100),
  -- Jantar Mediterrâneo
  ('0f992830-c543-4059-aac8-1c6dd24de9b4', '2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'proteina_principal', 1, true, 120, 200),
  ('35b74df6-22e4-4f0f-85fa-63d97df9cbab', '2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'carboidrato_base', 2, true, 100, 200),
  ('f1619b35-4af4-4df1-991a-0db61b2f9ff2', '2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'leguminosa', 3, true, 80, 150),
  ('dc7f3835-8276-4815-bf75-4e8f36aa7cf2', '2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'vegetal', 4, true, 100, 200),
  ('93d52fe9-f292-4672-b946-cdfb43ab78f1', '2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'gordura', 5, true, 20, 50),
  -- Ceia Padrão
  ('12c459e1-9dcb-41c1-b5c0-4d82283d618f', '673b8f25-d4b5-4396-bd3b-6b03821f192b', 'proteina_principal', 1, true, 50, 150),
  ('c6a6a83e-1027-4325-a715-b82b7113cf12', '673b8f25-d4b5-4396-bd3b-6b03821f192b', 'fruta', 2, false, 80, 150),
  ('a3fb62a4-8558-4e8f-9509-d87b0191d617', '673b8f25-d4b5-4396-bd3b-6b03821f192b', 'carboidrato_base', 3, false, 30, 100),
  ('1cda9e1c-c352-40fd-b2c4-db5bc63b84f6', '673b8f25-d4b5-4396-bd3b-6b03821f192b', 'vegetal', 4, false, 50, 200),
  ('706449ba-ea09-43d5-8137-84301633dd38', '673b8f25-d4b5-4396-bd3b-6b03821f192b', 'laticinio', 5, false, 100, 200),
  ('ca2923a6-f884-412c-a544-3f5aebac9fcc', '673b8f25-d4b5-4396-bd3b-6b03821f192b', 'oleaginosa', 6, false, 10, 25)
ON CONFLICT (id) DO UPDATE SET role_name = EXCLUDED.role_name, sort_order = EXCLUDED.sort_order, is_required = EXCLUDED.is_required, min_quantity_grams = EXCLUDED.min_quantity_grams, max_quantity_grams = EXCLUDED.max_quantity_grams;

-- =============================================
-- MEAL ROLE FOOD CATEGORIES e ANCHOR FOODS
-- =============================================
-- Volume muito grande (100+ categories, 1092+ anchors).
-- Extrair do banco ORIGEM com as queries abaixo:
--
-- Role Food Categories:
-- SELECT 'INSERT INTO meal_role_food_categories (id,role_id,category,priority) VALUES ('
--   || quote_literal(id) || ',' || quote_literal(role_id) || ',' || quote_literal(category) || ',' || priority
--   || ') ON CONFLICT (id) DO NOTHING;'
-- FROM meal_role_food_categories ORDER BY role_id, priority;
--
-- Anchor Foods:
-- SELECT 'INSERT INTO meal_anchor_foods (id,meal_type,food_id,option_number,role_name,default_quantity_grams,sort_order,is_active,dietary_profile,goal_type) VALUES ('
--   || quote_literal(id) || ',' || quote_literal(meal_type) || ',' || quote_literal(food_id) || ','
--   || option_number || ',' || quote_literal(role_name) || ',' || default_quantity_grams || ','
--   || sort_order || ',' || is_active || ',' || COALESCE(quote_literal(dietary_profile),'NULL') || ','
--   || COALESCE(quote_literal(goal_type),'NULL')
--   || ') ON CONFLICT (id) DO NOTHING;'
-- FROM meal_anchor_foods WHERE is_active = true ORDER BY meal_type, option_number, sort_order;

-- =============================================
-- ADMINISTRADOR (admin@nutriaplan.com)
-- =============================================
-- PASSO 1: Criar usuário admin via edge function
-- POST /functions/v1/create-admin
-- Body: {"email": "admin@nutriaplan.com", "password": "SUA_SENHA_AQUI"}
--
-- PASSO 2: Após criação, obtenha o user_id gerado e execute:
--
-- UPDATE profiles SET
--   name = 'Administrador',
--   age = 34,
--   sex = 'male',
--   height = 174,
--   weight = 90,
--   goal = 'gain_muscle',
--   activity_level = 'moderate',
--   daily_calories = 3063,
--   protein_target = 172,
--   carbs_target = 441,
--   fat_target = 68,
--   meals_per_day = 6,
--   include_supplements = true,
--   onboarding_completed = true,
--   avoided_foods = ARRAY['Chicória', 'Tremoço'],
--   evening_meal_preference = 'no_preference',
--   snack_preference = 'afternoon_snack'
-- WHERE user_id = '<ADMIN_USER_ID>';
--
-- -- Role admin (create-admin já faz isso automaticamente)
-- -- INSERT INTO user_roles (user_id, role) VALUES ('<ADMIN_USER_ID>', 'admin') ON CONFLICT DO NOTHING;
--
-- -- Subscription: Plano Profissional com status ativo
-- UPDATE subscriptions SET
--   plan_id = '77b91b5c-aac4-4c36-a8ae-f36b1f9c557b',
--   status = 'active',
--   current_period_start = now(),
--   current_period_end = now() + INTERVAL '1 year'
-- WHERE user_id = '<ADMIN_USER_ID>';
--
-- -- Usage override
-- UPDATE user_usage SET
--   meal_options_override = 3
-- WHERE user_id = '<ADMIN_USER_ID>';

-- =============================================
-- FIM DO DATA EXPORT
-- =============================================
