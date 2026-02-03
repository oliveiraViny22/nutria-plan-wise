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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { MEAL_NAMES, MealType, Food, MealOption } from '@/lib/types';

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

export default function MealPlanPage() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [planTotals, setPlanTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({});

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

        {/* Meals Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Utensils className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Refeições do Dia</h2>
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
                      <Tabs defaultValue="1" className="w-full">
                        <TabsList className="grid w-full print:hidden" style={{ gridTemplateColumns: `repeat(${meal.meal_options.length}, 1fr)` }}>
                          {meal.meal_options.map(opt => (
                            <TabsTrigger key={opt.id} value={opt.option_number.toString()}>
                              Opção {opt.option_number}
                            </TabsTrigger>
                          ))}
                        </TabsList>

                        {meal.meal_options.map(option => (
                          <TabsContent key={option.id} value={option.option_number.toString()} className="print:!block print:!opacity-100">
                            {/* Print label for option */}
                            <div className="hidden print:block print:font-medium print:text-sm print:mb-2">
                              Opção {option.option_number}
                            </div>
                            
                            {/* Macros summary */}
                            <div className="flex flex-wrap gap-3 mb-3 text-xs">
                              <Badge variant="outline" className="bg-amber-500/10">
                                {option.total_calories || 0} kcal
                              </Badge>
                              <Badge variant="outline" className="bg-blue-500/10">
                                P: {option.total_protein || 0}g
                              </Badge>
                              <Badge variant="outline" className="bg-yellow-500/10">
                                C: {option.total_carbs || 0}g
                              </Badge>
                              <Badge variant="outline" className="bg-orange-500/10">
                                G: {option.total_fat || 0}g
                              </Badge>
                            </div>

                            {/* Foods list */}
                            <div className="space-y-2">
                              {option.meal_option_foods.map(mof => (
                                <div key={mof.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{mof.food.name}</span>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {mof.food.category}
                                    </Badge>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {formatQuantity(mof.quantity_grams, mof.display_quantity, mof.display_unit)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TabsContent>
                        ))}
                      </Tabs>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="print:hidden" />

        {/* Supplements Section */}
        <section className="print:break-before-page">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold">Suplementação Recomendada</h2>
          </div>

          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                As sugestões de suplementação são personalizadas com base no seu objetivo e podem ser 
                visualizadas em cada refeição. Abaixo está um resumo geral:
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Morning supplements */}
                <div className="p-4 rounded-lg bg-background/60 border border-border/50">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    🌅 Manhã
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Whey Protein (30g) - pós café da manhã</li>
                    <li>• Creatina Monohidratada (5g) - dose única</li>
                    <li>• Multivitamínico (1 cápsula)</li>
                  </ul>
                </div>

                {/* Afternoon supplements */}
                <div className="p-4 rounded-lg bg-background/60 border border-border/50">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    ☀️ Tarde
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Whey Protein (30g) - lanche da tarde</li>
                    <li>• BCAA (5g) - se treinar</li>
                  </ul>
                </div>

                {/* Evening supplements */}
                <div className="p-4 rounded-lg bg-background/60 border border-border/50">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    🌙 Noite
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Ômega-3 (1000mg) - com o jantar</li>
                    <li>• Zinco (15mg) - antes de dormir</li>
                    <li>• Magnésio (200mg) - antes de dormir</li>
                  </ul>
                </div>

                {/* Before sleep */}
                <div className="p-4 rounded-lg bg-background/60 border border-border/50">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    😴 Antes de Dormir
                  </h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Caseína (30g) - proteína de absorção lenta</li>
                    <li>• ZMA - para recuperação noturna</li>
                  </ul>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4 italic">
                ⚠️ Suplementos são opcionais e complementares à alimentação. 
                Consulte um profissional de saúde antes de iniciar qualquer suplementação.
              </p>
            </CardContent>
          </Card>
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

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
            margin: 1.5cm;
          }
        }
      `}</style>
    </div>
  );
}
