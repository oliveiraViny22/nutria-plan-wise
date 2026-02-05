import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, addDays, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  RefreshCw,
  SkipForward,
  UtensilsCrossed,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/ui-kit';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { toast } from '@/hooks/use-toast';
import { MEAL_NAMES, MealType } from '@/lib/types';

interface MealOption {
  id: string;
  meal_id: string;
  option_number: number;
  name: string | null;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  foods?: {
    id: string;
    name: string;
    quantity: number;
    serving_size: string;
  }[];
}

interface MealWithOptions {
  id: string;
  name: string;
  diet_plan_id: string;
  total_calories: number | null;
  total_protein: number | null;
  total_carbs: number | null;
  total_fat: number | null;
  options: MealOption[];
  log?: {
    id: string;
    status: string;
    confirmed_option_id: string | null;
    notes: string | null;
    confirmed_at: string | null;
  };
}

interface DailyLogData {
  id: string;
  log_date: string;
  status: string;
  total_calories_consumed: number | null;
  total_protein_consumed: number | null;
  total_carbs_consumed: number | null;
  total_fat_consumed: number | null;
}

type ExceptionStatus = 'PULADA' | 'FORA_DO_PLANO';

export default function DailyLog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const permissions = useAccountPermissions();
  
  // Redirect free users to dashboard
  useEffect(() => {
    if (!permissions.loading && permissions.plan_name === 'gratuito') {
      toast({
        title: 'Funcionalidade Premium',
        description: 'O registro de consumo está disponível apenas para planos pagos.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  }, [permissions.loading, permissions.plan_name, navigate]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<MealWithOptions[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLogData | null>(null);
  const [dietPlanId, setDietPlanId] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [confirmingMeal, setConfirmingMeal] = useState<MealWithOptions | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [confirming, setConfirming] = useState(false);
  
  // Exception dialog state
  const [exceptionMeal, setExceptionMeal] = useState<MealWithOptions | null>(null);
  const [exceptionStatus, setExceptionStatus] = useState<ExceptionStatus>('PULADA');
  const [exceptionNotes, setExceptionNotes] = useState('');
  
  const isLateConfirmation = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  const dateKey = format(selectedDate, 'yyyy-MM-dd');

  const fetchDailyData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch active diet plan
      const { data: planData, error: planError } = await supabase
        .from('diet_plans')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planError && planError.code !== 'PGRST116') {
        throw planError;
      }

      if (!planData) {
        setMeals([]);
        setDietPlanId(null);
        setLoading(false);
        return;
      }

      setDietPlanId(planData.id);

      // Fetch meals with options
      const { data: mealsData, error: mealsError } = await supabase
        .from('meals')
        .select(`
          id,
          name,
          diet_plan_id,
          total_calories,
          total_protein,
          total_carbs,
          total_fat,
          meal_options (
            id,
            meal_id,
            option_number,
            name,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            meal_option_foods (
              id,
              quantity,
              food:foods (
                id,
                name,
                serving_size
              )
            )
          )
        `)
        .eq('diet_plan_id', planData.id)
        .order('created_at');

      if (mealsError) throw mealsError;

      // Fetch daily log for selected date
      const { data: logData, error: logError } = await supabase
        .from('daily_logs')
        .select(`
          id,
          log_date,
          status,
          total_calories_consumed,
          total_protein_consumed,
          total_carbs_consumed,
          total_fat_consumed,
          meal_logs (
            id,
            meal_id,
            status,
            confirmed_option_id,
            notes,
            confirmed_at
          )
        `)
        .eq('user_id', user.id)
        .eq('log_date', dateKey)
        .single();

      if (logError && logError.code !== 'PGRST116') {
        console.error('Error fetching daily log:', logError);
      }

      // Process meals with options and logs
      const processedMeals: MealWithOptions[] = (mealsData || []).map((meal: any) => {
        const mealLog = logData?.meal_logs?.find((ml: any) => ml.meal_id === meal.id);
        
        return {
          id: meal.id,
          name: meal.name,
          diet_plan_id: meal.diet_plan_id,
          total_calories: meal.total_calories,
          total_protein: meal.total_protein,
          total_carbs: meal.total_carbs,
          total_fat: meal.total_fat,
          options: (meal.meal_options || [])
            .sort((a: MealOption, b: MealOption) => a.option_number - b.option_number)
            .map((opt: any) => ({
              ...opt,
              foods: opt.meal_option_foods?.map((mof: any) => ({
                id: mof.food?.id,
                name: mof.food?.name,
                quantity: mof.quantity,
                serving_size: mof.food?.serving_size,
              })) || [],
            })),
          log: mealLog ? {
            id: mealLog.id,
            status: mealLog.status,
            confirmed_option_id: mealLog.confirmed_option_id,
            notes: mealLog.notes,
            confirmed_at: mealLog.confirmed_at,
          } : undefined,
        };
      });

      setMeals(processedMeals);
      setDailyLog(logData ? {
        id: logData.id,
        log_date: logData.log_date,
        status: logData.status,
        total_calories_consumed: logData.total_calories_consumed,
        total_protein_consumed: logData.total_protein_consumed,
        total_carbs_consumed: logData.total_carbs_consumed,
        total_fat_consumed: logData.total_fat_consumed,
      } : null);
    } catch (error) {
      console.error('Error fetching daily data:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyData();
  }, [user, dateKey]);

  const handleConfirmMeal = async () => {
    if (!confirmingMeal || !selectedOption) return;
    
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-meal', {
        body: {
          mealId: confirmingMeal.id,
          optionId: selectedOption,
          status: 'CONFIRMADA',
          logDate: dateKey,
        },
      });

      if (error) throw error;

      toast({
        title: isLateConfirmation ? 'Refeição confirmada (atrasada)' : 'Refeição confirmada!',
        description: isLateConfirmation 
          ? 'O registro foi salvo como confirmação tardia.'
          : 'Seu consumo foi registrado com sucesso.',
      });

      setConfirmingMeal(null);
      setSelectedOption('');
      await fetchDailyData();
    } catch (error: any) {
      console.error('Error confirming meal:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível confirmar a refeição.',
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleExceptionConfirm = async () => {
    if (!exceptionMeal) return;
    
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('confirm-meal', {
        body: {
          mealId: exceptionMeal.id,
          optionId: null,
          status: exceptionStatus,
          logDate: dateKey,
          notes: exceptionNotes || undefined,
        },
      });

      if (error) throw error;

      const statusLabel = exceptionStatus === 'PULADA' ? 'Refeição pulada' : 'Refeição fora do plano';
      toast({
        title: statusLabel,
        description: 'O registro foi salvo.',
      });

      setExceptionMeal(null);
      setExceptionStatus('PULADA');
      setExceptionNotes('');
      await fetchDailyData();
    } catch (error: any) {
      console.error('Error registering exception:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível registrar a exceção.',
      });
    } finally {
      setConfirming(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'CONFIRMADA':
      case 'CONFIRMADA_TARDIA':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'PULADA':
        return <SkipForward className="h-5 w-5 text-warning" />;
      case 'FORA_DO_PLANO':
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  // Map legacy status to UI Kit status types
  const mapStatusToUiKit = (status?: string): 'pending' | 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed' => {
    switch (status) {
      case 'CONFIRMADA':
        return 'confirmed';
      case 'CONFIRMADA_TARDIA':
        return 'late_confirmed';
      case 'PULADA':
        return 'skipped';
      case 'FORA_DO_PLANO':
        return 'out_of_plan';
      default:
        return 'pending';
    }
  };

  const getStatusBadge = (status?: string) => {
    return <StatusBadge status={mapStatusToUiKit(status)} size="sm" />;
  };

  const completedMeals = meals.filter(m => m.log?.status && m.log.status !== 'PENDENTE').length;
  const progress = meals.length > 0 ? (completedMeals / meals.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background theme-patient">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b pt-safe">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Button 
              variant="ghost" 
              size="icon" 
              className="hidden md:flex h-9 w-9 sm:h-10 sm:w-10" 
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-sm sm:text-lg font-semibold">Registro Diário</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-safe">
        {/* Date Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold">
                      {isToday(selectedDate) 
                        ? 'Hoje' 
                        : format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                  {!isToday(selectedDate) && (
                    <p className="text-xs text-muted-foreground">
                      {format(selectedDate, 'dd/MM/yyyy')}
                    </p>
                  )}
                  {isLateConfirmation && (
                    <Badge variant="outline" className="mt-1 text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      Registro retroativo
                    </Badge>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                  disabled={isToday(selectedDate)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Summary */}
        {meals.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progresso do dia</span>
                  <span className="text-sm text-muted-foreground">
                    {completedMeals} de {meals.length} refeições
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                {dailyLog && (
                  <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                    <span>Consumido: {dailyLog.total_calories_consumed || 0} kcal</span>
                    <span>P: {dailyLog.total_protein_consumed?.toFixed(0) || 0}g</span>
                    <span>C: {dailyLog.total_carbs_consumed?.toFixed(0) || 0}g</span>
                    <span>G: {dailyLog.total_fat_consumed?.toFixed(0) || 0}g</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Meals List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !dietPlanId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sem plano ativo</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Você precisa de um plano alimentar ativo para registrar consumo.
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Ir para o Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : meals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sem refeições</h3>
              <p className="text-muted-foreground text-sm">
                Seu plano ainda não possui refeições configuradas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {meals.map((meal, index) => (
              <motion.div
                key={meal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
              >
                <Card className={`transition-colors ${
                  meal.log?.status && meal.log.status !== 'PENDENTE'
                    ? 'bg-muted/30 border-muted'
                    : 'hover:border-primary/50'
                }`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getStatusIcon(meal.log?.status)}
                        {MEAL_NAMES[meal.name as MealType] || meal.name}
                      </CardTitle>
                      {getStatusBadge(meal.log?.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Link to meal detail for substitutions */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-primary w-full justify-start -mt-1 mb-1"
                      onClick={() => navigate(`/meal/${meal.id}`)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Ver detalhes / Substituir alimentos
                    </Button>

                    {/* Show confirmed option details if confirmed */}
                    {meal.log?.status && ['CONFIRMADA', 'CONFIRMADA_TARDIA'].includes(meal.log.status) && meal.log.confirmed_option_id && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            {meal.options.find(o => o.id === meal.log?.confirmed_option_id)?.name || `Opção ${meal.options.find(o => o.id === meal.log?.confirmed_option_id)?.option_number}`}
                          </p>
                          {meal.log.status === 'CONFIRMADA_TARDIA' && (
                            <Badge variant="outline" className="text-[10px] h-5 border-amber-400 text-amber-600">
                              <Clock className="h-3 w-3 mr-0.5" />
                              Tardia
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-500">
                          {(() => {
                            const opt = meal.options.find(o => o.id === meal.log?.confirmed_option_id);
                            return opt ? `${opt.total_calories} kcal • P: ${opt.total_protein}g • C: ${opt.total_carbs}g • G: ${opt.total_fat}g` : '';
                          })()}
                        </div>
                        {/* Show foods in the confirmed option */}
                        {(() => {
                          const opt = meal.options.find(o => o.id === meal.log?.confirmed_option_id);
                          if (opt?.foods && opt.foods.length > 0) {
                            return (
                              <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                                <p className="text-[10px] text-green-600 dark:text-green-500 mb-1">Alimentos:</p>
                                <div className="flex flex-wrap gap-1">
                                  {opt.foods.map((food, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                                      {food.name} ({food.quantity}g)
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {meal.log.confirmed_at && (
                          <p className="text-[10px] text-green-500 dark:text-green-600 mt-2">
                            Confirmada às {format(new Date(meal.log.confirmed_at), 'HH:mm')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Show exception info if skipped or out of plan */}
                    {meal.log?.status === 'PULADA' && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          Refeição pulada
                        </p>
                        {meal.log.notes && (
                          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                            Obs: {meal.log.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {meal.log?.status === 'FORA_DO_PLANO' && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-700 dark:text-orange-400">
                          Comeu fora do plano
                        </p>
                        {meal.log.notes && (
                          <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                            Obs: {meal.log.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Action buttons for pending meals */}
                    {(!meal.log?.status || meal.log.status === 'PENDENTE') && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          className="flex-1"
                          onClick={() => {
                            setConfirmingMeal(meal);
                            if (meal.options.length === 1) {
                              setSelectedOption(meal.options[0].id);
                            }
                          }}
                          disabled={meal.options.length === 0}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Confirmar refeição
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setExceptionMeal(meal)}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Exceção
                        </Button>
                      </div>
                    )}

                    {/* Preview of options for pending meals */}
                    {(!meal.log?.status || meal.log.status === 'PENDENTE') && meal.options.length > 1 && (
                      <div className="text-xs text-muted-foreground">
                        {meal.options.length} opções disponíveis
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmingMeal} onOpenChange={(open) => !open && setConfirmingMeal(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              Confirmar {confirmingMeal && (MEAL_NAMES[confirmingMeal.name as MealType] || confirmingMeal.name)}
            </DialogTitle>
            <DialogDescription>
              {isLateConfirmation 
                ? 'Este é um registro retroativo. Selecione a opção que você consumiu.'
                : 'Selecione a opção que você está consumindo.'}
            </DialogDescription>
          </DialogHeader>

          {confirmingMeal && (
            <div className="space-y-4">
              {isLateConfirmation && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm text-amber-700 dark:text-amber-400">
                    Confirmação tardia para {format(selectedDate, 'dd/MM/yyyy')}
                  </span>
                </div>
              )}

              <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
                {confirmingMeal.options.map((option) => (
                  <div key={option.id} className="relative">
                    <RadioGroupItem
                      value={option.id}
                      id={option.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={option.id}
                      className="flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-colors peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          {option.name || `Opção ${option.option_number}`}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {option.total_calories} kcal
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        P: {option.total_protein}g • C: {option.total_carbs}g • G: {option.total_fat}g
                      </div>
                      {option.foods && option.foods.length > 0 && (
                        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                          {option.foods.map((food, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{food.name}</span>
                              <span>{food.quantity}x {food.serving_size}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingMeal(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmMeal} 
              disabled={!selectedOption || confirming}
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Confirmando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exception Dialog */}
      <AlertDialog open={!!exceptionMeal} onOpenChange={(open) => !open && setExceptionMeal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Registrar exceção
            </AlertDialogTitle>
            <AlertDialogDescription>
              {exceptionMeal && (MEAL_NAMES[exceptionMeal.name as MealType] || exceptionMeal.name)} - Escolha o tipo de exceção:
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <RadioGroup value={exceptionStatus} onValueChange={(v) => setExceptionStatus(v as ExceptionStatus)}>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="PULADA" id="pulada" />
                <Label htmlFor="pulada" className="flex-1 cursor-pointer">
                  <div className="font-medium flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-amber-500" />
                    Pulei esta refeição
                  </div>
                  <p className="text-xs text-muted-foreground">Não comi nada neste horário</p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="FORA_DO_PLANO" id="fora" />
                <Label htmlFor="fora" className="flex-1 cursor-pointer">
                  <div className="font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Comi fora do plano
                  </div>
                  <p className="text-xs text-muted-foreground">Comi algo diferente do planejado</p>
                </Label>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Ex: Evento social, viagem, não estava com fome..."
                value={exceptionNotes}
                onChange={(e) => setExceptionNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExceptionConfirm} disabled={confirming}>
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Confirmar exceção'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
