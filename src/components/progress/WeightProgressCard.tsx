import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scale, 
  Target, 
  Plus, 
  Check, 
  X, 
  Loader2, 
  CalendarIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInWeeks, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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

interface WeightLog {
  id: string;
  weight_kg: number;
  log_date: string;
}

interface WeightProgressCardProps {
  userId: string;
  currentWeight: number;
  targetWeight: number;
  goal?: 'lose_weight' | 'maintain' | 'gain_muscle';
  logs: WeightLog[];
  onUpdate: () => void;
}

export function WeightProgressCard({ 
  userId, 
  currentWeight, 
  targetWeight, 
  goal,
  logs,
  onUpdate 
}: WeightProgressCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [weight, setWeight] = useState(currentWeight?.toFixed(1) || '');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Calculate progress
  const sortedLogs = [...logs].sort((a, b) => 
    new Date(a.log_date).getTime() - new Date(b.log_date).getTime()
  );
  
  const firstLog = sortedLogs[0];
  const latestLog = sortedLogs[sortedLogs.length - 1];
  const totalChange = firstLog && latestLog 
    ? latestLog.weight_kg - firstLog.weight_kg 
    : 0;
  
  const progressToGoal = firstLog 
    ? ((firstLog.weight_kg - currentWeight) / (firstLog.weight_kg - targetWeight)) * 100
    : 0;

  const getTrendIcon = () => {
    if (totalChange > 0.5) return <TrendingUp className="h-4 w-4 text-success" />;
    if (totalChange < -0.5) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (goal === 'lose_weight') {
      return totalChange < 0 ? 'text-success' : 'text-destructive';
    }
    if (goal === 'gain_muscle') {
      return totalChange > 0 ? 'text-success' : 'text-destructive';
    }
    return 'text-muted-foreground';
  };

  // Determine chart interval based on date range
  const getChartInterval = () => {
    if (sortedLogs.length < 2) return 'daily';
    const firstDate = new Date(sortedLogs[0].log_date);
    const lastDate = new Date(sortedLogs[sortedLogs.length - 1].log_date);
    const daysDiff = differenceInDays(lastDate, firstDate);
    
    if (daysDiff > 60) return 'monthly';
    if (daysDiff > 14) return 'weekly';
    return 'daily';
  };

  const chartInterval = getChartInterval();

  // Group logs by week for cleaner visualization
  const getWeeklyChartData = () => {
    if (sortedLogs.length === 0) return [];
    
    const firstDate = new Date(sortedLogs[0].log_date);
    const lastDate = new Date(sortedLogs[sortedLogs.length - 1].log_date);
    
    // Get all weeks in the range
    const weeks = eachWeekOfInterval(
      { start: firstDate, end: lastDate },
      { weekStartsOn: 1 }
    );

    return weeks.map((weekStart, index) => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // Find all logs in this week
      const logsInWeek = sortedLogs.filter(log => {
        const logDate = new Date(log.log_date);
        return isWithinInterval(logDate, { start: weekStart, end: weekEnd });
      });

      // Use the last log of the week (most recent) or null
      const weekLog = logsInWeek.length > 0 
        ? logsInWeek[logsInWeek.length - 1] 
        : null;

      return {
        weekLabel: `Sem ${index + 1}`,
        dateLabel: format(weekStart, "dd/MM", { locale: ptBR }),
        fullDate: format(weekStart, "'Semana de' dd 'de' MMM", { locale: ptBR }),
        weight: weekLog?.weight_kg || null,
        hasData: !!weekLog,
      };
    }).filter(week => week.weight !== null); // Only show weeks with data
  };

  // Chart data - use weekly aggregation for cleaner view
  const chartData = sortedLogs.length <= 7 
    ? sortedLogs.map((log, index) => ({
        dateLabel: format(new Date(log.log_date), 'dd/MM', { locale: ptBR }),
        fullDate: format(new Date(log.log_date), "dd 'de' MMM, yyyy", { locale: ptBR }),
        weight: log.weight_kg,
        isFirst: index === 0,
        isLast: index === sortedLogs.length - 1,
      }))
    : getWeeklyChartData();

  const handleSubmit = async () => {
    const weightValue = parseFloat(weight);
    
    if (isNaN(weightValue) || weightValue < 20 || weightValue > 500) {
      toast.error('Peso inválido (20-500 kg)');
      return;
    }

    setLoading(true);
    try {
      const logDate = format(selectedDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('weight_logs')
        .upsert({
          user_id: userId,
          weight_kg: weightValue,
          log_date: logDate,
        }, {
          onConflict: 'user_id,log_date'
        });

      if (error) throw error;

      const isToday = format(new Date(), 'yyyy-MM-dd') === logDate;
      if (isToday) {
        await supabase
          .from('profiles')
          .update({ weight: weightValue })
          .eq('user_id', userId);
      }

      toast.success(`${weightValue.toFixed(1)} kg registrado!`);
      setIsFormOpen(false);
      setSelectedDate(new Date());
      onUpdate();
    } catch (error) {
      console.error('Error logging weight:', error);
      toast.error('Erro ao registrar peso');
    } finally {
      setLoading(false);
    }
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,1}$/.test(value)) {
      setWeight(value);
    }
  };

  // Timeline logs (most recent first, limited)
  const timelineLogs = [...sortedLogs].reverse();
  const displayedLogs = showAllLogs ? timelineLogs : timelineLogs.slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Hero Card - Centralized */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-card via-card to-primary/5 border-border/40 shadow-xl overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          {/* Main Stats - Centered */}
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Current Weight - Hero */}
            <div className="space-y-2">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
                <Scale className="h-10 w-10 text-primary" />
              </div>
              <motion.p 
                key={currentWeight}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight"
              >
                {currentWeight.toFixed(1)}
                <span className="text-2xl font-normal text-muted-foreground ml-1">kg</span>
              </motion.p>
              <p className="text-sm text-muted-foreground">Peso Atual</p>
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {/* Target */}
              {goal && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Target className="h-4 w-4 text-accent" />
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">{targetWeight.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">Meta (kg)</p>
                </div>
              )}

              {/* Difference */}
              {goal && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {getTrendIcon()}
                  </div>
                  <p className={cn("text-2xl font-semibold tabular-nums", getTrendColor())}>
                    {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Variação (kg)</p>
                </div>
              )}

              {/* Days Tracked */}
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-2xl font-semibold tabular-nums">{logs.length}</p>
                <p className="text-xs text-muted-foreground">Registros</p>
              </div>
            </div>

            {/* Register Button / Form */}
            <AnimatePresence mode="wait">
              {!isFormOpen ? (
                <motion.div
                  key="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  <Button
                    size="lg"
                    onClick={() => {
                      setWeight(currentWeight?.toFixed(1) || '');
                      setSelectedDate(new Date());
                      setIsFormOpen(true);
                    }}
                    className="gap-2 shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    Registrar Peso
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-sm"
                >
                  <Card className="border-primary/30 shadow-lg bg-card/95">
                    <CardContent className="p-4 space-y-3">
                      {/* Date Picker */}
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? (
                              format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })
                            ) : (
                              <span>Selecione a data</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => {
                              if (date) {
                                setSelectedDate(date);
                                setCalendarOpen(false);
                              }
                            }}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            locale={ptBR}
                          />
                        </PopoverContent>
                      </Popover>

                      {/* Weight Input */}
                      <div className="flex items-center gap-3">
                        <Scale className="w-5 h-5 text-primary flex-shrink-0" />
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="Peso"
                          value={weight}
                          onChange={handleWeightChange}
                          className="flex-1 text-center text-lg font-semibold"
                          autoFocus
                        />
                        <span className="text-sm text-muted-foreground font-medium">kg</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setIsFormOpen(false)}
                          disabled={loading}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={handleSubmit}
                          disabled={loading || !weight}
                        >
                          {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Check className="w-4 h-4 mr-2" />
                          )}
                          Salvar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Chart with Timeline */}
      {logs.length > 0 && (
        <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Evolução do Peso
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {chartInterval === 'weekly' 
                    ? 'Visualização semanal • Registre semanalmente para melhor acompanhamento'
                    : chartInterval === 'monthly'
                    ? 'Visualização mensal'
                    : 'Desde o primeiro registro'}
                </p>
              </div>
              {logs.length >= 2 && (
                <Badge variant="outline" className={cn("text-xs self-start sm:self-auto", getTrendColor())}>
                  {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg desde o início
                </Badge>
              )}
            </div>

            {logs.length >= 2 ? (
              <div className="h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="dateLabel" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 2', 'dataMax + 2']}
                      width={40}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Peso']}
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
                    />
                    {/* Start weight reference line */}
                    {firstLog && (
                      <ReferenceLine 
                        y={firstLog.weight_kg} 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeDasharray="3 3"
                        strokeOpacity={0.5}
                        label={{ 
                          value: 'Início', 
                          position: 'left',
                          fill: 'hsl(var(--muted-foreground))',
                          fontSize: 10
                        }}
                      />
                    )}
                    {goal && (
                      <ReferenceLine 
                        y={targetWeight} 
                        stroke="hsl(var(--accent))" 
                        strokeDasharray="5 5"
                        label={{ 
                          value: 'Meta', 
                          position: 'right',
                          fill: 'hsl(var(--accent))',
                          fontSize: 11
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="weight"
                      stroke="transparent"
                      fill="url(#weightGradient)"
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, strokeWidth: 0 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex flex-col items-center justify-center text-center px-4">
                <Scale className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Registre seu peso semanalmente para acompanhar sua evolução
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O gráfico aparecerá após o segundo registro
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="mt-6 pt-4 border-t border-border/40">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">Histórico</h4>
              <div className="space-y-2">
                {displayedLogs.map((log, index) => {
                  const prevLog = timelineLogs[index + 1];
                  const diff = prevLog ? log.weight_kg - prevLog.weight_kg : 0;
                  
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-sm font-medium">
                          {format(new Date(log.log_date), "dd 'de' MMM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {log.weight_kg.toFixed(1)} kg
                        </span>
                        {diff !== 0 && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs tabular-nums",
                              diff > 0 ? 'text-success border-success/30' : 'text-destructive border-destructive/30'
                            )}
                          >
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              
              {timelineLogs.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setShowAllLogs(!showAllLogs)}
                >
                  {showAllLogs ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver todos ({timelineLogs.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}