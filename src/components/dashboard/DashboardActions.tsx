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
    >
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="premium"
          size="default"
          className="w-full"
          onClick={onGeneratePlan}
          disabled={generating || generatingV5 || isLimitReachedDiet}
        >
          {generatingV5 ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Gerando...</span>
            </>
          ) : (
            <>
              <UtensilsCrossed className="w-4 h-4" />
              <span className="hidden sm:inline">
                Gerar Plano {usage && !usage.diets.isUnlimited && `(${usage.diets.remaining}/${usage.diets.limit})`}
              </span>
              <span className="sm:hidden">
                Gerar {usage && !usage.diets.isUnlimited && `(${usage.diets.remaining})`}
              </span>
            </>
          )}
        </Button>

        {hasPlan && planId && canAdjust ? (
          <AIRebalancer
            planId={planId}
            targets={targets}
            currentMacros={currentMacros}
            userGoal={userGoal}
            onComplete={onPlanOptimized}
            compact
            usageInfo={usage?.adjustments}
            isLimitReached={isLimitReachedAdjustment}
          />
        ) : (
          <div />
        )}
      </div>
    </motion.section>
  );
}
