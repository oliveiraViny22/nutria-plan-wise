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
import {
  useMacroRebalancer,
  RebalanceProposal,
  MacroTargets,
  FoodAdjustment,
} from '@/hooks/useMacroRebalancer';

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
  colorClass,
}: {
  label: string;
  current: number;
  target: number;
  proposed: number;
  unit?: string;
  colorClass: string;
}) {
  const currentDiff = current - target;
  const proposedDiff = proposed - target;
  const improved =
    Math.abs(proposedDiff) < Math.abs(currentDiff) || 
    (proposedDiff >= 0 && currentDiff < 0);

  return (
    <div className="p-3 rounded-xl bg-muted/50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className={`text-xs font-medium ${colorClass}`}>Meta: {target}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Atual</div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-foreground">{current}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {currentDiff !== 0 && (
              <span className={`text-xs ${currentDiff < 0 ? 'text-destructive' : 'text-amber-500'}`}>
                ({currentDiff > 0 ? '+' : ''}{currentDiff})
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Proposto</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${improved ? 'text-primary' : 'text-foreground'}`}>
              {proposed}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {improved && <Check className="w-3 h-3 text-primary" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdjustmentItem({ adjustment }: { adjustment: FoodAdjustment }) {
  const isIncrease = adjustment.newQuantity > adjustment.originalQuantity;
  const diff = adjustment.newQuantity - adjustment.originalQuantity;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`p-1.5 rounded-full ${isIncrease ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
        {adjustment.isNewItem ? (
          <Plus className="w-3 h-3 text-primary" />
        ) : isIncrease ? (
          <ChevronUp className="w-3 h-3 text-primary" />
        ) : (
          <ChevronDown className="w-3 h-3 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{adjustment.foodName}</p>
        <p className="text-xs text-muted-foreground">{adjustment.mealName}</p>
      </div>
      <div className="text-right">
        {adjustment.isNewItem ? (
          <span className="text-sm font-medium text-primary">+{adjustment.newQuantity}g</span>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{adjustment.originalQuantity}g</span>
            <span className="text-sm font-medium text-foreground mx-1">→</span>
            <span className={`text-sm font-medium ${isIncrease ? 'text-primary' : 'text-amber-500'}`}>
              {adjustment.newQuantity}g
            </span>
            <span className={`text-xs ml-1 ${isIncrease ? 'text-primary' : 'text-amber-500'}`}>
              ({diff > 0 ? '+' : ''}{diff}g)
            </span>
          </>
        )}
      </div>
    </div>
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

  const hasAdjustments = proposal && 
    (proposal.adjustments.length > 0 || proposal.supplementsAdded.length > 0);

  const needsOptimization = 
    Math.abs(currentMacros.protein - targets.protein) > 5 ||
    Math.abs(currentMacros.carbs - targets.carbs) > 10 ||
    Math.abs(currentMacros.fat - targets.fat) > 5;

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
            Otimizar plano para atingir macros
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
              {/* Macro Comparison */}
              <div className="space-y-2">
                <MacroComparisonCard
                  label="Proteína"
                  current={proposal.currentMacros.protein}
                  target={proposal.targetMacros.protein}
                  proposed={proposal.proposedMacros.protein}
                  colorClass="text-protein"
                />
                <MacroComparisonCard
                  label="Carboidrato"
                  current={proposal.currentMacros.carbs}
                  target={proposal.targetMacros.carbs}
                  proposed={proposal.proposedMacros.carbs}
                  colorClass="text-carbs"
                />
                <MacroComparisonCard
                  label="Gordura"
                  current={proposal.currentMacros.fat}
                  target={proposal.targetMacros.fat}
                  proposed={proposal.proposedMacros.fat}
                  colorClass="text-fat"
                />
                <MacroComparisonCard
                  label="Calorias"
                  current={proposal.currentMacros.calories}
                  target={proposal.targetMacros.calories}
                  proposed={proposal.proposedMacros.calories}
                  unit="kcal"
                  colorClass="text-primary"
                />
              </div>

              {/* Adjustments Summary */}
              {hasAdjustments ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {proposal.adjustments.length + proposal.supplementsAdded.length} alterações propostas
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
                          {/* Step 1: Food Adjustments */}
                          {proposal.adjustments.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Etapa 1 — Ajuste de porções
                              </h4>
                              <div className="divide-y divide-border">
                                {proposal.adjustments.map((adj, i) => (
                                  <AdjustmentItem key={i} adjustment={adj} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Step 2: Supplements */}
                          {proposal.supplementsAdded.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                                <Beaker className="w-3 h-3" />
                                Etapa 2 — Suplementação
                              </h4>
                              <div className="divide-y divide-border">
                                {proposal.supplementsAdded.map((supp, i) => (
                                  <AdjustmentItem key={i} adjustment={supp} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
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
              )}

              {/* Remaining deficits warning */}
              {(proposal.deficits.protein > 5 || proposal.deficits.carbs > 10 || proposal.deficits.fat > 5) && (
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
            {hasAdjustments && (
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
