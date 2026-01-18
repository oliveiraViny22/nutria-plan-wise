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
  UserCog,
  Trash2,
  Key,
  CreditCard,
  DollarSign,
  AlertTriangle,
  BookOpen,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  RefreshCw,
  Wallet,
  Crown,
  Sparkles,
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
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminOperations, UserProfile, Plan, DeleteUserPreview } from '@/hooks/useAdminOperations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FoodImportValidator, ValidationResult as FoodValidationResult, FoodRow } from '@/components/FoodImportValidator';
import { AIFoodValidation } from '@/components/AIFoodValidation';
import { FoodAudit } from '@/components/FoodAudit';
// Chart colors
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 71%, 45%)', // green
  'hsl(262, 83%, 58%)', // purple
  'hsl(24, 95%, 53%)',  // orange
  'hsl(199, 89%, 48%)', // blue
  'hsl(350, 89%, 60%)', // red/pink
];

// Types for metrics and subscriptions
interface TimeSeriesDataPoint {
  date: string;
  users: number;
  subscriptions: number;
}

interface RevenueByPeriodData {
  period: string;
  revenue: number;
  count: number;
}

interface PlanDistributionData {
  name: string;
  value: number;
  percentage: number;
}

// Types for metrics and subscriptions
interface DashboardMetrics {
  totalUsers: number;
  usersByType: Record<string, number>;
  totalSubscriptions: number;
  subscriptionsByStatus: Record<string, number>;
  subscriptionsByBillingCycle: Record<string, number>;
  totalDietPlans: number;
  activeDietPlans: number;
  dailyLogsLast7Days: number;
  mrrEstimate: number;
  planDistribution: PlanDistributionData[];
  revenueByPeriod: RevenueByPeriodData[];
}

interface SubscriptionData {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  provider_subscription_id: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
  plan_name?: string;
}

// Delimited file parsing helper (CSV, TXT, XLS)
function parseDelimited(text: string, delimiter: string): Record<string, unknown>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase());
  const rows: Record<string, unknown>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(delimiter).map(v => v.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }
  
  return rows;
}

// Get delimiter based on file extension
function getDelimiterForFile(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return ',';
  // TXT and XLS use tab delimiter (matching export format)
  return '\t';
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
    previewDeleteUser,
    deleteUser,
    fetchPlans,
    updatePlan,
    searchFoods,
    updateFood,
    deleteFood,
    batchUpdateFoods,
    normalizeFoodNames,
  } = useAdminOperations();

  const [activeTab, setActiveTab] = useState('metrics');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ rows: Record<string, unknown>[]; validation: FoodValidationResult | null }>({ rows: [], validation: null });
  const [showPreview, setShowPreview] = useState(false);
  const [showValidating, setShowValidating] = useState(false);
  const [showAIValidation, setShowAIValidation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [deletePreview, setDeletePreview] = useState<{ records: Record<string, number>; totalRecords: number } | null>(null);
  const [loadingDeletePreview, setLoadingDeletePreview] = useState(false);
  
  // Plans management state
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editedPlanData, setEditedPlanData] = useState<Partial<Plan>>({});
  
  // Documentation state
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  
  // Foods export state
  const [exportingFoods, setExportingFoods] = useState<string | null>(null);

  // Foods management state
  const [foodsSearch, setFoodsSearch] = useState('');
  const [foodsData, setFoodsData] = useState<{ foods: FoodRow[]; total: number }>({ foods: [], total: 0 });
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [foodsPage, setFoodsPage] = useState(0);
  const [editingFood, setEditingFood] = useState<FoodRow & { id: string } | null>(null);
  const [editedFoodData, setEditedFoodData] = useState<Partial<FoodRow>>({});
  const [deletingFoodId, setDeletingFoodId] = useState<string | null>(null);

  // Metrics state
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(false);

  // Subscriptions management state
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [subscriptionsTotal, setSubscriptionsTotal] = useState(0);

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
      fetchMetrics();
      fetchTimeSeriesData();
    }
  }, [isAdmin, fetchSettings, fetchFoodImports, fetchAuditLogs]);

  // Fetch dashboard metrics
  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      // Fetch all counts in parallel
      const [
        { count: usersCount },
        { data: usersByType },
        { count: subsCount },
        { data: subsByStatus },
        { data: subsByBilling },
        { count: dietPlansCount },
        { data: activePlans },
        { count: logsCount },
        { data: activeSubsForMRR },
        { data: plansData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('account_type'),
        supabase.from('subscriptions').select('*', { count: 'exact', head: true }),
        supabase.from('subscriptions').select('status'),
        supabase.from('subscriptions').select('billing_cycle'),
        supabase.from('diet_plans').select('*', { count: 'exact', head: true }),
        supabase.from('diet_plans').select('id').eq('status', 'active'),
        supabase.from('daily_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('subscriptions').select('plan_id, billing_cycle, plans(name, price_monthly, price_quarterly, price_semiannual, price_annual)').eq('status', 'active'),
        supabase.from('plans').select('id, name, price_monthly'),
      ]);

      // Group counts
      const usersByTypeMap: Record<string, number> = {};
      usersByType?.forEach((u) => {
        usersByTypeMap[u.account_type] = (usersByTypeMap[u.account_type] || 0) + 1;
      });

      const subsByStatusMap: Record<string, number> = {};
      subsByStatus?.forEach((s) => {
        subsByStatusMap[s.status] = (subsByStatusMap[s.status] || 0) + 1;
      });

      const subsByBillingMap: Record<string, number> = {};
      subsByBilling?.forEach((s) => {
        if (s.billing_cycle) {
          subsByBillingMap[s.billing_cycle] = (subsByBillingMap[s.billing_cycle] || 0) + 1;
        }
      });

      // Estimate MRR (Monthly Recurring Revenue) and calculate revenue by billing cycle
      let mrrEstimate = 0;
      const revenueByBillingCycle: Record<string, { revenue: number; count: number }> = {
        monthly: { revenue: 0, count: 0 },
        quarterly: { revenue: 0, count: 0 },
        semiannual: { revenue: 0, count: 0 },
        annual: { revenue: 0, count: 0 },
      };

      activeSubsForMRR?.forEach((sub) => {
        const plan = sub.plans as { 
          name: string;
          price_monthly: number | null; 
          price_quarterly: number | null;
          price_semiannual: number | null;
          price_annual: number | null;
        } | null;
        
        if (plan) {
          const cycle = sub.billing_cycle || 'monthly';
          let price = 0;
          
          switch (cycle) {
            case 'annual':
              price = plan.price_annual || 0;
              mrrEstimate += price / 12;
              break;
            case 'semiannual':
              price = plan.price_semiannual || 0;
              mrrEstimate += price / 6;
              break;
            case 'quarterly':
              price = plan.price_quarterly || 0;
              mrrEstimate += price / 3;
              break;
            default:
              price = plan.price_monthly || 0;
              mrrEstimate += price;
          }
          
          if (revenueByBillingCycle[cycle]) {
            revenueByBillingCycle[cycle].revenue += price / 100;
            revenueByBillingCycle[cycle].count += 1;
          }
        }
      });

      // Format revenue by period for chart
      const billingCycleLabels: Record<string, string> = {
        monthly: 'Mensal',
        quarterly: 'Trimestral',
        semiannual: 'Semestral',
        annual: 'Anual',
      };
      
      const revenueByPeriod: RevenueByPeriodData[] = Object.entries(revenueByBillingCycle)
        .filter(([_, data]) => data.count > 0)
        .map(([period, data]) => ({
          period: billingCycleLabels[period] || period,
          revenue: data.revenue,
          count: data.count,
        }));

      // Plan distribution for pie chart
      const planCounts: Record<string, number> = {};
      activeSubsForMRR?.forEach((sub) => {
        const plan = sub.plans as { name: string } | null;
        const planName = plan?.name || 'Desconhecido';
        planCounts[planName] = (planCounts[planName] || 0) + 1;
      });

      const totalActiveSubs = activeSubsForMRR?.length || 0;
      const planDistribution: PlanDistributionData[] = Object.entries(planCounts).map(([name, value]) => ({
        name,
        value,
        percentage: totalActiveSubs > 0 ? Math.round((value / totalActiveSubs) * 100) : 0,
      }));

      setMetrics({
        totalUsers: usersCount || 0,
        usersByType: usersByTypeMap,
        totalSubscriptions: subsCount || 0,
        subscriptionsByStatus: subsByStatusMap,
        subscriptionsByBillingCycle: subsByBillingMap,
        totalDietPlans: dietPlansCount || 0,
        activeDietPlans: activePlans?.length || 0,
        dailyLogsLast7Days: logsCount || 0,
        mrrEstimate: mrrEstimate / 100, // Convert from cents
        planDistribution,
        revenueByPeriod,
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

  // Fetch time series data for the chart
  const fetchTimeSeriesData = async () => {
    setTimeSeriesLoading(true);
    try {
      // Get last 30 days of data
      const last30Days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last30Days.push(date.toISOString().split('T')[0]);
      }

      // Fetch profiles with created_at
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: true });

      // Fetch subscriptions with created_at
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('created_at')
        .order('created_at', { ascending: true });

      // Calculate cumulative counts by date
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

  // Fetch subscriptions
  const fetchSubscriptions = async (statusFilter?: string) => {
    setSubscriptionsLoading(true);
    try {
      // First fetch subscriptions
      let subsQuery = supabase
        .from('subscriptions')
        .select(`
          id,
          user_id,
          plan_id,
          status,
          billing_cycle,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          provider_subscription_id,
          created_at,
          plans(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter && statusFilter !== 'all') {
        subsQuery = subsQuery.eq('status', statusFilter as 'trial' | 'active' | 'past_due' | 'canceled' | 'expired');
      }

      const { data: subsData, error: subsError, count } = await subsQuery;

      if (subsError) throw subsError;

      // Fetch profiles separately for user info
      const userIds = (subsData || []).map(s => s.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

      const mappedData: SubscriptionData[] = (subsData || []).map((sub) => {
        const profile = profilesMap.get(sub.user_id);
        return {
          id: sub.id,
          user_id: sub.user_id,
          plan_id: sub.plan_id,
          status: sub.status,
          billing_cycle: sub.billing_cycle || 'monthly',
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end || false,
          provider_subscription_id: sub.provider_subscription_id,
          created_at: sub.created_at,
          user_name: profile?.name || undefined,
          user_email: profile?.email || undefined,
          plan_name: (sub.plans as { name: string } | null)?.name || undefined,
        };
      });

      setSubscriptions(mappedData);
      setSubscriptionsTotal(count || 0);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      toast({
        title: 'Erro ao carregar assinaturas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubscriptionsLoading(false);
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

    setCsvFile(file);
    setShowValidating(true);
    setShowPreview(false);
    setCsvPreview({ rows: [], validation: null });
  }, []);

  const handleValidationComplete = useCallback((validation: FoodValidationResult, rows: Record<string, unknown>[]) => {
    setCsvPreview({ rows, validation });
    setShowValidating(false);
    setShowPreview(true);
  }, []);

  const handleCancelValidation = useCallback(() => {
    setShowValidating(false);
    setCsvFile(null);
    setCsvPreview({ rows: [], validation: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleImport = async () => {
    if (!csvFile || !csvPreview.validation?.validRows.length) return;

    try {
      await importFoods(csvFile.name, csvPreview.validation.validRows as FoodRow[]);
      setShowPreview(false);
      setCsvFile(null);
      setCsvPreview({ rows: [], validation: null });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  // Foods management handlers
  const handleSearchFoods = useCallback(async (page = 0) => {
    setFoodsLoading(true);
    try {
      const result = await searchFoods(foodsSearch, 20, page * 20);
      setFoodsData(result);
      setFoodsPage(page);
    } finally {
      setFoodsLoading(false);
    }
  }, [foodsSearch, searchFoods]);

  const handleUpdateFood = async () => {
    if (!editingFood) return;
    try {
      await updateFood(editingFood.id, editedFoodData);
      setEditingFood(null);
      setEditedFoodData({});
      // Refresh the list
      handleSearchFoods(foodsPage);
    } catch {
      // Error handled in hook
    }
  };

  const handleDeleteFood = async (foodId: string) => {
    try {
      await deleteFood(foodId);
      setDeletingFoodId(null);
      // Refresh the list
      handleSearchFoods(foodsPage);
    } catch {
      // Error handled in hook
    }
  };

  const handleDownloadDocumentation = async (docType: 'technical' | 'commercial') => {
    setDownloadingDoc(docType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Erro', description: 'Sessão expirada', variant: 'destructive' });
        return;
      }

      const response = await supabase.functions.invoke('generate-documentation-pdf', {
        body: { docType },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Handle TXT response
      const blob = new Blob([response.data], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docType === 'technical' 
        ? 'DOCUMENTACAO_TECNICA_NUTRIAPLAN.txt' 
        : 'DOCUMENTACAO_COMERCIAL_NUTRIAPLAN.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download concluído',
        description: `Documentação ${docType === 'technical' ? 'técnica' : 'comercial'} baixada com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro no download',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setDownloadingDoc(null);
    }
  };

  const handleExportFoods = async (format: 'csv' | 'txt' | 'xls') => {
    setExportingFoods(format);
    try {
      // Fetch all foods from database
      const { data: foods, error } = await supabase
        .from('foods')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      if (!foods || foods.length === 0) {
        toast({
          title: 'Sem dados',
          description: 'Não há alimentos cadastrados no banco de dados.',
          variant: 'destructive',
        });
        return;
      }
      
      let content: string;
      let mimeType: string;
      let extension: string;
      
      const headers = ['name', 'calories', 'protein', 'carbs', 'fat', 'serving_size', 'category', 'processing_level'];
      
      if (format === 'csv') {
        // CSV format
        const csvRows = [
          headers.join(','),
          ...foods.map(food => 
            headers.map(h => {
              const val = food[h as keyof typeof food];
              if (val === null || val === undefined) return '';
              const strVal = String(val);
              return strVal.includes(',') || strVal.includes('"') 
                ? `"${strVal.replace(/"/g, '""')}"` 
                : strVal;
            }).join(',')
          )
        ];
        content = csvRows.join('\n');
        mimeType = 'text/csv;charset=utf-8';
        extension = 'csv';
      } else if (format === 'txt') {
        // TXT format (tab-separated)
        const txtRows = [
          headers.join('\t'),
          ...foods.map(food => 
            headers.map(h => {
              const val = food[h as keyof typeof food];
              return val === null || val === undefined ? '' : String(val);
            }).join('\t')
          )
        ];
        content = txtRows.join('\n');
        mimeType = 'text/plain;charset=utf-8';
        extension = 'txt';
      } else {
        // XLS format (tab-separated with .xls extension for Excel compatibility)
        const xlsRows = [
          headers.join('\t'),
          ...foods.map(food => 
            headers.map(h => {
              const val = food[h as keyof typeof food];
              return val === null || val === undefined ? '' : String(val);
            }).join('\t')
          )
        ];
        content = xlsRows.join('\n');
        mimeType = 'application/vnd.ms-excel';
        extension = 'xls';
      }
      
      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alimentos_nutriaplan_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Download concluído',
        description: `Banco de alimentos exportado em formato ${format.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        title: 'Erro no download',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setExportingFoods(null);
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
          <ScrollArea className="w-full pb-2">
            <TabsList className="flex w-max gap-1 mb-6">
              <TabsTrigger value="metrics" className="flex items-center gap-1.5 px-3">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Métricas</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1.5 px-3">
                <UserCog className="h-4 w-4" />
                <span className="hidden sm:inline">Usuários</span>
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="flex items-center gap-1.5 px-3">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Assinaturas</span>
              </TabsTrigger>
              <TabsTrigger value="foods" className="flex items-center gap-1.5 px-3">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Alimentos</span>
              </TabsTrigger>
              <TabsTrigger value="plans" className="flex items-center gap-1.5 px-3">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Planos</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-1.5 px-3">
                <History className="h-4 w-4" />
                <span className="hidden sm:inline">Histórico</span>
              </TabsTrigger>
              <TabsTrigger value="seed" className="flex items-center gap-1.5 px-3">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Seed</span>
              </TabsTrigger>
              <TabsTrigger value="docs" className="flex items-center gap-1.5 px-3">
                <BookOpen className="h-4 w-4" />
                <span className="hidden sm:inline">Docs</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-1.5 px-3">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Config</span>
              </TabsTrigger>
            </TabsList>
          </ScrollArea>

          {/* Metrics Dashboard Tab */}
          <TabsContent value="metrics">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Dashboard de Métricas</h2>
                  <p className="text-muted-foreground">Visão geral do sistema e indicadores principais</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={fetchMetrics}
                  disabled={metricsLoading}
                >
                  {metricsLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Atualizar
                </Button>
              </div>
              
              {metricsLoading && !metrics ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                      </CardHeader>
                      <CardContent>
                        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : metrics ? (
                <>
                  {/* Key Metrics Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Total de Usuários
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{metrics.totalUsers}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          Assinaturas Ativas
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{metrics.subscriptionsByStatus['active'] || 0}</span>
                          <span className="text-sm text-muted-foreground">
                            / {metrics.totalSubscriptions} total
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          MRR Estimado
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">
                            R$ {metrics.mrrEstimate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-orange-500">
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Logs (7 dias)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold">{metrics.dailyLogsLast7Days}</span>
                          <span className="text-sm text-muted-foreground">registros</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Detailed Cards */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Users by Type */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          Usuários por Tipo
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(metrics.usersByType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">{type.replace(/_/g, ' ')}</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(count / metrics.totalUsers) * 100} className="w-20 h-2" />
                              <span className="text-sm font-medium w-8 text-right">{count}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Subscriptions by Status */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-primary" />
                          Assinaturas por Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {Object.entries(metrics.subscriptionsByStatus).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between">
                            <Badge 
                              variant={status === 'active' ? 'default' : status === 'trial' ? 'secondary' : 'outline'}
                              className="capitalize"
                            >
                              {status === 'active' ? 'Ativa' : status === 'trial' ? 'Trial' : status === 'past_due' ? 'Vencida' : status === 'canceled' ? 'Cancelada' : status}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(count / Math.max(metrics.totalSubscriptions, 1)) * 100} 
                                className="w-20 h-2" 
                              />
                              <span className="text-sm font-medium w-8 text-right">{count}</span>
                            </div>
                          </div>
                        ))}
                        {Object.keys(metrics.subscriptionsByStatus).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma assinatura</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Diet Plans Stats */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Planos Alimentares
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Total de Planos</span>
                          <span className="text-2xl font-bold">{metrics.totalDietPlans}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Planos Ativos</span>
                          <span className="text-2xl font-bold text-green-600">{metrics.activeDietPlans}</span>
                        </div>
                        <div className="border-t pt-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span>Taxa de ativação: {metrics.totalDietPlans > 0 ? ((metrics.activeDietPlans / metrics.totalDietPlans) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Time Series Chart */}
                  <Card className="mt-6">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            Evolução ao Longo do Tempo
                          </CardTitle>
                          <CardDescription>Últimos 30 dias - Usuários e Assinaturas</CardDescription>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={fetchTimeSeriesData}
                          disabled={timeSeriesLoading}
                        >
                          {timeSeriesLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {timeSeriesLoading && timeSeriesData.length === 0 ? (
                        <div className="h-[300px] flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : timeSeriesData.length > 0 ? (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={timeSeriesData}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis 
                                dataKey="date" 
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                className="text-muted-foreground"
                              />
                              <YAxis 
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                className="text-muted-foreground"
                              />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))',
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px',
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))' }}
                              />
                              <Legend />
                              <Line 
                                type="monotone" 
                                dataKey="users" 
                                name="Usuários" 
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="subscriptions" 
                                name="Assinaturas" 
                                stroke="hsl(142, 71%, 45%)"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                          <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                          <p>Dados do gráfico sendo carregados...</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* New Charts Row: Pie + Bar */}
                  <div className="grid gap-6 md:grid-cols-2 mt-6">
                    {/* Pie Chart - Plan Distribution */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Crown className="h-4 w-4 text-primary" />
                          Distribuição de Planos
                        </CardTitle>
                        <CardDescription>Assinaturas ativas por plano</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {metrics.planDistribution.length > 0 ? (
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={metrics.planDistribution}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                                  outerRadius={100}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {metrics.planDistribution.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                  }}
                                  formatter={(value: number, name: string) => [`${value} assinaturas`, name]}
                                />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                            <Crown className="h-12 w-12 mb-4 opacity-50" />
                            <p>Nenhuma assinatura ativa</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Bar Chart - Revenue by Billing Cycle */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          Receita por Período
                        </CardTitle>
                        <CardDescription>Valor por ciclo de cobrança</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {metrics.revenueByPeriod.length > 0 ? (
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={metrics.revenueByPeriod}
                                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis 
                                  dataKey="period" 
                                  fontSize={12}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis 
                                  fontSize={12}
                                  tickLine={false}
                                  axisLine={false}
                                  tickFormatter={(value) => `R$ ${value}`}
                                />
                                <Tooltip 
                                  contentStyle={{ 
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                  }}
                                  formatter={(value: number, name: string) => {
                                    if (name === 'revenue') return [`R$ ${value.toFixed(2)}`, 'Receita'];
                                    return [`${value}`, 'Assinaturas'];
                                  }}
                                />
                                <Legend formatter={(value) => value === 'revenue' ? 'Receita (R$)' : 'Assinaturas'} />
                                <Bar 
                                  dataKey="revenue" 
                                  name="revenue"
                                  fill="hsl(var(--primary))" 
                                  radius={[4, 4, 0, 0]}
                                />
                                <Bar 
                                  dataKey="count" 
                                  name="count"
                                  fill="hsl(142, 71%, 45%)" 
                                  radius={[4, 4, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-[280px] flex flex-col items-center justify-center text-muted-foreground">
                            <DollarSign className="h-12 w-12 mb-4 opacity-50" />
                            <p>Nenhuma receita registrada</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Clique em "Atualizar" para carregar as métricas</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Gestão de Assinaturas
                </CardTitle>
                <CardDescription>
                  Visualize e gerencie as assinaturas dos usuários ({subscriptionsTotal} total).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Select 
                    value={subscriptionFilter} 
                    onValueChange={(val) => {
                      setSubscriptionFilter(val);
                      fetchSubscriptions(val);
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativas</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="past_due">Vencidas</SelectItem>
                      <SelectItem value="canceled">Canceladas</SelectItem>
                      <SelectItem value="expired">Expiradas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={() => fetchSubscriptions(subscriptionFilter)}
                    disabled={subscriptionsLoading}
                  >
                    {subscriptionsLoading ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-1" />
                    )}
                    Buscar
                  </Button>
                </div>

                <ScrollArea className="h-[500px] border rounded-lg">
                  {subscriptionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : subscriptions.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Clique em "Buscar" para carregar as assinaturas</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Plano</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ciclo</TableHead>
                          <TableHead>Período Atual</TableHead>
                          <TableHead className="text-center">Cancelar?</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{sub.user_name || 'Sem nome'}</span>
                                <span className="text-xs text-muted-foreground">{sub.user_email}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{sub.plan_name || '-'}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  sub.status === 'active' ? 'default' : 
                                  sub.status === 'trial' ? 'secondary' : 
                                  sub.status === 'past_due' ? 'destructive' : 
                                  'outline'
                                }
                              >
                                {sub.status === 'active' ? 'Ativa' : 
                                 sub.status === 'trial' ? 'Trial' : 
                                 sub.status === 'past_due' ? 'Vencida' : 
                                 sub.status === 'canceled' ? 'Cancelada' : 
                                 sub.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="capitalize text-sm">{sub.billing_cycle}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col text-xs">
                                {sub.current_period_start && (
                                  <span>
                                    {new Date(sub.current_period_start).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {sub.current_period_end && (
                                  <span className="text-muted-foreground">
                                    até {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {sub.cancel_at_period_end ? (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Sim
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documentation Tab */}
          <TabsContent value="docs">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Documentação do Sistema</h2>
                  <p className="text-muted-foreground">Gerencie e baixe a documentação oficial do NutriaPlan</p>
                </div>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-blue-500/10">
                        <FileText className="h-6 w-6 text-blue-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Documentação Técnica</CardTitle>
                        <CardDescription className="text-xs">
                          Para desenvolvedores e times técnicos
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Arquitetura do sistema e stack tecnológica</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Regras de negócio e fluxos técnicos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Funcionamento e governança da IA</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Banco de dados e integrações externas</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Requisitos funcionais e não funcionais</span>
                      </li>
                    </ul>
                    <Button 
                      onClick={() => handleDownloadDocumentation('technical')}
                      disabled={downloadingDoc !== null}
                      className="w-full"
                      size="lg"
                    >
                      {downloadingDoc === 'technical' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Baixar TXT
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-green-500/10">
                        <BookOpen className="h-6 w-6 text-green-500" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">Documentação Comercial</CardTitle>
                        <CardDescription className="text-xs">
                          Para investidores e área comercial
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Apresentação e proposta de valor</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Público-alvo e diferenciais competitivos</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Planos, preços e modelo de monetização</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Benefícios e casos de uso</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Visão de futuro e roadmap do produto</span>
                      </li>
                    </ul>
                    <Button 
                      onClick={() => handleDownloadDocumentation('commercial')}
                      disabled={downloadingDoc !== null}
                      className="w-full"
                      size="lg"
                      variant="secondary"
                    >
                      {downloadingDoc === 'commercial' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Baixar TXT
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

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
                                  onClick={async () => {
                                    setDeleteConfirmUser(user);
                                    setDeletePreview(null);
                                    setLoadingDeletePreview(true);
                                    try {
                                      const preview = await previewDeleteUser(user.user_id);
                                      setDeletePreview({ records: preview.records, totalRecords: preview.totalRecords });
                                    } catch {
                                      // Error handled in hook
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
            <div className="space-y-6">
              {/* Export Section */}
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Exportar Banco de Alimentos
                  </CardTitle>
                  <CardDescription>
                    Baixe a base de dados atual de alimentos para padronizar suas importações.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => handleExportFoods('csv')}
                      disabled={exportingFoods !== null}
                    >
                      {exportingFoods === 'csv' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Exportar CSV
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleExportFoods('txt')}
                      disabled={exportingFoods !== null}
                    >
                      {exportingFoods === 'txt' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Exportar TXT
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleExportFoods('xls')}
                      disabled={exportingFoods !== null}
                    >
                      {exportingFoods === 'xls' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Exportar XLS
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Use os arquivos exportados como referência para manter o formato correto nas importações.
                  </p>
                </CardContent>
              </Card>

              {/* Import Section */}
              <Card>
                <CardHeader>
                  <CardTitle>Importar Alimentos</CardTitle>
                  <CardDescription>
                    Faça upload de um arquivo CSV ou Excel com os alimentos para adicionar ao banco.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!showValidating ? (
                    <>
                      <div className="relative">
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.txt,.xls,.xlsx"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="food-upload"
                        />
                        <Label htmlFor="food-upload" asChild>
                          <Button variant="default" className="cursor-pointer">
                            <Upload className="h-4 w-4 mr-2" />
                            Selecionar Arquivo (CSV, TXT, XLS)
                          </Button>
                        </Label>
                      </div>

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Formato esperado</AlertTitle>
                        <AlertDescription>
                          <strong>Formatos aceitos:</strong> CSV (vírgula), TXT (tab), XLS (tab)
                          <br />
                          <strong>Dica:</strong> Exporte o banco atual acima para obter um arquivo no formato correto.
                          <br /><br />
                          <strong>Colunas:</strong> <code className="text-xs bg-muted px-1 rounded">name, calories, protein, carbs, fat, serving_size, category, processing_level</code>
                          <br />
                          <span className="text-muted-foreground text-xs">
                            Dados nutricionais incompletos serão preenchidos automaticamente com valores médios estimados.
                          </span>
                        </AlertDescription>
                      </Alert>
                    </>
                  ) : (
                    <FoodImportValidator
                      file={csvFile}
                      onValidationComplete={handleValidationComplete}
                      onCancel={handleCancelValidation}
                    />
                  )}
                </CardContent>
              </Card>
              {/* AI Audit Section */}
              <FoodAudit 
                onApplySuggestion={async (foodId, updates) => {
                  await updateFood(foodId, updates as any);
                }}
                onApplyBatch={async (batchUpdates) => {
                  return await batchUpdateFoods(batchUpdates);
                }}
                onApplyAll={async (allUpdates) => {
                  return await batchUpdateFoods(allUpdates);
                }}
              />
            </div>

              {/* Manage Foods Section */}
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Gerenciar Alimentos
                      </CardTitle>
                      <CardDescription>
                        Busque, edite ou exclua alimentos existentes no banco de dados.
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        try {
                          await normalizeFoodNames();
                          // Refresh search results if any
                          if (foodsSearch) {
                            handleSearchFoods(0);
                          }
                        } catch (e) {
                          // Error handled in hook
                        }
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Normalizar Nomes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar alimentos por nome..."
                        value={foodsSearch}
                        onChange={(e) => setFoodsSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchFoods(0)}
                        className="pl-10"
                      />
                    </div>
                    <Button onClick={() => handleSearchFoods(0)} disabled={foodsLoading}>
                      {foodsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  {/* Results */}
                  {foodsData.total > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {foodsData.total} alimento(s) encontrado(s)
                    </div>
                  )}

                  <ScrollArea className="h-[400px] border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Nome</TableHead>
                          <TableHead className="text-right">Kcal</TableHead>
                          <TableHead className="text-right">Prot</TableHead>
                          <TableHead className="text-right">Carb</TableHead>
                          <TableHead className="text-right">Gord</TableHead>
                          <TableHead>Porção</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {foodsData.foods.map((food: FoodRow & { id?: string }) => (
                          <TableRow key={food.id || food.name}>
                            <TableCell className="font-medium">{food.name}</TableCell>
                            <TableCell className="text-right">{food.calories}</TableCell>
                            <TableCell className="text-right">{food.protein}g</TableCell>
                            <TableCell className="text-right">{food.carbs}g</TableCell>
                            <TableCell className="text-right">{food.fat}g</TableCell>
                            <TableCell className="text-xs">{food.serving_size || '100g'}</TableCell>
                            <TableCell className="text-xs">
                              {food.category ? (
                                <Badge variant="outline" className="text-xs">
                                  {food.category.replace(/_/g, ' ')}
                                </Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingFood(food as FoodRow & { id: string });
                                    setEditedFoodData(food);
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeletingFoodId(food.id || null)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {foodsData.foods.length === 0 && !foodsLoading && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                              {foodsSearch ? 'Nenhum alimento encontrado.' : 'Digite um termo para buscar alimentos.'}
                            </TableCell>
                          </TableRow>
                        )}
                        {foodsLoading && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Pagination */}
                  {foodsData.total > 20 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Página {foodsPage + 1} de {Math.ceil(foodsData.total / 20)}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSearchFoods(foodsPage - 1)}
                          disabled={foodsPage === 0 || foodsLoading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSearchFoods(foodsPage + 1)}
                          disabled={(foodsPage + 1) * 20 >= foodsData.total || foodsLoading}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
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

              {/* Warnings section - values filled with defaults */}
              {csvPreview.validation.warnings && csvPreview.validation.warnings.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Valores estimados automaticamente</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <p className="text-sm mb-2">
                      Alguns dados nutricionais estavam ausentes ou inválidos e foram preenchidos com valores médios:
                    </p>
                    <ScrollArea className="max-h-[120px]">
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {csvPreview.validation.warnings.slice(0, 15).map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                        {csvPreview.validation.warnings.length > 15 && (
                          <li className="font-medium">... e mais {csvPreview.validation.warnings.length - 15} avisos</li>
                        )}
                      </ul>
                    </ScrollArea>
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

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => {
                  setShowPreview(false);
                  setCsvFile(null);
                  setCsvPreview({ rows: [], validation: null });
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary"
                    onClick={() => {
                      setShowPreview(false);
                      setShowAIValidation(true);
                    }}
                    disabled={!csvPreview.validation.validRows.length}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    Validar com IA
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
                    Importar Direto
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Food Validation Dialog */}
      <Dialog open={showAIValidation} onOpenChange={(open) => {
        if (!open) {
          setShowAIValidation(false);
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Validação Inteligente com IA
            </DialogTitle>
            <DialogDescription>
              {csvFile?.name} - {csvPreview.validation?.validRows.length || 0} alimentos para validar
            </DialogDescription>
          </DialogHeader>

          {csvPreview.validation?.validRows && csvPreview.validation.validRows.length > 0 && (
            <AIFoodValidation
              foods={csvPreview.validation.validRows}
              onValidationComplete={async (approvedFoods) => {
                try {
                  await importFoods(csvFile?.name || 'import.csv', approvedFoods);
                  setShowAIValidation(false);
                  setCsvFile(null);
                  setCsvPreview({ rows: [], validation: null });
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                } catch {
                  // Error handled in hook
                }
              }}
              onCancel={() => {
                setShowAIValidation(false);
                setShowPreview(true);
              }}
            />
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
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmUser(null);
          setDeletePreview(null);
        }
      }}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  Tem certeza que deseja excluir permanentemente o usuário <strong>{deleteConfirmUser?.name || deleteConfirmUser?.email}</strong>?
                </p>
                
                {loadingDeletePreview ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Carregando registros...</span>
                  </div>
                ) : deletePreview ? (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-destructive">Total de registros a serem excluídos:</span>
                      <Badge variant="destructive" className="text-lg px-3">
                        {deletePreview.totalRecords}
                      </Badge>
                    </div>
                    
                    {deletePreview.totalRecords > 0 && (
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-destructive/20">
                        {Object.entries(deletePreview.records)
                          .filter(([_, count]) => count > 0)
                          .sort((a, b) => b[1] - a[1])
                          .map(([table, count]) => (
                            <div key={table} className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                {table.replace(/_/g, ' ')}:
                              </span>
                              <Badge variant="outline" className="font-mono">
                                {count}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : null}

                <p className="mt-4 text-sm font-medium text-destructive">
                  Esta ação é <strong>irreversível</strong>.
                </p>
              </div>
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
                  setDeletePreview(null);
                } catch {
                  // Error handled in hook
                }
              }}
              disabled={savingKeys.has(`delete_${deleteConfirmUser?.user_id}`) || loadingDeletePreview}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {savingKeys.has(`delete_${deleteConfirmUser?.user_id}`) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Excluir {deletePreview?.totalRecords ? `${deletePreview.totalRecords} registros` : 'Permanentemente'}
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

      {/* Edit Food Dialog */}
      <Dialog open={!!editingFood} onOpenChange={(open) => {
        if (!open) {
          setEditingFood(null);
          setEditedFoodData({});
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Alimento
            </DialogTitle>
            <DialogDescription>
              Atualize as informações nutricionais do alimento.
            </DialogDescription>
          </DialogHeader>

          {editingFood && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editedFoodData.name ?? editingFood.name}
                  onChange={(e) => setEditedFoodData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do alimento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Calorias (kcal)</Label>
                  <Input
                    type="number"
                    value={editedFoodData.calories ?? editingFood.calories}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, calories: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Proteína (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editedFoodData.protein ?? editingFood.protein}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, protein: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Carboidratos (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editedFoodData.carbs ?? editingFood.carbs}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, carbs: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gordura (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editedFoodData.fat ?? editingFood.fat}
                    onChange={(e) => setEditedFoodData(prev => ({ ...prev, fat: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Porção</Label>
                <Input
                  value={editedFoodData.serving_size ?? editingFood.serving_size ?? '100g'}
                  onChange={(e) => setEditedFoodData(prev => ({ ...prev, serving_size: e.target.value }))}
                  placeholder="Ex: 100g, 1 unidade"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={editedFoodData.category ?? editingFood.category ?? 'none'}
                    onValueChange={(value) => setEditedFoodData(prev => ({ ...prev, category: value === 'none' ? null : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      <SelectItem value="frutas">Frutas</SelectItem>
                      <SelectItem value="hortaliças_folhosas">Hortaliças Folhosas</SelectItem>
                      <SelectItem value="legumes">Legumes</SelectItem>
                      <SelectItem value="cereais_tubérculos">Cereais e Tubérculos</SelectItem>
                      <SelectItem value="leguminosas">Leguminosas</SelectItem>
                      <SelectItem value="proteínas_animais">Proteínas Animais</SelectItem>
                      <SelectItem value="laticínios">Laticínios</SelectItem>
                      <SelectItem value="óleos_oleaginosas">Óleos e Oleaginosas</SelectItem>
                      <SelectItem value="suplementos">Suplementos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nível Processamento</Label>
                  <Select
                    value={editedFoodData.processing_level ?? editingFood.processing_level ?? 'in_natura'}
                    onValueChange={(value) => setEditedFoodData(prev => ({ ...prev, processing_level: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_natura">In Natura</SelectItem>
                      <SelectItem value="minimamente_processado">Minimamente Processado</SelectItem>
                      <SelectItem value="processado">Processado</SelectItem>
                      <SelectItem value="ultraprocessado">Ultraprocessado</SelectItem>
                      <SelectItem value="suplemento">Suplemento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFood(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpdateFood}
              disabled={savingKeys.has(`food_${editingFood?.id}`)}
            >
              {savingKeys.has(`food_${editingFood?.id}`) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar Alimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Food Confirmation */}
      <AlertDialog open={!!deletingFoodId} onOpenChange={(open) => !open && setDeletingFoodId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Alimento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este alimento? Esta ação não pode ser desfeita.
              <br /><br />
              <strong>Nota:</strong> Alimentos em uso em refeições não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingFoodId && handleDeleteFood(deletingFoodId)}
              disabled={savingKeys.has(`delete_food_${deletingFoodId}`)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {savingKeys.has(`delete_food_${deletingFoodId}`) ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
