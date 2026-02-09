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
  SkipForward,
  UtensilsCrossed,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatusBadge, SuccessCheckmark, ConfettiBurst } from '@/components/ui-kit';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SyncStatusBadge } from '@/components/SyncStatusIndicator';
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
import { useUserRole } from '@/hooks/useUserRole';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useOfflineSync } from '@/hooks/useOfflineSync';
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
  const { isProfessional, loading: roleLoading } = useUserRole();
  const { isLinkedStudent, loading: linkedStudentLoading } = useLinkedStudent();
  const { confirmMeal: offlineConfirmMeal, pendingCount, isSyncing } = useOfflineSync();

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
  
  // Success animation state
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);
  
  const isPaidUser = permissions.plan_name.toLowerCase() !== 'gratuito';
  const accessLoading = permissions.loading || roleLoading || linkedStudentLoading;
  const hasAccess = isPaidUser || isProfessional || isLinkedStudent;

  const isPastDate = isBefore(startOfDay(selectedDate), startOfDay(new Date()));
  const isReadOnly = isPastDate; // Past dates are read-only
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
        .maybeSingle();

      if (planError) {
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
              quantity_grams,
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
        .maybeSingle();

      if (logError) {
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
                quantity: mof.quantity_grams,
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

  // Block screen for free users (render-time, no flash)
  if (!accessLoading && !hasAccess) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden theme-patient">
        <header className="sticky top-0 z-50 glass border-b">
          <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <MobileNav />
              <Button variant="ghost" size="icon" className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Logo size="sm" />
            </div>
            <h1 className="text-base sm:text-lg font-semibold">Registro Diário</h1>
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg">
              <CardContent className="py-8 sm:py-12 px-6">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <UtensilsCrossed className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mb-3">Recurso Premium</h2>
                <p className="text-muted-foreground mb-6">
                  O registro de consumo está disponível para planos pagos e alunos vinculados.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => navigate('/pricing')} className="gap-2">
                    <UtensilsCrossed className="h-4 w-4" />
                    Ver Planos
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/dashboard')}>
                    Voltar ao Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  const handleConfirmMeal = async () => {
    if (!confirmingMeal || !selectedOption || !user) return;
    
    setConfirming(true);
    try {
      // Use offline-first confirmation
      const result = await offlineConfirmMeal(
        user.id,
        confirmingMeal.id,
        selectedOption,
        'confirmed',
        dateKey
      );

      // Show success animation
      setShowSuccessAnim(true);
      setTimeout(() => setShowSuccessAnim(false), 1500);

      toast({
        title: result.isOffline ? 'Salvo offline!' : 'Refeição confirmada!',
        description: result.isOffline 
          ? 'Será sincronizado quando reconectar.' 
          : 'Seu consumo foi registrado com sucesso.',
      });

      setConfirmingMeal(null);
      setSelectedOption('');
      
      // Only refetch if online sync succeeded
      if (!result.isOffline) {
        await fetchDailyData();
      }
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
    if (!exceptionMeal || !user) return;
    
    setConfirming(true);
    try {
      // Map exception status to v2 format
      const v2Status = exceptionStatus === 'PULADA' ? 'skipped' : 'out_of_plan';
      
      // Use offline-first confirmation
      const result = await offlineConfirmMeal(
        user.id,
        exceptionMeal.id,
        null,
        v2Status,
        dateKey
      );

      const statusLabel = exceptionStatus === 'PULADA' ? 'Refeição pulada' : 'Refeição fora do plano';
      toast({
        title: statusLabel,
        description: result.isOffline ? 'Salvo offline.' : 'O registro foi salvo.',
      });

      setExceptionMeal(null);
      setExceptionStatus('PULADA');
      setExceptionNotes('');
      
      if (!result.isOffline) {
        await fetchDailyData();
      }
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

  // Helper to check if a status is "confirmed" (supports both v2 and legacy formats)
  const isConfirmedStatus = (status?: string) => 
    ['confirmed', 'late_confirmed', 'CONFIRMADA', 'CONFIRMADA_TARDIA'].includes(status || '');
  
  const isSkippedStatus = (status?: string) => 
    ['skipped', 'PULADA'].includes(status || '');
  
  const isOutOfPlanStatus = (status?: string) => 
    ['out_of_plan', 'FORA_DO_PLANO'].includes(status || '');
  
  const isLateConfirmedStatus = (status?: string) => 
    ['late_confirmed', 'CONFIRMADA_TARDIA'].includes(status || '');
  
  const isPendingStatus = (status?: string) => 
    !status || ['pending', 'PENDENTE'].includes(status);

  const getStatusIcon = (status?: string) => {
    if (isConfirmedStatus(status)) {
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
    if (isSkippedStatus(status)) {
      return <SkipForward className="h-5 w-5 text-warning" />;
    }
    if (isOutOfPlanStatus(status)) {
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    }
    return <Clock className="h-5 w-5 text-muted-foreground" />;
  };

  // Map legacy/v2 status to UI Kit status types
  const mapStatusToUiKit = (status?: string): 'pending' | 'confirmed' | 'skipped' | 'out_of_plan' | 'late_confirmed' => {
    if (isLateConfirmedStatus(status)) return 'late_confirmed';
    if (isConfirmedStatus(status)) return 'confirmed';
    if (isSkippedStatus(status)) return 'skipped';
    if (isOutOfPlanStatus(status)) return 'out_of_plan';
    return 'pending';
  };

  const getStatusBadge = (status?: string) => {
    return <StatusBadge status={mapStatusToUiKit(status)} size="sm" />;
  };

  // Count completed meals (any status that is not pending)
  const completedMeals = meals.filter(m => !isPendingStatus(m.log?.status)).length;
  const progress = meals.length > 0 ? (completedMeals / meals.length) * 100 : 0;

  return (
    <>
      {/* Success Animation Overlay */}
      <AnimatePresence>
        {showSuccessAnim && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <div className="relative">
              <SuccessCheckmark show={showSuccessAnim} size="lg" />
              <ConfettiBurst show={showSuccessAnim} count={16} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
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
          <div className="flex items-center gap-1">
            <SyncStatusBadge />
            <ThemeToggle />
          </div>
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
                  {isReadOnly && (
                    <Badge variant="secondary" className="mt-1 text-xs gap-1 bg-muted">
                      <Clock className="h-3 w-3" />
                      Somente visualização
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
                  !isPendingStatus(meal.log?.status)
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
                    {/* Show confirmed option details if confirmed */}
                    {isConfirmedStatus(meal.log?.status) && meal.log?.confirmed_option_id && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-medium text-green-700 dark:text-green-400">
                            {meal.options.find(o => o.id === meal.log?.confirmed_option_id)?.name || `Opção ${meal.options.find(o => o.id === meal.log?.confirmed_option_id)?.option_number}`}
                          </p>
                          {isLateConfirmedStatus(meal.log?.status) && (
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
                    {isSkippedStatus(meal.log?.status) && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          Refeição pulada
                        </p>
                        {meal.log?.notes && (
                          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                            Obs: {meal.log.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {isOutOfPlanStatus(meal.log?.status) && (
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                        <p className="text-sm text-orange-700 dark:text-orange-400">
                          Comeu fora do plano
                        </p>
                        {meal.log?.notes && (
                          <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                            Obs: {meal.log.notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Options for pending meals - show all options directly (only for today) */}
                    {isPendingStatus(meal.log?.status) && !isReadOnly && (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Qual opção você consumiu?</p>
                        <div className="grid gap-2">
                          {meal.options.map((option) => (
                            <Button
                              key={option.id}
                              variant="outline"
                              className="h-auto p-3 justify-start text-left flex-col items-start hover:border-primary hover:bg-primary/5"
                              onClick={() => {
                                setConfirmingMeal(meal);
                                setSelectedOption(option.id);
                              }}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="font-medium text-sm">
                                  {option.name || `Opção ${option.option_number}`}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {option.total_calories} kcal
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                P: {option.total_protein}g • C: {option.total_carbs}g • G: {option.total_fat}g
                              </div>
                              {option.foods && option.foods.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1 truncate w-full">
                                  {option.foods.map(f => f.name).join(', ')}
                                </div>
                              )}
                            </Button>
                          ))}
                        </div>
                        
                        {/* Secondary action for not following the plan */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-foreground"
                          onClick={() => setExceptionMeal(meal)}
                        >
                          <SkipForward className="h-4 w-4 mr-2" />
                          Não segui o plano
                        </Button>
                      </div>
                    )}

                    {/* Read-only message for past dates with pending meals */}
                    {isPendingStatus(meal.log?.status) && isReadOnly && (
                      <div className="p-3 bg-muted/50 rounded-lg border text-center">
                        <p className="text-sm text-muted-foreground">
                          Não registrado neste dia
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Confirmation Dialog - simplified since option is pre-selected */}
      <Dialog open={!!confirmingMeal} onOpenChange={(open) => !open && setConfirmingMeal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              Confirmar refeição
            </DialogTitle>
            <DialogDescription>
              Confirme que você consumiu esta opção.
            </DialogDescription>
          </DialogHeader>

          {confirmingMeal && selectedOption && (
            <div className="space-y-4">
              {/* Show selected option details */}
              {(() => {
                const option = confirmingMeal.options.find(o => o.id === selectedOption);
                if (!option) return null;
                return (
                  <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">
                        {MEAL_NAMES[confirmingMeal.name as MealType] || confirmingMeal.name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {option.total_calories} kcal
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-primary mb-1">
                      {option.name || `Opção ${option.option_number}`}
                    </p>
                    <div className="text-xs text-muted-foreground mb-2">
                      P: {option.total_protein}g • C: {option.total_carbs}g • G: {option.total_fat}g
                    </div>
                    {option.foods && option.foods.length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                        {option.foods.map((food, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{food.name}</span>
                            <span>{food.quantity}g</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmingMeal(null); setSelectedOption(''); }}>
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
    </>
  );
}
