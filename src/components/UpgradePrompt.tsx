import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Check, Zap, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const UPGRADE_FEATURES = [
  'Dietas ilimitadas',
  'Chat com IA',
  'Registro diário',
  'Acompanhamento',
  'Substituições livres',
  'Ajustes automáticos',
];

interface UpgradePromptProps {
  /** Where this prompt is being shown — used for conversion tracking */
  source: string;
  /** Visual variant */
  variant?: 'card' | 'inline' | 'banner';
  /** Custom title */
  title?: string;
  /** Custom description */
  description?: string;
  /** Show feature list */
  showFeatures?: boolean;
  /** Custom CTA label */
  ctaLabel?: string;
  className?: string;
}

export function UpgradePrompt({
  source,
  variant = 'card',
  title = 'Desbloqueie todo o potencial',
  description = 'Com o plano Pessoal, você tem acesso a dietas ilimitadas, chat com IA, registro diário, acompanhamento de progresso e muito mais.',
  showFeatures = true,
  ctaLabel = 'Ver Planos e Preços',
  className = '',
}: UpgradePromptProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const trackAndNavigate = async () => {
    // Track conversion event
    if (user) {
      try {
        await supabase.from('conversion_events').insert({
          user_id: user.id,
          event_type: 'click_upgrade',
          feature_key: source,
          metadata: { variant },
        });
      } catch {
        // Non-blocking — don't fail the navigation
      }
    }
    navigate('/pricing');
  };

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 ${className}`}>
        <div className="p-2 rounded-lg bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        <Button size="sm" onClick={trackAndNavigate}>
          <Zap className="h-3.5 w-3.5 mr-1" />
          Upgrade
        </Button>
      </div>
    );
  }

  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 flex items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <Crown className="h-5 w-5 text-primary flex-shrink-0" />
          <p className="text-sm font-medium">{title}</p>
        </div>
        <Button size="sm" onClick={trackAndNavigate}>
          <Zap className="h-3.5 w-3.5 mr-1" />
          {ctaLabel}
        </Button>
      </motion.div>
    );
  }

  // Default: card variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className="border-primary/30 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
          {showFeatures && (
            <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
              {UPGRADE_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}
          <Button size="lg" className="mt-2" onClick={trackAndNavigate}>
            <Zap className="h-4 w-4 mr-2" />
            {ctaLabel}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
