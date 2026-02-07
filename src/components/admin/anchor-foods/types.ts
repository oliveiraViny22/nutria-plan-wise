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
  goal_type?: string | null; // bulk, cut, maintain, or null for universal
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
  { value: "proteina", label: "Proteína" },
  { value: "proteina_leve", label: "Proteína Leve" },
  { value: "peixe", label: "Peixe" },
  { value: "vegetal", label: "Vegetal" },
  { value: "gordura", label: "Gordura" },
  { value: "gordura_boa", label: "Gordura Boa" },
  { value: "fruta", label: "Fruta" },
  { value: "laticinio", label: "Laticínio" },
  { value: "oleaginosa", label: "Oleaginosa" },
  { value: "tuberculo", label: "Tubérculo" },
];

export const getMealLabel = (type: string) => 
  MEAL_TYPES.find((m) => m.value === type)?.label || type;

export const getRoleLabel = (role: string) => 
  ROLE_NAMES.find((r) => r.value === role)?.label || role;

export const ROLE_COLORS: Record<string, string> = {
  carboidrato_base: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  leguminosa: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  proteina_principal: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  proteina: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  proteina_leve: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  peixe: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  vegetal: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  gordura: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  gordura_boa: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  fruta: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  laticinio: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  oleaginosa: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  tuberculo: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

export const GOAL_LABELS: Record<string, string> = {
  bulk: "Hipertrofia",
  cut: "Cutting",
  maintain: "Manutenção",
};

export const GOAL_COLORS: Record<string, string> = {
  bulk: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  cut: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  maintain: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
};

export const getGoalLabel = (goal: string | null | undefined) =>
  goal ? GOAL_LABELS[goal] || goal : "Universal";
