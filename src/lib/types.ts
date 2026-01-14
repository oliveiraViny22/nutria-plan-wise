export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  age: number | null;
  sex: 'male' | 'female' | 'other' | null;
  height: number | null;
  weight: number | null;
  goal: 'lose_weight' | 'maintain' | 'gain_muscle' | null;
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | null;
  preferences: string[];
  restrictions: string[];
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  category: string | null;
  created_at: string;
}

export interface DietPlan {
  id: string;
  user_id: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
}

export interface Meal {
  id: string;
  diet_plan_id: string;
  name: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
  foods?: MealFood[];
}

export interface MealFood {
  id: string;
  meal_id: string;
  food_id: string;
  quantity: number;
  created_at: string;
  food?: Food;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'Sedentário', description: 'Pouca ou nenhuma atividade', multiplier: 1.2 },
  light: { label: 'Leve', description: '1-3 dias/semana', multiplier: 1.375 },
  moderate: { label: 'Moderado', description: '3-5 dias/semana', multiplier: 1.55 },
  active: { label: 'Ativo', description: '6-7 dias/semana', multiplier: 1.725 },
  very_active: { label: 'Muito Ativo', description: 'Atleta/trabalho físico', multiplier: 1.9 },
} as const;

export const GOALS = {
  lose_weight: { label: 'Perder Peso', calorieAdjustment: -500 },
  maintain: { label: 'Manter Peso', calorieAdjustment: 0 },
  gain_muscle: { label: 'Ganhar Massa', calorieAdjustment: 300 },
} as const;

export const FOOD_PREFERENCES = [
  'Vegetariano',
  'Vegano',
  'Pescetariano',
  'Low Carb',
  'Mediterrâneo',
  'Proteína Alta',
] as const;

export const FOOD_RESTRICTIONS = [
  'Sem Glúten',
  'Sem Lactose',
  'Sem Frutos do Mar',
  'Sem Nozes',
  'Sem Soja',
  'Sem Ovos',
] as const;

export const MEAL_NAMES = {
  breakfast: 'Café da Manhã',
  lunch: 'Almoço',
  dinner: 'Jantar',
  snack: 'Lanche',
} as const;
