import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MacroChart } from '@/components/MacroChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Meal, MealFood, Food, MEAL_NAMES, SUBSTITUTABLE_PROCESSING_LEVELS, ProcessingLevel, MealType } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Parse serving_size to extract base grams (e.g., "100g" -> 100, "1 unidade (50g)" -> 50)
function parseServingGrams(servingSize: string): number {
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

// Get unit from serving size (g or ml)
function getUnit(servingSize: string): string {
  if (servingSize.toLowerCase().includes('ml')) return 'ml';
  return 'g';
}

// Calculate total grams for display
function getTotalGrams(food: Food, quantity: number): number {
  const baseGrams = parseServingGrams(food.serving_size);
  // If quantity is stored as grams (>10), use directly; otherwise treat as multiplier
  if (quantity >= 10) return Math.round(quantity);
  return Math.round(baseGrams * quantity);
}

// Calculate nutrients for a given quantity
function calcNutrients(food: Food, gramsQty: number) {
  const baseGrams = parseServingGrams(food.serving_size);
  const multiplier = gramsQty / baseGrams;
  return {
    calories: Math.round(food.calories * multiplier),
    protein: Math.round(food.protein * multiplier),
    carbs: Math.round(food.carbs * multiplier),
    fat: Math.round(food.fat * multiplier),
  };
}

export default function MealDetail() {
  const { mealId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealFoods, setMealFoods] = useState<MealFood[]>([]);
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [substituting, setSubstituting] = useState(false);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [selectedMealFood, setSelectedMealFood] = useState<MealFood | null>(null);
  const [selectedNewFood, setSelectedNewFood] = useState<Food | null>(null);
  const [adjustedQuantity, setAdjustedQuantity] = useState<number>(0);
  const [impactExplanation, setImpactExplanation] = useState<string | null>(null);
  const [showImpact, setShowImpact] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);

  useEffect(() => {
    fetchMealData();
    fetchAllFoods();
  }, [mealId]);

  const fetchMealData = async () => {
    if (!mealId) return;

    try {
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .select('*')
        .eq('id', mealId)
        .single();

      if (mealError) throw mealError;
      setMeal(mealData as Meal);

      const { data: mealFoodsData, error: mealFoodsError } = await supabase
        .from('meal_foods')
        .select(`*, food:foods(*)`)
        .eq('meal_id', mealId);

      if (mealFoodsError) throw mealFoodsError;
      setMealFoods(mealFoodsData as MealFood[]);
    } catch (error: any) {
      console.error('Error fetching meal:', error);
      toast.error('Erro ao carregar refeição');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllFoods = async () => {
    const { data, error } = await supabase.from('foods').select('*').order('name');
    if (!error && data) {
      setAllFoods(data as Food[]);
    }
  };

  // Check if a food can be used in automatic substitutions
  const canBeSubstituted = (food: Food): boolean => {
    // Supplements cannot be auto-substituted
    if (food.category === 'suplementos') return false;
    // Only in_natura and minimamente_processado can be substituted
    const processingLevel = (food as any).processing_level as ProcessingLevel | undefined;
    if (processingLevel && !SUBSTITUTABLE_PROCESSING_LEVELS.includes(processingLevel)) {
      return false;
    }
    return true;
  };

  // Filter foods by same category for substitution (respecting processing level rules)
  const filteredFoodsForSubstitution = useMemo(() => {
    if (!selectedMealFood?.food) return [];
    const currentFood = selectedMealFood.food as Food;
    const currentCategory = currentFood.category;
    
    // If current food cannot be substituted, return empty
    if (!canBeSubstituted(currentFood)) return [];
    
    return allFoods.filter((f) => {
      // Must be different food
      if (f.id === currentFood.id) return false;
      // Must be same category
      if (f.category !== currentCategory) return false;
      // Must be substitutable (not supplement, not processed/ultraprocessed)
      if (!canBeSubstituted(f)) return false;
      return true;
    });
  }, [selectedMealFood, allFoods]);

  const openSubstituteModal = (mealFood: MealFood) => {
    setSelectedMealFood(mealFood);
    setSelectedNewFood(null);
    setAdjustedQuantity(0);
    setImpactExplanation(null);
    setShowSubstituteModal(true);
  };

  const handleSelectNewFood = async (food: Food) => {
    if (!selectedMealFood?.food) return;
    
    const originalFood = selectedMealFood.food as Food;
    const originalQty = getTotalGrams(originalFood, selectedMealFood.quantity);
    const originalNutrients = calcNutrients(originalFood, originalQty);
    
    // Calculate quantity of new food to EXACTLY match calories of original
    const newBaseGrams = parseServingGrams(food.serving_size);
    const caloriesPerBaseGram = food.calories / newBaseGrams;
    
    // Calculate exact grams needed to match original calories
    let targetGrams = caloriesPerBaseGram > 0 
      ? originalNutrients.calories / caloriesPerBaseGram 
      : newBaseGrams;
    
    // Round to nearest gram for precision
    targetGrams = Math.round(targetGrams);
    
    // Clamp to reasonable range (10g - 500g)
    const adjustedQty = Math.min(500, Math.max(10, targetGrams));
    
    setSelectedNewFood(food);
    setAdjustedQuantity(adjustedQty);
    setLoadingImpact(true);

    try {
      // Calculate nutrients with the adjusted quantity
      const newNutrients = calcNutrients(food, adjustedQty);
      
      const response = await supabase.functions.invoke('explain-substitution', {
        body: {
          originalFood: { 
            ...originalFood, 
            quantity: originalQty,
            adjustedCalories: originalNutrients.calories 
          },
          newFood: { 
            ...food, 
            quantity: adjustedQty,
            adjustedCalories: newNutrients.calories 
          },
          userGoal: profile?.goal,
          dailyCalories: profile?.daily_calories,
        },
      });

      if (response.error) throw response.error;
      setImpactExplanation(response.data.explanation);
    } catch (error: any) {
      console.error('Error getting explanation:', error);
      setImpactExplanation('A quantidade foi ajustada para manter as mesmas calorias do alimento original.');
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmSubstitution = async () => {
    if (!selectedMealFood || !selectedNewFood || !meal) return;

    setSubstituting(true);

    try {
      const oldFood = selectedMealFood.food as Food;
      const oldQty = getTotalGrams(oldFood, selectedMealFood.quantity);
      const oldNutrients = calcNutrients(oldFood, oldQty);
      const newNutrients = calcNutrients(selectedNewFood, adjustedQuantity);

      // Update meal_food with new food and adjusted quantity
      const { error: updateError } = await supabase
        .from('meal_foods')
        .update({ food_id: selectedNewFood.id, quantity: adjustedQuantity })
        .eq('id', selectedMealFood.id);

      if (updateError) throw updateError;

      // Calculate differences in macros only (calories should stay ~same due to quantity adjustment)
      const proteinDiff = newNutrients.protein - oldNutrients.protein;
      const carbsDiff = newNutrients.carbs - oldNutrients.carbs;
      const fatDiff = newNutrients.fat - oldNutrients.fat;

      // Recalculate meal totals from scratch to ensure accuracy
      const { data: updatedMealFoods } = await supabase
        .from('meal_foods')
        .select(`*, food:foods(*)`)
        .eq('meal_id', meal.id);

      let mealCalories = 0;
      let mealProtein = 0;
      let mealCarbs = 0;
      let mealFat = 0;

      if (updatedMealFoods) {
        for (const mf of updatedMealFoods) {
          const food = mf.food as Food;
          const qty = getTotalGrams(food, mf.quantity);
          const nutrients = calcNutrients(food, qty);
          mealCalories += nutrients.calories;
          mealProtein += nutrients.protein;
          mealCarbs += nutrients.carbs;
          mealFat += nutrients.fat;
        }
      }

      // Update meal with recalculated totals
      const { error: mealError } = await supabase
        .from('meals')
        .update({
          total_calories: mealCalories,
          total_protein: mealProtein,
          total_carbs: mealCarbs,
          total_fat: mealFat,
        })
        .eq('id', meal.id);

      if (mealError) throw mealError;

      // Recalculate diet plan totals from all meals
      const { data: allMeals } = await supabase
        .from('meals')
        .select('*')
        .eq('diet_plan_id', meal.diet_plan_id);

      let planCalories = 0;
      let planProtein = 0;
      let planCarbs = 0;
      let planFat = 0;

      if (allMeals) {
        // For meals other than current one, use their stored values
        // For current meal, use our freshly calculated values
        for (const m of allMeals) {
          if (m.id === meal.id) {
            planCalories += mealCalories;
            planProtein += mealProtein;
            planCarbs += mealCarbs;
            planFat += mealFat;
          } else {
            planCalories += m.total_calories || 0;
            planProtein += m.total_protein || 0;
            planCarbs += m.total_carbs || 0;
            planFat += m.total_fat || 0;
          }
        }
      }

      // Update diet plan with accurate totals
      await supabase
        .from('diet_plans')
        .update({
          total_calories: planCalories,
          total_protein: planProtein,
          total_carbs: planCarbs,
          total_fat: planFat,
        })
        .eq('id', meal.diet_plan_id);

      toast.success('Alimento substituído com sucesso!');
      setShowSubstituteModal(false);
      setShowImpact(true);
      await fetchMealData();
    } catch (error: any) {
      console.error('Error substituting:', error);
      toast.error('Erro ao substituir alimento');
    } finally {
      setSubstituting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Refeição não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-semibold text-foreground">
              {MEAL_NAMES[meal.name as MealType] || meal.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {meal.total_calories} kcal
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Macros Overview */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-elevated rounded-2xl p-6"
        >
          <h2 className="font-semibold text-foreground mb-4">
            Macros da Refeição
          </h2>
          <MacroChart
            protein={meal.total_protein}
            carbs={meal.total_carbs}
            fat={meal.total_fat}
            proteinTarget={meal.total_protein}
            carbsTarget={meal.total_carbs}
            fatTarget={meal.total_fat}
          />
        </motion.section>

        {/* Impact Explanation Card */}
        <AnimatePresence>
          {showImpact && impactExplanation && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="card-elevated rounded-2xl p-6 border-l-4 border-l-primary"
            >
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Impacto nutricional da substituição
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {impactExplanation}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => setShowImpact(false)}
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Foods List */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="font-semibold text-foreground">Alimentos</h2>
          {mealFoods.map((mealFood, index) => {
            const food = mealFood.food as Food;
            const totalGrams = getTotalGrams(food, mealFood.quantity);
            const unit = getUnit(food.serving_size);
            const nutrients = calcNutrients(food, totalGrams);
            
            return (
              <motion.div
                key={mealFood.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="card-elevated rounded-xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">
                      {food?.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {totalGrams}{unit}
                    </p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-protein font-medium">
                        P: {nutrients.protein}g
                      </span>
                      <span className="text-carbs font-medium">
                        C: {nutrients.carbs}g
                      </span>
                      <span className="text-fat font-medium">
                        G: {nutrients.fat}g
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">
                      {nutrients.calories} kcal
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => openSubstituteModal(mealFood)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Substituir
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.section>
      </main>

      {/* Substitute Modal */}
      <Dialog open={showSubstituteModal} onOpenChange={setShowSubstituteModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Substituir Alimento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Food */}
            <div className="p-4 bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">
                Alimento atual
              </p>
              <p className="font-medium text-foreground">
                {(selectedMealFood?.food as Food)?.name}
              </p>
              {selectedMealFood?.food && (
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {(() => {
                    const food = selectedMealFood.food as Food;
                    const qty = getTotalGrams(food, selectedMealFood.quantity);
                    const nutrients = calcNutrients(food, qty);
                    return (
                      <>
                        <span>{qty}{getUnit(food.serving_size)}</span>
                        <span>{nutrients.calories} kcal</span>
                        <span>P: {nutrients.protein}g</span>
                        <span>C: {nutrients.carbs}g</span>
                        <span>G: {nutrients.fat}g</span>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Category Info */}
            {selectedMealFood?.food && (
              <div className="p-3 bg-primary/10 rounded-lg">
                <p className="text-xs text-primary font-medium">
                  📌 Categoria: {(selectedMealFood.food as Food).category}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Substituições permitidas apenas entre alimentos naturais ou minimamente processados da mesma categoria.
                </p>
                {(selectedMealFood.food as Food).category === 'suplementos' && (
                  <p className="text-xs text-destructive mt-1">
                    ⚠️ Suplementos não podem ser substituídos automaticamente.
                  </p>
                )}
              </div>
            )}

            {/* New Food Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Escolha o novo alimento ({filteredFoodsForSubstitution.length} opções)
              </p>
              {filteredFoodsForSubstitution.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  Não há outros alimentos disponíveis nesta categoria.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {filteredFoodsForSubstitution.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => handleSelectNewFood(food)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedNewFood?.id === food.id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <p className="font-medium text-foreground text-sm">
                        {food.name}
                      </p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{food.calories} kcal/{food.serving_size}</span>
                        <span>P: {food.protein}g</span>
                        <span>C: {food.carbs}g</span>
                        <span>G: {food.fat}g</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Impact Explanation */}
            {selectedNewFood && (
              <div className="p-4 bg-secondary/50 rounded-xl border-l-4 border-l-primary">
                {loadingImpact ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Analisando impacto nutricional...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">
                        Impacto da substituição
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {impactExplanation}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Comparison */}
            {selectedNewFood && selectedMealFood?.food && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Antes</p>
                  {(() => {
                    const food = selectedMealFood.food as Food;
                    const qty = getTotalGrams(food, selectedMealFood.quantity);
                    const nutrients = calcNutrients(food, qty);
                    return (
                      <>
                        <p className="text-lg font-bold text-foreground">
                          {nutrients.calories} kcal
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {qty}{getUnit(food.serving_size)}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Depois</p>
                  {(() => {
                    const nutrients = calcNutrients(selectedNewFood, adjustedQuantity);
                    return (
                      <>
                        <p className="text-lg font-bold text-primary">
                          {nutrients.calories} kcal
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {adjustedQuantity}{getUnit(selectedNewFood.serving_size)}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSubstituteModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={confirmSubstitution}
                disabled={!selectedNewFood || substituting}
              >
                {substituting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Substituindo...
                  </>
                ) : (
                  'Confirmar substituição'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
