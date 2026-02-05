import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Flame, 
  Trophy,
  Star,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  startOfWeek, 
  format, 
  subDays,
  differenceInDays,
  parseISO,
  isToday,
  isYesterday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  lastLogDate: string | null;
  isActiveToday: boolean;
}

const STREAK_MILESTONES = [
  { days: 3, icon: Star, label: 'Iniciante', color: 'text-blue-500' },
  { days: 7, icon: Flame, label: 'Constante', color: 'text-orange-500' },
  { days: 14, icon: Sparkles, label: 'Dedicado', color: 'text-purple-500' },
  { days: 30, icon: Trophy, label: 'Campeão', color: 'text-amber-500' },
];

export function AdherenceStreak() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    fetchStreakData();
  }, [user]);

  const fetchStreakData = async () => {
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
      if (mealsPerDay === 0) {
        setLoading(false);
        return;
      }

      // Fetch last 90 days of logs to calculate streak
      const today = new Date();
      const ninetyDaysAgo = subDays(today, 90);

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
        .gte('log_date', format(ninetyDaysAgo, 'yyyy-MM-dd'))
        .order('log_date', { ascending: false });

      if (logsError) throw logsError;

      // Calculate streaks
      const adherenceThreshold = 0.7; // 70% das refeições confirmadas conta como dia aderente
      
      // Build a map of adherent days
      const adherentDays = new Set<string>();
      (logsData || []).forEach((log: any) => {
        if (!log.meal_logs || log.meal_logs.length === 0) return;
        
        let confirmed = 0;
        log.meal_logs.forEach((ml: any) => {
          const status = ml.status?.toLowerCase?.() || ml.status;
          if (status === 'confirmed' || status === 'late_confirmed' || 
              ml.status === 'CONFIRMADA' || ml.status === 'CONFIRMADA_TARDIA') {
            confirmed++;
          }
        });
        
        if (confirmed / mealsPerDay >= adherenceThreshold) {
          adherentDays.add(log.log_date);
        }
      });

      // Calculate current streak (consecutive days ending today or yesterday)
      let currentStreak = 0;
      let checkDate = today;
      const todayStr = format(today, 'yyyy-MM-dd');
      const isActiveToday = adherentDays.has(todayStr);
      
      // Se não registrou hoje, começa de ontem
      if (!isActiveToday) {
        checkDate = subDays(today, 1);
      }

      // Conta dias consecutivos
      while (adherentDays.has(format(checkDate, 'yyyy-MM-dd'))) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      }

      // Calculate best streak (scan all 90 days)
      let bestStreak = 0;
      let tempStreak = 0;
      
      for (let i = 0; i <= 90; i++) {
        const dayStr = format(subDays(today, i), 'yyyy-MM-dd');
        if (adherentDays.has(dayStr)) {
          tempStreak++;
          bestStreak = Math.max(bestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      // Get last log date
      const lastLog = logsData?.[0]?.log_date || null;

      setStreak({
        currentStreak,
        bestStreak,
        lastLogDate: lastLog,
        isActiveToday,
      });
    } catch (error) {
      console.error('Error fetching streak data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentMilestone = (days: number) => {
    // Retorna o milestone mais alto alcançado
    for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
      if (days >= STREAK_MILESTONES[i].days) {
        return STREAK_MILESTONES[i];
      }
    }
    return null;
  };

  const getNextMilestone = (days: number) => {
    return STREAK_MILESTONES.find(m => m.days > days);
  };

  if (loading) {
    return (
      <Card className="card-elevated">
        <CardContent className="py-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!hasPlan || !streak) {
    return null;
  }

  const currentMilestone = getCurrentMilestone(streak.currentStreak);
  const nextMilestone = getNextMilestone(streak.currentStreak);
  const daysToNextMilestone = nextMilestone ? nextMilestone.days - streak.currentStreak : 0;

  return (
    <Link to="/progress">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="cursor-pointer"
      >
        <Card className="card-elevated overflow-hidden h-full hover:border-primary/30 transition-colors">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              {/* Streak Fire Icon with bloom animation */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className={`
                  relative w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0
                  ${streak.currentStreak > 0 
                    ? 'bg-gradient-to-br from-primary to-primary/70 ring-celebrate' 
                    : 'bg-muted'
                  }
                `}
              >
                <Flame 
                  className={`w-7 h-7 ${streak.currentStreak > 0 ? 'text-white' : 'text-muted-foreground'}`} 
                />
                {streak.currentStreak > 0 && (
                  <motion.div
                    initial={{ scale: 0, rotate: -10 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-md"
                  >
                    <span className="text-xs font-bold text-primary counter-value">
                      {streak.currentStreak}
                    </span>
                  </motion.div>
                )}
              </motion.div>

              {/* Streak Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-semibold text-foreground text-sm">
                    {streak.currentStreak === 0 
                      ? 'Comece sua sequência!' 
                      : `${streak.currentStreak} ${streak.currentStreak === 1 ? 'dia' : 'dias'} seguidos`
                    }
                  </h3>
                  {currentMilestone && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${currentMilestone.color} bg-background/50`}
                    >
                      <currentMilestone.icon className="w-3 h-3 mr-1" />
                      {currentMilestone.label}
                    </Badge>
                  )}
                </div>

                {streak.currentStreak === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Registre suas refeições hoje para iniciar!
                  </p>
                ) : (
                  <div className="space-y-1">
                    {nextMilestone && (
                      <p className="text-xs text-muted-foreground">
                        Mais {daysToNextMilestone} {daysToNextMilestone === 1 ? 'dia' : 'dias'} para "{nextMilestone.label}"
                      </p>
                    )}
                    {streak.bestStreak > streak.currentStreak && (
                      <p className="text-xs text-muted-foreground">
                        Recorde: {streak.bestStreak} dias
                      </p>
                    )}
                  </div>
                )}

                {/* Today's status indicator */}
                {streak.currentStreak > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <div 
                      className={`
                        w-2 h-2 rounded-full 
                        ${streak.isActiveToday ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}
                      `} 
                    />
                    <span className="text-xs text-muted-foreground">
                      {streak.isActiveToday 
                        ? 'Ativo hoje!' 
                        : 'Registre hoje para manter a sequência'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
