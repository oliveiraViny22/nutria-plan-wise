// =====================================================
// MACRO REBALANCER - COMPONENTE UI
// =====================================================
// Re-export the SmartRebalancer for backwards compatibility
// Uses the refactored useMacroRebalancer hook with pure core logic

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  Check,
  X,
  Loader2,
  ArrowRight,
  AlertCircle,
  Beaker,
  AlertTriangle,
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
import {
  useMacroRebalancer,
  RebalanceProposal,
  MacroTargets,
  FoodAdjustment,
  PlanStatus,
} from '@/hooks/useMacroRebalancer';

// Export the new SmartRebalancer for use in new code
export { SmartRebalancer } from './SmartRebalancer';

interface MacroRebalancerProps {
  planId: string;
  targets: MacroTargets;
  currentMacros: MacroTargets;
  onComplete: () => void;
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
  
  // Calculate percentages for progress bars
  const maxValue = Math.max(current, target, proposed) * 1.1;
  const targetPercent = (target / maxValue) * 100;
  const currentPercent = Math.min((current / maxValue) * 100, 100);
  const proposedPercent = Math.min((proposed / maxValue) * 100, 100);
  
  // Color mapping using CSS variables
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

  return (
    <div className="p-3 rounded-xl bg-card border border-border/50 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        <span className={`text-xs font-semibold whitespace-nowrap ${colorClasses[colorVar].split(' ')[1]}`}>
          Meta: {target}{unit}
        </span>
      </div>
      
      {/* Values Row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Atual</div>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="text-lg font-bold text-foreground">{current}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {currentDiff !== 0 && (
              <span className={`text-xs font-medium whitespace-nowrap ${currentDiff < 0 ? 'text-destructive' : 'text-amber-500'}`}>
                ({currentDiff > 0 ? '+' : ''}{currentDiff})
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center justify-center shrink-0">
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
        </div>
        
        <div className="flex-1 min-w-0 text-right">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Proposto</div>
          <div className="flex items-baseline gap-1 justify-end flex-wrap">
            <span className={`text-lg font-bold ${improved ? 'text-primary' : 'text-foreground'}`}>
              {proposed}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {improved && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="relative h-1.5 rounded-full overflow-hidden bg-muted/60">
        {/* Target marker */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/40 z-10"
          style={{ left: `${targetPercent}%` }}
        />
        {/* Current value bar (faded) */}
        <motion.div
          className={`absolute top-0 bottom-0 left-0 ${bgColorClasses[colorVar]} opacity-60`}
          initial={{ width: 0 }}
          animate={{ width: `${currentPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {/* Proposed value bar */}
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

function AdjustmentItem({ adjustment, index }: { adjustment: FoodAdjustment; index: number }) {
  const isIncrease = adjustment.newQuantity > adjustment.originalQuantity;
  const diff = adjustment.newQuantity - adjustment.originalQuantity;

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className={`p-2 rounded-lg ${
        adjustment.isNewItem 
          ? 'bg-primary/15 ring-1 ring-primary/20' 
          : isIncrease 
            ? 'bg-primary/10' 
            : 'bg-amber-500/10'
      }`}>
        {adjustment.isNewItem ? (
          <Plus className="w-3.5 h-3.5 text-primary" />
        ) : isIncrease ? (
          <ChevronUp className="w-3.5 h-3.5 text-primary" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{adjustment.foodName}</p>
        <p className="text-xs text-muted-foreground">{adjustment.mealName}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {adjustment.isNewItem ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-sm font-semibold text-primary">
            <Plus className="w-3 h-3" />
            {adjustment.newQuantity}g
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">{adjustment.originalQuantity}g</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold ${
              isIncrease 
                ? 'bg-primary/15 text-primary' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              {adjustment.newQuantity}g
              <span className="text-xs opacity-80">
                ({diff > 0 ? '+' : ''}{diff})
              </span>
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function MacroRebalancer({
  planId,
  targets,
  currentMacros,
  onComplete,
}: MacroRebalancerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { loading, proposal, calculateProposal, applyProposal, clearProposal } = useMacroRebalancer();

  const handleOptimize = async () => {
    const result = await calculateProposal(planId, targets);
    if (result) {
      setShowDialog(true);
    }
  };

  const handleConfirm = async () => {
    const success = await applyProposal(planId);
    if (success) {
      setShowDialog(false);
      onComplete();
    }
  };

  const handleCancel = () => {
    clearProposal();
    setShowDialog(false);
    setShowDetails(false);
  };

  const hasAdjustments = proposal && proposal.adjustments.length > 0;
  const hasSupplementNeeds = proposal && proposal.supplementNeeds && proposal.supplementNeeds.length > 0;
  const hasValidationErrors = proposal && !proposal.isValid;
  
  // CORREÇÃO: Usar planStatus para determinar se o plano está realmente otimizado
  const isAlreadyBalanced = proposal?.planStatus === 'already_balanced';
  const isPartiallyOptimized = proposal?.planStatus === 'partially_optimized';
  const isBlockedStructural = proposal?.planStatus === 'blocked_structural';
  const isBlockedEnergy = proposal?.planStatus === 'blocked_energy';

  return (
    <>
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={handleOptimize}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analisando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Rebalanceador V2 - Core
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Otimização de Macros
            </DialogTitle>
            <DialogDescription>
              Análise e proposta de ajustes para atingir suas metas diárias
            </DialogDescription>
          </DialogHeader>

          {proposal && (
            <div className="space-y-4">
              {/* Validation Errors */}
              {hasValidationErrors && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">Erros de validação:</p>
                    <ul className="list-disc list-inside mt-1">
                      {proposal.validationErrors.map((err, i) => (
                        <li key={i} className="text-sm">{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Macro Comparison Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MacroComparisonCard
                  label="Proteína"
                  current={proposal.currentMacros.protein}
                  target={proposal.targetMacros.protein}
                  proposed={proposal.proposedMacros.protein}
                  colorVar="protein"
                />
                <MacroComparisonCard
                  label="Carboidrato"
                  current={proposal.currentMacros.carbs}
                  target={proposal.targetMacros.carbs}
                  proposed={proposal.proposedMacros.carbs}
                  colorVar="carbs"
                />
                <MacroComparisonCard
                  label="Gordura"
                  current={proposal.currentMacros.fat}
                  target={proposal.targetMacros.fat}
                  proposed={proposal.proposedMacros.fat}
                  colorVar="fat"
                />
                <MacroComparisonCard
                  label="Calorias"
                  current={proposal.currentMacros.calories}
                  target={proposal.targetMacros.calories}
                  proposed={proposal.proposedMacros.calories}
                  unit="kcal"
                  colorVar="primary"
                />
              </div>

              {/* Adjustments Summary */}
              {hasAdjustments && (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {proposal.adjustments.length} alterações propostas
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
                        <div className="space-y-4 pt-2">
                          {/* Food Adjustments */}
                          {proposal.adjustments.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Ajuste de porções
                              </h4>
                              <div className="space-y-1">
                                {proposal.adjustments.map((adj, i) => (
                                  <AdjustmentItem key={i} adjustment={adj} index={i} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Status do Plano - CORRIGIDO para usar planStatus */}
              {!hasAdjustments && (
                <>
                  {isAlreadyBalanced ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Seu plano já está otimizado!
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Os macros atuais estão dentro das metas definidas.
                        </p>
                      </div>
                    </div>
                  ) : (isPartiallyOptimized || isBlockedStructural || isBlockedEnergy) ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Não foi possível otimizar o plano
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {proposal?.statusMessage}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              )}

              {/* Supplement Needs (sinalização, não adição automática) */}
              {hasSupplementNeeds && (
                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Beaker className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Suplementação pode ser necessária:</p>
                    <ul className="list-disc list-inside text-sm">
                      {proposal.supplementNeeds.map((need, i) => (
                        <li key={i}>{need.message}</li>
                      ))}
                    </ul>
                    <p className="text-xs mt-2 text-muted-foreground">
                      Consulte um profissional para adicionar suplementos ao seu plano.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Remaining deficits warning */}
              {(proposal.deficits.protein > 5 || proposal.deficits.carbs > 10 || proposal.deficits.fat > 5) && !hasSupplementNeeds && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Alguns déficits não puderam ser completamente corrigidos
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {proposal.deficits.protein > 5 && `Proteína: -${proposal.deficits.protein}g `}
                      {proposal.deficits.carbs > 10 && `Carbs: -${proposal.deficits.carbs}g `}
                      {proposal.deficits.fat > 5 && `Gordura: -${proposal.deficits.fat}g`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            {hasAdjustments && proposal?.isValid && (
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar alterações
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
