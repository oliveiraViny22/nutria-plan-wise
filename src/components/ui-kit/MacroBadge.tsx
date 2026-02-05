import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const macroBadgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium tabular-nums transition-colors',
  {
    variants: {
      macro: {
        protein: 'text-protein',
        carbs: 'text-carbs',
        fat: 'text-fat',
        calories: 'text-warning',
      },
      size: {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
      },
      variant: {
        text: '',
        pill: 'px-2 py-0.5 rounded-full',
        card: 'px-3 py-1.5 rounded-lg',
      },
    },
    compoundVariants: [
      {
        macro: 'protein',
        variant: ['pill', 'card'],
        className: 'bg-protein-soft',
      },
      {
        macro: 'carbs',
        variant: ['pill', 'card'],
        className: 'bg-carbs-soft',
      },
      {
        macro: 'fat',
        variant: ['pill', 'card'],
        className: 'bg-fat-soft',
      },
      {
        macro: 'calories',
        variant: ['pill', 'card'],
        className: 'bg-warning/10',
      },
    ],
    defaultVariants: {
      macro: 'protein',
      size: 'md',
      variant: 'text',
    },
  }
);

export interface MacroBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof macroBadgeVariants> {
  value: number;
  unit?: string;
  label?: string;
  showIcon?: boolean;
}

const macroIcons = {
  protein: '🥩',
  carbs: '🍞',
  fat: '🥑',
  calories: '🔥',
};

const macroLabels = {
  protein: 'Proteína',
  carbs: 'Carboidratos',
  fat: 'Gordura',
  calories: 'Calorias',
};

const macroUnits = {
  protein: 'g',
  carbs: 'g',
  fat: 'g',
  calories: 'kcal',
};

export function MacroBadge({
  className,
  macro = 'protein',
  size,
  variant,
  value,
  unit,
  label,
  showIcon = false,
  ...props
}: MacroBadgeProps) {
  const displayUnit = unit ?? macroUnits[macro!];
  const displayLabel = label ?? macroLabels[macro!];

  return (
    <span
      className={cn(macroBadgeVariants({ macro, size, variant }), className)}
      {...props}
    >
      {showIcon && <span>{macroIcons[macro!]}</span>}
      {variant === 'card' && <span className="text-muted-foreground">{displayLabel}:</span>}
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground font-normal">{displayUnit}</span>
    </span>
  );
}

/* ========================
   MACRO BAR (Progress)
   ======================== */

interface MacroBarProps {
  macro: 'protein' | 'carbs' | 'fat' | 'calories';
  current: number;
  target: number;
  showLabel?: boolean;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function MacroBar({
  macro,
  current,
  target,
  showLabel = true,
  showPercentage = true,
  size = 'md',
}: MacroBarProps) {
  const percentage = Math.min((current / target) * 100, 100);
  const isOver = current > target;

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const barColors = {
    protein: 'bg-protein',
    carbs: 'bg-carbs',
    fat: 'bg-fat',
    calories: 'bg-warning',
  };

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{macroLabels[macro]}</span>
          <span className={cn('font-medium tabular-nums', isOver && 'text-destructive')}>
            {current}/{target} {macroUnits[macro]}
            {showPercentage && (
              <span className="text-muted-foreground ml-1">
                ({Math.round(percentage)}%)
              </span>
            )}
          </span>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-muted/50', heightStyles[size])}>
        <div
          className={cn(
            'rounded-full transition-all duration-500 ease-out',
            heightStyles[size],
            isOver ? 'bg-destructive' : barColors[macro]
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

/* ========================
   MACRO SUMMARY
   ======================== */

interface MacroSummaryProps {
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
  calories?: { current: number; target: number };
  layout?: 'horizontal' | 'vertical' | 'grid';
}

export function MacroSummary({
  protein,
  carbs,
  fat,
  calories,
  layout = 'vertical',
}: MacroSummaryProps) {
  const layoutStyles = {
    horizontal: 'flex flex-wrap gap-4',
    vertical: 'space-y-3',
    grid: 'grid grid-cols-2 gap-3',
  };

  return (
    <div className={layoutStyles[layout]}>
      <MacroBar macro="protein" current={protein.current} target={protein.target} />
      <MacroBar macro="carbs" current={carbs.current} target={carbs.target} />
      <MacroBar macro="fat" current={fat.current} target={fat.target} />
      {calories && (
        <MacroBar macro="calories" current={calories.current} target={calories.target} />
      )}
    </div>
  );
}
