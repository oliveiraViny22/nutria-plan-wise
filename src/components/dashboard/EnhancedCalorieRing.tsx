import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Zap, Info } from 'lucide-react';
import { AnimatedCounter } from '@/components/ui-kit';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface EnhancedCalorieRingProps {
  current: number;
  target: number;
  tmb?: number;
  tdee?: number;
  goal?: string;
  size?: number;
}

export function EnhancedCalorieRing({ 
  current, 
  target, 
  tmb,
  tdee,
  goal,
  size = 160 
}: EnhancedCalorieRingProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const strokeWidth = size * 0.07;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((current / target) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const deviation = target > 0 ? Math.round(((current - target) / target) * 100) : 0;
  const remaining = target - current;
  
  const getGoalLabel = (g?: string) => {
    switch (g) {
      case 'lose_weight': return 'Emagrecer';
      case 'gain_muscle': return 'Ganhar Massa';
      case 'maintain': return 'Manter';
      default: return null;
    }
  };
  
  const getStatusColor = () => {
    if (percentage >= 95 && percentage <= 105) return 'text-success';
    if (percentage >= 85 && percentage <= 115) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <TooltipProvider>
      <motion.div 
        className="relative flex flex-col items-center cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Main ring container */}
        <div className="relative" style={{ width: size, height: size }}>
          {/* Pulsing background for near-goal */}
          {percentage >= 90 && percentage <= 110 && (
            <motion.div
              className="absolute inset-0 rounded-full bg-success/10"
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.3, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
          
          {/* Decorative outer ring */}
          <svg width={size} height={size} className="-rotate-90 absolute">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius + strokeWidth * 0.6}
              stroke="hsl(var(--accent) / 0.15)"
              strokeWidth={1}
              fill="none"
              strokeDasharray="6 4"
            />
          </svg>
          
          {/* Main SVG */}
          <svg width={size} height={size} className="-rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              className="stroke-muted"
              strokeWidth={strokeWidth}
              fill="none"
            />
            
            {/* Progress gradient */}
            <defs>
              <linearGradient id="enhancedCalorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(158, 60%, 45%)" />
                <stop offset="50%" stopColor="hsl(165, 50%, 48%)" />
                <stop offset="100%" stopColor="hsl(42, 80%, 55%)" />
              </linearGradient>
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Progress circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="url(#enhancedCalorieGradient)"
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              filter="url(#glow)"
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-center gap-1 mb-0.5">
              <Flame className="w-4 h-4 text-warning" />
            </div>
            <AnimatedCounter 
              value={Math.round(current)} 
              duration={1200} 
              className="text-2xl sm:text-3xl font-bold text-foreground" 
            />
            <span className="text-xs text-muted-foreground">/ {target} kcal</span>
            
            {/* Deviation badge */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div 
                  className={cn(
                    "mt-1.5 flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                    "bg-background/80 border border-border/50",
                    getStatusColor()
                  )}
                  whileHover={{ scale: 1.1 }}
                >
                  {deviation > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : deviation < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  <span>{deviation > 0 ? '+' : ''}{deviation}%</span>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {remaining > 0 
                  ? `Faltam ${remaining} kcal para atingir a meta`
                  : remaining < 0 
                    ? `${Math.abs(remaining)} kcal acima da meta`
                    : 'Meta atingida!'
                }
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        {/* Expandable details */}
        <AnimatePresence>
          {showDetails && (tmb || tdee || goal) && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-3 w-full max-w-[200px] bg-muted/50 rounded-lg p-3 border border-border/50"
            >
              <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                <Info className="w-3 h-3" />
                <span>Detalhes metabólicos</span>
              </div>
              
              <div className="space-y-1.5 text-xs">
                {tmb && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TMB</span>
                    <span className="font-medium">{tmb} kcal</span>
                  </div>
                )}
                {tdee && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TDEE</span>
                    <span className="font-medium">{tdee} kcal</span>
                  </div>
                )}
                {goal && getGoalLabel(goal) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Objetivo</span>
                    <span className="font-medium text-primary">{getGoalLabel(goal)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-border/50">
                  <span className="text-muted-foreground">Restante</span>
                  <span className={cn("font-semibold", remaining > 0 ? 'text-foreground' : 'text-warning')}>
                    {remaining > 0 ? `+${remaining}` : remaining} kcal
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Tap hint */}
        <motion.span 
          className="text-[10px] text-muted-foreground/60 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          Toque para {showDetails ? 'ocultar' : 'ver mais'}
        </motion.span>
      </motion.div>
    </TooltipProvider>
  );
}
