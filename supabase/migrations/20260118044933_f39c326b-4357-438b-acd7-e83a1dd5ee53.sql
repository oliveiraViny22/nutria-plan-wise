-- Atualizar descrições dos planos na tabela plans
UPDATE public.plans 
SET description = 'Acompanhe seu plano alimentar e tire dúvidas com nossa IA educacional. Ideal para quem está começando.'
WHERE name = 'gratuito';

UPDATE public.plans 
SET description = 'Para alunos vinculados a nutricionistas. Acesso ampliado ao chat com IA e histórico estendido de 30 dias.'
WHERE name = 'premium';

UPDATE public.plans 
SET description = 'Autonomia total para criar e gerenciar seus próprios planos alimentares com suporte completo de IA.'
WHERE name = 'plano_pessoal_pago';

UPDATE public.plans 
SET description = 'Gerencie até 50 pacientes com ferramentas avançadas de IA para criação e acompanhamento de dietas.'
WHERE name = 'profissional';

-- Migrar subscriptions com billing_cycle diferente de monthly para monthly
-- (mantém apenas mensal ativo conforme regra de negócio)
UPDATE public.subscriptions 
SET billing_cycle = 'monthly'
WHERE billing_cycle IS NOT NULL AND billing_cycle != 'monthly';

-- Adicionar comentário explicativo na coluna billing_cycle
COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'Ciclo de cobrança. Atualmente apenas "monthly" é utilizado. Valores legacy (quarterly, semiannual, annual) foram migrados para monthly.';