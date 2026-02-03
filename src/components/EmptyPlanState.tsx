import { motion } from 'framer-motion';
import { 
  UtensilsCrossed, 
  Sparkles, 
  ArrowRight,
  Salad,
  Target,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UsageLimitsBadge } from '@/components/UsageLimitsBadge';
import { useUsageLimits } from '@/hooks/useUsageLimits';

interface EmptyPlanStateProps {
  onGeneratePlan: () => void;
  isGenerating: boolean;
  isLinkedStudent?: boolean;
}

export function EmptyPlanState({ onGeneratePlan, isGenerating, isLinkedStudent }: EmptyPlanStateProps) {
  if (isLinkedStudent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-12 px-4"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6">
          <Timer className="w-12 h-12 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">
          Aguardando seu plano
        </h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
          Seu nutricionista está preparando um plano alimentar personalizado para você. 
          Em breve ele aparecerá aqui!
        </p>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="flex -space-x-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-primary/70 animate-pulse delay-100" />
            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse delay-200" />
          </div>
          <span>Preparando...</span>
        </div>
      </motion.div>
    );
  }

  const { usage, isLimitReached, isAdmin } = useUsageLimits();
  const dietLimitReached = isLimitReached('diet');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-background to-accent/5 border border-primary/10 p-6 sm:p-8"
    >
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/25"
        >
          <UtensilsCrossed className="w-10 h-10 text-primary-foreground" />
        </motion.div>

        {/* Content */}
        <div className="text-center mb-4">
          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
            Crie seu plano alimentar
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
            Baseado no seu perfil, vamos gerar um plano personalizado com refeições 
            balanceadas para atingir seus objetivos.
          </p>
        </div>
        
        {/* Usage Limits Badge */}
        {!isAdmin && usage && (
          <div className="flex justify-center mb-6">
            <UsageLimitsBadge feature="diet" showLabel />
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 mb-6 max-w-sm mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Personalizado</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-2">
              <Salad className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xs text-muted-foreground">Balanceado</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">Otimizado</span>
          </motion.div>
        </div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex justify-center"
        >
          <Button
            size="lg"
            onClick={onGeneratePlan}
            disabled={isGenerating || dietLimitReached}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2 px-8 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-5 h-5" />
                </motion.div>
                <span>Gerando plano...</span>
              </>
            ) : dietLimitReached ? (
              <>
                <span>Limite atingido</span>
              </>
            ) : (
              <>
                <span>Gerar meu plano</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
