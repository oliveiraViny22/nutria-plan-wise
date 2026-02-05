import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ChevronDown, 
  Target,
  Info,
  Beef,
  Wheat,
  Droplets
} from 'lucide-react';
import { AnimatedCounter } from '@/components/ui-kit';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface MacroData {
  name: string;
  short: string;
  current: number;
  target: number;
  unit: string;
  colorClass: string;
  bgClass: string;
  textClass: string;
  ringColor: string;
  icon: React.ReactNode;
  description: string;
}

interface InteractiveMacroCardProps {
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
}

export function InteractiveMacroCard({
  protein,
  carbs,
  fat,
  proteinTarget,
  carbsTarget,
  fatTarget,
}: InteractiveMacroCardProps) {
  const [expandedMacro, setExpandedMacro] = useState<string | null>(null);

  const macros: MacroData[] = [
    {
      name: 'Proteína',
      short: 'P',
      current: protein,
      target: proteinTarget,
      unit: 'g',
      colorClass: 'bg-protein',
      bgClass: 'bg-protein/10',
      textClass: 'text-protein',
      ringColor: 'stroke-protein',
      icon: <Beef className="w-4 h-4" />,
      description: 'Essencial para construção muscular e recuperação',
    },
    {
      name: 'Carboidrato',
      short: 'C',
      current: carbs,
      target: carbsTarget,
      unit: 'g',
      colorClass: 'bg-carbs',
      bgClass: 'bg-carbs/10',
      textClass: 'text-carbs',
      ringColor: 'stroke-carbs',
      icon: <Wheat className="w-4 h-4" />,
      description: 'Principal fonte de energia para atividades',
    },
    {
      name: 'Gordura',
      short: 'G',
      current: fat,
      target: fatTarget,
      unit: 'g',
      colorClass: 'bg-fat',
      bgClass: 'bg-fat/10',
      textClass: 'text-fat',
      ringColor: 'stroke-fat',
      icon: <Droplets className="w-4 h-4" />,
      description: 'Importante para hormônios e absorção de vitaminas',
    },
  ];

  const getDeviation = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.round(((current - target) / target) * 100);
  };

  const getDeviationIcon = (deviation: number) => {
    if (deviation > 5) return <TrendingUp className="w-3 h-3" />;
    if (deviation < -5) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getDeviationColor = (deviation: number) => {
    const absDeviation = Math.abs(deviation);
    if (absDeviation <= 5) return 'text-success';
    if (absDeviation <= 15) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {macros.map((macro, index) => {
          const percentage = Math.min((macro.current / macro.target) * 100, 100);
          const deviation = getDeviation(macro.current, macro.target);
          const isExpanded = expandedMacro === macro.name;
          const size = 64;
          const strokeWidth = 6;
          const radius = (size - strokeWidth) / 2;
          const circumference = radius * 2 * Math.PI;
          const strokeDashoffset = circumference - (percentage / 100) * circumference;

          return (
            <motion.div
              key={macro.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative rounded-xl p-3 cursor-pointer transition-all duration-300",
                "border border-border/50 hover:border-border",
                macro.bgClass,
                "hover:shadow-lg hover:shadow-primary/5",
                isExpanded && "ring-2 ring-primary/20"
              )}
              onClick={() => setExpandedMacro(isExpanded ? null : macro.name)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Header with icon and name */}
              <div className="flex items-center justify-between mb-2">
                <div className={cn("flex items-center gap-1.5", macro.textClass)}>
                  {macro.icon}
                  <span className="text-xs font-semibold hidden sm:inline">{macro.name}</span>
                  <span className="text-xs font-semibold sm:hidden">{macro.short}</span>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      getDeviationColor(deviation),
                      "bg-background/80"
                    )}>
                      {getDeviationIcon(deviation)}
                      <span>{deviation > 0 ? '+' : ''}{deviation}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {Math.abs(deviation) <= 5 
                      ? 'Dentro da meta!' 
                      : deviation > 0 
                        ? `${deviation}% acima da meta`
                        : `${Math.abs(deviation)}% abaixo da meta`
                    }
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Circular progress */}
              <div className="flex items-center justify-center">
                <div className="relative" style={{ width: size, height: size }}>
                  <svg width={size} height={size} className="-rotate-90">
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      className="stroke-muted"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                    <motion.circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      className={macro.ringColor}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AnimatedCounter 
                      value={Math.round(macro.current)} 
                      duration={800 + index * 150} 
                      className={cn("text-base font-bold", macro.textClass)}
                    />
                    <span className="text-[9px] text-muted-foreground">{macro.unit}</span>
                  </div>
                </div>
              </div>

              {/* Target indicator */}
              <div className="flex items-center justify-center gap-1 mt-2 text-[10px] text-muted-foreground">
                <Target className="w-3 h-3" />
                <span>{macro.target}{macro.unit}</span>
              </div>

              {/* Expand indicator */}
              <motion.div 
                className="absolute bottom-1 left-1/2 -translate-x-1/2"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
              </motion.div>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-3 pt-3 border-t border-border/30"
                  >
                    <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                      <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{macro.description}</span>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                      <div className="bg-background/60 rounded-md p-1.5 text-center">
                        <span className="block text-muted-foreground">Atual</span>
                        <span className={cn("font-semibold", macro.textClass)}>{macro.current}g</span>
                      </div>
                      <div className="bg-background/60 rounded-md p-1.5 text-center">
                        <span className="block text-muted-foreground">Meta</span>
                        <span className="font-semibold text-foreground">{macro.target}g</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
