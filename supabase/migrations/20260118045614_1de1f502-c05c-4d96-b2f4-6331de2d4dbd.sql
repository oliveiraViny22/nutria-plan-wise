-- Tabela de configurações do sistema (key-value com metadados)
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_sensitive BOOLEAN DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ler configurações
CREATE POLICY "Admins can read system settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política: apenas admins podem modificar
CREATE POLICY "Admins can modify system settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabela de histórico de importações de alimentos
CREATE TABLE public.food_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.food_imports ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ver importações
CREATE POLICY "Admins can read food imports"
ON public.food_imports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política: apenas admins podem criar importações
CREATE POLICY "Admins can create food imports"
ON public.food_imports
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Política: apenas admins podem atualizar importações
CREATE POLICY "Admins can update food imports"
ON public.food_imports
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de log de auditoria para admin
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins podem ver logs
CREATE POLICY "Admins can read audit logs"
ON public.admin_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Política: apenas admins podem criar logs (sistema cria automaticamente)
CREATE POLICY "Admins can create audit logs"
ON public.admin_audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir configurações padrão do sistema
INSERT INTO public.system_settings (key, value, category, description) VALUES
('chat_limits', '{"gratuito": 3, "premium": 10, "plano_pessoal_pago": 30, "profissional": 100}', 'limits', 'Limites de mensagens de chat por dia para cada plano'),
('ai_verbosity', '{"level": "normal", "options": ["minimal", "normal", "detailed"]}', 'ai', 'Nível de verbosidade das respostas da IA'),
('feature_flags', '{"new_dashboard": false, "beta_features": false, "maintenance_mode": false}', 'features', 'Flags de funcionalidades do sistema'),
('plan_descriptions', '{"gratuito": "Acompanhe seu plano alimentar e tire dúvidas com nossa IA educacional.", "premium": "Para alunos vinculados a nutricionistas.", "plano_pessoal_pago": "Autonomia total para criar e gerenciar seus planos.", "profissional": "Gerencie até 50 pacientes com ferramentas avançadas."}', 'content', 'Descrições dos planos exibidas no site'),
('system_messages', '{"welcome": "Bem-vindo ao NutriPlan!", "maintenance": "Sistema em manutenção, voltamos em breve."}', 'content', 'Mensagens do sistema'),
('food_categories', '["frutas", "hortaliças_folhosas", "legumes", "cereais_tubérculos", "leguminosas", "proteínas_animais", "laticínios", "óleos_oleaginosas", "suplementos"]', 'food', 'Categorias de alimentos válidas'),
('processing_levels', '["in_natura", "minimamente_processado", "processado", "ultraprocessado", "suplemento"]', 'food', 'Níveis de processamento de alimentos');

-- Índices para performance
CREATE INDEX idx_system_settings_category ON public.system_settings(category);
CREATE INDEX idx_system_settings_key ON public.system_settings(key);
CREATE INDEX idx_food_imports_status ON public.food_imports(status);
CREATE INDEX idx_food_imports_imported_by ON public.food_imports(imported_by);
CREATE INDEX idx_admin_audit_log_user ON public.admin_audit_log(user_id);
CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_created ON public.admin_audit_log(created_at DESC);