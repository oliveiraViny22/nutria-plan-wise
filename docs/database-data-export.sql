-- =====================================================
-- NUTRIAPLAN - EXPORTAÇÃO COMPLETA DE DADOS v2
-- Data: 2026-02-10
-- Versão: v2 (banco normalizado)
-- =====================================================
-- ORDEM DE IMPORTAÇÃO:
-- 1. Esquema (docs/database-schema-export.sql)
-- 2. Este arquivo (dados semente)
-- 3. Alimentos (docs/foods-import.sql)
-- 4. Dados volumétricos (anchor foods + contextual blocks via query de geração)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. PLANOS COMERCIAIS (plans) - 4 registros
-- =====================================================
INSERT INTO public.plans (id, name, type, description, diet_limit, substitution_limit, adjustment_limit, has_chat, chat_messages_per_day, meal_options_limit, price_monthly, is_active, stripe_product_id, stripe_price_monthly)
VALUES
  ('3d921165-337e-4220-afc0-623d02163753', 'Gratuito', 'gratuito', 'Acompanhe seu plano alimentar e tire dúvidas com nossa IA educacional. Ideal para quem está começando.', 1, 3, 1, true, 0, 1, 0.00, true, NULL, NULL),
  ('3e58f582-ab43-4fc5-9ca7-2996f1f85acf', 'Plano Pessoal', 'plano_pessoal_pago', 'Plano pago com todas as funcionalidades', 1, 999, 999, true, 999, 3, 29.90, true, NULL, NULL),
  ('77b91b5c-aac4-4c36-a8ae-f36b1f9c557b', 'Profissional', 'profissional', 'Plano para nutricionistas (dormant)', 999, 999, 999, true, 999, 3, 99.90, false, NULL, NULL),
  ('fd8dc0c5-2f16-4b1e-a772-dd6ffe30f3ac', 'Premium Aluno', 'plano_pessoal_pago', 'Para alunos vinculados a nutricionistas. Acesso ampliado ao chat com IA e histórico estendido.', 0, 0, 0, true, 5, 3, 4.90, true, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, type = EXCLUDED.type, description = EXCLUDED.description,
  diet_limit = EXCLUDED.diet_limit, substitution_limit = EXCLUDED.substitution_limit,
  adjustment_limit = EXCLUDED.adjustment_limit, has_chat = EXCLUDED.has_chat,
  chat_messages_per_day = EXCLUDED.chat_messages_per_day, meal_options_limit = EXCLUDED.meal_options_limit,
  price_monthly = EXCLUDED.price_monthly, is_active = EXCLUDED.is_active;

-- =====================================================
-- 2. CONFIGURAÇÕES DO SISTEMA (system_settings) - 16 registros
-- Exclui rate_limits (efêmeros por usuário)
-- =====================================================
INSERT INTO public.system_settings (id, key, value, category, description, is_sensitive)
VALUES
  ('b557f628-eac1-41bb-b4e5-e36c9371e0a6', 'ai_food_audit_enabled', 'false', 'ai', 'Habilitar auditoria de classificação de alimentos via IA', false),
  ('d1580b76-4061-4485-8cff-540040e3e1d1', 'ai_food_validation_enabled', 'false', 'ai', 'Habilitar validação de importação de alimentos via IA', false),
  ('208a4461-c709-49b2-be02-ef5a0b31ca44', 'ai_meal_plan_enabled', 'true', 'ai', 'Habilitar geração de planos alimentares via IA', false),
  ('bcf6e191-4e8b-44ec-b48c-f7f06167c64e', 'ai_model_default', '"gemini-2.5-flash"', 'ai', 'Modelo de IA padrão', false),
  ('043588b8-e700-4f81-8d73-8eb6ddd8565e', 'ai_nutritional_chat_enabled', 'false', 'ai', 'Habilitar chat nutricional via IA', false),
  ('907e034d-af80-4d45-b84b-8b1d6ef9f75c', 'ai_plan_suggestions_enabled', 'true', 'ai', 'Habilitar sugestões de ajustes de plano via IA', false),
  ('f4e2ebd7-ef33-4d15-ad0d-724825f80e53', 'ai_substitution_explanation_enabled', 'true', 'ai', 'Habilitar explicação de substituições via IA', false),
  ('16635374-6899-485d-bd6d-38d5e54b1f7a', 'detailed_metrics_enabled', 'true', 'feature_flags', 'Persiste métricas detalhadas em ai_usage_logs.', false),
  ('9aa4a204-50e5-471d-8f22-b8a5b1d787a1', 'generator_v58_rollout_percent', '100', 'feature_flags', 'Percentual de usuários que usam generator v5.8 (0-100).', false),
  ('19b38e73-752a-4421-8ee1-91ebc6a4a273', 'openai_circuit_breaker_enabled', 'true', 'feature_flags', 'Ativa circuit breaker para chamadas OpenAI.', false),
  ('583036e4-74ed-411c-8563-30e4f8cdf911', 'enable_chat_feature', 'false', 'features', 'Habilitar chat com IA', false),
  ('b466b719-4823-4803-9fd1-97c9b4c815e7', 'enable_professional_signup', 'false', 'features', 'Permitir cadastro de profissionais', false),
  ('b7742600-e9b0-4175-b353-d525d84ced2f', 'maintenance_mode', 'false', 'general', 'Modo de manutenção ativo', false),
  ('85cb4990-39f5-4280-b574-05f045d8ff8f', 'site_name', '"NutriaPlan"', 'general', 'Nome do site', false),
  ('643f9d64-9dd2-44e8-8085-9a82f501675e', 'max_diet_plans_per_user', '5', 'limits', 'Máximo de planos por usuário', false),
  ('f5ca404d-c9d2-4435-8c95-03e5fe3bc5b5', 'optimizer_macro_settings', '{"calories_tolerance":5,"calories_weight":1.5,"carbs_ceiling":105,"carbs_floor":90,"carbs_weight":1,"fat_ceiling":100,"fat_floor":80,"fat_weight":1,"protein_ceiling":103,"protein_floor":98,"protein_weight":3}', 'optimizer', 'Configurações de pisos e tetos de macros para o otimizador bruto', false)
ON CONFLICT (id) DO UPDATE SET
  key = EXCLUDED.key, value = EXCLUDED.value, category = EXCLUDED.category, description = EXCLUDED.description;

-- =====================================================
-- 3. POLÍTICAS DE MUDANÇA DE OBJETIVO - 8 registros
-- =====================================================
INSERT INTO public.objective_change_policies (id, profile_type, change_number, cooldown_days)
VALUES
  ('acab4584-5eba-45f0-a53c-03c7c06f0324', 'profissional', 1, 7),
  ('03544d67-11a0-435e-b8ad-165b2eb0b180', 'profissional', 2, 14),
  ('c0ad317a-7cc4-45fc-9dff-0ad1e36ee62d', 'profissional', 3, 30),
  ('dd112f1c-0ea1-4c83-8147-9bb0595c328d', 'profissional', 4, 60),
  ('e5bbdbdc-c7f8-49e2-b127-bb2eef0cd0fc', 'plano_pessoal_pago', 1, 14),
  ('c4f51d7e-4701-432f-a478-97a3844aa90c', 'plano_pessoal_pago', 2, 30),
  ('baf818d6-ed16-4003-b30d-271e00b629ac', 'plano_pessoal_pago', 3, 60),
  ('549b30be-5fb0-4d77-ac19-18fe742b59ed', 'plano_pessoal_pago', 4, 90)
ON CONFLICT (id) DO UPDATE SET
  profile_type = EXCLUDED.profile_type, change_number = EXCLUDED.change_number, cooldown_days = EXCLUDED.cooldown_days;

-- =====================================================
-- 4. TEMPLATES DE REFEIÇÕES - 12 registros
-- =====================================================
INSERT INTO public.meal_templates (id, meal_type, name, description, min_items, max_items, is_active)
VALUES
  ('bb13a1fb-e6f2-45a9-9bc3-1030cb2b50d1', 'breakfast', 'Café da Manhã Padrão', 'Template padrão para café da manhã equilibrado', 2, 4, true),
  ('df041732-6f44-4c92-9008-6c8cc8726fca', 'morning_snack', 'Lanche da Manhã Padrão', 'Lanche leve para manter energia até o almoço', 2, 3, true),
  ('ed1ac800-2402-4c85-99a7-eb173d9a0b02', 'morning_snack', 'Lanche da Manhã Padrão', 'Lanche leve com laticínio, fruta e oleaginosas', 2, 4, false),
  ('8bcde5fe-089c-4f67-8390-4d4d1151b163', 'lunch', 'Almoço Padrão', 'Refeição principal do dia com proteína, carboidrato, leguminosa, vegetal e gordura', 3, 6, true),
  ('994c3279-6137-442b-bfbe-0e80f0292670', 'lunch', 'Almoço Low Carb', 'Template para dieta low carb - reduz carboidratos e aumenta gorduras boas', 3, 5, true),
  ('2a26dc3b-2e79-4cd3-b225-db886f6503ca', 'lunch', 'Almoço Mediterrâneo', 'Template para dieta mediterrânea - peixes, azeite e vegetais', 4, 6, true),
  ('97ebef6f-79c9-4de1-9571-05c0971de9ed', 'afternoon_snack', 'Lanche da Tarde Padrão', 'Lanche equilibrado para energia à tarde', 2, 3, true),
  ('5d59d9e3-37b1-460a-8491-ae9ab068078d', 'dinner', 'Jantar Padrão', 'Refeição noturna equilibrada com proteína, carboidrato, leguminosa, vegetal e gordura', 3, 6, true),
  ('9591b5bf-b937-4835-961c-8de999e83beb', 'dinner', 'Jantar Low Carb', 'Template para dieta low carb - foco em proteínas e vegetais', 3, 5, true),
  ('2ae7c196-c438-4d9d-b6cc-c24d67571c92', 'dinner', 'Jantar Mediterrâneo', 'Template para dieta mediterrânea - foco em peixes e leguminosas', 4, 6, true),
  ('673b8f25-d4b5-4396-bd3b-6b03821f192b', 'supper', 'Ceia Padrão', 'Refeição leve antes de dormir - proteína + fruta/carb leve', 2, 3, true),
  ('414fb320-254b-4ca1-9e90-8a2d8d79fc70', 'supper', 'Ceia Padrão', 'Refeição leve antes de dormir com laticínio e fruta opcional', 1, 3, false)
ON CONFLICT (id) DO UPDATE SET
  meal_type = EXCLUDED.meal_type, name = EXCLUDED.name, description = EXCLUDED.description,
  min_items = EXCLUDED.min_items, max_items = EXCLUDED.max_items, is_active = EXCLUDED.is_active;

-- =====================================================
-- 5. ROLES DOS TEMPLATES (meal_template_roles)
-- =====================================================
-- NOTA: Para obter os dados exatos, execute no banco ORIGEM:
/*
SELECT format(
  'INSERT INTO public.meal_template_roles (id, template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order) VALUES (%L, %L, %L, %s, %s, %s, %s) ON CONFLICT (id) DO NOTHING;',
  id, template_id, role_name, is_required, min_quantity_grams, max_quantity_grams, sort_order
) FROM public.meal_template_roles ORDER BY template_id, sort_order;
*/

-- =====================================================
-- 6. CATEGORIAS POR ROLE (meal_role_food_categories)
-- =====================================================
-- Execute no banco ORIGEM:
/*
SELECT format(
  'INSERT INTO public.meal_role_food_categories (id, role_id, category, priority) VALUES (%L, %L, %L, %s) ON CONFLICT (id) DO NOTHING;',
  id, role_id, category, priority
) FROM public.meal_role_food_categories ORDER BY role_id, priority;
*/

-- =====================================================
-- 7. ALIMENTOS (foods) - 271 registros
-- =====================================================
-- Importar via: docs/foods-import.sql
-- \i docs/foods-import.sql

-- =====================================================
-- 8. BLOQUEIOS CONTEXTUAIS (meal_contextual_blocks) - 51 registros
-- =====================================================
-- Execute no banco ORIGEM:
/*
SELECT format(
  'INSERT INTO public.meal_contextual_blocks (id, meal_type, food_id, keyword, rule_type, scope, notes, is_active) VALUES (%L, %L, %L, %L, %L, %L, %L, %s) ON CONFLICT (id) DO NOTHING;',
  id, meal_type, food_id, keyword, rule_type, scope, notes, is_active
) FROM public.meal_contextual_blocks ORDER BY meal_type, created_at;
*/

-- =====================================================
-- 9. ANCHOR FOODS (meal_anchor_foods) - 1092 registros
-- =====================================================
-- Execute no banco ORIGEM:
/*
SELECT format(
  'INSERT INTO public.meal_anchor_foods (id, meal_type, food_id, role_name, option_number, default_quantity_grams, goal_type, dietary_profile, sort_order, is_active) VALUES (%L, %L, %L, %L, %s, %s, %L, %L, %s, %s) ON CONFLICT (id) DO NOTHING;',
  id, meal_type, food_id, role_name, option_number, default_quantity_grams, goal_type, dietary_profile, sort_order, is_active
) FROM public.meal_anchor_foods ORDER BY meal_type, option_number, sort_order;
*/

-- =====================================================
-- 10. ADMIN USER MIGRATION
-- =====================================================
-- 1. Crie o usuário admin via Edge Function:
--    POST /create-admin  body: { email: "admin@nutriaplan.com", password: "..." }
--
-- 2. Execute os updates com o user_id retornado:
/*
UPDATE public.profiles SET
  name = 'Admin NutriaPlan', age = 30, sex = 'male',
  height = 188, weight = 91, goal = 'maintain', activity_level = 'active',
  daily_calories = 3063, protein_target = 214, carbs_target = 383, fat_target = 85,
  meals_per_day = 5, include_supplements = true, onboarding_completed = true,
  preferences = '{}', restrictions = '{}', preferred_foods = '{}', avoided_foods = '{}'
WHERE user_id = '<ADMIN_USER_ID>';

INSERT INTO public.subscriptions (user_id, plan_id, status)
VALUES ('<ADMIN_USER_ID>', '77b91b5c-aac4-4c36-a8ae-f36b1f9c557b', 'active');

INSERT INTO public.user_usage (user_id) VALUES ('<ADMIN_USER_ID>') ON CONFLICT (user_id) DO NOTHING;
*/

COMMIT;

-- =====================================================
-- RESUMO
-- =====================================================
-- plans:                      4  ✅ Inline
-- system_settings:           16  ✅ Inline (sem rate_limits)
-- objective_change_policies:  8  ✅ Inline
-- meal_templates:            12  ✅ Inline
-- meal_template_roles:       57  🔧 Query de geração (seção 5)
-- meal_role_food_categories: 81  🔧 Query de geração (seção 6)
-- foods:                    271  📄 docs/foods-import.sql
-- meal_contextual_blocks:    51  🔧 Query de geração (seção 8)
-- meal_anchor_foods:       1092  🔧 Query de geração (seção 9)
-- food_block_overrides:       0  ⏭️ Vazio
-- =====================================================
-- COMO GERAR DADOS VOLUMÉTRICOS:
-- 1. Acesse o SQL Editor do Supabase ORIGEM
-- 2. Execute cada query das seções 5, 6, 8 e 9
-- 3. Copie o resultado e cole no script de importação
-- =====================================================
