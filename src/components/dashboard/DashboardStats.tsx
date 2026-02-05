import { motion } from 'framer-motion';
import { Target, Flame } from 'lucide-react';
import { EnhancedCalorieRing } from './EnhancedCalorieRing';
import { InteractiveMacroCard } from './InteractiveMacroCard';
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
  tmb?: number;
  tdee?: number;
  goal?: string;
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
  tmb,
  tdee,
  goal,
}: DashboardStatsProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="space-y-3 sm:space-y-4"
    >
      <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2">
        {/* Calorie Card - Enhanced */}
        <NutritionCard
          variant="metric"
          title="Calorias"
          icon={<Flame className="w-4 h-4 sm:w-5 sm:h-5" />}
          className="flex flex-col items-center"
        >
          <EnhancedCalorieRing
            current={currentCalories}
            target={targetCalories}
            tmb={tmb}
            tdee={tdee}
            goal={goal}
            size={160}
          />
        </NutritionCard>

        {/* Macros Card - Enhanced */}
        <NutritionCard
          variant="metric"
          title="Macronutrientes"
          icon={<Target className="w-4 h-4 sm:w-5 sm:h-5" />}
        >
          <InteractiveMacroCard
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
