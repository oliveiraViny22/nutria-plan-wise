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
          className="flex flex-col items-center gap-2 sm:gap-3 text-center p-3 sm:p-4 max-w-full"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 flex-shrink-0">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0 max-w-full">
            <h4 className="font-semibold text-foreground text-xs sm:text-sm truncate">
              {featureName}
            </h4>
            {description && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 max-w-[180px] sm:max-w-[200px] mx-auto line-clamp-2">
                {description}
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={trackAndNavigate}
            className="gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-3 sm:px-4 gradient-primary hover:opacity-90 shimmer-badge-subtle"
          >
            <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
            <span className="truncate">Desbloquear Pro</span>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
