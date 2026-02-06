import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ClipboardCheck, 
  ChevronRight, 
  CheckCircle2,
  Clock,
  Lock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ProFeatureBadge } from '@/components/FeatureBadge';

interface DailyLogCTAProps {
  mealsLogged: number;
  totalMeals: number;
  lastLogTime?: string;
  locked?: boolean;
}

export function DailyLogCTA({ mealsLogged, totalMeals, lastLogTime, locked = false }: DailyLogCTAProps) {
  const progress = totalMeals > 0 ? (mealsLogged / totalMeals) * 100 : 0;
  const isComplete = mealsLogged >= totalMeals && totalMeals > 0;
  const hasStarted = mealsLogged > 0;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={locked ? undefined : { scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Card className={`
        overflow-hidden transition-all duration-300
        ${locked 
          ? 'bg-muted/30 border-border/50 cursor-default' 
          : isComplete 
            ? 'bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/30 hover:border-green-500/50 cursor-pointer' 
            : 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:border-primary/50 cursor-pointer'
        }
      `}>
        <CardContent className="py-4 px-4 sm:px-5">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Icon and text */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
                ${locked 
                  ? 'bg-muted' 
                  : isComplete 
                    ? 'bg-green-500/20' 
                    : 'bg-primary/20'
                }
              `}>
                {locked ? (
                  <ClipboardCheck className="w-6 h-6 text-muted-foreground" />
                ) : isComplete ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <ClipboardCheck className="w-6 h-6 text-primary" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-semibold text-sm sm:text-base ${locked ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {locked ? 'Registro diário' : isComplete ? 'Dia completo!' : 'Registro diário'}
                  </h3>
                  {locked && (
                    <ProFeatureBadge 
                      tooltipTitle="Recurso Premium"
                      tooltipDescription="Registre suas refeições e acompanhe sua adesão diária com o plano pago."
                    />
                  )}
                  {!locked && hasStarted && !isComplete && (
                    <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full">
                      {mealsLogged}/{totalMeals}
                    </span>
                  )}
                </div>
                
                {locked ? (
                  <p className="text-xs text-muted-foreground">
                    Acompanhe o que você comeu e sua adesão
                  </p>
                ) : isComplete ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Todas as refeições registradas ✓
                  </p>
                ) : hasStarted ? (
                  <div className="space-y-1.5">
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Continue de onde parou</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Registre o que você comeu hoje
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Button or Lock */}
            {locked ? (
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                <Lock className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (
              <Button 
                variant={isComplete ? 'outline' : 'default'}
                size="sm"
                className={`
                  flex-shrink-0 gap-1
                  ${isComplete 
                    ? 'border-green-500/30 text-green-600 hover:bg-green-500/10' 
                    : ''
                  }
                `}
              >
                <span className="hidden sm:inline">
                  {isComplete ? 'Revisar' : 'Registrar'}
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (locked) {
    return content;
  }

  return (
    <Link to="/daily-log">
      {content}
    </Link>
  );
}
