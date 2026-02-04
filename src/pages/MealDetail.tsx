import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Loader2,
  ThumbsDown,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MacroChart } from '@/components/MacroChart';

import { supabase } from '@/integrations/supabase/client';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useUserRole } from '@/hooks/useUserRole';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useSubscription } from '@/hooks/useSubscription';
import { useSubstitution } from '@/hooks/useSubstitution';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useAuth } from '@/contexts/AuthContext';
import { Meal, Food, MEAL_NAMES, MealType, MealOption, MealOptionFood } from '@/lib/types';
import { getCategoryLabel, getCategoryColor, isValidCategory } from '@/lib/food-categories';
import { toast } from 'sonner';
import { SubstitutionModal } from '@/components/SubstitutionModal';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { useAddToAvoided } from '@/components/FoodPreferencesManager';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
function getTotalGrams(quantityGrams: number): number {
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
  
  const { plan_name, meal_options_limit, can_substitute } = useAccountPermissions();
  const { currentPlan, usage } = useSubscription();
  const { isLimitReached, refresh: refreshUsageLimits } = useUsageLimits();
  const isPaidPlan = plan_name.toLowerCase() !== 'gratuito';
  
  // Check if substitution limit is reached (usa hook dedicado para precisão)
  const substitutionLimitReached = isLimitReached('substitution');
  
  const canEdit = !isLinkedStudent || isProfessionalViewingStudent;
  const canShowSubstituteButton = canEdit && can_substitute && !substitutionLimitReached;
  
  // IMPORTANTE: Apenas profissionais podem remover alimentos diretamente
  // Usuários comuns usam "Não gosto" que abre substituição
  const canRemoveDirectly = isProfessional && isProfessionalViewingStudent;
  
  const [meal, setMeal] = useState<Meal | null>(null);
  const [mealOptions, setMealOptions] = useState<MealOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string>('1');
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubstituteModal, setShowSubstituteModal] = useState(false);
  const [selectedMealOptionFood, setSelectedMealOptionFood] = useState<MealOptionFood | null>(null);
  const [currentOptionId, setCurrentOptionId] = useState<string | null>(null);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  // Dialog de remoção (apenas para profissionais)
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
    showAll,
    findCandidates,
    selectCandidate,
    confirmSubstitution: confirmSub,
    reset: resetSubstitution,
    setShowAll,
    canSubstitute: checkCanSubstitute,
    getImpact,
    requiresRebalance,
  } = useSubstitution({
    onSuccess: () => {
      setShowSubstituteModal(false);
      fetchMealData();
    },
  });
  
  // Hook para adicionar alimento aos evitados
  const { addToAvoided, adding: addingToAvoided } = useAddToAvoided();

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

  const fetchAllFoods = useCallback(async () => {
    const { data } = await supabase
      .from('foods')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (data) setAllFoods(data as Food[]);
  }, []);

  useEffect(() => {
    fetchMealData();
    fetchAllFoods();
  }, [mealId]);

  const visibleMealOptions = useMemo(() => {
    if (!meal_options_limit || meal_options_limit <= 0) return mealOptions;
    return mealOptions.filter(opt => opt.option_number <= meal_options_limit);
  }, [mealOptions, meal_options_limit]);

  // Handler para abrir modal de substituição (usado tanto por "Trocar" quanto por "Não gosto")
  const openSubstituteModal = useCallback((optionFood: MealOptionFood, optionId: string) => {
    const food = optionFood.food as Food;
    if (!food) return;
    
    // Verificar se pode substituir
    if (!can_substitute) {
      setShowUpgradeDialog(true);
      return;
    }
    
    if (substitutionLimitReached) {
      toast.error('Limite de substituições atingido. Faça upgrade do seu plano.');
      setShowUpgradeDialog(true);
      return;
    }
    
    // Verificar se a lista de alimentos foi carregada
    if (allFoods.length === 0) {
      toast.error('Aguarde o carregamento dos alimentos...');
      fetchAllFoods();
      return;
    }
    
    // Obter IDs de alimentos já presentes na opção (exceto o que será substituído)
    // Isso permite que alimentos de outras opções sejam candidatos válidos
    const currentOption = mealOptions.find(opt => opt.id === optionId);
    const existingFoodIds = currentOption?.foods
      ?.map(f => (f.food as Food)?.id)
      .filter((id): id is string => Boolean(id) && id !== food.id) || [];
    
    setSelectedMealOptionFood(optionFood);
    setCurrentOptionId(optionId);
    resetSubstitution();
    findCandidates(food, optionFood.quantity_grams, allFoods, existingFoodIds);
    setShowSubstituteModal(true);
  }, [allFoods, findCandidates, resetSubstitution, can_substitute, substitutionLimitReached, fetchAllFoods, mealOptions]);

  const handleSelectCandidate = useCallback((candidateId: string) => {
    selectCandidate(candidateId);
  }, [selectCandidate]);

  const confirmSubstitution = useCallback(async () => {
    if (!selectedMealOptionFood || !currentOptionId || !proposal) return;
    const success = await confirmSub(selectedMealOptionFood.id, currentOptionId);
    if (success) {
      // Atualizar limites de uso após substituição bem-sucedida
      refreshUsageLimits();
    }
  }, [selectedMealOptionFood, currentOptionId, proposal, confirmSub, refreshUsageLimits]);

  const handleBackToCandidates = useCallback(() => {
    if (selectedMealOptionFood?.food && currentOptionId) {
      const food = selectedMealOptionFood.food as Food;
      // Obter IDs existentes (exceto o que será substituído)
      const currentOption = mealOptions.find(opt => opt.id === currentOptionId);
      const existingFoodIds = currentOption?.foods
        ?.map(f => (f.food as Food)?.id)
        .filter((id): id is string => Boolean(id) && id !== food.id) || [];
      findCandidates(food, selectedMealOptionFood.quantity_grams, allFoods, existingFoodIds);
    }
  }, [selectedMealOptionFood, allFoods, findCandidates, currentOptionId, mealOptions]);

  const handleCloseModal = useCallback(() => {
    setShowSubstituteModal(false);
    resetSubstitution();
    setSelectedMealOptionFood(null);
    setCurrentOptionId(null);
  }, [resetSubstitution]);

  // Handler para "Não gosto" - adiciona à lista de evitados E substitui automaticamente
  const handleDislike = useCallback(async (optionFood: MealOptionFood, optionId: string) => {
    const food = optionFood.food as Food;
    if (!food) return;
    
    // 1. Adicionar aos evitados primeiro
    const addedToAvoided = await addToAvoided(food.name);
    if (!addedToAvoided) return; // Se falhou, não continuar
    
    // 2. Verificar se pode substituir automaticamente
    if (!can_substitute || substitutionLimitReached || !checkCanSubstitute(food)) {
      toast.info('Alimento adicionado aos evitados. Você pode substituí-lo manualmente depois.');
      return;
    }
    
    // 3. Buscar candidatos para substituição automática
    if (allFoods.length === 0) {
      toast.info('Alimento adicionado aos evitados. Atualize a página para ver as substituições disponíveis.');
      return;
    }
    
    // Usar o serviço de substituição diretamente para encontrar o melhor candidato
    // Excluir alimentos já presentes na opção para evitar duplicatas
    const { findSubstituteCandidates } = await import('@/lib/substitution-service');
    const currentOption = mealOptions.find(opt => opt.id === optionId);
    const existingFoodIds = currentOption?.foods
      ?.map(f => (f.food as Food)?.id)
      .filter((id): id is string => Boolean(id) && id !== food.id) || [];
    const candidatesList = findSubstituteCandidates(food, optionFood.quantity_grams, allFoods, { excludeFoodIds: existingFoodIds });
    
    if (candidatesList.length === 0) {
      toast.info('Alimento adicionado aos evitados. Não há substitutos equivalentes disponíveis.');
      return;
    }
    
    // 4. Pegar o melhor candidato (primeiro da lista ordenada por score)
    const bestCandidate = candidatesList[0];
    
    // 5. Executar a substituição automaticamente
    try {
      // Validar limite no backend antes de persistir
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.info('Alimento adicionado aos evitados. Faça login para substituir.');
        return;
      }
      
      const validateResponse = await supabase.functions.invoke('validate-usage', {
        body: { feature: 'substitution', increment: false },
      });
      
      if (validateResponse.error || !validateResponse.data?.allowed) {
        toast.info('Alimento adicionado aos evitados. Limite de substituições atingido.');
        return;
      }
      
      // Atualizar meal_option_food com novo alimento e quantidade
      const { error: updateError } = await supabase
        .from('meal_option_foods')
        .update({
          food_id: bestCandidate.food.id,
          quantity_grams: bestCandidate.newPortionGrams,
        })
        .eq('id', optionFood.id);
      
      if (updateError) throw updateError;
      
      // Recalcular totais da opção
      await recalculateOptionTotals(optionId);
      
      // Incrementar uso de substituição
      await supabase.functions.invoke('validate-usage', {
        body: { feature: 'substitution', increment: true },
      });
      
      toast.success(
        `"${food.name}" substituído por "${bestCandidate.food.name}" automaticamente!`,
        { duration: 4000 }
      );
      
      // Recarregar dados e atualizar limites
      await fetchMealData();
      refreshUsageLimits();
    } catch (err: any) {
      console.error('Error auto-substituting:', err);
      toast.info('Alimento adicionado aos evitados. Erro ao substituir automaticamente.');
    }
  }, [addToAvoided, can_substitute, substitutionLimitReached, checkCanSubstitute, allFoods, fetchMealData, mealOptions, refreshUsageLimits]);

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

  // Handler para remoção direta (APENAS profissionais)
  const openRemoveDialog = (optionFood: MealOptionFood, optionId: string) => {
    if (!canRemoveDirectly) {
      // Usuários comuns são redirecionados para substituição
      openSubstituteModal(optionFood, optionId);
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
          <ThemeToggle />
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
                    const qty = getTotalGrams(optionFood.quantity_grams);
                    const nutrients = calcNutrients(food, qty);
                    const canSub = canShowSubstituteButton && checkCanSubstitute(food);
                    const canShowDislike = canEdit && !canSub; // Mostrar "Não gosto" se não pode substituir diretamente
                    
                    return (
                      <div key={optionFood.id} className="card-elevated rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium text-sm truncate">{food.name}</h3>
                              {isValidCategory(food.category) && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white ${getCategoryColor(food.category)}`}>
                                  {getCategoryLabel(food.category)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{qty}{getUnit(food.serving_size)}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px]">{nutrients.calories} kcal</Badge>
                              <Badge variant="outline" className="text-[10px]">P: {nutrients.protein}g</Badge>
                              <Badge variant="outline" className="text-[10px]">C: {nutrients.carbs}g</Badge>
                              <Badge variant="outline" className="text-[10px]">G: {nutrients.fat}g</Badge>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {/* Botão de substituição para alimentos substituíveis */}
                            {canSub && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-xs" 
                                      onClick={() => openSubstituteModal(optionFood, option.id)}
                                    >
                                      <RefreshCw className="w-3 h-3 mr-1" />Substituir
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Substituir por alimento equivalente</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Botão "Não gosto" - adiciona à lista de evitados e substitui automaticamente */}
                            {canEdit && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs text-muted-foreground" 
                                      onClick={() => handleDislike(optionFood, option.id)}
                                      disabled={addingToAvoided}
                                    >
                                      <ThumbsDown className="w-3 h-3 mr-1" />Não gosto
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Adicionar aos evitados e substituir automaticamente</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {canRemoveDirectly && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-xs text-destructive" 
                                      onClick={() => openRemoveDialog(optionFood, option.id)}
                                    >
                                      <AlertTriangle className="w-3 h-3 mr-1" />Remover
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">⚠️ Remove sem compensar. Pode desequilibrar o plano.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
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

      {/* Modal de Substituição Inteligente */}
      <SubstitutionModal
        open={showSubstituteModal}
        onOpenChange={handleCloseModal}
        selectedFood={selectedMealOptionFood}
        candidates={candidates}
        proposal={proposal}
        isLoading={substitutionLoading}
        isConfirming={substituting}
        error={substitutionError}
        impact={getImpact()}
        requiresRebalance={requiresRebalance()}
        showAll={showAll}
        onSelectCandidate={handleSelectCandidate}
        onConfirm={confirmSubstitution}
        onBack={handleBackToCandidates}
        onToggleShowAll={setShowAll}
      />

      {/* Dialog de remoção - APENAS para profissionais */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Remover alimento?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {foodToRemove?.optionFood.food && (
                  <>Remover <strong>{(foodToRemove.optionFood.food as Food).name}</strong>?</>
                )}
              </p>
              <p className="text-amber-600 text-sm">
                ⚠️ <strong>Atenção:</strong> Remover um alimento sem substituição pode desequilibrar 
                o plano nutricional do paciente. Considere usar a substituição inteligente.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingFood}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveFood} disabled={removingFood} className="bg-destructive hover:bg-destructive/90">
              {removingFood ? 'Removendo...' : 'Remover mesmo assim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} feature="substituição de alimentos" />
    </div>
  );
}
