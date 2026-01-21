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
  Shield,
  Lock,
  Info,
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useRebalancer,
  MacroTargets,
  Adjustment,
  UserProfile,
} from '@/hooks/useRebalancer';

interface SmartRebalancerProps {
  planId: string;
  currentMacros: MacroTargets;
  targetMacros: MacroTargets;
  targetUserId?: string;
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
            <span className="text-lg font-bold text-foreground">{Math.round(current)}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {currentDiff !== 0 && (
              <span className={`text-xs ${currentDiff < 0 ? 'text-destructive' : 'text-amber-500'}`}>
                ({currentDiff > 0 ? '+' : ''}{Math.round(currentDiff)})
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground mb-1">Proposto</div>
          <div className="flex items-baseline gap-1">
            <span className={`text-lg font-bold ${improved ? 'text-primary' : 'text-foreground'}`}>
              {Math.round(proposed)}
            </span>
            <span className="text-xs text-muted-foreground">{unit}</span>
            {improved && <Check className="w-3 h-3 text-primary" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdjustmentItem({ adjustment }: { adjustment: Adjustment }) {
  const isIncrease = (adjustment.new_quantity || 0) > (adjustment.original_quantity || 0);
  const diff = (adjustment.new_quantity || 0) - (adjustment.original_quantity || 0);

  const mealNameMap: Record<string, string> = {
    breakfast: 'Café da Manhã',
    morning_snack: 'Lanche da Manhã',
    lunch: 'Almoço',
    afternoon_snack: 'Lanche da Tarde',
    dinner: 'Jantar',
    supper: 'Ceia',
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className={`p-1.5 rounded-full ${isIncrease ? 'bg-primary/10' : 'bg-amber-500/10'}`}>
        {adjustment.type === 'food_substitution' ? (
          <ArrowRight className="w-3 h-3 text-blue-500" />
        ) : isIncrease ? (
          <Plus className="w-3 h-3 text-primary" />
        ) : (
          <Minus className="w-3 h-3 text-amber-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{adjustment.food_name}</p>
        <p className="text-xs text-muted-foreground">
          {mealNameMap[adjustment.meal_name] || adjustment.meal_name}
        </p>
        {adjustment.reason && (
          <p className="text-xs text-muted-foreground italic mt-0.5">{adjustment.reason}</p>
        )}
      </div>
      <div className="text-right">
        {adjustment.type === 'food_substitution' ? (
          <span className="text-sm font-medium text-blue-500">→ {adjustment.new_food_name}</span>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">{adjustment.original_quantity}g</span>
            <span className="text-sm font-medium text-foreground mx-1">→</span>
            <span className={`text-sm font-medium ${isIncrease ? 'text-primary' : 'text-amber-500'}`}>
              {adjustment.new_quantity}g
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

function ProfileBadge({ 
  profileType, 
  getLabel, 
  getColor 
}: { 
  profileType: UserProfile;
  getLabel: (p: UserProfile) => string;
  getColor: (p: UserProfile) => string;
}) {
  const icons: Record<UserProfile, React.ReactNode> = {
    free: <Lock className="w-3 h-3" />,
    premium: <Sparkles className="w-3 h-3" />,
    usuario_pessoal_pago: <Check className="w-3 h-3" />,
    profissional_vinculado: <Shield className="w-3 h-3" />,
  };

  return (
    <Badge variant="outline" className={`${getColor(profileType)} gap-1`}>
      {icons[profileType]}
      {getLabel(profileType)}
    </Badge>
  );
}

export function SmartRebalancer({
  planId,
  currentMacros,
  targetMacros,
  targetUserId,
  onComplete,
}: SmartRebalancerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { 
    loading, 
    result, 
    calculateRebalance, 
    applyRebalance, 
    clearResult,
    getProfileLabel,
    getProfileColor 
  } = useRebalancer();

  const handleOptimize = async () => {
    const data = await calculateRebalance(planId, targetUserId);
    if (data) {
      setShowDialog(true);
    }
  };

  const handleConfirm = async () => {
    const success = await applyRebalance(planId, targetUserId);
    if (success) {
      setShowDialog(false);
      onComplete();
    }
  };

  const handleCancel = () => {
    clearResult();
    setShowDialog(false);
    setShowDetails(false);
  };

  const hasAdjustments = result && result.adjustments.length > 0;
  const isBlocked = result?.execution_blocked;
  const requiresApproval = result?.requires_approval;

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
            Otimizar plano automaticamente
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Rebalanceador Automático
            </DialogTitle>
            <DialogDescription>
              Análise e proposta de ajustes baseada no seu perfil
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {/* Profile Badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Seu perfil:</span>
                <ProfileBadge 
                  profileType={result.profile_type} 
                  getLabel={getProfileLabel}
                  getColor={getProfileColor}
                />
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <Alert variant="destructive" className="bg-amber-500/10 border-amber-500/20">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-sm">{w}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

              {/* Blocked Message */}
              {isBlocked && (
                <Alert className="bg-muted/50">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">{result.block_reason}</p>
                    {result.profile_type === 'free' && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        Faça upgrade para ter acesso ao rebalanceamento automático.
                      </p>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Requires Approval */}
              {requiresApproval && !isBlocked && (
                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-blue-700 dark:text-blue-300">
                    Os ajustes propostos requerem aprovação do profissional.
                  </AlertDescription>
                </Alert>
              )}

              {/* Macro Comparison */}
              <div className="space-y-2">
                <MacroComparisonCard
                  label="Proteína"
                  current={result.current_macros.protein}
                  target={result.target_macros.protein}
                  proposed={result.proposed_macros.protein}
                  colorClass="text-protein"
                />
                <MacroComparisonCard
                  label="Carboidrato"
                  current={result.current_macros.carbs}
                  target={result.target_macros.carbs}
                  proposed={result.proposed_macros.carbs}
                  colorClass="text-carbs"
                />
                <MacroComparisonCard
                  label="Gordura"
                  current={result.current_macros.fat}
                  target={result.target_macros.fat}
                  proposed={result.proposed_macros.fat}
                  colorClass="text-fat"
                />
                <MacroComparisonCard
                  label="Calorias"
                  current={result.current_macros.calories}
                  target={result.target_macros.calories}
                  proposed={result.proposed_macros.calories}
                  unit="kcal"
                  colorClass="text-primary"
                />
              </div>

              {/* Justification */}
              {result.justification && (
                <div className="p-3 rounded-xl bg-muted/50">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Justificativa</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-line">
                        {result.justification}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Adjustments Summary */}
              {hasAdjustments && !isBlocked ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {result.adjustments.length} alterações propostas
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
                        <div className="divide-y divide-border">
                          {result.adjustments.map((adj, i) => (
                            <AdjustmentItem key={i} adjustment={adj} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : !isBlocked && (
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

              {/* Adherence Impact */}
              {result.adherence_impact && (
                <p className="text-xs text-muted-foreground text-center">
                  {result.adherence_impact}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              <X className="w-4 h-4 mr-2" />
              {isBlocked ? 'Fechar' : 'Cancelar'}
            </Button>
            {hasAdjustments && !isBlocked && !requiresApproval && (
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
            {requiresApproval && !isBlocked && (
              <Button disabled>
                <Shield className="w-4 h-4 mr-2" />
                Aguardando aprovação
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
