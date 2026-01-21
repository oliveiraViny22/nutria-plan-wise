import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  Sparkles,
  Check,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/MobileNav';
import { MacroChart } from '@/components/MacroChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useSubstitution } from '@/hooks/useSubstitution';
import { Meal, Food, MEAL_NAMES, MealType, MealOption, MealOptionFood } from '@/lib/types';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

// Parse serving_size to extract base grams
function parseServingGrams(servingSize: string): number {
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

// Get unit from serving size
function getUnit(servingSize: string): string {
  if (servingSize.toLowerCase().includes('ml')) return 'ml';
  return 'g';
}

// Calculate total grams for display
function getTotalGrams(_food: Food, quantityGrams: number): number {
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
  const { profile } = useAuth();
  const { isLinkedStudent } = useLinkedStudent();
  const { isProfessional } = useUserRole();
  
  const studentIdFromQuery = searchParams.get('studentId');
  const isProfessionalViewingStudent = isProfessional && !!studentIdFromQuery;
  
  const { plan_name, meal_options_limit } = useAccountPermissions();
  const isPaidPlan = plan_name !== 'gratuito';
  
  const canEdit = !isLinkedStudent || isProfessionalViewingStudent;
  const canShowSubstituteButton = canEdit;
  const canAddRemoveFoods = canEdit && (isProfessional || isPaidPlan);
  
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('1');
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [selectedMealOptionFood, setSelectedMealOptionFood] = useState<MealOptionFood | null>(null);
  const [currentOptionId, setCurrentOptionId] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [foodToRemove, setFoodToRemove] = useState<{ optionFood: MealOptionFood; optionId: string } | null>(null);
  const [removingFood, setRemovingFood] = useState(false);
  
  // Hook de substituição canônico
  const {
    isLoading: substitutionLoading,
    isConfirming: substituting,
    proposal,
    candidates,
    error: substitutionError,
    findCandidates,
    selectCandidate,
    confirmSubstitution: confirmSub,
    reset: resetSubstitution,
    canSubstitute: checkCanSubstitute,
    getImpact,
    requiresRebalance,
  } = useSubstitution({
    onSuccess: () => {
      setShowSubstituteModal(false);
      fetchMealData();
    },
  });

  const fetchMealData = async () => {
    if (!mealId) {
      toast.error('ID da refeição não informado');
      setLoading(false);
      return;
    }

    try {
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .select('*')
        .eq('id', mealId)
        .single();

      if (mealError) {
        console.error('Error fetching meal:', mealError);
        toast.error('Erro ao carregar refeição');
        setLoading(false);
        return;
      }
      
      setMeal(mealData as Meal);

      const { data: optionsData, error: optionsError } = await supabase
        .from('meal_options')
        .select(`*, meal_option_foods(*, food:foods(*))`)
        .eq('meal_id', mealId)
        .order('option_number');

      if (optionsError) {
        console.error('Error fetching meal options:', optionsError);
        setLoading(false);
        return;
      }
      
      const options = (optionsData || []).map(opt => ({
        ...opt,
        foods: opt.meal_option_foods || []
      })) as MealOption[];
      
      setMealOptions(options);
      
      if (options.length > 0) {
        setSelectedOption(options[0].option_number.toString());
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllFoods = async () => {
    const { data } = await supabase.from('foods').select('*').order('name');
    if (data) setAllFoods(data as Food[]);
  };

  useEffect(() => {
    fetchMealData();
    fetchAllFoods();
  }, [mealId]);

  const visibleMealOptions = useMemo(() => {
    if (!meal_options_limit || meal_options_limit <= 0) return mealOptions;
    return mealOptions.filter(opt => opt.option_number <= meal_options_limit);
  }, [mealOptions, meal_options_limit]);

  const openSubstituteModal = useCallback((optionFood: MealOptionFood, optionId: string) => {
    const food = optionFood.food as Food;
    if (!food) return;
    
    setSelectedMealOptionFood(optionFood);
    setCurrentOptionId(optionId);
    resetSubstitution();
    findCandidates(food, optionFood.quantity_grams, allFoods);
    setShowSubstituteModal(true);
  }, [allFoods, findCandidates, resetSubstitution]);

  const handleSelectCandidate = useCallback((candidateId: string) => {
    selectCandidate(candidateId);
  }, [selectCandidate]);

  const confirmSubstitution = useCallback(async () => {
    if (!selectedMealOptionFood || !currentOptionId || !proposal) return;
    await confirmSub(selectedMealOptionFood.id, currentOptionId);
  }, [selectedMealOptionFood, currentOptionId, proposal, confirmSub]);

  const handleBackToCandidates = useCallback(() => {
    if (selectedMealOptionFood?.food) {
      const food = selectedMealOptionFood.food as Food;
      findCandidates(food, selectedMealOptionFood.quantity_grams, allFoods);
    }
  }, [selectedMealOptionFood, allFoods, findCandidates]);

  const handleCloseModal = useCallback(() => {
    setShowSubstituteModal(false);
    resetSubstitution();
    setSelectedMealOptionFood(null);
    setCurrentOptionId(null);
  }, [resetSubstitution]);

  const recalculateOptionTotals = async (optionId: string) => {
    const { data: foods } = await supabase
      .from('meal_option_foods')
      .select(`*, food:foods(*)`)
      .eq('meal_option_id', optionId);

    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    if (foods) {
      for (const mof of foods) {
        const food = mof.food as Food;
        const nutrients = calcNutrients(food, mof.quantity_grams);
        totals.calories += nutrients.calories;
        totals.protein += nutrients.protein;
        totals.carbs += nutrients.carbs;
        totals.fat += nutrients.fat;
      }
    }

    await supabase.from('meal_options').update({
      total_calories: totals.calories,
      total_protein: totals.protein,
      total_carbs: totals.carbs,
      total_fat: totals.fat,
    }).eq('id', optionId);
  };

  const openRemoveDialog = (optionFood: MealOptionFood, optionId: string) => {
    if (!canAddRemoveFoods) {
      setShowUpgradeDialog(true);
      return;
    }
    setFoodToRemove({ optionFood, optionId });
    setShowRemoveDialog(true);
  };

  const handleRemoveFood = async () => {
    if (!foodToRemove) return;
    setRemovingFood(true);
    try {
      await supabase.from('meal_option_foods').delete().eq('id', foodToRemove.optionFood.id);
      await recalculateOptionTotals(foodToRemove.optionId);
      toast.success('Alimento removido!');
      setShowRemoveDialog(false);
      setFoodToRemove(null);
      await fetchMealData();
    } catch (error) {
      toast.error('Erro ao remover');
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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border pt-safe">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <MobileNav />
          <Button variant="ghost" size="icon" className="hidden md:flex h-9 w-9" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">
              {MEAL_NAMES[meal.name as MealType] || meal.name}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {visibleMealOptions.length} {visibleMealOptions.length === 1 ? 'opção' : 'opções'}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 pb-safe">
        {visibleMealOptions.length > 0 ? (
          <Tabs value={selectedOption} onValueChange={setSelectedOption} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${visibleMealOptions.length}, 1fr)` }}>
              {visibleMealOptions.map((option) => (
                <TabsTrigger key={option.id} value={option.option_number.toString()} className="text-xs sm:text-sm">
                  Opção {option.option_number}
                </TabsTrigger>
              ))}
            </TabsList>

            {visibleMealOptions.map((option) => (
              <TabsContent key={option.id} value={option.option_number.toString()} className="space-y-4 mt-4">
                <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-elevated rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-sm">Macros da Opção {option.option_number}</h2>
                    <Badge variant="secondary" className="text-xs">{option.total_calories} kcal</Badge>
                  </div>
                  <MacroChart protein={option.total_protein} carbs={option.total_carbs} fat={option.total_fat}
                    proteinTarget={option.total_protein} carbsTarget={option.total_carbs} fatTarget={option.total_fat} />
                </motion.section>

                <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <h2 className="font-semibold text-sm">Alimentos</h2>
                  {option.foods?.map((optionFood: MealOptionFood) => {
                    const food = optionFood.food as Food;
                    if (!food) return null;
                    const qty = getTotalGrams(food, optionFood.quantity_grams);
                    const nutrients = calcNutrients(food, qty);
                    const canSub = canShowSubstituteButton && checkCanSubstitute(food);
                    
                    return (
                      <div key={optionFood.id} className="card-elevated rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm truncate">{food.name}</h3>
                            <p className="text-xs text-muted-foreground">{qty}{getUnit(food.serving_size)}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px]">{nutrients.calories} kcal</Badge>
                              <Badge variant="outline" className="text-[10px]">P: {nutrients.protein}g</Badge>
                              <Badge variant="outline" className="text-[10px]">C: {nutrients.carbs}g</Badge>
                              <Badge variant="outline" className="text-[10px]">G: {nutrients.fat}g</Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {canSub && (
                              <Button variant="outline" size="sm" className="text-xs" onClick={() => openSubstituteModal(optionFood, option.id)}>
                                <RefreshCw className="w-3 h-3 mr-1" />Trocar
                              </Button>
                            )}
                            {canAddRemoveFoods && (
                              <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => openRemoveDialog(optionFood, option.id)}>
                                <Trash2 className="w-3 h-3 mr-1" />Remover
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </motion.section>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="text-center py-12"><p className="text-muted-foreground">Nenhuma opção encontrada</p></div>
        )}
      </main>

      {/* Modal de Substituição */}
      <Dialog open={showSubstituteModal} onOpenChange={handleCloseModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Substituir Alimento</DialogTitle>
            <DialogDescription>Selecione um equivalente para manter as calorias.</DialogDescription>
          </DialogHeader>
          
          {selectedMealOptionFood?.food && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Substituindo:</p>
                <p className="font-medium">{(selectedMealOptionFood.food as Food).name}</p>
                <p className="text-sm text-muted-foreground">
                  {getTotalGrams(selectedMealOptionFood.food as Food, selectedMealOptionFood.quantity_grams)}{getUnit((selectedMealOptionFood.food as Food).serving_size)}
                </p>
              </div>

              {substitutionError && (
                <div className="p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">
                    {substitutionError === 'SUPPLEMENT_NOT_SUBSTITUTABLE' ? 'Suplementos não podem ser substituídos automaticamente.' : 'Nenhum alimento disponível nesta categoria.'}
                  </p>
                </div>
              )}

              {!proposal ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Selecione o novo alimento:</p>
                  {substitutionLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="ml-2 text-sm">Buscando...</span>
                    </div>
                  ) : candidates.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {candidates.map((c) => (
                        <button key={c.food.id} className="w-full text-left p-2 rounded-lg hover:bg-muted flex justify-between" onClick={() => handleSelectCandidate(c.food.id)}>
                          <div>
                            <p className="font-medium text-sm">{c.food.name}</p>
                            <p className="text-xs text-muted-foreground">{c.newPortionGrams}g</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{Math.round(c.score * 100)}%</Badge>
                        </button>
                      ))}
                    </div>
                  ) : !substitutionError && (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum alimento disponível</p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Novo alimento:</p>
                    <p className="font-medium">{proposal.to.food.name}</p>
                    <p className="text-sm text-muted-foreground">{proposal.to.portionGrams}g</p>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium">Impacto:</p>
                      <Badge variant={getImpact() === 'low' ? 'secondary' : 'outline'} className="text-xs">
                        {getImpact() === 'low' ? 'Baixo' : getImpact() === 'medium' ? 'Médio' : 'Alto'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Calorias:</span> {proposal.deltaMacros.calories > 0 ? '+' : ''}{proposal.deltaMacros.calories}</div>
                      <div><span className="text-muted-foreground">Proteína:</span> {proposal.deltaMacros.protein > 0 ? '+' : ''}{proposal.deltaMacros.protein}g</div>
                    </div>
                    {requiresRebalance() && <p className="text-xs text-amber-600 mt-2">⚠️ Pode requerer ajuste.</p>}
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleBackToCandidates} disabled={substituting}>Voltar</Button>
                    <Button className="flex-1" onClick={confirmSubstitution} disabled={substituting}>
                      {substituting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Substituindo...</> : <><Check className="w-4 h-4 mr-2" />Confirmar</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover alimento?</AlertDialogTitle>
            <AlertDialogDescription>
              {foodToRemove?.optionFood.food && <>Remover <strong>{(foodToRemove.optionFood.food as Food).name}</strong>?</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingFood}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveFood} disabled={removingFood} className="bg-destructive">
              {removingFood ? 'Removendo...' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} feature="gerenciamento de alimentos" />
    </div>
  );
}
