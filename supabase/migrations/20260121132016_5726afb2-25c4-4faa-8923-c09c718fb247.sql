-- Tabela para rastrear uso de IA com custos estimados
CREATE TABLE public.ai_usage_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    function_name TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(10, 6) DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consultas eficientes
CREATE INDEX idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);
CREATE INDEX idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_function ON public.ai_usage_logs(function_name);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Service role full access to ai_usage_logs"
    ON public.ai_usage_logs
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view ai_usage_logs"
    ON public.ai_usage_logs
    FOR SELECT
    USING (has_role(auth.uid(), 'admin'::app_role));

-- Adicionar campo price_monthly editável nos planos se ainda não existir
-- (já existe, mas garantir que há coluna de preço que pode ser editada)

-- Comentários
COMMENT ON TABLE public.ai_usage_logs IS 'Rastreamento de uso de IA para métricas de custo';
COMMENT ON COLUMN public.ai_usage_logs.estimated_cost_usd IS 'Custo estimado em USD baseado no modelo e tokens';