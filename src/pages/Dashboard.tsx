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
  Loader2,
  User,
  TrendingUp,
  Users,
  CreditCard,
  LayoutDashboard,
  Lock,
  Eye,
  Shield,
  HelpCircle,
  Layers,
  ClipboardCheck,
  FileText,
  Sparkles,
  Info,
} from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

import { CalorieRing } from '@/components/CalorieRing';
import { MacroChart } from '@/components/MacroChart';
import { AIRebalancer } from '@/components/AIRebalancer';
import { SupplementToggle } from '@/components/SupplementToggle';
import { MetricCard, NutritionCard, MealCard, FadeInView } from '@/components/ui-kit';

import { UpgradeDialog } from '@/components/UpgradeDialog';
import { WeeklyAdherenceChart } from '@/components/WeeklyAdherenceChart';
import { DailyLogCTA } from '@/components/DailyLogCTA';
import { EmptyPlanState } from '@/components/EmptyPlanState';
import { AdherenceStreak } from '@/components/AdherenceStreak';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { GamificationPreview } from '@/components/GamificationPreview';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { useTutorial } from '@/hooks/useTutorial';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { useMetabolicCalculations } from '@/hooks/useMetabolicCalculations';
import { supabase } from '@/integrations/supabase/client';
import { DietPlan, Meal, GOALS, MEAL_NAMES, MealType } from '@/lib/types';
import { toast } from 'sonner';
import { FreePlanBadge } from '@/components/FeatureBadge';
import { SavePlanButton } from '@/components/SavePlanButton';
import { HiddenMacroBlock } from '@/components/HiddenMacroValue';
import { HydrationCard } from '@/components/HydrationCard';
import type { UserGoal } from '@/lib/hydration-recommendations';

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
  const { playSuccessSound, triggerStartFeedback } = useSuccessSound();
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [todayMealsLogged, setTodayMealsLogged] = useState(0);
  
  // Metabolic calculations for TMB/TDEE display
  const metabolicData = useMetabolicCalculations(profile);

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
      // Fetch today's logged meals count
      await fetchTodayLogs(planId, data.length);
    }
  };

  const fetchTodayLogs = async (planId: string, totalMeals: number) => {
    const today = new Date().toISOString().split('T')[0];
    const { data: logData } = await supabase
      .from('daily_logs')
      .select(`
        meal_logs (id, status)
      `)
      .eq('diet_plan_id', planId)
      .eq('log_date', today)
      .single();

    if (logData?.meal_logs) {
      const logged = logData.meal_logs.filter((ml: any) => 
        ml.status && ml.status !== 'pending' && ml.status !== 'PENDENTE'
      ).length;
      setTodayMealsLogged(logged);
    } else {
      setTodayMealsLogged(0);
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
    triggerStartFeedback(); // Vibração rápida ao iniciar geração
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

      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2500);
      toast.success('Seu plano foi criado! Confira as opções de cada refeição.');
      playSuccessSound();
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
    triggerStartFeedback(); // Vibração rápida ao iniciar geração v5
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

      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2500);
      toast.success('Plano criado com sucesso! Verifique suas refeições. ✨');
      playSuccessSound();
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

    {/* Success Animation Overlay */}
    {showSuccessAnimation && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <SuccessAnimation show={showSuccessAnimation} message="Plano criado!" />
      </div>
    )}

    <div className="min-h-screen gradient-hero overflow-x-hidden theme-patient">
      {/* Header - Premium glass effect */}
      <header className="sticky top-0 z-50 glass border-b border-border/30">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <MobileNav />
            <Logo />
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 gradient-primary text-primary-foreground text-xs font-medium rounded-full shadow-sm">
                <Shield className="w-3 h-3" />
                Admin
              </span>
            )}
            {/* Badge Plano Gratuito - exibido para usuários gratuitos não-admin */}
            {!isAdmin && subscriptionPlan?.type === 'gratuito' && (
              <FreePlanBadge label="Plano Gratuito" className="hidden sm:inline-flex" />
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
                  
                  {/* Assinatura - Profissional não vê (já gerencia no painel), Aluno vinculado não vê (gerenciado pelo profissional), Gratuito não vê (já tem badge clicável) */}
                  {!isProfessional && !isLinkedStudent && subscriptionPlan?.type !== 'gratuito' && (
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


        {/* Welcome Section - Premium typography */}
        <FadeInView direction="up">
          <section className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-sans font-bold text-foreground tracking-tight">
              Olá, {profile?.name?.split(' ')[0] || 'Usuário'}! 👋
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground font-light">
              {profile?.goal
                ? `Objetivo: ${GOALS[profile.goal as keyof typeof GOALS]?.label}`
                : 'Acompanhe seu plano alimentar personalizado'}
            </p>
          </section>
        </FadeInView>

        {/* Metabolic Base + Hydration - Using MetricCard from UI Kit */}
        {metabolicData && (
          <FadeInView delay={0.05} direction="up">
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <MetricCard
                        label="Taxa Metabólica Basal"
                        value={metabolicData.bmr}
                        unit="kcal"
                        icon={<Flame className="h-4 w-4" />}
                        color="calories"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] p-3">
                    <p className="font-semibold mb-1">TMB - Taxa Metabólica Basal</p>
                    <p className="text-sm">Calorias que seu corpo queima em repouso para manter funções vitais.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <MetricCard
                        label="Gasto Energético Total"
                        value={metabolicData.tdee}
                        unit="kcal"
                        icon={<Target className="h-4 w-4" />}
                        color="success"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] p-3">
                    <p className="font-semibold mb-1">TDEE - Gasto Energético Total</p>
                    <p className="text-sm">Total de calorias que você gasta por dia, incluindo atividades físicas.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <HydrationCard 
                        weight={profile?.weight} 
                        goal={(profile?.goal as UserGoal) || 'maintain'}
                        variant="metric"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[300px] p-3">
                    <p className="font-semibold mb-1">💧 Hidratação Personalizada</p>
                    <p className="text-sm mb-2">
                      Calculado com base no seu peso ({profile?.weight || 70}kg × 35ml) 
                      {profile?.goal === 'lose_weight' && ' + 15% para metabolismo.'}
                      {profile?.goal === 'gain_muscle' && ' + 20% para recuperação.'}
                      {profile?.goal === 'maintain' && ' para equilíbrio hídrico.'}
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      Ajuste conforme atividade física e clima.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </FadeInView>
        )}

        {/* Stats Cards + Goals - Reorganized layout */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3 sm:space-y-4"
        >

          {/* Calorie & Macros Row - Using NutritionCard */}
          <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
            {/* Calorie Card */}
            <NutritionCard
              variant="metric"
              title="Calorias"
              icon={<Flame className="w-4 h-4 sm:w-5 sm:h-5" />}
              className="flex flex-col items-center"
            >
              <CalorieRing
                current={currentCalories}
                target={profile?.daily_calories || 2000}
              />
            </NutritionCard>

            {/* Macros Card */}
            <NutritionCard
              variant="metric"
              title="Macronutrientes"
              icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
            >
              <MacroChart
                protein={currentProtein}
                carbs={currentCarbs}
                fat={currentFat}
                proteinTarget={profile?.protein_target || 150}
                carbsTarget={profile?.carbs_target || 250}
                fatTarget={profile?.fat_target || 65}
              />
            </NutritionCard>
          </div>


        </motion.section>

        {/* Daily Log CTA - only for paid users with a plan */}
        {currentDietPlan && subscriptionPlan && subscriptionPlan.type !== 'gratuito' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <DailyLogCTA 
              mealsLogged={todayMealsLogged}
              totalMeals={meals.length}
            />
          </motion.section>
        )}

        {/* Gamification Section - show preview for free users, full for paid */}
        {currentDietPlan && subscriptionPlan && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            {subscriptionPlan.type === 'gratuito' ? (
              <GamificationPreview isLocked={true} />
            ) : (
              <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-2"> 
                <AdherenceStreak />
                <WeeklyAdherenceChart />
              </div>
            )}
          </motion.section>
        )}

        {/* Supplement Toggle - visible for users with a plan, locked for free users */}
        {currentDietPlan && !isLinkedStudent && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
          >
            <SupplementToggle 
              initialValue={(profile as any)?.include_supplements || false}
              compact
              locked={subscriptionPlan?.type === 'gratuito'}
            />
          </motion.section>
        )}

        {permissions.can_create_plan && !isLinkedStudent && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="grid grid-cols-2 gap-3">
              {/* Botão Gerar Plano Alimentar com limite inline */}
              <Button
                variant="premium"
                size="default"
                className="w-full"
                onClick={generateMealPlanV5}
                disabled={generating || generatingV5 || isLimitReached('diet')}
              >
                {generatingV5 ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="hidden sm:inline">Gerando...</span>
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      Gerar Plano {usage && !usage.diets.isUnlimited && `(${usage.diets.remaining}/${usage.diets.limit})`}
                    </span>
                    <span className="sm:hidden">
                      Gerar {usage && !usage.diets.isUnlimited && `(${usage.diets.remaining})`}
                    </span>
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
                    usageInfo={usage?.adjustments}
                    isLimitReached={isLimitReached('adjustment')}
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
              <h2 className="text-lg sm:text-xl font-sans font-semibold text-foreground tracking-tight">
                Plano de Hoje
              </h2>
              <div className="flex items-center gap-2">
                {/* View full plan button - disabled if not saved */}
                {currentDietPlan.is_saved ? (
                  <Link to="/meal-plan">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">Ver Plano Completo</span>
                      <span className="sm:hidden">Plano</span>
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" className="gap-2 opacity-50 cursor-not-allowed" disabled>
                    <Lock className="h-4 w-4" />
                    <span className="hidden sm:inline">Ver Plano Completo</span>
                    <span className="sm:hidden">Plano</span>
                  </Button>
                )}
                {/* Only show daily log button for paid users with saved plan */}
                {subscriptionPlan && subscriptionPlan.type !== 'gratuito' && currentDietPlan.is_saved && (
                  <Link to="/daily-log">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ClipboardCheck className="h-4 w-4" />
                      <span className="hidden sm:inline">Registrar consumo</span>
                      <span className="sm:hidden">Registrar</span>
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            
            {/* Save Plan CTA - show prominently when plan is not saved */}
            {!currentDietPlan.is_saved && !isLinkedStudent && (
              <SavePlanButton 
                planId={currentDietPlan.id}
                isSaved={currentDietPlan.is_saved}
                onSave={fetchCurrentPlan}
              />
            )}
            <div className="space-y-3">
              {meals.map((meal, index) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <MealCard
                    mealName={MEAL_NAMES[meal.name as MealType] || meal.name}
                    calories={currentDietPlan.is_saved ? meal.total_calories || 0 : undefined}
                    status="pending"
                    optionsCount={permissions.meal_options_limit > 1 ? permissions.meal_options_limit : undefined}
                    onClick={() => navigate(`/meal/${meal.id}`)}
                  >
                    {currentDietPlan.is_saved && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                        <span className="text-protein font-medium">{meal.total_protein?.toFixed(0) || 0}g prot</span>
                        <span className="text-carbs font-medium">{meal.total_carbs?.toFixed(0) || 0}g carb</span>
                        <span className="text-fat font-medium">{meal.total_fat?.toFixed(0) || 0}g gord</span>
                      </div>
                    )}
                    {!currentDietPlan.is_saved && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Lock className="w-3 h-3" />
                        <span>Salve o plano para ver os detalhes</span>
                      </div>
                    )}
                  </MealCard>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <EmptyPlanState
              onGeneratePlan={generateMealPlanV5}
              isGenerating={generating || generatingV5}
              isLinkedStudent={isLinkedStudent}
            />
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

      </div>
    </>
  );
}
