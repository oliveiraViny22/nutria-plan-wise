import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cva, type VariantProps } from 'class-variance-authority';

const nutritionCardVariants = cva(
  'transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-card border-border/40',
        meal: 'bg-card border-primary/20 hover:border-primary/40 hover:shadow-md',
        metric: 'bg-gradient-to-br from-card to-muted/30 border-border/30',
        highlight: 'bg-primary/5 border-primary/30 shadow-sm',
        success: 'bg-success/5 border-success/30',
        warning: 'bg-warning/5 border-warning/30',
        professional: 'bg-card border-border/60 hover:border-primary/25 hover:shadow-sm',
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
      },
      interactive: {
        true: 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
      interactive: false,
    },
  }
);

export interface NutritionCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof nutritionCardVariants> {
  title?: string;
  description?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  footer?: ReactNode;
}

export function NutritionCard({
  className,
  variant,
  size,
  interactive,
  title,
  description,
  icon,
  badge,
  footer,
  children,
  ...props
}: NutritionCardProps) {
  return (
    <Card
      className={cn(nutritionCardVariants({ variant, size, interactive }), className)}
      {...props}
    >
      {(title || description || icon || badge) && (
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  {icon}
                </div>
              )}
              <div>
                {title && <CardTitle className="text-base">{title}</CardTitle>}
                {description && (
                  <CardDescription className="text-sm">{description}</CardDescription>
                )}
              </div>
            </div>
            {badge}
          </div>
        </CardHeader>
      )}
      
      <CardContent className={title || description ? 'pt-0' : ''}>
        {children}
      </CardContent>
      
      {footer && (
        <div className="px-4 pb-4 pt-0 border-t border-border/30 mt-2">
          {footer}
        </div>
      )}
    </Card>
  );
}

/* ========================
   SPECIALIZED MEAL CARD
   ======================== */

interface MealCardProps {
  mealName: string;
  mealTime?: string;
  calories?: number;
  status?: 'pending' | 'confirmed' | 'skipped';
  optionsCount?: number;
  children?: ReactNode;
  onClick?: () => void;
}

export function MealCard({
  mealName,
  mealTime,
  calories,
  status = 'pending',
  optionsCount,
  children,
  onClick,
}: MealCardProps) {
  const statusStyles = {
    pending: 'border-l-muted-foreground/30',
    confirmed: 'border-l-success',
    skipped: 'border-l-warning',
  };

  return (
    <Card
      className={cn(
        'border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer',
        statusStyles[status]
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">{mealName}</h3>
            {mealTime && (
              <p className="text-sm text-muted-foreground">{mealTime}</p>
            )}
          </div>
          <div className="text-right">
            {calories !== undefined && (
              <p className="font-semibold text-foreground tabular-nums">
                {calories} <span className="text-sm text-muted-foreground">kcal</span>
              </p>
            )}
            {optionsCount !== undefined && optionsCount > 1 && (
              <p className="text-xs text-muted-foreground">
                {optionsCount} opções
              </p>
            )}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/* ========================
   METRIC CARD
   ======================== */

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'default' | 'protein' | 'carbs' | 'fat' | 'calories' | 'success';
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  trend,
  trendValue,
  color = 'default',
}: MetricCardProps) {
  const colorStyles = {
    default: 'bg-primary/10 text-primary',
    protein: 'bg-protein-soft text-protein',
    carbs: 'bg-carbs-soft text-carbs',
    fat: 'bg-fat-soft text-fat',
    calories: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  const trendStyles = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  return (
    <Card className="bg-gradient-to-br from-card to-muted/20 border-border/30 h-full">
      <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center">
        {icon && (
          <div className={cn('p-2 rounded-lg shrink-0 mb-2', colorStyles[color])}>
            {icon}
          </div>
        )}
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-1 justify-center">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {trend && trendValue && (
          <div className={cn('text-sm font-medium mt-1', trendStyles[trend])}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
