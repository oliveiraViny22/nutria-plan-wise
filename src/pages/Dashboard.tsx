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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroChart } from '@/components/MacroChart';
import { MacroRebalancer } from '@/components/MacroRebalancer';
import { UsageLimits } from '@/components/UsageLimits';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { BlockedActionCTA } from '@/components/BlockedActionCTA';
import { StudentRequestDialog } from '@/components/StudentRequestDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { supabase } from '@/integrations/supabase/client';
import { DietPlan, Meal, GOALS, MEAL_NAMES, MealType } from '@/lib/types';
import { toast } from 'sonner';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const { isProfessional, hasActiveLicense } = useUserRole();
  const { isLinkedStudent } = useLinkedStudent();
  const permissions = useAccountPermissions();
  const {
    refresh: refreshSubscription,
    currentPlan: subscriptionPlan,
    accountType,
    isSubscribed,
  } = useSubscription();
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
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  // Handle checkout success
  useEffect(() => {
    const checkoutStatus = searchParams.get('checkout');
    if (checkoutStatus === 'success') {
      toast.success('Assinatura ativada com sucesso! 🎉');
      refreshSubscription();
      // Clear the query param
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
        setPlanReleased(plan.released_to_student ?? false);
        await fetchMeals(plan.id);
      }
    } catch (error: any) {
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

  const generateMealPlan = async () => {
    // Verificar permissões antes de gerar
    if (!permissions.can_create_plan) {
      if (permissions.user_type === 'aluno' && permissions.is_linked_to_professional) {
        toast.error('Seu plano é gerenciado pelo seu nutricionista. Envie uma solicitação se precisar de mudanças.');
        setShowRequestDialog(true);
        return;
      }
      setShowUpgradeDialog(true);
      setUpgradeFeature('diet');
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
            goal: profile?.goal,
            meals_per_day: (profile as any)?.meals_per_day || 4,
          },
        },
      });

      if (response.error) throw response.error;

      toast.success('Plano alimentar gerado com sucesso!');
      await fetchCurrentPlan();
    } catch (error: any) {
      console.error('Error generating plan:', error);
      toast.error('Erro ao gerar plano alimentar');
    } finally {
      setGenerating(false);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-1">
            {(isSubscribed && accountType === 'professional') || (isProfessional && hasActiveLicense) ? (
              <>
                <Link to="/professional">
                  <Button variant="ghost" size="icon" title="Painel Profissional">
                    <LayoutDashboard className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/students">
                  <Button variant="ghost" size="icon" title="Gerenciar Alunos">
                    <Users className="w-5 h-5" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/become-professional">
                <Button variant="ghost" size="icon" title="Seja Profissional">
                  <Crown className="w-5 h-5" />
                </Button>
              </Link>
            )}
            <Link to="/subscription">
              <Button variant="ghost" size="icon">
                <CreditCard className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/progress">
              <Button variant="ghost" size="icon">
                <TrendingUp className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/chat">
              <Button variant="ghost" size="icon">
                <MessageCircle className="w-5 h-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Linked Student Read-Only Notice */}
        {isLinkedStudent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3"
          >
            <Eye className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Modo Visualização</p>
              <p className="text-xs text-muted-foreground">
                Seu plano alimentar é gerenciado pelo seu nutricionista.
              </p>
            </div>
          </motion.div>
        )}

        {/* Welcome Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {profile?.name?.split(' ')[0] || 'Usuário'}! 👋
          </h1>
          <p className="text-muted-foreground">
            {profile?.goal
              ? `Objetivo: ${GOALS[profile.goal as keyof typeof GOALS]?.label}`
              : 'Acompanhe seu plano alimentar'}
          </p>
        </motion.section>

        {/* Stats Cards */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {/* Calorie Card */}
          <div className="card-elevated rounded-2xl p-6 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Calorias</h3>
            </div>
            <CalorieRing
              current={currentCalories}
              target={profile?.daily_calories || 2000}
            />
          </div>

          {/* Macros Card */}
          <div className="card-elevated rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Macros</h3>
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
        </motion.section>

        {/* Action Buttons - com verificação de permissões */}
        {permissions.can_create_plan && !isLinkedStudent && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <Button
              variant="hero"
              size="lg"
              className="w-full"
              onClick={generateMealPlan}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando plano...
                </>
              ) : currentDietPlan ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Gerar novo plano
                </>
              ) : (
                <>
                  <UtensilsCrossed className="w-5 h-5" />
                  Gerar plano alimentar
                </>
              )}
            </Button>

            {/* Macro Rebalancer - apenas se pode editar */}
            {currentDietPlan && permissions.can_adjust && (
              <MacroRebalancer
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
                onComplete={fetchCurrentPlan}
              />
            )}
          </motion.section>
        )}

        {/* Bloqueio para alunos vinculados */}
        {isLinkedStudent && !planReleased && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <BlockedActionCTA
              action="editar seu plano alimentar"
              onRequestClick={() => setShowRequestDialog(true)}
            />
          </motion.section>
        )}

        {/* Meals Section */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isLinkedStudent && !planReleased ? (
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
            <h2 className="text-lg font-semibold text-foreground">
              Plano de Hoje
            </h2>
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
                    <div>
                      <h3 className="font-medium text-foreground">
                        {MEAL_NAMES[meal.name as MealType] || meal.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {meal.total_calories} kcal • P: {Math.round(meal.total_protein)}g • C:{' '}
                        {Math.round(meal.total_carbs)}g • G: {Math.round(meal.total_fat)}g
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
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

        {/* Usage Limits */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <UsageLimits />
        </motion.section>

        {/* Disclaimer */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-muted-foreground px-4 py-6"
        >
          Este aplicativo oferece educação nutricional e não substitui um
          profissional de saúde. Consulte um nutricionista para orientação
          personalizada.
        </motion.section>
      </main>

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        feature={upgradeFeature}
        currentPlan={subscriptionPlan?.name}
        limit={upgradeLimit}
      />

      {/* Student Request Dialog */}
      <StudentRequestDialog
        open={showRequestDialog}
        onOpenChange={setShowRequestDialog}
      />
    </div>
  );
}
