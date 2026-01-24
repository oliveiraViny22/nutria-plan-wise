// =====================================================
// REBALANCER V4 - COMPONENTE UI
// =====================================================
// Interface para o rebalanceador v4 com pré-validação estrutural.
//
// ESTADOS:
// - balanced: Plano já otimizado ✓
// - adjusted: Ajustes aplicáveis ✓
// - blocked_structural: Bloqueio estrutural ✗
// =====================================================

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Loader2,
  ArrowRight,
  AlertTriangle,
  ShieldX,
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
  useRebalancerV4,
  RebalanceProposalV4,
  MacroTargets,
  FoodAdjustment,
} from '@/hooks/useRebalancerV4';

interface RebalancerV4Props {
  planId: string;
  targets: MacroTargets;
  currentMacros: MacroTargets;
  onComplete: () => void;
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

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
  proposed?: number;
  unit?: string;
  colorVar: 'protein' | 'carbs' | 'fat' | 'primary';
}) {
  const displayProposed = proposed ?? current;
  const currentDiff = current - target;
  const proposedDiff = displayProposed - target;
  const improved =
    Math.abs(proposedDiff) < Math.abs(currentDiff) || 
    (proposedDiff >= 0 && currentDiff < 0);
  
  const maxValue = Math.max(current, target, displayProposed) * 1.1;
  const targetPercent = (target / maxValue) * 100;
  const currentPercent = Math.min((current / maxValue) * 100, 100);
  const proposedPercent = Math.min((displayProposed / maxValue) * 100, 100);
  
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
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-sm font-semibold text-foreground truncate">{label}</span>
        <span className={`text-xs font-semibold whitespace-nowrap ${colorClasses[colorVar].split(' ')[1]}`}>
          Meta: {target}{unit}
        </span>
      </div>
      
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
        
        {proposed !== undefined && (
          <>
            <div className="flex items-center justify-center shrink-0">
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60" />
            </div>
            
            <div className="flex-1 min-w-0 text-right">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Proposto</div>
              <div className="flex items-baseline gap-1 justify-end flex-wrap">
                <span className={`text-lg font-bold ${improved ? 'text-primary' : 'text-foreground'}`}>
                  {displayProposed}
                </span>
                <span className="text-xs text-muted-foreground">{unit}</span>
                {improved && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </div>
            </div>
          </>
        )}
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
        {proposed !== undefined && (
          <motion.div
            className={`absolute top-0 bottom-0 left-0 ${colorClasses[colorVar].split(' ')[0]} rounded-full`}
            initial={{ width: 0 }}
            animate={{ width: `${proposedPercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
          />
        )}
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
      </div>
      <div className="text-right flex-shrink-0">
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
      </div>
    </motion.div>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function RebalancerV4({
  planId,
  targets,
  currentMacros,
  onComplete,
}: RebalancerV4Props) {
  const [showDialog, setShowDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { loading, proposal, calculateProposal, applyProposal, clearProposal } = useRebalancerV4();

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
  const isBalanced = proposal?.status === 'balanced';
  const isAdjusted = proposal?.status === 'adjusted';
  const isBlocked = proposal?.status === 'blocked_structural';

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
            Rebalanceador V4 - Estrutural
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
              {/* Bloqueio Estrutural */}
              {isBlocked && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <ShieldX className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-2">Bloqueio Estrutural</p>
                    <p className="text-sm">{proposal.reason}</p>
                    {proposal.validationErrors.length > 0 && (
                      <ul className="list-disc list-inside mt-2 text-sm">
                        {proposal.validationErrors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs mt-3 text-muted-foreground">
                      O plano precisa ser regenerado. Ajustes de quantidade não podem corrigir problemas estruturais.
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Macro Comparison Grid */}
              {!isBlocked && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MacroComparisonCard
                    label="Proteína"
                    current={proposal.currentMacros.protein}
                    target={proposal.targetMacros.protein}
                    proposed={proposal.proposedMacros?.protein}
                    colorVar="protein"
                  />
                  <MacroComparisonCard
                    label="Carboidrato"
                    current={proposal.currentMacros.carbs}
                    target={proposal.targetMacros.carbs}
                    proposed={proposal.proposedMacros?.carbs}
                    colorVar="carbs"
                  />
                  <MacroComparisonCard
                    label="Gordura"
                    current={proposal.currentMacros.fat}
                    target={proposal.targetMacros.fat}
                    proposed={proposal.proposedMacros?.fat}
                    colorVar="fat"
                  />
                  <MacroComparisonCard
                    label="Calorias"
                    current={proposal.currentMacros.calories}
                    target={proposal.targetMacros.calories}
                    proposed={proposal.proposedMacros?.calories}
                    unit="kcal"
                    colorVar="primary"
                  />
                </div>
              )}

              {/* Plano Já Balanceado */}
              {isBalanced && (
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

              {/* Ajustes Disponíveis */}
              {isAdjusted && hasAdjustments && (
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
                        <div className="space-y-1 pt-2">
                          {proposal.adjustments.map((adj, i) => (
                            <AdjustmentItem key={i} adjustment={adj} index={i} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Aviso quando não conseguiu ajustar mas não é bloqueio estrutural */}
              {!isBalanced && !isAdjusted && !isBlocked && proposal.reason && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Não foi possível otimizar o plano
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {proposal.reason}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              <X className="w-4 h-4 mr-2" />
              {isBalanced || isBlocked ? 'Fechar' : 'Cancelar'}
            </Button>
            {isAdjusted && hasAdjustments && (
              <Button onClick={handleConfirm} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Aplicar ajustes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default RebalancerV4;
