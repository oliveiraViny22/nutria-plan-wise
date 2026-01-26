export interface AnchorFood {
  id: string;
  meal_type: string;
  option_number: number;
  food_id: string;
  role_name: string;
  default_quantity_grams: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  food?: {
    id: string;
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export const MEAL_TYPES = [
  { value: "breakfast", label: "Café da Manhã" },
  { value: "morning_snack", label: "Lanche da Manhã" },
  { value: "lunch", label: "Almoço" },
  { value: "afternoon_snack", label: "Lanche da Tarde" },
  { value: "dinner", label: "Jantar" },
  { value: "supper", label: "Ceia" },
];

export const ROLE_NAMES = [
  { value: "carboidrato_base", label: "Carboidrato Base" },
  { value: "leguminosa", label: "Leguminosa" },
  { value: "proteina_principal", label: "Proteína Principal" },
  { value: "vegetal", label: "Vegetal" },
  { value: "gordura", label: "Gordura" },
  { value: "fruta", label: "Fruta" },
  { value: "laticinios", label: "Laticínio" },
];

export const getMealLabel = (type: string) => 
  MEAL_TYPES.find((m) => m.value === type)?.label || type;

export const getRoleLabel = (role: string) => 
  ROLE_NAMES.find((r) => r.value === role)?.label || role;

export const ROLE_COLORS: Record<string, string> = {
  carboidrato_base: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  leguminosa: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  proteina_principal: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  vegetal: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  gordura: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  fruta: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  laticinios: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};
