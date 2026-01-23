import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Scale, 
  Droplets, 
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

  // Calculate daily water intake recommendation (ml)
  const waterRecommendation = useMemo(() => {
    if (!profile?.weight) return 2000;
    const baseWater = profile.weight * 35;
    
    const activityMultiplier = {
      sedentary: 1,
      light: 1.1,
      moderate: 1.2,
      active: 1.3,
      very_active: 1.4,
    };
    
    const multiplier = activityMultiplier[profile.activity_level as keyof typeof activityMultiplier] || 1;
    return Math.round(baseWater * multiplier);
  }, [profile?.weight, profile?.activity_level]);

  const waterInLiters = (waterRecommendation / 1000).toFixed(1);
  const waterGlasses = Math.ceil(waterRecommendation / 250);

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
          {/* Header with Goal and Water */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Metas Diárias</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Water Intake Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/10 rounded-full">
                <Droplets className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-blue-500">{waterInLiters}L</span>
              </div>
              {/* Goal Badge */}
              <Badge variant="secondary" className="text-xs">
                {GOALS[profile.goal as keyof typeof GOALS]?.label || 'Meta'}
              </Badge>
            </div>
          </div>

          {/* Current Weight & Water Summary */}
          <div className="grid grid-cols-2 gap-3">
            {/* Weight */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="w-9 h-9 rounded-full bg-background flex items-center justify-center">
                {getGoalIcon()}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Peso atual</p>
                <p className="text-base font-bold">{formatWeight(profile.weight)} kg</p>
              </div>
            </div>

            {/* Water */}
            <div className="flex items-center gap-3 p-3 bg-blue-500/5 rounded-lg">
              <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Água diária</p>
                <p className="text-base font-bold text-blue-500">~{waterGlasses} copos</p>
              </div>
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
            *Projeção estimada. Beba {waterInLiters}L de água por dia para melhores resultados.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
