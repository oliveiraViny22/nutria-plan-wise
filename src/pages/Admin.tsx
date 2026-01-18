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
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit2,
  UserCog,
  Trash2,
  Key,
  CreditCard,
  DollarSign,
  AlertTriangle,
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminOperations, UserProfile, Plan } from '@/hooks/useAdminOperations';
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
    users,
    usersLoading,
    usersTotal,
    plans,
    plansLoading,
    fetchSettings, 
    updateSetting,
    fetchFoodImports,
    validateFoodCSV,
    importFoods,
    fetchAuditLogs,
    downloadTemplate,
    seedTestData,
    fetchUsers,
    updateUser,
    toggleUserRole,
    changeUserPassword,
    deleteUser,
    fetchPlans,
    updatePlan,
  } = useAdminOperations();

  const [activeTab, setActiveTab] = useState('settings');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: Record<string, unknown>[]; validation: { valid: boolean; errors: string[]; validRows: unknown[] } | null }>({ rows: [], validation: null });
  const [showPreview, setShowPreview] = useState(false);
  const [auditPage, setAuditPage] = useState(0);
  const [seedingData, setSeedingData] = useState(false);
  const [seedResults, setSeedResults] = useState<Record<string, unknown> | null>(null);
  
  // Users management state
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [userFilter, setUserFilter] = useState<{ account_type?: 'aluno' | 'plano_pessoal' | 'premium' | 'profissional'; is_test?: boolean }>({});
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editedUserData, setEditedUserData] = useState<Partial<UserProfile>>({});
  const [showPasswordDialog, setShowPasswordDialog] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  
  // Plans management state
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editedPlanData, setEditedPlanData] = useState<Partial<Plan>>({});

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
          <TabsList className="grid w-full max-w-4xl grid-cols-7 mb-6">
            <TabsTrigger value="settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1">
              <UserCog className="h-4 w-4" />
              <span className="hidden sm:inline">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Planos</span>
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
              <Database className="h-4 w-4" />
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

          {/* Users Management Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="h-5 w-5 text-primary" />
                  Gestão de Usuários
                </CardTitle>
                <CardDescription>
                  Visualize e edite as contas de usuários do sistema ({usersTotal} total).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setUserPage(0);
                          fetchUsers(50, 0, userSearch, userFilter);
                        }
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Select 
                    value={userFilter.account_type || 'all'} 
                    onValueChange={(val) => {
                      const newFilter = val === 'all' 
                        ? { ...userFilter, account_type: undefined } 
                        : { ...userFilter, account_type: val as 'aluno' | 'plano_pessoal' | 'premium' | 'profissional' };
                      setUserFilter(newFilter);
                      setUserPage(0);
                      fetchUsers(50, 0, userSearch, newFilter);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tipo de conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="aluno">Aluno</SelectItem>
                      <SelectItem value="plano_pessoal">Plano Pessoal</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="profissional">Profissional</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select 
                    value={userFilter.is_test === undefined ? 'all' : userFilter.is_test ? 'test' : 'prod'}
                    onValueChange={(val) => {
                      const newFilter = val === 'all' 
                        ? { ...userFilter, is_test: undefined }
                        : { ...userFilter, is_test: val === 'test' };
                      setUserFilter(newFilter);
                      setUserPage(0);
                      fetchUsers(50, 0, userSearch, newFilter);
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Ambiente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="prod">Produção</SelectItem>
                      <SelectItem value="test">Teste</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => {
                    setUserPage(0);
                    fetchUsers(50, 0, userSearch, userFilter);
                  }}>
                    <Search className="h-4 w-4 mr-1" />
                    Buscar
                  </Button>
                </div>

                {/* Users Table */}
                <ScrollArea className="h-[500px] border rounded-lg">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      {activeTab === 'users' && users.length === 0 && !usersLoading ? (
                        <>
                          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Clique em "Buscar" para carregar os usuários</p>
                        </>
                      ) : (
                        <p>Nenhum usuário encontrado.</p>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Tipo Conta</TableHead>
                          <TableHead>Roles</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead className="text-center">Teste</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.user_id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{user.name || 'Sem nome'}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.account_type}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {user.roles.map((role) => (
                                  <Badge 
                                    key={role} 
                                    variant={role === 'admin' ? 'destructive' : role === 'professional' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {role}
                                  </Badge>
                                ))}
                                {user.roles.length === 0 && (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm">{user.plan_name || '-'}</span>
                                {user.subscription_status && (
                                  <Badge 
                                    variant={user.subscription_status === 'active' ? 'default' : 'secondary'}
                                    className="text-xs w-fit mt-0.5"
                                  >
                                    {user.subscription_status}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {user.is_test ? (
                                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                  Teste
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditedUserData({
                                      name: user.name,
                                      account_type: user.account_type,
                                      user_type: user.user_type,
                                      is_test: user.is_test,
                                    });
                                  }}
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setShowPasswordDialog(user);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                  }}
                                  title="Alterar senha"
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setDeleteConfirmUser(user)}
                                  className="text-destructive hover:text-destructive"
                                  title="Excluir usuário"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>

                {/* Pagination */}
                {usersTotal > 50 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Mostrando {userPage * 50 + 1} - {Math.min((userPage + 1) * 50, usersTotal)} de {usersTotal}
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={userPage === 0}
                        onClick={() => {
                          const newPage = userPage - 1;
                          setUserPage(newPage);
                          fetchUsers(50, newPage * 50, userSearch, userFilter);
                        }}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={(userPage + 1) * 50 >= usersTotal}
                        onClick={() => {
                          const newPage = userPage + 1;
                          setUserPage(newPage);
                          fetchUsers(50, newPage * 50, userSearch, userFilter);
                        }}
                      >
                        Próximo
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Management Tab */}
          <TabsContent value="plans">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Gestão de Planos
                  </CardTitle>
                  <CardDescription>
                    Configure os valores e limites dos planos de assinatura.
                  </CardDescription>
                </div>
                <Button onClick={() => fetchPlans()} variant="outline" size="sm">
                  <Loader2 className={`h-4 w-4 mr-2 ${plansLoading ? 'animate-spin' : ''}`} />
                  Carregar Planos
                </Button>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : plans.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Clique em "Carregar Planos" para visualizar os planos.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {plans.map((plan) => (
                      <Card key={plan.id} className={`relative ${!plan.is_active ? 'opacity-60' : ''}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {plan.name}
                              {!plan.is_active && (
                                <Badge variant="secondary">Inativo</Badge>
                              )}
                            </CardTitle>
                            <Badge variant={plan.type === 'professional' ? 'default' : 'outline'}>
                              {plan.type}
                            </Badge>
                          </div>
                          {plan.description && (
                            <CardDescription className="text-xs">{plan.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Mensal:</span>
                              <span className="font-medium">
                                {plan.price_monthly ? `R$ ${(plan.price_monthly / 100).toFixed(2)}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Trimestral:</span>
                              <span className="font-medium">
                                {plan.price_quarterly ? `R$ ${(plan.price_quarterly / 100).toFixed(2)}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Semestral:</span>
                              <span className="font-medium">
                                {plan.price_semiannual ? `R$ ${(plan.price_semiannual / 100).toFixed(2)}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Anual:</span>
                              <span className="font-medium">
                                {plan.price_annual ? `R$ ${(plan.price_annual / 100).toFixed(2)}` : '-'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground border-t pt-2 space-y-1">
                            <p>Dietas: {plan.diet_limit} | Substituições: {plan.substitution_limit} | Ajustes: {plan.adjustment_limit}</p>
                            <p>Histórico: {plan.history_days} dias | Chat: {plan.has_chat ? `${plan.chat_messages_per_day}/dia` : 'Não'}</p>
                            {plan.type === 'professional' && (
                              <p>Pacientes: {plan.patients_limit}</p>
                            )}
                          </div>

                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full mt-2"
                            onClick={() => {
                              setEditingPlan(plan);
                              setEditedPlanData({
                                price_monthly: plan.price_monthly,
                                price_quarterly: plan.price_quarterly,
                                price_semiannual: plan.price_semiannual,
                                price_annual: plan.price_annual,
                                diet_limit: plan.diet_limit,
                                substitution_limit: plan.substitution_limit,
                                adjustment_limit: plan.adjustment_limit,
                                patients_limit: plan.patients_limit,
                                history_days: plan.history_days,
                                has_chat: plan.has_chat,
                                chat_messages_per_day: plan.chat_messages_per_day,
                                is_active: plan.is_active,
                              });
                            }}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            Editar Plano
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              {editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editedUserData.name || ''}
                  onChange={(e) => setEditedUserData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do usuário"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Conta</Label>
                <Select 
                  value={editedUserData.account_type || 'plano_pessoal'} 
                  onValueChange={(val: 'aluno' | 'plano_pessoal' | 'premium' | 'profissional') => 
                    setEditedUserData(prev => ({ ...prev, account_type: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aluno">Aluno</SelectItem>
                    <SelectItem value="plano_pessoal">Plano Pessoal</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <Select 
                  value={editedUserData.user_type || 'usuario'} 
                  onValueChange={(val: 'aluno' | 'usuario' | 'profissional') => 
                    setEditedUserData(prev => ({ ...prev, user_type: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usuario">Usuário</SelectItem>
                    <SelectItem value="aluno">Aluno</SelectItem>
                    <SelectItem value="profissional">Profissional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={!!editedUserData.is_test}
                  onCheckedChange={(checked) => setEditedUserData(prev => ({ ...prev, is_test: checked }))}
                />
                <Label>Conta de teste</Label>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {(['admin', 'professional', 'student'] as const).map((role) => {
                    const hasRole = editingUser.roles.includes(role);
                    const isSaving = savingKeys.has(`role_${editingUser.user_id}_${role}`);
                    return (
                      <Button
                        key={role}
                        variant={hasRole ? 'default' : 'outline'}
                        size="sm"
                        disabled={isSaving}
                        onClick={() => toggleUserRole(editingUser.user_id, role, !hasRole)}
                        className="gap-1"
                      >
                        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {role}
                        {hasRole && <X className="h-3 w-3 ml-1" />}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique para adicionar/remover roles
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingUser) return;
                    try {
                      await updateUser(editingUser.user_id, {
                        name: editedUserData.name,
                        account_type: editedUserData.account_type as 'aluno' | 'plano_pessoal' | 'premium' | 'profissional',
                        user_type: editedUserData.user_type as 'aluno' | 'usuario' | 'profissional' | null,
                        is_test: editedUserData.is_test,
                      });
                      toast({ title: 'Usuário atualizado', description: 'As alterações foram salvas.' });
                      setEditingUser(null);
                    } catch {
                      // Error handled in hook
                    }
                  }}
                  disabled={savingKeys.has(`user_${editingUser.user_id}`)}
                >
                  {savingKeys.has(`user_${editingUser.user_id}`) ? (
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

      {/* Change Password Dialog */}
      <Dialog open={!!showPasswordDialog} onOpenChange={(open) => !open && setShowPasswordDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Alterar Senha
            </DialogTitle>
            <DialogDescription>
              {showPasswordDialog?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A nova senha deve ter pelo menos 8 caracteres. O usuário será deslogado de todas as sessões.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!showPasswordDialog || newPassword !== confirmPassword || newPassword.length < 8) return;
                try {
                  await changeUserPassword(showPasswordDialog.user_id, newPassword);
                  setShowPasswordDialog(null);
                } catch {
                  // Error handled in hook
                }
              }}
              disabled={
                !newPassword || 
                newPassword !== confirmPassword || 
                newPassword.length < 8 || 
                savingKeys.has(`password_${showPasswordDialog?.user_id}`)
              }
            >
              {savingKeys.has(`password_${showPasswordDialog?.user_id}`) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-1" />
              )}
              Alterar Senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => !open && setDeleteConfirmUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o usuário <strong>{deleteConfirmUser?.name || deleteConfirmUser?.email}</strong>?
              <br /><br />
              Esta ação é <strong>irreversível</strong> e irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remover a conta de autenticação</li>
                <li>Deletar todos os dados do perfil</li>
                <li>Remover planos dietéticos e logs</li>
                <li>Cancelar assinaturas ativas</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteConfirmUser) return;
                try {
                  await deleteUser(deleteConfirmUser.user_id);
                  setDeleteConfirmUser(null);
                } catch {
                  // Error handled in hook
                }
              }}
              disabled={savingKeys.has(`delete_${deleteConfirmUser?.user_id}`)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {savingKeys.has(`delete_${deleteConfirmUser?.user_id}`) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Plan Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Editar Plano: {editingPlan?.name}
            </DialogTitle>
            <DialogDescription>
              Ajuste os valores e limites do plano. Os valores são em centavos (ex: R$ 29,90 = 2990).
            </DialogDescription>
          </DialogHeader>

          {editingPlan && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!editedPlanData.is_active}
                  onCheckedChange={(checked) => setEditedPlanData(prev => ({ ...prev, is_active: checked }))}
                />
                <Label>Plano ativo</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Mensal (centavos)</Label>
                  <Input
                    type="number"
                    value={editedPlanData.price_monthly || ''}
                    onChange={(e) => setEditedPlanData(prev => ({ ...prev, price_monthly: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="2990"
                  />
                  {editedPlanData.price_monthly && (
                    <p className="text-xs text-muted-foreground">
                      = R$ {(editedPlanData.price_monthly / 100).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Preço Trimestral (centavos)</Label>
                  <Input
                    type="number"
                    value={editedPlanData.price_quarterly || ''}
                    onChange={(e) => setEditedPlanData(prev => ({ ...prev, price_quarterly: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="7990"
                  />
                  {editedPlanData.price_quarterly && (
                    <p className="text-xs text-muted-foreground">
                      = R$ {(editedPlanData.price_quarterly / 100).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Preço Semestral (centavos)</Label>
                  <Input
                    type="number"
                    value={editedPlanData.price_semiannual || ''}
                    onChange={(e) => setEditedPlanData(prev => ({ ...prev, price_semiannual: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="14990"
                  />
                  {editedPlanData.price_semiannual && (
                    <p className="text-xs text-muted-foreground">
                      = R$ {(editedPlanData.price_semiannual / 100).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Preço Anual (centavos)</Label>
                  <Input
                    type="number"
                    value={editedPlanData.price_annual || ''}
                    onChange={(e) => setEditedPlanData(prev => ({ ...prev, price_annual: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="24990"
                  />
                  {editedPlanData.price_annual && (
                    <p className="text-xs text-muted-foreground">
                      = R$ {(editedPlanData.price_annual / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium text-sm">Limites do Plano</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Limite de Dietas</Label>
                    <Input
                      type="number"
                      value={editedPlanData.diet_limit || ''}
                      onChange={(e) => setEditedPlanData(prev => ({ ...prev, diet_limit: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Substituições</Label>
                    <Input
                      type="number"
                      value={editedPlanData.substitution_limit || ''}
                      onChange={(e) => setEditedPlanData(prev => ({ ...prev, substitution_limit: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Limite de Ajustes</Label>
                    <Input
                      type="number"
                      value={editedPlanData.adjustment_limit || ''}
                      onChange={(e) => setEditedPlanData(prev => ({ ...prev, adjustment_limit: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias de Histórico</Label>
                    <Input
                      type="number"
                      value={editedPlanData.history_days || ''}
                      onChange={(e) => setEditedPlanData(prev => ({ ...prev, history_days: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  {editingPlan.type === 'professional' && (
                    <div className="space-y-2">
                      <Label>Limite de Pacientes</Label>
                      <Input
                        type="number"
                        value={editedPlanData.patients_limit || ''}
                        onChange={(e) => setEditedPlanData(prev => ({ ...prev, patients_limit: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!editedPlanData.has_chat}
                    onCheckedChange={(checked) => setEditedPlanData(prev => ({ ...prev, has_chat: checked }))}
                  />
                  <Label>Chat habilitado</Label>
                </div>

                {editedPlanData.has_chat && (
                  <div className="space-y-2">
                    <Label>Mensagens de Chat por Dia</Label>
                    <Input
                      type="number"
                      value={editedPlanData.chat_messages_per_day || ''}
                      onChange={(e) => setEditedPlanData(prev => ({ ...prev, chat_messages_per_day: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlan(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!editingPlan) return;
                try {
                  await updatePlan(editingPlan.id, editedPlanData);
                  setEditingPlan(null);
                } catch {
                  // Error handled in hook
                }
              }}
              disabled={savingKeys.has(`plan_${editingPlan?.id}`)}
            >
              {savingKeys.has(`plan_${editingPlan?.id}`) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar Plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
