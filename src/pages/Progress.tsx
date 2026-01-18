import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Scale,
  TrendingUp,
  TrendingDown,
  Calendar,
  Plus,
  History,
  Target,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, subDays, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

interface WeightLog {
  id: string;
  weight: number;
  logged_at: string;
  notes: string | null;
}

interface PlanHistoryItem {
  id: string;
  action: string;
  description: string;
  previous_values: any;
  new_values: any;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  created: 'Plano criado',
  updated: 'Plano atualizado',
  meal_changed: 'Refeição alterada',
  food_substituted: 'Alimento substituído',
  rebalanced: 'Macros rebalanceados',
  goal_changed: 'Objetivo alterado',
};

export default function Progress() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [planHistory, setPlanHistory] = useState<PlanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWeight, setNewWeight] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [addingWeight, setAddingWeight] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch weight logs
      const { data: weights, error: weightsError } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', user?.id)
        .order('logged_at', { ascending: true })
        .limit(90); // Last 90 days

      if (weightsError) throw weightsError;
      setWeightLogs(weights || []);

      // Fetch plan history
      const { data: history, error: historyError } = await supabase
        .from('plan_history')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (historyError) throw historyError;
      setPlanHistory(history || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWeight = async () => {
    if (!user || !newWeight) return;
    
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 20 || weight > 400) {
      toast.error('Peso inválido');
      return;
    }

    setAddingWeight(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase.from('weight_logs').upsert({
        user_id: user.id,
        weight,
        logged_at: today,
      }, { onConflict: 'user_id,logged_at' });

      if (error) throw error;

      // Update profile weight
      await supabase.from('profiles').update({ weight }).eq('user_id', user.id);

      toast.success('Peso registrado!');
      setNewWeight('');
      setIsAddDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error adding weight:', error);
      toast.error('Erro ao registrar peso');
    } finally {
      setAddingWeight(false);
    }
  };

  // Calculate stats
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : profile?.weight || 0;
  const startWeight = weightLogs.length > 0 ? weightLogs[0].weight : profile?.weight || 0;
  const totalChange = currentWeight - startWeight;
  const daysTracking = weightLogs.length > 1 
    ? differenceInDays(new Date(weightLogs[weightLogs.length - 1].logged_at), new Date(weightLogs[0].logged_at))
    : 0;
  
  // Last 7 days change
  const weekAgoIndex = weightLogs.findIndex(w => 
    differenceInDays(new Date(), new Date(w.logged_at)) <= 7
  );
  const weekChange = weekAgoIndex >= 0 && weightLogs.length > weekAgoIndex
    ? currentWeight - weightLogs[weekAgoIndex].weight
    : 0;

  // Chart data
  const chartData = weightLogs.map(log => ({
    date: format(new Date(log.logged_at), 'dd/MM', { locale: ptBR }),
    weight: log.weight,
  }));

  // Goal weight (estimated based on goal)
  const goalWeight = profile?.goal === 'lose_weight' 
    ? (profile?.weight || 70) - 5
    : profile?.goal === 'gain_muscle'
    ? (profile?.weight || 70) + 3
    : profile?.weight || 70;

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
            <Button variant="ghost" size="icon" className="w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold">Progresso</h1>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
                <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden xs:inline">Peso</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 sm:mx-0 max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Registrar Peso</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Adicione seu peso de hoje para acompanhar sua evolução
                </DialogDescription>
              </DialogHeader>
              <div className="py-3 sm:py-4">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="20"
                    max="400"
                    placeholder="70.5"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="text-base sm:text-lg h-10 sm:h-12"
                  />
                  <span className="text-muted-foreground text-sm">kg</span>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" size="sm" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleAddWeight} disabled={addingWeight || !newWeight}>
                  {addingWeight ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <Tabs defaultValue="weight" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="weight" className="text-xs sm:text-sm py-2 sm:py-2.5">
              <Scale className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Peso
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm py-2 sm:py-2.5">
              <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          {/* Weight Tab */}
          <TabsContent value="weight" className="space-y-4 sm:space-y-6">
            {/* Stats Cards - 2x2 grid on mobile, 4 columns on tablet+ */}
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
                  <p className="text-lg sm:text-2xl font-bold">{goalWeight.toFixed(1)}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Meta</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 text-center p-3 sm:p-4">
                  {totalChange <= 0 ? (
                    <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-primary mb-1 sm:mb-2" />
                  ) : (
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-destructive mb-1 sm:mb-2" />
                  )}
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-3 sm:pt-4 text-center p-3 sm:p-4">
                  <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-muted-foreground mb-1 sm:mb-2" />
                  <p className="text-lg sm:text-2xl font-bold">{daysTracking}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Dias</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Weight Chart */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Evolução do Peso</CardTitle>
                  <CardDescription>
                    {weekChange !== 0 && (
                      <span className={weekChange < 0 ? 'text-primary' : 'text-destructive'}>
                        {weekChange > 0 ? '+' : ''}{weekChange.toFixed(1)}kg esta semana
                      </span>
                    )}
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
                            domain={['dataMin - 2', 'dataMax + 2']}
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Peso']}
                          />
                          <ReferenceLine 
                            y={goalWeight} 
                            stroke="hsl(var(--accent))" 
                            strokeDasharray="5 5"
                            label={{ value: 'Meta', position: 'right', fill: 'hsl(var(--accent))' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="weight"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-center">
                      <div>
                        <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">
                          Registre seu peso regularmente para ver sua evolução
                        </p>
                        <Button onClick={() => setIsAddDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Registrar Peso
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Weights */}
            {weightLogs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Registros Recentes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {weightLogs.slice(-10).reverse().map((log, index) => {
                        const prevWeight = index < weightLogs.length - 1 
                          ? weightLogs[weightLogs.length - 2 - index]?.weight 
                          : log.weight;
                        const change = log.weight - prevWeight;
                        
                        return (
                          <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(log.logged_at), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              <span className="font-medium">{log.weight.toFixed(1)} kg</span>
                            </div>
                            {change !== 0 && index > 0 && (
                              <Badge variant={change < 0 ? 'default' : 'destructive'} className="text-xs">
                                {change > 0 ? '+' : ''}{change.toFixed(1)}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {planHistory.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma alteração registrada</h3>
                    <p className="text-muted-foreground">
                      As alterações no seu plano alimentar aparecerão aqui
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {planHistory.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="card-interactive">
                        <CardContent className="py-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              {item.action === 'goal_changed' ? (
                                <Target className="h-5 w-5 text-primary" />
                              ) : item.action === 'food_substituted' ? (
                                <Minus className="h-5 w-5 text-primary" />
                              ) : (
                                <History className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {ACTION_LABELS[item.action] || item.action}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                              <p className="text-sm mt-1">{item.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
