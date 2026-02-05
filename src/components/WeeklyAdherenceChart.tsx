import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProgressRing } from '@/components/ui-kit';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  startOfWeek, 
  endOfWeek, 
  format, 
  eachDayOfInterval, 
  isToday, 
  isFuture,
  isBefore,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DayData {
  date: Date;
  dateStr: string;
  mealsConfirmed: number;
  mealsSkipped: number;
  mealsOutOfPlan: number;
  totalMeals: number;
  status: 'complete' | 'partial' | 'empty' | 'future';
}

interface WeeklyStats {
  adherenceRate: number;
  totalConfirmed: number;
  totalMeals: number;
  days: DayData[];
}

export function WeeklyAdherenceChart() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    fetchWeeklyData();
  }, [user]);

  const fetchWeeklyData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get active diet plan
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
        setHasPlan(false);
        setLoading(false);
        return;
      }

      setHasPlan(true);

      // Get meals count for the plan
      const { data: mealsData } = await supabase
        .from('meals')
        .select('id')
        .eq('diet_plan_id', planData.id);

      const mealsPerDay = mealsData?.length || 0;

      // Calculate week range
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const daysOfWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

      // Fetch meal logs for the week
      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select(`
          id,
          log_date,
          meal_logs (
            id,
            status
          )
        `)
        .eq('user_id', user.id)
        .eq('diet_plan_id', planData.id)
        .gte('log_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('log_date', format(weekEnd, 'yyyy-MM-dd'));

      if (logsError) throw logsError;

      // Map logs by date
      const logsByDate: Record<string, any> = {};
      (logsData || []).forEach((log: any) => {
        logsByDate[log.log_date] = log;
      });

      // Build day data
      let totalConfirmed = 0;
      let totalMeals = 0;

      const days: DayData[] = daysOfWeek.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const log = logsByDate[dateStr];
        
        if (isFuture(date)) {
          return {
            date,
            dateStr,
            mealsConfirmed: 0,
            mealsSkipped: 0,
            mealsOutOfPlan: 0,
            totalMeals: mealsPerDay,
            status: 'future' as const,
          };
        }

        let confirmed = 0;
        let skipped = 0;
        let outOfPlan = 0;

        if (log?.meal_logs) {
          log.meal_logs.forEach((ml: any) => {
            const status = ml.status?.toLowerCase?.() || ml.status;
            if (status === 'confirmed' || status === 'late_confirmed' || 
                ml.status === 'CONFIRMADA' || ml.status === 'CONFIRMADA_TARDIA') {
              confirmed++;
            } else if (status === 'skipped' || ml.status === 'PULADA') {
              skipped++;
            } else if (status === 'out_of_plan' || ml.status === 'FORA_DO_PLANO') {
              outOfPlan++;
            }
          });
        }

        totalConfirmed += confirmed;
        totalMeals += mealsPerDay;

        let status: DayData['status'] = 'empty';
        if (confirmed + skipped + outOfPlan >= mealsPerDay) {
          status = 'complete';
        } else if (confirmed + skipped + outOfPlan > 0) {
          status = 'partial';
        }

        return {
          date,
          dateStr,
          mealsConfirmed: confirmed,
          mealsSkipped: skipped,
          mealsOutOfPlan: outOfPlan,
          totalMeals: mealsPerDay,
          status,
        };
      });

      const adherenceRate = totalMeals > 0 ? (totalConfirmed / totalMeals) * 100 : 0;

      setStats({
        adherenceRate,
        totalConfirmed,
        totalMeals,
        days,
      });
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAdherenceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-500';
    if (rate >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getAdherenceLabel = (rate: number) => {
    if (rate >= 80) return 'Excelente';
    if (rate >= 60) return 'Regular';
    if (rate > 0) return 'Precisa melhorar';
    return 'Sem dados';
  };

  const getDayBgColor = (day: DayData) => {
    if (day.status === 'future') return 'bg-muted/30';
    if (day.status === 'complete') return 'bg-green-500';
    if (day.status === 'partial') return 'bg-amber-500';
    return 'bg-muted';
  };

  const getDayLabel = (day: DayData) => {
    if (day.status === 'future') return 'Futuro';
    if (day.status === 'complete') return `${day.mealsConfirmed}/${day.totalMeals} confirmadas`;
    if (day.status === 'partial') return `${day.mealsConfirmed}/${day.totalMeals} confirmadas`;
    return 'Sem registros';
  };

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasPlan || !stats) {
    return null;
  }

  const getProgressRingColor = (rate: number): 'success' | 'warning' | 'destructive' | 'primary' => {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'warning';
    if (rate > 0) return 'destructive';
    return 'primary';
  };

  return (
    <Link to="/daily-log" className="block">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="cursor-pointer"
      >
        <Card className="card-elevated overflow-hidden hover:border-primary/30 transition-colors h-full">
          <CardContent className="py-4 space-y-3 sm:space-y-4 h-full flex flex-col">
            {/* Header with ProgressRing */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ProgressRing
                  value={stats.adherenceRate}
                  max={100}
                  size="md"
                  color={getProgressRingColor(stats.adherenceRate)}
                  showLabel
                  label={`${stats.adherenceRate.toFixed(0)}%`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Adesão Semanal</span>
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`text-xs mt-1 ${getAdherenceColor(stats.adherenceRate)}`}
                  >
                    {getAdherenceLabel(stats.adherenceRate)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Week Days Chart with growth animation */}
            <TooltipProvider delayDuration={100}>
              <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-16 sm:h-20 flex-shrink-0">
                {stats.days.map((day, index) => {
                  const height = day.status === 'future' 
                    ? 20 
                    : day.totalMeals > 0 
                      ? Math.max(20, ((day.mealsConfirmed + day.mealsSkipped + day.mealsOutOfPlan) / day.totalMeals) * 100)
                      : 20;
                  
                  return (
                    <Tooltip key={day.dateStr}>
                      <TooltipTrigger asChild>
                        <motion.div
                          initial={{ scaleY: 0, opacity: 0 }}
                          animate={{ scaleY: 1, opacity: 1 }}
                          transition={{ 
                            delay: index * 0.08, 
                            duration: 0.5,
                            type: 'spring',
                            stiffness: 100,
                            damping: 12
                          }}
                          style={{ 
                            height: `${height}%`,
                            transformOrigin: 'bottom'
                          }}
                          className={`
                            flex-1 rounded-t-md transition-all
                            ${getDayBgColor(day)}
                            ${isToday(day.date) ? 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse-success' : ''}
                          `}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-center">
                        <p className="font-medium">
                          {format(day.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getDayLabel(day)}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>

            {/* Day Labels */}
            <div className="flex justify-between text-xs text-muted-foreground">
              {stats.days.map((day) => (
                <span 
                  key={day.dateStr} 
                  className={`
                    flex-1 text-center
                    ${isToday(day.date) ? 'text-primary font-semibold' : ''}
                  `}
                >
                  {format(day.date, 'EEE', { locale: ptBR }).slice(0, 3)}
                </span>
              ))}
            </div>

            {/* Stats Summary */}
            <div className="flex items-center justify-between text-xs pt-2 border-t mt-auto">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="counter-value">{stats.totalConfirmed} confirmadas</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-primary">
                <span>Ver detalhes</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
