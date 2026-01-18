import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart3,
  TrendingUp,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  PieChart,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  PieChart as RechartsPieChart,
  Pie,
  Legend,
} from 'recharts';

interface AdherenceDashboardProps {
  studentId: string;
  dietPlanId: string;
}

interface AdherenceReport {
  executiveSummary: string;
  overallAdherenceRate: number;
  totalDays: number;
  daysWithRecords: number;
  mealAdherence: {
    [mealName: string]: {
      total: number;
      confirmed: number;
      rate: number;
    };
  };
  optionComparison: {
    [optionId: string]: {
      meal: string;
      optionNumber: number;
      timesSelected: number;
    };
  };
  exceptionStates: {
    skipped: number;
    outOfPlan: number;
    lateConfirmed: number;
  };
  recommendations: string[];
  periodStart: string;
  periodEnd: string;
}

const mealChartConfig: ChartConfig = {
  rate: {
    label: "Adesão %",
    color: "hsl(var(--primary))",
  },
};

const exceptionChartConfig: ChartConfig = {
  skipped: {
    label: "Puladas",
    color: "hsl(var(--destructive))",
  },
  outOfPlan: {
    label: "Fora do Plano",
    color: "hsl(var(--warning, 38 92% 50%))",
  },
  lateConfirmed: {
    label: "Atrasadas",
    color: "hsl(var(--muted-foreground))",
  },
};

export function AdherenceDashboard({ studentId, dietPlanId }: AdherenceDashboardProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AdherenceReport | null>(null);
  const [period, setPeriod] = useState('7'); // days
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchAdherenceReport = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      const { data, error } = await supabase.functions.invoke('adherence-report', {
        body: {
          studentId,
          dietPlanId,
          periodStart: startDate.toISOString().split('T')[0],
          periodEnd: endDate.toISOString().split('T')[0],
        },
      });

      if (error) throw error;

      setReport(data);
    } catch (error: any) {
      console.error('Error fetching adherence report:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o relatório de adesão.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentId && dietPlanId) {
      fetchAdherenceReport();
    }
  }, [studentId, dietPlanId, period]);

  const getAdherenceColor = (rate: number) => {
    if (rate >= 80) return 'text-green-500';
    if (rate >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getAdherenceBadge = (rate: number) => {
    if (rate >= 80) return { variant: 'default' as const, label: 'Excelente' };
    if (rate >= 60) return { variant: 'secondary' as const, label: 'Regular' };
    return { variant: 'destructive' as const, label: 'Baixa' };
  };

  const mealChartData = report?.mealAdherence
    ? Object.entries(report.mealAdherence).map(([name, data]) => ({
        name: name.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()),
        rate: data.rate,
        confirmed: data.confirmed,
        total: data.total,
      }))
    : [];

  const exceptionChartData = report?.exceptionStates
    ? [
        { name: 'Puladas', value: report.exceptionStates.skipped, fill: 'hsl(var(--destructive))' },
        { name: 'Fora do Plano', value: report.exceptionStates.outOfPlan, fill: 'hsl(38, 92%, 50%)' },
        { name: 'Atrasadas', value: report.exceptionStates.lateConfirmed, fill: 'hsl(var(--muted-foreground))' },
      ].filter(item => item.value > 0)
    : [];

  const optionChartData = report?.optionComparison
    ? Object.values(report.optionComparison)
        .reduce((acc, opt) => {
          const existingMeal = acc.find(m => m.meal === opt.meal);
          if (existingMeal) {
            existingMeal[`opt${opt.optionNumber}`] = opt.timesSelected;
          } else {
            acc.push({
              meal: opt.meal,
              [`opt${opt.optionNumber}`]: opt.timesSelected,
            });
          }
          return acc;
        }, [] as any[])
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <Card className="card-elevated">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Dashboard de Adesão
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="14">14 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="60">60 dias</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={fetchAdherenceReport}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="space-y-6">
              {loading && !report ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !report ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    Nenhum dado de adesão disponível ainda.
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    O aluno precisa registrar consumo das refeições.
                  </p>
                </div>
              ) : (
                <>
                  {/* Executive Summary */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Resumo Executivo
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {report.executiveSummary}
                    </p>
                  </div>

                  {/* Overall Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl sm:text-3xl font-bold ${getAdherenceColor(report.overallAdherenceRate)}`}>
                          {report.overallAdherenceRate.toFixed(0)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Adesão Geral</p>
                        <Badge 
                          variant={getAdherenceBadge(report.overallAdherenceRate).variant}
                          className="mt-2 text-[10px]"
                        >
                          {getAdherenceBadge(report.overallAdherenceRate).label}
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-primary">
                          {report.daysWithRecords}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          de {report.totalDays} dias
                        </p>
                        <Progress 
                          value={(report.daysWithRecords / report.totalDays) * 100} 
                          className="mt-2 h-1.5"
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-green-500">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="text-2xl sm:text-3xl font-bold">
                            {Object.values(report.mealAdherence).reduce((sum, m) => sum + m.confirmed, 0)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Confirmadas</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1 text-destructive">
                          <XCircle className="h-5 w-5" />
                          <span className="text-2xl sm:text-3xl font-bold">
                            {report.exceptionStates.skipped}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Puladas</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Meal Adherence Chart */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          Adesão por Refeição
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {mealChartData.length > 0 ? (
                          <ChartContainer config={mealChartConfig} className="h-[200px] w-full">
                            <BarChart data={mealChartData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                              <XAxis 
                                type="number" 
                                domain={[0, 100]} 
                                tickFormatter={(v) => `${v}%`}
                                fontSize={11}
                              />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={80}
                                fontSize={11}
                                tickLine={false}
                              />
                              <ChartTooltip 
                                content={<ChartTooltipContent />}
                                formatter={(value, name, props) => [
                                  `${value}% (${props.payload.confirmed}/${props.payload.total})`,
                                  'Adesão'
                                ]}
                              />
                              <Bar 
                                dataKey="rate" 
                                radius={[0, 4, 4, 0]}
                              >
                                {mealChartData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`}
                                    fill={
                                      entry.rate >= 80 
                                        ? 'hsl(142, 71%, 45%)' 
                                        : entry.rate >= 60 
                                          ? 'hsl(48, 96%, 53%)' 
                                          : 'hsl(var(--destructive))'
                                    }
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ChartContainer>
                        ) : (
                          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                            Sem dados de refeições
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Exception Distribution */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <PieChart className="h-4 w-4" />
                          Exceções
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {exceptionChartData.length > 0 ? (
                          <ChartContainer config={exceptionChartConfig} className="h-[200px] w-full">
                            <RechartsPieChart>
                              <Pie
                                data={exceptionChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, value }) => `${name}: ${value}`}
                                labelLine={false}
                              >
                                {exceptionChartData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                              </Pie>
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                formatter={(value) => <span className="text-xs">{value}</span>}
                              />
                            </RechartsPieChart>
                          </ChartContainer>
                        ) : (
                          <div className="h-[200px] flex flex-col items-center justify-center text-green-500">
                            <CheckCircle2 className="h-12 w-12 mb-2" />
                            <p className="text-sm font-medium">Sem exceções!</p>
                            <p className="text-xs text-muted-foreground">
                              Todas as refeições foram confirmadas
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Option Comparison */}
                  {Object.keys(report.optionComparison || {}).length > 0 && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Comparativo de Opções por Refeição
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {Object.entries(
                            Object.values(report.optionComparison).reduce((acc, opt) => {
                              if (!acc[opt.meal]) acc[opt.meal] = [];
                              acc[opt.meal].push(opt);
                              return acc;
                            }, {} as Record<string, typeof report.optionComparison[string][]>)
                          ).map(([meal, options]) => {
                            const totalSelections = options.reduce((sum, o) => sum + o.timesSelected, 0);
                            return (
                              <div key={meal} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium capitalize">
                                    {meal.replace('_', ' ')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {totalSelections} seleções
                                  </span>
                                </div>
                                <div className="flex gap-1 h-4 rounded-full overflow-hidden bg-muted">
                                  {options
                                    .sort((a, b) => a.optionNumber - b.optionNumber)
                                    .map((opt, idx) => {
                                      const percentage = totalSelections > 0 
                                        ? (opt.timesSelected / totalSelections) * 100 
                                        : 0;
                                      const colors = [
                                        'bg-primary',
                                        'bg-blue-500',
                                        'bg-emerald-500',
                                        'bg-amber-500',
                                      ];
                                      return (
                                        <div
                                          key={opt.optionNumber}
                                          className={`${colors[idx % colors.length]} relative group`}
                                          style={{ width: `${percentage}%` }}
                                          title={`Opção ${opt.optionNumber}: ${opt.timesSelected} (${percentage.toFixed(0)}%)`}
                                        />
                                      );
                                    })}
                                </div>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  {options
                                    .sort((a, b) => a.optionNumber - b.optionNumber)
                                    .map((opt, idx) => {
                                      const colors = [
                                        'bg-primary',
                                        'bg-blue-500',
                                        'bg-emerald-500',
                                        'bg-amber-500',
                                      ];
                                      return (
                                        <div key={opt.optionNumber} className="flex items-center gap-1">
                                          <div className={`w-2 h-2 rounded-full ${colors[idx % colors.length]}`} />
                                          <span>Op. {opt.optionNumber}: {opt.timesSelected}</span>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Recommendations */}
                  {report.recommendations && report.recommendations.length > 0 && (
                    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="h-4 w-4" />
                          Recomendações
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {report.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-amber-600 dark:text-amber-400 font-medium">•</span>
                              <span className="text-muted-foreground">{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Period Info */}
                  <div className="text-center text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 inline-block mr-1" />
                    Período: {new Date(report.periodStart).toLocaleDateString('pt-BR')} - {new Date(report.periodEnd).toLocaleDateString('pt-BR')}
                  </div>
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </motion.div>
  );
}
