import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { FadeInView } from '@/components/ui-kit';

import {
  DashboardHeader,
  DashboardWelcome,
  DashboardStats,
  DashboardGamification,
  DashboardActions,
  DashboardMeals,
  DashboardFooter,
  EnhancedQuickActions,
} from '@/components/dashboard';

import { UpgradeDialog } from '@/components/UpgradeDialog';
import { OnboardingTutorial } from '@/components/OnboardingTutorial';
import { DashboardSkeleton } from '@/components/DashboardSkeleton';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { CollapsibleMetrics } from '@/components/CollapsibleMetrics';
import { NutritionalValidationAlert } from '@/components/NutritionalValidationAlert';

import { useTutorial } from '@/hooks/useTutorial';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { useMetabolicCalculations } from '@/hooks/useMetabolicCalculations';
import { useNutritionalValidation } from '@/hooks/useNutritionalValidation';
import { supabase } from '@/integrations/supabase/client';
import { DietPlan, Meal } from '@/lib/types';
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
  const { playSuccessSound, triggerStartFeedback } = useSuccessSound();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [currentDietPlan, setCurrentDietPlan] = useState<DietPlan | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingV5, setGeneratingV5] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string>('diet');
  const [upgradeLimit, setUpgradeLimit] = useState<number>(0);
  const [planReleased, setPlanReleased] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [todayMealsLogged, setTodayMealsLogged] = useState(0);
  
  const metabolicData = useMetabolicCalculations(profile);
  const nutritionalValidation = useNutritionalValidation(profile);

  // Aplica as recomendações nutricionais calculadas
  const handleApplyRecommendations = async () => {
    if (!nutritionalValidation.recommendations) return;
    
    try {
      const { calories, protein, carbs, fat } = nutritionalValidation.recommendations;
      
      const { error } = await supabase
        .from('profiles')
        .update({
          daily_calories: calories,
          protein_target: protein,
          carbs_target: carbs,
          fat_target: fat,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', profile?.user_id);

      if (error) throw error;

      toast.success('Metas nutricionais atualizadas!', {
        description: `Calorias: ${calories} | P: ${protein}g | C: ${carbs}g | G: ${fat}g`
      });
      
      // Refresh page to update UI
      window.location.reload();
    } catch (error: any) {
      console.error('Error applying recommendations:', error);
      toast.error(error.message || 'Erro ao aplicar recomendações');
    }
  };

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

  const generateMealPlanV5 = async () => {
    if (!permissions.can_create_plan || isLimitReached('diet')) {
      setShowUpgradeDialog(true);
      setUpgradeFeature('diet');
      setUpgradeLimit(usage?.diets.limit || 0);
      toast.error(`Limite de dietas atingido (${usage?.diets.used}/${usage?.diets.limit})`);
      return;
    }

    setGeneratingV5(true);
    triggerStartFeedback();
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
        <DashboardHeader
          isAdmin={isAdmin}
          isProfessional={isProfessional}
          isLinkedStudent={isLinkedStudent}
          isSubscribed={isSubscribed}
          accountType={accountType}
          planType={subscriptionPlan?.type}
          onSignOut={handleSignOut}
        />

        {loading ? (
          <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-24">
            <DashboardSkeleton />
          </main>
        ) : (
          <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-20 sm:pb-24">
            <DashboardWelcome
              userName={profile?.name || undefined}
              goal={profile?.goal}
              isLinkedStudent={isLinkedStudent}
            />

            {/* Quick Actions Bar - Enhanced */}
            <EnhancedQuickActions
              hasPlan={!!currentDietPlan}
              isPlanSaved={currentDietPlan?.is_saved || false}
              pendingMeals={meals.length - todayMealsLogged}
              totalMeals={meals.length}
              isPaidUser={subscriptionPlan?.type !== 'gratuito'}
              canGeneratePlan={permissions.can_create_plan && !isLimitReached('diet')}
              canOptimize={permissions.can_adjust && !isLimitReached('adjustment')}
              isGenerating={generatingV5}
              onGeneratePlan={generateMealPlanV5}
            />

            {/* Metabolic Base + Hydration - Collapsible */}
            {metabolicData && (
              <FadeInView delay={0.05} direction="up">
                <CollapsibleMetrics
                  metabolicData={metabolicData}
                  weight={profile?.weight}
                  goal={profile?.goal}
                />
              </FadeInView>
            )}

            {/* Nutritional Validation Alert */}
            {nutritionalValidation.issues.length > 0 && (
              <FadeInView delay={0.1} direction="up">
                <NutritionalValidationAlert
                  validation={nutritionalValidation}
                  onApplyRecommendations={handleApplyRecommendations}
                  showApplyButton={!isLinkedStudent}
                />
              </FadeInView>
            )}

            <DashboardStats
              currentCalories={currentCalories}
              currentProtein={currentProtein}
              currentCarbs={currentCarbs}
              currentFat={currentFat}
              targetCalories={profile?.daily_calories || 2000}
              targetProtein={profile?.protein_target || 150}
              targetCarbs={profile?.carbs_target || 250}
              targetFat={profile?.fat_target || 65}
              tmb={metabolicData?.bmr}
              tdee={metabolicData?.tdee}
              goal={profile?.goal || undefined}
            />

            <DashboardGamification
              hasPlan={!!currentDietPlan}
              planType={subscriptionPlan?.type}
              mealsLogged={todayMealsLogged}
              totalMeals={meals.length}
            />

            <DashboardActions
              canCreatePlan={permissions.can_create_plan}
              canAdjust={permissions.can_adjust}
              isLinkedStudent={isLinkedStudent}
              hasPlan={!!currentDietPlan}
              planId={currentDietPlan?.id}
              generating={generating}
              generatingV5={generatingV5}
              isLimitReachedDiet={isLimitReached('diet')}
              isLimitReachedAdjustment={isLimitReached('adjustment')}
              usage={usage ? { diets: usage.diets, adjustments: usage.adjustments } : undefined}
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
              onGeneratePlan={generateMealPlanV5}
              onPlanOptimized={fetchCurrentPlan}
            />

            {/* Linked Student Lock Notice */}
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

            <DashboardMeals
              hasPlan={!!currentDietPlan}
              isPlanSaved={currentDietPlan?.is_saved || false}
              planId={currentDietPlan?.id}
              meals={meals}
              planType={subscriptionPlan?.type}
              isLinkedStudent={isLinkedStudent}
              planReleased={planReleased}
              mealOptionsLimit={permissions.meal_options_limit}
              generating={generating || generatingV5}
              includeSupplements={(profile as any)?.include_supplements || false}
              onGeneratePlan={generateMealPlanV5}
              onPlanSaved={fetchCurrentPlan}
            />

            <DashboardFooter onOpenTutorial={openTutorial} />
          </main>
        )}

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
