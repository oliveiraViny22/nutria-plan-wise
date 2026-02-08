import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeatureTooltipProps {
  id: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
  showOnce?: boolean;
  delay?: number;
}

const TOOLTIP_STORAGE_PREFIX = 'nutriaplan_tooltip_seen_';

export function FeatureTooltip({
  id,
  title,
  description,
  position = 'bottom',
  children,
  showOnce = true,
  delay = 500,
}: FeatureTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSeen, setHasSeen] = useState(true);

  useEffect(() => {
    if (showOnce) {
      const seen = localStorage.getItem(`${TOOLTIP_STORAGE_PREFIX}${id}`);
      setHasSeen(seen === 'true');
      
      if (!seen) {
        const timer = setTimeout(() => setIsVisible(true), delay);
        return () => clearTimeout(timer);
      }
    } else {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [id, showOnce, delay]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    if (showOnce) {
      localStorage.setItem(`${TOOLTIP_STORAGE_PREFIX}${id}`, 'true');
      setHasSeen(true);
    }
  }, [id, showOnce]);

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const arrowClasses = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-primary/20',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-primary/20',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-primary/20',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-primary/20',
  };

  if (hasSeen && showOnce) {
    return <>{children}</>;
  }

  return (
    <div className="relative inline-block">
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`absolute z-50 ${positionClasses[position]}`}
          >
            <div className="w-64 p-3 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 shadow-lg backdrop-blur-sm">
              {/* Arrow */}
              <div className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`} />
              
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary shrink-0" />
                  <h4 className="font-medium text-sm text-foreground">{title}</h4>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {description}
              </p>
              
              {/* Action */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="w-full h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                Entendi
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Hook para resetar todos os tooltips vistos
export function useResetTooltips() {
  return useCallback(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(TOOLTIP_STORAGE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }, []);
}
