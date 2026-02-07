// =====================================================
// MODAL DE SUBSTITUIÇÃO INTELIGENTE
// =====================================================
// UX aprimorada com feedback visual de equivalência,
// comparativo lado a lado e labels de similaridade
// =====================================================

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Loader2,
  Sparkles,
  Check,
  ArrowRight,
  ThumbsDown,
  AlertTriangle,
  Info,
  Scale,
  Eye,
  EyeOff,
  ShieldAlert,
  Beef,
  Fish,
  Egg,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Food, MealOptionFood } from '@/lib/types';
import { SubstituteProposal, SubstituteCandidate, SubstituteError } from '@/lib/substitution-service';
import { CATEGORY_LABELS } from '@/lib/food-categories';

// =====================================================
// TIPOS
// =====================================================

interface SubstitutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFood: MealOptionFood | null;
  candidates: SubstituteCandidate[];
  proposal: SubstituteProposal | null;
  isLoading: boolean;
  isConfirming: boolean;
  error: SubstituteError | null;
  impact: 'low' | 'medium' | 'high' | null;
  requiresRebalance: boolean;
  showAll: boolean;
  includeProteinGroup: boolean;
  isProteinCategory: boolean;
  onSelectCandidate: (candidateId: string) => void;
  onConfirm: () => void;
  onBack: () => void;
  onToggleShowAll: (showAll: boolean) => void;
  onToggleProteinGroup: (include: boolean) => void;
}

// =====================================================
// HELPERS DE UI
// =====================================================

/**
 * Retorna label amigável para o score de similaridade
 */
function getSimilarityLabel(score: number): { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' } {
  const percentage = Math.round(score * 100);
  
  if (percentage >= 90) {
    return { label: 'Excelente escolha', variant: 'default' };
  }
  if (percentage >= 75) {
    return { label: 'Ótima escolha', variant: 'secondary' };
  }
  if (percentage >= 60) {
    return { label: 'Boa opção', variant: 'outline' };
  }
  return { label: 'Opção viável', variant: 'outline' };
}

/**
 * Retorna cor do badge de equivalência
 */
function getEquivalenceBadgeClass(impact: 'low' | 'medium' | 'high' | null): string {
  switch (impact) {
    case 'low':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'medium':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'high':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    default:
      return '';
  }
}

/**
 * Retorna mensagem de equivalência
 */
function getEquivalenceMessage(impact: 'low' | 'medium' | 'high' | null): string {
  switch (impact) {
    case 'low':
      return 'Troca equivalente: mantém seu plano balanceado';
    case 'medium':
      return 'Pequeno ajuste: diferença menor que 15% nas calorias';
    case 'high':
      return 'Diferença significativa: considere ajustar outras refeições';
    default:
      return '';
  }
}

/**
 * Formata número com sinal
 */
function formatDelta(value: number, suffix: string = ''): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${suffix}`;
}

/**
 * Parse serving_size para extrair unidade
 */
function getUnit(servingSize: string): string {
  if (servingSize.toLowerCase().includes('ml')) return 'ml';
  return 'g';
}

// =====================================================
// COMPONENTES INTERNOS
// =====================================================

function FoodCard({ 
  food, 
  portionGrams, 
  nutrients,
  variant = 'from'
}: { 
  food: Food; 
  portionGrams: number; 
  nutrients: { calories: number; protein: number; carbs: number; fat: number };
  variant?: 'from' | 'to';
}) {
  const bgClass = variant === 'from' ? 'bg-muted' : 'bg-primary/10';
  const labelClass = variant === 'from' ? 'text-muted-foreground' : 'text-primary';
  const label = variant === 'from' ? 'Alimento atual' : 'Novo alimento';
  
  return (
    <div className={`p-3 rounded-lg ${bgClass} flex-1`}>
      <p className={`text-xs ${labelClass} mb-1`}>{label}</p>
      <p className="font-medium text-sm">{food.name}</p>
      <p className="text-xs text-muted-foreground">
        {Math.round(portionGrams)}{getUnit(food.serving_size)}
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        <Badge variant="outline" className="text-[10px]">{nutrients.calories} kcal</Badge>
        <Badge variant="outline" className="text-[10px]">P: {nutrients.protein}g</Badge>
        <Badge variant="outline" className="text-[10px]">C: {nutrients.carbs}g</Badge>
        <Badge variant="outline" className="text-[10px]">G: {nutrients.fat}g</Badge>
      </div>
    </div>
  );
}

function CandidateItem({ 
  candidate, 
  onSelect,
  showCategory = false,
}: { 
  candidate: SubstituteCandidate; 
  onSelect: () => void;
  showCategory?: boolean;
}) {
  const similarity = getSimilarityLabel(candidate.score);
  const percentage = Math.round(candidate.score * 100);
  const food = candidate.food;
  const hasWarning = candidate.hasProcessingWarning;
  const categoryLabel = food.category ? (CATEGORY_LABELS[food.category as keyof typeof CATEGORY_LABELS] || food.category) : '';
  
  // Calcular macros para a porção sugerida
  const baseGrams = parseFloat(food.serving_size?.match(/(\d+)/)?.[1] || '100');
  const multiplier = candidate.newPortionGrams / baseGrams;
  const portionProtein = Math.round(food.protein * multiplier * 10) / 10;
  const portionCarbs = Math.round(food.carbs * multiplier * 10) / 10;
  const portionFat = Math.round(food.fat * multiplier * 10) / 10;
  const portionCals = Math.round(food.calories * multiplier);
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
        hasWarning 
          ? 'border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/5' 
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate">{food.name}</p>
            {hasWarning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      Alimento ultraprocessado. Pode conter aditivos e ter menor qualidade nutricional.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{candidate.newPortionGrams}g</p>
            {showCategory && categoryLabel && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {categoryLabel}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant={hasWarning ? 'outline' : similarity.variant} className={`text-xs ${hasWarning ? 'border-amber-500/50 text-amber-600' : ''}`}>
            {percentage}%
          </Badge>
          <span className="text-[10px] text-muted-foreground">{similarity.label}</span>
        </div>
      </div>
      
      {/* Tags de macros da porção sugerida */}
      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {portionCals} kcal
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-blue-600 border-blue-200">
          P: {portionProtein}g
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-200">
          C: {portionCarbs}g
        </Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-rose-600 border-rose-200">
          G: {portionFat}g
        </Badge>
      </div>
      
      {hasWarning && (
        <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Ultraprocessado
        </p>
      )}
    </motion.button>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function SubstitutionModal({
  open,
  onOpenChange,
  selectedFood,
  candidates,
  proposal,
  isLoading,
  isConfirming,
  error,
  impact,
  requiresRebalance,
  showAll,
  includeProteinGroup,
  isProteinCategory,
  onSelectCandidate,
  onConfirm,
  onBack,
  onToggleShowAll,
  onToggleProteinGroup,
}: SubstitutionModalProps) {
  const food = selectedFood?.food as Food | undefined;
  
  const errorMessages: Record<SubstituteError, string> = {
    PLAN_LOCKED: 'Este plano está bloqueado e não pode ser modificado.',
    ITEM_NOT_FOUND: 'Item não encontrado na refeição.',
    INVALID_CATEGORY: 'Categoria do alimento não é válida para substituição.',
    INVALID_PROCESSING_LEVEL: 'Este alimento é processado e não pode ser substituído automaticamente.',
    SUPPLEMENT_NOT_SUBSTITUTABLE: 'Suplementos não podem ser substituídos automaticamente. Consulte um profissional.',
    NO_PERMISSION: 'Você não tem permissão para fazer substituições.',
    NO_CANDIDATES: 'Nenhum alimento equivalente disponível nesta categoria.',
    INVALID_PORTION: 'Porção calculada está fora do limite permitido.',
  };
  
  // Calcular nutrientes do alimento atual para exibição
  const currentNutrients = useMemo(() => {
    if (!food || !selectedFood) return null;
    const baseGrams = parseFloat(food.serving_size.match(/(\d+)/)?.[1] || '100');
    const multiplier = selectedFood.quantity_grams / baseGrams;
    return {
      calories: Math.round(food.calories * multiplier),
      protein: Math.round(food.protein * multiplier),
      carbs: Math.round(food.carbs * multiplier),
      fat: Math.round(food.fat * multiplier),
    };
  }, [food, selectedFood]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <RefreshCw className="w-4 h-4 text-primary" />
            </div>
            <div>
              <DialogTitle>Substituição Inteligente</DialogTitle>
              <DialogDescription className="mt-1">
                Substituir por alimento equivalente mantém seu plano alimentar funcionando perfeitamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Alimento atual */}
          {food && currentNutrients && selectedFood && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-medium">Não quer mais este alimento?</p>
              </div>
              <p className="text-sm">{food.name}</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(selectedFood.quantity_grams)}{getUnit(food.serving_size)} • {currentNutrients.calories} kcal
              </p>
            </div>
          )}

          {/* Erro */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-destructive/10 rounded-lg flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{errorMessages[error]}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lista de candidatos */}
          {!proposal && (
            <div className="space-y-3">
              {/* Toggle para trocar por outras proteínas */}
              {isProteinCategory && (
                <div className="flex flex-col gap-2">
                  <Button
                    variant={includeProteinGroup ? 'default' : 'outline'}
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => onToggleProteinGroup(!includeProteinGroup)}
                  >
                    {includeProteinGroup ? (
                      <>
                        <Fish className="w-4 h-4" />
                        Mostrando todas as proteínas
                      </>
                    ) : (
                      <>
                        <Beef className="w-4 h-4" />
                        Trocar por outra proteína (frango, peixe, carne...)
                      </>
                    )}
                  </Button>
                  
                  {includeProteinGroup && (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="text-xs text-muted-foreground text-center"
                    >
                      Agora você pode trocar entre carnes, peixes, frutos do mar e ovos.
                    </motion.p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Escolha um equivalente:</p>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant={showAll ? 'secondary' : 'ghost'} 
                          size="sm" 
                          className="h-7 text-xs gap-1"
                          onClick={() => onToggleShowAll(!showAll)}
                        >
                          {showAll ? (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Ocultar extras
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" />
                              Ver todos
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          {showAll 
                            ? 'Mostrar apenas alimentos recomendados (sem ultraprocessados)'
                            : 'Incluir alimentos ultraprocessados na lista (não recomendado)'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Info className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          {includeProteinGroup 
                            ? 'Mostrando fontes de proteína intercambiáveis: carnes, peixes, ovos e frutos do mar.'
                            : 'Mostramos apenas alimentos da mesma categoria nutricional para manter o equilíbrio do seu plano.'
                          }
                          {' '}O score indica quão similar é a composição nutricional.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              
              {/* Aviso quando showAll está ativo */}
              {showAll && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-2 bg-amber-500/10 rounded-lg flex items-start gap-2 border border-amber-500/20"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Alimentos ultraprocessados estão visíveis. Prefira opções naturais quando possível.
                  </p>
                </motion.div>
              )}
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Buscando equivalentes...</span>
                </div>
              ) : candidates.length > 0 ? (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {/* Separar candidatos por categoria quando includeProteinGroup está ativo */}
                  {includeProteinGroup ? (
                    <>
                      {/* Primeiro mostrar da mesma categoria */}
                      {candidates.filter(c => !c.isCrossCategory).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                            Mesma categoria
                          </p>
                          {candidates.filter(c => !c.isCrossCategory).slice(0, 8).map((c) => (
                            <CandidateItem
                              key={c.food.id}
                              candidate={c}
                              onSelect={() => onSelectCandidate(c.food.id)}
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Depois mostrar de outras categorias de proteína */}
                      {candidates.filter(c => c.isCrossCategory).length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-1">
                            <Fish className="w-3 h-3" />
                            Outras proteínas
                          </p>
                          {candidates.filter(c => c.isCrossCategory).slice(0, 10).map((c) => (
                            <CandidateItem
                              key={c.food.id}
                              candidate={c}
                              onSelect={() => onSelectCandidate(c.food.id)}
                              showCategory
                            />
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                  candidates.slice(0, 25).map((c) => (
                      <CandidateItem
                        key={c.food.id}
                        candidate={c}
                        onSelect={() => onSelectCandidate(c.food.id)}
                      />
                    ))
                  )}
                </div>
              ) : !error && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Nenhum alimento equivalente disponível
                  </p>
                  {!showAll && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => onToggleShowAll(true)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ver todos da categoria
                    </Button>
                  )}
                  {isProteinCategory && !includeProteinGroup && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="text-xs"
                      onClick={() => onToggleProteinGroup(true)}
                    >
                      <Beef className="w-3 h-3 mr-1" />
                      Buscar em outras proteínas
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Proposta selecionada - Comparativo lado a lado */}
          {proposal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Badge de equivalência */}
              <div className={`p-3 rounded-lg border ${getEquivalenceBadgeClass(impact)}`}>
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4" />
                  <span className="text-sm font-medium">{getEquivalenceMessage(impact)}</span>
                </div>
              </div>

              {/* Comparativo lado a lado */}
              <div className="flex items-stretch gap-2">
                <FoodCard
                  food={proposal.from.food}
                  portionGrams={proposal.from.portionGrams}
                  nutrients={proposal.from.nutrients}
                  variant="from"
                />
                <div className="flex items-center">
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
                <FoodCard
                  food={proposal.to.food}
                  portionGrams={proposal.to.portionGrams}
                  nutrients={proposal.to.nutrients}
                  variant="to"
                />
              </div>

              {/* Impacto detalhado */}
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Impacto da substituição</p>
                  <Badge 
                    variant={impact === 'low' ? 'secondary' : 'outline'} 
                    className={`text-xs ml-auto ${
                      impact === 'low' ? 'bg-green-500/10 text-green-600' :
                      impact === 'medium' ? 'bg-amber-500/10 text-amber-600' :
                      'bg-red-500/10 text-red-600'
                    }`}
                  >
                    {impact === 'low' ? 'Baixo' : impact === 'medium' ? 'Médio' : 'Alto'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Calorias:</span>
                    <span className={proposal.deltaMacros.calories === 0 ? '' : proposal.deltaMacros.calories > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {formatDelta(proposal.deltaMacros.calories, ' kcal')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Proteína:</span>
                    <span className={proposal.deltaMacros.protein === 0 ? '' : proposal.deltaMacros.protein > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {formatDelta(proposal.deltaMacros.protein, 'g')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carboidratos:</span>
                    <span className={proposal.deltaMacros.carbs === 0 ? '' : proposal.deltaMacros.carbs > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {formatDelta(proposal.deltaMacros.carbs, 'g')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gordura:</span>
                    <span className={proposal.deltaMacros.fat === 0 ? '' : proposal.deltaMacros.fat > 0 ? 'text-amber-600' : 'text-green-600'}>
                      {formatDelta(proposal.deltaMacros.fat, 'g')}
                    </span>
                  </div>
                </div>

                {requiresRebalance && (
                  <p className="text-xs text-amber-600 pt-1 border-t border-border mt-2">
                    ⚠️ Considere rebalancear outras refeições para compensar
                  </p>
                )}
              </div>

              {/* Score de similaridade */}
              <div className="flex items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">Similaridade:</span>
                <Badge variant="default" className="text-xs">
                  {Math.round(proposal.score * 100)}%
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span className="text-xs">{getSimilarityLabel(proposal.score).label}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Ações */}
        {proposal && (
          <div className="flex-shrink-0 flex gap-2 pt-4 border-t border-border">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={onBack} 
              disabled={isConfirming}
            >
              Escolher outro
            </Button>
            <Button 
              className="flex-1" 
              onClick={onConfirm} 
              disabled={isConfirming}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Substituindo...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar troca
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
