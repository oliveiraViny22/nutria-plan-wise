import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, ClipboardCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <div className="flex items-center gap-2">
          {isPlanSaved ? (
            <Link to="/meal-plan">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Ver Plano Completo</span>
                <span className="sm:hidden">Plano</span>
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" className="gap-2 opacity-50 cursor-not-allowed" disabled>
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Ver Plano Completo</span>
              <span className="sm:hidden">Plano</span>
            </Button>
          )}
          {isPaidUser && isPlanSaved && (
            <Link to="/daily-log">
              <Button variant="outline" size="sm" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Registrar consumo</span>
                <span className="sm:hidden">Registrar</span>
              </Button>
            </Link>
          )}
        </div>
      </div>
      
      {/* Save Plan CTA */}
      {!isPlanSaved && !isLinkedStudent && planId && (
        <SavePlanButton 
          planId={planId}
          isSaved={isPlanSaved}
          onSave={onPlanSaved}
        />
      )}

      <div className="space-y-3">
        {meals.map((meal, index) => (
          <motion.div
            key={meal.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 + index * 0.1 }}
          >
            <MealCard
              mealName={MEAL_NAMES[meal.name as MealType] || meal.name}
              calories={isPlanSaved ? meal.total_calories || 0 : undefined}
              status="pending"
              optionsCount={mealOptionsLimit > 1 ? mealOptionsLimit : undefined}
              onClick={isPlanSaved ? () => navigate(`/meal/${meal.id}`) : undefined}
            >
              {isPlanSaved && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span className="text-protein font-medium">{meal.total_protein?.toFixed(0) || 0}g prot</span>
                  <span className="text-carbs font-medium">{meal.total_carbs?.toFixed(0) || 0}g carb</span>
                  <span className="text-fat font-medium">{meal.total_fat?.toFixed(0) || 0}g gord</span>
                </div>
              )}
              {!isPlanSaved && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                  <Lock className="w-3 h-3" />
                  <span>Salve o plano para ver os detalhes</span>
                </div>
              )}
            </MealCard>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}
