import * as React from 'react';
import { cn } from '@/lib/utils';
import { NavLink as RouterNavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cva, type VariantProps } from 'class-variance-authority';

/* ========================
   PAGE HEADER
   ======================== */

interface PageHeaderProps {
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  backTo,
  backLabel = 'Voltar',
  icon,
  actions,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {backTo && (
        <RouterNavLink to={backTo} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </RouterNavLink>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
              {badge}
            </div>
            {description && (
              <p className="text-sm sm:text-base text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

/* ========================
   NAV TABS
   ======================== */

const navTabsVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:bg-muted/50 data-[active=true]:bg-muted data-[active=true]:text-foreground',
        pills: 'hover:bg-primary/10 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground',
        underline: 'rounded-none border-b-2 border-transparent hover:text-foreground data-[active=true]:border-primary data-[active=true]:text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface NavTabItem {
  label: string;
  to: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  end?: boolean;
}

interface NavTabsProps extends VariantProps<typeof navTabsVariants> {
  items: NavTabItem[];
  className?: string;
}

export function NavTabs({ items, variant, className }: NavTabsProps) {
  const location = useLocation();
  
  const isActive = (to: string, end?: boolean) => {
    if (end) {
      return location.pathname === to;
    }
    return location.pathname.startsWith(to);
  };

  return (
    <nav className={cn('flex items-center gap-1 overflow-x-auto pb-1', className)}>
      {items.map((item) => (
        <RouterNavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={cn(navTabsVariants({ variant }))}
          data-active={isActive(item.to, item.end)}
        >
          {item.icon && <span className="mr-2">{item.icon}</span>}
          {item.label}
          {item.badge}
        </RouterNavLink>
      ))}
    </nav>
  );
}

/* ========================
   BREADCRUMB
   ======================== */

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbNavProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  return (
    <nav className={cn('flex items-center text-sm text-muted-foreground', className)}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4 mx-2 shrink-0" />}
          {item.to ? (
            <RouterNavLink
              to={item.to}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </RouterNavLink>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* ========================
   STEP INDICATOR
   ======================== */

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary/20 text-primary border-2 border-primary',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? '✓' : index + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  (isCompleted || isCurrent) ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-3',
                  isCompleted ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ========================
   QUICK ACTIONS
   ======================== */

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'destructive';
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  const variantStyles = {
    default: 'hover:bg-muted',
    primary: 'hover:bg-primary/10 text-primary',
    destructive: 'hover:bg-destructive/10 text-destructive',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant="ghost"
          size="sm"
          className={cn('gap-2', variantStyles[action.variant || 'default'])}
          onClick={action.onClick}
        >
          {action.icon}
          <span className="hidden sm:inline">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
