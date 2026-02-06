import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Scale, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface WeightLog {
  weight_kg: number;
  log_date: string;
}

export function ProgressCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightChange, setWeightChange] = useState<number | null>(null);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    if (!user) return;
    
    async function fetchProgress() {
      try {
        // Get the last 30 days of weight logs
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: logs, error } = await supabase
          .from('weight_logs')
          .select('weight_kg, log_date')
          .eq('user_id', user.id)
          .gte('log_date', thirtyDaysAgo.toISOString().split('T')[0])
          .order('log_date', { ascending: false });

        if (error) throw error;

        if (logs && logs.length > 0) {
          setTotalLogs(logs.length);
          setCurrentWeight(logs[0].weight_kg);
          
          if (logs.length > 1) {
            const oldest = logs[logs.length - 1];
            const change = logs[0].weight_kg - oldest.weight_kg;
            setWeightChange(change);
          }
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [user]);

  const getTrendIcon = () => {
    if (weightChange === null || weightChange === 0) {
      return <Minus className="w-3 h-3" />;
    }
    return weightChange < 0 
      ? <TrendingDown className="w-3 h-3" />
      : <TrendingUp className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (weightChange === null || weightChange === 0) {
      return 'text-muted-foreground bg-muted';
    }
    // For weight loss goals, negative is good (green), positive is warning (amber)
    // This could be made dynamic based on user's goal
    return weightChange < 0 
      ? 'text-green-600 bg-green-500/10' 
      : 'text-amber-600 bg-amber-500/10';
  };

  const formatWeightChange = () => {
    if (weightChange === null) return '0kg';
    const sign = weightChange > 0 ? '+' : '';
    return `${sign}${weightChange.toFixed(1)}kg`;
  };

  return (
    <Link to="/progress">
      <Card className="card-elevated overflow-hidden h-full cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.01]">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-cyan-500 shadow-lg shadow-blue-500/20">
              <Scale className="w-7 h-7 text-white" />
              {totalLogs > 0 && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-blue-500 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-blue-500">{totalLogs}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">Progresso</h3>
                {weightChange !== null && (
                  <Badge variant="secondary" className={`text-xs ${getTrendColor()}`}>
                    {getTrendIcon()}
                    <span className="ml-1">{formatWeightChange()}</span>
                  </Badge>
                )}
              </div>
              {loading ? (
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              ) : currentWeight ? (
                <p className="text-xs text-muted-foreground">
                  Peso atual: <span className="font-medium text-foreground">{currentWeight.toFixed(1)}kg</span>
                  {totalLogs > 1 && ' • últimos 30 dias'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhum registro ainda
                </p>
              )}
              <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                <span>Ver evolução</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
