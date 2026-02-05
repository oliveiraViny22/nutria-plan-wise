import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { MealCard } from '@/components/ui-kit';
import { SavePlanButton } from '@/components/SavePlanButton';
import { EmptyPlanState } from '@/components/EmptyPlanState';
import { MEAL_NAMES, MealType, Meal } from '@/lib/types';

interface DashboardMealsProps {
  hasPlan: boolean;
  isPlanSaved: boolean;
  planId?: string;
  meals: Meal[];
  planType?: string;
  isLinkedStudent: boolean;
  planReleased: boolean;
  mealOptionsLimit: number;
  generating: boolean;
  onGeneratePlan: () => void;
  onPlanSaved: () => void;
}

export function DashboardMeals({
  hasPlan,
  isPlanSaved,
  planId,
  meals,
  planType,
  isLinkedStudent,
  planReleased,
  mealOptionsLimit,
  generating,
  onGeneratePlan,
  onPlanSaved,
}: DashboardMealsProps) {
  const navigate = useNavigate();

  // Linked student without released plan
  if (isLinkedStudent && !planReleased) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-center py-12"
      >
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Lock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-2">
          Plano ainda não liberado
        </h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Seu nutricionista está preparando seu plano alimentar. Quando estiver pronto, ele aparecerá aqui.
        </p>
      </motion.section>
    );
  }

  // No plan yet
  if (!hasPlan) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <EmptyPlanState
          onGeneratePlan={onGeneratePlan}
          isGenerating={generating}
          isLinkedStudent={isLinkedStudent}
        />
      </motion.section>
    );
  }

  const isPaidUser = planType !== 'gratuito';

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-sans font-semibold text-foreground tracking-tight">
          Plano de Hoje
        </h2>
      </div>
      
      {/* Save Plan CTA */}
      {!isPlanSaved && !isLinkedStudent && planId && (
        <div id="save-plan-section">
          <SavePlanButton 
            planId={planId}
            isSaved={isPlanSaved}
            onSave={onPlanSaved}
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {meals.map((meal, index) => (
          <motion.div
            key={meal.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.03 }}
          >
            <div
              className={`
                flex flex-col items-center justify-center p-3 rounded-lg border
                bg-card hover:bg-muted/30 transition-all cursor-pointer
                border-l-4 border-l-muted-foreground/30 border-t-0 border-r-border/50 border-b-border/50
                hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]
                min-h-[72px]
              `}
              onClick={isPlanSaved ? () => navigate(`/meal/${meal.id}`) : undefined}
            >
              <span className="font-medium text-foreground text-xs sm:text-sm text-center line-clamp-1">
                {MEAL_NAMES[meal.name as MealType] || meal.name}
              </span>
              {isPlanSaved && meal.total_calories !== undefined && (
                <span className="text-sm sm:text-base font-semibold text-foreground tabular-nums mt-1">
                  {meal.total_calories} <span className="text-[10px] text-muted-foreground">kcal</span>
                </span>
              )}
              {!isPlanSaved && (
                <Lock className="w-3 h-3 text-muted-foreground mt-1" />
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
