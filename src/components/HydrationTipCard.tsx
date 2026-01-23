import { useMemo } from 'react';
import { Droplets } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function HydrationTipCard() {
  const { profile } = useAuth();

  // Calculate daily water intake recommendation (ml)
  const { waterInLiters, waterGlasses } = useMemo(() => {
    if (!profile?.weight) {
      return { waterInLiters: '2.0', waterGlasses: 8 };
    }

    // Base: 35ml per kg of body weight
    let baseWater = profile.weight * 35;

    // Activity level multiplier
    const activityMultiplier: Record<string, number> = {
      sedentary: 1,
      light: 1.1,
      moderate: 1.2,
      active: 1.3,
      very_active: 1.4,
    };

    const activityMult = activityMultiplier[profile.activity_level || 'sedentary'] || 1;
    baseWater *= activityMult;

    // Goal adjustment: more water for muscle gain (higher protein), slightly more for weight loss
    const goalMultiplier: Record<string, number> = {
      lose_weight: 1.05,
      maintain: 1,
      gain_muscle: 1.1,
    };

    const goalMult = goalMultiplier[profile.goal || 'maintain'] || 1;
    baseWater *= goalMult;

    // Height adjustment: taller people need slightly more water
    if (profile.height && profile.height > 170) {
      baseWater *= 1 + ((profile.height - 170) * 0.002); // +0.2% per cm above 170
    }

    const finalWater = Math.round(baseWater);
    const liters = (finalWater / 1000).toFixed(1);
    const glasses = Math.ceil(finalWater / 250);

    return { waterInLiters: liters, waterGlasses: glasses };
  }, [profile?.weight, profile?.height, profile?.activity_level, profile?.goal]);

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-blue-600/10 border border-blue-500/20 p-4 h-full flex flex-col justify-center">
      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="relative flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-500">Hidratação Diária</p>
            <p className="text-lg font-bold text-blue-500">{waterInLiters}L</p>
          </div>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm text-foreground">
            Beba cerca de <span className="text-blue-500 font-bold">{waterGlasses} copos</span> de água por dia
          </p>
          <p className="text-[10px] text-muted-foreground">
            *Cálculo baseado no seu peso, altura, objetivo e nível de atividade
          </p>
        </div>
      </div>
    </div>
  );
}
