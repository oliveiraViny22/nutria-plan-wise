import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Plus, Check, X, Loader2, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeightLogFormProps {
  userId: string;
  currentWeight?: number;
  onWeightLogged: () => void;
}

export function WeightLogForm({ userId, currentWeight, onWeightLogged }: WeightLogFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [weight, setWeight] = useState(currentWeight?.toFixed(1) || '');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSubmit = async () => {
    const weightValue = parseFloat(weight);
    
    if (isNaN(weightValue) || weightValue < 20 || weightValue > 500) {
      toast.error('Peso inválido (20-500 kg)');
      return;
    }

    setLoading(true);
    try {
      const logDate = format(selectedDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('weight_logs')
        .upsert({
          user_id: userId,
          weight_kg: weightValue,
          log_date: logDate,
        }, {
          onConflict: 'user_id,log_date'
        });

      if (error) throw error;

      // Update profile weight if logging for today
      const isToday = format(new Date(), 'yyyy-MM-dd') === logDate;
      if (isToday) {
        await supabase
          .from('profiles')
          .update({ weight: weightValue })
          .eq('user_id', userId);
      }

      toast.success(`Peso de ${weightValue.toFixed(1)} kg registrado para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}`);
      setIsOpen(false);
      setSelectedDate(new Date());
      onWeightLogged();
    } catch (error) {
      console.error('Error logging weight:', error);
      toast.error('Erro ao registrar peso');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only valid decimal format
    if (value === '' || /^\d*\.?\d{0,1}$/.test(value)) {
      setWeight(value);
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
                setSelectedDate(new Date());
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
              <CardContent className="p-3 space-y-3">
                {/* Date Picker */}
                <div className="flex items-center gap-2">
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal flex-1 h-8",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? (
                          format(selectedDate, "dd 'de' MMM, yyyy", { locale: ptBR })
                        ) : (
                          <span>Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          if (date) {
                            setSelectedDate(date);
                            setCalendarOpen(false);
                          }
                        }}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Weight Input */}
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-primary flex-shrink-0" />
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="Peso"
                    value={weight}
                    onChange={handleWeightChange}
                    className="w-20 h-8 text-sm"
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