import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UtensilsCrossed,
  MessageCircle,
  LogOut,
  ChevronRight,
  Target,
  Flame,
  RefreshCw,
  Loader2,
  User,
  TrendingUp,
  Users,
  Crown,
  CreditCard,
  LayoutDashboard,
  Lock,
  Eye,
  ClipboardCheck,
  Sparkles,
  Shield,
  HelpCircle,
  Layers,
  Zap,
} from 'lucide-react';
import { useBruteForceOptimizer } from '@/hooks/useBruteForceOptimizer';
import { useHybridOptimizer } from '@/hooks/useHybridOptimizer';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { CalorieRing } from '@/components/CalorieRing';
import { MacroChart } from '@/components/MacroChart';
import { AIRebalancer } from '@/components/AIRebalancer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { UpgradeDialog } from '@/components/UpgradeDialog';
import { AdherenceWidget } from '@/components/AdherenceWidget';
import { GoalsProjectionCard } from '@/components/GoalsProjectionCard';
import { HydrationTipCard } from '@/components/HydrationTipCard';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { useTutorial } from '@/hooks/useTutorial';
import { useMetabolicCalculations } from '@/hooks/useMetabolicCalculations';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { supabase } from '@/integrations/supabase/client';
import { DietPlan, Meal, GOALS, MEAL_NAMES, MealType } from '@/lib/types';
import { toast } from 'sonner';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const { isProfessional, isAdmin } = useUserRole();
  const { isLinkedStudent } = useLinkedStudent();
  const permissions = useAccountPermissions();
  const { showTutorial, markTutorialComplete, closeTutorial, openTutorial } = useTutorial();
  const {
    refresh: refreshSubscription,
    currentPlan: subscriptionPlan,
    accountType,
    isSubscribed,
  } = useSubscription();
  const { usage, isLimitReached, refresh: refreshUsage } = useUsageLimits();
  const metabolicData = useMetabolicCalculations(profile);
  const { 
    isOptimizing, 
    isApplying,
    isUndoing, 
    result: optimizationResult, 
    preview: optimizationPreview,
    generatePreview,
    applyPreview,
    cancelPreview,
    undo: undoOptimization 
  } = useBruteForceOptimizer();
  const { playSuccessSound } = useSuccessSound();
  
  // Hybrid optimizer
  const {
    phase: hybridPhase,
    isOptimizing: isHybridOptimizing,
    isApplying: isHybridApplying,
    preview: hybridPreview,
    result: hybridResult,
    generatePreview: generateHybridPreview,
    applyPreview: applyHybridPreview,
    cancelPreview: cancelHybridPreview,
    reset: resetHybrid,
  } = useHybridOptimizer();
  
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);
  const [showHybridDialog, setShowHybridDialog] = useState(false);
  const [hybridDialogPhase, setHybridDialogPhase] = useState<'loading' | 'preview' | 'result'>('loading');
  const [optimizationPhase, setOptimizationPhase] = useState<'loading' | 'preview' | 'result'>('loading');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentDietPlan, setCurrentDietPlan] = useState<DietPlan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>('diet');
  const [upgradeLimit, setUpgradeLimit] = useState<number>(0);
  const [planReleased, setPlanReleased] = useState(false);

  // Handle checkout success
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast.success('Assinatura ativada com sucesso! 🎉');
      refreshSubscription();
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refreshSubscription]);

  useEffect(() => {
    fetchCurrentPlan();
  }, []);

  const fetchCurrentPlan = async () => {
    try {
      const { data: plans, error } = await supabase
        .from('diet_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (plans && plans.length > 0) {
        const plan = plans[0] as DietPlan;
        setCurrentDietPlan(plan);
        setPlanReleased(true);
        await fetchMeals(plan.id);
      }
    } catch (error: unknown) {
      console.error('Error fetching plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeals = async (planId: string) => {
    const { data, error } = await supabase
      .from('meals')
      .select('*')
      .eq('diet_plan_id', planId)
      .order('created_at');

    if (!error && data) {
      setMeals(data as Meal[]);
    }
  };

  const [generatingV5, setGeneratingV5] = useState(false);

  const generateMealPlan = async () => {
    // Verificar permissões antes de gerar
    if (!permissions.can_create_plan || isLimitReached('diet')) {
      setShowUpgradeDialog(true);
      setUpgradeFeature('diet');
      setUpgradeLimit(usage?.diets.limit || 0);
      toast.error(`Limite de dietas atingido (${usage?.diets.used}/${usage?.diets.limit})`);
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          profile: {
            daily_calories: profile?.daily_calories,
            protein_target: profile?.protein_target,
            carbs_target: profile?.carbs_target,
            fat_target: profile?.fat_target,
            preferences: profile?.preferences,
            restrictions: profile?.restrictions,
            preferred_foods: profile?.preferred_foods || [],
            avoided_foods: profile?.avoided_foods || [],
            goal: profile?.goal,
            meals_per_day: profile?.meals_per_day || 4,
          },
        },
      });

      if (response.error) throw response.error;

      toast.success('Plano alimentar gerado com sucesso!');
      await fetchCurrentPlan();
      await refreshUsage();
    } catch (error: any) {
      console.error('Error generating plan:', error);
      // Check for limit error from backend
      if (error?.context?.status === 403) {
        toast.error('Limite de dietas atingido. Faça upgrade para continuar.');
        setShowUpgradeDialog(true);
        setUpgradeFeature('diet');
      } else {
        toast.error('Erro ao gerar plano alimentar');
      }
    } finally {
      setGenerating(false);
    }
  };

  const generateMealPlanV5 = async () => {
    // Verificar permissões antes de gerar
    if (!permissions.can_create_plan || isLimitReached('diet')) {
      setShowUpgradeDialog(true);
      setUpgradeFeature('diet');
      setUpgradeLimit(usage?.diets.limit || 0);
      toast.error(`Limite de dietas atingido (${usage?.diets.used}/${usage?.diets.limit})`);
      return;
    }

    setGeneratingV5(true);
    try {
      const response = await supabase.functions.invoke('generate-meal-plan-v5', {
        body: {
          profile: {
            daily_calories: profile?.daily_calories,
            protein_target: profile?.protein_target,
            carbs_target: profile?.carbs_target,
            fat_target: profile?.fat_target,
            preferences: profile?.preferences,
            restrictions: profile?.restrictions,
            preferred_foods: profile?.preferred_foods || [],
            avoided_foods: profile?.avoided_foods || [],
            goal: profile?.goal,
            meals_per_day: profile?.meals_per_day || 4,
          },
        },
      });

      if (response.error) throw response.error;

      toast.success('Plano alimentar v5 gerado com sucesso! ✨');
      await fetchCurrentPlan();
      await refreshUsage();
    } catch (error: any) {
      console.error('Error generating plan v5:', error);
      // Check for limit error from backend
      if (error?.context?.status === 403) {
        toast.error('Limite de dietas atingido. Faça upgrade para continuar.');
        setShowUpgradeDialog(true);
        setUpgradeFeature('diet');
      } else {
        toast.error('Erro ao gerar plano alimentar v5');
      }
    } finally {
      setGeneratingV5(false);
    }
  };

  const handleBruteForceOptimize = async () => {
    if (!currentDietPlan) return;
    
    // Open modal immediately to show loading state
    setOptimizationPhase('loading');
    setShowOptimizationDialog(true);
    
    const preview = await generatePreview(currentDietPlan.id, {
      calories: profile?.daily_calories || 2000,
      protein: profile?.protein_target || 150,
      carbs: profile?.carbs_target || 250,
      fat: profile?.fat_target || 65,
    });
    
    // Transition to preview phase or close if failed
    if (preview) {
      setOptimizationPhase('preview');
    } else {
      setShowOptimizationDialog(false);
    }
  };

  const handleConfirmOptimization = async () => {
    const result = await applyPreview();
    
    if (result?.success) {
      // Smooth transition to result phase
      setOptimizationPhase('result');
      // Play success sound
      playSuccessSound();
      await fetchCurrentPlan();
    }
  };

  const handleCancelOptimization = () => {
    cancelPreview();
    setShowOptimizationDialog(false);
  };

  const handleCloseOptimizationDialog = () => {
    setShowOptimizationDialog(false);
    // Reset phase after dialog close animation
    setTimeout(() => setOptimizationPhase('loading'), 300);
  };

  // ========== HYBRID OPTIMIZER HANDLERS ==========
  const handleHybridOptimize = async () => {
    if (!currentDietPlan || !profile) return;
    
    // Map goal to objective
    const objectiveMap: Record<string, string> = {
      lose_weight: 'cut',
      maintain: 'maintain',
      gain_muscle: 'bulk',
    };
    const objective = objectiveMap[profile.goal || 'maintain'] || 'maintain';
    
    setHybridDialogPhase('loading');
    setShowHybridDialog(true);
    
    const preview = await generateHybridPreview(
      currentDietPlan.id,
      {
        calories: profile?.daily_calories || 2000,
        protein: profile?.protein_target || 150,
        carbs: profile?.carbs_target || 250,
        fat: profile?.fat_target || 65,
      },
      objective
    );
    
    if (preview) {
      setHybridDialogPhase('preview');
    } else {
      setShowHybridDialog(false);
    }
  };

  const handleConfirmHybridOptimization = async () => {
    const result = await applyHybridPreview();
    
    if (result?.success) {
      setHybridDialogPhase('result');
      playSuccessSound();
      await fetchCurrentPlan();
    }
  };

  const handleCancelHybridOptimization = () => {
    cancelHybridPreview();
    setShowHybridDialog(false);
  };

  const handleCloseHybridDialog = () => {
    setShowHybridDialog(false);
    setTimeout(() => {
      setHybridDialogPhase('loading');
      resetHybrid();
    }, 300);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const currentCalories = currentDietPlan?.total_calories || 0;
  const currentProtein = currentDietPlan?.total_protein || 0;
  const currentCarbs = currentDietPlan?.total_carbs || 0;
  const currentFat = currentDietPlan?.total_fat || 0;

  return (
    <>
      {/* Tutorial Modal */}
      {showTutorial && (
        <OnboardingTutorial 
          onComplete={markTutorialComplete} 
          onSkip={closeTutorial} 
        />
      )}

    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header - Mobile responsive with hamburger concept via scrollable icons */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MobileNav />
            <Logo />
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            )}
          </div>
          {/* Desktop navigation - hidden on mobile */}
          <TooltipProvider delayDuration={300}>
            <div className="hidden md:flex items-center gap-1">
              {/* Admin vê apenas o escudo */}
              {isAdmin ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/admin">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <Shield className="w-5 h-5 text-primary" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Painel Admin</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  {/* Profissionais */}
                  {(isSubscribed && accountType === 'professional') || isProfessional ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to="/professional">
                            <Button variant="ghost" size="icon" className="w-10 h-10 relative">
                              <LayoutDashboard className="w-5 h-5" />
                            </Button>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>Painel Profissional</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link to="/students">
                            <Button variant="ghost" size="icon" className="w-10 h-10">
                              <Users className="w-5 h-5" />
                            </Button>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>Gerenciar Alunos</TooltipContent>
                      </Tooltip>
                    </>
                  ) : null}
                  
                  {/* Assinatura - Profissional não vê (já gerencia no painel), Aluno vinculado não vê (gerenciado pelo profissional) */}
                  {!isProfessional && !isLinkedStudent && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to="/subscription">
                          <Button variant="ghost" size="icon" className="w-10 h-10">
                            <CreditCard className="w-5 h-5" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Assinatura</TooltipContent>
                    </Tooltip>
                  )}
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/progress">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <TrendingUp className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Progresso</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/profile">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <User className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Meu Perfil</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/chat">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <MessageCircle className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Chat IA</TooltipContent>
                  </Tooltip>
                </>
              )}
              <ThemeToggle />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-10 h-10" onClick={handleSignOut}>
                    <LogOut className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sair</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </header>

      {loading ? (
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-24">
          <DashboardSkeleton />
        </main>
      ) : (
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-24">
        {/* Linked Student Read-Only Notice */}
        {isLinkedStudent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3"
          >
            <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-medium text-foreground">Modo Visualização</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Seu plano alimentar é gerenciado pelo seu nutricionista.
              </p>
            </div>
          </motion.div>
        )}


        {/* Welcome Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1 sm:space-y-2"
        >
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            Olá, {profile?.name?.split(' ')[0] || 'Usuário'}! 👋
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {profile?.goal
              ? `Objetivo: ${GOALS[profile.goal as keyof typeof GOALS]?.label}`
              : 'Acompanhe seu plano alimentar'}
          </p>
        </motion.section>

        {/* Stats Cards + Goals - Reorganized layout */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3 sm:space-y-4"
        >
          {/* Optimization Buttons */}
          {currentDietPlan && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBruteForceOptimize}
                disabled={isOptimizing || isHybridOptimizing}
                className="text-xs border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Otimizando...
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 mr-1" />
                    Rápido (Teste)
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleHybridOptimize}
                disabled={isOptimizing || isHybridOptimizing}
                className="text-xs border-purple-500 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
              >
                {isHybridOptimizing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    {hybridPhase.message || 'Otimizando...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Híbrido (IA + Precisão)
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Calorie & Macros Row */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Calorie Card */}
            <div className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col items-center">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Calorias</h3>
              </div>
              <CalorieRing
                current={currentCalories}
                target={profile?.daily_calories || 2000}
              />
            </div>

            {/* Macros Card */}
            <div className="card-elevated rounded-xl sm:rounded-2xl p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-3 sm:mb-4">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h3 className="font-semibold text-foreground text-sm sm:text-base">Macros</h3>
              </div>
              <MacroChart
                protein={currentProtein}
                carbs={currentCarbs}
                fat={currentFat}
                proteinTarget={profile?.protein_target || 150}
                carbsTarget={profile?.carbs_target || 250}
                fatTarget={profile?.fat_target || 65}
              />
            </div>
          </div>

          {/* TMB/TDEE + Goals Projection + Hydration Tip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* TMB/TDEE Compact Card */}
            {metabolicData && (
              <div className="card-elevated rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <h3 className="font-semibold text-foreground text-sm">Metabolismo</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">TMB</span>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{metabolicData.bmr} kcal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">TDEE</span>
                    <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">{metabolicData.tdee} kcal</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Gasto basal e total diário
                </p>
              </div>
            )}
            <div className={metabolicData ? "sm:col-span-1" : "sm:col-span-2"}>
              <GoalsProjectionCard />
            </div>
            <HydrationTipCard />
          </div>
        </motion.section>

        {/* Adherence Widget - only for paid users with a plan */}
        {currentDietPlan && subscriptionPlan && subscriptionPlan.type !== 'gratuito' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <AdherenceWidget />
          </motion.section>
        )}

        {permissions.can_create_plan && !isLinkedStudent && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="grid grid-cols-2 gap-2">
              {/* Botão Gerar Plano Alimentar */}
              <Button
                variant="default"
                size="default"
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={generateMealPlanV5}
                disabled={generating || generatingV5}
              >
                {generatingV5 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Gerando...</span>
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="w-4 h-4" />
                    <span className="hidden sm:inline">Gerar Plano</span>
                    <span className="sm:hidden">Gerar</span>
                  </>
                )}
              </Button>

              {/* Otimizar Plano Alimentar - apenas se pode editar */}
              {currentDietPlan && permissions.can_adjust ? (
                <AIRebalancer
                  planId={currentDietPlan.id}
                  targets={{
                    protein: profile?.protein_target || 150,
                    carbs: profile?.carbs_target || 250,
                    fat: profile?.fat_target || 65,
                    calories: profile?.daily_calories || 2000,
                  }}
                  currentMacros={{
                    protein: currentProtein,
                    carbs: currentCarbs,
                    fat: currentFat,
                    calories: currentCalories,
                  }}
                  userGoal={profile?.goal as 'gain_muscle' | 'lose_weight' | 'maintain' | undefined}
                  onComplete={fetchCurrentPlan}
                  compact
                />
              ) : (
                <div /> // Placeholder para manter grid quando otimizar não disponível
              )}
            </div>
          </motion.section>
        )}

        {/* Bloqueio para alunos vinculados - simplificado para v2 */}
        {isLinkedStudent && !planReleased && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 bg-muted rounded-lg text-center"
          >
            <Lock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Seu plano alimentar é gerenciado pelo seu nutricionista.
            </p>
          </motion.section>
        )}

        {/* Meals Section */}
        {isLinkedStudent && !planReleased ? (
          // Linked student without released plan
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              Plano ainda não liberado
            </h3>
            <p className="text-muted-foreground text-sm max-w-xs mx-auto">
              Seu nutricionista está preparando seu plano alimentar. Quando estiver pronto, ele aparecerá aqui.
            </p>
          </motion.section>
        ) : currentDietPlan ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Plano de Hoje
              </h2>
              {/* Only show daily log button for paid users */}
              {subscriptionPlan && subscriptionPlan.type !== 'gratuito' && (
                <Link to="/daily-log">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">Registrar consumo</span>
                    <span className="sm:hidden">Registrar</span>
                  </Button>
                </Link>
              )}
            </div>
            <div className="space-y-3">
              {meals.map((meal, index) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Link
                    to={`/meal/${meal.id}`}
                    className="card-interactive rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">
                          {MEAL_NAMES[meal.name as MealType] || meal.name}
                        </h3>
                        {permissions.meal_options_limit > 1 && (
                          <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <Layers className="w-3 h-3" />
                            <span>{permissions.meal_options_limit} opções</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {meal.total_calories} kcal • P: {Math.round(meal.total_protein)}g • C:{' '}
                        {Math.round(meal.total_carbs)}g • G: {Math.round(meal.total_fat)}g
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              Nenhum plano gerado
            </h3>
            <p className="text-muted-foreground text-sm">
              {isLinkedStudent 
                ? 'Aguarde seu nutricionista criar seu plano alimentar'
                : 'Clique no botão acima para gerar seu primeiro plano alimentar'
              }
            </p>
          </motion.section>
        )}


        {/* Disclaimer and Help */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center px-4 py-6 space-y-3"
        >
          <button
            onClick={openTutorial}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Ver tutorial do sistema
          </button>
          <p className="text-xs text-muted-foreground">
            Este aplicativo oferece educação nutricional e não substitui um
            profissional de saúde. Consulte um nutricionista para orientação
            personalizada.
          </p>
        </motion.section>
      </main>
      )}

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        feature={upgradeFeature}
        currentPlan={subscriptionPlan?.name}
        limit={upgradeLimit}
      />

      {/* Unified Optimization Dialog with Phase Transitions */}
      <Dialog open={showOptimizationDialog} onOpenChange={(open) => {
        if (!open) handleCancelOptimization();
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {optimizationPhase === 'result' ? (
                <>
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Resultado da Otimização
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5 text-blue-500" />
                  Prévia da Otimização
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {optimizationPhase === 'result' 
                ? 'Comparativo antes e depois do ajuste de quantidades'
                : 'Revise as alterações antes de aplicar'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Loading Phase */}
          {optimizationPhase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 py-4"
            >
              <div className="flex flex-col items-center justify-center py-6">
                {/* Animated Icon with Pulse/Bounce */}
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [1, 0.8, 1],
                  }}
                  transition={{ 
                    duration: 1.2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-2 border-amber-500/30 border-t-amber-500"
                    style={{ width: 64, height: 64, margin: -8 }}
                  />
                  <Zap className="h-12 w-12 text-amber-500" />
                </motion.div>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-6 text-lg font-medium text-foreground"
                >
                  Calculando otimização...
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="mt-2 text-sm text-muted-foreground text-center max-w-xs"
                >
                  Analisando macros e ajustando quantidades para atingir suas metas
                </motion.p>
              </div>

              {/* Estimated Progress Bar */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="px-4"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Progresso estimado</span>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    ~3-5 segundos
                  </motion.span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "95%" }}
                    transition={{ 
                      duration: 4, 
                      ease: [0.4, 0.0, 0.2, 1]
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <motion.span
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    Otimizando alimentos...
                  </motion.span>
                </div>
              </motion.div>

              {/* Skeleton Preview */}
              <div className="space-y-4 opacity-40">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                    <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-green-500/5 space-y-3">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-3 w-full bg-muted rounded animate-pulse" />
                      <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-blue-500/5 space-y-3">
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="text-center space-y-1">
                        <div className="h-4 w-12 mx-auto bg-muted rounded animate-pulse" />
                        <div className="h-3 w-8 mx-auto bg-muted rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Preview Phase */}
          {optimizationPhase === 'preview' && optimizationPreview && (
            <motion.div 
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-4"
            >
              {/* Macro Comparison */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.25 }}
                className="grid grid-cols-2 gap-4"
              >
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="p-4 border rounded-lg bg-muted/30"
                >
                  <h4 className="font-medium text-sm mb-3 text-muted-foreground">Atual</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Calorias:</span>
                      <span className="font-mono">{optimizationPreview.before.calories} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proteína:</span>
                      <span className="font-mono">{optimizationPreview.before.protein}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carboidratos:</span>
                      <span className="font-mono">{optimizationPreview.before.carbs}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gordura:</span>
                      <span className="font-mono">{optimizationPreview.before.fat}g</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="p-4 border rounded-lg bg-green-500/10 border-green-500/30"
                >
                  <h4 className="font-medium text-sm mb-3 text-green-600 dark:text-green-400">Após Otimização</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Calorias:</span>
                      <span className="font-mono">
                        {optimizationPreview.after.calories} kcal
                        <DeltaBadge value={optimizationPreview.after.calories - optimizationPreview.before.calories} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proteína:</span>
                      <span className="font-mono">
                        {optimizationPreview.after.protein}g
                        <DeltaBadge value={optimizationPreview.after.protein - optimizationPreview.before.protein} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carboidratos:</span>
                      <span className="font-mono">
                        {optimizationPreview.after.carbs}g
                        <DeltaBadge value={optimizationPreview.after.carbs - optimizationPreview.before.carbs} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gordura:</span>
                      <span className="font-mono">
                        {optimizationPreview.after.fat}g
                        <DeltaBadge value={optimizationPreview.after.fat - optimizationPreview.before.fat} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Target Comparison */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="p-4 border rounded-lg bg-blue-500/10 border-blue-500/30"
              >
                <h4 className="font-medium text-sm mb-3 text-blue-600 dark:text-blue-400">Metas</h4>
                <div className="grid grid-cols-4 gap-2 text-sm text-center">
                  <div>
                    <div className="font-mono font-medium">{optimizationPreview.targets.calories}</div>
                    <div className="text-xs text-muted-foreground">kcal</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{optimizationPreview.targets.protein}g</div>
                    <div className="text-xs text-muted-foreground">prot</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{optimizationPreview.targets.carbs}g</div>
                    <div className="text-xs text-muted-foreground">carb</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{optimizationPreview.targets.fat}g</div>
                    <div className="text-xs text-muted-foreground">gord</div>
                  </div>
                </div>
              </motion.div>

              {/* Changes Table */}
              {optimizationPreview.changes.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.35 }}
                  className="space-y-2"
                >
                  <h4 className="font-medium text-sm">Alterações Propostas ({optimizationPreview.changes.length})</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Alimento</TableHead>
                          <TableHead className="text-right">Atual</TableHead>
                          <TableHead className="text-right">Proposto</TableHead>
                          <TableHead className="text-right">Delta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {optimizationPreview.changes.map((change, idx) => (
                          <motion.tr
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ 
                              delay: 0.35 + (idx * 0.05),
                              duration: 0.25,
                              ease: 'easeOut'
                            }}
                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          >
                            <TableCell className="font-medium text-sm">{change.food_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.old_quantity}g</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.new_quantity}g</TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={change.new_quantity - change.old_quantity} suffix="g" />
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="text-center py-4 text-muted-foreground text-sm"
                >
                  Nenhuma alteração necessária - o plano já está otimizado!
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleCancelOptimization}
                  disabled={isApplying}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmOptimization}
                  disabled={isApplying || optimizationPreview.changes.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Aplicar Otimização
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Result Phase */}
          {optimizationPhase === 'result' && optimizationResult && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6 py-4"
            >
              {/* Success Animation */}
              <SuccessAnimation 
                show={true} 
                message={`${optimizationResult.changes.length} alimentos otimizados!`} 
              />
              {/* Macro Comparison */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.25 }}
                className="grid grid-cols-2 gap-4"
              >
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="p-4 border rounded-lg bg-muted/30"
                >
                  <h4 className="font-medium text-sm mb-3 text-muted-foreground">Antes</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Calorias:</span>
                      <span className="font-mono">{optimizationResult.before.calories} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proteína:</span>
                      <span className="font-mono">{optimizationResult.before.protein}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carboidratos:</span>
                      <span className="font-mono">{optimizationResult.before.carbs}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gordura:</span>
                      <span className="font-mono">{optimizationResult.before.fat}g</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="p-4 border rounded-lg bg-green-500/10 border-green-500/30"
                >
                  <h4 className="font-medium text-sm mb-3 text-green-600 dark:text-green-400">Depois</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Calorias:</span>
                      <span className="font-mono">
                        {optimizationResult.after.calories} kcal
                        <DeltaBadge value={optimizationResult.after.calories - optimizationResult.before.calories} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proteína:</span>
                      <span className="font-mono">
                        {optimizationResult.after.protein}g
                        <DeltaBadge value={optimizationResult.after.protein - optimizationResult.before.protein} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carboidratos:</span>
                      <span className="font-mono">
                        {optimizationResult.after.carbs}g
                        <DeltaBadge value={optimizationResult.after.carbs - optimizationResult.before.carbs} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gordura:</span>
                      <span className="font-mono">
                        {optimizationResult.after.fat}g
                        <DeltaBadge value={optimizationResult.after.fat - optimizationResult.before.fat} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>

              {/* Target Comparison */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="p-4 border rounded-lg bg-blue-500/10 border-blue-500/30"
              >
                <h4 className="font-medium text-sm mb-3 text-blue-600 dark:text-blue-400">Metas</h4>
                <div className="grid grid-cols-4 gap-2 text-sm text-center">
                  <div>
                    <div className="font-mono font-medium">{optimizationResult.targets.calories}</div>
                    <div className="text-xs text-muted-foreground">kcal</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{optimizationResult.targets.protein}g</div>
                    <div className="text-xs text-muted-foreground">prot</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{optimizationResult.targets.carbs}g</div>
                    <div className="text-xs text-muted-foreground">carb</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{optimizationResult.targets.fat}g</div>
                    <div className="text-xs text-muted-foreground">gord</div>
                  </div>
                </div>
              </motion.div>

              {/* Changes Table */}
              {optimizationResult.changes.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.35 }}
                  className="space-y-2"
                >
                  <h4 className="font-medium text-sm">Alimentos Ajustados ({optimizationResult.changes.length})</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Alimento</TableHead>
                          <TableHead className="text-right">Antes</TableHead>
                          <TableHead className="text-right">Depois</TableHead>
                          <TableHead className="text-right">Delta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {optimizationResult.changes.map((change, idx) => (
                          <motion.tr
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ 
                              delay: 0.8 + (idx * 0.06),
                              duration: 0.25,
                              ease: 'easeOut'
                            }}
                            className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                          >
                            <TableCell className="font-medium text-sm">{change.food_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.old_quantity}g</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.new_quantity}g</TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={change.new_quantity - change.old_quantity} suffix="g" />
                            </TableCell>
                          </motion.tr>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="text-center py-4 text-muted-foreground text-sm"
                >
                  Nenhum alimento precisou ser ajustado - o plano já está otimizado!
                </motion.div>
              )}

              {/* Undo Button */}
              {optimizationResult.changes.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                  className="flex justify-end gap-2 pt-4 border-t"
                >
                  <Button
                    variant="outline"
                    onClick={handleCloseOptimizationDialog}
                  >
                    Fechar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      const success = await undoOptimization();
                      if (success) {
                        handleCloseOptimizationDialog();
                        await fetchCurrentPlan();
                      }
                    }}
                    disabled={isUndoing}
                  >
                    {isUndoing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Desfazendo...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Desfazer Otimização
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hybrid Optimization Dialog */}
      <Dialog open={showHybridDialog} onOpenChange={(open) => {
        if (!open) handleCancelHybridOptimization();
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hybridDialogPhase === 'result' ? (
                <>
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Resultado da Otimização Híbrida
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Otimização Híbrida (IA + Precisão)
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {hybridDialogPhase === 'result' 
                ? 'Comparativo das duas fases de otimização'
                : 'Combinando decisões nutricionais da IA com precisão matemática'
              }
            </DialogDescription>
          </DialogHeader>

          {/* Loading Phase */}
          {hybridDialogPhase === 'loading' && (
            <motion.div
              key="hybrid-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6 py-4"
            >
              <div className="flex flex-col items-center justify-center py-6">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{ 
                    duration: 2, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative"
                >
                  <Sparkles className="h-12 w-12 text-purple-500" />
                </motion.div>
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium text-foreground">
                    {hybridPhase.message || 'Iniciando otimização...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fase: {hybridPhase.name === 'ai' ? 'IA' : hybridPhase.name === 'bruteforce' ? 'Ajuste Fino' : hybridPhase.name}
                  </p>
                </div>
                {/* Progress Bar */}
                <div className="w-full max-w-xs mt-4">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${hybridPhase.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    {hybridPhase.progress}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Preview Phase */}
          {hybridDialogPhase === 'preview' && hybridPreview && (
            <motion.div
              key="hybrid-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Three-column comparison */}
              <div className="grid grid-cols-3 gap-3">
                {/* Before */}
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h4 className="font-medium text-xs mb-2 text-muted-foreground">Antes</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Cal:</span>
                      <span className="font-mono">{hybridPreview.before.calories}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prot:</span>
                      <span className="font-mono">{hybridPreview.before.protein}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carb:</span>
                      <span className="font-mono">{hybridPreview.before.carbs}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gord:</span>
                      <span className="font-mono">{hybridPreview.before.fat}g</span>
                    </div>
                  </div>
                </div>

                {/* After AI */}
                <div className="p-3 border rounded-lg bg-blue-500/10 border-blue-500/30">
                  <h4 className="font-medium text-xs mb-2 text-blue-600 dark:text-blue-400">Após IA</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Cal:</span>
                      <span className="font-mono">{hybridPreview.afterAI.calories}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prot:</span>
                      <span className="font-mono">{hybridPreview.afterAI.protein}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carb:</span>
                      <span className="font-mono">{hybridPreview.afterAI.carbs}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gord:</span>
                      <span className="font-mono">{hybridPreview.afterAI.fat}g</span>
                    </div>
                  </div>
                </div>

                {/* After Brute Force */}
                <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                  <h4 className="font-medium text-xs mb-2 text-green-600 dark:text-green-400">Final (Ajuste Fino)</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Cal:</span>
                      <span className="font-mono">{hybridPreview.afterBruteForce.calories}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prot:</span>
                      <span className="font-mono">{hybridPreview.afterBruteForce.protein}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carb:</span>
                      <span className="font-mono">{hybridPreview.afterBruteForce.carbs}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gord:</span>
                      <span className="font-mono">{hybridPreview.afterBruteForce.fat}g</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Targets */}
              <div className="p-3 border rounded-lg bg-purple-500/10 border-purple-500/30">
                <h4 className="font-medium text-xs mb-2 text-purple-600 dark:text-purple-400">Metas</h4>
                <div className="grid grid-cols-4 gap-2 text-xs text-center">
                  <div>
                    <div className="font-mono font-medium">{hybridPreview.targets.calories}</div>
                    <div className="text-muted-foreground">kcal</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{hybridPreview.targets.protein}g</div>
                    <div className="text-muted-foreground">prot</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{hybridPreview.targets.carbs}g</div>
                    <div className="text-muted-foreground">carb</div>
                  </div>
                  <div>
                    <div className="font-mono font-medium">{hybridPreview.targets.fat}g</div>
                    <div className="text-muted-foreground">gord</div>
                  </div>
                </div>
              </div>

              {/* Changes Summary */}
              <div className="grid grid-cols-2 gap-3">
                {/* AI Changes */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-xs mb-2 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-blue-500" />
                    Ajustes da IA ({hybridPreview.aiChanges.length})
                  </h4>
                  {hybridPreview.aiChanges.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {hybridPreview.aiChanges.slice(0, 5).map((change, i) => (
                        <div key={i} className="text-xs flex justify-between">
                          <span className="truncate flex-1">{change.food_name}</span>
                          <span className="font-mono ml-2">
                            {change.old_quantity}→{change.new_quantity}g
                          </span>
                        </div>
                      ))}
                      {hybridPreview.aiChanges.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{hybridPreview.aiChanges.length - 5} mais...
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum ajuste</p>
                  )}
                </div>

                {/* Brute Force Changes */}
                <div className="border rounded-lg p-3">
                  <h4 className="font-medium text-xs mb-2 flex items-center gap-1">
                    <Target className="w-3 h-3 text-green-500" />
                    Ajuste Fino ({hybridPreview.bruteForceChanges.length})
                  </h4>
                  {hybridPreview.bruteForceChanges.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {hybridPreview.bruteForceChanges.slice(0, 5).map((change, i) => (
                        <div key={i} className="text-xs flex justify-between">
                          <span className="truncate flex-1">{change.food_name}</span>
                          <span className="font-mono ml-2">
                            {change.old_quantity}→{change.new_quantity}g
                          </span>
                        </div>
                      ))}
                      {hybridPreview.bruteForceChanges.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          +{hybridPreview.bruteForceChanges.length - 5} mais...
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhum ajuste adicional</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleCancelHybridOptimization}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmHybridOptimization}
                  disabled={isHybridApplying}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {isHybridApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aplicando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Aplicar Ajuste Fino
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Result Phase */}
          {hybridDialogPhase === 'result' && hybridResult && (
            <motion.div
              key="hybrid-result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <SuccessAnimation show={true} message="Otimização Concluída!" />
              
              <div className="text-center py-2">
                <p className="text-lg font-semibold text-foreground">
                  Otimização Híbrida Concluída!
                </p>
                <p className="text-sm text-muted-foreground">
                  {hybridResult.aiChanges.length + hybridResult.bruteForceChanges.length} ajustes aplicados
                </p>
              </div>

              {/* Final comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h4 className="font-medium text-xs mb-2 text-muted-foreground">Antes</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Calorias:</span>
                      <span className="font-mono">{hybridResult.before.calories} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proteína:</span>
                      <span className="font-mono">{hybridResult.before.protein}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carboidratos:</span>
                      <span className="font-mono">{hybridResult.before.carbs}g</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gordura:</span>
                      <span className="font-mono">{hybridResult.before.fat}g</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 border rounded-lg bg-green-500/10 border-green-500/30">
                  <h4 className="font-medium text-xs mb-2 text-green-600 dark:text-green-400">Final</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Calorias:</span>
                      <span className="font-mono">
                        {hybridResult.afterBruteForce.calories} kcal
                        <DeltaBadge value={hybridResult.afterBruteForce.calories - hybridResult.before.calories} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proteína:</span>
                      <span className="font-mono">
                        {hybridResult.afterBruteForce.protein}g
                        <DeltaBadge value={hybridResult.afterBruteForce.protein - hybridResult.before.protein} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Carboidratos:</span>
                      <span className="font-mono">
                        {hybridResult.afterBruteForce.carbs}g
                        <DeltaBadge value={hybridResult.afterBruteForce.carbs - hybridResult.before.carbs} />
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gordura:</span>
                      <span className="font-mono">
                        {hybridResult.afterBruteForce.fat}g
                        <DeltaBadge value={hybridResult.afterBruteForce.fat - hybridResult.before.fat} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleCloseHybridDialog}>
                  Fechar
                </Button>
              </div>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}

// Helper component for displaying deltas
function DeltaBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 1) return null;
  
  const isPositive = value > 0;
  const displayValue = Math.round(value);
  
  return (
    <Badge 
      variant="outline" 
      className={`ml-1 text-xs ${
        isPositive 
          ? 'border-green-500 text-green-600 dark:text-green-400' 
          : 'border-red-500 text-red-600 dark:text-red-400'
      }`}
    >
      {isPositive ? '+' : ''}{displayValue}{suffix}
    </Badge>
  );
}
