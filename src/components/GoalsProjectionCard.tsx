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

          {/* Current Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center mb-1">
                {getGoalIcon()}
              </div>
              <p className="text-[10px] text-muted-foreground">Peso atual</p>
              <p className="text-sm font-bold">{profile.weight.toFixed(1).replace('.', ',')} kg</p>
            </div>
            <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-[10px] text-muted-foreground">TDEE</p>
              <p className="text-sm font-bold">{tdee} kcal</p>
            </div>
            <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
              <div className="w-7 h-7 rounded-full bg-background flex items-center justify-center mb-1">
                <Target className="w-4 h-4 text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground">Dieta</p>
              <p className="text-sm font-bold">{profile.daily_calories || tdee} kcal</p>
            </div>
          </div>

          {/* Current Surplus/Deficit Badge */}
          <div className="flex justify-center">
            <Badge 
              variant={actualSurplus > 0 ? 'default' : actualSurplus < 0 ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {actualSurplus > 0 ? '+' : ''}{actualSurplus} kcal/dia 
              ({actualSurplus > 0 ? 'superávit' : actualSurplus < 0 ? 'déficit' : 'manutenção'})
            </Badge>
          </div>

          {/* Scenarios Grid */}
          <div className="space-y-3">
            {/* Header Row */}
            <div className="grid grid-cols-5 gap-1 text-[9px] text-muted-foreground">
              <div className="col-span-2"></div>
              <div className="text-center">7 dias</div>
              <div className="text-center">30 dias</div>
              <div className="text-center">90 dias</div>
            </div>

            {/* Scenario Rows */}
            {scenarios.map((scenario) => (
              <div
                key={scenario.label}
                className={`grid grid-cols-5 gap-1 p-2 rounded-lg transition-colors ${
                  scenario.isRecommended 
                    ? 'bg-primary/10 border border-primary/20' 
                    : 'bg-muted/30 hover:bg-muted/50'
                }`}
              >
                <div className="col-span-2 flex flex-col justify-center">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-medium ${scenario.isRecommended ? 'text-primary' : 'text-foreground'}`}>
                      {scenario.label}
                    </span>
                    {scenario.isRecommended && (
                      <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                        Ideal
                      </Badge>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {scenario.dailySurplus > 0 ? '+' : ''}{scenario.dailySurplus} kcal
                  </span>
                </div>
                {scenario.projections.map((proj) => (
                  <div key={proj.days} className="text-center flex flex-col justify-center">
                    <p className={`text-xs font-semibold ${getChangeColor(proj.weightChange, profile.goal!)}`}>
                      {formatChange(proj.weightChange)}
                    </p>
                    {profile.goal === 'gain_muscle' && proj.fatGain !== undefined && proj.fatGain > 0 && (
                      <p className="text-[8px] text-muted-foreground">
                        <span className="text-green-600">{Math.round(100 - proj.fatGain)}% músculo</span>
                        {' · '}
                        <span className="text-amber-600">{Math.round(proj.fatGain)}% gordura</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Methodology Alert */}
          <Alert className="bg-muted/30 border-muted">
            <Info className="h-3 w-3" />
            <AlertDescription className="text-[10px] text-muted-foreground leading-relaxed">
              <strong>Metodologia:</strong> TDEE calculado via Mifflin-St Jeor ({profile.weight}kg, {profile.height}cm, {profile.age} anos). 
              {profile.goal === 'gain_muscle' && (
                <> Para ganho de massa limpa, recomenda-se superávit de 200-350 kcal/dia para maximizar proporção muscular (~65-75% do ganho).</>
              )}
              {profile.goal === 'lose_weight' && (
                <> Déficit de 500 kcal/dia resulta em ~0,5kg/semana de perda sustentável.</>
              )}
              {profile.goal === 'maintain' && (
                <> Manutenção com variação de ±100 kcal permite recomposição corporal gradual.</>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </motion.div>
  );
}
