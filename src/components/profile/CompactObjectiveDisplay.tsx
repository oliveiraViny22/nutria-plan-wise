import { Target, Lock, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ACTIVITY_LEVELS, GOALS } from '@/lib/types';

const GOAL_ICONS = {
  lose_weight: '🔥',
  maintain: '⚖️',
  gain_muscle: '💪',
};

const ACTIVITY_ICONS = {
  sedentary: '🛋️',
  light: '🚶',
  moderate: '🏃',
  active: '🏋️',
  very_active: '🏆',
};

interface CompactObjectiveDisplayProps {
  goal: string;
  activityLevel: string;
  isLinkedStudent: boolean;
  isPaidUser: boolean;
  onRequestChange: () => void;
  onStudentRequest: () => void;
  onUpgrade: () => void;
}

export function CompactObjectiveDisplay({
  goal,
  activityLevel,
  isLinkedStudent,
  isPaidUser,
  onRequestChange,
  onStudentRequest,
  onUpgrade,
}: CompactObjectiveDisplayProps) {
  const goalInfo = goal ? GOALS[goal as keyof typeof GOALS] : null;
  const activityInfo = activityLevel ? ACTIVITY_LEVELS[activityLevel as keyof typeof ACTIVITY_LEVELS] : null;

  return (
    <div className="space-y-3">
      {/* Compact Display Row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Goal */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50">
          <span className="text-2xl">
            {goal ? GOAL_ICONS[goal as keyof typeof GOAL_ICONS] : '🎯'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Objetivo</p>
            <p className="font-semibold text-sm truncate">
              {goalInfo?.label || '-'}
            </p>
            {goalInfo && (
              <p className="text-[10px] text-muted-foreground">
                {goalInfo.calorieAdjustment > 0 ? '+' : ''}{goalInfo.calorieAdjustment} kcal
              </p>
            )}
          </div>
        </div>

        {/* Activity Level */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/50">
          <span className="text-2xl">
            {activityLevel ? ACTIVITY_ICONS[activityLevel as keyof typeof ACTIVITY_ICONS] : '🏃'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Atividade</p>
            <p className="font-semibold text-sm truncate">
              {activityInfo?.label || '-'}
            </p>
            {activityInfo && (
              <p className="text-[10px] text-muted-foreground truncate">
                {activityInfo.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Info + Action Row */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <Lock className="h-3 w-3" />
                <span>Somente leitura</span>
                <Info className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <p className="font-semibold mb-1">Por que não posso alterar?</p>
              <p className="text-sm text-muted-foreground">
                O objetivo e nível de atividade são fixados para manter a consistência 
                do seu plano alimentar e histórico de adesão.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isLinkedStudent ? (
          <Button variant="outline" size="sm" onClick={onStudentRequest}>
            <Target className="h-3.5 w-3.5 mr-1.5" />
            Solicitar Alteração
          </Button>
        ) : isPaidUser ? (
          <Button variant="outline" size="sm" onClick={onRequestChange}>
            <Target className="h-3.5 w-3.5 mr-1.5" />
            Alterar Objetivo
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onUpgrade}>
            <Lock className="h-3.5 w-3.5 mr-1.5" />
            Alterar Objetivo
            <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">Pro</Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
