import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck, FileText, MessageCircle, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickActionsBarProps {
  hasPlan: boolean;
  isPlanSaved: boolean;
  pendingMeals: number;
  totalMeals: number;
  isPaidUser: boolean;
  className?: string;
}

export function QuickActionsBar({
  hasPlan,
  isPlanSaved,
  pendingMeals,
  totalMeals,
  isPaidUser,
  className,
}: QuickActionsBarProps) {
  // Don't show if no plan
  if (!hasPlan) return null;

  const allMealsLogged = pendingMeals === 0 && totalMeals > 0;
  const hasRefeicoesPendentes = pendingMeals > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className={cn(
        "sticky top-[65px] z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 sm:py-3",
        "glass border-b border-border/30",
        "flex items-center gap-2 overflow-x-auto scrollbar-hide",
        className
      )}
    >
      {/* Primary Action: Register Meal (contextual) */}
      {isPaidUser && isPlanSaved && hasRefeicoesPendentes && (
        <Link to="/daily-log" className="flex-shrink-0">
          <Button 
            variant="default" 
            size="sm" 
            className="gap-2 bg-primary hover:bg-primary/90 shadow-sm"
          >
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Registrar refeição</span>
            <span className="sm:hidden">Registrar</span>
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-background text-primary rounded-full">
              {pendingMeals}
            </span>
          </Button>
        </Link>
      )}

      {/* Success state: All meals logged */}
      {isPaidUser && isPlanSaved && allMealsLogged && (
        <div className="flex-shrink-0 inline-flex items-center gap-2 px-3 py-1.5 bg-success/10 text-success rounded-lg text-sm font-medium">
          <Utensils className="h-4 w-4" />
          <span className="hidden sm:inline">Dia completo!</span>
          <span className="sm:hidden">✓ Completo</span>
        </div>
      )}

      {/* View Full Plan */}
      {isPlanSaved && (
        <Link to="/meal-plan" className="flex-shrink-0">
          <Button variant="outline" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Ver plano completo</span>
            <span className="sm:hidden">Plano</span>
          </Button>
        </Link>
      )}

      {/* Chat IA */}
      <Link to="/chat" className="flex-shrink-0">
        <Button variant="ghost" size="sm" className="gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Chat IA</span>
          <span className="sm:hidden">Chat</span>
        </Button>
      </Link>
    </motion.div>
  );
}
