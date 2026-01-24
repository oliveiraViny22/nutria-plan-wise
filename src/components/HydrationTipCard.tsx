import { useMemo } from 'react';
import { Droplets } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-sky-500/10 via-cyan-400/5 to-blue-500/10 dark:from-sky-500/15 dark:via-cyan-400/10 dark:to-blue-500/15 border border-sky-400/20 dark:border-sky-500/25 p-4 h-full flex flex-col justify-center shadow-sm"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-sky-400/15 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-16 h-16 bg-cyan-400/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative flex flex-col gap-2.5">
        {/* Header with icon and value */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <motion.div 
              className="flex-shrink-0 w-9 h-9 rounded-lg bg-sky-500/20 dark:bg-sky-500/25 flex items-center justify-center"
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              <Droplets className="w-4.5 h-4.5 text-sky-500 dark:text-sky-400" />
            </motion.div>
            <span className="text-xs font-medium text-sky-600 dark:text-sky-400 uppercase tracking-wide">
              Hidratação
            </span>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
              {waterInLiters}
            </span>
            <span className="text-sm font-medium text-sky-500/80 dark:text-sky-400/80 ml-0.5">L</span>
          </div>
        </div>
        
        {/* Main recommendation */}
        <div className="space-y-1">
          <p className="text-sm text-foreground/90 leading-snug">
            Beba <span className="text-sky-600 dark:text-sky-400 font-semibold">{waterGlasses} copos</span> de água hoje
          </p>
          <p className="text-[10px] text-muted-foreground/70 leading-tight">
            Baseado no seu peso, altura e nível de atividade
          </p>
        </div>
      </div>
    </motion.div>
  );
}
