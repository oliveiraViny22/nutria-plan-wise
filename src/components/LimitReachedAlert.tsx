import { AlertTriangle, Lock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface LimitReachedAlertProps {
  feature: 'diet' | 'substitution' | 'adjustment' | 'chat';
  current: number;
  limit: number;
  planName?: string;
  onDismiss?: () => void;
  compact?: boolean;
}

const FEATURE_LABELS: Record<string, { title: string; description: string }> = {
  diet: {
    title: 'Limite de dietas atingido',
    description: 'Você utilizou todas as dietas disponíveis no seu plano este mês.',
  },
  substitution: {
    title: 'Limite de substituições atingido',
    description: 'Você utilizou todas as substituições disponíveis no seu plano este mês.',
  },
  adjustment: {
    title: 'Limite de ajustes atingido',
    description: 'Você utilizou todos os ajustes disponíveis no seu plano este mês.',
  },
  chat: {
    title: 'Limite de mensagens atingido',
    description: 'Você utilizou todas as mensagens do chat disponíveis hoje.',
  },
};

export function LimitReachedAlert({
  feature,
  current,
  limit,
  planName,
  onDismiss,
  compact = false,
}: LimitReachedAlertProps) {
  const navigate = useNavigate();
  const { title, description } = FEATURE_LABELS[feature];

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
        <Lock className="w-3 h-3 flex-shrink-0" />
        <span>{title}</span>
        <Button
          variant="link"
          size="sm"
          className="text-xs h-auto p-0 text-primary"
          onClick={() => navigate('/pricing')}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-destructive text-sm sm:text-base">
              {title}
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {description}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>
                  {current}/{limit} {feature === 'chat' ? 'mensagens' : feature === 'diet' ? 'dietas' : feature === 'substitution' ? 'substituições' : 'ajustes'}
                </span>
              </div>
              {planName && (
                <span className="text-xs text-muted-foreground">
                  • Plano {planName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={() => navigate('/pricing')}
          >
            <Zap className="w-4 h-4 mr-1" />
            Ver planos
          </Button>
          {onDismiss && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDismiss}
            >
              Fechar
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
