-- Tabela para override de bloqueios por alimento
CREATE TABLE public.food_block_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  is_unblocked BOOLEAN NOT NULL DEFAULT false,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(food_id)
);

-- Enable RLS
ALTER TABLE public.food_block_overrides ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar overrides
CREATE POLICY "Admins can manage food block overrides"
ON public.food_block_overrides
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Public read para edge functions
CREATE POLICY "Authenticated users can read overrides"
ON public.food_block_overrides
FOR SELECT
TO authenticated
USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_food_block_overrides_updated_at
BEFORE UPDATE ON public.food_block_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para performance
CREATE INDEX idx_food_block_overrides_food_id ON public.food_block_overrides(food_id);
CREATE INDEX idx_food_block_overrides_unblocked ON public.food_block_overrides(is_unblocked) WHERE is_unblocked = true;