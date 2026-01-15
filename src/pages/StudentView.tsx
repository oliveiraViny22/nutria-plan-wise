import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  User,
  Target,
  Flame,
  Calendar,
  Utensils,
  TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroChart } from '@/components/MacroChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Profile, Meal, DietPlan, MEAL_NAMES, GOALS } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MealFood {
  id: string;
  quantity: number;
  food: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    serving_size: string;
  };
}

interface MealWithFoods extends Meal {
  meal_foods: MealFood[];
}

export default function StudentView() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isProfessional } = useUserRole();
  
  const [studentProfile, setStudentProfile] = useState<Profile | null>(null);
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
  const [meals, setMeals] = useState<MealWithFoods[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !user) return;

    const fetchStudentData = async () => {
      setLoading(true);
      try {
        // Verify professional has access to this student
        const { data: linkData, error: linkError } = await supabase
          .from('professional_students')
          .select('id')
          .eq('professional_id', user.id)
          .eq('student_id', studentId)
          .single();

        if (linkError || !linkData) {
          toast({
            variant: 'destructive',
            title: 'Acesso negado',
            description: 'Você não tem permissão para visualizar este aluno.',
          });
          navigate('/students');
          return;
        }

        // Fetch student profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', studentId)
          .single();

        if (profileError) throw profileError;
        setStudentProfile(profileData as Profile);

        // Fetch latest diet plan
        const { data: planData, error: planError } = await supabase
          .from('diet_plans')
          .select('*')
          .eq('user_id', studentId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (planError && planError.code !== 'PGRST116') {
          console.error('Error fetching diet plan:', planError);
        }

        if (planData) {
          setDietPlan(planData as DietPlan);

          // Fetch meals with foods
          const { data: mealsData, error: mealsError } = await supabase
            .from('meals')
            .select(`
              *,
              meal_foods (
                id,
                quantity,
                food:foods (
                  id,
                  name,
                  calories,
                  protein,
                  carbs,
                  fat,
                  serving_size
                )
              )
            `)
            .eq('diet_plan_id', planData.id)
            .order('created_at');

          if (mealsError) throw mealsError;
          setMeals((mealsData as MealWithFoods[]) || []);
        }
      } catch (error) {
        console.error('Error fetching student data:', error);
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível carregar os dados do aluno.',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [studentId, user, navigate]);

  if (!isProfessional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">
              Apenas profissionais podem visualizar dados de alunos.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!studentProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aluno não encontrado</h2>
            <Button onClick={() => navigate('/students')}>
              Voltar para Alunos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const goalLabel = studentProfile.goal 
    ? GOALS[studentProfile.goal as keyof typeof GOALS]?.label || studentProfile.goal 
    : 'Não definido';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/students')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-lg font-semibold truncate max-w-[200px]">
            {studentProfile.name || 'Aluno'}
          </h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Student Info */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-semibold text-primary">
                    {(studentProfile.name || 'A')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold">{studentProfile.name || 'Aluno'}</h2>
                  <p className="text-muted-foreground">{studentProfile.email}</p>
                </div>
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    <Target className="h-3 w-3" />
                    {goalLabel}
                  </Badge>
                  {studentProfile.daily_calories && (
                    <Badge variant="outline" className="gap-1">
                      <Flame className="h-3 w-3" />
                      {studentProfile.daily_calories} kcal/dia
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats */}
        {dietPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid md:grid-cols-2 gap-6"
          >
            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4 text-primary" />
                  Calorias do Plano
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CalorieRing
                  current={dietPlan.total_calories}
                  target={studentProfile.daily_calories || 2000}
                />
              </CardContent>
            </Card>

            <Card className="card-elevated">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Macronutrientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MacroChart
                  protein={dietPlan.total_protein}
                  carbs={dietPlan.total_carbs}
                  fat={dietPlan.total_fat}
                  proteinTarget={studentProfile.protein_target || 150}
                  carbsTarget={studentProfile.carbs_target || 250}
                  fatTarget={studentProfile.fat_target || 65}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Meals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Utensils className="h-5 w-5 text-primary" />
              Plano Alimentar
            </h2>
            {dietPlan && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(dietPlan.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            )}
          </div>

          {meals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Utensils className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum plano alimentar</h3>
                <p className="text-muted-foreground">
                  O aluno ainda não gerou um plano alimentar.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {meals.map((meal, index) => (
                <motion.div
                  key={meal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Card className="card-interactive">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{MEAL_NAMES[meal.name as keyof typeof MEAL_NAMES] || meal.name}</span>
                        <Badge variant="secondary">
                          {meal.total_calories || 0} kcal
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {meal.meal_foods?.map((mf) => (
                          <div key={mf.id} className="flex items-center justify-between text-sm">
                            <span>{mf.food.name}</span>
                            <span className="text-muted-foreground">
                              {mf.quantity}x {mf.food.serving_size}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-4 pt-3 border-t text-xs text-muted-foreground">
                        <span className="text-protein">P: {meal.total_protein?.toFixed(0) || 0}g</span>
                        <span className="text-carbs">C: {meal.total_carbs?.toFixed(0) || 0}g</span>
                        <span className="text-fat">G: {meal.total_fat?.toFixed(0) || 0}g</span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
