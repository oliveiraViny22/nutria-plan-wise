import { motion } from 'framer-motion';
import { Target, Flame, Loader2, UtensilsCrossed } from 'lucide-react';
import { EnhancedCalorieRing } from './EnhancedCalorieRing';
import { InteractiveMacroCard } from './InteractiveMacroCard';
import { NutritionCard } from '@/components/ui-kit';
import { Button } from '@/components/ui/button';
import { AIRebalancer } from '@/components/AIRebalancer';

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
}

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
  // Actions props
  canCreatePlan?: boolean;
  canAdjust?: boolean;
  hasPlan?: boolean;
  planId?: string;
  isGenerating?: boolean;
  isLimitReachedDiet?: boolean;
  isLimitReachedAdjustment?: boolean;
  usage?: {
    diets: UsageInfo;
    adjustments: UsageInfo;
  };
  userGoal?: 'gain_muscle' | 'lose_weight' | 'maintain';
  onGeneratePlan?: () => void;
  onPlanOptimized?: () => void;
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
  canCreatePlan,
  canAdjust,
  hasPlan,
  planId,
  isGenerating,
  isLimitReachedDiet,
  isLimitReachedAdjustment,
  usage,
  userGoal,
  onGeneratePlan,
  onPlanOptimized,
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
        <div className="flex flex-col gap-3">
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
          
          {/* Generate Plan Button - Below Calories */}
          {canCreatePlan && onGeneratePlan && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex justify-center"
            >
              <Button
                variant="secondary"
                size="default"
                className="gap-2 px-5 border border-border/50 transition-all duration-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                onClick={onGeneratePlan}
                disabled={isGenerating || isLimitReachedDiet}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>Gerar Plano</span>
                    {usage && !usage.diets.isUnlimited && (
                      <span className="ml-1 px-1.5 py-0.5 bg-muted rounded-full text-[10px]">
                        {usage.diets.remaining}
                      </span>
                    )}
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </div>

        {/* Macros Card - Enhanced */}
        <div className="flex flex-col gap-3">
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
          
          {/* Optimize Plan Button - Below Macros (using AIRebalancer) */}
          {hasPlan && planId && canAdjust && onPlanOptimized && (
            <div className="flex justify-center">
              <AIRebalancer
                planId={planId}
                targets={{
                  protein: targetProtein,
                  carbs: targetCarbs,
                  fat: targetFat,
                  calories: targetCalories,
                }}
                currentMacros={{
                  protein: currentProtein,
                  carbs: currentCarbs,
                  fat: currentFat,
                  calories: currentCalories,
                }}
                userGoal={userGoal}
                onComplete={onPlanOptimized}
                compact={false}
                usageInfo={usage?.adjustments}
                isLimitReached={isLimitReachedAdjustment}
              />
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
