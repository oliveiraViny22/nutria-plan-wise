import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, X, Clock, AlertTriangle, Flame, Trophy, Star } from 'lucide-react';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors',
  {
    variants: {
      status: {
        // Meal statuses
        pending: 'bg-muted text-muted-foreground',
        confirmed: 'bg-success/10 text-success',
        skipped: 'bg-warning/10 text-warning',
        out_of_plan: 'bg-destructive/10 text-destructive',
        late_confirmed: 'bg-warning/10 text-warning',
        
        // Adherence statuses
        complete: 'bg-success/10 text-success',
        partial: 'bg-warning/10 text-warning',
        missed: 'bg-destructive/10 text-destructive',
        
        // General statuses
        active: 'bg-success/10 text-success',
        inactive: 'bg-muted text-muted-foreground',
        premium: 'bg-primary/10 text-primary',
        pro: 'bg-accent/10 text-accent-foreground',
        
        // Streak statuses
        streak: 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600',
        milestone: 'bg-gradient-to-r from-yellow-400/10 to-amber-500/10 text-yellow-600',
      },
      size: {
        xs: 'text-[10px] px-1.5 py-0.5',
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5',
      },
    },
    defaultVariants: {
      status: 'pending',
      size: 'sm',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  showIcon?: boolean;
  label?: string;
}

const statusIcons = {
  pending: Clock,
  confirmed: Check,
  skipped: X,
  out_of_plan: AlertTriangle,
  late_confirmed: Clock,
  complete: Check,
  partial: Clock,
  missed: X,
  active: Check,
  inactive: X,
  premium: Star,
  pro: Trophy,
  streak: Flame,
  milestone: Trophy,
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  skipped: 'Pulado',
  out_of_plan: 'Fora do plano',
  late_confirmed: 'Confirmado tarde',
  complete: 'Completo',
  partial: 'Parcial',
  missed: 'Não registrado',
  active: 'Ativo',
  inactive: 'Inativo',
  premium: 'Premium',
  pro: 'Pro',
  streak: 'Sequência',
  milestone: 'Marco',
};

export function StatusBadge({
  className,
  status = 'pending',
  size,
  showIcon = true,
  label,
  ...props
}: StatusBadgeProps) {
  const Icon = statusIcons[status!];
  const displayLabel = label ?? statusLabels[status!];

  const iconSizes = {
    xs: 'h-2.5 w-2.5',
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  return (
    <span
      className={cn(statusBadgeVariants({ status, size }), className)}
      {...props}
    >
      {showIcon && Icon && <Icon className={iconSizes[size || 'sm']} />}
      {displayLabel}
    </span>
  );
}

/* ========================
   STREAK BADGE
   ======================== */

interface StreakBadgeProps {
  days: number;
  size?: 'sm' | 'md' | 'lg';
  showFire?: boolean;
  milestone?: boolean;
}

export function StreakBadge({
  days,
  size = 'md',
  showFire = true,
  milestone = false,
}: StreakBadgeProps) {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const fireStyles = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold rounded-full',
        milestone
          ? 'bg-gradient-to-r from-yellow-400/20 to-amber-500/20 text-amber-600'
          : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600',
        sizeStyles[size]
      )}
    >
      {showFire && <Flame className={cn(fireStyles[size], 'text-orange-500')} />}
      <span className="tabular-nums">{days}</span>
      <span className="text-amber-600/70">dias</span>
      {milestone && <Trophy className={cn(fireStyles[size], 'text-yellow-500')} />}
    </span>
  );
}

/* ========================
   PLAN TYPE BADGE
   ======================== */

interface PlanBadgeProps {
  plan: 'gratuito' | 'plano_pessoal_pago' | 'profissional';
  size?: 'sm' | 'md' | 'lg';
}

const planLabels = {
  gratuito: 'Gratuito',
  plano_pessoal_pago: 'Pessoal',
  profissional: 'Profissional',
};

const planStyles = {
  gratuito: 'bg-muted text-muted-foreground',
  plano_pessoal_pago: 'bg-primary/10 text-primary',
  profissional: 'bg-accent/10 text-accent-foreground',
};

export function PlanBadge({ plan, size = 'sm' }: PlanBadgeProps) {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        planStyles[plan],
        sizeStyles[size]
      )}
    >
      {plan === 'profissional' && <Star className="h-3 w-3" />}
      {planLabels[plan]}
    </span>
  );
}
