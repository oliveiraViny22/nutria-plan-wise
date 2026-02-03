import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Utensils, Coffee, Apple, Sun, Moon, Salad } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnchorFood {
  id: string;
  meal_type: string;
  option_number: number;
  role_name: string;
  default_quantity_grams: number;
  sort_order: number;
  food: {
    id: string;
    name: string;
    category: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

const MEAL_CONFIG = [
  { key: "breakfast", label: "Café da Manhã", icon: Coffee, color: "bg-amber-500" },
  { key: "morning_snack", label: "Lanche Manhã", icon: Apple, color: "bg-green-500" },
  { key: "lunch", label: "Almoço", icon: Sun, color: "bg-orange-500" },
  { key: "afternoon_snack", label: "Lanche Tarde", icon: Salad, color: "bg-emerald-500" },
  { key: "dinner", label: "Jantar", icon: Moon, color: "bg-indigo-500" },
  { key: "supper", label: "Ceia", icon: Utensils, color: "bg-purple-500" },
];

const ROLE_LABELS: Record<string, string> = {
  proteina_principal: "Proteína",
  proteina: "Proteína",
  proteina_leve: "Proteína Leve",
  carboidrato_base: "Carboidrato",
  carboidrato: "Carboidrato",
  leguminosa: "Leguminosa",
  vegetal: "Vegetal",
  gordura: "Gordura",
  gordura_boa: "Gordura Boa",
  fruta: "Fruta",
  laticinio: "Laticínio",
  laticinios: "Laticínio",
};

export function TemplateAnchorPreview() {
  const { data: anchors, isLoading } = useQuery({
    queryKey: ["anchor-preview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meal_anchor_foods")
        .select(`
          id,
          meal_type,
          option_number,
          role_name,
          default_quantity_grams,
          sort_order,
          food:foods(id, name, category, calories, protein, carbs, fat)
        `)
        .eq("is_active", true)
        .order("meal_type")
        .order("option_number")
        .order("sort_order");

      if (error) throw error;
      return data as AnchorFood[];
    },
  });

  // Group anchors by meal_type and option_number
  const groupedAnchors = anchors?.reduce((acc, anchor) => {
    const key = anchor.meal_type;
    if (!acc[key]) acc[key] = {};
    
    const optKey = anchor.option_number;
    if (!acc[key][optKey]) acc[key][optKey] = [];
    acc[key][optKey].push(anchor);
    
    return acc;
  }, {} as Record<string, Record<number, AnchorFood[]>>);

  const calculateMacros = (foods: AnchorFood[]) => {
    return foods.reduce(
      (totals, item) => {
        const mult = item.default_quantity_grams / 100;
        return {
          calories: totals.calories + (item.food.calories * mult),
          protein: totals.protein + (item.food.protein * mult),
          carbs: totals.carbs + (item.food.carbs * mult),
          fat: totals.fat + (item.food.fat * mult),
        };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Preview das Opções</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const mealsWithAnchors = MEAL_CONFIG.filter(
    (meal) => groupedAnchors?.[meal.key] && Object.keys(groupedAnchors[meal.key]).length > 0
  );

  if (mealsWithAnchors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Preview das Opções</CardTitle>
          </div>
          <CardDescription>
            Visualize como as âncoras configuradas aparecem em cada opção de refeição
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Utensils className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma âncora configurada</p>
            <p className="text-sm">Configure âncoras para ver o preview</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Preview das Opções</CardTitle>
        </div>
        <CardDescription>
          Visualize como as âncoras configuradas aparecem em cada opção de refeição
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={mealsWithAnchors[0]?.key} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
            {mealsWithAnchors.map((meal) => {
              const Icon = meal.icon;
              const optionCount = Object.keys(groupedAnchors?.[meal.key] || {}).length;
              return (
                <TabsTrigger 
                  key={meal.key} 
                  value={meal.key}
                  className="flex items-center gap-1.5 text-xs px-2 py-1.5"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{meal.label}</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    {optionCount}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {mealsWithAnchors.map((meal) => {
            const mealAnchors = groupedAnchors?.[meal.key] || {};
            const options = Object.entries(mealAnchors).sort(([a], [b]) => Number(a) - Number(b));
            
            return (
              <TabsContent key={meal.key} value={meal.key} className="mt-4">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {options.map(([optNum, foods]) => {
                      const macros = calculateMacros(foods);
                      const optionLabel = Number(optNum) === 0 
                        ? "Universal" 
                        : `Opção ${optNum}`;
                      
                      return (
                        <div 
                          key={optNum} 
                          className="border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <Badge className={`${meal.color} text-white`}>
                              {optionLabel}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {foods.length} itens
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            {foods.sort((a, b) => a.sort_order - b.sort_order).map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center justify-between text-sm bg-muted/50 rounded px-2 py-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate max-w-[120px]">
                                    {item.food.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] h-5">
                                    {ROLE_LABELS[item.role_name] || item.role_name}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {item.default_quantity_grams}g
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="pt-2 border-t">
                            <div className="grid grid-cols-4 gap-1 text-[10px]">
                              <div className="text-center">
                                <div className="font-semibold text-primary">
                                  {Math.round(macros.calories)}
                                </div>
                                <div className="text-muted-foreground">kcal</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-blue-500">
                                  {macros.protein.toFixed(1)}g
                                </div>
                                <div className="text-muted-foreground">prot</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-amber-500">
                                  {macros.carbs.toFixed(1)}g
                                </div>
                                <div className="text-muted-foreground">carb</div>
                              </div>
                              <div className="text-center">
                                <div className="font-semibold text-orange-500">
                                  {macros.fat.toFixed(1)}g
                                </div>
                                <div className="text-muted-foreground">gord</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
