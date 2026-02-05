import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HiddenMacroValueProps {
  value: number | string;
  unit?: string;
  isHidden: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'large';
}

/**
 * Component that shows a blurred placeholder when plan is not saved,
 * and reveals the actual value with animation when saved.
 */
export function HiddenMacroValue({ 
  value, 
  unit = '', 
  isHidden, 
  className = '',
  variant = 'default'
}: HiddenMacroValueProps) {
  const displayValue = typeof value === 'number' ? Math.round(value) : value;
  
  const sizeClasses = {
    compact: 'text-xs',
    default: 'text-sm',
    large: 'text-base font-semibold',
  };
  
  if (isHidden) {
    return (
      <span 
        className={cn(
          'inline-flex items-center gap-0.5 select-none',
          sizeClasses[variant],
          className
        )}
      >
        <span className="blur-[4px] opacity-60 text-muted-foreground">
          ???
        </span>
        {unit && (
          <span className="text-muted-foreground/50 text-[0.85em]">{unit}</span>
        )}
      </span>
    );
  }
  
  return (
    <motion.span
      initial={{ opacity: 0, filter: 'blur(8px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'inline-flex items-center gap-0.5',
        sizeClasses[variant],
        className
      )}
    >
      <span>{displayValue}</span>
      {unit && <span className="text-[0.85em]">{unit}</span>}
    </motion.span>
  );
}

interface HiddenMacroBlockProps {
  protein: number;
  carbs: number;
  fat: number;
  calories?: number;
  isHidden: boolean;
  compact?: boolean;
}

/**
 * Block component showing all macros with hidden/revealed state
 */
export function HiddenMacroBlock({ 
  protein, 
  carbs, 
  fat, 
  calories,
  isHidden,
  compact = false
}: HiddenMacroBlockProps) {
  const variant = compact ? 'compact' : 'default';
  
  return (
    <div className={cn(
      'flex items-center gap-2 flex-wrap',
      compact ? 'text-xs' : 'text-sm'
    )}>
      {calories !== undefined && (
        <>
          <span className="text-muted-foreground">
            <HiddenMacroValue value={calories} unit="kcal" isHidden={isHidden} variant={variant} />
          </span>
          <span className="text-muted-foreground/50">•</span>
        </>
      )}
      <span className="text-blue-600 dark:text-blue-400">
        P: <HiddenMacroValue value={protein} unit="g" isHidden={isHidden} variant={variant} />
      </span>
      <span className="text-muted-foreground/50">•</span>
      <span className="text-amber-600 dark:text-amber-400">
        C: <HiddenMacroValue value={carbs} unit="g" isHidden={isHidden} variant={variant} />
      </span>
      <span className="text-muted-foreground/50">•</span>
      <span className="text-rose-600 dark:text-rose-400">
        G: <HiddenMacroValue value={fat} unit="g" isHidden={isHidden} variant={variant} />
      </span>
    </div>
  );
}
