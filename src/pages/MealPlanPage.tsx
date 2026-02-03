import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Printer, 
  Share2, 
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
  AlertTriangle,
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
      '🥩 Distribua proteínas ao longo do dia (0.3-0.5g/kg por refeição)',
      '🍚 Carboidratos complexos são seus aliados para energia',
      '⏱️ Consuma proteína nas 2 horas pós-treino',
      '🥜 Gorduras saudáveis ajudam na produção hormonal',
      '💤 Sono de qualidade é essencial para recuperação',
      '📈 Aumente calorias gradualmente (+200-300 kcal/semana)',
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
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [planTotals, setPlanTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});
  const [supplementsEnabled, setSupplementsEnabled] = useState(profile?.include_supplements ?? false);
  const [togglingSupplements, setTogglingSupplements] = useState(false);

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
        .select('id, total_calories, total_protein, total_carbs, total_fat')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

      if (planError || !plan) {
        toast.error('Nenhum plano alimentar ativo encontrado');
        setLoading(false);
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

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Meu Plano Alimentar - NutriAI',
          text: `Confira meu plano alimentar personalizado!`,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy URL
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copiado para a área de transferência!');
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
    <div className="min-h-screen bg-background">
      {/* Header - hide on print */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border print:hidden">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <MobileNav />
          <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">Plano Alimentar Completo</h1>
            <p className="text-sm text-muted-foreground">Objetivo: {goalText}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Compartilhar
            </Button>
            <Button variant="default" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
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
        {/* Summary Card */}
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="w-5 h-5 text-primary" />
              Resumo Diário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Flame className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <p className="text-2xl font-bold">{planTotals.calories}</p>
                <p className="text-xs text-muted-foreground">Calorias</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Beef className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">{planTotals.protein}g</p>
                <p className="text-xs text-muted-foreground">Proteína</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Wheat className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-2xl font-bold">{planTotals.carbs}g</p>
                <p className="text-xs text-muted-foreground">Carboidratos</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/60">
                <Droplets className="w-5 h-5 mx-auto mb-1 text-orange-500" />
                <p className="text-2xl font-bold">{planTotals.fat}g</p>
                <p className="text-xs text-muted-foreground">Gordura</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                            
                            {/* Macros summary */}
                            <div className="flex flex-wrap gap-2 mb-3 text-xs">
                              <Badge variant="outline" className="bg-blue-500/10 text-[10px]">
                                P: {option.total_protein || 0}g
                              </Badge>
                              <Badge variant="outline" className="bg-yellow-500/10 text-[10px]">
                                C: {option.total_carbs || 0}g
                              </Badge>
                              <Badge variant="outline" className="bg-orange-500/10 text-[10px]">
                                G: {option.total_fat || 0}g
                              </Badge>
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
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <Label htmlFor="supplements-toggle" className="text-sm text-muted-foreground cursor-pointer">
                {supplementsEnabled ? 'Ativado' : 'Desativado'}
              </Label>
              <Switch
                id="supplements-toggle"
                checked={supplementsEnabled}
                onCheckedChange={handleToggleSupplements}
                disabled={togglingSupplements}
              />
            </div>
          </div>

          {supplementsEnabled ? (
            <div className="space-y-8">
              {/* 1. Substituições de refeições (alternativas completas) - PRIMEIRO */}
              {meals.length > 0 && (
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
              )}

              {/* 2. Suplementos de micronutrientes (não alteram macros) - DEPOIS */}
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

        {/* Tips Section */}
        <section className="print:break-before-page">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-semibold">{tips.title}</h2>
          </div>

          <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-3">
                {tips.tips.map((tip, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="p-3 rounded-lg bg-background/60 border border-border/50"
                  >
                    <p className="text-sm">{tip}</p>
                  </motion.div>
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

      {/* Print styles - Otimizado para 2 páginas A4 */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            font-size: 10px;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
          .print\\:break-before-page {
            break-before: page;
          }
          @page {
            margin: 0.8cm 1cm;
            size: A4;
          }
          /* Página 1: Plano alimentar - forçar quebra após */
          .print-page-1 {
            page-break-after: always;
          }
          /* Página 2: Suplementação e dicas */
          .print-page-2 {
            page-break-before: always;
          }
          /* Cards de refeição mais compactos */
          .grid {
            gap: 0.4rem !important;
          }
          /* Forçar 3 colunas para opções na impressão */
          [class*="grid-cols"] {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          /* Fontes menores para caber */
          .text-xl {
            font-size: 14px !important;
          }
          .text-lg {
            font-size: 12px !important;
          }
          .text-base {
            font-size: 11px !important;
          }
          .text-sm {
            font-size: 9px !important;
          }
          .text-xs {
            font-size: 8px !important;
          }
          .text-\\[10px\\], .text-\\[8px\\] {
            font-size: 7px !important;
          }
          /* Padding compacto */
          .p-4, .pt-6, .pt-4 {
            padding: 0.4rem !important;
          }
          .p-3, .py-3 {
            padding: 0.3rem !important;
          }
          .p-2, .py-2 {
            padding: 0.2rem !important;
          }
          /* Espaçamento reduzido */
          .space-y-4 > * + *, .space-y-3 > * + * {
            margin-top: 0.3rem !important;
          }
          .space-y-8 > * + * {
            margin-top: 0.6rem !important;
          }
          .space-y-2 > * + *, .space-y-1\\.5 > * + * {
            margin-top: 0.15rem !important;
          }
          .gap-4, .gap-3 {
            gap: 0.3rem !important;
          }
          .gap-2 {
            gap: 0.2rem !important;
          }
          .mb-4, .mb-3 {
            margin-bottom: 0.3rem !important;
          }
          /* Resumo diário compacto */
          .grid-cols-4, .md\\:grid-cols-4 {
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 0.25rem !important;
          }
          /* Cards de refeição */
          .rounded-lg {
            border-radius: 4px !important;
          }
          /* Badges menores */
          .rounded-full {
            padding: 0.1rem 0.3rem !important;
          }
          /* Ocultar elementos desnecessários na impressão */
          .print\\:hidden, button, [role="button"] {
            display: none !important;
          }
          /* Header da refeição */
          .w-8.h-8 {
            width: 1.25rem !important;
            height: 1.25rem !important;
          }
          .w-10.h-10 {
            width: 1.5rem !important;
            height: 1.5rem !important;
          }
          /* Collapsibles sempre abertos na impressão */
          [data-state="closed"] {
            display: block !important;
          }
          [data-state="closed"] > * {
            display: block !important;
            visibility: visible !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
