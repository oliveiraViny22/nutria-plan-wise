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
  X,
  Database,
  Users
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
    settingsLoading,
    savingKeys,
    savedKeys,
    errorKeys,
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
    downloadTemplate,
    seedTestData
  } = useAdminOperations();

  const [activeTab, setActiveTab] = useState('settings');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: Record<string, unknown>[]; validation: { valid: boolean; errors: string[]; validRows: unknown[] } | null }>({ rows: [], validation: null });
  const [showPreview, setShowPreview] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [seedingData, setSeedingData] = useState(false);
  const [seedResults, setSeedResults] = useState<Record<string, unknown> | null>(null);

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

  const handleSeedTestData = async () => {
    setSeedingData(true);
    try {
      const results = await seedTestData();
      setSeedResults(results);
      toast({
        title: 'Dados de teste criados',
        description: 'Contas e dados de teste foram gerados com sucesso.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao criar dados de teste',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setSeedingData(false);
    }
  };

  const renderSettingEditor = (setting: { key: string; value: unknown; description: string | null }) => {
    const currentValue = editedSettings[setting.key] ?? setting.value;
    const hasChanges = setting.key in editedSettings;
    const isSaving = savingKeys.has(setting.key);
    const isSaved = savedKeys.has(setting.key);
    const hasError = errorKeys.has(setting.key);

    const StatusIndicator = () => {
      if (isSaving) {
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Salvando...</span>
          </motion.div>
        );
      }
      if (isSaved) {
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-green-600"
          >
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs">Salvo!</span>
          </motion.div>
        );
      }
      if (hasError) {
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">Erro ao salvar</span>
          </motion.div>
        );
      }
      return null;
    };

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
            className={`font-mono text-xs min-h-[100px] transition-colors ${
              isSaved ? 'border-green-500 bg-green-50/50' : 
              hasError ? 'border-destructive bg-destructive/5' : ''
            }`}
            disabled={isSaving}
          />
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button 
                size="sm" 
                onClick={() => handleSaveSetting(setting.key)} 
                disabled={isSaving}
                className="transition-all"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            )}
            <StatusIndicator />
          </div>
        </div>
      );
    }

    if (typeof setting.value === 'boolean') {
      return (
        <div className="flex items-center gap-3">
          <Switch
            checked={currentValue as boolean}
            onCheckedChange={(checked) => {
              handleSettingChange(setting.key, checked);
              updateSetting(setting.key, checked);
            }}
            disabled={isSaving}
            className={isSaved ? 'data-[state=checked]:bg-green-600' : ''}
          />
          <span className="text-sm text-muted-foreground">
            {currentValue ? 'Ativado' : 'Desativado'}
          </span>
          <StatusIndicator />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={String(currentValue)}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            disabled={isSaving}
            className={`transition-colors ${
              isSaved ? 'border-green-500 bg-green-50/50' : 
              hasError ? 'border-destructive bg-destructive/5' : ''
            }`}
          />
          {hasChanges && (
            <Button 
              size="sm" 
              onClick={() => handleSaveSetting(setting.key)} 
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        <StatusIndicator />
      </div>
    );
  };

  const SettingsSkeleton = () => (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-32 bg-muted animate-pulse rounded" />
            <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2].map((j) => (
              <div key={j} className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-10 w-full bg-muted animate-pulse rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );

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
          <TabsList className="grid w-full max-w-2xl grid-cols-5 mb-6">
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
            <TabsTrigger value="seed" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Seed</span>
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings">
            {settingsLoading ? (
              <SettingsSkeleton />
            ) : settings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma configuração encontrada.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Verifique se a tabela system_settings foi populada corretamente.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <motion.div 
                className="grid gap-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {Object.entries(groupedSettings).map(([category, categorySettings], idx) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="capitalize flex items-center gap-2">
                          {category === 'limits' && <Settings className="h-5 w-5 text-primary" />}
                          {category === 'ai' && <Database className="h-5 w-5 text-primary" />}
                          {category === 'features' && <Shield className="h-5 w-5 text-primary" />}
                          {category === 'content' && <FileText className="h-5 w-5 text-primary" />}
                          {category === 'food' && <Upload className="h-5 w-5 text-primary" />}
                          {category}
                        </CardTitle>
                        <CardDescription>
                          Configurações de {category === 'limits' ? 'limites do sistema' : 
                            category === 'ai' ? 'inteligência artificial' :
                            category === 'features' ? 'funcionalidades' :
                            category === 'content' ? 'conteúdo' :
                            category === 'food' ? 'alimentos' : category}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {categorySettings.map((setting) => (
                          <div key={setting.key} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
                            <Label className="flex items-center gap-2 text-sm font-medium">
                              {setting.key.replace(/_/g, ' ')}
                              {setting.is_sensitive && (
                                <Badge variant="secondary" className="text-xs">Sensível</Badge>
                              )}
                            </Label>
                            {setting.description && (
                              <p className="text-xs text-muted-foreground mb-2">{setting.description}</p>
                            )}
                            {renderSettingEditor(setting)}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
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

          {/* Seed Test Data Tab */}
          <TabsContent value="seed">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Dados de Teste
                </CardTitle>
                <CardDescription>
                  Crie contas de teste para validação funcional do sistema. 
                  Também cria a conta administrativa inicial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Importante</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                      <li>Todas as contas de teste são marcadas com <code className="bg-muted px-1 rounded">is_test = true</code></li>
                      <li>A conta admin <strong>admin@nutriai.app</strong> é criada como conta real (não teste)</li>
                      <li>A senha inicial do admin é <code className="bg-muted px-1 rounded">AdmInit-2026!</code> e deve ser alterada no primeiro login</li>
                      <li>Dados de teste não afetam métricas de produção ou faturamento</li>
                    </ul>
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Contas de Teste</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><Badge variant="outline">Gratuito</Badge> test+gratuito@nutriai.dev</p>
                      <p><Badge variant="outline">Premium</Badge> test+premium@nutriai.dev</p>
                      <p><Badge variant="outline">Pessoal Pago</Badge> test+pessoal_pago@nutriai.dev</p>
                      <p><Badge variant="outline">Profissional</Badge> test+profissional@nutriai.dev</p>
                    </CardContent>
                  </Card>

                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Alunos de Teste</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p><Badge variant="secondary">Aluno 1</Badge> test+aluno1@nutriai.dev</p>
                      <p><Badge variant="secondary">Aluno 2</Badge> test+aluno2@nutriai.dev</p>
                      <p><Badge variant="secondary">Aluno 3</Badge> test+aluno3@nutriai.dev</p>
                      <p className="text-xs text-muted-foreground mt-2">Vinculados ao profissional de teste</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleSeedTestData} 
                    disabled={seedingData}
                    size="lg"
                  >
                    {seedingData ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando dados...
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4 mr-2" />
                        Criar Dados de Teste
                      </>
                    )}
                  </Button>
                </div>

                {seedResults && (
                  <Card className="bg-muted/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Resultados do Seed
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(seedResults, null, 2)}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  </Card>
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
