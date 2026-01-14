import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MacroChart } from '@/components/MacroChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Meal, MealFood, Food, MEAL_NAMES } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
        .select(`
          *,
          food:foods(*)
        `)
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

  const openSubstituteModal = (mealFood: MealFood) => {
    setSelectedMealFood(mealFood);
    setSelectedNewFood(null);
    setImpactExplanation(null);
    setShowSubstituteModal(true);
  };

  const handleSelectNewFood = async (food: Food) => {
    setSelectedNewFood(food);
    setLoadingImpact(true);

    try {
      const response = await supabase.functions.invoke('explain-substitution', {
        body: {
          originalFood: selectedMealFood?.food,
          newFood: food,
          userGoal: profile?.goal,
          dailyCalories: profile?.daily_calories,
        },
      });

      if (response.error) throw response.error;
      setImpactExplanation(response.data.explanation);
    } catch (error: any) {
      console.error('Error getting explanation:', error);
      setImpactExplanation('Não foi possível gerar a explicação neste momento.');
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmSubstitution = async () => {
    if (!selectedMealFood || !selectedNewFood || !meal) return;

    setSubstituting(true);

    try {
      // Update meal_food with new food
      const { error: updateError } = await supabase
        .from('meal_foods')
        .update({ food_id: selectedNewFood.id })
        .eq('id', selectedMealFood.id);

      if (updateError) throw updateError;

      // Recalculate meal totals
      const oldFood = selectedMealFood.food as Food;
      const quantity = selectedMealFood.quantity;

      const calorieDiff = (selectedNewFood.calories - oldFood.calories) * quantity;
      const proteinDiff = (selectedNewFood.protein - oldFood.protein) * quantity;
      const carbsDiff = (selectedNewFood.carbs - oldFood.carbs) * quantity;
      const fatDiff = (selectedNewFood.fat - oldFood.fat) * quantity;

      const { error: mealError } = await supabase
        .from('meals')
        .update({
          total_calories: meal.total_calories + calorieDiff,
          total_protein: meal.total_protein + proteinDiff,
          total_carbs: meal.total_carbs + carbsDiff,
          total_fat: meal.total_fat + fatDiff,
        })
        .eq('id', meal.id);

      if (mealError) throw mealError;

      // Update diet plan totals
      const { data: planData } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('id', meal.diet_plan_id)
        .single();

      if (planData) {
        await supabase
          .from('diet_plans')
          .update({
            total_calories: planData.total_calories + calorieDiff,
            total_protein: planData.total_protein + proteinDiff,
            total_carbs: planData.total_carbs + carbsDiff,
            total_fat: planData.total_fat + fatDiff,
          })
          .eq('id', planData.id);
      }

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
              {MEAL_NAMES[meal.name]}
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
          {mealFoods.map((mealFood, index) => (
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
                    {(mealFood.food as Food)?.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {(mealFood.food as Food)?.serving_size} × {mealFood.quantity}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-protein font-medium">
                      P: {Math.round((mealFood.food as Food)?.protein * mealFood.quantity)}g
                    </span>
                    <span className="text-carbs font-medium">
                      C: {Math.round((mealFood.food as Food)?.carbs * mealFood.quantity)}g
                    </span>
                    <span className="text-fat font-medium">
                      G: {Math.round((mealFood.food as Food)?.fat * mealFood.quantity)}g
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {Math.round((mealFood.food as Food)?.calories * mealFood.quantity)} kcal
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
          ))}
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
              <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                <span>{(selectedMealFood?.food as Food)?.calories} kcal</span>
                <span>P: {(selectedMealFood?.food as Food)?.protein}g</span>
                <span>C: {(selectedMealFood?.food as Food)?.carbs}g</span>
                <span>G: {(selectedMealFood?.food as Food)?.fat}g</span>
              </div>
            </div>

            {/* New Food Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Escolha o novo alimento
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {allFoods
                  .filter((f) => f.id !== (selectedMealFood?.food as Food)?.id)
                  .map((food) => (
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
                        <span>{food.calories} kcal</span>
                        <span>P: {food.protein}g</span>
                        <span>C: {food.carbs}g</span>
                        <span>G: {food.fat}g</span>
                      </div>
                    </button>
                  ))}
              </div>
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
            {selectedNewFood && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Antes</p>
                  <p className="text-lg font-bold text-foreground">
                    {(selectedMealFood?.food as Food)?.calories} kcal
                  </p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Depois</p>
                  <p className="text-lg font-bold text-primary">
                    {selectedNewFood.calories} kcal
                  </p>
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
