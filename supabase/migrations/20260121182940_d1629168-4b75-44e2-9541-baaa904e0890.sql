-- Corrigir plano Gratuito para alinhar com documentação
UPDATE plans
SET 
  diet_limit = 0,
  substitution_limit = 0,
  adjustment_limit = 0,
  chat_messages_per_day = 3,
  has_chat = true,
  meal_options_limit = 2,
  description = 'Acompanhe seu plano alimentar e tire dúvidas com nossa IA educacional. Ideal para quem está começando.'
WHERE type = 'gratuito';

-- Inserir plano Premium (se não existir)
INSERT INTO plans (name, type, price_monthly, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, has_chat, meal_options_limit, description, is_active)
SELECT 'Premium', 'plano_pessoal_pago'::plan_type, 4.90, 0, 0, 0, 10, true, 2, 'Para alunos vinculados a nutricionistas. Acesso ampliado ao chat com IA e histórico estendido de 30 dias.', true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Premium');

-- Inserir plano Profissional (se não existir)
INSERT INTO plans (name, type, price_monthly, diet_limit, substitution_limit, adjustment_limit, chat_messages_per_day, has_chat, meal_options_limit, description, is_active)
SELECT 'Profissional', 'profissional'::plan_type, 99.00, 999, 999, 999, 100, true, 3, 'Gerencie até 50 pacientes com ferramentas avançadas de IA para criação e acompanhamento de dietas.', true
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name = 'Profissional');