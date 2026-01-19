// =====================================================
// TIPOS DE USUÁRIO (imutável) - armazenado em profiles.user_type
// =====================================================
export type UserType = 'aluno' | 'usuario' | 'profissional';

// =====================================================
// PLANOS COMERCIAIS (mutável) - armazenado em subscriptions via plan_id
// =====================================================
export type CommercialPlan = 'gratuito' | 'plano_pessoal_pago' | 'premium' | 'profissional';

// Legacy - manter para compatibilidade com profiles.account_type (enum do banco)
// NOTA: 'plano_pessoal' no account_type é equivalente a 'plano_pessoal_pago' em CommercialPlan
export type AccountType = 'aluno' | 'plano_pessoal' | 'premium' | 'profissional';

// Status permitidos para planos alimentares
export type DietPlanStatus = 'draft' | 'active' | 'finished' | 'cancelled' | 'archived';

// Tipos de solicitação do aluno
export type StudentRequestType = 'goal_change' | 'meals_change' | 'food_substitution';
export type StudentRequestStatus = 'pending' | 'approved' | 'rejected';

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
  meals_per_day: number | null;
  professional_id: string | null;
  account_type: AccountType; // Legacy
  user_type: UserType; // Novo campo imutável
  onboarding_completed: boolean;
  professional_onboarding_completed: boolean;
  is_test: boolean;
  must_change_password: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Informações de permissões do usuário
export interface UserPermissions {
  user_type: UserType;
  plan_name: CommercialPlan;
  can_create_plan: boolean;
  can_edit_plan: boolean;
  can_view_plan: boolean;
  can_substitute: boolean;
  can_adjust: boolean;
  can_use_ai: boolean;
  can_use_simulations: boolean;
  can_manage_students: boolean;
  can_send_requests: boolean;
  is_linked_to_professional: boolean;
}

export interface StudentRequest {
  id: string;
  student_id: string;
  professional_id: string;
  request_type: StudentRequestType;
  description: string;
  justification: string;
  status: StudentRequestStatus;
  professional_response: string | null;
  professional_feedback: string | null;
  created_at: string;
  updated_at: string;
}

// Valid food categories (new taxonomy)
export const FOOD_CATEGORIES = [
  'frutas',
  'hortaliças_folhosas',
  'legumes',
  'cereais_tubérculos',
  'leguminosas',
  'proteínas_animais',
  'laticínios',
  'óleos_oleaginosas',
  'suplementos',
] as const;

export type FoodCategory = typeof FOOD_CATEGORIES[number];

// Processing levels for food classification
export const PROCESSING_LEVELS = [
  'in_natura',
  'minimamente_processado',
  'processado',
  'ultraprocessado',
  'suplemento',
] as const;

export type ProcessingLevel = typeof PROCESSING_LEVELS[number];

// Processing levels allowed for automatic substitutions
export const SUBSTITUTABLE_PROCESSING_LEVELS: ProcessingLevel[] = [
  'in_natura',
  'minimamente_processado',
];

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  category: FoodCategory | null;
  processing_level: ProcessingLevel;
  created_at: string;
  // Campos de conversão de unidades
  unit_name?: string | null;
  unit_weight_grams?: number | null;
  unit_increment?: number;
  unit_enabled?: boolean;
}

export interface DietPlan {
  id: string;
  user_id: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  released_to_student: boolean;
  status: DietPlanStatus;
  is_initial_plan: boolean;
  created_at: string;
}

// All possible meal types
export const MEAL_TYPES = [
  'breakfast',        // Café da manhã
  'morning_snack',    // Lanche da manhã
  'lunch',            // Almoço
  'afternoon_snack',  // Lanche da tarde
  'dinner',           // Jantar
  'supper',           // Ceia
] as const;

export type MealType = typeof MEAL_TYPES[number];

export interface Meal {
  id: string;
  diet_plan_id: string;
  name: MealType;
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
  // Campos de conversão de unidades (camada de apresentação)
  display_quantity?: number;
  display_unit?: string;
  calculated_grams?: number;
  unit_conversion_locked?: boolean;
}

export interface MealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
  foods?: MealOptionFood[];
}

export interface MealOptionFood {
  id: string;
  meal_option_id: string;
  food_id: string;
  quantity: number;
  created_at: string;
  food?: Food;
  // Campos de conversão de unidades (camada de apresentação)
  display_quantity?: number;
  display_unit?: string;
  calculated_grams?: number;
  unit_conversion_locked?: boolean;
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

export const MEAL_NAMES: Record<MealType, string> = {
  breakfast: 'Café da Manhã',
  morning_snack: 'Lanche da Manhã',
  lunch: 'Almoço',
  afternoon_snack: 'Lanche da Tarde',
  dinner: 'Jantar',
  supper: 'Ceia',
} as const;

// Get meals for a given meals_per_day setting
export function getMealsForCount(mealsPerDay: number): MealType[] {
  switch (mealsPerDay) {
    case 2:
      return ['lunch', 'dinner'];
    case 3:
      return ['breakfast', 'lunch', 'dinner'];
    case 4:
      return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
    case 5:
      return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
    case 6:
      return ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'supper'];
    default:
      return ['breakfast', 'lunch', 'afternoon_snack', 'dinner'];
  }
}

// Get calorie distribution for meals
export function getMealCalorieDistribution(mealsPerDay: number): Record<MealType, number> {
  switch (mealsPerDay) {
    case 2:
      return { breakfast: 0, morning_snack: 0, lunch: 0.5, afternoon_snack: 0, dinner: 0.5, supper: 0 };
    case 3:
      return { breakfast: 0.25, morning_snack: 0, lunch: 0.40, afternoon_snack: 0, dinner: 0.35, supper: 0 };
    case 4:
      return { breakfast: 0.25, morning_snack: 0, lunch: 0.35, afternoon_snack: 0.10, dinner: 0.30, supper: 0 };
    case 5:
      return { breakfast: 0.20, morning_snack: 0.10, lunch: 0.30, afternoon_snack: 0.10, dinner: 0.30, supper: 0 };
    case 6:
      return { breakfast: 0.20, morning_snack: 0.08, lunch: 0.28, afternoon_snack: 0.10, dinner: 0.26, supper: 0.08 };
    default:
      return { breakfast: 0.25, morning_snack: 0, lunch: 0.35, afternoon_snack: 0.10, dinner: 0.30, supper: 0 };
  }
}
