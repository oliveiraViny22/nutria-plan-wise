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
      className="flex flex-col gap-3"
    >
      {/* Single Generate Plan button - always visible when user can create */}
      <Button
        variant="premium"
        size="lg"
        className="w-full"
        onClick={onGeneratePlan}
        disabled={generating || generatingV5 || isLimitReachedDiet}
      >
        {generatingV5 ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Gerando plano...</span>
          </>
        ) : (
          <>
            <UtensilsCrossed className="w-5 h-5" />
            <span>
              Gerar Plano {usage && !usage.diets.isUnlimited && `(${usage.diets.remaining}/${usage.diets.limit})`}
            </span>
          </>
        )}
      </Button>

      {/* Optimize button - only shows when there's a saved plan */}
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
