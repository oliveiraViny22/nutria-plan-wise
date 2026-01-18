-- Create storage bucket for adherence reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'adherence-reports',
  'adherence-reports',
  false,
  5242880, -- 5MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Create table to track generated reports
CREATE TABLE public.adherence_report_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  student_id UUID,
  diet_plan_id UUID NOT NULL,
  plan_version INTEGER NOT NULL DEFAULT 1,
  plan_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  file_path TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metrics_snapshot JSONB NOT NULL,
  UNIQUE(user_id, student_id, diet_plan_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.adherence_report_files ENABLE ROW LEVEL SECURITY;

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
ON public.adherence_report_files
FOR SELECT
USING (auth.uid() = user_id OR auth.uid() = student_id);

-- Users can insert their own reports
CREATE POLICY "Users can insert their own reports"
ON public.adherence_report_files
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Professionals can view student reports
CREATE POLICY "Professionals can view student reports"
ON public.adherence_report_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM professional_students ps
    WHERE ps.student_id = adherence_report_files.student_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
  )
);

-- Professionals can insert student reports
CREATE POLICY "Professionals can insert student reports"
ON public.adherence_report_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM professional_students ps
    WHERE ps.student_id = adherence_report_files.student_id
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
  )
);

-- Storage policies for adherence-reports bucket
CREATE POLICY "Users can upload their own reports"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'adherence-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own reports files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'adherence-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Professionals can view student report files
CREATE POLICY "Professionals can view student report files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'adherence-reports'
  AND EXISTS (
    SELECT 1 FROM professional_students ps
    WHERE ps.student_id::text = (storage.foldername(name))[1]
    AND ps.professional_id = auth.uid()
    AND ps.status = 'active'
  )
);