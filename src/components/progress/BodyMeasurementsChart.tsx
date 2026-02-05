import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Ruler, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  Area,
  ComposedChart 
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BodyMeasurement {
  id: string;
  measurement_date: string;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  body_fat_percent: number | null;
}

interface BodyMeasurementsChartProps {
  measurements: BodyMeasurement[];
}

type MeasurementKey = 'waist_cm' | 'hip_cm' | 'chest_cm' | 'arm_cm' | 'thigh_cm' | 'calf_cm' | 'body_fat_percent';

const measurementLabels: Record<MeasurementKey, string> = {
  waist_cm: 'Cintura',
  hip_cm: 'Quadril',
  chest_cm: 'Peitoral',
  arm_cm: 'Braço',
  thigh_cm: 'Coxa',
  calf_cm: 'Panturrilha',
  body_fat_percent: '% Gordura',
};

const measurementUnits: Record<MeasurementKey, string> = {
  waist_cm: 'cm',
  hip_cm: 'cm',
  chest_cm: 'cm',
  arm_cm: 'cm',
  thigh_cm: 'cm',
  calf_cm: 'cm',
  body_fat_percent: '%',
};

export function BodyMeasurementsChart({ measurements }: BodyMeasurementsChartProps) {
  const sortedMeasurements = useMemo(() => {
    return [...measurements].sort((a, b) => 
      new Date(a.measurement_date).getTime() - new Date(b.measurement_date).getTime()
    );
  }, [measurements]);

  const availableMetrics = useMemo(() => {
    const metrics: MeasurementKey[] = [];
    const keys: MeasurementKey[] = ['waist_cm', 'hip_cm', 'chest_cm', 'arm_cm', 'thigh_cm', 'calf_cm', 'body_fat_percent'];
    
    keys.forEach(key => {
      if (sortedMeasurements.some(m => m[key] !== null)) {
        metrics.push(key);
      }
    });
    
    return metrics;
  }, [sortedMeasurements]);

  const getChartData = (metric: MeasurementKey) => {
    return sortedMeasurements
      .filter(m => m[metric] !== null)
      .map(m => ({
        date: format(new Date(m.measurement_date), 'dd/MM', { locale: ptBR }),
        fullDate: format(new Date(m.measurement_date), "dd 'de' MMMM", { locale: ptBR }),
        value: m[metric] as number,
      }));
  };

  const getStats = (metric: MeasurementKey) => {
    const data = sortedMeasurements.filter(m => m[metric] !== null);
    if (data.length < 2) return null;
    
    const first = data[0][metric] as number;
    const last = data[data.length - 1][metric] as number;
    const change = last - first;
    const percentChange = ((change / first) * 100).toFixed(1);
    
    return {
      initial: first,
      current: last,
      change,
      percentChange,
      isPositive: change > 0,
      isNegative: change < 0,
    };
  };

  const getTrendIcon = (stats: ReturnType<typeof getStats>) => {
    if (!stats) return <Minus className="w-3 h-3" />;
    if (stats.isPositive) return <TrendingUp className="w-3 h-3" />;
    if (stats.isNegative) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  if (measurements.length === 0) {
    return (
      <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg">
        <CardContent className="py-12 text-center">
          <Ruler className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhuma medida registrada</h3>
          <p className="text-muted-foreground text-sm">
            Registre as medidas corporais para acompanhar a evolução
          </p>
        </CardContent>
      </Card>
    );
  }

  if (availableMetrics.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" />
            Medidas Corporais
          </CardTitle>
          <CardDescription>
            Evolução das medidas ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={availableMetrics[0]} className="space-y-4">
            <TabsList className="flex flex-wrap h-auto gap-1">
              {availableMetrics.map(metric => {
                const stats = getStats(metric);
                return (
                  <TabsTrigger 
                    key={metric} 
                    value={metric}
                    className="text-xs px-2 py-1.5 flex items-center gap-1"
                  >
                    {measurementLabels[metric]}
                    {stats && (
                      <span className={stats.isNegative ? 'text-success' : stats.isPositive ? 'text-destructive' : ''}>
                        {getTrendIcon(stats)}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            
            {availableMetrics.map(metric => {
              const chartData = getChartData(metric);
              const stats = getStats(metric);
              
              return (
                <TabsContent key={metric} value={metric} className="space-y-4">
                  {stats && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={stats.isNegative ? 'default' : stats.isPositive ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {stats.change > 0 ? '+' : ''}{stats.change.toFixed(1)} {measurementUnits[metric]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({stats.percentChange}%) desde o início
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums">
                          {stats.current.toFixed(1)} {measurementUnits[metric]}
                        </p>
                        <p className="text-xs text-muted-foreground">atual</p>
                      </div>
                    </div>
                  )}
                  
                  {chartData.length > 1 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <defs>
                            <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis 
                            dataKey="date" 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                          />
                          <YAxis 
                            stroke="hsl(var(--muted-foreground))"
                            fontSize={11}
                            tickLine={false}
                            domain={['dataMin - 2', 'dataMax + 2']}
                            width={35}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [
                              `${value.toFixed(1)} ${measurementUnits[metric]}`, 
                              measurementLabels[metric]
                            ]}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || ''}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="transparent"
                            fill={`url(#gradient-${metric})`}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground text-sm">
                        Registre mais medições para ver o gráfico de evolução
                      </p>
                    </div>
                  )}
                  
                  {/* Before/After comparison */}
                  {stats && (
                    <div className="pt-3 border-t border-border/50">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Inicial</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {stats.initial.toFixed(1)} {measurementUnits[metric]}
                          </p>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <div className={`p-1.5 rounded-full ${
                            stats.isNegative ? 'text-success bg-success/10' : 
                            stats.isPositive ? 'text-destructive bg-destructive/10' : 
                            'text-muted-foreground bg-muted'
                          }`}>
                            {getTrendIcon(stats)}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Atual</p>
                          <p className="text-sm font-semibold tabular-nums">
                            {stats.current.toFixed(1)} {measurementUnits[metric]}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>
    </motion.div>
  );
}
