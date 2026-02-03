// =====================================================
// TIPOS DO GERADOR v5
// =====================================================

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string;
  processing_level: string | null;
  is_optional: boolean | null;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number | null;
  unit_enabled: boolean | null;
}

export interface MealTemplate {
  id: string;
  meal_type: string;
  name: string;
  min_items: number;
  max_items: number;
}

export interface TemplateRole {
  id: string;
  template_id: string;
  role_name: string;
  is_required: boolean;
  min_quantity_grams: number;
  max_quantity_grams: number;
  sort_order: number;
  categories: string[];
}

export interface FoodSelection {
  food: Food;
  role_name: string;
  quantity_grams: number;
  display_quantity: number;
  display_unit: string;
}

export interface MealResult {
  meal_type: string;
  meal_name: string;
  foods: FoodSelection[];
  totals: MacroTotals;
}

export interface MacroTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface StructuralValidation {
  valid: boolean;
  errors: string[];
}

export interface NutritionalValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metrics: {
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
    caloriePercent: number;
    proteinPercent: number;
    carbsPercent: number;
    fatPercentOfCals: number;
  };
}

export interface AnchorFood {
  id: string;
  meal_type: string;
  option_number: number;
  food_id: string;
  role_name: string;
  default_quantity_grams: number;
  sort_order: number;
  food: Food;
}

export interface AnchorsByRole {
  role_name: string;
  anchors: AnchorFood[];
}

export interface MealWithOptions {
  mealType: string;
  options: MealResult[];
}

export interface ScaleResult {
  scaledMeals: MealResult[];
  scaleFactor: number;
  beforeTotals: MacroTotals;
  afterTotals: MacroTotals;
  iterations: number;
  converged: boolean;
  proteinAdjusted: boolean;
}

export interface UserProfile {
  user_id: string;
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  meals_per_day: number | null;
  preferred_foods: string[] | null;
  avoided_foods: string[] | null;
  restrictions: string[] | null;
  onboarding_completed: boolean | null;
}

// =====================================================
// TIPOS DE CONTEXTO DE PLANO (v5.8)
// =====================================================

export type PlanContext = "automatic" | "professional";

export interface PlanGenerationConfig {
  context: PlanContext;
  userId: string;
  professionalId?: string | null;
  mealsPerDay: number;
  mealOptionsLimit: number;
}
