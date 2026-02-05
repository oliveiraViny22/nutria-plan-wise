import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  ReferenceLine,
  Area,
  ComposedChart 
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeightLog {
  id: string;
  weight_kg: number;
  log_date: string;
}

interface WeightEvolutionChartProps {
  logs: WeightLog[];
  targetWeight?: number;
  goal?: 'lose_weight' | 'maintain' | 'gain_muscle';
}

export function WeightEvolutionChart({ logs, targetWeight, goal }: WeightEvolutionChartProps) {
  const chartData = useMemo(() => {
    return logs.map(log => ({
      date: format(new Date(log.log_date), 'dd/MM', { locale: ptBR }),
      fullDate: format(new Date(log.log_date), "dd 'de' MMMM", { locale: ptBR }),
      weight: log.weight_kg,
    }));
  }, [logs]);

  const stats = useMemo(() => {
    if (logs.length < 2) return null;
    
    const sortedLogs = [...logs].sort((a, b) => 
      new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
    );
    
    const first = sortedLogs[0];
    const last = sortedLogs[sortedLogs.length - 1];
    const change = last.weight_kg - first.weight_kg;
    const percentChange = ((change / first.weight_kg) * 100).toFixed(1);
    
    return {
      initial: first.weight_kg,
      current: last.weight_kg,
      change,
      percentChange,
      isPositive: change > 0,
      isNegative: change < 0,
    };
  }, [logs]);

  const getTrendIcon = () => {
    if (!stats) return <Minus className="w-4 h-4" />;
    if (stats.isPositive) return <TrendingUp className="w-4 h-4" />;
    if (stats.isNegative) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (!stats) return 'text-muted-foreground';
    
    // For weight loss goal, negative is good
    if (goal === 'lose_weight') {
      return stats.isNegative ? 'text-success' : stats.isPositive ? 'text-destructive' : 'text-muted-foreground';
    }
    // For muscle gain, positive is good
    if (goal === 'gain_muscle') {
      return stats.isPositive ? 'text-success' : stats.isNegative ? 'text-destructive' : 'text-muted-foreground';
    }
    // For maintenance, any change is neutral
    return 'text-muted-foreground';
  };

  const getGoalLabel = () => {
    switch (goal) {
      case 'lose_weight': return 'Perda de peso';
      case 'gain_muscle': return 'Ganho de massa';
      case 'maintain': return 'Manutenção';
      default: return '';
    }
  };

  if (logs.length === 0) {
    return (
      <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg">
        <CardContent className="py-12 text-center">
          <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum registro de peso</h3>
          <p className="text-muted-foreground text-sm">
            Registre seu peso regularmente para acompanhar sua evolução
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Evolução do Peso
                {goal && (
                  <Badge variant="secondary" className="text-xs font-normal">
                    {getGoalLabel()}
                  </Badge>
                )}
              </CardTitle>
              {stats && (
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span className={getTrendColor()}>
                    {getTrendIcon()}
                  </span>
                  <span className={getTrendColor()}>
                    {stats.change > 0 ? '+' : ''}{stats.change.toFixed(1)} kg ({stats.percentChange}%)
                  </span>
                  <span className="text-muted-foreground">desde o início</span>
                </CardDescription>
              )}
            </div>
            {stats && (
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums">{stats.current.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">kg atual</p>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {chartData.length > 1 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <defs>
                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
                    width={45}
                    tickFormatter={(value) => `${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Peso']}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                  />
                  {targetWeight && (
                    <ReferenceLine 
                      y={targetWeight} 
                      stroke="hsl(var(--accent))" 
                      strokeDasharray="5 5"
                      label={{ value: 'Meta', position: 'right', fill: 'hsl(var(--accent))' }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="transparent"
                    fill="url(#weightGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">
                Registre mais medições para ver o gráfico de evolução
              </p>
            </div>
          )}
          
          {/* Before/After comparison */}
          {stats && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Peso Inicial</p>
                  <p className="text-lg font-semibold tabular-nums">{stats.initial.toFixed(1)} kg</p>
                </div>
                <div className="flex flex-col items-center justify-center">
                  <div className={`p-2 rounded-full ${getTrendColor()} bg-current/10`}>
                    {getTrendIcon()}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso Atual</p>
                  <p className="text-lg font-semibold tabular-nums">{stats.current.toFixed(1)} kg</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}