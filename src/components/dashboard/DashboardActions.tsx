import { motion } from 'framer-motion';
import { Loader2, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AIRebalancer } from '@/components/AIRebalancer';

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
}

interface DashboardActionsProps {
  canCreatePlan: boolean;
  canAdjust: boolean;
  isLinkedStudent: boolean;
  hasPlan: boolean;
  planId?: string;
  generating: boolean;
  generatingV5: boolean;
  isLimitReachedDiet: boolean;
  isLimitReachedAdjustment: boolean;
  usage?: {
    diets: UsageInfo;
    adjustments: UsageInfo;
  };
  targets: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  currentMacros: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  userGoal?: 'gain_muscle' | 'lose_weight' | 'maintain';
  onGeneratePlan: () => void;
  onPlanOptimized: () => void;
}

export function DashboardActions({
  canCreatePlan,
  canAdjust,
  isLinkedStudent,
  hasPlan,
  planId,
  generating,
  generatingV5,
  isLimitReachedDiet,
  isLimitReachedAdjustment,
  usage,
  targets,
  currentMacros,
  userGoal,
  onGeneratePlan,
  onPlanOptimized,
}: DashboardActionsProps) {
  if (!canCreatePlan || isLinkedStudent) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col sm:flex-row items-center justify-center gap-3"
    >
      {/* Primary Generate Plan button */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          variant="secondary"
          size="lg"
          className="gap-2 px-6 border border-border/50 transition-all duration-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
          onClick={onGeneratePlan}
          disabled={generating || generatingV5 || isLimitReachedDiet}
        >
          {generatingV5 ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Gerando...</span>
            </>
          ) : (
            <>
              <UtensilsCrossed className="w-5 h-5" />
              <span>Gerar Plano</span>
              {usage && !usage.diets.isUnlimited && (
                <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-xs">
                  {usage.diets.remaining}/{usage.diets.limit}
                </span>
              )}
            </>
          )}
        </Button>
      </motion.div>

      {/* Optimize button */}
      {hasPlan && planId && canAdjust && (
        <AIRebalancer
          planId={planId}
          targets={targets}
          currentMacros={currentMacros}
          userGoal={userGoal}
          onComplete={onPlanOptimized}
          compact={false}
          usageInfo={usage?.adjustments}
          isLimitReached={isLimitReachedAdjustment}
        />
      )}
    </motion.section>
  );
}
