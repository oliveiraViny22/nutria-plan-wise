import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
  Check,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MobileNav } from '@/components/MobileNav';
import { MacroChart } from '@/components/MacroChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// Calculate total grams for display - v2 uses quantity_grams directly
function getTotalGrams(food: Food, quantityGrams: number): number {
  // quantity_grams is already in grams, just round it
  return Math.round(quantityGrams);
}

// Calculate nutrients for a given quantity in grams
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
  
  // Use account permissions to check if user can add/remove foods
  const { plan_name, can_substitute, meal_options_limit } = useAccountPermissions();
  const isPaidPlan = plan_name !== 'gratuito';
  
  // Only restrict editing for linked students (not for professionals or regular users)
  const canEdit = !isLinkedStudent || isProfessionalViewingStudent;
  
  // Can substitute foods if user has permission (canEdit) - limit is checked when action is performed
  const canShowSubstituteButton = canEdit;
  
  // Can add/remove foods if professional or paid plan
  const canAddRemoveFoods = canEdit && (isProfessional || isPaidPlan);
  
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
  
  
  // Remove food dialog state
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [foodToRemove, setFoodToRemove] = useState<{ optionFood: MealOptionFood; optionId: string } | null>(null);
  const [removingFood, setRemovingFood] = useState(false);

  useEffect(() => {
    fetchMealData();
    fetchAllFoods();
  }, [mealId]);

  const fetchMealData = async () => {
    if (!mealId) {
      toast.error('ID da refeição não informado');
      setLoading(false);
      return;
    }

    try {
      // Fetch meal
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .select('*')
        .eq('id', mealId)
        .single();

      if (mealError) {
        console.error('Error fetching meal:', mealError);
        if (mealError.code === 'PGRST116') {
          toast.error('Refeição não encontrada. Verifique se ela ainda existe.');
        } else if (mealError.code === '42501') {
          toast.error('Sem permissão para acessar esta refeição.');
        } else {
          toast.error(`Erro ao buscar dados da refeição: ${mealError.message}`);
        }
        setLoading(false);
        return;
      }
      
      setMeal(mealData as Meal);

      // Fetch meal options with their foods
      const { data: optionsData, error: optionsError } = await supabase
        .from('meal_options')
        .select(`
          *,
          meal_option_foods(
            *,
            food:foods(*)
          )
        `)
        .eq('meal_id', mealId)
        .order('option_number');

      if (optionsError) {
        console.error('Error fetching meal options:', optionsError);
        if (optionsError.code === '42501') {
          toast.error('Sem permissão para acessar as opções desta refeição.');
        } else {
          toast.error(`Erro ao carregar opções da refeição: ${optionsError.message}`);
        }
        setLoading(false);
        return;
      }
      
      const options = (optionsData || []).map(opt => ({
        ...opt,
        foods: opt.meal_option_foods || []
      })) as MealOption[];
      
      setMealOptions(options);
      
      // Set default selected option
      if (options.length > 0) {
        setSelectedOption(options[0].option_number.toString());
      }
    } catch (error: any) {
      console.error('Unexpected error fetching meal:', error);
      toast.error('Erro inesperado ao carregar refeição. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllFoods = async () => {
    const { data, error } = await supabase.from('foods').select('*').order('name');
    if (error) {
      console.error('Error fetching foods list:', error);
      toast.error('Não foi possível carregar a lista de alimentos para substituição.');
      return;
    }
    if (data) {
      setAllFoods(data as Food[]);
    }
  };

  // Get currently selected option
  const currentOption = useMemo(() => {
    return mealOptions.find(opt => opt.option_number.toString() === selectedOption);
  }, [mealOptions, selectedOption]);

  // Filter meal options based on user's plan limit
  const visibleMealOptions = useMemo(() => {
    // If no limit or limit is 0, show all options (fallback for edge cases)
    if (!meal_options_limit || meal_options_limit <= 0) {
      return mealOptions;
    }
    // Only show options up to the user's plan limit
    return mealOptions.filter(opt => opt.option_number <= meal_options_limit);
  }, [mealOptions, meal_options_limit]);

  // Check if a food can be used in automatic substitutions
  const canBeSubstituted = (food: Food): boolean => {
    // Supplements cannot be auto-substituted
    if (food.category === 'suplementos') return false;
    
    // Normalize processing level for comparison (DB has "In natura", code expects "in_natura")
    const processingLevel = food.processing_level;
    if (!processingLevel) return true; // Allow if not set
    
    // Normalize: lowercase and replace spaces with underscores
    const normalizedLevel = processingLevel.toLowerCase().replace(/\s+/g, '_') as ProcessingLevel;
    
    // Also check for Portuguese format without normalization
    const allowedLevels = [
      'in_natura',
      'minimamente_processado',
      'in natura',
      'minimamente processado',
    ];
    
    return allowedLevels.includes(normalizedLevel) || 
           allowedLevels.includes(processingLevel.toLowerCase());
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
    const originalQty = getTotalGrams(originalFood, selectedMealOptionFood.quantity_grams);
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
      const oldQty = getTotalGrams(oldFood, selectedMealOptionFood.quantity_grams);
      const oldNutrients = calcNutrients(oldFood, oldQty);
      const newNutrients = calcNutrients(selectedNewFood, adjustedQuantity);

      // Update meal_option_food with new food and adjusted quantity (v2 uses quantity_grams)
      const { error: updateError } = await supabase
        .from('meal_option_foods')
        .update({ food_id: selectedNewFood.id, quantity_grams: adjustedQuantity })
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
          const qty = getTotalGrams(food, mof.quantity_grams);
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
      if (error.code === '42501') {
        toast.error('Sem permissão para modificar esta refeição.');
      } else if (error.code === '23503') {
        toast.error('Alimento selecionado não está mais disponível.');
      } else {
        toast.error(`Erro ao substituir alimento: ${error.message || 'Tente novamente'}`);
      }
    } finally {
      setSubstituting(false);
    }
  };

  // Recalculate option totals helper
  const recalculateOptionTotals = async (optionId: string) => {
    const { data: updatedOptionFoods } = await supabase
      .from('meal_option_foods')
      .select(`*, food:foods(*)`)
      .eq('meal_option_id', optionId);

    let optionCalories = 0;
    let optionProtein = 0;
    let optionCarbs = 0;
    let optionFat = 0;

    if (updatedOptionFoods) {
      for (const mof of updatedOptionFoods) {
        const food = mof.food as Food;
        const qty = getTotalGrams(food, mof.quantity_grams);
        const nutrients = calcNutrients(food, qty);
        optionCalories += nutrients.calories;
        optionProtein += nutrients.protein;
        optionCarbs += nutrients.carbs;
        optionFat += nutrients.fat;
      }
    }

    await supabase
      .from('meal_options')
      .update({
        total_calories: optionCalories,
        total_protein: optionProtein,
        total_carbs: optionCarbs,
        total_fat: optionFat,
      })
      .eq('id', optionId);
  };


  // Open remove food dialog
  const openRemoveDialog = (optionFood: MealOptionFood, optionId: string) => {
    if (!canAddRemoveFoods) {
      setShowUpgradeDialog(true);
      return;
    }
    setFoodToRemove({ optionFood, optionId });
    setShowRemoveDialog(true);
  };

  // Remove food from option
  const handleRemoveFood = async () => {
    if (!foodToRemove) return;
    
    setRemovingFood(true);
    try {
      // Delete meal_option_food
      const { error: deleteError } = await supabase
        .from('meal_option_foods')
        .delete()
        .eq('id', foodToRemove.optionFood.id);

      if (deleteError) throw deleteError;

      // Recalculate totals
      await recalculateOptionTotals(foodToRemove.optionId);

      toast.success('Alimento removido com sucesso!');
      setShowRemoveDialog(false);
      setFoodToRemove(null);
      await fetchMealData();
    } catch (error: any) {
      console.error('Error removing food:', error);
      toast.error(`Erro ao remover alimento: ${error.message || 'Tente novamente'}`);
    } finally {
      setRemovingFood(false);
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
              {visibleMealOptions.length} {visibleMealOptions.length === 1 ? 'opção disponível' : 'opções disponíveis'}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-safe">
        {/* Options Tabs */}
        {visibleMealOptions.length > 0 ? (
          <Tabs value={selectedOption} onValueChange={setSelectedOption} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${visibleMealOptions.length}, 1fr)` }}>
              {visibleMealOptions.map((option) => (
                <TabsTrigger 
                  key={option.id} 
                  value={option.option_number.toString()}
                  className="text-xs sm:text-sm"
                >
                  Opção {option.option_number}
                </TabsTrigger>
              ))}
            </TabsList>

            {visibleMealOptions.map((option) => (
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
                            Impacto da Substituição
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                            {impactExplanation}
                          </p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="mt-2 text-xs"
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
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-foreground text-sm sm:text-base">
                      Alimentos
                    </h2>
                  </div>
                  
                  {option.foods && option.foods.length > 0 ? (
                    <div className="space-y-2 sm:space-y-3">
                      {option.foods.map((optionFood: MealOptionFood) => {
                        const food = optionFood.food as Food;
                        if (!food) return null;
                        
                        const qty = getTotalGrams(food, optionFood.quantity_grams);
                        const nutrients = calcNutrients(food, qty);
                        const unit = getUnit(food.serving_size);
                        const canSubstitute = canShowSubstituteButton && canBeSubstituted(food);
                        
                        return (
                          <motion.div
                            key={optionFood.id}
                            layout
                            className="card-elevated rounded-lg sm:rounded-xl p-3 sm:p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="font-medium text-foreground text-sm sm:text-base truncate">
                                  {food.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground">
                                  {qty}{unit}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge variant="outline" className="text-[10px] sm:text-xs">
                                    {nutrients.calories} kcal
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] sm:text-xs text-protein border-protein/30">
                                    P: {nutrients.protein}g
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] sm:text-xs text-carbs border-carbs/30">
                                    C: {nutrients.carbs}g
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] sm:text-xs text-fat border-fat/30">
                                    G: {nutrients.fat}g
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                {canSubstitute && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 text-xs"
                                    onClick={() => openSubstituteModal(optionFood, option.id)}
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Trocar
                                  </Button>
                                )}
                                {canAddRemoveFoods && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => openRemoveDialog(optionFood, option.id)}
                                  >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Remover
                                  </Button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        Nenhum alimento nesta opção
                      </p>
                    </div>
                  )}
                </motion.section>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma opção de refeição encontrada</p>
          </div>
        )}
      </main>

      {/* Substitute Modal */}
      <Dialog open={showSubstituteModal} onOpenChange={setShowSubstituteModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Substituir Alimento</DialogTitle>
          </DialogHeader>
          
          {selectedMealOptionFood?.food && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Substituindo:</p>
                <p className="font-medium">{(selectedMealOptionFood.food as Food).name}</p>
                <p className="text-sm text-muted-foreground">
                  {getTotalGrams(selectedMealOptionFood.food as Food, selectedMealOptionFood.quantity_grams)}
                  {getUnit((selectedMealOptionFood.food as Food).serving_size)}
                </p>
              </div>

              {!selectedNewFood ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selecione o novo alimento:</p>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredFoodsForSubstitution.length > 0 ? (
                      filteredFoodsForSubstitution.map((food) => (
                        <button
                          key={food.id}
                          className="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors"
                          onClick={() => handleSelectNewFood(food)}
                        >
                          <p className="font-medium text-sm">{food.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {food.calories} kcal / {food.serving_size}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum alimento disponível para substituição nesta categoria
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Novo alimento:</p>
                    <p className="font-medium">{selectedNewFood.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {adjustedQuantity}{getUnit(selectedNewFood.serving_size)} (ajustado para manter calorias)
                    </p>
                  </div>

                  {loadingImpact ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm">Analisando impacto...</span>
                    </div>
                  ) : impactExplanation && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-1">Impacto da troca:</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {impactExplanation}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedNewFood(null)}
                    >
                      Voltar
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={confirmSubstitution}
                      disabled={substituting}
                    >
                      {substituting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Substituindo...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Confirmar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Remove Food Confirmation */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover alimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {foodToRemove?.optionFood.food && (
                <>
                  Tem certeza que deseja remover <strong>{(foodToRemove.optionFood.food as Food).name}</strong> desta opção de refeição?
                  Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingFood}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFood}
              disabled={removingFood}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removingFood ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade Dialog */}
      <UpgradeDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog}
        feature="gerenciamento de alimentos"
      />
    </div>
  );
}
