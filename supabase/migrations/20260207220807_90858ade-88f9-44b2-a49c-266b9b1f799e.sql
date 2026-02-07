-- =====================================================
-- OTIMIZAÇÃO: Política RLS mais eficiente para meal_option_foods
-- =====================================================
-- O problema: a política atual faz 3 JOINs para cada UPDATE,
-- causando timeout quando há muitos updates simultâneos.
-- 
-- Solução: Usar uma verificação mais direta com EXISTS otimizado
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "Users can view own meal option foods" ON public.meal_option_foods;
DROP POLICY IF EXISTS "Users can manage own meal option foods" ON public.meal_option_foods;

-- Criar política SELECT otimizada
CREATE POLICY "Users can view own meal option foods" 
ON public.meal_option_foods 
FOR SELECT 
USING (
  meal_option_id IN (
    SELECT mo.id 
    FROM meal_options mo
    INNER JOIN meals m ON m.id = mo.meal_id
    INNER JOIN diet_plans dp ON dp.id = m.diet_plan_id
    WHERE dp.user_id = auth.uid()
  )
);

-- Criar políticas separadas para cada operação (mais eficiente que ALL)
CREATE POLICY "Users can insert own meal option foods" 
ON public.meal_option_foods 
FOR INSERT 
WITH CHECK (
  meal_option_id IN (
    SELECT mo.id 
    FROM meal_options mo
    INNER JOIN meals m ON m.id = mo.meal_id
    INNER JOIN diet_plans dp ON dp.id = m.diet_plan_id
    WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own meal option foods" 
ON public.meal_option_foods 
FOR UPDATE 
USING (
  meal_option_id IN (
    SELECT mo.id 
    FROM meal_options mo
    INNER JOIN meals m ON m.id = mo.meal_id
    INNER JOIN diet_plans dp ON dp.id = m.diet_plan_id
    WHERE dp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own meal option foods" 
ON public.meal_option_foods 
FOR DELETE 
USING (
  meal_option_id IN (
    SELECT mo.id 
    FROM meal_options mo
    INNER JOIN meals m ON m.id = mo.meal_id
    INNER JOIN diet_plans dp ON dp.id = m.diet_plan_id
    WHERE dp.user_id = auth.uid()
  )
);

-- Criar índice composto para acelerar a verificação de propriedade
CREATE INDEX IF NOT EXISTS idx_diet_plans_user_status 
ON public.diet_plans (user_id, status);

-- Analisar tabelas para atualizar estatísticas do planner
ANALYZE meal_option_foods;
ANALYZE meal_options;
ANALYZE meals;
ANALYZE diet_plans;