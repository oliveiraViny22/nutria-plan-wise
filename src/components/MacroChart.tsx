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
    md: 'h-3',
    lg: 'h-4',
  };

  const macros = [
    {
      name: 'Proteína',
      current: protein,
      target: proteinTarget,
      colorClass: 'bg-protein',
      bgClass: 'bg-protein-soft',
      textClass: 'text-protein',
    },
    {
      name: 'Carboidrato',
      current: carbs,
      target: carbsTarget,
      colorClass: 'bg-carbs',
      bgClass: 'bg-carbs-soft',
      textClass: 'text-carbs',
    },
    {
      name: 'Gordura',
      current: fat,
      target: fatTarget,
      colorClass: 'bg-fat',
      bgClass: 'bg-fat-soft',
      textClass: 'text-fat',
    },
  ];

  return (
    <div className="space-y-3">
      {macros.map((macro, index) => {
        const percentage = Math.min((macro.current / macro.target) * 100, 100);

        return (
          <div key={macro.name} className="space-y-1">
            {showLabels && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{macro.name}</span>
                <span className={`${macro.textClass} font-semibold`}>
                  {Math.round(macro.current)}g / {Math.round(macro.target)}g
                </span>
              </div>
            )}
            <div className={`w-full ${macro.bgClass} rounded-full ${sizeClasses[size]} overflow-hidden`}>
              <motion.div
                className={`${macro.colorClass} ${sizeClasses[size]} rounded-full`}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
