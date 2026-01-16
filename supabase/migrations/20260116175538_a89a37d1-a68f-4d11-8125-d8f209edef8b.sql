-- 1. Criar novo enum para tipos de conta (account_type)
CREATE TYPE public.account_type AS ENUM ('aluno', 'plano_pessoal', 'premium', 'profissional');

-- 2. Adicionar coluna account_type na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN account_type account_type NOT NULL DEFAULT 'plano_pessoal';

-- 3. Criar tabela de status de planos alimentares
ALTER TABLE public.diet_plans
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'finished', 'cancelled', 'archived')),
ADD COLUMN IF NOT EXISTS is_initial_plan boolean NOT NULL DEFAULT false;

-- 4. Criar tabela de solicitações de alunos
CREATE TABLE IF NOT EXISTS public.student_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('goal_change', 'meals_change', 'food_substitution')),
  description text NOT NULL,
  justification text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  professional_response text,
  professional_feedback text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on student_requests
ALTER TABLE public.student_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for student_requests
CREATE POLICY "Students can view their own requests"
ON public.student_requests FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own requests"
ON public.student_requests FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Professionals can view their students requests"
ON public.student_requests FOR SELECT
USING (auth.uid() = professional_id AND has_role(auth.uid(), 'professional'));

CREATE POLICY "Professionals can update their students requests"
ON public.student_requests FOR UPDATE
USING (auth.uid() = professional_id AND has_role(auth.uid(), 'professional'));

-- 5. Migrar dados existentes: students viram aluno, others viram plano_pessoal
UPDATE public.profiles p
SET account_type = 'aluno'
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role = 'student'
);

UPDATE public.profiles p
SET account_type = 'profissional'
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role = 'professional'
);

-- 6. Criar trigger para atualizar updated_at em student_requests
CREATE TRIGGER update_student_requests_updated_at
BEFORE UPDATE ON public.student_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Criar função para verificar se usuário pode editar plano
CREATE OR REPLACE FUNCTION public.can_edit_plan(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- Aluno vinculado a profissional NÃO pode editar
    WHEN EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = _user_id 
        AND p.account_type = 'aluno'
        AND p.professional_id IS NOT NULL
    ) THEN false
    -- Plano gratuito (free) não pode editar
    WHEN EXISTS (
      SELECT 1 FROM subscriptions s
      JOIN plans pl ON pl.id = s.plan_id
      WHERE s.user_id = _user_id 
        AND pl.name = 'free'
        AND s.status IN ('active', 'trial')
    ) THEN false
    ELSE true
  END
$$;

-- 8. Criar função para verificar se pode criar novo plano
CREATE OR REPLACE FUNCTION public.can_create_plan(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_type account_type;
  v_active_plans int;
  v_plan_limit int;
BEGIN
  -- Get account type
  SELECT account_type INTO v_account_type
  FROM profiles WHERE user_id = _user_id;
  
  -- Aluno não pode criar plano
  IF v_account_type = 'aluno' THEN
    RETURN false;
  END IF;
  
  -- Contar planos ativos
  SELECT COUNT(*) INTO v_active_plans
  FROM diet_plans
  WHERE user_id = _user_id AND status = 'active';
  
  -- Buscar limite de planos
  SELECT pl.diet_limit INTO v_plan_limit
  FROM subscriptions s
  JOIN plans pl ON pl.id = s.plan_id
  WHERE s.user_id = _user_id AND s.status IN ('active', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;
  
  -- Se não encontrou plano, usar limite 1 (free)
  IF v_plan_limit IS NULL THEN
    v_plan_limit := 1;
  END IF;
  
  RETURN v_active_plans < v_plan_limit;
END;
$$;

-- 9. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_diet_plans_status ON public.diet_plans(status);
CREATE INDEX IF NOT EXISTS idx_diet_plans_user_status ON public.diet_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_student_requests_student ON public.student_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_student_requests_professional ON public.student_requests(professional_id);
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);