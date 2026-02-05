import { motion } from 'framer-motion';
import { Target, Flame } from 'lucide-react';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroChart } from '@/components/MacroChart';
import { NutritionCard } from '@/components/ui-kit';

interface DashboardStatsProps {
  currentCalories: number;
  currentProtein: number;
  currentCarbs: number;
  currentFat: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
}

export function DashboardStats({
  currentCalories,
  currentProtein,
  currentCarbs,
  currentFat,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
}: DashboardStatsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-3 sm:space-y-4"
    >
      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
        {/* Calorie Card */}
        <NutritionCard
          variant="metric"
          title="Calorias"
          icon={<Flame className="w-4 h-4 sm:w-5 sm:h-5" />}
          className="flex flex-col items-center"
        >
          <CalorieRing
            current={currentCalories}
            target={targetCalories}
          />
        </NutritionCard>

        {/* Macros Card */}
        <NutritionCard
          variant="metric"
          title="Macronutrientes"
          icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
        >
          <MacroChart
            protein={currentProtein}
            carbs={currentCarbs}
            fat={currentFat}
            proteinTarget={targetProtein}
            carbsTarget={targetCarbs}
            fatTarget={targetFat}
          />
        </NutritionCard>
      </div>
    </motion.section>
  );
}
