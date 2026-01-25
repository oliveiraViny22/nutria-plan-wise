import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Scale, 
  TrendingDown, 
  TrendingUp,
  Minus,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { GOALS } from '@/lib/types';

interface ScenarioProjection {
  label: string;
  extraKcal: number;
  projections: {
    days: number;
    weightChange: number;
  }[];
}

export function GoalsProjectionCard() {
  const { profile } = useAuth();

  // Calculate projections for different calorie scenarios
  const scenarios = useMemo((): ScenarioProjection[] => {
    if (!profile?.goal) return [];

    const goalConfig = GOALS[profile.goal as keyof typeof GOALS];
    const baseCalorieChange = goalConfig?.calorieAdjustment || 0;

    // 1kg of fat ≈ 7700 kcal
    const calculateProjections = (extraKcal: number) => {
      const dailyChange = baseCalorieChange + extraKcal;
      const kgPerDay = dailyChange / 7700;
      
      return [
        { days: 7, weightChange: kgPerDay * 7 },
        { days: 30, weightChange: kgPerDay * 30 },
        { days: 90, weightChange: kgPerDay * 90 },
      ];
    };

    return [
      { label: 'Plano Atual', extraKcal: 0, projections: calculateProjections(0) },
      { label: '+300 kcal', extraKcal: 300, projections: calculateProjections(300) },
      { label: '+500 kcal', extraKcal: 500, projections: calculateProjections(500) },
    ];
  }, [profile?.goal]);

  const getGoalIcon = () => {
    if (!profile?.goal) return <Minus className="w-4 h-4" />;
    switch (profile.goal) {
      case 'lose_weight':
        return <TrendingDown className="w-4 h-4 text-blue-500" />;
      case 'gain_muscle':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      default:
        return <Minus className="w-4 h-4 text-amber-500" />;
    }
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1).replace('.', ',')} kg`;
  };

  const getChangeColor = (change: number, goal: string) => {
    if (goal === 'lose_weight') {
      return change < 0 ? 'text-green-600' : 'text-red-500';
    }
    if (goal === 'gain_muscle') {
      return change > 0 ? 'text-green-600' : 'text-red-500';
    }
    return 'text-muted-foreground';
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
          {/* Header */}
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
              <p className="text-base font-bold">{profile.weight.toFixed(1).replace('.', ',')} kg</p>
            </div>
          </div>

          {/* Scenarios Grid */}
          <div className="space-y-3">
            {/* Header Row */}
            <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground">
              <div></div>
              <div className="text-center">7 dias</div>
              <div className="text-center">30 dias</div>
              <div className="text-center">90 dias</div>
            </div>

            {/* Scenario Rows */}
            {scenarios.map((scenario, idx) => (
              <div
                key={scenario.label}
                className={`grid grid-cols-4 gap-2 p-2 rounded-lg ${
                  idx === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center">
                  <span className={`text-xs font-medium ${idx === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                    {scenario.label}
                  </span>
                </div>
                {scenario.projections.map((proj) => (
                  <div key={proj.days} className="text-center">
                    <p className={`text-xs font-semibold ${getChangeColor(proj.weightChange, profile.goal!)}`}>
                      {formatChange(proj.weightChange)}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Methodology Alert */}
          <Alert className="bg-muted/30 border-muted">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-[10px] text-muted-foreground leading-relaxed">
              <strong>Estimativa baseada em:</strong> 1kg de gordura ≈ 7.700 kcal. O ajuste calórico do seu objetivo 
              ({GOALS[profile.goal as keyof typeof GOALS]?.calorieAdjustment > 0 ? '+' : ''}
              {GOALS[profile.goal as keyof typeof GOALS]?.calorieAdjustment} kcal/dia) é projetado linearmente. 
              Resultados reais variam conforme metabolismo, composição corporal e adesão ao plano.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </motion.div>
  );
}
