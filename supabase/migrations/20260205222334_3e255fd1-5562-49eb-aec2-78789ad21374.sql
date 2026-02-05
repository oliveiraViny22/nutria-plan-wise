-- =====================================================
-- TABELA DE REGISTRO DE PESO
-- Disponível para todos os usuários (gratuito e pago)
-- =====================================================

CREATE TABLE public.weight_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- Enable RLS
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - todos os usuários podem registrar peso
CREATE POLICY "Users can view own weight logs"
  ON public.weight_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight logs"
  ON public.weight_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight logs"
  ON public.weight_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight logs"
  ON public.weight_logs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to weight_logs"
  ON public.weight_logs FOR ALL
  USING (auth.role() = 'service_role');

-- Índice para consultas por usuário e data
CREATE INDEX idx_weight_logs_user_date ON public.weight_logs(user_id, log_date DESC);

-- =====================================================
-- TABELA DE MEDIDAS CORPORAIS
-- Disponível apenas para profissionais e alunos vinculados
-- =====================================================

CREATE TABLE public.body_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  waist_cm NUMERIC(5,1) CHECK (waist_cm > 0 AND waist_cm < 300),
  hip_cm NUMERIC(5,1) CHECK (hip_cm > 0 AND hip_cm < 300),
  chest_cm NUMERIC(5,1) CHECK (chest_cm > 0 AND chest_cm < 300),
  arm_cm NUMERIC(5,1) CHECK (arm_cm > 0 AND arm_cm < 100),
  thigh_cm NUMERIC(5,1) CHECK (thigh_cm > 0 AND thigh_cm < 150),
  calf_cm NUMERIC(5,1) CHECK (calf_cm > 0 AND calf_cm < 100),
  body_fat_percent NUMERIC(4,1) CHECK (body_fat_percent >= 0 AND body_fat_percent <= 100),
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, measurement_date)
);

-- Enable RLS
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS - apenas profissionais e alunos vinculados
CREATE POLICY "Users can view own measurements"
  ON public.body_measurements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Professionals can view student measurements"
  ON public.body_measurements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.professional_students ps
      WHERE ps.student_id = body_measurements.user_id
        AND ps.professional_id = auth.uid()
        AND ps.status = 'active'
    )
  );

CREATE POLICY "Users can insert own measurements"
  ON public.body_measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Professionals can insert student measurements"
  ON public.body_measurements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.professional_students ps
      WHERE ps.student_id = body_measurements.user_id
        AND ps.professional_id = auth.uid()
        AND ps.status = 'active'
    )
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Users can update own measurements"
  ON public.body_measurements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Professionals can update student measurements"
  ON public.body_measurements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.professional_students ps
      WHERE ps.student_id = body_measurements.user_id
        AND ps.professional_id = auth.uid()
        AND ps.status = 'active'
    )
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Users can delete own measurements"
  ON public.body_measurements FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to body_measurements"
  ON public.body_measurements FOR ALL
  USING (auth.role() = 'service_role');

-- Índice para consultas
CREATE INDEX idx_body_measurements_user_date ON public.body_measurements(user_id, measurement_date DESC);