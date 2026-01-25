import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Scale, 
  TrendingDown, 
  TrendingUp,
  Minus,
  Info,
  Target,
  Flame,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { GOALS, ACTIVITY_LEVELS } from '@/lib/types';

interface ScenarioProjection {
  label: string;
  dailySurplus: number;
  projections: {
    days: number;
    weightChange: number;
    fatGain?: number; // % of weight gain that's fat
  }[];
  isRecommended?: boolean;
  description: string;
}

// Calculate BMR using Mifflin-St Jeor formula
function calculateBMR(weight: number, height: number, age: number, sex: string): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

// Calculate TDEE (Total Daily Energy Expenditure)
function calculateTDEE(bmr: number, activityLevel: string): number {
  const multiplier = ACTIVITY_LEVELS[activityLevel as keyof typeof ACTIVITY_LEVELS]?.multiplier || 1.55;
  return Math.round(bmr * multiplier);
}

export function GoalsProjectionCard() {
  const { profile } = useAuth();

  // Calculate TDEE and actual caloric difference
  const { tdee, actualSurplus, scenarios } = useMemo(() => {
    if (!profile?.weight || !profile?.goal || !profile?.height || !profile?.age) {
      return { tdee: 0, actualSurplus: 0, scenarios: [] };
    }

    const bmr = calculateBMR(
      profile.weight,
      profile.height,
      profile.age,
      profile.sex || 'male'
    );
    const calculatedTDEE = calculateTDEE(bmr, profile.activity_level || 'moderate');
    
    // Get actual daily calories from diet plan or profile
    const dietCalories = profile.daily_calories || calculatedTDEE;
    const currentSurplus = dietCalories - calculatedTDEE;

    // 1kg of fat ≈ 7700 kcal
    // 1kg of muscle ≈ 5500 kcal (muscle is less calorie-dense)
    const KCAL_PER_KG_FAT = 7700;
    const KCAL_PER_KG_MUSCLE = 5500;

    const calculateProjections = (dailySurplus: number): ScenarioProjection['projections'] => {
      // For muscle gain, estimate body composition based on surplus size
      // Smaller surplus = higher muscle:fat ratio (cleaner gains)
      // Larger surplus = more fat storage
      const getFatPercentage = (surplus: number) => {
        if (surplus <= 0) return 0; // Weight loss is primarily fat
        if (surplus <= 200) return 0.25; // 25% fat, 75% muscle (very clean)
        if (surplus <= 350) return 0.35; // 35% fat, 65% muscle (clean)
        if (surplus <= 500) return 0.50; // 50% fat, 50% muscle (moderate)
        return 0.65; // 65% fat, 35% muscle (aggressive bulk)
      };

      const fatPct = getFatPercentage(dailySurplus);
      const musclePct = 1 - fatPct;
      
      // Weighted average kcal per kg based on composition
      const effectiveKcalPerKg = dailySurplus > 0
        ? (fatPct * KCAL_PER_KG_FAT) + (musclePct * KCAL_PER_KG_MUSCLE)
        : KCAL_PER_KG_FAT; // Weight loss is mostly fat

      const kgPerDay = dailySurplus / effectiveKcalPerKg;
      
      return [
        { days: 7, weightChange: kgPerDay * 7, fatGain: fatPct * 100 },
        { days: 30, weightChange: kgPerDay * 30, fatGain: fatPct * 100 },
        { days: 90, weightChange: kgPerDay * 90, fatGain: fatPct * 100 },
      ];
    };

    // Define scenarios based on current plan + additional calories
    // Shows: current plan, +300 kcal, +500 kcal
    const scenarioDefinitions: Omit<ScenarioProjection, 'projections'>[] = [
      { 
        label: 'Plano Atual', 
        dailySurplus: currentSurplus, 
        isRecommended: true,
        description: `${dietCalories} kcal/dia`
      },
      { 
        label: '+300 kcal', 
        dailySurplus: currentSurplus + 300, 
        description: `${dietCalories + 300} kcal/dia`
      },
      { 
        label: '+500 kcal', 
        dailySurplus: currentSurplus + 500, 
        description: `${dietCalories + 500} kcal/dia`
      },
    ];

    const calculatedScenarios: ScenarioProjection[] = scenarioDefinitions.map(scenario => ({
      ...scenario,
      projections: calculateProjections(scenario.dailySurplus),
    }));

    return { 
      tdee: calculatedTDEE, 
      actualSurplus: currentSurplus,
      scenarios: calculatedScenarios,
    };
  }, [profile]);

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

  if (!profile?.weight || !profile?.goal || !profile?.height || !profile?.age) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-elevated overflow-hidden h-full">
        <CardContent className="p-3 space-y-2">
          {/* Header - Compact */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">Projeção</span>
            </div>
            <div className="flex items-center gap-1.5">
              {getGoalIcon()}
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                {actualSurplus > 0 ? '+' : ''}{actualSurplus} kcal
              </Badge>
            </div>
          </div>

          {/* Compact Stats Row */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/30 rounded-md px-2 py-1.5">
            <span>{profile.weight?.toFixed(0)}kg</span>
            <span className="text-orange-500">TDEE: {tdee}</span>
            <span className="text-primary">Dieta: {profile.daily_calories || tdee}</span>
          </div>

          {/* Compact Scenarios Table */}
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-5 gap-0.5 text-[8px] text-muted-foreground px-1">
              <div className="col-span-2"></div>
              <div className="text-center">7d</div>
              <div className="text-center">30d</div>
              <div className="text-center">90d</div>
            </div>

            {/* Rows */}
            {scenarios.map((scenario) => (
              <div
                key={scenario.label}
                className={`grid grid-cols-5 gap-0.5 py-1 px-1 rounded text-[10px] ${
                  scenario.isRecommended 
                    ? 'bg-primary/10' 
                    : 'bg-muted/20'
                }`}
              >
                <div className="col-span-2 flex items-center gap-1">
                  <span className={`font-medium ${scenario.isRecommended ? 'text-primary' : ''}`}>
                    {scenario.label}
                  </span>
                </div>
                {scenario.projections.map((proj) => (
                  <div key={proj.days} className="text-center">
                    <span className={`font-semibold ${getChangeColor(proj.weightChange, profile.goal!)}`}>
                      {formatChange(proj.weightChange)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Compact Footer Note */}
          <p className="text-[8px] text-muted-foreground leading-tight flex items-start gap-1">
            <Info className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
            <span>
              Mifflin-St Jeor • 
              {profile.goal === 'gain_muscle' && ' Proporções músculo/gordura são estimativas teóricas.'}
              {profile.goal === 'lose_weight' && ' Déficit de 500kcal ≈ 0,5kg/sem.'}
              {profile.goal === 'maintain' && ' ±100kcal permite recomposição gradual.'}
            </span>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
