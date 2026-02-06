import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings2,
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

function AdjustmentItem({ adjustment, index }: { adjustment: AdjustmentProposal; index: number }) {
  const isIncrease = adjustment.newGrams > adjustment.originalGrams;
  const originalRounded = Math.round(adjustment.originalGrams);
  const newRounded = Math.round(adjustment.newGrams);
  const diff = newRounded - originalRounded;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg shrink-0 ${
          isIncrease ? 'bg-primary/10' : 'bg-amber-500/10'
        }`}>
          {isIncrease ? (
            <ChevronUp className="w-3.5 h-3.5 text-primary" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{adjustment.foodName}</p>
          <p className="text-xs text-muted-foreground">{adjustment.mealName}</p>
          <p className="text-xs text-muted-foreground/80 mt-1 italic">{adjustment.reason}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">{originalRounded}g</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold ${
              isIncrease 
                ? 'bg-primary/15 text-primary' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              {newRounded}g
              <span className="text-xs opacity-80">
                ({diff > 0 ? '+' : ''}{diff})
              </span>
            </span>
          </div>
        </div>
      </div>
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
  const [showDetails, setShowDetails] = useState(false);
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
      
      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Verificar status no nível raiz ou dentro de result
      const resultStatus = data.status || data.result?.status;
      const structuralIssue = data.structural_issue || data.result?.structural_issue;

      // Tratar caso de plano estruturalmente inválido (v5.1)
      if (resultStatus === 'structurally_invalid' || resultStatus === 'error') {
        console.error('[AIRebalancer] Plano estruturalmente inválido:', structuralIssue);
        
        // Verificar se há issue estrutural com sugestão de regeneração
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

      setResult(data);
      setShowDialog(true);
    } catch (error: unknown) {
      console.error('AI Rebalance error:', error);
      toast.error('Erro ao calcular ajustes com IA');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!result || !result.adjustments.length) return;

    setApplying(true);
    try {
      // Aplicar cada ajuste no banco
      for (const adj of result.adjustments) {
        await supabase
          .from('meal_option_foods')
          .update({ quantity_grams: adj.newGrams })
          .eq('id', adj.mealOptionFoodId);

        // Propagar para outras opções da mesma refeição
        const { data: allOptions } = await supabase
          .from('meal_options')
          .select('id, option_number')
          .eq('meal_id', adj.mealId);

        if (allOptions) {
          for (const option of allOptions) {
            if (option.id === adj.mealOptionId) continue;
            
            // Encontrar o mesmo alimento nas outras opções
            const { data: otherFoods } = await supabase
              .from('meal_option_foods')
              .select('id')
              .eq('meal_option_id', option.id)
              .eq('food_id', adj.foodId);

            if (otherFoods && otherFoods.length > 0) {
              await supabase
                .from('meal_option_foods')
                .update({ quantity_grams: adj.newGrams })
                .eq('id', otherFoods[0].id);
            }
          }
        }
      }

      // Recalcular totais das opções afetadas
      const affectedOptionIds = new Set(result.adjustments.map(a => a.mealOptionId));
      
      for (const optionId of affectedOptionIds) {
        const { data: optionFoods } = await supabase
          .from('meal_option_foods')
          .select('quantity_grams, food:foods(calories, protein, carbs, fat, serving_size)')
          .eq('meal_option_id', optionId);

        let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

        if (optionFoods) {
          for (const mof of optionFoods) {
            const food = mof.food as any;
            // Priorizar formato "(XXg)" ou "(XXml)", senão "XXg" ou "XXml", fallback 100
            const servingSize = food.serving_size || '';
            const parenMatch = servingSize.match(/\((\d+)\s*(g|ml)\)/i);
            const directMatch = servingSize.match(/^(\d+)\s*(g|ml)$/i);
            const baseGrams = parenMatch 
              ? parseInt(parenMatch[1], 10) 
              : directMatch 
                ? parseInt(directMatch[1], 10) 
                : 100;
            const multiplier = mof.quantity_grams / baseGrams;
            
            totals.calories += food.calories * multiplier;
            totals.protein += food.protein * multiplier;
            totals.carbs += food.carbs * multiplier;
            totals.fat += food.fat * multiplier;
          }
        }

        await supabase
          .from('meal_options')
          .update({
            total_calories: Math.round(totals.calories),
            total_protein: Math.round(totals.protein),
            total_carbs: Math.round(totals.carbs),
            total_fat: Math.round(totals.fat),
          })
          .eq('id', optionId);
      }

      // Recalcular totais das refeições
      const affectedMealIds = new Set(result.adjustments.map(a => a.mealId));

      for (const mealId of affectedMealIds) {
        const { data: mealOptions } = await supabase
          .from('meal_options')
          .select('total_calories, total_protein, total_carbs, total_fat')
          .eq('meal_id', mealId)
          .eq('option_number', 1)
          .single();

        if (mealOptions) {
          await supabase
            .from('meals')
            .update({
              total_calories: mealOptions.total_calories,
              total_protein: mealOptions.total_protein,
              total_carbs: mealOptions.total_carbs,
              total_fat: mealOptions.total_fat,
            })
            .eq('id', mealId);
        }
      }

      // Recalcular total do plano
      const { data: allMeals } = await supabase
        .from('meals')
        .select('total_calories, total_protein, total_carbs, total_fat')
        .eq('diet_plan_id', planId);

      let planTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      if (allMeals) {
        for (const m of allMeals) {
          planTotals.calories += m.total_calories || 0;
          planTotals.protein += m.total_protein || 0;
          planTotals.carbs += m.total_carbs || 0;
          planTotals.fat += m.total_fat || 0;
        }
      }

      await supabase
        .from('diet_plans')
        .update({
          total_calories: Math.round(planTotals.calories),
          total_protein: Math.round(planTotals.protein),
          total_carbs: Math.round(planTotals.carbs),
          total_fat: Math.round(planTotals.fat),
        })
        .eq('id', planId);

      // NOTA: O incremento de uso é feito no backend (ai-rebalance)
      // para evitar duplicação de contagem

      setShowDialog(false);
      setResult(null);
      
      // Show success animation overlay
      setShowSuccessAnimation(true);
      setTimeout(() => setShowSuccessAnimation(false), 2500);
      
      toast.success('Metas nutricionais atingidas! Plano ajustado. ✅');
      playSuccessSound();
      onComplete();
    } catch (error: unknown) {
      console.error('Error applying AI adjustments:', error);
      toast.error('Erro ao aplicar ajustes');
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setResult(null);
    setShowDetails(false);
  };

  const hasAdjustments = result && result.adjustments && result.adjustments.length > 0;
  const isAlreadyOptimized = result && result.alreadyOptimized;

  return (
    <>
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
              {/* ALREADY OPTIMIZED - Show special message */}
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


                  {/* Warnings */}
                  {result.warnings && result.warnings.length > 0 && (
                    <Alert className="bg-amber-500/10 border-amber-500/20">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <AlertDescription className="text-amber-700 dark:text-amber-300">
                        <ul className="list-disc list-inside text-sm">
                          {result.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Adjustments List */}
                  {hasAdjustments && result.adjustments && (
                    <div className="space-y-3">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {result.adjustments.length} ajustes propostos
                        </span>
                        {showDetails ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>

                      <AnimatePresence>
                        {showDetails && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-card rounded-xl border border-border/50">
                              {result.adjustments.map((adj, i) => (
                                <AdjustmentItem key={adj.mealOptionFoodId} adjustment={adj} index={i} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* No adjustments message */}
                  {!hasAdjustments && !isAlreadyOptimized && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <Check className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Seu plano já está otimizado!
                        </p>
                        <p className="text-xs text-muted-foreground">
                          A IA não encontrou ajustes necessários.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {isAlreadyOptimized ? (
              <Button onClick={handleCancel} className="w-full sm:w-auto">
                <Check className="w-4 h-4 mr-2" />
                Entendi, vou seguir o plano
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
