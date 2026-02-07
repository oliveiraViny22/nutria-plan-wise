-- Table for contextual food blocks per meal type
CREATE TABLE public.meal_contextual_blocks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    meal_type TEXT NOT NULL,
    food_id UUID REFERENCES public.foods(id) ON DELETE CASCADE,
    keyword TEXT,
    rule_type TEXT NOT NULL DEFAULT 'block', -- 'block' or 'prefer'
    scope TEXT NOT NULL DEFAULT 'specific', -- 'specific' (food_id) or 'keyword'
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID,
    
    -- Either food_id or keyword must be set based on scope
    CONSTRAINT valid_scope CHECK (
        (scope = 'specific' AND food_id IS NOT NULL AND keyword IS NULL) OR
        (scope = 'keyword' AND keyword IS NOT NULL AND food_id IS NULL)
    ),
    
    -- Valid meal types
    CONSTRAINT valid_meal_type CHECK (
        meal_type IN ('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper', 'all')
    ),
    
    -- Valid rule types
    CONSTRAINT valid_rule_type CHECK (rule_type IN ('block', 'prefer'))
);

-- Index for fast lookups
CREATE INDEX idx_meal_contextual_blocks_meal_type ON public.meal_contextual_blocks(meal_type) WHERE is_active = true;
CREATE INDEX idx_meal_contextual_blocks_food_id ON public.meal_contextual_blocks(food_id) WHERE food_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.meal_contextual_blocks ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can manage
CREATE POLICY "Admins can manage contextual blocks"
ON public.meal_contextual_blocks
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Everyone can read active rules (needed by generator)
CREATE POLICY "Everyone can read active contextual blocks"
ON public.meal_contextual_blocks
FOR SELECT
USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER update_meal_contextual_blocks_updated_at
    BEFORE UPDATE ON public.meal_contextual_blocks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.meal_contextual_blocks IS 'Stores contextual food blocking rules per meal type (e.g., no chicken at breakfast)';
COMMENT ON COLUMN public.meal_contextual_blocks.rule_type IS 'block = prevent food in meal, prefer = prioritize food in meal';
COMMENT ON COLUMN public.meal_contextual_blocks.scope IS 'specific = exact food_id match, keyword = pattern matching on food name';