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
      {/* Primary Generate Plan button - centered CTA */}
      <div className="flex justify-center">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            variant="premium"
            size="lg"
            className="gap-2 relative overflow-hidden group px-6"
            onClick={onGeneratePlan}
            disabled={generating || generatingV5 || isLimitReachedDiet}
          >
            {/* Shimmer effect */}
            <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            
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
                  <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                    {usage.diets.remaining}/{usage.diets.limit}
                  </span>
                )}
              </>
            )}
          </Button>
        </motion.div>
      </div>

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
