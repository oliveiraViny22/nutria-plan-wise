import { motion } from 'framer-motion';

interface MacroChartProps {
  protein: number;
  carbs: number;
  fat: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MacroChart({
  protein,
  carbs,
  fat,
  proteinTarget,
  carbsTarget,
  fatTarget,
  showLabels = true,
  size = 'md',
}: MacroChartProps) {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-3',
  };

  const macros = [
    {
      name: 'Proteína',
      short: 'P',
      current: protein,
      target: proteinTarget,
      colorClass: 'bg-protein',
      bgClass: 'bg-protein-soft',
      textClass: 'text-protein',
    },
    {
      name: 'Carboidrato',
      short: 'C',
      current: carbs,
      target: carbsTarget,
      colorClass: 'bg-carbs',
      bgClass: 'bg-carbs-soft',
      textClass: 'text-carbs',
    },
    {
      name: 'Gordura',
      short: 'G',
      current: fat,
      target: fatTarget,
      colorClass: 'bg-fat',
      bgClass: 'bg-fat-soft',
      textClass: 'text-fat',
    },
  ];

  return (
    <div className="space-y-4">
      {macros.map((macro, index) => {
        const percentage = Math.min((macro.current / macro.target) * 100, 100);

        return (
          <div key={macro.name} className="space-y-1.5">
            {showLabels && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground tracking-tight">{macro.name}</span>
                <span className={`${macro.textClass} font-semibold tabular-nums`}>
                  {Math.round(macro.current)}g <span className="text-muted-foreground font-normal">/ {Math.round(macro.target)}g</span>
                </span>
              </div>
            )}
            <div className={`w-full ${macro.bgClass} rounded-full ${sizeClasses[size]} overflow-hidden`}>
              <motion.div
                className={`${macro.colorClass} ${sizeClasses[size]} rounded-full relative`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, delay: index * 0.15, ease: "easeOut" }}
              >
                {/* Subtle shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
