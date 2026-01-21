-- Adicionar configurações para controle de funcionalidades de IA
INSERT INTO public.system_settings (key, value, category, description, is_sensitive) VALUES
-- Funcionalidades de IA
('ai_meal_plan_enabled', 'true', 'ai', 'Habilitar geração de planos alimentares via IA', false),
('ai_substitution_explanation_enabled', 'true', 'ai', 'Habilitar explicação de substituições via IA', false),
('ai_plan_suggestions_enabled', 'true', 'ai', 'Habilitar sugestões de ajustes de plano via IA', false),
('ai_food_validation_enabled', 'true', 'ai', 'Habilitar validação de importação de alimentos via IA', false),
('ai_food_audit_enabled', 'true', 'ai', 'Habilitar auditoria de classificação de alimentos via IA', false),
('ai_nutritional_chat_enabled', 'true', 'ai', 'Habilitar chat nutricional via IA', false)
ON CONFLICT (key) DO NOTHING;