import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardCheck, 
  FileText, 
  MessageCircle, 
  Utensils,
  Plus,
  RefreshCcw,
  BarChart3,
  Settings,
  Sparkles,
  ChevronRight
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
  onOptimize?: () => void;
  className?: string;
}

export function EnhancedQuickActions({
  hasPlan,
  isPlanSaved,
  pendingMeals,
  totalMeals,
  isPaidUser,
  canGeneratePlan = true,
  canOptimize = false,
  isGenerating = false,
  onGeneratePlan,
  onOptimize,
  className,
}: EnhancedQuickActionsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const allMealsLogged = pendingMeals === 0 && totalMeals > 0;
  const hasRefeicoesPendentes = pendingMeals > 0;

  const primaryActions: QuickActionItem[] = [
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
      id: 'generate',
      label: 'Gerar novo plano',
      shortLabel: 'Gerar',
      icon: isGenerating ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCcw className="h-4 w-4" />
        </motion.div>
      ) : (
        <Sparkles className="h-4 w-4" />
      ),
      onClick: onGeneratePlan,
      variant: 'primary',
      tooltip: 'Criar um novo plano alimentar',
      show: !hasPlan && canGeneratePlan,
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

  const secondaryActions: QuickActionItem[] = [
    {
      id: 'chat',
      label: 'Chat com IA',
      shortLabel: 'Chat',
      icon: <MessageCircle className="h-4 w-4" />,
      href: '/chat',
      variant: 'ghost',
      tooltip: 'Tire dúvidas nutricionais',
      show: true,
    },
    {
      id: 'progress',
      label: 'Ver progresso',
      shortLabel: 'Progresso',
      icon: <BarChart3 className="h-4 w-4" />,
      href: '/progress',
      variant: 'ghost',
      tooltip: 'Acompanhe sua evolução',
      show: isPaidUser,
    },
    {
      id: 'optimize',
      label: 'Otimizar macros',
      shortLabel: 'Otimizar',
      icon: <RefreshCcw className="h-4 w-4" />,
      onClick: onOptimize,
      variant: 'ghost',
      tooltip: 'Rebalancear o plano atual',
      show: hasPlan && canOptimize,
    },
    {
      id: 'profile',
      label: 'Editar perfil',
      shortLabel: 'Perfil',
      icon: <Settings className="h-4 w-4" />,
      href: '/profile',
      variant: 'ghost',
      tooltip: 'Atualizar dados e metas',
      show: true,
    },
  ];

  const visiblePrimary = primaryActions.filter(a => a.show);
  const visibleSecondary = secondaryActions.filter(a => a.show);

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
        <div className="flex items-center gap-2">
          {/* Primary actions */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1">
            {visiblePrimary.map((action, index) => (
              <ActionButton key={action.id} action={action} index={index} />
            ))}
          </div>

          {/* Expand toggle for secondary actions */}
          {visibleSecondary.length > 0 && (
            <motion.button
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs",
                "bg-muted/50 hover:bg-muted text-muted-foreground",
                "transition-colors duration-200"
              )}
              onClick={() => setIsExpanded(!isExpanded)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                isExpanded && "rotate-45"
              )} />
              <span className="hidden sm:inline">Mais</span>
              <ChevronRight className={cn(
                "w-3 h-3 transition-transform duration-200",
                isExpanded && "rotate-90"
              )} />
            </motion.button>
          )}
        </div>

        {/* Expandable secondary actions */}
        <AnimatePresence>
          {isExpanded && visibleSecondary.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 pt-2 mt-2 border-t border-border/30 overflow-x-auto scrollbar-hide">
                {visibleSecondary.map((action, index) => (
                  <ActionButton key={action.id} action={action} index={index} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </TooltipProvider>
  );
}
