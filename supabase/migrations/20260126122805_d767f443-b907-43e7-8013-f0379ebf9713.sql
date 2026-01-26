-- Aprovação bidirecional para professional_students
-- Adicionar coluna de confirmação do aluno
ALTER TABLE public.professional_students
ADD COLUMN IF NOT EXISTS student_confirmed BOOLEAN DEFAULT FALSE;

-- Adicionar índice para performance
CREATE INDEX IF NOT EXISTS idx_professional_students_student_confirmed 
ON public.professional_students(student_confirmed);

-- Comentário explicativo
COMMENT ON COLUMN public.professional_students.student_confirmed IS 
'Flag indicando se o aluno aceitou o vínculo com o profissional. Quando false, o aluno precisa aprovar a conexão.';

-- Atualizar RLS para que alunos possam confirmar seu próprio vínculo
DROP POLICY IF EXISTS "Students can confirm their own link" ON public.professional_students;
CREATE POLICY "Students can confirm their own link"
ON public.professional_students
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (
  auth.uid() = student_id 
  AND student_confirmed = TRUE
);

-- Política para aluno visualizar vinculo pendente
DROP POLICY IF EXISTS "Students can view their pending links" ON public.professional_students;
CREATE POLICY "Students can view their pending links"
ON public.professional_students
FOR SELECT
USING (auth.uid() = student_id);

-- Anonimizar created_by_id em foods públicos (proteção de privacidade)
-- Criar view segura para alimentos
CREATE OR REPLACE VIEW public.foods_public AS
SELECT 
  id,
  name,
  canonical_name,
  category,
  calories,
  protein,
  carbs,
  fat,
  serving_size,
  type,
  origin,
  processing_level,
  is_optional,
  unit_enabled,
  unit_name,
  unit_weight_grams,
  unit_increment,
  is_active,
  review_status,
  confidence_level,
  created_at,
  -- Anonimizar created_by_id - não expor quem criou
  NULL::uuid AS created_by_id,
  created_by_type
FROM public.foods
WHERE is_active = true AND review_status = 'approved';