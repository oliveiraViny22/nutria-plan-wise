import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, 
  FileText, 
  Utensils,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface QuickActionItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant: 'primary' | 'secondary' | 'ghost' | 'success';
  badge?: string | number;
  tooltip?: string;
  show: boolean;
}

interface EnhancedQuickActionsProps {
  hasPlan: boolean;
  isPlanSaved: boolean;
  pendingMeals: number;
  totalMeals: number;
  isPaidUser: boolean;
  canGeneratePlan?: boolean;
  canOptimize?: boolean;
  isGenerating?: boolean;
  onGeneratePlan?: () => void;
  className?: string;
}

export function EnhancedQuickActions({
  hasPlan,
  isPlanSaved,
  pendingMeals,
  totalMeals,
  isPaidUser,
  canGeneratePlan = true,
  isGenerating = false,
  onGeneratePlan,
  className,
}: EnhancedQuickActionsProps) {
  const allMealsLogged = pendingMeals === 0 && totalMeals > 0;
  const hasRefeicoesPendentes = pendingMeals > 0;

  // Removed generate button - now only in DashboardActions
  const actions: QuickActionItem[] = [
    {
      id: 'register',
      label: 'Registrar refeição',
      shortLabel: 'Registrar',
      icon: <ClipboardCheck className="h-4 w-4" />,
      href: '/daily-log',
      variant: 'primary',
      badge: pendingMeals,
      tooltip: `${pendingMeals} refeições pendentes hoje`,
      show: isPaidUser && isPlanSaved && hasRefeicoesPendentes,
    },
    {
      id: 'complete',
      label: 'Dia completo!',
      shortLabel: '✓ Completo',
      icon: <Utensils className="h-4 w-4" />,
      variant: 'success',
      show: isPaidUser && isPlanSaved && allMealsLogged,
    },
    {
      id: 'view-plan',
      label: 'Ver plano completo',
      shortLabel: 'Plano',
      icon: <FileText className="h-4 w-4" />,
      href: '/meal-plan',
      variant: 'secondary',
      show: isPlanSaved,
    },
  ];

  const visibleActions = actions.filter(a => a.show);

  const getButtonVariant = (variant: QuickActionItem['variant']) => {
    switch (variant) {
      case 'primary': return 'default';
      case 'secondary': return 'outline';
      case 'success': return 'outline';
      case 'ghost': return 'ghost';
      default: return 'outline';
    }
  };

  const ActionButton = ({ action, index }: { action: QuickActionItem; index: number }) => {
    const button = (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Button
          variant={getButtonVariant(action.variant)}
          size="sm"
          className={cn(
            "gap-2 transition-all duration-200",
            action.variant === 'primary' && "bg-primary hover:bg-primary/90 shadow-sm",
            action.variant === 'success' && "bg-success/10 text-success border-success/20 hover:bg-success/20",
            "hover:scale-[1.02] active:scale-[0.98]"
          )}
          onClick={action.onClick}
          disabled={isGenerating && action.id === 'generate'}
        >
          {action.icon}
          <span className="hidden sm:inline">{action.label}</span>
          <span className="sm:hidden">{action.shortLabel}</span>
          {action.badge !== undefined && (
            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-background text-primary rounded-full">
              {action.badge}
            </span>
          )}
        </Button>
      </motion.div>
    );

    if (action.href) {
      return (
        <Link to={action.href} className="flex-shrink-0">
          {action.tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">{action.tooltip}</TooltipContent>
            </Tooltip>
          ) : button}
        </Link>
      );
    }

    return action.tooltip ? (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{action.tooltip}</TooltipContent>
      </Tooltip>
    ) : button;
  };

  if (visibleActions.length === 0) return null;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className={cn(
          "sticky top-[65px] z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 sm:py-3",
          "glass border-b border-border/30",
          className
        )}
      >
        <div className="flex items-center justify-center gap-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {visibleActions.map((action, index) => (
              <ActionButton key={action.id} action={action} index={index} />
            ))}
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
