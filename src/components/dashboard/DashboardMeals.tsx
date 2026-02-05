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

      <div className="space-y-2">
        {meals.map((meal, index) => (
          <motion.div
            key={meal.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
          >
            <MealCard
              mealName={MEAL_NAMES[meal.name as MealType] || meal.name}
              calories={isPlanSaved ? meal.total_calories || 0 : undefined}
              status="pending"
              optionsCount={mealOptionsLimit > 1 ? mealOptionsLimit : undefined}
              onClick={isPlanSaved ? () => navigate(`/meal/${meal.id}`) : undefined}
              compact={true}
            />
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
