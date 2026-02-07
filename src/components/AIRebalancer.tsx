import { useState } from 'react';
import { cn } from '@/lib/utils';
import { parseServingGrams } from '@/lib/serving-size';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSuccessSound } from '@/hooks/useSuccessSound';
import { SuccessAnimation } from '@/components/SuccessAnimation';
import { GenerationProgressDialog } from '@/components/GenerationProgressDialog';
import { toast } from 'sonner';

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AdjustmentProposal {
  mealOptionFoodId: string;
  mealId: string;
  mealOptionId: string;
  mealName: string;
  foodName: string;
  foodId: string;
  originalGrams: number;
  newGrams: number;
  reason: string;
}

interface OptionValidation {
  optionNumber: number;
  status: 'VALIDATED' | 'VALIDATED_WITH_TOLERANCE' | 'STRUCTURALLY_INVALID';
  metrics: {
    caloriePercent: number;
    proteinPercent: number;
    carbPercent: number;
    fatPercent: number;
  };
  isValid: boolean;
  isHardFail?: boolean;
  retriesUsed?: number;
}

interface RebalanceMeta {
  totalRetriesPerformed: number;
  maxRetriesPerOption: number;
  maxTotalRetries: number;
  retriesPerOption: Record<number, number>;
  hardFailOptions: number[];
}

interface AIRebalanceResult {
  success: boolean;
  alreadyOptimized?: boolean;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  proposedMacros?: MacroTargets;
  adjustments?: AdjustmentProposal[];
  explanation?: string;
  warnings?: string[];
  message?: string;
  warning?: string;
  currentPercentages?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  // v2.5: Validações por opção
  optionValidations?: OptionValidation[];
  meta?: RebalanceMeta;
}

interface UsageLimitInfo {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
}

interface AIRebalancerProps {
  planId: string;
  targets: MacroTargets;
  currentMacros: MacroTargets;
  userGoal?: 'gain_muscle' | 'lose_weight' | 'maintain';
  onComplete: () => void;
  compact?: boolean;
  usageInfo?: UsageLimitInfo;
  isLimitReached?: boolean;
}

function MacroComparisonCard({
  label,
  current,
  target,
  proposed,
  unit = 'g',
  colorVar,
}: {
  label: string;
  current: number;
  target: number;
  proposed: number;
  unit?: string;
  colorVar: 'protein' | 'carbs' | 'fat' | 'primary';
}) {
  const currentDiff = current - target;
  const proposedDiff = proposed - target;
  const improved =
    Math.abs(proposedDiff) < Math.abs(currentDiff) || 
    (proposedDiff >= 0 && currentDiff < 0);
  
  const maxValue = Math.max(current, target, proposed) * 1.1;
  const targetPercent = (target / maxValue) * 100;
  const currentPercent = Math.min((current / maxValue) * 100, 100);
  const proposedPercent = Math.min((proposed / maxValue) * 100, 100);
  
  const colorClasses = {
    protein: 'bg-protein text-protein',
    carbs: 'bg-carbs text-carbs',
    fat: 'bg-fat text-fat',
    primary: 'bg-primary text-primary',
  };
  
  const bgColorClasses = {
    protein: 'bg-protein-soft',
    carbs: 'bg-carbs-soft',
    fat: 'bg-fat-soft',
    primary: 'bg-primary/15',
  };

  // Helper para formatar números com no máximo 2 casas decimais
  const fmt = (n: number) => Number.isInteger(n) ? n : parseFloat(n.toFixed(2));
  const fmtDiff = (n: number) => {
    const val = fmt(n);
    return val > 0 ? `+${val}` : String(val);
  };

  return (
    <div className="p-3 rounded-xl bg-card border border-border/50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        <span className={`text-xs font-semibold whitespace-nowrap ${colorClasses[colorVar].split(' ')[1]}`}>
          Meta: {fmt(target)}{unit}
        </span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Atual</div>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-lg font-bold text-foreground">{fmt(current)}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {currentDiff !== 0 && (
              <span className={`text-xs font-medium whitespace-nowrap ${currentDiff < 0 ? 'text-destructive' : 'text-amber-500'}`}>
                ({fmtDiff(currentDiff)})
              </span>
            )}
          </div>
        </div>
        
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        
        <div className="flex-1 min-w-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Proposto</div>
          <div className="flex items-baseline gap-1 justify-end flex-wrap">
            <span className={`text-lg font-bold ${improved ? 'text-primary' : 'text-foreground'}`}>
              {fmt(proposed)}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {improved && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </div>
        </div>
      </div>
      
      <div className="relative h-1.5 rounded-full overflow-hidden bg-muted/60">
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/40 z-10"
          style={{ left: `${targetPercent}%` }}
        />
        <motion.div
          className={`absolute top-0 bottom-0 left-0 ${bgColorClasses[colorVar]} opacity-60`}
          initial={{ width: 0 }}
          animate={{ width: `${currentPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        <motion.div
          className={`absolute top-0 bottom-0 left-0 ${colorClasses[colorVar].split(' ')[0]} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${proposedPercent}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  );
}
// AdjustmentItem removido - não há mais listagem de ajustes propostos

// Componente para exibir status de validação por opção (v2.5)
function OptionValidationStatus({ validations, meta }: { 
  validations: OptionValidation[]; 
  meta?: RebalanceMeta;
}) {
  const allValid = validations.every(v => v.isValid);
  const validCount = validations.filter(v => v.isValid).length;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Validação por Opção</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          allValid 
            ? 'bg-primary/15 text-primary' 
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        }`}>
          {validCount}/{validations.length} válidas
        </span>
      </div>
      
      <div className="grid grid-cols-3 gap-2">
        {validations.map((validation, idx) => {
          const isValid = validation.isValid;
          const isHardFail = validation.isHardFail;
          const retriesUsed = validation.retriesUsed || 0;
          
          return (
            <motion.div
              key={validation.optionNumber}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-3 rounded-xl border text-center transition-all ${
                isValid
                  ? 'bg-primary/5 border-primary/30'
                  : isHardFail
                  ? 'bg-destructive/10 border-destructive/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-center gap-1 mb-1">
                {isValid ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : isHardFail ? (
                  <X className="w-4 h-4 text-destructive" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
                <span className="text-sm font-semibold">Opção {validation.optionNumber}</span>
              </div>
              
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <div>Cal: {validation.metrics.caloriePercent.toFixed(0)}%</div>
                <div>Prot: {validation.metrics.proteinPercent.toFixed(0)}%</div>
                <div>Carb: {validation.metrics.carbPercent.toFixed(0)}%</div>
                <div>Gord: {validation.metrics.fatPercent.toFixed(0)}%</div>
              </div>
              
              {retriesUsed > 0 && (
                <div className="mt-1 text-[10px] text-muted-foreground/70">
                  {retriesUsed} retry{retriesUsed > 1 ? 's' : ''}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
      
      {meta && meta.totalRetriesPerformed > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          Total: {meta.totalRetriesPerformed} retries automáticos executados
        </div>
      )}
    </motion.div>
  );
}

// Componente de celebração para plano totalmente validado
function FullConvergenceCelebration({ show }: { show: boolean }) {
  if (!show) return null;
  
  const confettiColors = [
    'hsl(var(--primary))',
    'hsl(142, 76%, 36%)', // green
    'hsl(45, 93%, 47%)',  // gold
    'hsl(217, 91%, 60%)', // blue
    'hsl(280, 87%, 65%)', // purple
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 text-center relative overflow-hidden"
    >
      {/* Confetti burst */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{ 
            backgroundColor: confettiColors[i % confettiColors.length],
            left: '50%',
            top: '50%',
          }}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200,
            scale: [0, 1, 0.5, 0],
            rotate: Math.random() * 720,
          }}
          transition={{
            duration: 1.5,
            delay: 0.1 + (i * 0.03),
            ease: 'easeOut',
          }}
        />
      ))}
      
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
      >
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-primary/20 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <Check className="w-8 h-8 text-primary" />
          </motion.div>
        </div>
      </motion.div>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-lg font-bold text-foreground mb-1"
      >
        🎉 Plano 100% Validado!
      </motion.h3>
      
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-sm text-muted-foreground"
      >
        Todas as opções estão dentro das metas nutricionais
      </motion.p>
    </motion.div>
  );
}

export function AIRebalancer({
  planId,
  targets,
  currentMacros,
  userGoal,
  onComplete,
  compact = false,
  usageInfo,
  isLimitReached = false,
}: AIRebalancerProps) {
  const { user } = useAuth();
  const { playSuccessSound, triggerStartFeedback } = useSuccessSound();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<AIRebalanceResult | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const handleOptimize = async () => {
    setLoading(true);
    setResult(null);
    triggerStartFeedback(); // Vibração rápida ao iniciar otimização
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-rebalance', {
        body: { planId, targets, goal: userGoal || 'maintain' },
      });

      if (error) throw error;
      
      // Verificar erro explícito na resposta
      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Verificar status no nível raiz ou dentro de result
      const resultStatus = data.status || data.result?.status;
      const structuralIssue = data.structural_issue || data.result?.structural_issue;
      const isSuccess = data.success !== false; // Tratar ausência como true

      // Tratar caso de plano estruturalmente inválido
      if (resultStatus === 'structurally_invalid') {
        console.error('[AIRebalancer] Plano estruturalmente inválido:', structuralIssue);
        
        if (structuralIssue?.reason) {
          toast.error('Plano precisa ser regenerado', {
            description: structuralIssue.reason,
            duration: 10000,
          });
        } else {
          toast.error('Não foi possível otimizar o plano', {
            description: data.explanation || 'A composição atual não permite ajustes dentro das metas.',
            duration: 8000,
          });
        }
        return;
      }

      // Tratar caso de erro genérico (success: false)
      if (!isSuccess || resultStatus === 'error') {
        console.warn('[AIRebalancer] Otimização falhou:', data.explanation);
        
        // Mostrar warnings se existirem
        const warnings = data.warnings as string[] | undefined;
        if (warnings && warnings.length > 0) {
          toast.warning('Otimização parcial', {
            description: warnings.slice(0, 2).join(' | '),
            duration: 8000,
          });
        } else {
          toast.error('Não foi possível otimizar o plano', {
            description: data.explanation || 'Verifique se as metas são realistas para os alimentos disponíveis.',
            duration: 8000,
          });
        }
        return;
      }

      setResult(data);
      setShowDialog(true);
    } catch (error: unknown) {
      console.error('AI Rebalance error:', error);
      toast.error('Erro ao calcular ajustes com IA', {
        description: error instanceof Error ? error.message : 'Tente novamente mais tarde.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Sincroniza os totais do diet_plans com os valores corretos do backend
  // Isso corrige discrepâncias entre o que está salvo e o que é calculado
  const syncPlanTotalsFromBackend = async () => {
    if (!result?.currentMacros) return;
    
    console.log('[syncPlanTotals] Sincronizando totais do plano com backend...');
    
    const { error } = await supabase
      .from('diet_plans')
      .update({
        total_calories: Math.round(result.currentMacros.calories),
        total_protein: Math.round(result.currentMacros.protein),
        total_carbs: Math.round(result.currentMacros.carbs),
        total_fat: Math.round(result.currentMacros.fat),
      })
      .eq('id', planId);
    
    if (error) {
      console.error('[syncPlanTotals] Erro ao sincronizar:', error);
    } else {
      console.log('[syncPlanTotals] Totais sincronizados com sucesso');
    }
  };

  const handleConfirm = async () => {
    console.log('[handleConfirm] Starting with result:', result);
    console.log('[handleConfirm] Adjustments count:', result?.adjustments?.length);
    
    if (!result || !result.adjustments || !result.adjustments.length) {
      console.warn('[handleConfirm] No adjustments to apply');
      
      // Se alreadyOptimized, sincronizar totais do plano antes de fechar
      if (result?.alreadyOptimized) {
        await syncPlanTotalsFromBackend();
        toast.success('Plano já está otimizado! ✅', {
          description: 'Totais sincronizados com sucesso.'
        });
        setShowDialog(false);
        setResult(null);
        onComplete();
        return;
      }
      
      toast.info('Nenhum ajuste para aplicar');
      return;
    }

    setApplying(true);
    try {
      // ===============================================================
      // ESTRATÉGIA: Aplicar ajustes em batches para evitar timeout
      // ===============================================================
      
      // FASE 1: Aplicar ajustes em batches de 10 para evitar sobrecarga no banco
      console.log('[handleConfirm] Phase 1: Applying adjustments in batches...');
      
      const BATCH_SIZE = 10;
      const adjustments = result.adjustments;
      let updatedCount = 0;
      
      for (let i = 0; i < adjustments.length; i += BATCH_SIZE) {
        const batch = adjustments.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (adj) => {
          const { error } = await supabase
            .from('meal_option_foods')
            .update({ quantity_grams: adj.newGrams })
            .eq('id', adj.mealOptionFoodId);
          
          if (error) {
            console.error(`[handleConfirm] Error updating ${adj.foodName}:`, error);
            throw new Error(`Falha ao atualizar ${adj.foodName}: ${error.message || error.code}`);
          }
          console.log(`[handleConfirm] Updated ${adj.foodName}: ${adj.originalGrams}g → ${adj.newGrams}g`);
          return adj;
        });
        
        await Promise.all(batchPromises);
        updatedCount += batch.length;
        console.log(`[handleConfirm] Batch ${Math.floor(i / BATCH_SIZE) + 1} complete: ${updatedCount}/${adjustments.length} foods updated`);
      }
      
      console.log(`[handleConfirm] Phase 1 complete: ${adjustments.length} foods updated`);
      
      // FASE 2: Atualizar totais do plano com proposedMacros do backend
      console.log('[handleConfirm] Phase 2: Updating plan totals from proposedMacros...');
      
      const proposedMacros = result.proposedMacros || result.currentMacros;
      
      const { error: planUpdateErr } = await supabase
        .from('diet_plans')
        .update({
          total_calories: Math.round(proposedMacros.calories),
          total_protein: Math.round(proposedMacros.protein),
          total_carbs: Math.round(proposedMacros.carbs),
          total_fat: Math.round(proposedMacros.fat),
        })
        .eq('id', planId);

      if (planUpdateErr) {
        console.error('[handleConfirm] Error updating plan:', planUpdateErr);
        throw new Error(`Falha ao atualizar totais do plano: ${planUpdateErr.message || planUpdateErr.code}`);
      }

      console.log(`[handleConfirm] ✅ Plan totals updated: ${Math.round(proposedMacros.calories)} kcal, P:${Math.round(proposedMacros.protein)}g, C:${Math.round(proposedMacros.carbs)}g, F:${Math.round(proposedMacros.fat)}g`);

      // Cleanup and success
      setShowDialog(false);
      setResult(null);
      
      // Show success animation overlay
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2500);
      
      toast.success('Plano ajustado com sucesso! ✅', {
        description: `${Math.round(proposedMacros.calories)} kcal | P: ${Math.round(proposedMacros.protein)}g | C: ${Math.round(proposedMacros.carbs)}g | G: ${Math.round(proposedMacros.fat)}g`
      });
      playSuccessSound();
      onComplete();
    } catch (error: unknown) {
      console.error('[handleConfirm] Error applying adjustments:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Erro desconhecido. Tente novamente.';
      toast.error('Erro ao aplicar ajustes', {
        description: errorMessage
      });
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setResult(null);
  };

  const hasAdjustments = result && result.adjustments && result.adjustments.length > 0;

  const hasOptionValidations = !!(result?.optionValidations && result.optionValidations.length > 0);

  // Observação importante:
  // - optionValidations refletem a validação do PLANO PROPOSTO (preview)
  // - portanto, NÃO podemos concluir "já está otimizado" se existem ajustes a aplicar
  const allOptionsValid = hasOptionValidations && result!.optionValidations!.every(v => v.isValid);

  // v2.6: Backend pode retornar alreadyOptimized diretamente (verificação upfront)
  // Fallback para lógica local se não vier do backend
  const isAlreadyOptimized = result?.alreadyOptimized === true || 
    (!hasAdjustments && (allOptionsValid || !hasOptionValidations));

  return (
    <>
      {/* Loading Progress Dialog */}
      <GenerationProgressDialog isOpen={loading} type="optimize" />

      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <SuccessAnimation show={showSuccessAnimation} message="Plano ajustado!" />
        </div>
      )}

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex justify-center"
      >
        <Button
          variant="secondary"
          size="lg"
          className="gap-2 px-6 border border-border/50 transition-all duration-300 hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]"
          onClick={handleOptimize}
          disabled={loading || isLimitReached}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analisando...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Otimizar Plano</span>
              {usageInfo && !usageInfo.isUnlimited && (
                <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-xs">
                  {usageInfo.remaining}/{usageInfo.limit}
                </span>
              )}
            </>
          )}
        </Button>
      </motion.div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isAlreadyOptimized ? (
                <Check className="w-5 h-5 text-primary" />
              ) : (
                <Sparkles className="w-5 h-5 text-primary" />
              )}
              {isAlreadyOptimized ? 'Metas Atingidas' : 'Validação Nutricional'}
            </DialogTitle>
            <DialogDescription>
              {isAlreadyOptimized
                ? 'Seu plano já está alinhado com suas metas'
                : 'Conferência de metas e ajustes necessários'
              }
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* ALREADY OPTIMIZED (sem ajustes) */}
              {isAlreadyOptimized ? (
                <>
                  {/* Current percentages display */}
                  {result.currentPercentages && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
                        <div className="text-2xl font-bold text-primary">{result.currentPercentages.calories}%</div>
                        <div className="text-xs text-muted-foreground">Calorias</div>
                      </div>
                      <div className="p-3 rounded-xl bg-protein/10 border border-protein/20 text-center">
                        <div className="text-2xl font-bold text-protein">{result.currentPercentages.protein}%</div>
                        <div className="text-xs text-muted-foreground">Proteína</div>
                      </div>
                      <div className="p-3 rounded-xl bg-carbs/10 border border-carbs/20 text-center">
                        <div className="text-2xl font-bold text-carbs">{result.currentPercentages.carbs}%</div>
                        <div className="text-xs text-muted-foreground">Carboidratos</div>
                      </div>
                      <div className="p-3 rounded-xl bg-fat/10 border border-fat/20 text-center">
                        <div className="text-2xl font-bold text-fat">{result.currentPercentages.fat}%</div>
                        <div className="text-xs text-muted-foreground">Gordura</div>
                      </div>
                    </div>
                  )}

                  {/* Success message */}
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Seu plano já está dentro das metas! 🎉
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {result.message}
                      </p>
                    </div>
                  </div>

                  {/* Warning about rebalancing */}
                  <Alert className="bg-amber-500/10 border-amber-500/20">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      <p className="text-sm font-medium mb-1">Por que não otimizar?</p>
                      <p className="text-sm">
                        {result.warning}
                      </p>
                    </AlertDescription>
                  </Alert>
                </>
              ) : (
                <>
                  {/* Macro Comparison Grid - Only show when there are adjustments */}
                  {result.proposedMacros && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <MacroComparisonCard
                        label="Proteína"
                        current={result.currentMacros.protein}
                        target={result.targetMacros.protein}
                        proposed={result.proposedMacros.protein}
                        colorVar="protein"
                      />
                      <MacroComparisonCard
                        label="Carboidrato"
                        current={result.currentMacros.carbs}
                        target={result.targetMacros.carbs}
                        proposed={result.proposedMacros.carbs}
                        colorVar="carbs"
                      />
                      <MacroComparisonCard
                        label="Gordura"
                        current={result.currentMacros.fat}
                        target={result.targetMacros.fat}
                        proposed={result.proposedMacros.fat}
                        colorVar="fat"
                      />
                      <MacroComparisonCard
                        label="Calorias"
                        current={result.currentMacros.calories}
                        target={result.targetMacros.calories}
                        proposed={result.proposedMacros.calories}
                        unit="kcal"
                        colorVar="primary"
                      />
                    </div>
                  )}


                  {/* Option Validations (v2.5) */}
                  {result.optionValidations && result.optionValidations.length > 0 && (
                    <OptionValidationStatus 
                      validations={result.optionValidations} 
                      meta={result.meta}
                    />
                  )}

                  {/* Full Convergence Celebration (apenas quando não há ajustes a aplicar) */}
                  {isAlreadyOptimized && allOptionsValid && (
                    <FullConvergenceCelebration show={true} />
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {isAlreadyOptimized ? (
              <Button 
                onClick={async () => {
                  // Sincronizar totais do plano com o backend antes de fechar
                  await syncPlanTotalsFromBackend();
                  handleCancel();
                  onComplete();
                }} 
                className="w-full sm:w-auto"
              >
                <Check className="w-4 h-4 mr-2" />
                Entendido
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel} disabled={applying}>
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                {hasAdjustments && (
                  <Button onClick={handleConfirm} disabled={applying}>
                    {applying ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Aplicando...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Aplicar ajustes
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
