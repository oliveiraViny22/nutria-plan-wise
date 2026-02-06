import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Utensils, 
  Pill, 
  Lightbulb,
  Target,
  Loader2,
  ChevronDown,
  ChevronUp,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Droplet,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCachedUserData } from '@/hooks/useCachedUserData';
import { toast } from 'sonner';
import { MEAL_NAMES, MealType, Food, MealOption } from '@/lib/types';
import { 
  generateSupplementRecommendations, 
  getPriorityBadge,
  type UserGoal,
  type SupplementPeriod,
  type Supplement,
  type NutritionalGaps,
} from '@/lib/supplement-recommendations';
import { MealReplacementSection } from '@/components/MealReplacementCard';
import { ProFeatureBadge } from '@/components/FeatureBadge';
import { SupplementsPreview } from '@/components/SupplementsPreview';
 import { MealPlanPdf } from '@/components/MealPlanPdf';
import { MetricCard, MacroBadge, FadeInView, AnimatedCounter } from '@/components/ui-kit';
import { calculateHydration, getHydrationLabel } from '@/lib/hydration-recommendations';

interface MealData {
  id: string;
  name: string;
  sort_order: number;
  meal_options: MealOptionData[];
}

interface MealOptionData {
  id: string;
  option_number: number;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  meal_option_foods: {
    id: string;
    quantity_grams: number;
    display_quantity: number | null;
    display_unit: string | null;
    food: Food;
  }[];
}

// Dicas nutricionais baseadas no objetivo
const NUTRITION_TIPS: Record<string, { title: string; tips: string[] }> = {
  'lose_weight': {
    title: 'Dicas para Emagrecimento',
    tips: [
      '🥗 Priorize proteínas em todas as refeições para manter a saciedade',
      '💧 Beba pelo menos 2L de água por dia, especialmente antes das refeições',
      '🥦 Vegetais de folhas verdes podem ser consumidos à vontade',
      '⏰ Evite comer nas 3 horas antes de dormir',
      '🚶 Combine a dieta com atividade física regular',
      '📏 Use pratos menores para controlar as porções naturalmente',
    ]
  },
  'maintain': {
    title: 'Dicas para Manutenção',
    tips: [
      '⚖️ Mantenha consistência nos horários das refeições',
      '🍎 Inclua variedade de frutas e vegetais coloridos',
      '💪 Proteínas são importantes para preservar massa muscular',
      '🧘 Pratique alimentação consciente, sem distrações',
      '📊 Monitore seu peso semanalmente para ajustes finos',
      '🎯 Flexibilidade: uma refeição livre por semana é aceitável',
    ]
  },
  'gain_muscle': {
    title: 'Dicas para Ganho de Massa',
    tips: [
      '🏋️ Treine com intensidade progressiva para estímulo muscular',
      '🍚 Carboidratos complexos são seus aliados para energia',
      '⏱️ Consuma proteína nas 2 horas pós-treino',
      '🥜 Gorduras saudáveis ajudam na produção hormonal',
      '💤 Sono de qualidade é essencial para recuperação',
      '📈 Mantenha o superávit calórico conforme seu plano',
    ]
  },
};

// Formatação de quantidade
function formatQuantity(grams: number, displayQty?: number | null, displayUnit?: string | null): string {
  if (displayQty && displayUnit) {
    return `${displayQty} ${displayUnit}`;
  }
  return `${Math.round(grams)}g`;
}

// Componente de suplementação personalizada
interface SupplementsContentProps {
  goal: UserGoal;
  planMacros: { calories: number; protein: number; carbs: number; fat: number };
  profileTargets: {
    daily_calories: number | null;
    protein_target: number | null;
    carbs_target: number | null;
    fat_target: number | null;
  };
}

function SupplementsContent({ goal, planMacros, profileTargets }: SupplementsContentProps) {
  const recommendations = useMemo(() => 
    generateSupplementRecommendations(goal, planMacros, profileTargets),
    [goal, planMacros, profileTargets]
  );

  const goalLabels: Record<UserGoal, string> = {
    lose_weight: 'Emagrecimento',
    maintain: 'Manutenção',
    gain_muscle: 'Ganho de Massa',
  };

  const hasGaps = recommendations.gapSupplements.length > 0;

  return (
    <div className="space-y-4">
      {/* Gaps Alert */}
      {hasGaps && (
        <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-sm mb-2">Gaps Nutricionais Detectados</h4>
                <div className="space-y-2">
                  {recommendations.gapSupplements.map((supp, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{supp.reason}</span>
                      <Badge variant="outline" className="ml-2 shrink-0">
                        {supp.name} ({supp.dosage})
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main recommendations */}
      <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium mb-1">Micronutrientes e Suporte</p>
              <p className="text-xs text-muted-foreground">
                Suplementos que <strong>não alteram</strong> calorias/macros do plano
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {goal === 'lose_weight' ? '🔥' : goal === 'gain_muscle' ? '💪' : '⚖️'} {goalLabels[goal]}
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {recommendations.periods.map((period, pIdx) => (
              <div key={pIdx} className="p-4 rounded-lg bg-background/60 border border-border/50">
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  {period.emoji} {period.period}
                </h4>
                <ul className="space-y-2">
                  {period.supplements.map((supp, sIdx) => {
                    const badge = getPriorityBadge(supp.priority);
                    return (
                      <li key={sIdx} className="text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-medium">{supp.name}</span>
                            <span className="text-muted-foreground"> ({supp.dosage})</span>
                          </div>
                          <Badge variant={badge.variant} className="text-[10px] shrink-0">
                            {badge.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {supp.timing} • {supp.reason}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4 italic">
            ⚠️ Suplementos são opcionais e complementares à alimentação. 
            Consulte um profissional de saúde antes de iniciar qualquer suplementação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MealPlanPage() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const { planInfo } = useCachedUserData();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [planTotals, setPlanTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const [supplementsEnabled, setSupplementsEnabled] = useState(profile?.include_supplements ?? false);
  const [togglingSupplements, setTogglingSupplements] = useState(false);
  
  // Check if user is on free plan - supplements feature is locked
  const isFreePlan = planInfo?.plan_type === 'gratuito';

  // Sync local state with profile
  useEffect(() => {
    setSupplementsEnabled(profile?.include_supplements ?? false);
  }, [profile?.include_supplements]);

  const handleToggleSupplements = async (checked: boolean) => {
    if (!user) return;
    
    setTogglingSupplements(true);
    setSupplementsEnabled(checked);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ include_supplements: checked })
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Refresh profile to sync state
      await refreshProfile?.();
      
      toast.success(checked ? 'Suplementação ativada' : 'Suplementação desativada');
    } catch (error) {
      console.error('Error toggling supplements:', error);
      setSupplementsEnabled(!checked); // Revert on error
      toast.error('Erro ao alterar configuração');
    } finally {
      setTogglingSupplements(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMealPlan();
    }
  }, [user]);

  const fetchMealPlan = async () => {
    try {
      // Get active diet plan
      const { data: plan, error: planError } = await supabase
        .from('diet_plans')
        .select('id, total_calories, total_protein, total_carbs, total_fat, is_saved')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

      if (planError || !plan) {
        toast.error('Nenhum plano alimentar ativo encontrado');
        setLoading(false);
        return;
      }

      // Redirect to dashboard if plan is not saved (gate protection)
      if (!plan.is_saved) {
        toast.error('Salve o plano primeiro para ver o plano completo');
        navigate('/');
        return;
      }

      setPlanTotals({
        calories: plan.total_calories || 0,
        protein: plan.total_protein || 0,
        carbs: plan.total_carbs || 0,
        fat: plan.total_fat || 0,
      });

      // Get meals with options and foods
      const { data: mealsData, error: mealsError } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          sort_order,
          meal_options (
            id,
            option_number,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            meal_option_foods (
              id,
              quantity_grams,
              display_quantity,
              display_unit,
              food:foods (*)
            )
          )
        `)
        .eq('diet_plan_id', plan.id)
        .order('sort_order');

      if (mealsError) throw mealsError;

      setMeals(mealsData as MealData[] || []);
      
      // Expand all meals by default
      const expanded: Record<string, boolean> = {};
      (mealsData || []).forEach(m => { expanded[m.id] = true; });
      setExpandedMeals(expanded);
      
    } catch (error) {
      console.error('Error fetching meal plan:', error);
      toast.error('Erro ao carregar plano alimentar');
    } finally {
      setLoading(false);
    }
  };


  const toggleMeal = (mealId: string) => {
    setExpandedMeals(prev => ({ ...prev, [mealId]: !prev[mealId] }));
  };

  const goalText = profile?.goal === 'lose_weight' ? 'Emagrecimento' 
    : profile?.goal === 'maintain' ? 'Manutenção' 
    : 'Ganho de Massa';

  const tips = NUTRITION_TIPS[profile?.goal || 'maintain'];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background theme-patient">
      {/* Header - hide on print */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border print:hidden">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex w-9 h-9" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground text-sm sm:text-base truncate">Plano Alimentar</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Objetivo: {goalText}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <MealPlanPdf />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Print Header - only visible on print */}
      <div className="hidden print:block print:mb-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <Logo size="md" showText={false} />
            <div>
              <h1 className="text-xl font-bold">NutriAI - Plano Alimentar</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.name || 'Usuário'} • Objetivo: {goalText}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-8 print:py-2">
        {/* Summary Card - Using UI Kit */}
        <FadeInView direction="up">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="w-5 h-5 text-primary" />
                Resumo Diário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Grid 5 colunas no desktop, 2 no mobile - compacto para PDF */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:grid-cols-5 print:gap-2">
                <MetricCard
                  label="Calorias"
                  value={planTotals.calories}
                  unit="kcal"
                  icon={<Flame className="h-4 w-4" />}
                  color="calories"
                />
                <MetricCard
                  label="Proteína"
                  value={planTotals.protein}
                  unit="g"
                  icon={<Beef className="h-4 w-4" />}
                  color="protein"
                />
                <MetricCard
                  label="Carboidratos"
                  value={planTotals.carbs}
                  unit="g"
                  icon={<Wheat className="h-4 w-4" />}
                  color="carbs"
                />
                <MetricCard
                  label="Gordura"
                  value={planTotals.fat}
                  unit="g"
                  icon={<Droplets className="h-4 w-4" />}
                  color="fat"
                />
                {/* Hydration Card */}
                <Card className="bg-gradient-to-br from-card to-muted/20 border-border/30 col-span-2 md:col-span-1 print:col-span-1">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg shrink-0 bg-sky-500/10 text-sky-500">
                        <Droplet className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground truncate">Hidratação</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold tabular-nums">
                            {calculateHydration(profile?.weight, (profile?.goal as UserGoal) || 'maintain').liters}
                          </span>
                          <span className="text-sm text-muted-foreground">L</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </FadeInView>

        {/* Meals Section - Página 1 do PDF */}
        <section className="print-page-1">
          <div className="flex items-center gap-2 mb-4">
            <Utensils className="w-5 h-5 text-primary print:w-4 print:h-4" />
            <h2 className="text-xl font-semibold print:text-lg">Refeições do Dia</h2>
          </div>

          <div className="space-y-4">
            {meals.map((meal, idx) => (
              <Card key={meal.id} className="overflow-hidden print:break-inside-avoid">
                <Collapsible 
                  open={expandedMeals[meal.id]} 
                  onOpenChange={() => toggleMeal(meal.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 print:cursor-default">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                            {idx + 1}
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {MEAL_NAMES[meal.name as MealType] || meal.name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {meal.meal_options.length} {meal.meal_options.length === 1 ? 'opção' : 'opções'}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 print:hidden">
                          {expandedMeals[meal.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="print:!block">
                    <CardContent className="pt-0">
                      {/* Grid layout para exibir opções lado a lado */}
                      <div className={`grid gap-4 ${
                        meal.meal_options.length === 1 ? 'grid-cols-1' :
                        meal.meal_options.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      }`}>
                        {meal.meal_options.map(option => (
                          <div key={option.id} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                            {/* Header da opção */}
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-medium text-sm">Opção {option.option_number}</span>
                              <Badge variant="outline" className="text-[10px] bg-primary/10">
                                {option.total_calories || 0} kcal
                              </Badge>
                            </div>
                            
                            {/* Macros summary - Using MacroBadge from UI Kit */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <MacroBadge macro="protein" value={option.total_protein || 0} size="sm" variant="pill" />
                              <MacroBadge macro="carbs" value={option.total_carbs || 0} size="sm" variant="pill" />
                              <MacroBadge macro="fat" value={option.total_fat || 0} size="sm" variant="pill" />
                            </div>

                            {/* Foods list */}
                            <div className="space-y-1.5">
                              {option.meal_option_foods.map(mof => (
                                <div key={mof.id} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                                  <span className="text-xs font-medium truncate flex-1 mr-2">{mof.food.name}</span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatQuantity(mof.quantity_grams, mof.display_quantity, mof.display_unit)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="print:hidden" />

        {/* Supplements Section - Página 2 do PDF */}
        <section className="print-page-2 print:break-before-page">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-purple-500 print:w-4 print:h-4" />
              <h2 className="text-xl font-semibold print:text-lg">Suplementação Recomendada</h2>
              {isFreePlan && <ProFeatureBadge />}
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {isFreePlan ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">Recurso Pro</span>
                </div>
              ) : (
                <>
                  <Label htmlFor="supplements-toggle" className="text-sm text-muted-foreground cursor-pointer">
                    {supplementsEnabled ? 'Ativado' : 'Desativado'}
                  </Label>
                  <Switch
                    id="supplements-toggle"
                    checked={supplementsEnabled}
                    onCheckedChange={handleToggleSupplements}
                    disabled={togglingSupplements}
                  />
                </>
              )}
            </div>
          </div>

          {isFreePlan ? (
            <SupplementsPreview isLocked={true} />
          ) : supplementsEnabled ? (
            <div className="space-y-8">
              {/* 1. Substituições de refeições - OCULTAS NA IMPRESSÃO (muito extensas) */}
              {meals.length > 0 && (
                <div className="print:hidden">
                  <MealReplacementSection
                    meals={meals.map(meal => {
                      const firstOption = meal.meal_options[0];
                      return {
                        name: MEAL_NAMES[meal.name as MealType] || meal.name,
                        macros: {
                          calories: firstOption?.total_calories || 0,
                          protein: firstOption?.total_protein || 0,
                          carbs: firstOption?.total_carbs || 0,
                          fat: firstOption?.total_fat || 0,
                        },
                      };
                    })}
                    userGoal={(profile?.goal as 'lose_weight' | 'maintain' | 'gain_muscle') || 'maintain'}
                  />
                </div>
              )}

              {/* 2. Suplementos de micronutrientes - VISÍVEL NA IMPRESSÃO */}
              <SupplementsContent 
                goal={(profile?.goal as UserGoal) || 'maintain'}
                planMacros={planTotals}
                profileTargets={{
                  daily_calories: profile?.daily_calories ?? null,
                  protein_target: profile?.protein_target ?? null,
                  carbs_target: profile?.carbs_target ?? null,
                  fat_target: profile?.fat_target ?? null,
                }}
              />
            </div>
          ) : (
            <Card className="border-muted bg-muted/5">
              <CardContent className="py-8 text-center">
                <Pill className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  Ative o toggle acima para ver recomendações de suplementação e substituições de refeição.
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        <Separator className="print:hidden" />

        {/* Tips Section - Mesmo na página 2, sem quebra adicional */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500 print:w-4 print:h-4" />
            <h2 className="text-xl font-semibold print:text-base">{tips.title}</h2>
          </div>

          <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
            <CardContent className="pt-4 print:pt-2">
              <div className="grid grid-cols-2 gap-2 print:gap-1">
                {tips.tips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-background/60 border border-border/50 print:p-1"
                  >
                    <p className="text-sm print:text-[9px]">{tip}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer for print */}
        <div className="hidden print:block print:mt-8 print:pt-4 print:border-t">
          <p className="text-xs text-center text-muted-foreground">
            Plano alimentar gerado por NutriAI • {new Date().toLocaleDateString('pt-BR')} • nutria-plan-wise.lovable.app
          </p>
        </div>
      </main>

      {/* Print styles - Layout compacto para 2 páginas A4 */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-size: 9px !important;
            line-height: 1.2 !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            margin: 0.6cm 0.8cm;
            size: A4;
          }
          
          /* ========== PÁGINA 1: Resumo + Refeições ========== */
          .print-page-1 {
            page-break-after: always !important;
          }
          
          /* ========== PÁGINA 2: Suplementação + Dicas ========== */
          .print-page-2 {
            page-break-before: always !important;
          }
          
          /* Ocultar elementos interativos */
          button, [role="button"], .print\\:hidden, 
          [data-radix-collection-item], header, nav {
            display: none !important;
          }
          
          /* Container principal */
          main {
            padding: 0 !important;
          }
          .container {
            max-width: 100% !important;
            padding: 0 !important;
          }
          
          /* Grid de opções: sempre 3 colunas */
          .grid {
            display: grid !important;
            gap: 0.25rem !important;
          }
          [class*="md\\:grid-cols-2"][class*="lg\\:grid-cols-3"],
          [class*="grid-cols-1"][class*="md\\:grid-cols-2"] {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .grid-cols-2, .md\\:grid-cols-2 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .grid-cols-4, .md\\:grid-cols-4 {
            grid-template-columns: repeat(4, 1fr) !important;
          }
          
          /* Tipografia compacta */
          .text-2xl { font-size: 14px !important; }
          .text-xl, .print\\:text-lg { font-size: 11px !important; }
          .text-lg, .print\\:text-base { font-size: 10px !important; }
          .text-base { font-size: 9px !important; }
          .text-sm, .print\\:text-\\[9px\\] { font-size: 8px !important; }
          .text-xs { font-size: 7px !important; }
          .text-\\[10px\\], .text-\\[8px\\] { font-size: 6px !important; }
          .font-bold { font-weight: 600 !important; }
          
          /* Espaçamentos mínimos */
          .p-4, .p-3, .pt-6, .pt-4 { padding: 0.2rem !important; }
          .p-2, .py-3, .py-2 { padding: 0.15rem !important; }
          .space-y-8 > * + * { margin-top: 0.4rem !important; }
          .space-y-4 > * + *, .space-y-3 > * + * { margin-top: 0.2rem !important; }
          .space-y-2 > * + *, .space-y-1\\.5 > * + * { margin-top: 0.1rem !important; }
          .gap-4, .gap-3 { gap: 0.2rem !important; }
          .gap-2 { gap: 0.15rem !important; }
          .mb-4, .mb-3, .mb-6 { margin-bottom: 0.2rem !important; }
          .mt-4 { margin-top: 0.2rem !important; }
          
          /* Cards compactos */
          .rounded-lg { border-radius: 3px !important; }
          .border { border-width: 0.5px !important; }
          
          /* Ícones menores */
          .w-5, .h-5 { width: 0.75rem !important; height: 0.75rem !important; }
          .w-4, .h-4, .print\\:w-4, .print\\:h-4 { width: 0.6rem !important; height: 0.6rem !important; }
          .w-8, .h-8 { width: 1rem !important; height: 1rem !important; }
          .w-10, .h-10 { width: 1.25rem !important; height: 1.25rem !important; }
          
          /* Collapsibles abertos */
          [data-state="closed"] > div { 
            display: block !important; 
            height: auto !important; 
          }
          
          /* Header de impressão */
          .print\\:block.print\\:mb-6 {
            margin-bottom: 0.3rem !important;
          }
          .print\\:block.print\\:mb-6 .pb-4 {
            padding-bottom: 0.2rem !important;
          }
          
          /* Footer compacto */
          .print\\:mt-8 {
            margin-top: 0.3rem !important;
          }
          .print\\:pt-4 {
            padding-top: 0.15rem !important;
          }
        }
      `}</style>
    </div>
  );
}
