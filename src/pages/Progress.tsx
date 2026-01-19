import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Scale,
  TrendingUp,
  TrendingDown,
  Calendar,
  History,
  Target,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

interface DailyLogEntry {
  id: string;
  log_date: string;
  status: 'no_records' | 'partial' | 'complete';
  total_calories_consumed: number;
  total_protein_consumed: number;
  total_carbs_consumed: number;
  total_fat_consumed: number;
}

export default function Progress() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [dailyLogs, setDailyLogs] = useState<DailyLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch daily logs for the last 30 days
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString().split('T')[0];
      
      const { data: logs, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user?.id)
        .gte('log_date', thirtyDaysAgo)
        .order('log_date', { ascending: true });

      if (logsError) throw logsError;
      setDailyLogs((logs || []) as DailyLogEntry[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const currentWeight = profile?.weight || 0;
  const targetCalories = profile?.daily_calories || 2000;
  
  // Calculate adherence stats
  const completeDays = dailyLogs.filter(l => l.status === 'complete').length;
  const partialDays = dailyLogs.filter(l => l.status === 'partial').length;
  const totalTrackedDays = dailyLogs.length;
  const adherenceRate = totalTrackedDays > 0 ? Math.round((completeDays / totalTrackedDays) * 100) : 0;

  // Average calories consumed
  const avgCalories = dailyLogs.length > 0 
    ? Math.round(dailyLogs.reduce((sum, l) => sum + (l.total_calories_consumed || 0), 0) / dailyLogs.length)
    : 0;

  // Chart data - calories over time
  const chartData = dailyLogs.map(log => ({
    date: format(new Date(log.log_date), 'dd/MM', { locale: ptBR }),
    calories: log.total_calories_consumed || 0,
  }));

  // Goal weight (estimated based on goal)
  const goal = profile?.goal;
  const goalWeight = goal === 'lose_weight'
    ? (profile?.weight || 70) - 5
    : goal === 'gain_muscle'
    ? (profile?.weight || 70) + 3
    : profile?.weight || 70;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete':
        return 'Completo';
      case 'partial':
        return 'Parcial';
      default:
        return 'Sem registros';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold">Progresso</h1>
          <div className="w-9 sm:w-10" />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Tabs defaultValue="adherence" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="adherence" className="text-xs sm:text-sm py-2 sm:py-2.5">
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Adesão
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm py-2 sm:py-2.5">
              <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Adherence Tab */}
          <TabsContent value="adherence" className="space-y-4 sm:space-y-6">
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
            >
              <Card>
                <CardContent className="pt-3 sm:pt-4 text-center p-3 sm:p-4">
                  <Scale className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-primary mb-1 sm:mb-2" />
                  <p className="text-lg sm:text-2xl font-bold">{currentWeight.toFixed(1)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Peso Atual</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 text-center p-3 sm:p-4">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-accent mb-1 sm:mb-2" />
                  <p className="text-lg sm:text-2xl font-bold">{adherenceRate}%</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Adesão</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 text-center p-3 sm:p-4">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-green-500 mb-1 sm:mb-2" />
                  <p className="text-lg sm:text-2xl font-bold">{completeDays}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Dias Completos</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 text-center p-3 sm:p-4">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-muted-foreground mb-1 sm:mb-2" />
                  <p className="text-lg sm:text-2xl font-bold">{totalTrackedDays}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Dias Rastreados</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Calories Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calorias Consumidas</CardTitle>
                  <CardDescription>
                    Média: {avgCalories} kcal/dia (Meta: {targetCalories} kcal)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length > 1 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={12}
                            tickLine={false}
                            domain={[0, 'dataMax + 500']}
                            width={45}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [`${value} kcal`, 'Calorias']}
                          />
                          <ReferenceLine 
                            y={targetCalories} 
                            stroke="hsl(var(--primary))" 
                            strokeDasharray="5 5"
                            label={{ value: 'Meta', position: 'right', fill: 'hsl(var(--primary))' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="calories"
                            stroke="hsl(var(--accent))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-center">
                      <div>
                        <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">
                          Registre suas refeições para ver sua evolução
                        </p>
                        <Button onClick={() => navigate('/daily-log')}>
                          Ir para Registro Diário
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {dailyLogs.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum registro encontrado</h3>
                    <p className="text-muted-foreground mb-4">
                      Comece a registrar suas refeições para acompanhar seu progresso
                    </p>
                    <Button onClick={() => navigate('/daily-log')}>
                      Registrar Hoje
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Histórico de Registros</CardTitle>
                    <CardDescription>Últimos 30 dias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {dailyLogs.slice().reverse().map((log) => (
                        <div 
                          key={log.id} 
                          className="flex items-center justify-between py-3 border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            {getStatusIcon(log.status)}
                            <div>
                              <p className="font-medium text-sm">
                                {format(new Date(log.log_date), "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {log.total_calories_consumed || 0} kcal consumidas
                              </p>
                            </div>
                          </div>
                          <Badge 
                            variant={log.status === 'complete' ? 'default' : log.status === 'partial' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {getStatusLabel(log.status)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
