import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Coffee, Sun, Apple, Moon, Utensils, Cookie } from 'lucide-react';
import { MealCard } from '@/components/ui-kit';
import { SavePlanButton } from '@/components/SavePlanButton';
import { EmptyPlanState } from '@/components/EmptyPlanState';
import { SupplementToggle } from '@/components/SupplementToggle';
import { MEAL_NAMES, MealType, Meal } from '@/lib/types';

// Map meal types to icons
const MEAL_ICONS: Record<string, React.ElementType> = {
  breakfast: Coffee,
  morning_snack: Apple,
  lunch: Sun,
  afternoon_snack: Cookie,
  dinner: Moon,
  supper: Utensils,
};

function getMealIcon(mealName: string) {
  const key = mealName.toLowerCase().replace(/\s+/g, '_');
  return MEAL_ICONS[key] || Utensils;
}

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
  includeSupplements?: boolean;
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
  includeSupplements = false,
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
      <div className="flex items-center justify-center">
        <h2 className="text-lg sm:text-xl font-sans font-semibold text-foreground tracking-tight">
          Suas Refeições
        </h2>
      </div>

      {/* Supplement Toggle - below title, above meals */}
      {!isLinkedStudent && (
        <SupplementToggle 
          initialValue={includeSupplements}
          compact
          locked={isPaidUser ? false : true}
        />
      )}
      
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
            {(() => {
              const IconComponent = getMealIcon(meal.name);
              return (
                <div
                  className={`
                    flex flex-col items-center justify-center p-3 rounded-xl
                    bg-card/50 hover:bg-muted/40 transition-all cursor-pointer
                    border border-border/30 hover:border-border/50
                    hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]
                    min-h-[80px] gap-1
                  `}
                  onClick={isPlanSaved ? () => navigate(`/meal/${meal.id}`) : undefined}
                >
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-foreground text-xs sm:text-sm text-center line-clamp-1">
                    {MEAL_NAMES[meal.name as MealType] || meal.name}
                  </span>
                  {isPlanSaved && meal.total_calories !== undefined && (
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {meal.total_calories} <span className="text-[10px] text-muted-foreground">kcal</span>
                    </span>
                  )}
                  {!isPlanSaved && (
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              );
            })()}
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
