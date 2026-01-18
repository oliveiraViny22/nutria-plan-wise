import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// New migration structure
interface MigrationSuggestion {
  name: string;
  old_category: string | null;
  old_processing_level: string | null;
  proposed_category: string;
  proposed_processing_level: string;
  justification: string;
  confidence: number;
  food_id: string;
}

interface MigrationResult {
  summary: {
    total: number;
    to_update: number;
    unchanged: number;
    already_migrated: number;
  };
  suggestions: MigrationSuggestion[];
}

interface FoodAuditProps {
  onApplySuggestion?: (foodId: string, updates: Record<string, string | null>) => Promise<void>;
  onApplyBatch?: (updates: Array<{ foodId: string; updates: { category?: string; processing_level?: string } }>) => Promise<{ success: number; failed: number; errors: Array<{ foodId: string; error: string }> }>;
  onApplyAll?: (updates: Array<{ foodId: string; updates: { category?: string; processing_level?: string } }>) => Promise<{ success: number; failed: number; errors: Array<{ foodId: string; error: string }> }>;
}

export function FoodAudit({ onApplySuggestion, onApplyBatch, onApplyAll }: FoodAuditProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);
  const [auditResult, setAuditResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const runAudit = async () => {
    setIsLoading(true);
    setError(null);
    setAuditResult(null);
    setSelectedSuggestions(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-foods`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ limit: 200, mode: 'migration' }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao executar auditoria');
      }

      const result: MigrationResult = await response.json();
      setAuditResult(result);

      if (result.suggestions.length === 0) {
        toast({
          title: 'Migração concluída',
          description: 'Nenhum alimento precisa de reclassificação.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast({
        title: 'Erro na migração',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (foodId: string) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(foodId)) {
        next.delete(foodId);
      } else {
        next.add(foodId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (!auditResult) return;
    
    const suggestionsToUpdate = auditResult.suggestions.filter(s => 
      s.proposed_category !== s.old_category || 
      s.proposed_processing_level !== s.old_processing_level
    );
    
    if (selectedSuggestions.size === suggestionsToUpdate.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(suggestionsToUpdate.map(s => s.food_id)));
    }
  };

  const toggleRowExpand = (foodId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(foodId)) {
        next.delete(foodId);
      } else {
        next.add(foodId);
      }
      return next;
    });
  };

  const applySingleSuggestion = async (suggestion: MigrationSuggestion) => {
    if (!onApplySuggestion) return;

    setApplyingIds(prev => new Set(prev).add(suggestion.food_id));

    try {
      const updates: Record<string, string | null> = {
        category: suggestion.proposed_category,
        processing_level: suggestion.proposed_processing_level,
      };

      await onApplySuggestion(suggestion.food_id, updates);

      // Remove from results
      setAuditResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            to_update: prev.summary.to_update - 1,
          },
          suggestions: prev.suggestions.filter(s => s.food_id !== suggestion.food_id),
        };
      });

      toast({
        title: 'Reclassificação aplicada',
        description: `Alimento "${suggestion.name}" atualizado.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao aplicar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setApplyingIds(prev => {
        const next = new Set(prev);
        next.delete(suggestion.food_id);
        return next;
      });
    }
  };

  const applySelectedSuggestions = async () => {
    if (!onApplyBatch || !auditResult || selectedSuggestions.size === 0) return;

    setIsApplyingAll(true);
    const updates = auditResult.suggestions
      .filter(s => selectedSuggestions.has(s.food_id))
      .map(s => ({
        foodId: s.food_id,
        updates: {
          category: s.proposed_category,
          processing_level: s.proposed_processing_level,
        },
      }));

    try {
      const result = await onApplyBatch(updates);

      // Remove applied from results
      setAuditResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            to_update: prev.summary.to_update - result.success,
          },
          suggestions: prev.suggestions.filter(s => !selectedSuggestions.has(s.food_id)),
        };
      });

      setSelectedSuggestions(new Set());

      toast({
        title: 'Reclassificações aplicadas',
        description: `${result.success} alimentos atualizados${result.failed > 0 ? `, ${result.failed} falharam` : ''}.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao aplicar em lote',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingAll(false);
    }
  };

  const applyAllSuggestions = async () => {
    if (!onApplyAll || !auditResult) return;
    
    const suggestionsWithChanges = auditResult.suggestions.filter(hasChanges);
    if (suggestionsWithChanges.length === 0) return;

    setIsApplyingAll(true);
    const updates = suggestionsWithChanges.map(s => ({
      foodId: s.food_id,
      updates: {
        category: s.proposed_category,
        processing_level: s.proposed_processing_level,
      },
    }));

    try {
      const result = await onApplyAll(updates);

      // Clear all results on success
      if (result.success > 0) {
        setAuditResult(prev => {
          if (!prev) return prev;
          
          // Keep only the ones that failed
          const failedIds = new Set(result.errors.map(e => e.foodId));
          const remainingSuggestions = prev.suggestions.filter(s => failedIds.has(s.food_id));
          
          return {
            ...prev,
            summary: {
              ...prev.summary,
              to_update: remainingSuggestions.filter(hasChanges).length,
            },
            suggestions: remainingSuggestions,
          };
        });

        setSelectedSuggestions(new Set());
      }

      toast({
        title: 'Migração concluída!',
        description: `${result.success} alimentos reclassificados com sucesso${result.failed > 0 ? `. ${result.failed} falharam` : ''}.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao aplicar todas as reclassificações',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsApplyingAll(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const hasChanges = (suggestion: MigrationSuggestion) => {
    return suggestion.proposed_category !== suggestion.old_category || 
           suggestion.proposed_processing_level !== suggestion.old_processing_level;
  };

  const getCategoryLabel = (cat: string | null) => {
    if (!cat) return '—';
    // Normalize and display
    const labels: Record<string, string> = {
      'carboidratos': 'Carboidratos',
      'proteinas': 'Proteínas',
      'gorduras': 'Gorduras',
      'frutas': 'Frutas',
      'vegetais': 'Vegetais',
      'leguminosas': 'Leguminosas',
      'laticinios': 'Laticínios',
      'suplementos': 'Suplementos',
      'mistos': 'Mistos',
      'bebidas': 'Bebidas',
      'outros': 'Outros',
    };
    const normalized = cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return labels[normalized] || cat;
  };

  const getProcessingLabel = (level: string | null) => {
    if (!level) return '—';
    const labels: Record<string, string> = {
      'in natura': 'In Natura',
      'in_natura': 'In Natura',
      'natural': 'In Natura',
      'minimamente processado': 'Minimamente Processado',
      'minimamente_processado': 'Minimamente Processado',
      'processado': 'Processado',
      'ultraprocessado': 'Ultraprocessado',
      'suplemento': 'Suplemento',
    };
    const normalized = level.toLowerCase();
    return labels[normalized] || level;
  };

  const suggestionsToUpdate = auditResult?.suggestions.filter(hasChanges) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Migração de Classificação com IA
            </CardTitle>
            <CardDescription>
              Reclassifica alimentos usando as novas regras nutricionais determinísticas
            </CardDescription>
          </div>
          <Button onClick={runAudit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Iniciar Migração
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Analisando alimentos com IA...
              </span>
            </div>
            <Progress value={33} className="h-2" />
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {auditResult && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{auditResult.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Total de alimentos</div>
                </Card>
                <Card className="p-4 border-green-500/30 bg-green-500/5">
                  <div className="text-2xl font-bold text-green-600">
                    {auditResult.summary.already_migrated || 0}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({auditResult.summary.total > 0 
                        ? Math.round(((auditResult.summary.already_migrated || 0) / auditResult.summary.total) * 100) 
                        : 0}%)
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">Já migrados</div>
                </Card>
                <Card className="p-4 border-primary/30 bg-primary/5">
                  <div className="text-2xl font-bold text-primary">
                    {auditResult.summary.to_update}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({auditResult.summary.total > 0 
                        ? Math.round((auditResult.summary.to_update / auditResult.summary.total) * 100) 
                        : 0}%)
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">Para reclassificar</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold">
                    {auditResult.summary.unchanged}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({auditResult.summary.total > 0 
                        ? Math.round((auditResult.summary.unchanged / auditResult.summary.total) * 100) 
                        : 0}%)
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">Corretos (sem alteração)</div>
                </Card>
              </div>

              {/* Progress bar */}
              {auditResult.summary.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso da migração</span>
                    <span className="font-medium">
                      {Math.round((((auditResult.summary.already_migrated || 0) + auditResult.summary.unchanged) / auditResult.summary.total) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(((auditResult.summary.already_migrated || 0) + auditResult.summary.unchanged) / auditResult.summary.total) * 100} 
                    className="h-2"
                  />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Migrados: {auditResult.summary.already_migrated || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      Pendentes: {auditResult.summary.to_update}
                    </div>
                  </div>
                </div>
              )}

              {suggestionsToUpdate.length > 0 && (
                <>
                  {/* Batch actions */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedSuggestions.size === suggestionsToUpdate.length && suggestionsToUpdate.length > 0}
                        onCheckedChange={toggleAllSelection}
                        disabled={isApplyingAll}
                      />
                      <span className="text-sm">
                        {selectedSuggestions.size > 0 
                          ? `${selectedSuggestions.size} selecionado(s)`
                          : 'Selecionar todos'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedSuggestions.size > 0 && onApplyBatch && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={applySelectedSuggestions}
                          disabled={isApplyingAll}
                        >
                          {isApplyingAll ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          Aplicar Selecionados ({selectedSuggestions.size})
                        </Button>
                      )}
                      {onApplyAll && (
                        <Button 
                          size="sm" 
                          onClick={applyAllSuggestions}
                          disabled={isApplyingAll}
                          className="bg-primary"
                        >
                          {isApplyingAll ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Aplicando...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Aplicar Todos ({suggestionsToUpdate.length})
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Suggestions table */}
                  <ScrollArea className="h-[400px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Alimento</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Processamento</TableHead>
                          <TableHead className="text-right">Confiança</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suggestionsToUpdate.map((suggestion) => (
                          <Collapsible
                            key={suggestion.food_id}
                            open={expandedRows.has(suggestion.food_id)}
                            onOpenChange={() => toggleRowExpand(suggestion.food_id)}
                            asChild
                          >
                            <>
                              <TableRow className="cursor-pointer hover:bg-muted/50">
                                <TableCell>
                                  <Checkbox
                                    checked={selectedSuggestions.has(suggestion.food_id)}
                                    onCheckedChange={() => toggleSelection(suggestion.food_id)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </TableCell>
                                <TableCell>
                                  <CollapsibleTrigger asChild>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{suggestion.name}</span>
                                      {expandedRows.has(suggestion.food_id) 
                                        ? <ChevronUp className="w-4 h-4" />
                                        : <ChevronDown className="w-4 h-4" />
                                      }
                                    </div>
                                  </CollapsibleTrigger>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-muted-foreground">
                                      {getCategoryLabel(suggestion.old_category)}
                                    </Badge>
                                    <ArrowRight className="w-3 h-3 text-primary" />
                                    <Badge variant="default">
                                      {getCategoryLabel(suggestion.proposed_category)}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-muted-foreground">
                                      {getProcessingLabel(suggestion.old_processing_level)}
                                    </Badge>
                                    <ArrowRight className="w-3 h-3 text-primary" />
                                    <Badge variant="default">
                                      {getProcessingLabel(suggestion.proposed_processing_level)}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                                    {Math.round(suggestion.confidence * 100)}%
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {onApplySuggestion && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              applySingleSuggestion(suggestion);
                                            }}
                                            disabled={applyingIds.has(suggestion.food_id)}
                                          >
                                            {applyingIds.has(suggestion.food_id) 
                                              ? <Loader2 className="w-4 h-4 animate-spin" />
                                              : <CheckCircle className="w-4 h-4" />
                                            }
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Aplicar reclassificação</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={6} className="p-4">
                                    <div className="space-y-3">
                                      <div>
                                        <h4 className="font-medium mb-1 text-primary">Justificativa</h4>
                                        <p className="text-sm text-muted-foreground">
                                          {suggestion.justification || 'Classificação baseada nas regras nutricionais determinísticas.'}
                                        </p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <h4 className="font-medium mb-2">Classificação Atual</h4>
                                          <div className="space-y-1 text-muted-foreground">
                                            <div><strong>Categoria:</strong> {getCategoryLabel(suggestion.old_category)}</div>
                                            <div><strong>Processamento:</strong> {getProcessingLabel(suggestion.old_processing_level)}</div>
                                          </div>
                                        </div>
                                        <div>
                                          <h4 className="font-medium mb-2 text-primary">Nova Classificação</h4>
                                          <div className="space-y-1">
                                            <div className="text-primary font-medium">
                                              <strong>Categoria:</strong> {getCategoryLabel(suggestion.proposed_category)}
                                            </div>
                                            <div className="text-primary font-medium">
                                              <strong>Processamento:</strong> {getProcessingLabel(suggestion.proposed_processing_level)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </CollapsibleContent>
                            </>
                          </Collapsible>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}

              {suggestionsToUpdate.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">Nenhuma reclassificação necessária</p>
                  <p className="text-sm">Todos os alimentos já estão corretamente classificados.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {!isLoading && !auditResult && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Clique em "Iniciar Migração" para analisar os alimentos</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
