import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Plus, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WeightLogFormProps {
  userId: string;
  currentWeight?: number;
  onWeightLogged: () => void;
}

export function WeightLogForm({ userId, currentWeight, onWeightLogged }: WeightLogFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [weight, setWeight] = useState(currentWeight?.toFixed(1) || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const weightValue = parseFloat(weight);
    
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
      toast.error('Por favor, insira um peso válido');
      return;
    }

    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('weight_logs')
        .upsert({
          user_id: userId,
          weight_kg: weightValue,
          log_date: today,
        }, {
          onConflict: 'user_id,log_date'
        });

      if (error) throw error;

      // Also update profile weight
      await supabase
        .from('profiles')
        .update({ weight: weightValue })
        .eq('user_id', userId);

      toast.success('Peso registrado com sucesso!');
      setIsOpen(false);
      onWeightLogged();
    } catch (error) {
      console.error('Error logging weight:', error);
      toast.error('Erro ao registrar peso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.div
            key="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setWeight(currentWeight?.toFixed(1) || '');
                setIsOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Registrar Peso
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-primary/20 shadow-lg">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary flex-shrink-0" />
                  <Input
                    type="number"
                    step="0.1"
                    min="20"
                    max="500"
                    placeholder="Peso (kg)"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-24 h-8 text-sm"
                    autoFocus
                  />
                  <span className="text-sm text-muted-foreground">kg</span>
                  <div className="flex gap-1 ml-auto">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setIsOpen(false)}
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleSubmit}
                      disabled={loading || !weight}
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}