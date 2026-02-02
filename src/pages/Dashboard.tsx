import { useEffect, useState } from 'react';
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
import { LimitReachedAlert } from '@/components/LimitReachedAlert';
import { useTutorial } from '@/hooks/useTutorial';
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
  const [showOptimizationPreview, setShowOptimizationPreview] = useState(false);
  const [showOptimizationResult, setShowOptimizationResult] = useState(false);
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
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

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

  const handleDismissAlert = (feature: string) => {
    setDismissedAlerts(prev => new Set([...prev, feature]));
  };

  const handleBruteForceOptimize = async () => {
    if (!currentDietPlan) return;
    
    const preview = await generatePreview(currentDietPlan.id, {
      calories: profile?.daily_calories || 2000,
      protein: profile?.protein_target || 150,
      carbs: profile?.carbs_target || 250,
      fat: profile?.fat_target || 65,
    });
    
    // Show preview dialog if generated successfully
    if (preview) {
      setShowOptimizationPreview(true);
    }
  };

  const handleConfirmOptimization = async () => {
    const result = await applyPreview();
    
    if (result?.success) {
      setShowOptimizationPreview(false);
      setShowOptimizationResult(true);
      await fetchCurrentPlan();
    }
  };

  const handleCancelOptimization = () => {
    cancelPreview();
    setShowOptimizationPreview(false);
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

        {/* Limit Reached Alerts - Show when any limit is hit */}
        {usage && !isLinkedStudent && (
          <div className="space-y-3">
            {isLimitReached('diet') && !dismissedAlerts.has('diet') && (
              <LimitReachedAlert
                feature="diet"
                current={usage.diets.used}
                limit={usage.diets.limit}
                planName={subscriptionPlan?.name}
                onDismiss={() => handleDismissAlert('diet')}
              />
            )}
            {isLimitReached('substitution') && !dismissedAlerts.has('substitution') && (
              <LimitReachedAlert
                feature="substitution"
                current={usage.substitutions.used}
                limit={usage.substitutions.limit}
                planName={subscriptionPlan?.name}
                onDismiss={() => handleDismissAlert('substitution')}
              />
            )}
            {isLimitReached('adjustment') && !dismissedAlerts.has('adjustment') && (
              <LimitReachedAlert
                feature="adjustment"
                current={usage.adjustments.used}
                limit={usage.adjustments.limit}
                planName={subscriptionPlan?.name}
                onDismiss={() => handleDismissAlert('adjustment')}
              />
            )}
            {isLimitReached('chat') && !dismissedAlerts.has('chat') && (
              <LimitReachedAlert
                feature="chat"
                current={usage.chat.used}
                limit={usage.chat.limit}
                planName={subscriptionPlan?.name}
                onDismiss={() => handleDismissAlert('chat')}
              />
            )}
          </div>
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
          {/* Test Optimization Button */}
          {currentDietPlan && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBruteForceOptimize}
                disabled={isOptimizing}
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
                    Otimizar Plano (Teste)
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

          {/* Goals Projection + Hydration Tip - Compact Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
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

      {/* Optimization Preview Dialog */}
      <Dialog open={showOptimizationPreview} onOpenChange={(open) => {
        if (!open) handleCancelOptimization();
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              Prévia da Otimização
            </DialogTitle>
            <DialogDescription>
              Revise as alterações antes de aplicar
            </DialogDescription>
          </DialogHeader>

          {optimizationPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-sm">{change.food_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.old_quantity}g</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.new_quantity}g</TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={change.new_quantity - change.old_quantity} suffix="g" />
                            </TableCell>
                          </TableRow>
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
        </DialogContent>
      </Dialog>

      {/* Optimization Result Dialog */}
      <Dialog open={showOptimizationResult} onOpenChange={setShowOptimizationResult}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Resultado da Otimização
            </DialogTitle>
            <DialogDescription>
              Comparativo antes e depois do ajuste de quantidades
            </DialogDescription>
          </DialogHeader>

          {optimizationResult && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="space-y-6 py-4"
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
                          <TableRow key={idx}>
                            <TableCell className="font-medium text-sm">{change.food_name}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.old_quantity}g</TableCell>
                            <TableCell className="text-right font-mono text-sm">{change.new_quantity}g</TableCell>
                            <TableCell className="text-right">
                              <DeltaBadge value={change.new_quantity - change.old_quantity} suffix="g" />
                            </TableCell>
                          </TableRow>
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
                    onClick={() => setShowOptimizationResult(false)}
                  >
                    Fechar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      const success = await undoOptimization();
                      if (success) {
                        setShowOptimizationResult(false);
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
