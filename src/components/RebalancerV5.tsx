import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, Check, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useRebalancerV5, MacroTargets } from '@/hooks/useRebalancerV5';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface RebalancerV5Props {
  planId: string;
  targets: MacroTargets;
  currentMacros: MacroTargets;
  onComplete?: () => void;
}

export function RebalancerV5({
  planId,
  targets,
  currentMacros,
  onComplete,
}: RebalancerV5Props) {
  const { loading, proposal, calculateProposal, applyProposal, clearProposal } =
    useRebalancerV5();
  const [showDialog, setShowDialog] = useState(false);

  const handleCalculate = async () => {
    const result = await calculateProposal(planId, targets);
    if (result) {
      setShowDialog(true);
    }
  };

  const handleApply = async () => {
    const success = await applyProposal(planId);
    if (success) {
      setShowDialog(false);
      onComplete?.();
    }
  };

  const handleClose = () => {
    setShowDialog(false);
    clearProposal();
  };

  const getStatusBadge = () => {
    if (!proposal) return null;

    switch (proposal.status) {
      case 'balanced':
        return (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            <Check className="w-3 h-3 mr-1" />
            Já Otimizado
          </Badge>
        );
      case 'adjusted':
        return (
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Ajustes Propostos
          </Badge>
        );
      case 'blocked_structural':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Bloqueado
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 border-violet-500/30 text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-950/50"
        onClick={handleCalculate}
        disabled={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculando V5...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Otimizar Macros (V5 - Core Puro)
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Proposta de Otimização V5
              {getStatusBadge()}
            </DialogTitle>
            <DialogDescription>
              Rebalanceador com core puro e função determinística
            </DialogDescription>
          </DialogHeader>

          {proposal && (
            <div className="space-y-4">
              {/* Debug Info */}
              {proposal.strategyUsed && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  <Info className="w-3 h-3 inline mr-1" />
                  Estratégia: {proposal.strategyUsed}
                </div>
              )}

              {/* Current vs Target */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-medium text-muted-foreground">Atual</h4>
                  <div className="space-y-1">
                    <p>Calorias: {proposal.currentMacros.calories} kcal</p>
                    <p>Proteína: {proposal.currentMacros.protein}g</p>
                    <p>Carboidratos: {proposal.currentMacros.carbs}g</p>
                    <p>Gordura: {proposal.currentMacros.fat}g</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-muted-foreground">Meta</h4>
                  <div className="space-y-1">
                    <p>Calorias: {proposal.targetMacros.calories} kcal</p>
                    <p>Proteína: {proposal.targetMacros.protein}g</p>
                    <p>Carboidratos: {proposal.targetMacros.carbs}g</p>
                    <p>Gordura: {proposal.targetMacros.fat}g</p>
                  </div>
                </div>
              </div>

              {/* Proposed Macros */}
              {proposal.proposedMacros && proposal.status === 'adjusted' && (
                <div className="bg-primary/5 rounded-lg p-3">
                  <h4 className="font-medium text-primary mb-2">Após Ajuste</h4>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Calorias</p>
                      <p className="font-medium">{proposal.proposedMacros.calories}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Proteína</p>
                      <p className="font-medium">{proposal.proposedMacros.protein}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Carboidratos</p>
                      <p className="font-medium">{proposal.proposedMacros.carbs}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">Gordura</p>
                      <p className="font-medium">{proposal.proposedMacros.fat}g</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason */}
              {proposal.reason && (
                <div className="text-sm text-muted-foreground bg-muted/30 rounded p-2">
                  {proposal.reason}
                </div>
              )}

              {/* Validation Errors */}
              {proposal.validationErrors.length > 0 && (
                <div className="bg-destructive/10 rounded-lg p-3">
                  <h4 className="font-medium text-destructive mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Problemas Encontrados
                  </h4>
                  <ul className="text-sm space-y-1">
                    {proposal.validationErrors.map((error, i) => (
                      <li key={i} className="text-destructive/80">• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Adjustments List */}
              {proposal.adjustments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Ajustes ({proposal.adjustments.length})</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {proposal.adjustments.map((adj, i) => (
                      <div
                        key={i}
                        className="text-sm bg-muted/30 rounded p-2 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium">{adj.foodName}</p>
                          <p className="text-xs text-muted-foreground">{adj.mealName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono">
                            {adj.originalQuantity}g → {adj.newQuantity}g
                          </p>
                          <p className="text-xs text-muted-foreground">{adj.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            {proposal?.status === 'adjusted' && (
              <Button onClick={handleApply} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Aplicar Ajustes
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
