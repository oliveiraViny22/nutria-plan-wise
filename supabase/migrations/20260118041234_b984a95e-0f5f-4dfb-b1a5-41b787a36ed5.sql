-- Table for alert configurations per professional
CREATE TABLE public.adherence_alert_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL,
  threshold_low INTEGER NOT NULL DEFAULT 50,
  threshold_warning INTEGER NOT NULL DEFAULT 70,
  check_period_days INTEGER NOT NULL DEFAULT 7,
  notify_on_low BOOLEAN NOT NULL DEFAULT true,
  notify_on_warning BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(professional_id)
);

-- Table for generated alerts
CREATE TABLE public.adherence_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID NOT NULL,
  student_id UUID NOT NULL,
  diet_plan_id UUID NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low', 'warning', 'recovered')),
  adherence_rate NUMERIC NOT NULL,
  threshold_used INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adherence_alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adherence_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies for adherence_alert_configs
CREATE POLICY "Professionals can manage their own config"
ON public.adherence_alert_configs
FOR ALL
USING (auth.uid() = professional_id)
WITH CHECK (auth.uid() = professional_id);

-- RLS policies for adherence_alerts
CREATE POLICY "Professionals can view their alerts"
ON public.adherence_alerts
FOR SELECT
USING (auth.uid() = professional_id);

CREATE POLICY "Professionals can update their alerts"
ON public.adherence_alerts
FOR UPDATE
USING (auth.uid() = professional_id);

CREATE POLICY "Service role can manage alerts"
ON public.adherence_alerts
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_adherence_alerts_professional ON public.adherence_alerts(professional_id, is_read, created_at DESC);
CREATE INDEX idx_adherence_alerts_student ON public.adherence_alerts(student_id, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_adherence_alert_configs_updated_at
BEFORE UPDATE ON public.adherence_alert_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();