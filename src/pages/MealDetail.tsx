import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/MobileNav';
import { MacroChart } from '@/components/MacroChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useUserRole } from '@/hooks/useUserRole';
import { Meal, Food, MEAL_NAMES, SUBSTITUTABLE_PROCESSING_LEVELS, ProcessingLevel, MealType, MealOption, MealOptionFood } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { isLinkedStudent } = useLinkedStudent();
  const { isProfessional } = useUserRole();
  
  // Check if this is a professional viewing a student's meal
  const studentIdFromQuery = searchParams.get('studentId');
  const isProfessionalViewingStudent = isProfessional && !!studentIdFromQuery;
  
  // Only restrict editing for linked students (not for professionals or regular users)
  const canEdit = !isLinkedStudent || isProfessionalViewingStudent;
  
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('1');
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [substituting, setSubstituting] = useState(false);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [selectedMealOptionFood, setSelectedMealOptionFood] = useState<MealOptionFood | null>(null);
  const [currentOptionId, setCurrentOptionId] = useState<string | null>(null);
  const [selectedNewFood, setSelectedNewFood] = useState<Food | null>(null);
  const [adjustedQuantity, setAdjustedQuantity] = useState<number>(0);
  const [impactExplanation, setImpactExplanation] = useState<string | null>(null);
  const [showImpact, setShowImpact] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  useEffect(() => {
    fetchMealData();
    fetchAllFoods();
  }, [mealId]);

  const fetchMealData = async () => {
    if (!mealId) return;

    try {
      // Fetch meal
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .select('*')
        .eq('id', mealId)
        .single();

      if (mealError) throw mealError;
      setMeal(mealData as Meal);

      // Fetch meal options with their foods
      const { data: optionsData, error: optionsError } = await supabase
        .from('meal_options')
        .select(`
          *,
          foods:meal_option_foods(
            *,
            food:foods(*)
          )
        `)
        .eq('meal_id', mealId)
        .order('option_number');

      if (optionsError) throw optionsError;
      
      const options = (optionsData || []).map(opt => ({
        ...opt,
        foods: opt.foods || []
      })) as MealOption[];
      
      setMealOptions(options);
      
      // Set default selected option
      if (options.length > 0) {
        setSelectedOption(options[0].option_number.toString());
      }
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

  // Get currently selected option
  const currentOption = useMemo(() => {
    return mealOptions.find(opt => opt.option_number.toString() === selectedOption);
  }, [mealOptions, selectedOption]);

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
    if (!selectedMealOptionFood?.food) return [];
    const currentFood = selectedMealOptionFood.food as Food;
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
  }, [selectedMealOptionFood, allFoods]);

  const openSubstituteModal = (optionFood: MealOptionFood, optionId: string) => {
    setSelectedMealOptionFood(optionFood);
    setCurrentOptionId(optionId);
    setSelectedNewFood(null);
    setAdjustedQuantity(0);
    setImpactExplanation(null);
    setShowSubstituteModal(true);
  };

  const handleSelectNewFood = async (food: Food) => {
    if (!selectedMealOptionFood?.food) return;
    
    const originalFood = selectedMealOptionFood.food as Food;
    const originalQty = getTotalGrams(originalFood, selectedMealOptionFood.quantity);
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

      // Check for usage limit error in response data (403 returns data, not error.message)
      if (response.data?.upgradeRequired || response.data?.allowed === false) {
        setShowUpgradeDialog(true);
        setImpactExplanation('A quantidade foi ajustada para manter as mesmas calorias do alimento original.');
        return;
      }
      
      if (response.error) {
        throw response.error;
      }
      
      setImpactExplanation(response.data.explanation);
    } catch (error: any) {
      console.error('Error getting explanation:', error);
      setImpactExplanation('A quantidade foi ajustada para manter as mesmas calorias do alimento original.');
    } finally {
      setLoadingImpact(false);
    }
  };

  const confirmSubstitution = async () => {
    if (!selectedMealOptionFood || !selectedNewFood || !meal || !currentOptionId) return;

    setSubstituting(true);

    try {
      const oldFood = selectedMealOptionFood.food as Food;
      const oldQty = getTotalGrams(oldFood, selectedMealOptionFood.quantity);
      const oldNutrients = calcNutrients(oldFood, oldQty);
      const newNutrients = calcNutrients(selectedNewFood, adjustedQuantity);

      // Update meal_option_food with new food and adjusted quantity
      const { error: updateError } = await supabase
        .from('meal_option_foods')
        .update({ food_id: selectedNewFood.id, quantity: adjustedQuantity })
        .eq('id', selectedMealOptionFood.id);

      if (updateError) throw updateError;

      // Recalculate option totals from scratch
      const { data: updatedOptionFoods } = await supabase
        .from('meal_option_foods')
        .select(`*, food:foods(*)`)
        .eq('meal_option_id', currentOptionId);

      let optionCalories = 0;
      let optionProtein = 0;
      let optionCarbs = 0;
      let optionFat = 0;

      if (updatedOptionFoods) {
        for (const mof of updatedOptionFoods) {
          const food = mof.food as Food;
          const qty = getTotalGrams(food, mof.quantity);
          const nutrients = calcNutrients(food, qty);
          optionCalories += nutrients.calories;
          optionProtein += nutrients.protein;
          optionCarbs += nutrients.carbs;
          optionFat += nutrients.fat;
        }
      }

      // Update meal option with recalculated totals
      const { error: optionError } = await supabase
        .from('meal_options')
        .update({
          total_calories: optionCalories,
          total_protein: optionProtein,
          total_carbs: optionCarbs,
          total_fat: optionFat,
        })
        .eq('id', currentOptionId);

      if (optionError) throw optionError;

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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border pt-safe">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <MobileNav />
          <Button variant="ghost" size="icon" className="hidden md:flex h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">
              {MEAL_NAMES[meal.name as MealType] || meal.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {mealOptions.length} opções disponíveis
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-safe">
        {/* Options Tabs */}
        {mealOptions.length > 0 ? (
          <Tabs value={selectedOption} onValueChange={setSelectedOption} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${mealOptions.length}, 1fr)` }}>
              {mealOptions.map((option) => (
                <TabsTrigger 
                  key={option.id} 
                  value={option.option_number.toString()}
                  className="text-xs sm:text-sm"
                >
                  Opção {option.option_number}
                </TabsTrigger>
              ))}
            </TabsList>

            {mealOptions.map((option) => (
              <TabsContent key={option.id} value={option.option_number.toString()} className="space-y-4 sm:space-y-6 mt-4">
                {/* Macros Overview */}
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6"
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <h2 className="font-semibold text-foreground text-sm sm:text-base">
                      Macros da Opção {option.option_number}
                    </h2>
                    <Badge variant="secondary" className="text-xs">
                      {option.total_calories} kcal
                    </Badge>
                  </div>
                  <MacroChart
                    protein={option.total_protein}
                    carbs={option.total_carbs}
                    fat={option.total_fat}
                    proteinTarget={option.total_protein}
                    carbsTarget={option.total_carbs}
                    fatTarget={option.total_fat}
                  />
                </motion.section>

                {/* Impact Explanation Card */}
                <AnimatePresence>
                  {showImpact && impactExplanation && (
                    <motion.section
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 border-l-4 border-l-primary"
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">
                            Impacto nutricional da substituição
                          </h3>
                          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
                            {impactExplanation}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-xs sm:text-sm"
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
                  className="space-y-2 sm:space-y-3"
                >
                  <h2 className="font-semibold text-foreground text-sm sm:text-base">
                    Alimentos ({option.foods?.length || 0})
                  </h2>
                  {(option.foods || []).map((optionFood, index) => {
                    const food = optionFood.food as Food;
                    if (!food) return null;
                    
                    const totalGrams = getTotalGrams(food, optionFood.quantity);
                    const unit = getUnit(food.serving_size);
                    const nutrients = calcNutrients(food, totalGrams);
                    
                    return (
                      <motion.div
                        key={optionFood.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + index * 0.1 }}
                        className="card-elevated rounded-lg sm:rounded-xl p-3 sm:p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground text-sm sm:text-base truncate">
                              {food?.name}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {totalGrams}{unit}
                            </p>
                            <div className="flex flex-wrap gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-[10px] sm:text-xs">
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
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-foreground text-sm sm:text-base">
                              {nutrients.calories} kcal
                            </p>
                            {/* Show substitute button for users who can edit */}
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-1.5 sm:mt-2 text-xs h-7 sm:h-8 px-2 sm:px-3"
                                onClick={() => openSubstituteModal(optionFood, option.id)}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                <span className="hidden xs:inline">Substituir</span>
                                <span className="xs:hidden">Sub.</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {(!option.foods || option.foods.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Nenhum alimento nesta opção</p>
                    </div>
                  )}
                </motion.section>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhuma opção de refeição disponível</p>
          </div>
        )}
      </main>

      {/* Substitute Modal */}
      <Dialog open={showSubstituteModal} onOpenChange={setShowSubstituteModal}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto scrollbar-hide mx-2 sm:mx-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Substituir Alimento</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {/* Current Food */}
            <div className="p-3 sm:p-4 bg-muted rounded-lg sm:rounded-xl">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">
                Alimento atual
              </p>
              <p className="font-medium text-foreground text-sm sm:text-base">
                {(selectedMealOptionFood?.food as Food)?.name}
              </p>
              {selectedMealOptionFood?.food && (
                <div className="flex flex-wrap gap-2 sm:gap-3 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                  {(() => {
                    const food = selectedMealOptionFood.food as Food;
                    const qty = getTotalGrams(food, selectedMealOptionFood.quantity);
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
            {selectedMealOptionFood?.food && (
              <div className="p-2.5 sm:p-3 bg-primary/10 rounded-lg">
                <p className="text-[10px] sm:text-xs text-primary font-medium">
                  📌 Categoria: {(selectedMealOptionFood.food as Food).category}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  Substituições permitidas apenas entre alimentos naturais ou minimamente processados da mesma categoria.
                </p>
                {(selectedMealOptionFood.food as Food).category === 'suplementos' && (
                  <p className="text-[10px] sm:text-xs text-destructive mt-1">
                    ⚠️ Suplementos não podem ser substituídos automaticamente.
                  </p>
                )}
              </div>
            )}

            {/* New Food Selection */}
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-medium text-foreground">
                Escolha o novo alimento ({filteredFoodsForSubstitution.length} opções)
              </p>
              {filteredFoodsForSubstitution.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground p-3 sm:p-4 text-center">
                  Não há outros alimentos disponíveis nesta categoria.
                </p>
              ) : (
                <div className="max-h-40 sm:max-h-48 overflow-y-auto scrollbar-hide space-y-1 border rounded-lg p-1.5 sm:p-2">
                  {filteredFoodsForSubstitution.map((food) => (
                    <button
                      key={food.id}
                      onClick={() => handleSelectNewFood(food)}
                      className={`w-full text-left p-2.5 sm:p-3 rounded-lg transition-colors ${
                        selectedNewFood?.id === food.id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <p className="font-medium text-foreground text-xs sm:text-sm">
                        {food.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-muted-foreground">
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
              <div className="p-3 sm:p-4 bg-secondary/50 rounded-lg sm:rounded-xl border-l-4 border-l-primary">
                {loadingImpact ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-primary" />
                    <span className="text-xs sm:text-sm text-muted-foreground">
                      Analisando impacto nutricional...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      <span className="text-xs sm:text-sm font-medium text-foreground">
                        Impacto da substituição
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      {impactExplanation}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Comparison */}
            {selectedNewFood && selectedMealOptionFood?.food && (
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-muted rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Antes</p>
                  {(() => {
                    const food = selectedMealOptionFood.food as Food;
                    const qty = getTotalGrams(food, selectedMealOptionFood.quantity);
                    const nutrients = calcNutrients(food, qty);
                    return (
                      <>
                        <p className="text-base sm:text-lg font-bold text-foreground">
                          {nutrients.calories} kcal
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {qty}{getUnit(food.serving_size)}
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div className="p-2.5 sm:p-3 bg-primary/10 rounded-lg text-center">
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">Depois</p>
                  {(() => {
                    const nutrients = calcNutrients(selectedNewFood, adjustedQuantity);
                    return (
                      <>
                        <p className="text-base sm:text-lg font-bold text-primary">
                          {nutrients.calories} kcal
                        </p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {adjustedQuantity}{getUnit(selectedNewFood.serving_size)}
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 sm:gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
                onClick={() => setShowSubstituteModal(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="hero"
                className="flex-1 text-xs sm:text-sm h-9 sm:h-10"
                onClick={confirmSubstitution}
                disabled={!selectedNewFood || substituting}
              >
                {substituting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span className="hidden xs:inline ml-1">Substituindo...</span>
                  </>
                ) : (
                  <span className="truncate">Confirmar</span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        feature="substituições"
        currentPlan="Gratuito"
        limit={1}
      />
    </div>
  );
}
