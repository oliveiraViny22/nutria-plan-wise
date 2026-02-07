import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, UtensilsCrossed, Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface GenerationProgressDialogProps {
  isOpen: boolean;
  type: 'generate' | 'optimize';
  title?: string;
  description?: string;
}

const STAGES_GENERATE = [
  { label: 'Analisando perfil nutricional...', icon: '👤' },
  { label: 'Selecionando alimentos...', icon: '🥗' },
  { label: 'Montando refeições...', icon: '🍽️' },
  { label: 'Validando macros...', icon: '📊' },
  { label: 'Finalizando plano...', icon: '✨' },
];

const STAGES_OPTIMIZE = [
  { label: 'Analisando plano atual...', icon: '📊' },
  { label: 'Calculando ajustes...', icon: '🔢' },
  { label: 'Validando opções...', icon: '✅' },
  { label: 'Finalizando...', icon: '🎯' },
];

function ProgressBar({ isActive, stagesCount }: { isActive: boolean; stagesCount: number }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  // Reset and animate progress
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      setStage(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return 95;
        const increment = Math.random() * 12 + 3;
        return Math.min(prev + increment, 95);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isActive]);

  // Update stage based on progress
  useEffect(() => {
    const stageThreshold = 100 / stagesCount;
    const currentStage = Math.min(
      Math.floor(progress / stageThreshold),
      stagesCount - 1
    );
    setStage(currentStage);
  }, [progress, stagesCount]);

  return { progress, stage };
}

export function GenerationProgressDialog({
  isOpen,
  type,
  title,
  description,
}: GenerationProgressDialogProps) {
  const stages = type === 'generate' ? STAGES_GENERATE : STAGES_OPTIMIZE;
  const { progress, stage } = ProgressBar({ isActive: isOpen, stagesCount: stages.length });
  
  const Icon = type === 'generate' ? UtensilsCrossed : Target;
  const defaultTitle = type === 'generate' ? 'Gerando Plano' : 'Otimizando Plano';
  const defaultDescription = type === 'generate' 
    ? 'A IA está criando seu plano nutricional personalizado'
    : 'A IA está analisando e ajustando seu plano nutricional';

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-sm" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Icon className="w-5 h-5 text-primary" />
            </motion.div>
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription>
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Current stage indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <Zap className="w-4 h-4 text-primary" />
            </motion.div>
            <motion.span 
              key={stage}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-medium text-foreground"
            >
              {stages[stage].icon} {stages[stage].label}
            </motion.span>
          </div>

          {/* Progress bar with shimmer effect */}
          <div className="relative">
            <Progress value={progress} className="h-2.5" />
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full overflow-hidden"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              style={{ width: '50%' }}
            />
          </div>

          {/* Progress percentage and status */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Sparkles className="w-3 h-3 text-primary" />
              </motion.div>
              <span>Processando com IA</span>
            </div>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>

          {/* Stage indicators */}
          <div className="flex justify-center gap-1.5 pt-1">
            {stages.map((_, idx) => (
              <motion.div
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx <= stage ? 'bg-primary' : 'bg-muted'
                }`}
                animate={idx === stage ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, repeat: idx === stage ? Infinity : 0 }}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
