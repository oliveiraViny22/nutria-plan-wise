import { useState, useEffect, useCallback, useRef } from 'react';
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
  Trash2,
  BarChart3,
  TrendingUp,
  Activity,
  RefreshCw,
  BookOpen,
  Briefcase,
  CreditCard,
  Sparkles,
  Bot,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminOperations, UserProfile, DeleteUserPreview, Plan, UserUsage } from '@/hooks/useAdminOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FoodImportValidator, ValidationResult as FoodValidationResult, FoodRow } from '@/components/FoodImportValidator';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 71%, 45%)',
  'hsl(262, 83%, 58%)',
  'hsl(24, 95%, 53%)',
];

interface TimeSeriesDataPoint {
  date: string;
  users: number;
  subscriptions: number;
}

interface PlanDistributionData {
  name: string;
  value: number;
  percentage: number;
}

interface DashboardMetrics {
  totalUsers: number;
  totalSubscriptions: number;
  subscriptionsByStatus: Record<string, number>;
  totalDietPlans: number;
  activeDietPlans: number;
  dailyLogsLast7Days: number;
  planDistribution: PlanDistributionData[];
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
    importFoods,
    fetchAuditLogs,
    downloadTemplate,
    seedTestData,
    fetchUsers,
    updateUser,
    toggleUserRole,
    previewDeleteUser,
    deleteUser,
    fetchPlans,
    updatePlan,
    getUserUsage,
    updateUserUsage,
  } = useAdminOperations();

  const [activeTab, setActiveTab] = useState('metrics');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ rows: Record<string, unknown>[]; validation: FoodValidationResult | null }>({ rows: [], validation: null });
  const [showPreview, setShowPreview] = useState(false);
  const [showValidating, setShowValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [auditPage, setAuditPage] = useState(0);
  const [seedingData, setSeedingData] = useState(false);
  const [seedResults, setSeedResults] = useState<Record<string, unknown> | null>(null);
  
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editedUserData, setEditedUserData] = useState<Partial<UserProfile>>({});
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeleteUserPreview | null>(null);
  const [loadingDeletePreview, setLoadingDeletePreview] = useState(false);
  const [editingQuotaUser, setEditingQuotaUser] = useState<UserProfile | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [editedQuotas, setEditedQuotas] = useState<Partial<UserUsage>>({});
  const [loadingUserUsage, setLoadingUserUsage] = useState(false);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);
  const [downloadingFoods, setDownloadingFoods] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

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

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
      fetchFoodImports();
      fetchAuditLogs();
      fetchMetrics();
      fetchTimeSeriesData();
      fetchPlans();
    }
  }, [isAdmin, fetchSettings, fetchFoodImports, fetchAuditLogs, fetchPlans]);

  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      const [
        { count: usersCount },
        { count: subsCount },
        { data: subsByStatus },
        { count: dietPlansCount },
        { data: activePlans },
        { count: logsCount },
        { data: activeSubsForDistribution },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('status'),
        supabase.from('diet_plans').select('*', { count: 'exact', head: true }),
        supabase.from('diet_plans').select('id').eq('status', 'active'),
        supabase.from('daily_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('subscriptions').select('plan_id, plans(name)').eq('status', 'active'),
      ]);

      const subsByStatusMap: Record<string, number> = {};
      subsByStatus?.forEach((s) => {
        subsByStatusMap[s.status] = (subsByStatusMap[s.status] || 0) + 1;
      });

      const planCounts: Record<string, number> = {};
      activeSubsForDistribution?.forEach((sub) => {
        const plan = sub.plans as { name: string } | null;
        const planName = plan?.name || 'Desconhecido';
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      });

      const totalActiveSubs = activeSubsForDistribution?.length || 0;
      const planDistribution: PlanDistributionData[] = Object.entries(planCounts).map(([name, value]) => ({
        name,
        value,
        percentage: totalActiveSubs > 0 ? Math.round((value / totalActiveSubs) * 100) : 0,
      }));

      setMetrics({
        totalUsers: usersCount || 0,
        totalSubscriptions: subsCount || 0,
        subscriptionsByStatus: subsByStatusMap,
        totalDietPlans: dietPlansCount || 0,
        activeDietPlans: activePlans?.length || 0,
        dailyLogsLast7Days: logsCount || 0,
        planDistribution,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast({
        title: 'Erro ao carregar métricas',
        description: 'Não foi possível obter os dados do dashboard.',
        variant: 'destructive',
      });
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchTimeSeriesData = async () => {
    setTimeSeriesLoading(true);
    try {
      const last30Days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last30Days.push(date.toISOString().split('T')[0]);
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });

      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('created_at')
        .order('created_at', { ascending: true });

      const chartData: TimeSeriesDataPoint[] = last30Days.map((dateStr) => {
        const dateEnd = new Date(dateStr);
        dateEnd.setHours(23, 59, 59, 999);

        const usersCount = profilesData?.filter(p => 
          new Date(p.created_at || '') <= dateEnd
        ).length || 0;

        const subsCount = subsData?.filter(s => 
          new Date(s.created_at || '') <= dateEnd
        ).length || 0;

        return {
          date: new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          users: usersCount,
          subscriptions: subsCount,
        };
      });

      setTimeSeriesData(chartData);
    } catch (error) {
      console.error('Error fetching time series data:', error);
    } finally {
      setTimeSeriesLoading(false);
    }
  };

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
      // Erro tratado no hook
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

  const handleDownloadFoods = async () => {
    setDownloadingFoods(true);
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('name, calories, protein, carbs, fat, category, processing_level, serving_size')
        .order('name');

      if (error) throw error;

      // Convert to CSV
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

  const handleDownloadDocumentation = async (docType: 'technical' | 'commercial') => {
    setDownloadingDoc(docType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const response = await supabase.functions.invoke('generate-documentation-pdf', {
        body: { docType }
      });

      if (response.error) throw response.error;

      const content = response.data;
      const filename = docType === 'technical' 
        ? 'DOCUMENTACAO_TECNICA_NUTRIAPLAN.txt' 
        : 'DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.txt';

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Download concluído', description: `Documentação ${docType === 'technical' ? 'técnica' : 'comercial'} baixada.` });
    } catch (error) {
      console.error('Error downloading documentation:', error);
      toast({
        title: 'Erro ao baixar documentação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setDownloadingDoc(null);
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Painel Administrativo
              </h1>
              <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => fetchMetrics()} disabled={metricsLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="metrics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Métricas
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="foods" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Alimentos
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Planos & IA
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Documentação
            </TabsTrigger>
          </TabsList>

          {/* Metrics Tab */}
          <TabsContent value="metrics">
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Assinaturas</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.totalSubscriptions || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {metrics?.subscriptionsByStatus?.active || 0} ativas
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Planos Alimentares</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.totalDietPlans || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {metrics?.activeDietPlans || 0} ativos
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Logs (7 dias)</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics?.dailyLogsLast7Days || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Crescimento (30 dias)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {timeSeriesLoading ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timeSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Line type="monotone" dataKey="users" stroke={CHART_COLORS[0]} name="Usuários" />
                          <Line type="monotone" dataKey="subscriptions" stroke={CHART_COLORS[1]} name="Assinaturas" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Distribuição por Plano</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metricsLoading ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin" />
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={metrics?.planDistribution || []}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ name, percentage }) => `${name} (${percentage}%)`}
                          >
                            {metrics?.planDistribution?.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Gestão de Usuários
                </CardTitle>
                <CardDescription>
                  Visualize e edite as contas de usuários ({usersTotal} total).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setUserPage(0);
                          fetchUsers(50, 0, userSearch);
                        }
                      }}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => {
                    setUserPage(0);
                    fetchUsers(50, 0, userSearch);
                  }}>
                    <Search className="h-4 w-4 mr-1" />
                    Buscar
                  </Button>
                </div>

                <ScrollArea className="h-[500px] border rounded-lg">
                  {usersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Clique em "Buscar" para carregar os usuários</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Roles</TableHead>
                          <TableHead>Plano</TableHead>
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
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={async () => {
                                    setEditingQuotaUser(user);
                                    setUserUsage(null);
                                    setEditedQuotas({});
                                    setLoadingUserUsage(true);
                                    try {
                                      const usage = await getUserUsage(user.user_id);
                                      setUserUsage(usage);
                                      if (usage) {
                                        setEditedQuotas({
                                          diets_used: usage.diets_used,
                                          substitutions_used: usage.substitutions_used,
                                          adjustments_used: usage.adjustments_used,
                                          chat_messages_today: usage.chat_messages_today,
                                        });
                                      }
                                    } finally {
                                      setLoadingUserUsage(false);
                                    }
                                  }}
                                  title="Editar cotas"
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingUser(user);
                                    setEditedUserData({ name: user.name });
                                  }}
                                  title="Editar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={async () => {
                                    setDeleteConfirmUser(user);
                                    setDeletePreview(null);
                                    setLoadingDeletePreview(true);
                                    try {
                                      const preview = await previewDeleteUser(user.user_id);
                                      setDeletePreview(preview);
                                    } finally {
                                      setLoadingDeletePreview(false);
                                    }
                                  }}
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
                          fetchUsers(50, newPage * 50, userSearch);
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
                          fetchUsers(50, newPage * 50, userSearch);
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

          {/* Aba Configurações */}
          <TabsContent value="settings">
            {settingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : Object.keys(groupedSettings).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma configuração encontrada.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {Object.entries(groupedSettings).map(([category, categorySettings]) => {
                  const categoryLabels: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
                    'general': { 
                      label: 'Geral', 
                      icon: <Settings className="h-5 w-5" />,
                      description: 'Configurações gerais do sistema'
                    },
                    'ai': { 
                      label: 'Inteligência Artificial', 
                      icon: <Bot className="h-5 w-5" />,
                      description: 'Configurações de modelos e recursos de IA'
                    },
                    'limits': { 
                      label: 'Limites', 
                      icon: <Activity className="h-5 w-5" />,
                      description: 'Limites de uso do sistema'
                    },
                    'features': { 
                      label: 'Recursos', 
                      icon: <Sparkles className="h-5 w-5" />,
                      description: 'Ativar ou desativar funcionalidades'
                    },
                  };
                  
                  const categoryInfo = categoryLabels[category.toLowerCase()] || { 
                    label: category.charAt(0).toUpperCase() + category.slice(1), 
                    icon: <Settings className="h-5 w-5" />,
                    description: `Configurações de ${category}`
                  };

                  return (
                    <Card key={category} className="flex flex-col">
                      <CardHeader className="pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="text-primary">{categoryInfo.icon}</span>
                          {categoryInfo.label}
                        </CardTitle>
                        <CardDescription>{categoryInfo.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-4">
                        {categorySettings.map((setting) => {
                          const settingLabels: Record<string, string> = {
                            'enable_chat_feature': 'Chat com IA',
                            'ai_model_default': 'Modelo de IA Padrão',
                            'max_diet_plans_per_user': 'Máx. Planos por Usuário',
                            'enable_meal_substitution': 'Substituição de Refeições',
                            'enable_macro_adjustment': 'Ajuste de Macros',
                          };
                          
                          return (
                            <div 
                              key={setting.key} 
                              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="space-y-1 flex-1 mr-4">
                                <Label className="font-medium text-sm">
                                  {settingLabels[setting.key] || setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Label>
                                {setting.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">{setting.description}</p>
                                )}
                              </div>
                              <div className="shrink-0">
                                {renderSettingEditor(setting)}
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Aba Alimentos */}
          <TabsContent value="foods">
            <div className="space-y-6">
              <Card>
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
                  <div className="flex flex-wrap items-center gap-4">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".xls,.xlsx,.csv,.txt"
                      onChange={handleFileUpload}
                      className="max-w-md"
                    />
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo
                    </Button>
                    <Button variant="outline" onClick={handleDownloadFoods} disabled={downloadingFoods}>
                      {downloadingFoods ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Exportar Banco de Alimentos
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Dados de Teste
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="outline" 
                    onClick={handleSeedTestData}
                    disabled={seedingData}
                  >
                    {seedingData ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Database className="h-4 w-4 mr-2" />
                    )}
                    Criar Dados de Teste
                  </Button>
                  {seedResults && (
                    <Alert className="mt-4">
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Dados criados com sucesso!
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {/* Food Imports History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Histórico de Importações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {foodImports.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma importação registrada.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Importados</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {foodImports.map((imp) => (
                          <TableRow key={imp.id}>
                            <TableCell>{imp.filename}</TableCell>
                            <TableCell>
                              <Badge variant={imp.status === 'completed' ? 'default' : 'secondary'}>
                                {imp.status}
                              </Badge>
                            </TableCell>
                            <TableCell>{imp.imported_rows}/{imp.total_rows}</TableCell>
                            <TableCell>{new Date(imp.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Logs de Auditoria
                </CardTitle>
                <CardDescription>
                  Histórico de ações administrativas ({auditTotal} total).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : auditLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhum log de auditoria encontrado.
                  </p>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ação</TableHead>
                          <TableHead>Entidade</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.action}</TableCell>
                            <TableCell>{log.entity_type}</TableCell>
                            <TableCell>{new Date(log.created_at).toLocaleString('pt-BR')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans & AI Tab */}
          <TabsContent value="plans">
            <div className="space-y-6">
              {/* AI Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Configurações de IA
                  </CardTitle>
                  <CardDescription>
                    Habilite ou desabilite recursos de inteligência artificial do sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* AI Chat Enable/Disable */}
                    {settings.filter(s => s.key === 'enable_chat_feature').map(setting => (
                      <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label className="font-medium">Chat com IA</Label>
                          <p className="text-sm text-muted-foreground">
                            {setting.description || 'Habilitar funcionalidade de chat com IA para usuários'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={setting.value as boolean}
                            onCheckedChange={(checked) => updateSetting(setting.key, checked)}
                            disabled={savingKeys.has(setting.key)}
                          />
                          {savingKeys.has(setting.key) && <Loader2 className="h-4 w-4 animate-spin" />}
                          {savedKeys.has(setting.key) && <CheckCircle className="h-4 w-4 text-green-600" />}
                        </div>
                      </div>
                    ))}

                    {/* AI Model Selection */}
                    {settings.filter(s => s.key === 'ai_model_default').map(setting => (
                      <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-1">
                          <Label className="font-medium">Modelo de IA Padrão</Label>
                          <p className="text-sm text-muted-foreground">
                            {setting.description || 'Modelo usado para geração de planos e chat'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {String(setting.value)}
                          </span>
                          {savedKeys.has(setting.key) && <CheckCircle className="h-4 w-4 text-green-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Plans Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Limites por Plano
                  </CardTitle>
                  <CardDescription>
                    Configure os limites de dietas, substituições e ajustes para cada tipo de plano.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {plansLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum plano encontrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {plans.map((plan) => (
                        <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="border rounded-lg p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-lg">{plan.name}</span>
                                <span className="text-sm text-muted-foreground capitalize">{plan.type}</span>
                              </div>
                              <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                                {plan.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={plan.is_active}
                                onCheckedChange={(checked) => updatePlan(plan.id, { is_active: checked })}
                                disabled={savingKeys.has(`plan_${plan.id}`)}
                              />
                              {savingKeys.has(`plan_${plan.id}`) && <Loader2 className="h-4 w-4 animate-spin" />}
                              {savedKeys.has(`plan_${plan.id}`) && <CheckCircle className="h-4 w-4 text-green-600" />}
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="space-y-2">
                              <Label className="text-sm">Limite de Dietas</Label>
                              <Input
                                type="number"
                                min={0}
                                value={plan.diet_limit}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  updatePlan(plan.id, { diet_limit: value });
                                }}
                                disabled={savingKeys.has(`plan_${plan.id}`)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Limite de Substituições</Label>
                              <Input
                                type="number"
                                min={0}
                                value={plan.substitution_limit}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  updatePlan(plan.id, { substitution_limit: value });
                                }}
                                disabled={savingKeys.has(`plan_${plan.id}`)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Limite de Ajustes</Label>
                              <Input
                                type="number"
                                min={0}
                                value={plan.adjustment_limit}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  updatePlan(plan.id, { adjustment_limit: value });
                                }}
                                disabled={savingKeys.has(`plan_${plan.id}`)}
                                className="w-full"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Mensagens Chat/Dia</Label>
                              <Input
                                type="number"
                                min={0}
                                value={plan.chat_messages_per_day}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 0;
                                  updatePlan(plan.id, { chat_messages_per_day: value });
                                }}
                                disabled={savingKeys.has(`plan_${plan.id}`) || !plan.has_chat}
                                className="w-full"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 pt-2 border-t">
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`chat-${plan.id}`}
                                checked={plan.has_chat}
                                onCheckedChange={(checked) => updatePlan(plan.id, { has_chat: checked })}
                                disabled={savingKeys.has(`plan_${plan.id}`)}
                              />
                              <Label htmlFor={`chat-${plan.id}`} className="text-sm cursor-pointer">
                                Chat com IA habilitado
                              </Label>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Max Diets Per User Setting */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Limites Globais
                  </CardTitle>
                  <CardDescription>
                    Configurações que se aplicam a todos os usuários, independente do plano.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.filter(s => s.key === 'max_diet_plans_per_user').map(setting => (
                    <div key={setting.key} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <Label className="font-medium">Máximo de Planos por Usuário</Label>
                        <p className="text-sm text-muted-foreground">
                          {setting.description || 'Número máximo de planos alimentares que um usuário pode ter simultaneamente'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={editedSettings[setting.key] !== undefined ? Number(editedSettings[setting.key]) : Number(setting.value)}
                          onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value) || 1)}
                          onBlur={() => {
                            if (editedSettings[setting.key] !== undefined) {
                              handleSaveSetting(setting.key);
                            }
                          }}
                          disabled={savingKeys.has(setting.key)}
                          className="w-20"
                        />
                        {savingKeys.has(setting.key) && <Loader2 className="h-4 w-4 animate-spin" />}
                        {savedKeys.has(setting.key) && <CheckCircle className="h-4 w-4 text-green-600" />}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Documentação do Sistema
                  </CardTitle>
                  <CardDescription>
                    Acesse a documentação técnica e comercial do NutriaPlan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card className="border-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-500" />
                          Documentação Técnica
                        </CardTitle>
                        <CardDescription>
                          Arquitetura, banco de dados, edge functions, fluxos técnicos e regras de negócio.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={() => handleDownloadDocumentation('technical')}
                          disabled={downloadingDoc === 'technical'}
                          className="w-full"
                        >
                          {downloadingDoc === 'technical' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Baixar Documentação Técnica
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Briefcase className="h-5 w-5 text-green-500" />
                          Documentação Comercial
                        </CardTitle>
                        <CardDescription>
                          Proposta de valor, públicos-alvo, planos, funcionalidades e modelo de negócio.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={() => handleDownloadDocumentation('commercial')}
                          disabled={downloadingDoc === 'commercial'}
                          variant="secondary"
                          className="w-full"
                        >
                          {downloadingDoc === 'commercial' ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Baixar Documentação Comercial
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Outras Documentações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>
                      A documentação técnica e comercial consolidada (v2.0) contém todas as informações necessárias para:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Entender a arquitetura do sistema</li>
                      <li>Consultar regras de negócio e fluxos</li>
                      <li>Verificar estrutura do banco de dados</li>
                      <li>Conhecer integrações (Stripe, IA)</li>
                      <li>Apresentar a plataforma para investidores e parceiros</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Diálogo de Validação */}
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

      {/* Diálogo de Prévia */}
      <Dialog open={showPreview} onOpenChange={(open) => !open && setShowPreview(false)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Prévia da Importação
            </DialogTitle>
            <DialogDescription>
              {importPreview.validation?.validRows.length || 0} alimentos válidos encontrados
            </DialogDescription>
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

              <div className="space-y-2 pt-4 border-t">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {(['admin', 'professional', 'user'] as const).map((role) => {
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
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingUser) return;
                    try {
                      await updateUser(editingUser.user_id, { name: editedUserData.name });
                      toast({ title: 'Usuário atualizado' });
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

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmUser(null);
          setDeletePreview(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o usuário {deleteConfirmUser?.name || deleteConfirmUser?.email}?
              
              {loadingDeletePreview && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              
              {deletePreview && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="font-medium text-destructive">
                    {deletePreview.totalRecords} registros serão excluídos
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteConfirmUser) return;
                await deleteUser(deleteConfirmUser.user_id);
                setDeleteConfirmUser(null);
                fetchUsers(50, userPage * 50, userSearch);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Quotas Dialog */}
      <Dialog open={!!editingQuotaUser} onOpenChange={(open) => {
        if (!open) {
          setEditingQuotaUser(null);
          setUserUsage(null);
          setEditedQuotas({});
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Editar Cotas de Uso
            </DialogTitle>
            <DialogDescription>
              {editingQuotaUser?.name || editingQuotaUser?.email}
            </DialogDescription>
          </DialogHeader>

          {loadingUserUsage ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dietas usadas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.diets_used ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, diets_used: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Substituições usadas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.substitutions_used ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, substitutions_used: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ajustes usados</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.adjustments_used ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, adjustments_used: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagens hoje</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.chat_messages_today ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, chat_messages_today: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {userUsage && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p>Período: {new Date(userUsage.period_start).toLocaleDateString('pt-BR')} - {new Date(userUsage.period_end).toLocaleDateString('pt-BR')}</p>
                  <p>Último reset de chat: {new Date(userUsage.last_chat_reset).toLocaleDateString('pt-BR')}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingQuotaUser(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingQuotaUser) return;
                    const success = await updateUserUsage(editingQuotaUser.user_id, editedQuotas);
                    if (success) {
                      setEditingQuotaUser(null);
                    }
                  }}
                  disabled={savingKeys.has(`usage_${editingQuotaUser?.user_id}`)}
                >
                  {savingKeys.has(`usage_${editingQuotaUser?.user_id}`) ? (
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
    </div>
  );
}
