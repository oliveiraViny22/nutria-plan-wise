import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Copy, 
  RefreshCw,
  FileText,
  Sparkles,
  Search,
  ClipboardList
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface AuditAlert {
  food_id: string;
  food_name: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggested_fix?: string;
}

interface SuggestedFood {
  name: string;
  canonical_name: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string;
  serving_unit: string;
  type: 'food' | 'supplement';
  origin: string;
  confidence_level: string;
  is_optional: boolean;
  created_by_type: string;
  review_status: string;
  is_active: boolean;
  justification: string;
}

interface DuplicateCandidate {
  food_id: string;
  food_name: string;
  duplicate_of_id: string;
  duplicate_of_name: string;
  similarity_score: number;
  reason: string;
}

interface CurationReport {
  generated_at: string;
  summary: {
    total_foods: number;
    foods_with_alerts: number;
    suggested_new_foods: number;
    possible_duplicates: number;
    pending_review: number;
  };
  alerts: AuditAlert[];
  suggested_foods: SuggestedFood[];
  duplicates: DuplicateCandidate[];
}

type CurationMode = 'full' | 'audit' | 'suggest';

export function FoodCuration() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<CurationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CurationMode>('full');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [addingFood, setAddingFood] = useState<string | null>(null);

  const runCuration = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { data, error: fnError } = await supabase.functions.invoke('food-curation', {
        body: { mode, limit: 500 },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      setReport(data as CurationReport);
      toast.success('Curadoria concluída com sucesso');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      toast.error(`Erro na curadoria: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const addSuggestedFood = async (food: SuggestedFood) => {
    setAddingFood(food.canonical_name);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { error: insertError } = await supabase.from('foods').insert({
        name: food.name,
        canonical_name: food.canonical_name,
        category: food.category,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        serving_size: food.serving_size,
        type: food.type,
        origin: 'ia_estimated',
        confidence_level: 'medium',
        is_optional: food.is_optional,
        created_by_type: 'ai',
        review_status: 'pending',
        is_active: true
      });

      if (insertError) {
        throw new Error(insertError.message);
      }

      toast.success(`Alimento "${food.name}" adicionado para revisão`);
      
      // Remove from suggested list
      if (report) {
        setReport({
          ...report,
          suggested_foods: report.suggested_foods.filter(sf => sf.canonical_name !== food.canonical_name),
          summary: {
            ...report.summary,
            suggested_new_foods: report.summary.suggested_new_foods - 1,
            pending_review: report.summary.pending_review + 1
          }
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao adicionar: ${message}`);
    } finally {
      setAddingFood(null);
    }
  };

  const toggleRowExpand = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive">Alto</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700">Médio</Badge>;
      case 'low':
        return <Badge variant="outline">Baixo</Badge>;
    }
  };

  const getAlertTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'macro_inconsistency': 'Macros Inconsistentes',
      'name_not_standardized': 'Nome Não Padronizado',
      'missing_category': 'Categoria Ausente',
      'missing_canonical': 'Canonical Ausente',
      'possible_duplicate': 'Possível Duplicata',
      'inactive_used': 'Inativo em Uso'
    };
    return labels[type] || type;
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'carboidratos': 'Carboidratos',
      'proteinas': 'Proteínas',
      'gorduras': 'Gorduras',
      'vegetais': 'Vegetais',
      'frutas': 'Frutas',
      'laticinios': 'Laticínios',
      'leguminosas': 'Leguminosas',
      'suplementos': 'Suplementos',
      'mistos': 'Mistos',
    };
    return labels[category] || category;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Curadoria IA do Banco de Alimentos
        </CardTitle>
        <CardDescription>
          Auditoria, deduplicação e sugestão de alimentos com governança completa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Modo:</span>
            <Select value={mode} onValueChange={(v) => setMode(v as CurationMode)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Completo
                  </div>
                </SelectItem>
                <SelectItem value="audit">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Apenas Auditoria
                  </div>
                </SelectItem>
                <SelectItem value="suggest">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Apenas Sugestões
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={runCuration} 
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Executar Curadoria
              </>
            )}
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{report.summary.total_foods}</div>
                  <div className="text-xs text-muted-foreground">Total de Alimentos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{report.summary.foods_with_alerts}</div>
                  <div className="text-xs text-muted-foreground">Com Alertas</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{report.summary.suggested_new_foods}</div>
                  <div className="text-xs text-muted-foreground">Novos Sugeridos</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-600">{report.summary.possible_duplicates}</div>
                  <div className="text-xs text-muted-foreground">Possíveis Duplicatas</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-blue-600">{report.summary.pending_review}</div>
                  <div className="text-xs text-muted-foreground">Aguardando Revisão</div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs for different sections */}
            <Tabs defaultValue="alerts" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="alerts" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas ({report.alerts.length})
                </TabsTrigger>
                <TabsTrigger value="suggestions" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Sugestões ({report.suggested_foods.length})
                </TabsTrigger>
                <TabsTrigger value="duplicates" className="gap-2">
                  <Copy className="h-4 w-4" />
                  Duplicatas ({report.duplicates.length})
                </TabsTrigger>
              </TabsList>

              {/* Alerts Tab */}
              <TabsContent value="alerts">
                <ScrollArea className="h-[400px]">
                  {report.alerts.length === 0 ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle>Tudo certo!</AlertTitle>
                      <AlertDescription>
                        Nenhum alerta encontrado no banco de alimentos.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Alimento</TableHead>
                          <TableHead>Tipo de Alerta</TableHead>
                          <TableHead>Severidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.alerts.map((alert, idx) => (
                          <React.Fragment key={`alert-${idx}`}>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRowExpand(`alert-${idx}`)}
                            >
                              <TableCell>
                                {expandedRows.has(`alert-${idx}`) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{alert.food_name}</TableCell>
                              <TableCell>{getAlertTypeLabel(alert.alert_type)}</TableCell>
                              <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                            </TableRow>
                            {expandedRows.has(`alert-${idx}`) && (
                              <TableRow>
                                <TableCell colSpan={4} className="bg-muted/30">
                                  <div className="p-4 space-y-2">
                                    <div>
                                      <span className="font-semibold">Descrição: </span>
                                      {alert.description}
                                    </div>
                                    {alert.suggested_fix && (
                                      <div>
                                        <span className="font-semibold">Sugestão: </span>
                                        {alert.suggested_fix}
                                      </div>
                                    )}
                                    <div className="text-xs text-muted-foreground">
                                      ID: {alert.food_id}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Suggestions Tab */}
              <TabsContent value="suggestions">
                <ScrollArea className="h-[400px]">
                  {report.suggested_foods.length === 0 ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle>Banco completo!</AlertTitle>
                      <AlertDescription>
                        Nenhum novo alimento sugerido. O banco está bem coberto.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Macros</TableHead>
                          <TableHead className="w-[100px]">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.suggested_foods.map((food, idx) => (
                          <React.Fragment key={`food-${idx}`}>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRowExpand(`food-${idx}`)}
                            >
                              <TableCell>
                                {expandedRows.has(`food-${idx}`) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{food.name}</TableCell>
                              <TableCell>{getCategoryLabel(food.category)}</TableCell>
                              <TableCell>
                                <Badge variant={food.type === 'supplement' ? 'secondary' : 'outline'}>
                                  {food.type === 'supplement' ? 'Suplemento' : 'Alimento'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {food.calories}kcal | P:{food.protein}g | C:{food.carbs}g | G:{food.fat}g
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={addingFood === food.canonical_name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addSuggestedFood(food);
                                  }}
                                >
                                  {addingFood === food.canonical_name ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {expandedRows.has(`food-${idx}`) && (
                              <TableRow>
                                <TableCell colSpan={6} className="bg-muted/30">
                                  <div className="p-4 space-y-2">
                                    <div>
                                      <span className="font-semibold">Canonical: </span>
                                      <code className="bg-muted px-1 rounded">{food.canonical_name}</code>
                                    </div>
                                    <div>
                                      <span className="font-semibold">Porção: </span>
                                      {food.serving_size}
                                    </div>
                                    <div>
                                      <span className="font-semibold">Justificativa: </span>
                                      {food.justification}
                                    </div>
                                    <div className="flex gap-2 text-xs text-muted-foreground">
                                      <Badge variant="outline">origin: {food.origin}</Badge>
                                      <Badge variant="outline">confidence: {food.confidence_level}</Badge>
                                      <Badge variant="outline">review: {food.review_status}</Badge>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Duplicates Tab */}
              <TabsContent value="duplicates">
                <ScrollArea className="h-[400px]">
                  {report.duplicates.length === 0 ? (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle>Sem duplicatas!</AlertTitle>
                      <AlertDescription>
                        Nenhuma duplicata potencial encontrada.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>Alimento</TableHead>
                          <TableHead>Duplicata de</TableHead>
                          <TableHead>Similaridade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.duplicates.map((dup, idx) => (
                          <React.Fragment key={`dup-${idx}`}>
                            <TableRow 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleRowExpand(`dup-${idx}`)}
                            >
                              <TableCell>
                                {expandedRows.has(`dup-${idx}`) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{dup.food_name}</TableCell>
                              <TableCell>{dup.duplicate_of_name}</TableCell>
                              <TableCell>
                                <Badge variant={dup.similarity_score >= 0.9 ? 'destructive' : 'secondary'}>
                                  {Math.round(dup.similarity_score * 100)}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                            {expandedRows.has(`dup-${idx}`) && (
                              <TableRow>
                                <TableCell colSpan={4} className="bg-muted/30">
                                  <div className="p-4 space-y-2">
                                    <div>
                                      <span className="font-semibold">Razão: </span>
                                      {dup.reason}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      IDs: {dup.food_id} → {dup.duplicate_of_id}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>

            {/* Report timestamp */}
            <div className="text-xs text-muted-foreground text-right">
              Relatório gerado em: {new Date(report.generated_at).toLocaleString('pt-BR')}
            </div>
          </>
        )}

        {/* Initial state */}
        {!report && !loading && !error && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Curadoria IA</AlertTitle>
            <AlertDescription>
              Clique em "Executar Curadoria" para iniciar a análise do banco de alimentos.
              A IA irá auditar inconsistências, detectar duplicatas e sugerir novos alimentos.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
