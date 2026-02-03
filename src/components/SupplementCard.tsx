import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, ChevronDown, ChevronUp, Loader2, AlertCircle, Sparkles, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Supplement {
  name: string;
  dosage: string;
  timing: string;
  benefit: string;
  priority: 'essential' | 'recommended' | 'optional';
  doseType?: 'single_daily' | 'contextual' | 'meal_replacement';
  hasMacros?: boolean;
  macros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface SupplementSuggestion {
  mode: 'complement' | 'replacement';
  mealType: string;
  supplements: Supplement[];
  reasoning: string;
  totalMacros?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

interface SupplementCardProps {
  mealType: string;
  goal: string;
  mealName: string;
  dailyCalories?: number;
  proteinTarget?: number;
  mealSkipped?: boolean;
  alreadySuggestedToday?: string[];
}

const PRIORITY_STYLES = {
  essential: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  recommended: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  optional: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABELS = {
  essential: 'Essencial',
  recommended: 'Recomendado',
  optional: 'Opcional',
};

const DOSE_TYPE_LABELS: Record<string, string> = {
  single_daily: 'Dose única/dia',
  meal_replacement: 'Substituto',
  contextual: 'Complementar',
};

export function SupplementCard({ 
  mealType, 
  goal, 
  mealName,
  dailyCalories,
  proteinTarget,
  mealSkipped = false,
  alreadySuggestedToday = [],
}: SupplementCardProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(mealSkipped); // Auto-abrir se refeição pulada
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<SupplementSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!user || hasFetched) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('suggest-supplements', {
        body: { 
          mealType,
          goal,
          dailyCalories,
          proteinTarget,
          mealSkipped,
          alreadySuggestedToday,
        },
      });

      if (fnError) throw fnError;
      
      if (data?.suggestion) {
        setSuggestion(data.suggestion);
      }
      setHasFetched(true);
    } catch (err: unknown) {
      console.error('Error fetching supplement suggestions:', err);
      const message = err instanceof Error ? err.message : 'Erro ao carregar sugestões';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user, hasFetched, mealType, goal, dailyCalories, proteinTarget, mealSkipped, alreadySuggestedToday]);

  // Fetch when opened for the first time
  useEffect(() => {
    if (isOpen && !hasFetched && !loading) {
      fetchSuggestions();
    }
  }, [isOpen, hasFetched, loading, fetchSuggestions]);

  // Auto-abrir e buscar se refeição foi pulada
  useEffect(() => {
    if (mealSkipped && !hasFetched) {
      setIsOpen(true);
    }
  }, [mealSkipped, hasFetched]);

  const handleRetry = useCallback(() => {
    setHasFetched(false);
    setError(null);
    fetchSuggestions();
  }, [fetchSuggestions]);

  if (!goal) return null;

  const isReplacementMode = suggestion?.mode === 'replacement';
  const cardTitle = isReplacementMode 
    ? 'Suplementação para Compensar' 
    : 'Suplementação Complementar';
  const cardSubtitle = isReplacementMode
    ? `Substituto para ${mealName} pulado`
    : `Complementar ao ${mealName}`;

  return (
    <Card className={`border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent overflow-hidden ${mealSkipped ? 'ring-2 ring-amber-500/50' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${mealSkipped ? 'bg-amber-500/20' : 'bg-purple-500/20'}`}>
                  <Pill className={`h-4 w-4 ${mealSkipped ? 'text-amber-500' : 'text-purple-500'}`} />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {cardTitle}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      IA
                    </Badge>
                    {mealSkipped && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">
                        Refeição pulada
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {cardSubtitle}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-6"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-purple-500 mr-2" />
                  <span className="text-sm text-muted-foreground">Gerando sugestões...</span>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 py-4 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                  <Button variant="ghost" size="sm" onClick={handleRetry}>
                    Tentar novamente
                  </Button>
                </motion.div>
              ) : suggestion && suggestion.supplements.length > 0 ? (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {/* Aviso importante para modo complemento */}
                  {!isReplacementMode && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                      <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">Suplementos complementares</strong> não afetam 
                        as calorias ou macros do seu plano. São sugestões opcionais para otimizar resultados.
                      </p>
                    </div>
                  )}

                  {/* Lista de suplementos */}
                  {suggestion.supplements.map((supp, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-background/60 border border-border/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            {supp.name}
                            {supp.doseType === 'single_daily' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">Dose única diária - não repetir em outras refeições</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground">{supp.dosage}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] shrink-0 ${PRIORITY_STYLES[supp.priority]}`}
                          >
                            {PRIORITY_LABELS[supp.priority]}
                          </Badge>
                          {supp.doseType && (
                            <span className="text-[9px] text-muted-foreground">
                              {DOSE_TYPE_LABELS[supp.doseType]}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-muted-foreground">
                          ⏰ {supp.timing}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        {supp.benefit}
                      </p>

                      {/* Macros para suplementos de substituição */}
                      {supp.hasMacros && supp.macros && (
                        <div className="flex gap-3 pt-2 border-t border-border/30 text-xs">
                          <span className="text-amber-600">{supp.macros.calories} kcal</span>
                          <span className="text-blue-600">{supp.macros.protein}g P</span>
                          <span className="text-green-600">{supp.macros.carbs}g C</span>
                          <span className="text-orange-600">{supp.macros.fat}g G</span>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Total de macros para modo substituição */}
                  {isReplacementMode && suggestion.totalMacros && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                      <h5 className="text-xs font-medium text-amber-700 dark:text-amber-400">
                        Total para compensação:
                      </h5>
                      <div className="flex gap-4 text-sm font-medium">
                        <span className="text-amber-600">{suggestion.totalMacros.calories} kcal</span>
                        <span className="text-blue-600">{suggestion.totalMacros.protein}g P</span>
                        <span className="text-green-600">{suggestion.totalMacros.carbs}g C</span>
                        <span className="text-orange-600">{suggestion.totalMacros.fat}g G</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        ⚠️ Estes macros são para compensar a refeição pulada, não são adicionais ao plano.
                      </p>
                    </div>
                  )}

                  {suggestion.reasoning && (
                    <p className="text-xs text-muted-foreground italic pt-2 border-t">
                      💡 {suggestion.reasoning}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4 text-sm text-muted-foreground"
                >
                  {mealSkipped 
                    ? 'Nenhum suplemento de substituição disponível para esta refeição'
                    : 'Nenhum suplemento complementar recomendado para este horário'}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
