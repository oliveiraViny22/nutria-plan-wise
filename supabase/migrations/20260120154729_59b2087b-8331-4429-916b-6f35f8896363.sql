-- Create professional_students table for managing student-professional relationships
CREATE TABLE public.professional_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'inactive', 'pending')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (professional_id, student_id)
);

-- Add foreign key constraints
ALTER TABLE public.professional_students
    ADD CONSTRAINT professional_students_professional_id_fkey 
    FOREIGN KEY (professional_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.professional_students
    ADD CONSTRAINT professional_students_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.professional_students ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service role full access
CREATE POLICY "Service role full access to professional_students"
ON public.professional_students
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'service_role');

-- Professionals can view their own students
CREATE POLICY "Professionals can view own students"
ON public.professional_students
AS RESTRICTIVE
FOR SELECT
USING (
    professional_id = auth.uid() 
    AND public.has_role(auth.uid(), 'professional')
);

-- Professionals can insert students
CREATE POLICY "Professionals can add students"
ON public.professional_students
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
    professional_id = auth.uid() 
    AND public.has_role(auth.uid(), 'professional')
);

-- Professionals can update their own students
CREATE POLICY "Professionals can update own students"
ON public.professional_students
AS RESTRICTIVE
FOR UPDATE
USING (
    professional_id = auth.uid() 
    AND public.has_role(auth.uid(), 'professional')
);

-- Professionals can delete their own students
CREATE POLICY "Professionals can delete own students"
ON public.professional_students
AS RESTRICTIVE
FOR DELETE
USING (
    professional_id = auth.uid() 
    AND public.has_role(auth.uid(), 'professional')
);

-- Students can view their relationship with professional
CREATE POLICY "Students can view own professional relationship"
ON public.professional_students
AS RESTRICTIVE
FOR SELECT
USING (student_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_professional_students_updated_at
    BEFORE UPDATE ON public.professional_students
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_professional_students_professional_id ON public.professional_students(professional_id);
CREATE INDEX idx_professional_students_student_id ON public.professional_students(student_id);
CREATE INDEX idx_professional_students_status ON public.professional_students(status);