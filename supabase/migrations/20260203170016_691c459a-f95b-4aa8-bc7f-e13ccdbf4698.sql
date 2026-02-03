-- Adicionar preferência de refeição noturna ao perfil
-- Valores: 'full_dinner' (jantar completo + ceia leve), 'light_dinner' (jantar leve + ceia substancial), 'no_preference' (sistema decide)
ALTER TABLE public.profiles 
ADD COLUMN evening_meal_preference TEXT DEFAULT 'no_preference';

-- Adicionar constraint para valores válidos
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_evening_meal_preference_check 
CHECK (evening_meal_preference IN ('full_dinner', 'light_dinner', 'no_preference'));