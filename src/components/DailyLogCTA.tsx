import { Link } from 'react-router-dom';
import { 
  ClipboardCheck, 
  CheckCircle2,
  Lock,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ProFeatureBadge } from '@/components/FeatureBadge';

interface DailyLogCTAProps {
  mealsLogged: number;
  totalMeals: number;
  lastLogTime?: string;
  locked?: boolean;
}

export function DailyLogCTA({ mealsLogged, totalMeals, locked = false }: DailyLogCTAProps) {
  const isComplete = mealsLogged >= totalMeals && totalMeals > 0;
  const hasStarted = mealsLogged > 0;

  const content = (
    <div 
      className={`
        inline-flex items-center gap-3 px-5 py-3 rounded-xl
        transition-all duration-300
        ${locked 
          ? 'bg-gradient-to-r from-amber-500/5 via-yellow-500/10 to-amber-500/5 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] hover:border-amber-500/30 cursor-pointer' 
          : isComplete
            ? 'bg-gradient-to-r from-green-600/20 via-emerald-500/20 to-green-600/20 border-2 border-green-500/50 shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] hover:border-green-400 hover:scale-[1.03] active:scale-[0.98]'
            : 'bg-gradient-to-r from-amber-600/20 via-yellow-500/20 to-amber-600/20 border-2 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:border-amber-400 hover:scale-[1.03] active:scale-[0.98]'
        }
      `}
    >
      <div className={`
        w-9 h-9 rounded-full flex items-center justify-center
        ${locked 
          ? 'bg-gradient-to-br from-amber-400/30 to-yellow-500/30 shadow-sm shadow-amber-500/20' 
          : isComplete
            ? 'bg-gradient-to-br from-green-500 via-emerald-500 to-green-600 shadow-lg shadow-green-500/50'
            : 'bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/50'
        }
      `}>
        {isComplete ? (
          <CheckCircle2 className={`h-4 w-4 ${locked ? 'text-amber-500/70' : 'text-white drop-shadow-sm'}`} />
        ) : (
          <ClipboardCheck className={`h-4 w-4 ${locked ? 'text-amber-500/70' : 'text-white drop-shadow-sm'}`} />
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${
          locked 
            ? 'text-amber-600/70 dark:text-amber-400/70' 
            : isComplete
              ? 'text-green-700 dark:text-green-300'
              : 'text-amber-700 dark:text-amber-300'
        }`}>
          {isComplete ? 'Dia Completo!' : 'Registro Diário'}
        </span>
        {locked ? (
          <ProFeatureBadge 
            tooltipTitle="Recurso Premium"
            tooltipDescription="O registro diário de refeições está disponível nos planos pagos. Acompanhe sua adesão e conquiste suas metas!"
          />
        ) : (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className={`h-3.5 w-3.5 cursor-help ${isComplete ? 'text-green-500' : 'text-amber-500'}`} />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3">
                <p className="text-sm font-medium mb-1">Como funciona?</p>
                <p className="text-sm text-muted-foreground">
                  Registre as refeições que você consumiu ao longo do dia para acompanhar sua 
                  <strong className="text-foreground"> adesão ao plano</strong> e manter sua sequência de dias consecutivos.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {hasStarted && !isComplete && !locked && (
          <Badge 
            variant="secondary" 
            className="ml-1 text-xs bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
          >
            {mealsLogged}/{totalMeals}
          </Badge>
        )}
      </div>
      {locked && (
        <Lock className="h-4 w-4 text-muted-foreground ml-2" />
      )}
    </div>
  );

  if (locked) {
    return (
      <div className="flex justify-center">
        <Link to="/pricing">
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Link to="/daily-log">
        {content}
      </Link>
    </div>
  );
}
