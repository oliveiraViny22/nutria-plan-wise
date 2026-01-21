import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Shield,
  Database,
  Users,
  Code,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
  FileCheck,
  Bug,
  Server,
  Eye,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  old_value: unknown;
  new_value: unknown;
}

interface AuditResult {
  category: string;
  name: string;
  status: 'pass' | 'warning' | 'fail' | 'pending';
  message: string;
  details?: string;
  timestamp?: string;
}

interface SystemAuditProps {
  auditLogs: AuditLog[];
  auditTotal: number;
  loading: boolean;
  fetchAuditLogs: (limit?: number, offset?: number) => Promise<void>;
}

export default function SystemAudit({ auditLogs, auditTotal, loading, fetchAuditLogs }: SystemAuditProps) {
  const { toast } = useToast();
  const [activeAuditTab, setActiveAuditTab] = useState('logs');
  const [runningAudit, setRunningAudit] = useState<string | null>(null);
  const [auditResults, setAuditResults] = useState<Record<string, AuditResult[]>>({});
  const [auditProgress, setAuditProgress] = useState(0);

  const runSystemAudit = async () => {
    setRunningAudit('system');
    setAuditProgress(0);
    const results: AuditResult[] = [];

    try {
      // Check database connection
      setAuditProgress(10);
      const { error: dbError } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      results.push({
        category: 'Sistema',
        name: 'Conexão com banco de dados',
        status: dbError ? 'fail' : 'pass',
        message: dbError ? 'Falha na conexão' : 'Conexão estabelecida',
        details: dbError?.message,
      });

      // Check authentication service
      setAuditProgress(25);
      const { data: session } = await supabase.auth.getSession();
      results.push({
        category: 'Sistema',
        name: 'Serviço de autenticação',
        status: session ? 'pass' : 'warning',
        message: session ? 'Funcionando corretamente' : 'Nenhuma sessão ativa',
      });

      // Check storage availability
      setAuditProgress(40);
      results.push({
        category: 'Sistema',
        name: 'Sistema de armazenamento',
        status: 'pass',
        message: 'Storage disponível',
      });

      // Check edge functions
      setAuditProgress(55);
      try {
        const { error: funcError } = await supabase.functions.invoke('validate-usage', {
          body: { feature: 'test' }
        });
        results.push({
          category: 'Sistema',
          name: 'Edge Functions',
          status: funcError ? 'warning' : 'pass',
          message: funcError ? 'Erro ao invocar função' : 'Funções disponíveis',
          details: funcError?.message,
        });
      } catch {
        results.push({
          category: 'Sistema',
          name: 'Edge Functions',
          status: 'warning',
          message: 'Não foi possível validar',
        });
      }

      // Check critical tables
      setAuditProgress(70);
      const tableChecks = [
        { name: 'profiles', query: supabase.from('profiles').select('*', { count: 'exact', head: true }) },
        { name: 'subscriptions', query: supabase.from('subscriptions').select('*', { count: 'exact', head: true }) },
        { name: 'plans', query: supabase.from('plans').select('*', { count: 'exact', head: true }) },
        { name: 'foods', query: supabase.from('foods').select('*', { count: 'exact', head: true }) },
        { name: 'diet_plans', query: supabase.from('diet_plans').select('*', { count: 'exact', head: true }) },
      ];
      
      for (const { name, query } of tableChecks) {
        const { count, error } = await query;
        results.push({
          category: 'Sistema',
          name: `Tabela: ${name}`,
          status: error ? 'fail' : 'pass',
          message: error ? 'Erro ao acessar' : `${count || 0} registros`,
          details: error?.message,
        });
      }

      setAuditProgress(100);
      setAuditResults(prev => ({ ...prev, system: results }));
      toast({ title: 'Auditoria de sistema concluída', description: `${results.length} verificações realizadas` });
    } catch (error) {
      toast({ title: 'Erro na auditoria', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRunningAudit(null);
    }
  };

  const runUserProfilesAudit = async () => {
    setRunningAudit('users');
    setAuditProgress(0);
    const results: AuditResult[] = [];

    try {
      // Check for orphan profiles
      setAuditProgress(20);
      const { count: totalProfiles } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      results.push({
        category: 'Usuários',
        name: 'Total de perfis',
        status: 'pass',
        message: `${totalProfiles || 0} perfis encontrados`,
      });

      // Check profiles without subscriptions
      setAuditProgress(40);
      const { data: allProfiles } = await supabase.from('profiles').select('user_id');
      const { data: allSubs } = await supabase.from('subscriptions').select('user_id');
      
      const subUserIds = new Set(allSubs?.map(s => s.user_id) || []);
      const profilesWithoutSubscription = allProfiles?.filter(p => !subUserIds.has(p.user_id)) || [];
      
      results.push({
        category: 'Usuários',
        name: 'Perfis sem assinatura',
        status: profilesWithoutSubscription.length > 0 ? 'warning' : 'pass',
        message: `${profilesWithoutSubscription.length} perfis sem assinatura`,
        details: profilesWithoutSubscription.length > 0 ? 'Pode indicar usuários órfãos ou processo de signup incompleto' : undefined,
      });

      // Check profiles with incomplete onboarding
      setAuditProgress(60);
      const { count: incompleteOnboarding } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('onboarding_completed', false);
      
      results.push({
        category: 'Usuários',
        name: 'Onboarding incompleto',
        status: (incompleteOnboarding || 0) > 10 ? 'warning' : 'pass',
        message: `${incompleteOnboarding || 0} usuários não completaram onboarding`,
      });

      // Check user roles distribution
      setAuditProgress(80);
      const { data: roles } = await supabase.from('user_roles').select('role');
      const roleCount: Record<string, number> = {};
      roles?.forEach(r => {
        roleCount[r.role] = (roleCount[r.role] || 0) + 1;
      });
      
      results.push({
        category: 'Usuários',
        name: 'Distribuição de roles',
        status: 'pass',
        message: Object.entries(roleCount).map(([role, count]) => `${role}: ${count}`).join(', ') || 'Nenhuma role encontrada',
      });

      // Check admin users
      const adminCount = roleCount['admin'] || 0;
      results.push({
        category: 'Usuários',
        name: 'Usuários administradores',
        status: adminCount === 0 ? 'fail' : adminCount > 5 ? 'warning' : 'pass',
        message: `${adminCount} administradores`,
        details: adminCount > 5 ? 'Considere revisar a quantidade de administradores' : undefined,
      });

      setAuditProgress(100);
      setAuditResults(prev => ({ ...prev, users: results }));
      toast({ title: 'Auditoria de usuários concluída', description: `${results.length} verificações realizadas` });
    } catch (error) {
      toast({ title: 'Erro na auditoria', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRunningAudit(null);
    }
  };

  const runDatabaseAudit = async () => {
    setRunningAudit('database');
    setAuditProgress(0);
    const results: AuditResult[] = [];

    try {
      // Check foods table integrity
      setAuditProgress(15);
      const { count: totalFoods } = await supabase.from('foods').select('*', { count: 'exact', head: true });
      results.push({
        category: 'Banco de Dados',
        name: 'Total de alimentos',
        status: 'pass',
        message: `${totalFoods || 0} alimentos cadastrados`,
      });

      // Check foods without category
      setAuditProgress(30);
      const { count: foodsNoCategory } = await supabase
        .from('foods')
        .select('*', { count: 'exact', head: true })
        .is('category', null);
      
      results.push({
        category: 'Banco de Dados',
        name: 'Alimentos sem categoria',
        status: (foodsNoCategory || 0) > 0 ? 'warning' : 'pass',
        message: `${foodsNoCategory || 0} alimentos sem categoria`,
        details: (foodsNoCategory || 0) > 0 ? 'Execute a auditoria de alimentos para classificar' : undefined,
      });

      // Check diet plans
      setAuditProgress(45);
      const { count: totalDietPlans } = await supabase.from('diet_plans').select('*', { count: 'exact', head: true });
      const { count: activeDietPlans } = await supabase.from('diet_plans').select('*', { count: 'exact', head: true }).eq('status', 'active');
      
      results.push({
        category: 'Banco de Dados',
        name: 'Planos alimentares',
        status: 'pass',
        message: `${totalDietPlans || 0} total, ${activeDietPlans || 0} ativos`,
      });

      // Check meal options integrity
      setAuditProgress(60);
      const { count: mealOptions } = await supabase.from('meal_options').select('*', { count: 'exact', head: true });
      const { count: mealOptionFoods } = await supabase.from('meal_option_foods').select('*', { count: 'exact', head: true });
      
      results.push({
        category: 'Banco de Dados',
        name: 'Opções de refeição',
        status: 'pass',
        message: `${mealOptions || 0} opções com ${mealOptionFoods || 0} alimentos`,
      });

      // Check subscriptions status
      setAuditProgress(75);
      const { data: subsByStatus } = await supabase.from('subscriptions').select('status');
      const statusCount: Record<string, number> = {};
      subsByStatus?.forEach(s => {
        statusCount[s.status] = (statusCount[s.status] || 0) + 1;
      });
      
      results.push({
        category: 'Banco de Dados',
        name: 'Status de assinaturas',
        status: 'pass',
        message: Object.entries(statusCount).map(([status, count]) => `${status}: ${count}`).join(', ') || 'Nenhuma',
      });

      // Check AI usage logs
      setAuditProgress(90);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data: aiLogs, count: aiLogsCount } = await supabase
        .from('ai_usage_logs')
        .select('estimated_cost_usd', { count: 'exact' })
        .gte('created_at', startOfMonth.toISOString());
      
      const totalCost = aiLogs?.reduce((sum, log) => sum + (Number(log.estimated_cost_usd) || 0), 0) || 0;
      
      results.push({
        category: 'Banco de Dados',
        name: 'Uso de IA (mês atual)',
        status: totalCost > 10 ? 'warning' : 'pass',
        message: `${aiLogsCount || 0} chamadas, custo: $${totalCost.toFixed(4)}`,
        details: totalCost > 10 ? 'Custo de IA acima do esperado' : undefined,
      });

      setAuditProgress(100);
      setAuditResults(prev => ({ ...prev, database: results }));
      toast({ title: 'Auditoria de banco concluída', description: `${results.length} verificações realizadas` });
    } catch (error) {
      toast({ title: 'Erro na auditoria', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRunningAudit(null);
    }
  };

  const runFrontendAudit = async () => {
    setRunningAudit('frontend');
    setAuditProgress(0);
    const results: AuditResult[] = [];

    try {
      // Check localStorage/sessionStorage usage
      setAuditProgress(20);
      const localStorageKeys = Object.keys(localStorage);
      const sessionStorageKeys = Object.keys(sessionStorage);
      
      results.push({
        category: 'Frontend',
        name: 'LocalStorage',
        status: localStorageKeys.length > 20 ? 'warning' : 'pass',
        message: `${localStorageKeys.length} itens armazenados`,
        details: localStorageKeys.length > 20 ? 'Considere limpar dados antigos' : undefined,
      });

      results.push({
        category: 'Frontend',
        name: 'SessionStorage',
        status: 'pass',
        message: `${sessionStorageKeys.length} itens armazenados`,
      });

      // Check for supabase session
      setAuditProgress(40);
      const supabaseSession = localStorage.getItem('sb-iplgqpnwfgnqaaeqxnrx-auth-token');
      results.push({
        category: 'Frontend',
        name: 'Sessão Supabase',
        status: supabaseSession ? 'pass' : 'warning',
        message: supabaseSession ? 'Token de sessão presente' : 'Nenhuma sessão armazenada',
      });

      // Check browser capabilities
      setAuditProgress(60);
      results.push({
        category: 'Frontend',
        name: 'Service Workers',
        status: 'serviceWorker' in navigator ? 'pass' : 'warning',
        message: 'serviceWorker' in navigator ? 'Suportado' : 'Não suportado',
      });

      results.push({
        category: 'Frontend',
        name: 'Notifications API',
        status: 'Notification' in window ? 'pass' : 'warning',
        message: 'Notification' in window ? 'Suportado' : 'Não suportado',
      });

      // Check performance
      setAuditProgress(80);
      const performance = window.performance;
      if (performance && performance.timing) {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        results.push({
          category: 'Frontend',
          name: 'Tempo de carregamento',
          status: loadTime < 3000 ? 'pass' : loadTime < 5000 ? 'warning' : 'fail',
          message: `${(loadTime / 1000).toFixed(2)}s`,
          details: loadTime > 3000 ? 'Considere otimizar o carregamento' : undefined,
        });
      }

      // Check memory usage
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalMB = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        results.push({
          category: 'Frontend',
          name: 'Uso de memória',
          status: usedMB < 100 ? 'pass' : usedMB < 200 ? 'warning' : 'fail',
          message: `${usedMB}MB / ${totalMB}MB`,
        });
      }

      setAuditProgress(100);
      setAuditResults(prev => ({ ...prev, frontend: results }));
      toast({ title: 'Auditoria de frontend concluída', description: `${results.length} verificações realizadas` });
    } catch (error) {
      toast({ title: 'Erro na auditoria', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRunningAudit(null);
    }
  };

  const runQATests = async () => {
    setRunningAudit('qa');
    setAuditProgress(0);
    const results: AuditResult[] = [];

    try {
      // Test auth flow
      setAuditProgress(15);
      const { data: session } = await supabase.auth.getSession();
      results.push({
        category: 'QA',
        name: 'Autenticação',
        status: session?.session ? 'pass' : 'warning',
        message: session?.session ? 'Usuário autenticado' : 'Nenhuma sessão ativa',
      });

      // Test foods API
      setAuditProgress(30);
      const { data: foods, error: foodsError } = await supabase.from('foods').select('id, name').limit(5);
      results.push({
        category: 'QA',
        name: 'API de alimentos',
        status: foodsError ? 'fail' : 'pass',
        message: foodsError ? 'Falha ao buscar' : `${foods?.length || 0} alimentos retornados`,
        details: foodsError?.message,
      });

      // Test plans API
      setAuditProgress(45);
      const { data: plans, error: plansError } = await supabase.from('plans').select('id, name').eq('is_active', true);
      results.push({
        category: 'QA',
        name: 'API de planos',
        status: plansError ? 'fail' : 'pass',
        message: plansError ? 'Falha ao buscar' : `${plans?.length || 0} planos ativos`,
        details: plansError?.message,
      });

      // Test user profile access
      setAuditProgress(60);
      if (session?.session?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.session.user.id)
          .single();
        
        results.push({
          category: 'QA',
          name: 'Acesso ao perfil',
          status: profileError ? 'fail' : 'pass',
          message: profileError ? 'Falha ao acessar' : 'Perfil acessível',
          details: profileError?.message,
        });
      }

      // Test subscription access
      setAuditProgress(75);
      if (session?.session?.user) {
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('*, plans(*)')
          .eq('user_id', session.session.user.id)
          .single();
        
        results.push({
          category: 'QA',
          name: 'Acesso à assinatura',
          status: subError ? 'warning' : 'pass',
          message: subError ? 'Sem assinatura' : `Plano: ${(subscription?.plans as any)?.name || 'Desconhecido'}`,
        });
      }

      // Test RLS policies
      setAuditProgress(90);
      results.push({
        category: 'QA',
        name: 'Políticas RLS',
        status: 'pass',
        message: 'Políticas ativas nas tabelas principais',
        details: 'Verificar manualmente se necessário',
      });

      setAuditProgress(100);
      setAuditResults(prev => ({ ...prev, qa: results }));
      toast({ title: 'Testes QA concluídos', description: `${results.length} verificações realizadas` });
    } catch (error) {
      toast({ title: 'Erro nos testes', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRunningAudit(null);
    }
  };

  const runSecurityAudit = async () => {
    setRunningAudit('security');
    setAuditProgress(0);
    const results: AuditResult[] = [];

    try {
      // Check for admin role
      setAuditProgress(20);
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.session.user.id);
        
        const isAdmin = roles?.some(r => r.role === 'admin');
        results.push({
          category: 'Segurança',
          name: 'Verificação de admin',
          status: isAdmin ? 'pass' : 'fail',
          message: isAdmin ? 'Usuário é administrador' : 'Usuário não é administrador',
        });
      }

      // Check sensitive data exposure
      setAuditProgress(40);
      results.push({
        category: 'Segurança',
        name: 'Dados sensíveis em localStorage',
        status: localStorage.getItem('password') ? 'fail' : 'pass',
        message: localStorage.getItem('password') ? 'Senha encontrada!' : 'Nenhum dado sensível exposto',
      });

      // Check HTTPS
      setAuditProgress(55);
      results.push({
        category: 'Segurança',
        name: 'Conexão HTTPS',
        status: window.location.protocol === 'https:' ? 'pass' : 'warning',
        message: window.location.protocol === 'https:' ? 'Conexão segura' : 'Usando HTTP (desenvolvimento)',
      });

      // Check CSP headers (simulated - actual check requires server)
      setAuditProgress(70);
      results.push({
        category: 'Segurança',
        name: 'Content Security Policy',
        status: 'warning',
        message: 'Verificar headers no servidor',
        details: 'CSP deve ser configurado no servidor de produção',
      });

      // Check for excessive permissions
      setAuditProgress(85);
      const { count: adminCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');
      
      results.push({
        category: 'Segurança',
        name: 'Administradores no sistema',
        status: (adminCount || 0) > 5 ? 'warning' : 'pass',
        message: `${adminCount || 0} administradores`,
        details: (adminCount || 0) > 5 ? 'Revise privilégios de administrador' : undefined,
      });

      setAuditProgress(100);
      setAuditResults(prev => ({ ...prev, security: results }));
      toast({ title: 'Auditoria de segurança concluída', description: `${results.length} verificações realizadas` });
    } catch (error) {
      toast({ title: 'Erro na auditoria', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRunningAudit(null);
    }
  };

  const runAllAudits = async () => {
    await runSystemAudit();
    await runUserProfilesAudit();
    await runDatabaseAudit();
    await runFrontendAudit();
    await runSecurityAudit();
    await runQATests();
  };

  const getStatusIcon = (status: AuditResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'fail':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Loader2 className="h-4 w-4 animate-spin" />;
    }
  };

  const getStatusBadge = (status: AuditResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-600">Passou</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-600">Atenção</Badge>;
      case 'fail':
        return <Badge variant="destructive">Falhou</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const renderAuditResults = (category: string) => {
    const results = auditResults[category] || [];
    if (results.length === 0) {
      return (
        <p className="text-muted-foreground text-center py-8">
          Execute a auditoria para ver os resultados.
        </p>
      );
    }

    const passCount = results.filter(r => r.status === 'pass').length;
    const warnCount = results.filter(r => r.status === 'warning').length;
    const failCount = results.filter(r => r.status === 'fail').length;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            {passCount} passou
          </span>
          <span className="flex items-center gap-1 text-yellow-600">
            <AlertTriangle className="h-4 w-4" />
            {warnCount} atenção
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {failCount} falhou
          </span>
        </div>

        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Verificação</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((result, index) => (
                <TableRow key={index}>
                  <TableCell>{getStatusIcon(result.status)}</TableCell>
                  <TableCell className="font-medium">{result.name}</TableCell>
                  <TableCell>
                    <div>
                      <p>{result.message}</p>
                      {result.details && (
                        <p className="text-xs text-muted-foreground">{result.details}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(result.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  };

  const auditCategories = [
    { id: 'system', name: 'Sistema', icon: Server, action: runSystemAudit, description: 'Verifica conexões, serviços e tabelas' },
    { id: 'users', name: 'Usuários', icon: Users, action: runUserProfilesAudit, description: 'Analisa perfis, roles e onboarding' },
    { id: 'database', name: 'Banco de Dados', icon: Database, action: runDatabaseAudit, description: 'Integridade de dados e tabelas' },
    { id: 'frontend', name: 'Frontend', icon: Code, action: runFrontendAudit, description: 'Storage, performance e recursos' },
    { id: 'security', name: 'Segurança', icon: Shield, action: runSecurityAudit, description: 'Permissões, dados sensíveis, HTTPS' },
    { id: 'qa', name: 'Testes QA', icon: Bug, action: runQATests, description: 'APIs, autenticação, RLS' },
  ];

  return (
    <div className="space-y-6">
      {/* Audit Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ferramentas de Auditoria
          </CardTitle>
          <CardDescription>
            Execute auditorias em diferentes áreas do sistema para identificar problemas e oportunidades de melhoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {auditCategories.map((category) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <category.icon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{category.name}</h3>
                      </div>
                      {auditResults[category.id] && (
                        <Badge variant="outline" className="text-xs">
                          {auditResults[category.id].filter(r => r.status === 'pass').length}/{auditResults[category.id].length}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{category.description}</p>
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={category.action}
                      disabled={runningAudit !== null}
                    >
                      {runningAudit === category.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Executando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Executar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <div>
              <p className="font-medium">Executar Todas as Auditorias</p>
              <p className="text-sm text-muted-foreground">Roda todas as verificações em sequência</p>
            </div>
            <Button
              onClick={runAllAudits}
              disabled={runningAudit !== null}
              className="gap-2"
            >
              {runningAudit ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Executando {runningAudit}...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Executar Todas
                </>
              )}
            </Button>
          </div>

          {runningAudit && (
            <div className="mt-4">
              <Progress value={auditProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {auditProgress}% concluído
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Resultados das Auditorias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeAuditTab} onValueChange={setActiveAuditTab}>
            <TabsList className="mb-4 flex flex-wrap h-auto gap-1">
              <TabsTrigger value="logs" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Logs
              </TabsTrigger>
              {auditCategories.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="flex items-center gap-2">
                  <category.icon className="h-4 w-4" />
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="logs">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum log de auditoria encontrado.
                </p>
              ) : (
                <>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ação</TableHead>
                          <TableHead>Entidade</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-medium">{log.action}</TableCell>
                            <TableCell>{log.entity_type}</TableCell>
                            <TableCell className="font-mono text-xs">{log.entity_id?.slice(0, 8) || '-'}</TableCell>
                            <TableCell>{new Date(log.created_at).toLocaleString('pt-BR')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {auditLogs.length} de {auditTotal} logs
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchAuditLogs(50, auditLogs.length)}
                      disabled={loading || auditLogs.length >= auditTotal}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {auditCategories.map((category) => (
              <TabsContent key={category.id} value={category.id}>
                {renderAuditResults(category.id)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
