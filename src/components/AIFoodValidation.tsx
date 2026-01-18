import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Sparkles, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  RefreshCw,
  ArrowRight,
  Copy,
  Ban,
  Globe,
  Lock,
  Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FoodRow } from './FoodImportValidator';

interface AIValidationItem {
  row_index: number;
  original_name: string;
  normalized_name: string;
  final_name: string;
  is_duplicate: boolean;
  duplicate_name: string | null;
  validation_status: 'valid' | 'warning' | 'invalid';
  issues: string[];
  calories_check: {
    calculated: number;
    declared: number;
  };
  category: string;
  processing_level: string;
  action: 'use_existing' | 'import_private' | 'import_global' | 'reject';
  confidence: number;
}

interface AIValidationResult {
  summary: {
    total: number;
    use_existing: number;
    import_private: number;
    import_global: number;
    reject: number;
  };
  items: AIValidationItem[];
}

interface AIFoodValidationProps {
  foods: FoodRow[];
  onValidationComplete: (approvedFoods: FoodRow[]) => void;
  onCancel: () => void;
}

const actionLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  use_existing: { label: 'Já existe', color: 'bg-blue-500', icon: <Copy className="h-3 w-3" /> },
  import_private: { label: 'Importar (privado)', color: 'bg-amber-500', icon: <Lock className="h-3 w-3" /> },
  import_global: { label: 'Importar (global)', color: 'bg-green-500', icon: <Globe className="h-3 w-3" /> },
  reject: { label: 'Rejeitar', color: 'bg-red-500', icon: <Ban className="h-3 w-3" /> },
};

export function AIFoodValidation({ foods, onValidationComplete, onCancel }: AIFoodValidationProps) {
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIValidationResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  const runValidation = async () => {
    setValidating(true);
    setError(null);
    setResult(null);

    try {
      const foodsToValidate = foods.map((f, idx) => ({
        row_index: idx,
        name: f.name,
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        serving_size: f.serving_size,
        category: f.category,
        processing_level: f.processing_level,
      }));

      const { data, error: fnError } = await supabase.functions.invoke('validate-food-import', {
        body: { foods_to_import: foodsToValidate },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data as AIValidationResult);

      // Auto-select all items that should be imported
      const importableItems = new Set<number>();
      (data as AIValidationResult).items.forEach((item) => {
        if (item.action === 'import_global' || item.action === 'import_private') {
          importableItems.add(item.row_index);
        }
      });
      setSelectedItems(importableItems);

    } catch (err) {
      console.error('AI validation error:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setValidating(false);
    }
  };

  const toggleItem = (rowIndex: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (!result) return;
    const allImportable = new Set<number>();
    result.items.forEach((item) => {
      if (item.action !== 'reject' && item.action !== 'use_existing') {
        allImportable.add(item.row_index);
      }
    });
    setSelectedItems(allImportable);
  };

  const selectNone = () => {
    setSelectedItems(new Set());
  };

  const handleConfirmImport = () => {
    if (!result) return;

    const approvedFoods: FoodRow[] = [];
    result.items.forEach((item) => {
      if (selectedItems.has(item.row_index)) {
        const originalFood = foods[item.row_index];
        approvedFoods.push({
          ...originalFood,
          name: item.final_name, // Use AI-corrected name
          category: item.category || originalFood.category,
          processing_level: item.processing_level || originalFood.processing_level,
        });
      }
    });

    onValidationComplete(approvedFoods);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  // Initial state - show start button
  if (!validating && !result && !error) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Validação Inteligente com IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A IA irá analisar {foods.length} alimentos para:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Detectar duplicatas no banco de dados</li>
            <li>Validar valores nutricionais</li>
            <li>Padronizar nomes em português</li>
            <li>Classificar categoria e nível de processamento</li>
          </ul>
          <div className="flex gap-2 pt-2">
            <Button onClick={runValidation} className="flex-1">
              <Sparkles className="h-4 w-4 mr-2" />
              Iniciar Validação com IA
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (validating) {
    return (
      <Card className="border-primary/20">
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <Sparkles className="h-10 w-10 text-primary animate-pulse" />
              <Loader2 className="h-6 w-6 text-primary absolute -bottom-1 -right-1 animate-spin" />
            </div>
            <div className="text-center">
              <p className="font-medium">Analisando alimentos com IA...</p>
              <p className="text-sm text-muted-foreground">
                Isso pode levar alguns segundos
              </p>
            </div>
            <Progress value={undefined} className="w-48 h-2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="py-6">
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Erro na validação</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-2 mt-4">
            <Button onClick={runValidation} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
            <Button onClick={onCancel} variant="ghost">
              Cancelar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Results state
  if (result) {
    const importableCount = result.items.filter(
      i => i.action === 'import_global' || i.action === 'import_private'
    ).length;

    return (
      <div className="space-y-4">
        {/* Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Resultado da Validação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="text-2xl font-bold text-green-600">{result.summary.import_global}</div>
                <div className="text-xs text-muted-foreground">Importar (global)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-600">{result.summary.import_private}</div>
                <div className="text-xs text-muted-foreground">Importar (privado)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-600">{result.summary.use_existing}</div>
                <div className="text-xs text-muted-foreground">Já existentes</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-600">{result.summary.reject}</div>
                <div className="text-xs text-muted-foreground">Rejeitados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selection controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              Selecionar todos importáveis
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              Limpar seleção
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            {selectedItems.size} de {importableCount} selecionados
          </span>
        </div>

        {/* Items table */}
        <Card>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nome Original</TableHead>
                  <TableHead>Nome Corrigido</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Ação</TableHead>
                  <TableHead className="w-20">Conf.</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((item) => {
                  const isSelectable = item.action !== 'reject' && item.action !== 'use_existing';
                  const isSelected = selectedItems.has(item.row_index);
                  const actionInfo = actionLabels[item.action];

                  return (
                    <TableRow 
                      key={item.row_index}
                      className={item.action === 'reject' ? 'opacity-50' : ''}
                    >
                      <TableCell>
                        {isSelectable && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(item.row_index)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.original_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {item.original_name !== item.final_name && (
                            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="font-medium">{item.final_name}</span>
                        </div>
                        {item.is_duplicate && item.duplicate_name && (
                          <div className="text-xs text-muted-foreground">
                            Duplicata de: {item.duplicate_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(item.validation_status)}
                          <span className="text-xs capitalize">{item.validation_status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${actionInfo.color} text-white text-xs`}
                        >
                          <span className="mr-1">{actionInfo.icon}</span>
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div 
                            className="h-2 flex-1 bg-muted rounded-full overflow-hidden"
                            style={{ width: '40px' }}
                          >
                            <div 
                              className={`h-full ${
                                item.confidence >= 80 ? 'bg-green-500' :
                                item.confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${item.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{item.confidence}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.issues.length > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <ul className="text-xs space-y-1">
                                  {item.issues.map((issue, idx) => (
                                    <li key={idx}>• {issue}</li>
                                  ))}
                                </ul>
                                <div className="mt-2 pt-2 border-t text-xs">
                                  <div>Calorias declaradas: {item.calories_check.declared}</div>
                                  <div>Calorias calculadas: {item.calories_check.calculated}</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runValidation}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Revalidar
            </Button>
            <Button 
              onClick={handleConfirmImport}
              disabled={selectedItems.size === 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Importar {selectedItems.size} alimentos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
