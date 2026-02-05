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
  gradientId: string;
  gradientColors: [string, string];
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
      bgClass: 'bg-protein/5',
      textClass: 'text-protein',
      ringColor: 'stroke-protein',
      icon: <Beef className="w-4 h-4" />,
      description: 'Essencial para construção muscular e recuperação',
      gradientId: 'proteinGradient',
      gradientColors: ['hsl(217, 91%, 60%)', 'hsl(199, 89%, 48%)'],
    },
    {
      name: 'Carboidrato',
      short: 'C',
      current: carbs,
      target: carbsTarget,
      unit: 'g',
      colorClass: 'bg-carbs',
      bgClass: 'bg-carbs/5',
      textClass: 'text-carbs',
      ringColor: 'stroke-carbs',
      icon: <Wheat className="w-4 h-4" />,
      description: 'Principal fonte de energia para atividades',
      gradientId: 'carbsGradient',
      gradientColors: ['hsl(38, 92%, 50%)', 'hsl(45, 93%, 47%)'],
    },
    {
      name: 'Gordura',
      short: 'G',
      current: fat,
      target: fatTarget,
      unit: 'g',
      colorClass: 'bg-fat',
      bgClass: 'bg-fat/5',
      textClass: 'text-fat',
      ringColor: 'stroke-fat',
      icon: <Droplets className="w-4 h-4" />,
      description: 'Importante para hormônios e absorção de vitaminas',
      gradientId: 'fatGradient',
      gradientColors: ['hsl(346, 77%, 50%)', 'hsl(330, 81%, 60%)'],
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
      {/* Mobile: Stack vertically, Desktop: 3 columns */}
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-3">
        {macros.map((macro, index) => {
          const percentage = Math.min((macro.current / macro.target) * 100, 100);
          const deviation = getDeviation(macro.current, macro.target);
          const isExpanded = expandedMacro === macro.name;
          
          // Responsive ring size
          const mobileSize = 56;
          const desktopSize = 64;
          const strokeWidth = 5;

          return (
            <motion.div
              key={macro.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative rounded-xl cursor-pointer transition-all duration-300",
                // Glassmorphism effect
                "backdrop-blur-sm bg-background/60 dark:bg-background/40",
                "border border-white/20 dark:border-white/10",
                "shadow-lg shadow-black/5 dark:shadow-black/20",
                // Hover states
                "hover:bg-background/80 dark:hover:bg-background/60",
                "hover:border-white/30 dark:hover:border-white/20",
                "hover:shadow-xl hover:shadow-black/10",
                "active:scale-[0.98]",
                isExpanded && "ring-2 ring-primary/20",
                // Mobile: horizontal layout, Desktop: vertical
                "flex items-center gap-3 p-3 sm:flex-col sm:p-4"
              )}
              onClick={() => setExpandedMacro(isExpanded ? null : macro.name)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Circular progress - left on mobile, centered on desktop */}
              <div className="flex-shrink-0 sm:order-2">
                {/* Mobile ring */}
                <div className="block sm:hidden relative" style={{ width: mobileSize, height: mobileSize }}>
                  <svg width={mobileSize} height={mobileSize} className="-rotate-90">
                    <defs>
                      <linearGradient id={`${macro.gradientId}-mobile`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={macro.gradientColors[0]} />
                        <stop offset="100%" stopColor={macro.gradientColors[1]} />
                      </linearGradient>
                    </defs>
                    <circle
                      cx={mobileSize / 2}
                      cy={mobileSize / 2}
                      r={(mobileSize - strokeWidth) / 2}
                      className="stroke-muted/30"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                    <motion.circle
                      cx={mobileSize / 2}
                      cy={mobileSize / 2}
                      r={(mobileSize - strokeWidth) / 2}
                      stroke={`url(#${macro.gradientId}-mobile)`}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={(mobileSize - strokeWidth) * Math.PI}
                      initial={{ strokeDashoffset: (mobileSize - strokeWidth) * Math.PI }}
                      animate={{ strokeDashoffset: (mobileSize - strokeWidth) * Math.PI * (1 - percentage / 100) }}
                      transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AnimatedCounter 
                      value={Math.round(macro.current)} 
                      duration={800 + index * 150} 
                      className={cn("text-sm font-bold tabular-nums", macro.textClass)}
                    />
                  </div>
                </div>
                
                {/* Desktop ring */}
                <div className="hidden sm:block relative" style={{ width: desktopSize, height: desktopSize }}>
                  <svg width={desktopSize} height={desktopSize} className="-rotate-90">
                    <defs>
                      <linearGradient id={`${macro.gradientId}-desktop`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={macro.gradientColors[0]} />
                        <stop offset="100%" stopColor={macro.gradientColors[1]} />
                      </linearGradient>
                    </defs>
                    <circle
                      cx={desktopSize / 2}
                      cy={desktopSize / 2}
                      r={(desktopSize - strokeWidth) / 2}
                      className="stroke-muted/30"
                      strokeWidth={strokeWidth}
                      fill="none"
                    />
                    <motion.circle
                      cx={desktopSize / 2}
                      cy={desktopSize / 2}
                      r={(desktopSize - strokeWidth) / 2}
                      stroke={`url(#${macro.gradientId}-desktop)`}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={(desktopSize - strokeWidth) * Math.PI}
                      initial={{ strokeDashoffset: (desktopSize - strokeWidth) * Math.PI }}
                      animate={{ strokeDashoffset: (desktopSize - strokeWidth) * Math.PI * (1 - percentage / 100) }}
                      transition={{ duration: 1, delay: index * 0.15, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AnimatedCounter
                      value={Math.round(macro.current)} 
                      duration={800 + index * 150} 
                      className={cn("text-base font-bold tabular-nums", macro.textClass)}
                    />
                    <span className="text-[9px] text-muted-foreground">{macro.unit}</span>
                  </div>
                </div>
              </div>

              {/* Content - right on mobile, top on desktop */}
              <div className="flex-1 min-w-0 sm:order-1 sm:w-full">
                {/* Header with icon, name and deviation */}
                <div className="flex items-center justify-between gap-2 sm:justify-center sm:mb-2">
                  <div className={cn("flex items-center gap-1.5", macro.textClass)}>
                    {macro.icon}
                    <span className="text-sm font-semibold sm:text-xs">{macro.name}</span>
                  </div>
                  
                  {/* Deviation badge - visible on mobile inline, on desktop as tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={cn(
                        "flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        getDeviationColor(deviation),
                        "bg-background/80 sm:hidden"
                      )}>
                        {getDeviationIcon(deviation)}
                        <span className="tabular-nums">{deviation > 0 ? '+' : ''}{deviation}%</span>
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

                {/* Target info - mobile only inline */}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground sm:hidden">
                  <Target className="w-3 h-3" />
                  <span className="tabular-nums">Meta: {macro.target}{macro.unit}</span>
                  <ChevronDown className={cn(
                    "w-3 h-3 ml-auto transition-transform",
                    isExpanded && "rotate-180"
                  )} />
                </div>
              </div>

              {/* Desktop: Target and deviation below ring */}
              <div className="hidden sm:flex sm:order-3 sm:flex-col sm:items-center sm:gap-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Target className="w-3 h-3" />
                  <span className="tabular-nums">{macro.target}{macro.unit}</span>
                </div>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      getDeviationColor(deviation),
                      "bg-background/80"
                    )}>
                      {getDeviationIcon(deviation)}
                      <span className="tabular-nums">{deviation > 0 ? '+' : ''}{deviation}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {Math.abs(deviation) <= 5 
                      ? 'Dentro da meta!' 
                      : deviation > 0 
                        ? `${deviation}% acima da meta`
                        : `${Math.abs(deviation)}% abaixo da meta`
                    }
                  </TooltipContent>
                </Tooltip>
                
                {/* Expand indicator for desktop */}
                <ChevronDown className={cn(
                  "w-3 h-3 text-muted-foreground/50 mt-1 transition-transform",
                  isExpanded && "rotate-180"
                )} />
              </div>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full pt-3 mt-2 border-t border-border/30 sm:order-4"
                  >
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>{macro.description}</span>
                    </div>
                    
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-background/60 rounded-md p-2 text-center">
                        <span className="block text-muted-foreground text-[10px]">Atual</span>
                        <span className={cn("font-semibold tabular-nums", macro.textClass)}>{macro.current}g</span>
                      </div>
                      <div className="bg-background/60 rounded-md p-2 text-center">
                        <span className="block text-muted-foreground text-[10px]">Meta</span>
                        <span className="font-semibold text-foreground tabular-nums">{macro.target}g</span>
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
