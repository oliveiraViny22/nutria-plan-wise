import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Check, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSuccessSound } from '@/hooks/useSuccessSound';

interface SavePlanButtonProps {
  planId: string;
  isSaved: boolean;
  onSave: () => void;
  compact?: boolean;
}

export function SavePlanButton({ planId, isSaved, onSave, compact = false }: SavePlanButtonProps) {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { playSuccessSound, triggerStartFeedback } = useSuccessSound();

  const handleSave = async () => {
    if (isSaved || saving) return;
    
    setSaving(true);
    triggerStartFeedback();
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .update({ is_saved: true })
        .eq('id', planId);
      
      if (error) throw error;
      
      setJustSaved(true);
      playSuccessSound();
      toast.success('Plano salvo! Agora você pode ver todos os detalhes.');
      onSave();
      
      // Reset animation state after delay
      setTimeout(() => setJustSaved(false), 3000);
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao salvar plano. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (isSaved) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`flex items-center justify-center gap-2 ${compact ? 'py-2' : 'py-3'} px-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400`}
      >
        <Check className="w-4 h-4" />
        <span className="text-sm font-medium">Plano Salvo</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      <Button
        onClick={handleSave}
        disabled={saving}
        size={compact ? 'default' : 'lg'}
        className={`
          w-full gap-2 relative overflow-hidden
          gradient-gold
          text-primary-foreground font-semibold tracking-wide
          shadow-gold
          ${compact ? 'h-10' : 'h-12'}
        `}
      >
        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ 
            repeat: Infinity, 
            duration: 2.5, 
            ease: 'linear',
            repeatDelay: 1.5 
          }}
        />
        
        <AnimatePresence mode="wait">
          {saving ? (
            <motion.div
              key="saving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </motion.div>
          ) : justSaved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Salvo!</span>
            </motion.div>
          ) : (
            <motion.div
              key="save"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Meu Plano</span>
              <Sparkles className="w-3.5 h-3.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
      
      {!compact && (
        <p className="text-xs text-center text-muted-foreground">
          Personalize suas refeições e salve para ver os detalhes nutricionais
        </p>
      )}
    </motion.div>
  );
}
