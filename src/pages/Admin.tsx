/**
 * Admin Page - Refactored
 * 
 * Main admin panel that uses separate tab components for better maintainability
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Shield, 
  ArrowLeft,
  AlertCircle,
  Database,
  Users,
  BarChart3,
  TrendingUp,
  RefreshCw,
  BookOpen,
  CreditCard,
  Sparkles,
  History,
  Target,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminOperations } from '@/hooks/useAdminOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SystemAudit from '@/components/SystemAudit';
import { useRealtimeSettings } from '@/hooks/useRealtimeSettings';
import { ThemeToggle } from '@/components/ThemeToggle';
import { FoodBlockRulesManager } from '@/components/admin/FoodBlockRulesManager';
import { FeatureFlagsManager } from '@/components/admin/FeatureFlagsManager';
import { RateLimitsManager } from '@/components/admin/RateLimitsManager';

// Refactored tab components
import { AdminMetricsTab, DashboardMetrics, TimeSeriesDataPoint } from '@/components/admin/AdminMetricsTab';
import { AdminUsersTab } from '@/components/admin/AdminUsersTab';
import { AdminFoodsTab } from '@/components/admin/AdminFoodsTab';
import { AdminSettingsTab, SystemSetting } from '@/components/admin/AdminSettingsTab';
import { AdminPlansTab } from '@/components/admin/AdminPlansTab';
import { AdminDocsTab } from '@/components/admin/AdminDocsTab';
import { AdminPoliciesTab } from '@/components/admin/AdminPoliciesTab';
import { AdminConversionTab } from '@/components/admin/AdminConversionTab';

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
    foods,
    foodsLoading,
    foodsTotal,
    fetchSettings, 
    updateSetting,
    updateSettingInState,
    removeSettingFromState,
    fetchFoodImports,
    importFoods,
    fetchAuditLogs,
    downloadTemplate,
    fetchUsers,
    updateUser,
    toggleUserRole,
    previewDeleteUser,
    deleteUser,
    fetchPlans,
    updatePlan,
    getUserUsage,
    updateUserUsage,
    fetchFoods,
    updateFood,
    deleteFood,
    normalizeFoodNames,
  } = useAdminOperations();
  
  // Real-time settings updates
  useRealtimeSettings({
    onSettingChange: updateSettingInState,
    onSettingInsert: updateSettingInState,
    onSettingDelete: removeSettingFromState,
    showNotifications: true,
  });

  const [activeTab, setActiveTab] = useState('metrics');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});

  // Metrics state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);
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
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        { count: usersCount },
        { count: subsCount },
        { data: subsByStatus },
        { data: activeSubsForDistribution },
        { count: linkedStudentsCount },
        { data: aiUsageLogs },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('status, plan_id, plans(name, type, price_monthly)').eq('status', 'active'),
        supabase.from('subscriptions').select('plan_id, plans(name, type, price_monthly)').eq('status', 'active'),
        supabase.from('professional_students').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('ai_usage_logs').select('estimated_cost_usd').gte('created_at', startOfMonth.toISOString()),
      ]);

      const subsByStatusMap: Record<string, number> = {};
      let freeUsers = 0;
      let paidPersonal = 0;
      let professionals = 0;
      let mrr = 0;

      subsByStatus?.forEach((s) => {
        const status = s.status as string;
        subsByStatusMap[status] = (subsByStatusMap[status] || 0) + 1;
        
        const plan = s.plans as { name: string; type: string; price_monthly: number | null } | null;
        if (plan) {
          if (plan.type === 'gratuito') {
            freeUsers++;
          } else if (plan.type === 'plano_pessoal_pago') {
            paidPersonal++;
            mrr += plan.price_monthly || 0;
          } else if (plan.type === 'profissional') {
            professionals++;
            mrr += plan.price_monthly || 0;
          }
        }
      });

      const planCounts: Record<string, number> = {};
      activeSubsForDistribution?.forEach((sub) => {
        const plan = sub.plans as { name: string } | null;
        const planName = plan?.name || 'Desconhecido';
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      });

      const totalActiveSubs = activeSubsForDistribution?.length || 0;
      const planDistribution = Object.entries(planCounts).map(([name, value]) => ({
        name,
        value,
        percentage: totalActiveSubs > 0 ? Math.round((value / totalActiveSubs) * 100) : 0,
      }));

      const aiCostThisMonth = aiUsageLogs?.reduce((sum, log) => sum + (Number(log.estimated_cost_usd) || 0), 0) || 0;
      const aiCallsThisMonth = aiUsageLogs?.length || 0;

      setMetrics({
        totalUsers: usersCount || 0,
        totalSubscriptions: subsCount || 0,
        subscriptionsByStatus: subsByStatusMap,
        planDistribution,
        userTypes: { freeUsers, paidPersonal, professionals, linkedStudents: linkedStudentsCount || 0 },
        financial: { mrr, totalRevenue: mrr, aiCostThisMonth, aiCallsThisMonth },
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

  const handleDownloadDocumentation = async (type: 'technical' | 'commercial') => {
    setDownloadingDoc(type);
    try {
      const { data, error } = await supabase.functions.invoke('generate-documentation-pdf', {
        body: { type }
      });

      if (error) throw error;

      const base64Data = data.pdf;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nutriaplan_${type}_documentation.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Download concluído', description: `Documentação ${type === 'technical' ? 'técnica' : 'comercial'} baixada.` });
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

  const handleDownloadCode = async () => {
    setDownloadingDoc('code');
    try {
      const { data, error } = await supabase.functions.invoke('generate-code-export');

      if (error) throw error;

      const blob = new Blob([data.content], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nutriaplan_code_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Download concluído', description: 'Código fonte exportado.' });
    } catch (error) {
      console.error('Error downloading code:', error);
      toast({
        title: 'Erro ao exportar código',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Convert settings to expected format
  const formattedSettings: SystemSetting[] = settings.map(s => ({
    id: s.id,
    key: s.key,
    value: s.value,
    description: s.description,
    category: s.category,
    is_sensitive: s.is_sensitive,
  }));

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
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => fetchMetrics()} disabled={metricsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${metricsLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
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
            <TabsTrigger value="foods" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Alimentos
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="plans" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Auditoria
            </TabsTrigger>
            <TabsTrigger value="docs" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Documentação
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Políticas
            </TabsTrigger>
            <TabsTrigger value="blocks" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Bloqueios
            </TabsTrigger>
            <TabsTrigger value="flags" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Feature Flags
            </TabsTrigger>
            <TabsTrigger value="conversion" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversão
            </TabsTrigger>
          </TabsList>

          {/* Metrics Tab */}
          <TabsContent value="metrics">
            <AdminMetricsTab
              metrics={metrics}
              metricsLoading={metricsLoading}
              timeSeriesData={timeSeriesData}
              timeSeriesLoading={timeSeriesLoading}
            />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <AdminUsersTab
              users={users}
              usersLoading={usersLoading}
              usersTotal={usersTotal}
              savingKeys={savingKeys}
              fetchUsers={fetchUsers}
              updateUser={updateUser}
              toggleUserRole={toggleUserRole}
              previewDeleteUser={previewDeleteUser}
              deleteUser={deleteUser}
              getUserUsage={getUserUsage}
              updateUserUsage={updateUserUsage}
            />
          </TabsContent>

          {/* Foods Tab */}
          <TabsContent value="foods">
            <AdminFoodsTab
              foods={foods}
              foodsLoading={foodsLoading}
              foodsTotal={foodsTotal}
              foodImports={foodImports}
              loading={loading}
              savingKeys={savingKeys}
              fetchFoods={fetchFoods}
              updateFood={updateFood}
              deleteFood={deleteFood}
              normalizeFoodNames={normalizeFoodNames}
              downloadTemplate={downloadTemplate}
              importFoods={importFoods}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <AdminSettingsTab
              settings={formattedSettings}
              settingsLoading={settingsLoading}
              savingKeys={savingKeys}
              savedKeys={savedKeys}
              errorKeys={errorKeys}
              editedSettings={editedSettings}
              onSettingChange={handleSettingChange}
              onSaveSetting={handleSaveSetting}
            />
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans">
            <AdminPlansTab
              plans={plans}
              plansLoading={plansLoading}
              savingKeys={savingKeys}
              savedKeys={savedKeys}
              updatePlan={updatePlan}
            />
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit">
            <SystemAudit
              auditLogs={auditLogs}
              auditTotal={auditTotal}
              loading={loading}
              fetchAuditLogs={fetchAuditLogs}
            />
          </TabsContent>

          {/* Docs Tab */}
          <TabsContent value="docs">
            <AdminDocsTab
              downloadingDoc={downloadingDoc}
              onDownloadDocumentation={handleDownloadDocumentation}
              onDownloadCode={handleDownloadCode}
            />
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies">
            <AdminPoliciesTab />
          </TabsContent>

          {/* Blocks Tab */}
          <TabsContent value="blocks">
            <FoodBlockRulesManager />
          </TabsContent>

          {/* Feature Flags Tab */}
          <TabsContent value="flags">
            <div className="space-y-6">
              <FeatureFlagsManager />
              <RateLimitsManager />
            </div>
          </TabsContent>

          {/* Conversion Tab */}
          <TabsContent value="conversion">
            <AdminConversionTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
