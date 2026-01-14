-- Create profiles table to store user information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  height NUMERIC(5,2), -- in cm
  weight NUMERIC(5,2), -- in kg
  goal TEXT CHECK (goal IN ('lose_weight', 'maintain', 'gain_muscle')),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  preferences TEXT[] DEFAULT '{}',
  restrictions TEXT[] DEFAULT '{}',
  daily_calories INTEGER,
  protein_target INTEGER,
  carbs_target INTEGER,
  fat_target INTEGER,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create foods table for food database
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein NUMERIC(5,2) NOT NULL,
  carbs NUMERIC(5,2) NOT NULL,
  fat NUMERIC(5,2) NOT NULL,
  serving_size TEXT DEFAULT '100g',
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create diet_plans table
CREATE TABLE public.diet_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_calories INTEGER NOT NULL,
  total_protein NUMERIC(5,2) NOT NULL,
  total_carbs NUMERIC(5,2) NOT NULL,
  total_fat NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meals table
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diet_plan_id UUID REFERENCES public.diet_plans(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL CHECK (name IN ('breakfast', 'lunch', 'dinner', 'snack')),
  total_calories INTEGER DEFAULT 0,
  total_protein NUMERIC(5,2) DEFAULT 0,
  total_carbs NUMERIC(5,2) DEFAULT 0,
  total_fat NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meal_foods junction table
CREATE TABLE public.meal_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID REFERENCES public.meals(id) ON DELETE CASCADE NOT NULL,
  food_id UUID REFERENCES public.foods(id) ON DELETE CASCADE NOT NULL,
  quantity NUMERIC(5,2) DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table for the nutritional assistant
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for foods (public read, admin write)
CREATE POLICY "Anyone can view foods" ON public.foods FOR SELECT TO authenticated USING (true);

-- RLS Policies for diet_plans
CREATE POLICY "Users can view their own diet plans" ON public.diet_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own diet plans" ON public.diet_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own diet plans" ON public.diet_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own diet plans" ON public.diet_plans FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for meals (through diet_plan ownership)
CREATE POLICY "Users can view meals of their diet plans" ON public.meals FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));
CREATE POLICY "Users can insert meals to their diet plans" ON public.meals FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));
CREATE POLICY "Users can update meals of their diet plans" ON public.meals FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));
CREATE POLICY "Users can delete meals of their diet plans" ON public.meals FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.diet_plans WHERE diet_plans.id = meals.diet_plan_id AND diet_plans.user_id = auth.uid()));

-- RLS Policies for meal_foods
CREATE POLICY "Users can view meal_foods of their meals" ON public.meal_foods FOR SELECT 
  USING (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.diet_plans ON diet_plans.id = meals.diet_plan_id 
    WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert meal_foods to their meals" ON public.meal_foods FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.diet_plans ON diet_plans.id = meals.diet_plan_id 
    WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can update meal_foods of their meals" ON public.meal_foods FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.diet_plans ON diet_plans.id = meals.diet_plan_id 
    WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete meal_foods of their meals" ON public.meal_foods FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM public.meals 
    JOIN public.diet_plans ON diet_plans.id = meals.diet_plan_id 
    WHERE meals.id = meal_foods.meal_id AND diet_plans.user_id = auth.uid()
  ));

-- RLS Policies for chat_messages
CREATE POLICY "Users can view their own chat messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chat messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert sample foods for the database
INSERT INTO public.foods (name, calories, protein, carbs, fat, serving_size, category) VALUES
  ('Ovo cozido', 78, 6.3, 0.6, 5.3, '1 unidade (50g)', 'proteinas'),
  ('Peito de frango grelhado', 165, 31, 0, 3.6, '100g', 'proteinas'),
  ('Arroz integral', 111, 2.6, 23, 0.9, '100g', 'carboidratos'),
  ('Feijão preto', 132, 8.9, 24, 0.5, '100g', 'leguminosas'),
  ('Banana', 89, 1.1, 23, 0.3, '1 unidade média', 'frutas'),
  ('Maçã', 52, 0.3, 14, 0.2, '1 unidade média', 'frutas'),
  ('Aveia em flocos', 379, 13, 67, 7, '100g', 'cereais'),
  ('Leite desnatado', 34, 3.4, 5, 0.1, '100ml', 'laticinios'),
  ('Iogurte natural', 59, 3.5, 4.7, 3.3, '100g', 'laticinios'),
  ('Batata doce', 86, 1.6, 20, 0.1, '100g', 'carboidratos'),
  ('Brócolis', 34, 2.8, 7, 0.4, '100g', 'vegetais'),
  ('Espinafre', 23, 2.9, 3.6, 0.4, '100g', 'vegetais'),
  ('Salmão grelhado', 208, 20, 0, 13, '100g', 'proteinas'),
  ('Amêndoas', 579, 21, 22, 50, '100g', 'oleaginosas'),
  ('Queijo cottage', 98, 11, 3.4, 4.3, '100g', 'laticinios'),
  ('Pão integral', 247, 13, 41, 4.2, '100g', 'cereais'),
  ('Abacate', 160, 2, 9, 15, '100g', 'frutas'),
  ('Tomate', 18, 0.9, 3.9, 0.2, '100g', 'vegetais'),
  ('Cenoura', 41, 0.9, 10, 0.2, '100g', 'vegetais'),
  ('Grão de bico', 164, 8.9, 27, 2.6, '100g', 'leguminosas'),
  ('Quinoa', 120, 4.4, 21, 1.9, '100g', 'cereais'),
  ('Atum em água', 116, 26, 0, 0.8, '100g', 'proteinas'),
  ('Mamão', 43, 0.5, 11, 0.3, '100g', 'frutas'),
  ('Melancia', 30, 0.6, 8, 0.2, '100g', 'frutas'),
  ('Azeite de oliva', 884, 0, 0, 100, '100ml', 'gorduras'),
  ('Castanha do Pará', 656, 14, 12, 66, '100g', 'oleaginosas'),
  ('Leite de amêndoas', 17, 0.4, 2.5, 0.6, '100ml', 'laticinios'),
  ('Tofu', 76, 8, 1.9, 4.8, '100g', 'proteinas'),
  ('Lentilha', 116, 9, 20, 0.4, '100g', 'leguminosas'),
  ('Couve', 36, 2.9, 6, 0.7, '100g', 'vegetais');