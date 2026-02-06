
-- Remove a constraint antiga que não considera goal_type
ALTER TABLE public.meal_anchor_foods 
DROP CONSTRAINT IF EXISTS meal_anchor_foods_meal_type_option_number_food_id_key;

-- Adiciona nova constraint que inclui goal_type para permitir o mesmo alimento em opções diferentes por objetivo
ALTER TABLE public.meal_anchor_foods 
ADD CONSTRAINT meal_anchor_foods_unique_per_goal 
UNIQUE (meal_type, option_number, food_id, goal_type);
