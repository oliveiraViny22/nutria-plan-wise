import { ReactNode, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface LockedFeaturePreviewProps {
  children: ReactNode;
  featureName: string;
  featureKey: string;
  description?: string;
  className?: string;
}

export function LockedFeaturePreview({
  children,
  featureName,
  featureKey,
  description,
  className = '',
}: LockedFeaturePreviewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const trackAndNavigate = useCallback(async () => {
    // Track the conversion event
    if (user) {
      try {
        await supabase.from('conversion_events').insert({
          user_id: user.id,
          event_type: 'unlock_cta_click',
          feature_key: featureKey,
          metadata: { feature_name: featureName },
        });
      } catch (error) {
        console.error('Failed to track conversion event:', error);
      }
    }
    navigate('/pricing');
  }, [user, featureKey, featureName, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-xl ${className}`}
    >
      {/* Blurred content - maintains layout flow */}
      <div className="blur-[6px] select-none pointer-events-none opacity-75">
        {children}
      </div>

      {/* Overlay with CTA - contained within parent bounds */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px] z-10">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col items-center gap-3 text-center p-4"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground text-sm">
              {featureName}
            </h4>
            {description && (
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                {description}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={trackAndNavigate}
            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shimmer-badge-subtle"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Desbloquear com Pro
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
