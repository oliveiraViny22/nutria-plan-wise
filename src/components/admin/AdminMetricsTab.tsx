/**
 * Admin Metrics Tab Component
 * 
 * Displays dashboard metrics, charts, and KPIs for the admin panel
 */

import { 
  Users, 
  CreditCard, 
  Briefcase, 
  TrendingUp, 
  Bot, 
  Activity,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

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

interface UserTypeMetrics {
  freeUsers: number;
  paidPersonal: number;
  professionals: number;
  linkedStudents: number;
}

interface FinancialMetrics {
  mrr: number;
  totalRevenue: number;
  aiCostThisMonth: number;
  aiCallsThisMonth: number;
}

interface DashboardMetrics {
  totalUsers: number;
  totalSubscriptions: number;
  subscriptionsByStatus: Record<string, number>;
  planDistribution: PlanDistributionData[];
  userTypes: UserTypeMetrics;
  financial: FinancialMetrics;
}

interface AdminMetricsTabProps {
  metrics: DashboardMetrics | null;
  metricsLoading: boolean;
  timeSeriesData: TimeSeriesDataPoint[];
  timeSeriesLoading: boolean;
}

export function AdminMetricsTab({
  metrics,
  metricsLoading,
  timeSeriesData,
  timeSeriesLoading,
}: AdminMetricsTabProps) {
  return (
    <div className="space-y-6">
      {/* Métricas de Usuários */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.subscriptionsByStatus?.active || 0} com assinatura ativa
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Usuários Free</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.userTypes?.freeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Plano gratuito</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pessoal Pago</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.userTypes?.paidPersonal || 0}</div>
            <p className="text-xs text-muted-foreground">Plano pessoal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Profissionais</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.userTypes?.professionals || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.userTypes?.linkedStudents || 0} alunos vinculados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Financeiras */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {(metrics?.financial?.mrr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">Receita recorrente mensal</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo IA (Mês)</CardTitle>
            <Bot className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              $ {(metrics?.financial?.aiCostThisMonth || 0).toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.financial?.aiCallsThisMonth || 0} chamadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alunos Vinculados</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.userTypes?.linkedStudents || 0}</div>
            <p className="text-xs text-muted-foreground">Atribuídos a profissionais</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Assinaturas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSubscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.subscriptionsByStatus?.active || 0} ativas
            </p>
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
  );
}

export type { DashboardMetrics, TimeSeriesDataPoint };
