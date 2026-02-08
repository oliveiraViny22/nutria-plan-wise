import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { LucideIcon } from 'lucide-react';

interface WizardStep {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ContextualWizardProps {
  id: string;
  steps: WizardStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  showOnce?: boolean;
  trigger?: boolean;
}

const WIZARD_STORAGE_PREFIX = 'nutriaplan_wizard_completed_';

export function ContextualWizard({
  id,
  steps,
  onComplete,
  onSkip,
  showOnce = true,
  trigger = true,
}: ContextualWizardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    
    if (showOnce) {
      const completed = localStorage.getItem(`${WIZARD_STORAGE_PREFIX}${id}`);
      if (completed !== 'true') {
        setIsVisible(true);
      }
    } else {
      setIsVisible(true);
    }
  }, [id, showOnce, trigger]);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    if (showOnce) {
      localStorage.setItem(`${WIZARD_STORAGE_PREFIX}${id}`, 'true');
    }
    onComplete?.();
  }, [id, showOnce, onComplete]);

  const handleSkip = useCallback(() => {
    setIsVisible(false);
    if (showOnce) {
      localStorage.setItem(`${WIZARD_STORAGE_PREFIX}${id}`, 'true');
    }
    onSkip?.();
  }, [id, showOnce, onSkip]);

  const handleNext = () => {
    if (currentStep === steps.length - 1) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isVisible || steps.length === 0) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-6 md:w-80"
      >
        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Progress */}
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">
                Passo {currentStep + 1} de {steps.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Progress value={progress} className="h-1" />
          </div>

          {/* Content */}
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="p-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm text-foreground mb-1">
                  {step.title}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>

            {step.action && (
              <Button
                size="sm"
                variant="outline"
                onClick={step.action.onClick}
                className="w-full mt-3 h-8 text-xs"
              >
                {step.action.label}
              </Button>
            )}
          </motion.div>

          {/* Navigation */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex-1 h-8 text-xs"
            >
              <ChevronLeft className="w-3 h-3 mr-1" />
              Anterior
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              className="flex-1 h-8 text-xs"
            >
              {isLastStep ? (
                <>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Concluir
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook para resetar wizards
export function useResetWizards() {
  return useCallback(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(WIZARD_STORAGE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  }, []);
}
