/**
 * Foods Import Sub-Tab Component
 * 
 * Handles food import, export, and import history
 */

import { useState, useRef, useCallback } from 'react';
import { 
  Upload, 
  Download,
  History,
  Loader2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FoodImportValidator, ValidationResult as FoodValidationResult, FoodRow } from '@/components/FoodImportValidator';
import { PendingFoodsReview } from '@/components/PendingFoodsReview';
import { FoodCuration } from '@/components/FoodCuration';
import { supabase } from '@/integrations/supabase/client';

interface FoodImport {
  id: string;
  filename: string;
  status: string;
  imported_rows: number;
  total_rows: number;
  created_at: string;
}

interface FoodsImportSubTabProps {
  foodImports: FoodImport[];
  loading: boolean;
  downloadTemplate: () => void;
  importFoods: (filename: string, rows: FoodRow[]) => Promise<void>;
}

export function FoodsImportSubTab({
  foodImports,
  loading,
  downloadTemplate,
  importFoods,
}: FoodsImportSubTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ rows: Record<string, unknown>[]; validation: FoodValidationResult | null }>({ rows: [], validation: null });
  const [showPreview, setShowPreview] = useState(false);
  const [showValidating, setShowValidating] = useState(false);
  const [downloadingFoods, setDownloadingFoods] = useState(false);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setShowValidating(true);
    setShowPreview(false);
    setImportPreview({ rows: [], validation: null });
  }, []);

  const handleValidationComplete = useCallback((validation: FoodValidationResult, rows: Record<string, unknown>[]) => {
    setImportPreview({ rows, validation });
    setShowValidating(false);
    setShowPreview(true);
  }, []);

  const handleCancelValidation = useCallback(() => {
    setShowValidating(false);
    setImportFile(null);
    setImportPreview({ rows: [], validation: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleImport = async () => {
    if (!importFile || !importPreview.validation?.validRows.length) return;

    try {
      await importFoods(importFile.name, importPreview.validation.validRows as FoodRow[]);
      setShowPreview(false);
      setImportFile(null);
      setImportPreview({ rows: [], validation: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch {
      // Error handled in hook
    }
  };

  const handleDownloadFoods = async () => {
    setDownloadingFoods(true);
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('name, calories, protein, carbs, fat, category, processing_level, serving_size')
        .order('name');

      if (error) throw error;

      const headers = ['Nome', 'Calorias', 'Proteína (g)', 'Carboidratos (g)', 'Gordura (g)', 'Categoria', 'Nível de Processamento', 'Porção'];
      const csvRows = [
        headers.join(';'),
        ...(data || []).map(food => [
          food.name,
          food.calories,
          food.protein,
          food.carbs,
          food.fat,
          food.category || '',
          food.processing_level || '',
          food.serving_size || ''
        ].join(';'))
      ];
      const csvContent = csvRows.join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `alimentos_nutriaplan_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Download concluído', description: `${data?.length || 0} alimentos exportados.` });
    } catch (error) {
      console.error('Error downloading foods:', error);
      toast({
        title: 'Erro ao baixar alimentos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setDownloadingFoods(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Import and History Cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Importar Alimentos
              </CardTitle>
              <CardDescription>
                Importe alimentos de arquivos Excel (.xls, .xlsx) ou texto (.csv, .txt).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.csv,.txt"
                  onChange={handleFileUpload}
                  className="w-full"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadFoods} disabled={downloadingFoods}>
                    {downloadingFoods ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exportar Banco
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico de Importações
              </CardTitle>
            </CardHeader>
            <CardContent>
              {foodImports.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">
                  Nenhuma importação registrada.
                </p>
              ) : (
                <ScrollArea className="h-[180px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%]">Arquivo</TableHead>
                        <TableHead className="w-[20%]">Status</TableHead>
                        <TableHead className="w-[20%] text-right">Qtd.</TableHead>
                        <TableHead className="w-[20%] text-right">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {foodImports.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="font-medium truncate max-w-[150px]">{imp.filename}</TableCell>
                          <TableCell>
                            <Badge variant={imp.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                              {imp.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">{imp.imported_rows}/{imp.total_rows}</TableCell>
                          <TableCell className="text-right text-sm">{new Date(imp.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Review and Curation */}
        <PendingFoodsReview />
        <FoodCuration />
      </div>

      {/* Validation Dialog */}
      {showValidating && importFile && (
        <Dialog open={showValidating} onOpenChange={(open) => !open && handleCancelValidation()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Validando arquivo: {importFile.name}</DialogTitle>
            </DialogHeader>
            <FoodImportValidator
              file={importFile}
              onValidationComplete={handleValidationComplete}
              onCancel={handleCancelValidation}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && setShowPreview(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévia da Importação
            </DialogTitle>
            <CardDescription>
              {importPreview.validation?.validRows.length || 0} alimentos válidos encontrados
            </CardDescription>
          </DialogHeader>
          
          {importPreview.validation && (
            <div className="space-y-4">
              {importPreview.validation.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {importPreview.validation.errors.length} erro(s) encontrado(s)
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Calorias</TableHead>
                      <TableHead>Proteína</TableHead>
                      <TableHead>Carboidratos</TableHead>
                      <TableHead>Gordura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.validation.validRows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.calories}</TableCell>
                        <TableCell>{row.protein}</TableCell>
                        <TableCell>{row.carbs}</TableCell>
                        <TableCell>{row.fat}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={loading || !importPreview.validation?.validRows.length}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Importar {importPreview.validation?.validRows.length || 0} alimentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
