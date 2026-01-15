-- 1. Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'professional', 'student');

-- 2. Create user_roles table (secure role storage)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Create professional_licenses table (without generated column)
CREATE TABLE public.professional_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    license_type TEXT NOT NULL DEFAULT 'monthly' CHECK (license_type IN ('monthly', 'annual')),
    starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    max_students INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.professional_licenses ENABLE ROW LEVEL SECURITY;

-- Function to check active license (replaces generated column)
CREATE OR REPLACE FUNCTION public.has_active_license(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.professional_licenses
    WHERE user_id = _user_id
      AND expires_at > now()
  )
$$;

-- License RLS policies
CREATE POLICY "Users can view their own license"
ON public.professional_licenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own license"
ON public.professional_licenses FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all licenses"
ON public.professional_licenses FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Create professional_students relationship table
CREATE TABLE public.professional_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (professional_id, student_id)
);

ALTER TABLE public.professional_students ENABLE ROW LEVEL SECURITY;

-- Professional-students RLS policies
CREATE POLICY "Professionals can view their students"
ON public.professional_students FOR SELECT
USING (auth.uid() = professional_id);

CREATE POLICY "Students can view their professional"
ON public.professional_students FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Professionals can manage their students"
ON public.professional_students FOR ALL
USING (
    auth.uid() = professional_id 
    AND public.has_role(auth.uid(), 'professional')
    AND public.has_active_license(auth.uid())
);

-- 6. Function to get student count for a professional
CREATE OR REPLACE FUNCTION public.get_student_count(_professional_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.professional_students
  WHERE professional_id = _professional_id
    AND status = 'active'
$$;

-- 7. Add professional_id to profiles for student linking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_professional_students_professional ON public.professional_students(professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_students_student ON public.professional_students(student_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expires ON public.professional_licenses(expires_at);

-- 9. Triggers to update updated_at
CREATE TRIGGER update_professional_licenses_updated_at
BEFORE UPDATE ON public.professional_licenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_professional_students_updated_at
BEFORE UPDATE ON public.professional_students
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();