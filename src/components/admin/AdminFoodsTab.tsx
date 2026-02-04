/**
 * Admin Foods Tab Component
 * 
 * Manages food database, imports, and related settings
 */

import { useState, useRef, useCallback } from 'react';
import { 
  Database, 
  Upload, 
  Download,
  History,
  Search, 
  ChevronLeft, 
  ChevronRight,
  Edit2, 
  Trash2, 
  RefreshCw,
  Loader2,
  Save,
  Eye,
  AlertCircle,
  FlaskConical,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { FoodImportValidator, ValidationResult as FoodValidationResult, FoodRow } from '@/components/FoodImportValidator';
import { FoodCuration } from '@/components/FoodCuration';
import { PendingFoodsReview } from '@/components/PendingFoodsReview';
import { QuickStartTemplates } from '@/components/admin/QuickStartTemplates';
import { MealTemplatesManager } from '@/components/admin/MealTemplatesManager';
import { TemplateAnchorPreview } from '@/components/admin/TemplateAnchorPreview';
import { MealAnchorFoodsManager } from '@/components/admin/MealAnchorFoodsManager';
import { Food } from '@/hooks/useAdminOperations';
import { supabase } from '@/integrations/supabase/client';

interface FoodImport {
  id: string;
  filename: string;
  status: string;
  imported_rows: number;
  total_rows: number;
  created_at: string;
}

interface AdminFoodsTabProps {
  foods: Food[];
  foodsLoading: boolean;
  foodsTotal: number;
  foodImports: FoodImport[];
  loading: boolean;
  savingKeys: Set<string>;
  fetchFoods: (search: string, page: number) => void;
  updateFood: (foodId: string, data: Partial<Food>) => Promise<boolean>;
  deleteFood: (foodId: string) => Promise<boolean>;
  normalizeFoodNames: () => Promise<{ normalized: number; total: number }>;
  downloadTemplate: () => void;
  importFoods: (filename: string, rows: FoodRow[]) => Promise<void>;
}

export function AdminFoodsTab({
  foods,
  foodsLoading,
  foodsTotal,
  foodImports,
  loading,
  savingKeys,
  fetchFoods,
  updateFood,
  deleteFood,
  normalizeFoodNames,
  downloadTemplate,
  importFoods,
}: AdminFoodsTabProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [foodSearch, setFoodSearch] = useState('');
  const [foodPage, setFoodPage] = useState(0);
  const [showOnlySupplements, setShowOnlySupplements] = useState(false);
  const [editingFood, setEditingFood] = useState<Food | null>(null);
  const [editedFoodData, setEditedFoodData] = useState<Partial<Food>>({});
  const [deletingFoodId, setDeletingFoodId] = useState<string | null>(null);
  const [normalizingNames, setNormalizingNames] = useState(false);

  // Filtra alimentos localmente por is_supplement_item
  const filteredFoods = showOnlySupplements 
    ? foods.filter(f => f.is_supplement_item) 
    : foods;
  
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

        {/* Additional Sections */}
        <PendingFoodsReview />
        <FoodCuration />
        <QuickStartTemplates />
        <MealTemplatesManager />
        <TemplateAnchorPreview />
        <MealAnchorFoodsManager />

        {/* Foods Management Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Banco de Alimentos
            </CardTitle>
            <CardDescription>
              Visualize, edite e gerencie os alimentos cadastrados ({foodsTotal} total).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Actions */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar alimentos..."
                  value={foodSearch}
                  onChange={(e) => {
                    setFoodSearch(e.target.value);
                    setFoodPage(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      fetchFoods(foodSearch, 0);
                    }
                  }}
                  className="pl-10"
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => fetchFoods(foodSearch, foodPage)}
                disabled={foodsLoading}
              >
                {foodsLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar
              </Button>
              <Button 
                variant="outline" 
                onClick={async () => {
                  setNormalizingNames(true);
                  await normalizeFoodNames();
                  await fetchFoods(foodSearch, foodPage);
                  setNormalizingNames(false);
                }}
                disabled={normalizingNames}
              >
                {normalizingNames ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Normalizar Nomes
              </Button>
              
              {/* Filtro de suplementos */}
              <div className="flex items-center gap-2 ml-auto">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="filter-supplements" className="text-sm text-muted-foreground cursor-pointer">
                  Apenas suplementos
                </Label>
                <Switch
                  id="filter-supplements"
                  checked={showOnlySupplements}
                  onCheckedChange={setShowOnlySupplements}
                />
                {showOnlySupplements && (
                  <Badge variant="secondary" className="text-xs">
                    {filteredFoods.length}
                  </Badge>
                )}
              </div>
            </div>

            {/* Foods Table */}
            {foodsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredFoods.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {showOnlySupplements 
                    ? 'Nenhum item de suplementação encontrado na busca atual.' 
                    : 'Nenhum alimento encontrado. Use o botão "Buscar" para carregar os alimentos.'}
                </p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[400px]">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[22%]">Nome</TableHead>
                        <TableHead className="w-[15%]">Categoria</TableHead>
                        <TableHead className="w-[15%]">Processamento</TableHead>
                        <TableHead className="w-[10%] text-right">Calorias</TableHead>
                        <TableHead className="w-[10%] text-right">Prot.</TableHead>
                        <TableHead className="w-[10%] text-right">Carbs</TableHead>
                        <TableHead className="w-[10%] text-right">Gord.</TableHead>
                        <TableHead className="w-[8%] text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFoods.map((food) => (
                        <TableRow key={food.id}>
                          <TableCell className="font-medium truncate" title={food.name}>
                            <div className="flex items-center gap-1.5">
                              {food.is_supplement_item && (
                                <span title="Item de suplementação">
                                  <FlaskConical className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                                </span>
                              )}
                              <span className="truncate">{food.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs truncate max-w-full">{food.category || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs truncate max-w-full">{food.processing_level || '-'}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{food.calories}</TableCell>
                          <TableCell className="text-right tabular-nums">{food.protein}g</TableCell>
                          <TableCell className="text-right tabular-nums">{food.carbs}g</TableCell>
                          <TableCell className="text-right tabular-nums">{food.fat}g</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              onClick={() => {
                                  setEditingFood(food);
                                  setEditedFoodData({
                                    name: food.name,
                                    calories: food.calories,
                                    protein: food.protein,
                                    carbs: food.carbs,
                                    fat: food.fat,
                                    category: food.category,
                                    processing_level: food.processing_level,
                                    serving_size: food.serving_size,
                                    is_supplement_item: food.is_supplement_item || false,
                                    supplement_portion: food.supplement_portion,
                                    supplement_notes: food.supplement_notes,
                                    supplement_min_portion: food.supplement_min_portion,
                                    supplement_max_portion: food.supplement_max_portion,
                                  });
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setDeletingFoodId(food.id)}
                                disabled={savingKeys.has(`food_${food.id}`)}
                              >
                                {savingKeys.has(`food_${food.id}`) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {foods.length} de {foodsTotal} alimentos
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = foodPage - 1;
                        setFoodPage(newPage);
                        fetchFoods(foodSearch, newPage);
                      }}
                      disabled={foodPage === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {foodPage + 1} de {Math.ceil(foodsTotal / 20) || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newPage = foodPage + 1;
                        setFoodPage(newPage);
                        fetchFoods(foodSearch, newPage);
                      }}
                      disabled={(foodPage + 1) * 20 >= foodsTotal}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
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

      {/* Edit Food Dialog */}
      <Dialog open={!!editingFood} onOpenChange={(open) => !open && setEditingFood(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Alimento
            </DialogTitle>
            <CardDescription>
              Atualize as informações do alimento
            </CardDescription>
          </DialogHeader>

          {editingFood && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editedFoodData.name || ''}
                  onChange={(e) => setEditedFoodData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do alimento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Calorias (kcal)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedFoodData.calories || 0}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proteína (g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={editedFoodData.protein || 0}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, protein: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carboidratos (g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={editedFoodData.carbs || 0}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, carbs: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gordura (g)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={editedFoodData.fat || 0}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, fat: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={editedFoodData.category || ''}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, category: e.target.value || null }))}
                  >
                    <option value="">Selecionar...</option>
                    <option value="carboidratos">Carboidratos</option>
                    <option value="proteinas">Proteínas</option>
                    <option value="gorduras">Gorduras</option>
                    <option value="frutas">Frutas</option>
                    <option value="vegetais">Vegetais</option>
                    <option value="leguminosas">Leguminosas</option>
                    <option value="laticinios">Laticínios</option>
                    <option value="suplementos">Suplementos</option>
                    <option value="mistos">Mistos</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Nível de Processamento</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    value={editedFoodData.processing_level || ''}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, processing_level: e.target.value || null }))}
                  >
                    <option value="">Selecionar...</option>
                    <option value="in_natura">In natura</option>
                    <option value="minimamente_processado">Minimamente processado</option>
                    <option value="processado">Processado</option>
                    <option value="ultraprocessado">Ultraprocessado</option>
                    <option value="suplemento">Suplemento</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Porção</Label>
                <Input
                  value={editedFoodData.serving_size || '100g'}
                  onChange={(e) => setEditedFoodData(prev => ({ ...prev, serving_size: e.target.value }))}
                  placeholder="Ex: 100g"
                />
              </div>

              {/* Seção de Suplementação */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <Label htmlFor="is_supplement_item" className="font-medium">
                      Item de Suplementação
                    </Label>
                  </div>
                  <Switch
                    id="is_supplement_item"
                    checked={editedFoodData.is_supplement_item || false}
                    onCheckedChange={(checked) => setEditedFoodData(prev => ({ 
                      ...prev, 
                      is_supplement_item: checked,
                      // Preencher valores padrão quando ativado
                      supplement_portion: checked && !prev.supplement_portion ? (prev.serving_size || '100g') : prev.supplement_portion,
                      supplement_min_portion: checked && prev.supplement_min_portion === undefined ? 0.5 : prev.supplement_min_portion,
                      supplement_max_portion: checked && prev.supplement_max_portion === undefined ? 2 : prev.supplement_max_portion,
                    }))}
                  />
                </div>

                {editedFoodData.is_supplement_item && (
                  <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                    <div className="space-y-2">
                      <Label>Porção Padrão</Label>
                      <Input
                        value={editedFoodData.supplement_portion || ''}
                        onChange={(e) => setEditedFoodData(prev => ({ ...prev, supplement_portion: e.target.value }))}
                        placeholder="Ex: 30g, 1 scoop, 200ml"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Porção Mínima (fator)</Label>
                        <Input
                          type="number"
                          min={0.25}
                          step={0.25}
                          value={editedFoodData.supplement_min_portion || 0.5}
                          onChange={(e) => setEditedFoodData(prev => ({ ...prev, supplement_min_portion: parseFloat(e.target.value) || 0.5 }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Porção Máxima (fator)</Label>
                        <Input
                          type="number"
                          min={0.25}
                          step={0.25}
                          value={editedFoodData.supplement_max_portion || 2}
                          onChange={(e) => setEditedFoodData(prev => ({ ...prev, supplement_max_portion: parseFloat(e.target.value) || 2 }))}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Notas de Suplementação</Label>
                      <Input
                        value={editedFoodData.supplement_notes || ''}
                        onChange={(e) => setEditedFoodData(prev => ({ ...prev, supplement_notes: e.target.value }))}
                        placeholder="Ex: Ideal para shakes pós-treino"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingFood(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingFood) return;
                    const success = await updateFood(editingFood.id, editedFoodData);
                    if (success) {
                      setEditingFood(null);
                    }
                  }}
                  disabled={savingKeys.has(`food_${editingFood.id}`)}
                >
                  {savingKeys.has(`food_${editingFood.id}`) ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Food Confirmation */}
      <AlertDialog open={!!deletingFoodId} onOpenChange={(open) => !open && setDeletingFoodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este alimento? Esta ação não pode ser desfeita.
              {deletingFoodId && foods.find(f => f.id === deletingFoodId) && (
                <span className="block mt-2 font-medium text-foreground">
                  Alimento: {foods.find(f => f.id === deletingFoodId)?.name}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deletingFoodId) {
                  await deleteFood(deletingFoodId);
                  setDeletingFoodId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
