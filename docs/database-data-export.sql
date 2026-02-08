-- =============================================
-- NutriaPlan Database DATA Export
-- Generated: 2026-02-08
-- Total: 278 foods, 4 plans, 12 templates, 8 policies
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
-- SYSTEM SETTINGS (17 registros)
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
('generator_v58_rollout_percent', '100', 'feature_flags', 'Percentual de usuários que usam generator v5.8 (0-100).', false)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category;

-- =============================================
-- MEAL TEMPLATES (12 registros)
-- =============================================

INSERT INTO public.meal_templates (id, name, meal_type, description, min_items, max_items, is_active) VALUES
('bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'Café da Manhã Padrão', 'breakfast', 'Template padrão para café da manhã equilibrado', 2, 4, true),
('673b8f25-d4b5-4396-bd3b-6b03821f192b', 'Ceia Padrão', 'supper', 'Refeição leve antes de dormir - proteína + fruta/carb leve', 2, 3, true),
('df041732-6f44-4c92-9008-6c8cc8726fca', 'Lanche da Manhã Padrão', 'morning_snack', 'Lanche leve para manter energia até o almoço', 2, 3, true),
('97ebef6f-79c9-4de1-9571-05c0971de9ed', 'Lanche da Tarde Padrão', 'afternoon_snack', 'Lanche equilibrado para energia à tarde', 2, 3, true),
('8bcde5fe-089c-4f67-8390-4d4d1151b163', 'Almoço Padrão', 'lunch', 'Refeição principal do dia com proteína, carboidrato, leguminosa, vegetal e gordura', 3, 6, true),
('5d59d9e3-37b1-460a-8491-ae9ab068078d', 'Jantar Padrão', 'dinner', 'Refeição noturna equilibrada com proteína, carboidrato, leguminosa, vegetal e gordura', 3, 6, true),
('994c3279-6137-442b-bfbe-0e80f0292670', 'Almoço Low Carb', 'lunch', 'Template para dieta low carb - reduz carboidratos e aumenta gorduras boas', 3, 5, true),
('9591b5bf-b937-4835-961c-8de999e83beb', 'Jantar Low Carb', 'dinner', 'Template para dieta low carb - foco em proteínas e vegetais', 3, 5, true),
('2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'Almoço Mediterrâneo', 'lunch', 'Template para dieta mediterrânea - peixes, azeite e vegetais', 4, 6, true),
('2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'Jantar Mediterrâneo', 'dinner', 'Template para dieta mediterrânea - foco em peixes e leguminosas', 4, 6, true),
('ed1ac800-2402-4c85-99a7-eb173d9a0b02', 'Lanche da Manhã Padrão', 'morning_snack', 'Lanche leve com laticínio, fruta e oleaginosas', 2, 4, false),
('414fb320-254b-4ca1-9e90-8a2d8d79fc70', 'Ceia Padrão', 'supper', 'Refeição leve antes de dormir com laticínio e fruta opcional', 1, 3, false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, is_active = EXCLUDED.is_active;

-- =============================================
-- FOODS DATA (278 registros)
-- Categorias: carboidratos, proteinas, peixes, frutas, vegetais, leguminosas, laticinios, gorduras, bebidas
-- =============================================

-- CARBOIDRATOS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Amaranto em grão', 'amaranto_em_grao', 'carboidratos', 371, 13.5, 65.2, 7, '100g', 'food', true, false, NULL, NULL, 1),
('Arroz Branco Cozido', 'arroz_branco_cozido', 'carboidratos', 117, 3.3, 23.5, 1.1, '100g', 'food', true, false, NULL, NULL, 1),
('Arroz Integral', 'arroz_integral', 'carboidratos', 111, 2.6, 23, 0.9, '100g', 'food', true, false, NULL, NULL, 1),
('Arroz Integral Cozido', 'arroz_integral_cozido', 'carboidratos', 112, 2.6, 23.5, 0.9, '100g', 'food', true, false, NULL, NULL, 1),
('Aveia em Flocos', 'aveia_em_flocos', 'carboidratos', 379, 13, 67, 7, '100g', 'food', true, false, NULL, NULL, 1),
('Aveia em Grão Cozido', 'aveia_em_grao_cozido', 'carboidratos', 105, 3.2, 20.2, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Banana da Terra Cozida', 'banana_da_terra_cozida', 'carboidratos', 122, 1.03, 31.09, 0.04, '100g', 'food', true, true, 'unidade', 120, 1),
('Batata Inglesa Cozido', 'batata_inglesa_cozido', 'carboidratos', 128, 3.7, 25.5, 1.2, '100g', 'food', true, false, NULL, NULL, 1),
('Centeio Cozido', 'centeio_cozido', 'carboidratos', 118, 4.3, 24, 1.1, '100g', 'food', true, false, NULL, NULL, 1),
('Cevada Cozido', 'cevada_cozido', 'carboidratos', 123, 2.3, 28, 0.4, '100g', 'food', true, false, NULL, NULL, 1),
('Crepioca', 'crepioca', 'carboidratos', 145, 5, 20, 3.5, '100g', 'food', true, true, 'unidade', 60, 1),
('Cuscuz de Milho', 'cuscuz_de_milho', 'carboidratos', 112, 2.5, 25, 0.3, '100g', 'food', true, false, NULL, NULL, 1),
('Inhame Cozido', 'inhame_cozido', 'carboidratos', 116, 1.5, 27.9, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Macarrão Integral Cozido', 'macarrao_integral_cozido', 'carboidratos', 124, 5.3, 26.5, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Mandioca Cozida', 'mandioca_cozida', 'carboidratos', 125, 0.6, 30.1, 0.3, '100g', 'food', true, false, NULL, NULL, 1),
('Milho Cozido', 'milho_cozido', 'carboidratos', 96, 3.2, 19, 1.4, '100g', 'food', true, false, NULL, NULL, 1),
('Pão de Batata-doce', 'pao_de_batata_doce', 'carboidratos', 238, 5.5, 42, 4.2, '100g', 'food', true, true, 'fatia', 40, 1),
('Pão de Forma Integral', 'pao_de_forma_integral', 'carboidratos', 246, 9, 41, 4.2, '100g', 'food', true, true, 'fatia', 30, 1),
('Pão Francês Integral', 'pao_frances_integral', 'carboidratos', 263, 8.1, 49.9, 2.9, '100g', 'food', true, true, 'unidade', 50, 1),
('Quinoa Cozida', 'quinoa_cozida', 'carboidratos', 120, 4.4, 21.3, 1.9, '100g', 'food', true, false, NULL, NULL, 1),
('Tapioca', 'tapioca', 'carboidratos', 130, 0.5, 31, 0.1, '100g', 'food', true, true, 'unidade', 30, 1),
('Tapioca Pronta', 'tapioca_pronta', 'carboidratos', 130, 0.5, 31, 0.1, '100g', 'food', true, true, 'unidade', 40, 1),
('Trigo Sarraceno Cozido', 'trigo_sarraceno_cozido', 'carboidratos', 92, 3.4, 19.9, 0.6, '100g', 'food', true, false, NULL, NULL, 1),
('Batata-Doce Cozida', 'batatadoce_cozida', 'carboidratos', 77, 1.4, 18.4, 0.14, '100g', 'food', true, false, NULL, NULL, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- PROTEINAS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Acém Cozido', 'acem_cozido', 'proteinas', 212, 26.4, 0, 11.3, '100g', 'food', true, false, NULL, NULL, 1),
('Alcatra Grelhada', 'alcatra_grelhada', 'proteinas', 199, 29.4, 0, 8.3, '100g', 'food', true, true, 'bife', 120, 1),
('Bisteca Suína Grelhada', 'bisteca_suina_grelhada', 'proteinas', 211, 27.6, 0, 10.6, '100g', 'food', true, true, 'bife', 100, 1),
('Carne Bovina Magra', 'carne_bovina_magra', 'proteinas', 143, 26.7, 0, 3.5, '100g', 'food', true, true, 'porção', 100, 1),
('Carne de Patinho', 'carne_de_patinho', 'proteinas', 133, 26.5, 0, 2.7, '100g', 'food', true, true, 'porção', 120, 1),
('Carne Moída Magra', 'carne_moida_magra', 'proteinas', 143, 21, 0, 6.5, '100g', 'food', true, false, NULL, NULL, 1),
('Contrafilé Grelhado', 'contrafile_grelhado', 'proteinas', 251, 28.3, 0, 14.7, '100g', 'food', true, true, 'bife', 120, 1),
('Costela Bovina Cozida', 'costela_bovina_cozida', 'proteinas', 358, 23.7, 0, 28.8, '100g', 'food', true, false, NULL, NULL, 1),
('Coxão Duro Cozido', 'coxao_duro_cozido', 'proteinas', 163, 32.4, 0, 3.2, '100g', 'food', true, false, NULL, NULL, 1),
('Coxão Mole Cozido', 'coxao_mole_cozido', 'proteinas', 167, 30.9, 0, 4.1, '100g', 'food', true, false, NULL, NULL, 1),
('Filé Mignon Grelhado', 'file_mignon_grelhado', 'proteinas', 143, 26, 0, 3.9, '100g', 'food', true, true, 'bife', 120, 1),
('Fraldinha Grelhada', 'fraldinha_grelhada', 'proteinas', 277, 26.5, 0, 18.4, '100g', 'food', true, true, 'bife', 150, 1),
('Frango', 'frango', 'proteinas', 163, 30.9, 0, 3.6, '100g', 'food', true, false, NULL, NULL, 1),
('Frango Cozido', 'frango_cozido', 'proteinas', 163, 30.9, 0, 3.6, '100g', 'food', true, false, NULL, NULL, 1),
('Frango Desfiado', 'frango_desfiado', 'proteinas', 163, 30.9, 0, 3.6, '100g', 'food', true, false, NULL, NULL, 1),
('Lagarto Cozido', 'lagarto_cozido', 'proteinas', 202, 32.2, 0, 7.5, '100g', 'food', true, false, NULL, NULL, 1),
('Lombo Suíno Assado', 'lombo_suino_assado', 'proteinas', 210, 29, 0, 10, '100g', 'food', true, false, NULL, NULL, 1),
('Maminha Grelhada', 'maminha_grelhada', 'proteinas', 175, 28.5, 0, 6.3, '100g', 'food', true, true, 'bife', 150, 1),
('Músculo Cozido', 'musculo_cozido', 'proteinas', 194, 32.3, 0, 6.7, '100g', 'food', true, false, NULL, NULL, 1),
('Omelete', 'omelete', 'proteinas', 154, 10.6, 1.6, 11.7, '100g', 'food', true, true, 'unidade', 80, 1),
('Ovo Cozido', 'ovo_cozido', 'proteinas', 146, 13.3, 0.6, 9.5, '100g', 'food', true, true, 'unidade', 50, 1),
('Ovo Mexido', 'ovo_mexido', 'proteinas', 166, 11.1, 1.6, 12.7, '100g', 'food', true, true, 'porção', 100, 1),
('Paleta Suína Cozida', 'paleta_suina_cozida', 'proteinas', 261, 27.6, 0, 16.2, '100g', 'food', true, false, NULL, NULL, 1),
('Patinho Cozido', 'patinho_cozido', 'proteinas', 168, 31.9, 0, 3.8, '100g', 'food', true, false, NULL, NULL, 1),
('Peito de Frango', 'peito_de_frango', 'proteinas', 159, 31.6, 0, 3.2, '100g', 'food', true, true, 'filé', 150, 0.5),
('Pernil Suíno Assado', 'pernil_suino_assado', 'proteinas', 262, 30.2, 0, 15, '100g', 'food', true, false, NULL, NULL, 1),
('Peru', 'peru', 'proteinas', 209, 23.3, 1.8, 12.1, '100g', 'food', true, false, NULL, NULL, 1),
('Picanha Grelhada', 'picanha_grelhada', 'proteinas', 289, 25.2, 0, 20.5, '100g', 'food', true, true, 'porção', 150, 1),
('Sobrecoxa de Frango', 'sobrecoxa_de_frango', 'proteinas', 215, 26.3, 0, 11.7, '100g', 'food', true, true, 'unidade', 100, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- PEIXES
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Atum', 'atum', 'peixes', 196, 19.4, 1.9, 12.3, '100g', 'food', true, true, 'filé', 120, 0.5),
('Bacalhau Cozido', 'bacalhau_cozido', 'peixes', 136, 29.1, 0, 1.8, '100g', 'food', true, true, 'porção', 120, 1),
('Camarão Cozido', 'camarao_cozido', 'peixes', 91, 19.4, 0, 1.1, '100g', 'food', true, false, NULL, NULL, 1),
('Linguado Grelhado', 'linguado_grelhado', 'peixes', 96, 20.6, 0, 1.1, '100g', 'food', true, true, 'filé', 120, 0.5),
('Merluza Cozida', 'merluza_cozida', 'peixes', 98, 20.2, 0, 1.7, '100g', 'food', true, true, 'filé', 120, 0.5),
('Pescada Branca Grelhada', 'pescada_branca_grelhada', 'peixes', 116, 22.3, 0, 2.7, '100g', 'food', true, true, 'filé', 120, 0.5),
('Robalo Grelhado', 'robalo_grelhado', 'peixes', 124, 23.6, 0, 2.7, '100g', 'food', true, true, 'filé', 150, 0.5),
('Salmão Grelhado', 'salmao_grelhado', 'peixes', 208, 20.4, 0, 13.4, '100g', 'food', true, true, 'filé', 150, 0.5),
('Sardinha Assada', 'sardinha_assada', 'peixes', 164, 24.6, 0, 6.8, '100g', 'food', true, true, 'unidade', 40, 1),
('Tilápia Grelhada', 'tilapia_grelhada', 'peixes', 128, 26.1, 0, 2.6, '100g', 'food', true, true, 'filé', 120, 0.5),
('Truta Grelhada', 'truta_grelhada', 'peixes', 150, 22.9, 0, 5.8, '100g', 'food', true, true, 'filé', 120, 0.5)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- FRUTAS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Abacate', 'abacate', 'frutas', 96, 1.2, 6, 8.4, '100g', 'food', true, false, NULL, NULL, 1),
('Abacaxi', 'abacaxi', 'frutas', 48, 0.9, 12.3, 0.1, '100g', 'food', true, true, 'fatia', 80, 1),
('Açaí Polpa', 'acai_polpa', 'frutas', 58, 0.8, 6.2, 3.9, '100g', 'food', true, false, NULL, NULL, 1),
('Ameixa', 'ameixa', 'frutas', 53, 0.8, 13.0, 0.2, '100g', 'food', true, true, 'unidade', 35, 1),
('Banana', 'banana', 'frutas', 92, 1.4, 23.8, 0.1, '100g', 'food', true, true, 'unidade', 90, 1),
('Banana Prata', 'banana_prata', 'frutas', 98, 1.3, 26, 0.1, '100g', 'food', true, true, 'unidade', 90, 1),
('Cajá', 'caja', 'frutas', 45, 1.2, 9.7, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Caqui', 'caqui', 'frutas', 70, 0.6, 19.3, 0.2, '100g', 'food', true, true, 'unidade', 150, 1),
('Figo', 'figo', 'frutas', 94, 1.5, 22, 0.5, '100g', 'food', true, true, 'unidade', 50, 1),
('Goiaba', 'goiaba', 'frutas', 54, 1.1, 13, 0.4, '100g', 'food', true, true, 'unidade', 150, 1),
('Kiwi', 'kiwi', 'frutas', 51, 1.3, 11.5, 0.6, '100g', 'food', true, true, 'unidade', 80, 1),
('Laranja', 'laranja', 'frutas', 37, 1, 8.9, 0.1, '100g', 'food', true, true, 'unidade', 150, 1),
('Maçã', 'maca', 'frutas', 63, 0.2, 15.2, 0.5, '100g', 'food', true, true, 'unidade', 150, 1),
('Mamão Papaia', 'mamao_papaia', 'frutas', 40, 0.5, 10.4, 0.1, '100g', 'food', true, true, 'fatia', 150, 1),
('Manga', 'manga', 'frutas', 64, 0.4, 16.7, 0.3, '100g', 'food', true, true, 'unidade', 200, 1),
('Maracujá', 'maracuja', 'frutas', 68, 2, 12.3, 2.1, '100g', 'food', true, true, 'unidade', 100, 1),
('Melancia', 'melancia', 'frutas', 33, 0.9, 8.1, 0, '100g', 'food', true, true, 'fatia', 200, 1),
('Melão', 'melao', 'frutas', 29, 0.7, 7.5, 0, '100g', 'food', true, true, 'fatia', 150, 1),
('Morango', 'morango', 'frutas', 30, 0.9, 6.8, 0.3, '100g', 'food', true, false, NULL, NULL, 1),
('Nectarina', 'nectarina', 'frutas', 48, 0.8, 11.8, 0.1, '100g', 'food', true, true, 'unidade', 120, 1),
('Pera', 'pera', 'frutas', 53, 0.6, 14, 0.1, '100g', 'food', true, true, 'unidade', 150, 1),
('Pêssego', 'pessego', 'frutas', 36, 0.8, 9.5, 0.1, '100g', 'food', true, true, 'unidade', 120, 1),
('Tangerina', 'tangerina', 'frutas', 38, 0.8, 9.6, 0.1, '100g', 'food', true, true, 'unidade', 100, 1),
('Uva', 'uva', 'frutas', 53, 0.7, 13.6, 0.7, '100g', 'food', true, false, NULL, NULL, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- VEGETAIS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Abóbora', 'abobora', 'vegetais', 50, 1.9, 9.4, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Abobrinha', 'abobrinha', 'vegetais', 19, 1.3, 3.5, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Acelga', 'acelga', 'vegetais', 14, 1.5, 1.1, 0.4, '100g', 'food', true, false, NULL, NULL, 1),
('Agrião', 'agriao', 'vegetais', 17, 2.7, 2.3, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Alface', 'alface', 'vegetais', 11, 1.3, 1.7, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Berinjela', 'berinjela', 'vegetais', 19, 1.2, 4.5, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Beterraba Cozida', 'beterraba_cozida', 'vegetais', 49, 1.9, 11.1, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Brócolis Cozido', 'brocolis_cozido', 'vegetais', 25, 2.1, 4.4, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Cenoura Cozida', 'cenoura_cozida', 'vegetais', 30, 0.8, 6.7, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Chuchu', 'chuchu', 'vegetais', 57, 1, 12.7, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Couve Refogada', 'couve_refogada', 'vegetais', 90, 2.9, 5.7, 6.3, '100g', 'food', true, false, NULL, NULL, 1),
('Couve-Flor Cozida', 'couveflor_cozida', 'vegetais', 19, 1.4, 4, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Espinafre Cozido', 'espinafre_cozido', 'vegetais', 22, 2.6, 3.8, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Jiló', 'jilo', 'vegetais', 27, 1.4, 7, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Maxixe', 'maxixe', 'vegetais', 10, 1.4, 2.6, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Pepino', 'pepino', 'vegetais', 10, 0.9, 2, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Pimentão', 'pimentao', 'vegetais', 21, 0.9, 4.9, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Quiabo', 'quiabo', 'vegetais', 30, 2, 6.4, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Rabanete', 'rabanete', 'vegetais', 14, 1.1, 2.7, 0.1, '100g', 'food', true, false, NULL, NULL, 1),
('Repolho', 'repolho', 'vegetais', 26, 3, 2.7, 0.4, '100g', 'food', true, false, NULL, NULL, 1),
('Rúcula', 'rucula', 'vegetais', 16, 2.5, 2.2, 0.3, '100g', 'food', true, false, NULL, NULL, 1),
('Salada de Folhas Verdes', 'salada_de_folhas_verdes', 'vegetais', 15, 1.5, 2.5, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Taioba', 'taioba', 'vegetais', 27, 2.7, 3.4, 0.3, '100g', 'food', true, false, NULL, NULL, 1),
('Tomate', 'tomate', 'vegetais', 15, 1.1, 3.1, 0.2, '100g', 'food', true, true, 'unidade', 100, 1),
('Vagem', 'vagem', 'vegetais', 25, 1.8, 5.8, 0.1, '100g', 'food', true, false, NULL, NULL, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- LEGUMINOSAS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Ervilha Cozida', 'ervilha_cozida', 'leguminosas', 63, 4.2, 11.3, 0.2, '100g', 'food', true, false, NULL, NULL, 1),
('Feijão Branco Cozido', 'feijao_branco_cozido', 'leguminosas', 102, 6.7, 18.4, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Feijão Carioca Cozido', 'feijao_carioca_cozido', 'leguminosas', 76, 4.8, 13.6, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Feijão Fradinho Cozido', 'feijao_fradinho_cozido', 'leguminosas', 76, 4.8, 14.1, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Feijão Preto Cozido', 'feijao_preto_cozido', 'leguminosas', 77, 4.5, 14, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Grão-de-Bico Cozido', 'graodebico_cozido', 'leguminosas', 130, 6.3, 21, 2.1, '100g', 'food', true, false, NULL, NULL, 1),
('Lentilha Cozida', 'lentilha_cozida', 'leguminosas', 93, 6.3, 16.3, 0.5, '100g', 'food', true, false, NULL, NULL, 1),
('Soja Cozida', 'soja_cozida', 'leguminosas', 151, 14, 9, 6.4, '100g', 'food', true, false, NULL, NULL, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- LATICINIOS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Iogurte Grego Natural', 'iogurte_grego_natural', 'laticinios', 97, 9, 3.5, 5, '100g', 'food', true, true, 'pote', 170, 0.5),
('Iogurte Natural Integral', 'iogurte_natural_integral', 'laticinios', 61, 4.1, 4.7, 3.2, '100g', 'food', true, true, 'pote', 170, 0.5),
('Iogurte Natural Desnatado', 'iogurte_natural_desnatado', 'laticinios', 40, 4.1, 5.2, 0.3, '100g', 'food', true, true, 'pote', 170, 0.5),
('Leite Desnatado', 'leite_desnatado', 'laticinios', 35, 3.4, 5, 0.1, '100ml', 'food', true, true, 'copo', 200, 0.5),
('Leite Integral', 'leite_integral', 'laticinios', 61, 3.2, 4.7, 3.5, '100ml', 'food', true, true, 'copo', 200, 0.5),
('Queijo Branco', 'queijo_branco', 'laticinios', 253, 17.4, 3.2, 19, '100g', 'food', true, true, 'fatia', 30, 1),
('Queijo Cottage', 'queijo_cottage', 'laticinios', 98, 11.1, 3.4, 4.3, '100g', 'food', true, false, NULL, NULL, 1),
('Queijo Minas Frescal', 'queijo_minas_frescal', 'laticinios', 264, 17.4, 3.2, 20.2, '100g', 'food', true, true, 'fatia', 30, 1),
('Queijo Minas Light', 'queijo_minas_light', 'laticinios', 167, 19.4, 2.5, 9, '100g', 'food', true, true, 'fatia', 30, 1),
('Queijo Ricota', 'queijo_ricota', 'laticinios', 140, 12.6, 3.8, 8, '100g', 'food', true, true, 'fatia', 30, 1),
('Requeijão Light', 'requeijao_light', 'laticinios', 115, 6, 4.4, 8.5, '100g', 'food', true, true, 'colher de sopa', 25, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- GORDURAS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Abacate (gordura)', 'abacate_gordura', 'gorduras', 96, 1.2, 6, 8.4, '100g', 'food', true, true, 'colher de sopa', 30, 1),
('Azeite de Oliva', 'azeite_de_oliva', 'gorduras', 884, 0, 0, 100, '100g', 'food', true, true, 'colher de sopa', 13, 0.5),
('Castanha de Caju', 'castanha_de_caju', 'gorduras', 570, 18.5, 29.1, 46.3, '100g', 'food', true, true, 'unidade', 3, 1),
('Castanha do Pará', 'castanha_do_para', 'gorduras', 643, 14.5, 3.4, 66.4, '100g', 'food', true, true, 'unidade', 5, 1),
('Manteiga', 'manteiga', 'gorduras', 726, 0.9, 0, 82, '100g', 'food', true, true, 'colher de chá', 5, 1),
('Nozes', 'nozes', 'gorduras', 620, 12, 18.4, 59, '100g', 'food', true, true, 'unidade', 4, 1),
('Óleo de Coco', 'oleo_de_coco', 'gorduras', 862, 0, 0, 100, '100g', 'food', true, true, 'colher de sopa', 13, 0.5),
('Pasta de Amendoim', 'pasta_de_amendoim', 'gorduras', 544, 21.6, 22.3, 46, '100g', 'food', true, true, 'colher de sopa', 16, 1),
('Semente de Chia', 'semente_de_chia', 'gorduras', 490, 15.6, 6, 30.8, '100g', 'food', true, true, 'colher de sopa', 12, 1),
('Semente de Linhaça', 'semente_de_linhaca', 'gorduras', 495, 14.1, 0, 32.3, '100g', 'food', true, true, 'colher de sopa', 10, 1)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

-- BEBIDAS
INSERT INTO public.foods (name, canonical_name, category, calories, protein, carbs, fat, serving_size, type, is_active, unit_enabled, unit_name, unit_weight_grams, unit_increment) VALUES
('Água de Coco', 'agua_de_coco', 'bebidas', 22, 0, 5.3, 0, '100ml', 'food', true, true, 'copo', 200, 0.5),
('Café sem Açúcar', 'cafe_sem_acucar', 'bebidas', 2, 0.1, 0, 0, '100ml', 'food', true, true, 'xícara', 50, 1),
('Chá sem Açúcar', 'cha_sem_acucar', 'bebidas', 0, 0, 0, 0, '100ml', 'food', true, true, 'xícara', 200, 1),
('Suco de Laranja Natural', 'suco_de_laranja_natural', 'bebidas', 45, 0.7, 10.4, 0.2, '100ml', 'food', true, true, 'copo', 200, 0.5),
('Vitamina de Banana', 'vitamina_de_banana', 'bebidas', 82, 3.2, 15.1, 1.5, '100ml', 'food', true, true, 'copo', 300, 0.5)
ON CONFLICT (canonical_name) DO UPDATE SET calories = EXCLUDED.calories, protein = EXCLUDED.protein, carbs = EXCLUDED.carbs, fat = EXCLUDED.fat;

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
-- FIM DO EXPORT
-- =============================================
