-- Add RLS policy to allow professionals to view their active students' profiles
CREATE POLICY "Professionals can view their students' profiles"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.professional_students ps
    WHERE ps.student_id = profiles.user_id
      AND ps.professional_id = auth.uid()
      AND ps.status = 'active'
      AND public.has_role(auth.uid(), 'professional')
      AND public.has_active_license(auth.uid())
  )
);