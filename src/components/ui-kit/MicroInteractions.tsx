import * as React from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

/* ========================
   PULSE DOT
   ======================== */

interface PulseDotProps {
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PulseDot({ color = 'primary', size = 'md', className }: PulseDotProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
  };

  return (
    <span className={cn('relative inline-flex', className)}>
      <span className={cn('rounded-full', sizeClasses[size], colorClasses[color])} />
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
          colorClasses[color]
        )}
      />
    </span>
  );
}

/* ========================
   SKELETON LOADER
   ======================== */

interface SkeletonLoaderProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function SkeletonLoader({
  variant = 'rectangular',
  width,
  height,
  className,
}: SkeletonLoaderProps) {
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full aspect-square',
    rectangular: 'rounded-lg',
    card: 'rounded-xl',
  };

  return (
    <div
      className={cn(
        'animate-pulse bg-muted/60',
        variantClasses[variant],
        className
      )}
      style={{ width, height }}
    />
  );
}

/* ========================
   ANIMATED COUNTER
   ======================== */

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1000,
  className,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = React.useState(0);
  
  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.round(startValue + (value - startValue) * easeOutQuart);
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return (
    <span className={cn('tabular-nums', className)}>
      {displayValue.toLocaleString()}
    </span>
  );
}

/* ========================
   SUCCESS CHECKMARK
   ======================== */

interface SuccessCheckmarkProps {
  show: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function SuccessCheckmark({ show, size = 'md', className }: SuccessCheckmarkProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className={cn(
            'rounded-full bg-success flex items-center justify-center',
            sizeClasses[size],
            className
          )}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          >
            <Check className={cn('text-success-foreground', iconSizes[size])} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ========================
   LOADING SPINNER
   ======================== */

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export function LoadingSpinner({ size = 'md', label, className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-muted-foreground', sizeClasses[size])} />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

/* ========================
   INLINE STATUS
   ======================== */

interface InlineStatusProps {
  status: 'success' | 'error' | 'warning' | 'info' | 'loading';
  message: string;
  className?: string;
}

export function InlineStatus({ status, message, className }: InlineStatusProps) {
  const config = {
    success: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    error: { icon: X, color: 'text-destructive', bg: 'bg-destructive/10' },
    warning: { icon: AlertCircle, color: 'text-warning', bg: 'bg-warning/10' },
    info: { icon: Info, color: 'text-primary', bg: 'bg-primary/10' },
    loading: { icon: Loader2, color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  const { icon: Icon, color, bg } = config[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
        bg,
        className
      )}
    >
      <Icon className={cn('w-4 h-4', color, status === 'loading' && 'animate-spin')} />
      <span className={color}>{message}</span>
    </motion.div>
  );
}

/* ========================
   HOVER SCALE WRAPPER
   ======================== */

interface HoverScaleProps {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}

export function HoverScale({ children, scale = 1.02, className }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ========================
   FADE IN VIEW
   ======================== */

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}

export function FadeInView({
  children,
  delay = 0,
  direction = 'up',
  className,
}: FadeInViewProps) {
  const directionOffset = {
    up: { y: 20, x: 0 },
    down: { y: -20, x: 0 },
    left: { y: 0, x: 20 },
    right: { y: 0, x: -20 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directionOffset[direction] }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ========================
   CONFETTI BURST (simple)
   ======================== */

interface ConfettiBurstProps {
  show: boolean;
  count?: number;
}

export function ConfettiBurst({ show, count = 12 }: ConfettiBurstProps) {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];

  return (
    <AnimatePresence>
      {show && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: count }).map((_, i) => (
            <motion.div
              key={i}
              initial={{
                opacity: 1,
                x: '50%',
                y: '50%',
                scale: 0,
              }}
              animate={{
                opacity: 0,
                x: `${50 + (Math.random() - 0.5) * 100}%`,
                y: `${50 + (Math.random() - 0.5) * 100}%`,
                scale: 1,
                rotate: Math.random() * 360,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.8,
                delay: i * 0.02,
                ease: 'easeOut',
              }}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: colors[i % colors.length],
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
