import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Check, X, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PendingFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  category: string | null;
  processing_level: string | null;
  serving_size: string | null;
  created_by_type: string | null;
  origin: string | null;
  confidence_level: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<string, string> = {
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

const PROCESSING_LABELS: Record<string, string> = {
  'in_natura': 'In Natura',
  'minimamente_processado': 'Min. Processado',
  'processado': 'Processado',
  'ultraprocessado': 'Ultraprocessado',
  'suplemento': 'Suplemento',
};

export function PendingFoodsReview() {
  const [pendingFoods, setPendingFoods] = useState<PendingFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchPendingFoods = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('review_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPendingFoods(data || []);
    } catch (error) {
      console.error('Error fetching pending foods:', error);
      toast.error('Erro ao carregar alimentos pendentes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingFoods();
  }, []);

  const handleApprove = async (foodId: string) => {
    setProcessingIds(prev => new Set(prev).add(foodId));
    try {
      const { error } = await supabase
        .from('foods')
        .update({ review_status: 'approved' })
        .eq('id', foodId);

      if (error) throw error;
      
      toast.success('Alimento aprovado');
      setPendingFoods(prev => prev.filter(f => f.id !== foodId));
    } catch (error) {
      console.error('Error approving food:', error);
      toast.error('Erro ao aprovar alimento');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(foodId);
        return next;
      });
    }
  };

  const handleReject = async (foodId: string) => {
    setProcessingIds(prev => new Set(prev).add(foodId));
    try {
      const { error } = await supabase
        .from('foods')
        .update({ review_status: 'rejected', is_active: false })
        .eq('id', foodId);

      if (error) throw error;
      
      toast.success('Alimento rejeitado');
      setPendingFoods(prev => prev.filter(f => f.id !== foodId));
    } catch (error) {
      console.error('Error rejecting food:', error);
      toast.error('Erro ao rejeitar alimento');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(foodId);
        return next;
      });
    }
  };

  const handleApproveAll = async () => {
    if (pendingFoods.length === 0) return;
    
    const ids = pendingFoods.map(f => f.id);
    setProcessingIds(new Set(ids));
    
    try {
      const { error } = await supabase
        .from('foods')
        .update({ review_status: 'approved' })
        .in('id', ids);

      if (error) throw error;
      
      toast.success(`${ids.length} alimentos aprovados`);
      setPendingFoods([]);
    } catch (error) {
      console.error('Error approving all foods:', error);
      toast.error('Erro ao aprovar alimentos');
    } finally {
      setProcessingIds(new Set());
    }
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getConfidenceBadge = (level: string | null) => {
    switch (level) {
      case 'high':
        return <Badge variant="default" className="bg-green-600">Alta</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-yellow-600 text-white">Média</Badge>;
      case 'low':
        return <Badge variant="destructive">Baixa</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const getOriginLabel = (origin: string | null, createdByType: string | null) => {
    if (createdByType === 'ai') return 'IA (Curadoria)';
    if (createdByType === 'professional') return 'Profissional';
    switch (origin) {
      case 'manual': return 'Manual';
      case 'import': return 'Importação';
      case 'ia_estimated': return 'IA (Estimado)';
      default: return origin || '-';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Alimentos Pendentes de Aprovação
            </CardTitle>
            <CardDescription>
              {pendingFoods.length} alimentos aguardando revisão antes de ficarem disponíveis no sistema.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchPendingFoods}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            {pendingFoods.length > 0 && (
              <Button 
                size="sm" 
                onClick={handleApproveAll}
                disabled={processingIds.size > 0}
              >
                <Check className="h-4 w-4 mr-2" />
                Aprovar Todos ({pendingFoods.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : pendingFoods.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Check className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <p className="text-lg font-medium">Tudo em dia!</p>
            <p className="text-sm">Não há alimentos pendentes de aprovação.</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[5%]"></TableHead>
                  <TableHead className="w-[25%]">Nome</TableHead>
                  <TableHead className="w-[12%]">Categoria</TableHead>
                  <TableHead className="w-[10%]">Origem</TableHead>
                  <TableHead className="w-[8%]">Confiança</TableHead>
                  <TableHead className="w-[8%] text-right">Cal</TableHead>
                  <TableHead className="w-[6%] text-right">P</TableHead>
                  <TableHead className="w-[6%] text-right">C</TableHead>
                  <TableHead className="w-[6%] text-right">G</TableHead>
                  <TableHead className="w-[14%] text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingFoods.map((food) => (
                  <Collapsible key={food.id} asChild>
                    <>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6"
                              onClick={() => toggleRowExpand(food.id)}
                            >
                              {expandedRows.has(food.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell className="font-medium">{food.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[food.category || ''] || food.category || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {getOriginLabel(food.origin, food.created_by_type)}
                        </TableCell>
                        <TableCell>{getConfidenceBadge(food.confidence_level)}</TableCell>
                        <TableCell className="text-right tabular-nums">{food.calories}</TableCell>
                        <TableCell className="text-right tabular-nums">{food.protein}g</TableCell>
                        <TableCell className="text-right tabular-nums">{food.carbs}g</TableCell>
                        <TableCell className="text-right tabular-nums">{food.fat}g</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                              onClick={() => handleApprove(food.id)}
                              disabled={processingIds.has(food.id)}
                            >
                              {processingIds.has(food.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100"
                              onClick={() => handleReject(food.id)}
                              disabled={processingIds.has(food.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={10} className="py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Porção:</span>{' '}
                                <span className="font-medium">{food.serving_size || '100g'}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Processamento:</span>{' '}
                                <span className="font-medium">
                                  {PROCESSING_LABELS[food.processing_level || ''] || food.processing_level || '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Criado em:</span>{' '}
                                <span className="font-medium">
                                  {new Date(food.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Calorias calculadas:</span>{' '}
                                <span className="font-medium">
                                  {Math.round(food.protein * 4 + food.carbs * 4 + food.fat * 9)} kcal
                                </span>
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
        )}
      </CardContent>
    </Card>
  );
}
