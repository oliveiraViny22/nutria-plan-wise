import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Scale, 
  TrendingDown, 
  TrendingUp,
  Minus,
  Calendar,
  Target,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { GOALS } from '@/lib/types';

interface ProjectionData {
  days: number;
  weightChange: number;
  projectedWeight: number;
}

export function GoalsProjectionCard() {
  const { profile } = useAuth();

  // Calculate projections based on goal and calorie deficit/surplus
  const projections = useMemo((): ProjectionData[] => {
    if (!profile?.weight || !profile?.goal) return [];

    const currentWeight = profile.weight;
    const goalConfig = GOALS[profile.goal as keyof typeof GOALS];
    const dailyCalorieChange = goalConfig?.calorieAdjustment || 0;

    // 1kg of fat ≈ 7700 kcal
    const kgPerDay = dailyCalorieChange / 7700;

    return [
      { days: 7, weightChange: kgPerDay * 7, projectedWeight: currentWeight + kgPerDay * 7 },
      { days: 30, weightChange: kgPerDay * 30, projectedWeight: currentWeight + kgPerDay * 30 },
      { days: 90, weightChange: kgPerDay * 90, projectedWeight: currentWeight + kgPerDay * 90 },
    ];
  }, [profile?.weight, profile?.goal]);


  const getGoalIcon = () => {
    if (!profile?.goal) return <Target className="w-4 h-4" />;
    switch (profile.goal) {
      case 'lose_weight':
        return <TrendingDown className="w-4 h-4 text-blue-500" />;
      case 'gain_muscle':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-amber-500" />;
    }
  };

  const getGoalColor = () => {
    if (!profile?.goal) return 'text-muted-foreground';
    switch (profile.goal) {
      case 'lose_weight':
        return 'text-blue-500';
      case 'gain_muscle':
        return 'text-green-500';
      default:
        return 'text-amber-500';
    }
  };

  const formatWeight = (weight: number) => {
    return weight.toFixed(1).replace('.', ',');
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1).replace('.', ',')} kg`;
  };

  if (!profile?.weight || !profile?.goal) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-elevated overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header with Goal */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Projeção de Peso</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {GOALS[profile.goal as keyof typeof GOALS]?.label || 'Meta'}
            </Badge>
          </div>

          {/* Current Weight */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-9 h-9 rounded-full bg-background flex items-center justify-center">
              {getGoalIcon()}
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Peso atual</p>
              <p className="text-base font-bold">{formatWeight(profile.weight)} kg</p>
            </div>
          </div>

          {/* Projections Grid */}
          <div className="grid grid-cols-3 gap-2">
            {projections.map((proj) => (
              <div
                key={proj.days}
                className="p-2.5 bg-muted/30 rounded-lg text-center space-y-0.5"
              >
                <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{proj.days}d</span>
                </div>
                <p className="text-sm font-semibold">
                  {formatWeight(proj.projectedWeight)} kg
                </p>
                <p className={`text-[10px] font-medium ${getGoalColor()}`}>
                  {formatChange(proj.weightChange)}
                </p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground text-center">
            *Projeção estimada baseada no seu objetivo e metabolismo.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
