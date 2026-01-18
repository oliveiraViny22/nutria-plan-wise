import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronRight,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { startOfWeek, endOfWeek, format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeeklyStats {
  adherenceRate: number;
  mealsConfirmed: number;
  mealsSkipped: number;
  mealsOutOfPlan: number;
  totalMeals: number;
  daysLogged: number;
  totalDays: number;
}

export function AdherenceWidget() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    fetchWeeklyStats();
  }, [user]);

  const fetchWeeklyStats = async () => {
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

      // Calculate week range
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const totalDays = differenceInDays(now, weekStart) + 1;

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

      // Calculate stats
      let confirmed = 0;
      let skipped = 0;
      let outOfPlan = 0;
      let total = 0;
      const daysLogged = new Set<string>();

      (logsData || []).forEach((log: any) => {
        daysLogged.add(log.log_date);
        (log.meal_logs || []).forEach((ml: any) => {
          total++;
          if (ml.status === 'CONFIRMADA' || ml.status === 'CONFIRMADA_TARDIA') {
            confirmed++;
          } else if (ml.status === 'PULADA') {
            skipped++;
          } else if (ml.status === 'FORA_DO_PLANO') {
            outOfPlan++;
          }
        });
      });

      const adherenceRate = total > 0 ? (confirmed / total) * 100 : 0;

      setStats({
        adherenceRate,
        mealsConfirmed: confirmed,
        mealsSkipped: skipped,
        mealsOutOfPlan: outOfPlan,
        totalMeals: total,
        daysLogged: daysLogged.size,
        totalDays,
      });
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
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

  const getProgressColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-amber-500';
    return 'bg-red-500';
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

  if (!hasPlan) {
    return null; // Don't show widget if no active plan
  }

  if (!stats || stats.totalMeals === 0) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Adesão Semanal</p>
                <p className="text-xs text-muted-foreground">
                  Nenhum registro esta semana
                </p>
              </div>
            </div>
            <Link to="/daily-log">
              <Button variant="outline" size="sm">
                Registrar
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-elevated overflow-hidden">
        <CardContent className="py-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Adesão Semanal</span>
            </div>
            <Badge 
              variant="secondary" 
              className={`text-xs ${getAdherenceColor(stats.adherenceRate)}`}
            >
              {getAdherenceLabel(stats.adherenceRate)}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Taxa de adesão</span>
              <span className={`font-semibold ${getAdherenceColor(stats.adherenceRate)}`}>
                {stats.adherenceRate.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${stats.adherenceRate}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full rounded-full ${getProgressColor(stats.adherenceRate)}`}
              />
            </div>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-between text-xs pt-1">
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{stats.mealsConfirmed} confirmadas</span>
            </div>
            {stats.mealsSkipped > 0 && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                <span>{stats.mealsSkipped} puladas</span>
              </div>
            )}
            {stats.mealsOutOfPlan > 0 && (
              <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <XCircle className="h-3.5 w-3.5" />
                <span>{stats.mealsOutOfPlan} fora</span>
              </div>
            )}
          </div>

          {/* Footer Link */}
          <Link 
            to="/daily-log" 
            className="flex items-center justify-between pt-2 border-t text-xs text-primary hover:underline"
          >
            <span>Ver registro diário</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}
