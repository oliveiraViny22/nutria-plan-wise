import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Check,
  X,
  Loader2,
  ArrowRight,
  AlertTriangle,
  FileCheck,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronUp,
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
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTripleOptimizer, TripleOptimizationPreview } from '@/hooks/useTripleOptimizer';
import { toast } from 'sonner';

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface TripleOptimizerProps {
  planId: string;
  targets: MacroTargets;
  currentMacros: MacroTargets;
  userGoal?: 'gain_muscle' | 'lose_weight' | 'maintain';
  onComplete: () => void;
  compact?: boolean;
}

function PhaseCard({
  name,
  icon: Icon,
  totals,
  targets,
  violations,
  changes,
  isActive,
  isComplete,
}: {
  name: string;
  icon: React.ElementType;
  totals: MacroTargets;
  targets: MacroTargets;
  violations: { code: string; message: string; severity: string }[];
  changes: { food_name: string; old_quantity: number; new_quantity: number }[];
  isActive: boolean;
  isComplete: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const calPercent = targets.calories > 0 ? Math.round((totals.calories / targets.calories) * 100) : 0;
  const protPercent = targets.protein > 0 ? Math.round((totals.protein / targets.protein) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border transition-all ${
        isActive 
          ? 'border-primary bg-primary/5 shadow-md' 
          : isComplete 
            ? 'border-border bg-card' 
            : 'border-border/50 bg-muted/30'
      }`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${
          isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">{name}</h4>
          <p className="text-xs text-muted-foreground">
            {changes.length > 0 ? `${changes.length} ajustes` : 'Sem alterações'}
          </p>
        </div>
        {isComplete && (
          <Check className="w-5 h-5 text-primary" />
        )}
      </div>
      
      {/* Mini macro display */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs mb-2">
        <div>
          <div className="font-semibold">{totals.calories}</div>
          <div className="text-muted-foreground">kcal</div>
        </div>
        <div>
          <div className="font-semibold text-protein">{totals.protein}g</div>
          <div className="text-muted-foreground">prot</div>
        </div>
        <div>
          <div className="font-semibold text-carbs">{totals.carbs}g</div>
          <div className="text-muted-foreground">carb</div>
        </div>
        <div>
          <div className="font-semibold text-fat">{totals.fat}g</div>
          <div className="text-muted-foreground">fat</div>
        </div>
      </div>
      
      {/* Violations badges */}
      {violations.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {violations.slice(0, 2).map((v, i) => (
            <Badge 
              key={i} 
              variant={v.severity === 'error' ? 'destructive' : 'secondary'}
              className="text-[10px]"
            >
              {v.code}
            </Badge>
          ))}
          {violations.length > 2 && (
            <Badge variant="outline" className="text-[10px]">
              +{violations.length - 2}
            </Badge>
          )}
        </div>
      )}
      
      {/* Expandable changes */}
      {changes.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Ver alterações
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {changes.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                      <span className="truncate flex-1">{c.food_name}</span>
                      <span className="text-muted-foreground ml-2">
                        {c.old_quantity}g → <span className="text-foreground font-medium">{c.new_quantity}g</span>
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function MacroSummary({
  label,
  before,
  after,
  target,
}: {
  label: string;
  before: number;
  after: number;
  target: number;
}) {
  const beforePercent = target > 0 ? Math.round((before / target) * 100) : 0;
  const afterPercent = target > 0 ? Math.round((after / target) * 100) : 0;
  const improved = Math.abs(afterPercent - 100) < Math.abs(beforePercent - 100);
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-muted-foreground">{label}</span>
      <span className="w-12 text-right">{before}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground" />
      <span className={`w-12 font-semibold ${improved ? 'text-primary' : ''}`}>
        {after}
      </span>
      <span className="text-xs text-muted-foreground">
        ({afterPercent}%)
      </span>
      {improved && <Check className="w-3 h-3 text-primary" />}
    </div>
  );
}

export function TripleOptimizer({
  planId,
  targets,
  currentMacros,
  userGoal,
  onComplete,
  compact = false,
}: TripleOptimizerProps) {
  const {
    phase,
    isOptimizing,
    isApplying,
    preview,
    generatePreview,
    applyPreview,
    cancelPreview,
    reset,
  } = useTripleOptimizer();
  
  const [showDialog, setShowDialog] = useState(false);

  const handleOptimize = async () => {
    const goal = userGoal === 'gain_muscle' ? 'bulk' : userGoal === 'lose_weight' ? 'cut' : 'maintain';
    const result = await generatePreview(planId, targets, goal);
    if (result) {
      setShowDialog(true);
    }
  };

  const handleConfirm = async () => {
    const result = await applyPreview();
    if (result) {
      setShowDialog(false);
      reset();
      onComplete();
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    cancelPreview();
  };

  const phaseIcons = {
    'Contratos': FileCheck,
    'IA': Sparkles,
    'Rápido': Zap,
  };

  return (
    <>
      <Button
        variant="default"
        size={compact ? "default" : "default"}
        className={compact ? "w-full gap-2" : "w-full gap-2"}
        onClick={handleOptimize}
        disabled={isOptimizing}
      >
        {isOptimizing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">{phase.message || 'Processando...'}</span>
          </>
        ) : (
          <>
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline">Otimização Tripla</span>
            <span className="sm:hidden">Tripla</span>
          </>
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Otimização Tripla
            </DialogTitle>
            <DialogDescription>
              Pipeline: Contratos → IA → Ajuste Fino
            </DialogDescription>
          </DialogHeader>

          {isOptimizing && (
            <div className="space-y-4 py-6">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{phase.message}</p>
                  <Progress value={phase.progress} className="mt-2" />
                </div>
              </div>
            </div>
          )}

          {preview && !isOptimizing && (
            <div className="space-y-4">
              {/* Phase cards */}
              <div className="space-y-3">
                {preview.phases.map((p, i) => (
                  <PhaseCard
                    key={p.name}
                    name={p.name}
                    icon={phaseIcons[p.name as keyof typeof phaseIcons] || Layers}
                    totals={p.totals}
                    targets={targets}
                    violations={p.violations}
                    changes={p.changes}
                    isActive={false}
                    isComplete={true}
                  />
                ))}
              </div>

              {/* Summary comparison */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  Resumo Final
                </h4>
                <div className="space-y-2">
                  <MacroSummary
                    label="Calorias"
                    before={preview.before.calories}
                    after={preview.final.calories}
                    target={targets.calories}
                  />
                  <MacroSummary
                    label="Proteína"
                    before={preview.before.protein}
                    after={preview.final.protein}
                    target={targets.protein}
                  />
                  <MacroSummary
                    label="Carbs"
                    before={preview.before.carbs}
                    after={preview.final.carbs}
                    target={targets.carbs}
                  />
                  <MacroSummary
                    label="Gordura"
                    before={preview.before.fat}
                    after={preview.final.fat}
                    target={targets.fat}
                  />
                </div>
              </div>

              {/* Violations comparison */}
              {preview.violationsBefore.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-destructive">{preview.violationsBefore.length}</div>
                    <div className="text-xs text-muted-foreground">Antes</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${preview.violationsAfter.length === 0 ? 'text-primary' : 'text-amber-500'}`}>
                      {preview.violationsAfter.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Depois</div>
                  </div>
                  <div className="flex-1 text-right text-xs text-muted-foreground">
                    violações de contrato
                  </div>
                </div>
              )}

              {/* Total changes */}
              <Alert>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {preview.allChanges.length} alterações serão aplicadas ao seu plano.
                  A IA já foi aplicada - clique em Confirmar para finalizar os ajustes finos.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={isApplying}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            {preview && (
              <Button onClick={handleConfirm} disabled={isApplying}>
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar
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
