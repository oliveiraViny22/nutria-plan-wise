import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Settings, 
  Upload, 
  Download, 
  FileText, 
  History, 
  Shield, 
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Loader2,
  Eye,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminOperations } from '@/hooks/useAdminOperations';
import { useToast } from '@/hooks/use-toast';

// CSV parsing helper
function parseCSV(text: string): Record<string, unknown>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: Record<string, unknown>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { 
    loading, 
    settings, 
    foodImports, 
    auditLogs,
    auditTotal,
    fetchSettings, 
    updateSetting,
    fetchFoodImports,
    validateFoodCSV,
    importFoods,
    fetchAuditLogs,
    downloadTemplate
  } = useAdminOperations();

  const [activeTab, setActiveTab] = useState('settings');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: Record<string, unknown>[]; validation: { valid: boolean; errors: string[]; validRows: unknown[] } | null }>({ rows: [], validation: null });
  const [showPreview, setShowPreview] = useState(false);
  const [auditPage, setAuditPage] = useState(0);

  // Redirect if not admin
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      toast({ 
        title: 'Acesso negado', 
        description: 'Você não tem permissão para acessar esta página.', 
        variant: 'destructive' 
      });
      navigate('/dashboard');
    }
  }, [isAdmin, roleLoading, navigate, toast]);

  // Load initial data
  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
      fetchFoodImports();
      fetchAuditLogs();
    }
  }, [isAdmin, fetchSettings, fetchFoodImports, fetchAuditLogs]);

  const handleSettingChange = (key: string, value: unknown) => {
    setEditedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSetting = async (key: string) => {
    const value = editedSettings[key];
    if (value === undefined) return;

    try {
      await updateSetting(key, value);
      setEditedSettings(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    } catch {
      // Error already handled in hook
    }
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    
    const text = await file.text();
    const rows = parseCSV(text);
    
    if (rows.length === 0) {
      toast({ title: 'Arquivo vazio', description: 'O arquivo não contém dados válidos.', variant: 'destructive' });
      return;
    }

    const validation = await validateFoodCSV(rows);
    setCsvPreview({ rows, validation });
    setShowPreview(true);
  }, [toast, validateFoodCSV]);

  const handleImport = async () => {
    if (!csvFile || !csvPreview.validation?.validRows.length) return;

    try {
      await importFoods(csvFile.name, csvPreview.validation.validRows as never);
      setShowPreview(false);
      setCsvFile(null);
      setCsvPreview({ rows: [], validation: null });
    } catch {
      // Error handled in hook
    }
  };

  const renderSettingEditor = (setting: { key: string; value: unknown; description: string | null }) => {
    const currentValue = editedSettings[setting.key] ?? setting.value;
    const hasChanges = setting.key in editedSettings;

    if (typeof setting.value === 'object' && setting.value !== null) {
      return (
        <div className="space-y-2">
          <Textarea
            value={JSON.stringify(currentValue, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleSettingChange(setting.key, parsed);
              } catch {
                // Invalid JSON, keep as string for now
              }
            }}
            className="font-mono text-xs min-h-[100px]"
          />
          {hasChanges && (
            <Button size="sm" onClick={() => handleSaveSetting(setting.key)} disabled={loading}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          )}
        </div>
      );
    }

    if (typeof setting.value === 'boolean') {
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={currentValue as boolean}
            onCheckedChange={(checked) => {
              handleSettingChange(setting.key, checked);
              updateSetting(setting.key, checked);
            }}
          />
          <span className="text-sm text-muted-foreground">{currentValue ? 'Ativado' : 'Desativado'}</span>
        </div>
      );
    }

    return (
      <div className="flex gap-2">
        <Input
          value={String(currentValue)}
          onChange={(e) => handleSettingChange(setting.key, e.target.value)}
        />
        {hasChanges && (
          <Button size="sm" onClick={() => handleSaveSetting(setting.key)} disabled={loading}>
            <Save className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, typeof settings>);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Painel Administrativo</h1>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary">
            Admin
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-lg grid-cols-4 mb-6">
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
            <TabsTrigger value="foods" className="flex items-center gap-1">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Alimentos</span>
            </TabsTrigger>
            <TabsTrigger value="imports" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Auditoria</span>
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <div className="grid gap-6">
              {Object.entries(groupedSettings).map(([category, categorySettings]) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle className="capitalize">{category}</CardTitle>
                    <CardDescription>
                      Configurações de {category === 'limits' ? 'limites do sistema' : 
                        category === 'ai' ? 'inteligência artificial' :
                        category === 'features' ? 'funcionalidades' :
                        category === 'content' ? 'conteúdo' :
                        category === 'food' ? 'alimentos' : category}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {categorySettings.map((setting) => (
                      <div key={setting.key} className="space-y-2">
                        <Label className="flex items-center gap-2">
                          {setting.key.replace(/_/g, ' ')}
                          {setting.is_sensitive && (
                            <Badge variant="secondary" className="text-xs">Sensível</Badge>
                          )}
                        </Label>
                        {setting.description && (
                          <p className="text-xs text-muted-foreground">{setting.description}</p>
                        )}
                        {renderSettingEditor(setting)}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Foods Upload Tab */}
          <TabsContent value="foods">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Alimentos</CardTitle>
                <CardDescription>
                  Faça upload de um arquivo CSV ou Excel com os alimentos para adicionar ao banco.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo CSV
                  </Button>
                  
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="food-upload"
                    />
                    <Label htmlFor="food-upload" asChild>
                      <Button variant="default" className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        Selecionar Arquivo
                      </Button>
                    </Label>
                  </div>
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Formato esperado</AlertTitle>
                  <AlertDescription>
                    Colunas obrigatórias: <code className="text-xs bg-muted px-1 rounded">name, calories, protein, carbs, fat</code>
                    <br />
                    Colunas opcionais: <code className="text-xs bg-muted px-1 rounded">serving_size, category, processing_level</code>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Import History Tab */}
          <TabsContent value="imports">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Importações</CardTitle>
                <CardDescription>
                  Todas as importações de alimentos realizadas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Importados</TableHead>
                        <TableHead>Falhas</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {foodImports.map((imp) => (
                        <TableRow key={imp.id}>
                          <TableCell className="font-mono text-xs">{imp.filename}</TableCell>
                          <TableCell>
                            <Badge variant={
                              imp.status === 'completed' ? 'default' :
                              imp.status === 'failed' ? 'destructive' :
                              imp.status === 'processing' ? 'secondary' : 'outline'
                            }>
                              {imp.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{imp.total_rows}</TableCell>
                          <TableCell className="text-green-600">{imp.imported_rows}</TableCell>
                          <TableCell className="text-red-600">{imp.failed_rows}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(imp.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                      {foodImports.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            Nenhuma importação realizada ainda.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle>Logs de Auditoria</CardTitle>
                <CardDescription>
                  Registro de todas as ações administrativas ({auditTotal} total).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ação</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge variant="outline">{log.action}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.entity_type}</TableCell>
                          <TableCell className="font-mono text-xs truncate max-w-[150px]">
                            {log.entity_id || '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                      {auditLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum log de auditoria ainda.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {auditTotal > 50 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={auditPage === 0}
                      onClick={() => {
                        setAuditPage(p => p - 1);
                        fetchAuditLogs(50, (auditPage - 1) * 50);
                      }}
                    >
                      Anterior
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={(auditPage + 1) * 50 >= auditTotal}
                      onClick={() => {
                        setAuditPage(p => p + 1);
                        fetchAuditLogs(50, (auditPage + 1) * 50);
                      }}
                    >
                      Próximo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview da Importação
            </DialogTitle>
            <DialogDescription>
              {csvFile?.name} - {csvPreview.rows.length} linhas encontradas
            </DialogDescription>
          </DialogHeader>

          {csvPreview.validation && (
            <div className="space-y-4">
              {csvPreview.validation.valid ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-800">Validação OK</AlertTitle>
                  <AlertDescription className="text-green-700">
                    {csvPreview.validation.validRows.length} linhas válidas prontas para importação.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erros encontrados</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                      {csvPreview.validation.errors.slice(0, 10).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {csvPreview.validation.errors.length > 10 && (
                        <li>... e mais {csvPreview.validation.errors.length - 10} erros</li>
                      )}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(csvPreview.rows[0] || {}).map(key => (
                        <TableHead key={key} className="text-xs">{key}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.rows.slice(0, 20).map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((val, j) => (
                          <TableCell key={j} className="text-xs py-1">
                            {String(val).substring(0, 30)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!csvPreview.validation.validRows.length || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Importar {csvPreview.validation.validRows.length} Alimentos
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
