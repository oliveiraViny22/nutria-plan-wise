-- Add goal_type column to meal_anchor_foods for goal-based filtering
ALTER TABLE public.meal_anchor_foods 
ADD COLUMN goal_type text DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.meal_anchor_foods.goal_type IS 'Nutritional goal filter: bulk, cut, maintain, or NULL for universal anchors';

-- Create index for efficient filtering
CREATE INDEX idx_meal_anchor_foods_goal_type ON public.meal_anchor_foods(goal_type) WHERE goal_type IS NOT NULL;