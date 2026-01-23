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
import { Progress } from '@/components/ui/progress';
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
  // General rule: 35ml per kg of body weight
  const waterRecommendation = useMemo(() => {
    if (!profile?.weight) return 2000; // Default 2L
    const baseWater = profile.weight * 35;
    
    // Adjust for activity level
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
  const waterGlasses = Math.ceil(waterRecommendation / 250); // 250ml per glass

  const getGoalIcon = () => {
    if (!profile?.goal) return <Target className="w-5 h-5" />;
    switch (profile.goal) {
      case 'lose_weight':
        return <TrendingDown className="w-5 h-5 text-blue-500" />;
      case 'gain_muscle':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      default:
        return <Minus className="w-5 h-5 text-amber-500" />;
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
      className="space-y-3"
    >
      {/* Weight Projection Card */}
      <Card className="card-elevated overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Projeção de Resultados</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {GOALS[profile.goal as keyof typeof GOALS]?.label || 'Meta'}
            </Badge>
          </div>

          {/* Current Weight */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center">
              {getGoalIcon()}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peso atual</p>
              <p className="text-lg font-bold">{formatWeight(profile.weight)} kg</p>
            </div>
          </div>

          {/* Projections Grid */}
          <div className="grid grid-cols-3 gap-2">
            {projections.map((proj) => (
              <div
                key={proj.days}
                className="p-3 bg-muted/30 rounded-lg text-center space-y-1"
              >
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{proj.days} dias</span>
                </div>
                <p className="text-sm font-semibold">
                  {formatWeight(proj.projectedWeight)} kg
                </p>
                <p className={`text-xs font-medium ${getGoalColor()}`}>
                  {formatChange(proj.weightChange)}
                </p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground text-center">
            *Projeção estimada baseada em déficit/superávit calórico. 
            Resultados reais podem variar.
          </p>
        </CardContent>
      </Card>

      {/* Water Intake Card */}
      <Card className="card-elevated overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            {/* Water Icon */}
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Droplets className="w-7 h-7 text-blue-500" />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Água Diária</span>
                <Badge variant="outline" className="text-xs text-blue-500 border-blue-500/30">
                  Recomendado
                </Badge>
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-500">{waterInLiters}L</span>
                <span className="text-sm text-muted-foreground">
                  (~{waterGlasses} copos de 250ml)
                </span>
              </div>

              {/* Visual Progress */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(waterGlasses, 12) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-4 rounded-sm bg-blue-500/20"
                    style={{
                      background: `linear-gradient(to top, hsl(var(--chart-1)) 100%, transparent 100%)`,
                    }}
                  />
                ))}
                {waterGlasses > 12 && (
                  <span className="text-xs text-muted-foreground ml-1">+{waterGlasses - 12}</span>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Baseado no seu peso ({profile.weight}kg) e nível de atividade
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
