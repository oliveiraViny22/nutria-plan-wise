-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - AUDITORIA DE SEGURANÇA
-- =====================================================

-- 1. CORRIGIR: Tabela 'plans' - Remover acesso público a IDs do Stripe
-- Substituir política pública por política para usuários autenticados
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plans;

CREATE POLICY "Authenticated users can view active plans"
ON public.plans
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- 2. ADICIONAR: Política INSERT para 'profiles'
-- Permite que usuários criem seu próprio perfil
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. ADICIONAR: Política UPDATE para 'subscriptions'
-- Permite que usuários atualizem preferências de assinatura (ex: cancel_at_period_end)
CREATE POLICY "Users can update own subscription"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- 4. ADICIONAR: Política INSERT para 'user_usage'
-- Permite criação de registros de uso pelo próprio usuário
CREATE POLICY "Users can insert own usage"
ON public.user_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. NOTA: user_roles INSERT/UPDATE não adicionados intencionalmente
-- Roles devem ser gerenciados apenas por service_role/admins por segurança
-- Isso é intencional para evitar privilege escalation