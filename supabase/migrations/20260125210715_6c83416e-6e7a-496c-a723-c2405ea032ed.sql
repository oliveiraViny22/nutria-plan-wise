-- Tabela para alimentos-âncora (fixos) por refeição
-- Ex: Arroz + Feijão sempre na opção 1 do almoço
CREATE TABLE public.meal_anchor_foods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_type TEXT NOT NULL,
  option_number INTEGER NOT NULL DEFAULT 1,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  default_quantity_grams INTEGER NOT NULL DEFAULT 100,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (meal_type, option_number, food_id)
);

-- Índices para performance
CREATE INDEX idx_meal_anchor_foods_meal_type ON public.meal_anchor_foods(meal_type);
CREATE INDEX idx_meal_anchor_foods_active ON public.meal_anchor_foods(is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE TRIGGER update_meal_anchor_foods_updated_at
BEFORE UPDATE ON public.meal_anchor_foods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.meal_anchor_foods ENABLE ROW LEVEL SECURITY;

-- Admins podem fazer tudo
CREATE POLICY "Admins manage anchor foods"
ON public.meal_anchor_foods
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Todos podem ler âncoras ativas
CREATE POLICY "Everyone can read active anchors"
ON public.meal_anchor_foods
FOR SELECT
USING (is_active = true);

-- Inserir dados iniciais: Arroz + Feijão no almoço opção 1
INSERT INTO public.meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order)
SELECT 'lunch', 1, id, 'carboidrato_base', 150, 1 FROM public.foods WHERE canonical_name = 'arroz_branco_cozido' LIMIT 1;

INSERT INTO public.meal_anchor_foods (meal_type, option_number, food_id, role_name, default_quantity_grams, sort_order)
SELECT 'lunch', 1, id, 'leguminosa', 100, 2 FROM public.foods WHERE canonical_name = 'feijao_preto_cozido' LIMIT 1;

-- Comentário para documentação
COMMENT ON TABLE public.meal_anchor_foods IS 'Alimentos-âncora fixos por tipo de refeição e opção. Usados pelo gerador V5 para garantir estrutura cultural.';