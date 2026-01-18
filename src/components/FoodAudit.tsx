import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Edit2,
  Copy,
  X,
  ChevronDown,
  ChevronUp,
  Flag,
  Sparkles,
  RefreshCw,
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

interface AuditSuggestion {
  food_id: string;
  fields: ('name' | 'category' | 'processing_level')[];
  current: {
    name: string;
    category: string | null;
    processing_level: string | null;
  };
  suggested: {
    name: string | null;
    category: string | null;
    processing_level: string | null;
  };
  flags: ('duplicate' | 'review')[];
  confidence: number;
}

interface AuditResult {
  summary: {
    total: number;
    suggestable: number;
  };
  suggestions: AuditSuggestion[];
}

interface FoodAuditProps {
  onApplySuggestion?: (foodId: string, updates: Record<string, string | null>) => Promise<void>;
  onApplyBatch?: (updates: Array<{ foodId: string; updates: Record<string, string | null> }>) => Promise<void>;
}

export function FoodAudit({ onApplySuggestion, onApplyBatch }: FoodAuditProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
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
          body: JSON.stringify({ limit: 200 }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao executar auditoria');
      }

      const result: AuditResult = await response.json();
      setAuditResult(result);

      if (result.suggestions.length === 0) {
        toast({
          title: 'Auditoria concluída',
          description: 'Nenhuma sugestão de correção encontrada.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast({
        title: 'Erro na auditoria',
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
    
    if (selectedSuggestions.size === auditResult.suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(new Set(auditResult.suggestions.map(s => s.food_id)));
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

  const applySingleSuggestion = async (suggestion: AuditSuggestion) => {
    if (!onApplySuggestion) return;

    setApplyingIds(prev => new Set(prev).add(suggestion.food_id));

    try {
      const updates: Record<string, string | null> = {};
      if (suggestion.suggested.name) updates.name = suggestion.suggested.name;
      if (suggestion.suggested.category) updates.category = suggestion.suggested.category;
      if (suggestion.suggested.processing_level) updates.processing_level = suggestion.suggested.processing_level;

      await onApplySuggestion(suggestion.food_id, updates);

      // Remove from results
      setAuditResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            suggestable: prev.summary.suggestable - 1,
          },
          suggestions: prev.suggestions.filter(s => s.food_id !== suggestion.food_id),
        };
      });

      toast({
        title: 'Sugestão aplicada',
        description: `Alimento "${suggestion.current.name}" atualizado.`,
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

    const updates = auditResult.suggestions
      .filter(s => selectedSuggestions.has(s.food_id))
      .map(s => ({
        foodId: s.food_id,
        updates: {
          ...(s.suggested.name && { name: s.suggested.name }),
          ...(s.suggested.category && { category: s.suggested.category }),
          ...(s.suggested.processing_level && { processing_level: s.suggested.processing_level }),
        },
      }));

    try {
      await onApplyBatch(updates);

      // Remove applied from results
      setAuditResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          summary: {
            ...prev.summary,
            suggestable: prev.summary.suggestable - selectedSuggestions.size,
          },
          suggestions: prev.suggestions.filter(s => !selectedSuggestions.has(s.food_id)),
        };
      });

      setSelectedSuggestions(new Set());

      toast({
        title: 'Sugestões aplicadas',
        description: `${updates.length} alimentos atualizados.`,
      });
    } catch (err) {
      toast({
        title: 'Erro ao aplicar em lote',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getFlagBadge = (flag: 'duplicate' | 'review') => {
    if (flag === 'duplicate') {
      return <Badge variant="outline" className="text-orange-600 border-orange-600"><Copy className="w-3 h-3 mr-1" />Duplicado</Badge>;
    }
    return <Badge variant="outline" className="text-red-600 border-red-600"><AlertTriangle className="w-3 h-3 mr-1" />Revisar</Badge>;
  };

  const getCategoryLabel = (cat: string | null) => {
    const labels: Record<string, string> = {
      proteinas: 'Proteínas',
      carboidratos: 'Carboidratos',
      vegetais: 'Vegetais',
      frutas: 'Frutas',
      laticinios: 'Laticínios',
      gorduras: 'Gorduras',
      bebidas: 'Bebidas',
      outros: 'Outros',
    };
    return cat ? labels[cat] || cat : '—';
  };

  const getProcessingLabel = (level: string | null) => {
    const labels: Record<string, string> = {
      natural: 'Natural',
      minimamente_processado: 'Minimamente Processado',
      processado: 'Processado',
      ultraprocessado: 'Ultraprocessado',
    };
    return level ? labels[level] || level : '—';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Auditoria de Alimentos com IA
            </CardTitle>
            <CardDescription>
              Analisa alimentos existentes e sugere correções de normalização
            </CardDescription>
          </div>
          <Button onClick={runAudit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Iniciar Auditoria
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
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{auditResult.summary.total}</div>
                  <div className="text-sm text-muted-foreground">Alimentos analisados</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-primary">{auditResult.summary.suggestable}</div>
                  <div className="text-sm text-muted-foreground">Sugestões de correção</div>
                </Card>
              </div>

              {auditResult.suggestions.length > 0 && (
                <>
                  {/* Batch actions */}
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedSuggestions.size === auditResult.suggestions.length}
                        onCheckedChange={toggleAllSelection}
                      />
                      <span className="text-sm">
                        {selectedSuggestions.size > 0 
                          ? `${selectedSuggestions.size} selecionado(s)`
                          : 'Selecionar todos'}
                      </span>
                    </div>
                    {selectedSuggestions.size > 0 && onApplyBatch && (
                      <Button size="sm" onClick={applySelectedSuggestions}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Aplicar Selecionados
                      </Button>
                    )}
                  </div>

                  {/* Suggestions table */}
                  <ScrollArea className="h-[400px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Alimento</TableHead>
                          <TableHead>Campos</TableHead>
                          <TableHead>Flags</TableHead>
                          <TableHead className="text-right">Confiança</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditResult.suggestions.map((suggestion) => (
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
                                      <span className="font-medium">{suggestion.current.name}</span>
                                      {expandedRows.has(suggestion.food_id) 
                                        ? <ChevronUp className="w-4 h-4" />
                                        : <ChevronDown className="w-4 h-4" />
                                      }
                                    </div>
                                  </CollapsibleTrigger>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.fields.map(field => (
                                      <Badge key={field} variant="secondary" className="text-xs">
                                        {field === 'name' ? 'Nome' : 
                                         field === 'category' ? 'Categoria' : 'Processamento'}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {suggestion.flags.map(flag => (
                                      <span key={flag}>{getFlagBadge(flag)}</span>
                                    ))}
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
                                        <TooltipContent>Aplicar sugestão</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </TableCell>
                              </TableRow>
                              <CollapsibleContent asChild>
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={6} className="p-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <h4 className="font-medium mb-2">Atual</h4>
                                        <div className="space-y-1 text-muted-foreground">
                                          <div><strong>Nome:</strong> {suggestion.current.name}</div>
                                          <div><strong>Categoria:</strong> {getCategoryLabel(suggestion.current.category)}</div>
                                          <div><strong>Processamento:</strong> {getProcessingLabel(suggestion.current.processing_level)}</div>
                                        </div>
                                      </div>
                                      <div>
                                        <h4 className="font-medium mb-2 text-primary">Sugerido</h4>
                                        <div className="space-y-1">
                                          <div className={suggestion.suggested.name ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                            <strong>Nome:</strong> {suggestion.suggested.name || '(sem alteração)'}
                                          </div>
                                          <div className={suggestion.suggested.category ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                            <strong>Categoria:</strong> {suggestion.suggested.category ? getCategoryLabel(suggestion.suggested.category) : '(sem alteração)'}
                                          </div>
                                          <div className={suggestion.suggested.processing_level ? 'text-primary font-medium' : 'text-muted-foreground'}>
                                            <strong>Processamento:</strong> {suggestion.suggested.processing_level ? getProcessingLabel(suggestion.suggested.processing_level) : '(sem alteração)'}
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

              {auditResult.suggestions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p className="font-medium">Nenhuma correção necessária</p>
                  <p className="text-sm">Todos os alimentos estão corretamente normalizados.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {!isLoading && !auditResult && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Clique em "Iniciar Auditoria" para analisar os alimentos</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
