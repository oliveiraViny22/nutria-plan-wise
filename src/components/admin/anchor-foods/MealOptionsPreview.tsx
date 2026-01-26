import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, UtensilsCrossed } from "lucide-react";
import { AnchorFood, MEAL_TYPES, getMealLabel, getRoleLabel, ROLE_COLORS } from "./types";

interface MealOptionsPreviewProps {
  anchors: AnchorFood[];
}

export function MealOptionsPreview({ anchors }: MealOptionsPreviewProps) {
  const [open, setOpen] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState("lunch");

  // Filter active anchors for selected meal
  const mealAnchors = anchors.filter(
    (a) => a.meal_type === selectedMeal && a.is_active
  );

  // Build preview for each option (1, 2, 3)
  const buildOptionPreview = (optionNumber: number) => {
    // Get anchors that apply to this option
    // option_number = 0 means "all options"
    // option_number = N means "only option N"
    const optionAnchors = mealAnchors.filter(
      (a) => a.option_number === 0 || a.option_number === optionNumber
    );

    // Group by role for display
    const byRole = optionAnchors.reduce((acc, anchor) => {
      if (!acc[anchor.role_name]) acc[anchor.role_name] = [];
      acc[anchor.role_name].push(anchor);
      return acc;
    }, {} as Record<string, AnchorFood[]>);

    return { optionAnchors, byRole };
  };

  const options = [1, 2, 3].map((num) => ({
    number: num,
    ...buildOptionPreview(num),
  }));

  // Calculate totals for each option
  const calculateTotals = (optionAnchors: AnchorFood[]) => {
    return optionAnchors.reduce(
      (acc, a) => {
        if (a.food) {
          const multiplier = a.default_quantity_grams / 100;
          acc.calories += Math.round(a.food.calories * multiplier);
          acc.protein += Math.round(a.food.protein * multiplier);
          acc.carbs += Math.round(a.food.carbs * multiplier);
          acc.fat += Math.round(a.food.fat * multiplier);
        }
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  };

  // Meals with anchors
  const mealsWithAnchors = [...new Set(anchors.filter(a => a.is_active).map((a) => a.meal_type))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview de Opções de Refeição</DialogTitle>
          <DialogDescription>
            Visualize como as 3 opções serão montadas com as âncoras configuradas
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4">
            <Select value={selectedMeal} onValueChange={setSelectedMeal}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEAL_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                    {mealsWithAnchors.includes(m.value) && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mealAnchors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma âncora ativa para {getMealLabel(selectedMeal)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {options.map((option) => {
                const totals = calculateTotals(option.optionAnchors);
                
                return (
                  <Card key={option.number} className="border-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Opção {option.number}</span>
                        <Badge variant="outline" className="font-normal">
                          {totals.calories} kcal
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {option.optionAnchors.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Sem âncoras específicas
                        </p>
                      ) : (
                        <>
                          {Object.entries(option.byRole).map(([role, items]) => (
                            <div key={role} className="space-y-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${ROLE_COLORS[role] || ""}`}
                              >
                                {getRoleLabel(role)}
                              </Badge>
                              {items.map((item) => (
                                <div
                                  key={item.id}
                                  className="text-sm flex justify-between items-center py-1 px-2 bg-muted/50 rounded"
                                >
                                  <span className="truncate">
                                    {item.food?.name}
                                  </span>
                                  <span className="text-muted-foreground text-xs ml-2 whitespace-nowrap">
                                    {item.default_quantity_grams}g
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))}

                          <div className="pt-2 border-t text-xs text-muted-foreground">
                            <div className="grid grid-cols-3 gap-2">
                              <span>P: {totals.protein}g</span>
                              <span>C: {totals.carbs}g</span>
                              <span>G: {totals.fat}g</span>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Legenda</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                <Badge variant="default" className="mr-2">Todas</Badge>
                Aparece em todas as opções
              </li>
              <li>
                <Badge variant="secondary" className="mr-2">Opção N</Badge>
                Aparece apenas na opção específica
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              * Os valores mostrados são apenas das âncoras. Alimentos adicionais 
              serão incluídos pelo algoritmo de geração.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
