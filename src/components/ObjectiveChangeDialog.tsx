import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Clock, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useObjectiveChange } from '@/hooks/useObjectiveChange';
import { GOALS } from '@/lib/types';

interface ObjectiveChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGoal: string | null;
  onSuccess?: () => void;
}

export function ObjectiveChangeDialog({
  open,
  onOpenChange,
  currentGoal,
  onSuccess,
}: ObjectiveChangeDialogProps) {
  const { loading, eligibility, checkEligibility, applyObjectiveChange, getRemainingDays } = useObjectiveChange();
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [step, setStep] = useState<'check' | 'select' | 'confirm'>('check');

  useEffect(() => {
    if (open) {
      setStep('check');
      setSelectedGoal('');
      checkEligibility();
    }
  }, [open, checkEligibility]);

  useEffect(() => {
    if (eligibility && step === 'check') {
      if (eligibility.can_change) {
        setStep('select');
      }
    }
  }, [eligibility, step]);

  const handleConfirm = async () => {
    if (!selectedGoal) return;
    
    const result = await applyObjectiveChange(selectedGoal);
    if (result?.success) {
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const remainingDays = getRemainingDays();

  const availableGoals = Object.entries(GOALS).filter(([key]) => key !== currentGoal);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Alterar Objetivo
          </DialogTitle>
          <DialogDescription>
            Alterar seu objetivo encerrará o plano atual e criará um novo.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'check' && (
            <motion.div
              key="check"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-8"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Verificando elegibilidade...</p>
            </motion.div>
          )}

          {step === 'check' && eligibility && !eligibility.can_change && (
            <motion.div
              key="blocked"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <Alert variant="destructive">
                <Clock className="h-4 w-4" />
                <AlertTitle>Alteração bloqueada</AlertTitle>
                <AlertDescription>
                  {eligibility.reason}
                  {remainingDays !== null && remainingDays > 0 && (
                    <span className="block mt-2 font-medium">
                      Faltam {remainingDays} dias para liberar.
                    </span>
                  )}
                </AlertDescription>
              </Alert>

              {eligibility.change_count > 0 && (
                <p className="text-sm text-muted-foreground">
                  Você já alterou seu objetivo {eligibility.change_count} vez(es).
                </p>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => onOpenChange(false)}
              >
                Entendi
              </Button>
            </motion.div>
          )}

          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Objetivo atual</Label>
                <p className="text-sm font-medium text-primary">
                  {currentGoal ? GOALS[currentGoal as keyof typeof GOALS]?.label : 'Não definido'}
                </p>
              </div>

              <div className="space-y-3">
                <Label>Novo objetivo</Label>
                <RadioGroup value={selectedGoal} onValueChange={setSelectedGoal}>
                  {availableGoals.map(([key, goal]) => (
                    <div
                      key={key}
                      className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setSelectedGoal(key)}
                    >
                      <RadioGroupItem value={key} id={key} />
                      <Label htmlFor={key} className="flex-1 cursor-pointer">
                        <span className="font-medium">{goal.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          Ajuste calórico: {goal.calorieAdjustment > 0 ? '+' : ''}{goal.calorieAdjustment} kcal
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {eligibility?.next_cooldown_days && (
                <p className="text-xs text-muted-foreground">
                  Após esta alteração, você precisará aguardar {eligibility.next_cooldown_days} dias para alterar novamente.
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedGoal}
                  onClick={() => setStep('confirm')}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Confirmar alteração</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>Esta ação irá:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Encerrar seu plano alimentar atual</li>
                    <li>Alterar seu objetivo para <strong>{GOALS[selectedGoal as keyof typeof GOALS]?.label}</strong></li>
                    <li>Recalcular suas metas nutricionais</li>
                    <li>Você precisará gerar um novo plano</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep('select')}
                  disabled={loading}
                >
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirm}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    'Confirmar Alteração'
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
