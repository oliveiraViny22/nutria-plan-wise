import { Link } from 'react-router-dom';
import { 
  ClipboardCheck, 
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DailyLogCTAProps {
  mealsLogged: number;
  totalMeals: number;
  lastLogTime?: string;
  locked?: boolean;
}

export function DailyLogCTA({ mealsLogged, totalMeals, locked = false }: DailyLogCTAProps) {
  const isComplete = mealsLogged >= totalMeals && totalMeals > 0;
  const hasStarted = mealsLogged > 0;

  // Locked state - compact inline teaser
  if (locked) {
    return (
      <div className="relative overflow-hidden rounded-lg border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-background to-amber-500/5">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-amber-500/50 flex items-center justify-center">
                <Lock className="w-2.5 h-2.5 text-amber-400" />
              </div>
            </div>
            
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">
                  Registro Diário
                </span>
                <Badge 
                  variant="outline" 
                  className="shrink-0 text-[10px] px-1.5 py-0 h-4 border-amber-500/50 text-amber-400 bg-amber-500/10"
                >
                  Pro
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Acompanhe suas refeições e adesão diária
              </p>
            </div>
          </div>

          <Link to="/pricing">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            >
              Desbloquear
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Unlocked state - button following the same pattern as other actions
  return (
    <Link to="/daily-log" className="block">
      <Button
        variant="secondary"
        className={`
          w-full gap-2 px-6 border transition-all duration-300
          ${isComplete 
            ? 'border-green-500/50 hover:border-green-500 hover:bg-green-500/10 hover:text-green-600 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
            : 'border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-600 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]'
          }
        `}
      >
        {isComplete ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <ClipboardCheck className="w-4 h-4" />
        )}
        <span>{isComplete ? 'Dia Completo' : 'Registrar Refeições'}</span>
        {hasStarted && !isComplete && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {mealsLogged}/{totalMeals}
          </Badge>
        )}
      </Button>
    </Link>
  );
}
