import { Link } from 'react-router-dom';
import { Crown, Sparkles, Lock, LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'free' | 'pro' | 'locked';

interface PremiumBadgeProps {
  variant: BadgeVariant;
  /** Link destination (defaults to /pricing) */
  href?: string;
  /** Custom label (overrides default) */
  label?: string;
  /** Show shimmer animation */
  shimmer?: boolean;
  /** Tooltip title */
  tooltipTitle?: string;
  /** Tooltip description */
  tooltipDescription?: string;
  /** Custom icon */
  icon?: LucideIcon;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Callback when clicked (in addition to navigation) */
  onClick?: () => void;
}

const variantConfig = {
  free: {
    icon: Sparkles,
    label: 'Gratuito',
    tooltipTitle: 'Plano Gratuito',
    tooltipDescription: '1 dieta/mês, 3 substituições, 1 ajuste. Toque para ver planos.',
    className: 'bg-muted text-muted-foreground border-border hover:bg-muted/80',
  },
  pro: {
    icon: Crown,
    label: 'Pro',
    tooltipTitle: 'Recurso Premium',
    tooltipDescription: 'Este recurso está disponível nos planos pagos. Toque para ver opções de upgrade.',
    className: 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20',
  },
  locked: {
    icon: Lock,
    label: 'Bloqueado',
    tooltipTitle: 'Recurso Bloqueado',
    tooltipDescription: 'Faça upgrade para desbloquear este recurso.',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function PremiumBadge({
  variant,
  href = '/pricing',
  label,
  shimmer = true,
  tooltipTitle,
  tooltipDescription,
  icon,
  className,
  size = 'default',
  onClick,
}: PremiumBadgeProps) {
  const config = variantConfig[variant];
  const Icon = icon || config.icon;
  const displayLabel = label || config.label;
  const title = tooltipTitle || config.tooltipTitle;
  const description = tooltipDescription || config.tooltipDescription;

  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-1.5 py-0 gap-1' 
    : 'text-xs px-2.5 py-1 gap-1.5';

  const badgeContent = (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses,
        'cursor-pointer transition-all duration-300 hover:scale-105',
        shimmer && 'shimmer-badge-subtle overflow-hidden',
        config.className,
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      {displayLabel}
    </Badge>
  );

  const linkedBadge = (
    <Link 
      to={href} 
      className="inline-flex group"
      onClick={onClick}
    >
      {badgeContent}
    </Link>
  );

  if (!title && !description) {
    return linkedBadge;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {linkedBadge}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] p-3">
          {title && <p className="text-xs font-medium mb-1">{title}</p>}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Convenience component for Free Plan badge */
export function FreePlanBadge({ 
  className, 
  onClick,
  ...props 
}: Omit<PremiumBadgeProps, 'variant'>) {
  return (
    <PremiumBadge 
      variant="free" 
      className={className}
      onClick={onClick}
      {...props}
    />
  );
}

/** Convenience component for Pro Feature badge */
export function ProFeatureBadge({ 
  className,
  onClick,
  ...props 
}: Omit<PremiumBadgeProps, 'variant'>) {
  return (
    <PremiumBadge 
      variant="pro" 
      size="sm"
      className={className}
      onClick={onClick}
      {...props}
    />
  );
}
