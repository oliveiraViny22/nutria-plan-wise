-- Table for system settings (admin configurable)
CREATE TABLE public.system_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for admin audit logs
CREATE TABLE public.admin_audit_log (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for food import history
CREATE TABLE public.food_imports (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    failed_rows INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    imported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_imports ENABLE ROW LEVEL SECURITY;

-- Policies for system_settings (only admins via service role or has_role)
CREATE POLICY "Service role full access to system_settings" 
ON public.system_settings FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view system_settings" 
ON public.system_settings FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Policies for admin_audit_log (only admins can view)
CREATE POLICY "Service role full access to admin_audit_log" 
ON public.admin_audit_log FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view audit logs" 
ON public.admin_audit_log FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Policies for food_imports (only admins)
CREATE POLICY "Service role full access to food_imports" 
ON public.food_imports FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view food imports" 
ON public.food_imports FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on system_settings
CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (key, value, category, description) VALUES
    ('site_name', '"NutriaPlan"', 'general', 'Nome do site'),
    ('maintenance_mode', 'false', 'general', 'Modo de manutenção ativo'),
    ('max_diet_plans_per_user', '5', 'limits', 'Máximo de planos por usuário'),
    ('ai_model_default', '"gemini-2.5-flash"', 'ai', 'Modelo de IA padrão'),
    ('enable_chat_feature', 'true', 'features', 'Habilitar chat com IA'),
    ('enable_professional_signup', 'true', 'features', 'Permitir cadastro de profissionais')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster audit log queries
CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX idx_admin_audit_log_user_id ON public.admin_audit_log(user_id);
CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log(action);

-- Create index for food imports
CREATE INDEX idx_food_imports_created_at ON public.food_imports(created_at DESC);
CREATE INDEX idx_food_imports_status ON public.food_imports(status);