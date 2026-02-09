import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  Clock, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft,
  Loader2, 
  CheckCircle,
  Info,
  Flame,
  TrendingUp,
  Calculator,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { useObjectiveChange } from '@/hooks/useObjectiveChange';
import { GOALS } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ObjectiveChangeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGoal: string | null;
  onSuccess?: (action: 'generate' | 'rebalance' | 'none') => void;
}

type WizardStep = 'check' | 'info' | 'select' | 'impact' | 'confirm';

const STEP_PROGRESS: Record<WizardStep, number> = {
  check: 10,
  info: 25,
  select: 50,
  impact: 75,
  confirm: 100,
};

const GOAL_ICONS: Record<string, string> = {
  lose_weight: '🔥',
  maintain: '⚖️',
  gain_muscle: '💪',
};

export function ObjectiveChangeWizard({
  open,
  onOpenChange,
  currentGoal,
  onSuccess,
}: ObjectiveChangeWizardProps) {
  const { user, profile } = useAuth();
  const { loading, eligibility, checkEligibility, applyObjectiveChange, getRemainingDays } = useObjectiveChange();
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [step, setStep] = useState<WizardStep>('check');
  const [postAction, setPostAction] = useState<'generate' | 'rebalance' | 'none' | null>(null);

  useEffect(() => {
    if (open) {
      setStep('check');
      setSelectedGoal('');
      setPostAction(null);
      checkEligibility();
    }
  }, [open, checkEligibility]);

  useEffect(() => {
    if (eligibility && step === 'check') {
      if (eligibility.can_change) {
        setStep('info');
      }
    }
  }, [eligibility, step]);

  const handleConfirm = async () => {
    if (!selectedGoal) return;
    
    const result = await applyObjectiveChange(selectedGoal);
    if (result?.success) {
      onOpenChange(false);
      onSuccess?.(postAction || 'none');
    }
  };

  const remainingDays = getRemainingDays();
  const availableGoals = Object.entries(GOALS).filter(([key]) => key !== currentGoal);

  // Fetch targets from backend RPC for consistency
  const [newTargets, setNewTargets] = useState<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(false);

  useEffect(() => {
    if (!selectedGoal || !user?.id) {
      setNewTargets(null);
      return;
    }

    let cancelled = false;
    setLoadingTargets(true);

    supabase
      .rpc('calculate_nutritional_targets', { _user_id: user.id, _goal: selectedGoal })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingTargets(false);
        if (error) {
          console.error('Error calculating targets:', error);
          return;
        }
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsed && !parsed.error) {
          setNewTargets({
            calories: parsed.calories,
            protein: parsed.protein,
            carbs: parsed.carbs,
            fat: parsed.fat,
          });
        }
      });

    return () => { cancelled = true; };
  }, [selectedGoal, user?.id]);

  const goBack = () => {
    const stepOrder: WizardStep[] = ['check', 'info', 'select', 'impact', 'confirm'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 1) {
      setStep(stepOrder[currentIndex - 1]);
    }
  };

  const goNext = () => {
    const stepOrder: WizardStep[] = ['check', 'info', 'select', 'impact', 'confirm'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex < stepOrder.length - 1) {
      setStep(stepOrder[currentIndex + 1]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Alterar Objetivo
          </DialogTitle>
          <DialogDescription>
            Siga os passos para alterar seu objetivo nutricional
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        {step !== 'check' && (
          <div className="space-y-2">
            <Progress value={STEP_PROGRESS[step]} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Passo {Object.keys(STEP_PROGRESS).indexOf(step)} de 4
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step: Check Eligibility */}
          {step === 'check' && !eligibility && (
            <motion.div
              key="check-loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-8"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Verificando elegibilidade...</p>
            </motion.div>
          )}

          {/* Step: Check - Blocked */}
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

          {/* Step: Info */}
          {step === 'info' && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-medium">Antes de continuar, entenda:</p>
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <span>Seu objetivo atual será substituído pelo novo</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Calculator className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <span>Suas metas de calorias e macros serão recalculadas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <RefreshCw className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                        <span>Você poderá gerar um novo plano alimentar adequado</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Clock className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                        <span>Haverá um período de espera antes da próxima alteração ({eligibility?.next_cooldown_days || 14} dias)</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

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
                  onClick={goNext}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step: Select New Goal */}
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
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <span className="text-2xl">{currentGoal ? GOAL_ICONS[currentGoal] : '🎯'}</span>
                  <span className="font-medium">
                    {currentGoal ? GOALS[currentGoal as keyof typeof GOALS]?.label : 'Não definido'}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Novo objetivo</Label>
                <RadioGroup value={selectedGoal} onValueChange={setSelectedGoal}>
                  {availableGoals.map(([key, goal]) => (
                    <Card
                      key={key}
                      className={`cursor-pointer transition-all ${
                        selectedGoal === key 
                          ? 'ring-2 ring-primary border-primary' 
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => setSelectedGoal(key)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={key} id={key} />
                          <span className="text-2xl">{GOAL_ICONS[key]}</span>
                          <div className="flex-1">
                            <Label htmlFor={key} className="font-medium cursor-pointer">
                              {goal.label}
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Ajuste calórico: {goal.calorieAdjustment > 0 ? '+' : ''}{goal.calorieAdjustment} kcal/dia
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedGoal}
                  onClick={goNext}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step: Impact Preview */}
          {step === 'impact' && (loadingTargets ? (
            <motion.div
              key="impact-loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center py-8"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Calculando novas metas...</p>
            </motion.div>
          ) : newTargets && (
            <motion.div
              key="impact"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Suas novas metas serão:
                </Label>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-xl p-4 text-center border">
                    <Flame className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-2xl font-bold text-primary">{newTargets.calories}</p>
                    <p className="text-xs text-muted-foreground">kcal/dia</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center border">
                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-protein/20 flex items-center justify-center">
                      <span className="text-protein font-bold text-xs">P</span>
                    </div>
                    <p className="text-2xl font-bold text-protein">{newTargets.protein}g</p>
                    <p className="text-xs text-muted-foreground">Proteína</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center border">
                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-carbs/20 flex items-center justify-center">
                      <span className="text-carbs font-bold text-xs">C</span>
                    </div>
                    <p className="text-2xl font-bold text-carbs">{newTargets.carbs}g</p>
                    <p className="text-xs text-muted-foreground">Carboidratos</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4 text-center border">
                    <div className="w-5 h-5 mx-auto mb-1 rounded-full bg-fat/20 flex items-center justify-center">
                      <span className="text-fat font-bold text-xs">G</span>
                    </div>
                    <p className="text-2xl font-bold text-fat">{newTargets.fat}g</p>
                    <p className="text-xs text-muted-foreground">Gordura</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  O que deseja fazer após a alteração?
                </Label>
                
                <div className="space-y-2">
                  <Card 
                    className={`cursor-pointer transition-all ${postAction === 'generate' ? 'ring-2 ring-primary' : 'hover:bg-accent'}`}
                    onClick={() => setPostAction('generate')}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Gerar novo plano</p>
                        <p className="text-xs text-muted-foreground">Criar um plano alimentar do zero para o novo objetivo</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card 
                    className={`cursor-pointer transition-all ${postAction === 'rebalance' ? 'ring-2 ring-primary' : 'hover:bg-accent'}`}
                    onClick={() => setPostAction('rebalance')}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Calculator className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-sm">Otimizar plano atual</p>
                        <p className="text-xs text-muted-foreground">Ajustar as quantidades dos alimentos para as novas metas</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card 
                    className={`cursor-pointer transition-all ${postAction === 'none' ? 'ring-2 ring-primary' : 'hover:bg-accent'}`}
                    onClick={() => setPostAction('none')}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">Decidir depois</p>
                        <p className="text-xs text-muted-foreground">Apenas alterar objetivo, sem ajustar plano agora</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={goBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={postAction === null}
                  onClick={goNext}
                >
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ))}

          {/* Step: Confirm */}
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
                    <li>
                      Alterar seu objetivo para{' '}
                      <strong className="inline-flex items-center gap-1">
                        {GOAL_ICONS[selectedGoal]} {GOALS[selectedGoal as keyof typeof GOALS]?.label}
                      </strong>
                    </li>
                    <li>Recalcular suas metas nutricionais</li>
                    {postAction === 'generate' && <li>Iniciar geração de um novo plano alimentar</li>}
                    {postAction === 'rebalance' && <li>Otimizar as quantidades do plano atual para as novas metas</li>}
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Após esta alteração, você precisará aguardar {eligibility?.next_cooldown_days || 14} dias para alterar novamente.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={goBack}
                  disabled={loading}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
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
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Confirmar Alteração
                    </>
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
