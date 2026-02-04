/**
 * Admin Conversion Analytics Tab
 * 
 * Dashboard showing conversion funnel metrics from locked feature previews
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  MousePointerClick, 
  Sparkles, 
  Flame,
  Pill,
  BarChart3,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface ConversionMetrics {
  totalClicks: number;
  uniqueUsers: number;
  clicksByFeature: Record<string, number>;
  clicksByDay: { date: string; clicks: number }[];
  topFeatures: { feature_key: string; clicks: number; percentage: number }[];
}

const FEATURE_LABELS: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  gamification_streak: { label: 'Sequência de Adesão', icon: Flame, color: '#f97316' },
  gamification_weekly_chart: { label: 'Gráfico Semanal', icon: BarChart3, color: '#3b82f6' },
  supplementation: { label: 'Suplementação', icon: Pill, color: '#22c55e' },
};

const CHART_COLORS = ['#22c55e', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899'];

type DateRange = '7d' | '30d' | '90d' | 'all';

export function AdminConversionTab() {
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const fetchConversionMetrics = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('conversion_events')
        .select('*')
        .eq('event_type', 'unlock_cta_click')
        .order('created_at', { ascending: false });

      // Apply date filter
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: events, error } = await query;

      if (error) throw error;

      // Process metrics
      const totalClicks = events?.length || 0;
      const uniqueUsers = new Set(events?.map(e => e.user_id)).size;

      // Clicks by feature
      const clicksByFeature: Record<string, number> = {};
      events?.forEach(event => {
        const key = event.feature_key;
        clicksByFeature[key] = (clicksByFeature[key] || 0) + 1;
      });

      // Clicks by day (last 7 or 30 days based on range)
      const daysToShow = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
      const clicksByDayMap: Record<string, number> = {};
      
      for (let i = daysToShow - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        clicksByDayMap[dateStr] = 0;
      }

      events?.forEach(event => {
        const dateStr = new Date(event.created_at).toISOString().split('T')[0];
        if (clicksByDayMap[dateStr] !== undefined) {
          clicksByDayMap[dateStr]++;
        }
      });

      const clicksByDay = Object.entries(clicksByDayMap).map(([date, clicks]) => ({
        date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        clicks,
      }));

      // Top features with percentage
      const topFeatures = Object.entries(clicksByFeature)
        .map(([feature_key, clicks]) => ({
          feature_key,
          clicks,
          percentage: totalClicks > 0 ? Math.round((clicks / totalClicks) * 100) : 0,
        }))
        .sort((a, b) => b.clicks - a.clicks);

      setMetrics({
        totalClicks,
        uniqueUsers,
        clicksByFeature,
        clicksByDay,
        topFeatures,
      });
    } catch (error) {
      console.error('Error fetching conversion metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchConversionMetrics();
  }, [fetchConversionMetrics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-64" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const pieData = metrics?.topFeatures.map(f => ({
    name: FEATURE_LABELS[f.feature_key]?.label || f.feature_key,
    value: f.clicks,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Métricas de Conversão
          </h2>
          <p className="text-sm text-muted-foreground">
            Análise de cliques em "Desbloquear com Pro" nos previews bloqueados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchConversionMetrics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Cliques</p>
                <p className="text-3xl font-bold text-foreground">{metrics?.totalClicks || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MousePointerClick className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Usuários Únicos</p>
                <p className="text-3xl font-bold text-foreground">{metrics?.uniqueUsers || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média/Dia</p>
                <p className="text-3xl font-bold text-foreground">
                  {metrics?.clicksByDay.length 
                    ? (metrics.totalClicks / metrics.clicksByDay.length).toFixed(1)
                    : '0'}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clicks Over Time */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Cliques por Dia</CardTitle>
            <CardDescription>Evolução temporal dos cliques em CTAs de upgrade</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.clicksByDay.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.clicksByDay}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar 
                    dataKey="clicks" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Cliques"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Distribution */}
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="text-base">Distribuição por Recurso</CardTitle>
            <CardDescription>Quais recursos geram mais interesse de upgrade</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feature Breakdown */}
      <Card className="card-elevated">
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por Recurso</CardTitle>
          <CardDescription>Ranking de recursos que mais geram interesse de conversão</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.topFeatures.length ? (
            <div className="space-y-4">
              {metrics.topFeatures.map((feature, index) => {
                const featureInfo = FEATURE_LABELS[feature.feature_key];
                const Icon = featureInfo?.icon || Sparkles;
                const color = featureInfo?.color || '#888';
                
                return (
                  <div key={feature.feature_key} className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: color }}>
                      {index + 1}
                    </div>
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${color}20` }}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground">
                          {featureInfo?.label || feature.feature_key}
                        </span>
                        <Badge variant="secondary" className="ml-2">
                          {feature.clicks} cliques
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ 
                            width: `${feature.percentage}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {feature.percentage}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MousePointerClick className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum evento de conversão registrado ainda</p>
              <p className="text-sm">Os cliques em "Desbloquear com Pro" aparecerão aqui</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
