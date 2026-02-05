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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Hero Card - Compact */}
      <Card className="backdrop-blur-md bg-gradient-to-br from-card via-card to-primary/5 border-border/40 shadow-lg overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {/* Main Stats - Horizontal Layout */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Current Weight */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
                <Scale className="h-6 w-6 text-primary" />
              </div>
              <div>
                <motion.p 
                  key={currentWeight}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="text-3xl font-bold tabular-nums tracking-tight leading-none"
                >
                  {currentWeight.toFixed(1)}
                  <span className="text-lg font-normal text-muted-foreground ml-0.5">kg</span>
                </motion.p>
                <p className="text-xs text-muted-foreground">Peso Atual</p>
              </div>
            </div>

            {/* Stats Row - Inline */}
            <div className="flex items-center gap-4 sm:gap-6">
              {goal && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Target className="h-3.5 w-3.5 text-accent" />
                    <p className="text-lg font-semibold tabular-nums">{targetWeight.toFixed(1)}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Meta</p>
                </div>
              )}

              {goal && logs.length >= 2 && (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {getTrendIcon()}
                    <p className={cn("text-lg font-semibold tabular-nums", getTrendColor())}>
                      {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Variação</p>
                </div>
              )}

              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-lg font-semibold tabular-nums">{logs.length}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">Registros</p>
              </div>
            </div>

            {/* Register Button */}
            <AnimatePresence mode="wait">
              {!isFormOpen ? (
                <motion.div
                  key="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Button
                    size="sm"
                    onClick={() => {
                      setWeight(currentWeight?.toFixed(1) || '');
                      setSelectedDate(new Date());
                      setIsFormOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full mt-3"
                >
                  <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                    {/* Date Picker */}
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-start text-left font-normal flex-1 sm:max-w-[180px]",
                            !selectedDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                          {selectedDate ? (
                            format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                          ) : (
                            <span>Data</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
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
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="Peso"
                        value={weight}
                        onChange={handleWeightChange}
                        className="w-20 h-8 text-center text-sm font-semibold"
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setIsFormOpen(false)}
                        disabled={loading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        className="h-8 w-8"
                        onClick={handleSubmit}
                        disabled={loading || !weight}
                      >
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Chart with Timeline */}
      {logs.length > 0 && (
        <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
                Evolução
                <span className="text-[10px] font-normal text-muted-foreground ml-1">
                  {chartInterval === 'weekly' ? '(semanal)' : chartInterval === 'monthly' ? '(mensal)' : ''}
                </span>
              </h3>
              {logs.length >= 2 && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getTrendColor())}>
                  {totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg
                </Badge>
              )}
            </div>

            {logs.length >= 2 ? (
              <div className="h-44 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="dateLabel" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      domain={['dataMin - 1', 'dataMax + 1']}
                      width={35}
                      tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        fontSize: '12px',
                        padding: '6px 10px',
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)} kg`, 'Peso']}
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
                    />
                    {goal && (
                      <ReferenceLine 
                        y={targetWeight} 
                        stroke="hsl(var(--accent))" 
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
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
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-20 flex flex-col items-center justify-center text-center">
                <p className="text-xs text-muted-foreground">
                  Registre mais pesos para ver o gráfico
                </p>
              </div>
            )}

            {/* Compact Timeline */}
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-muted-foreground">Histórico</h4>
                {timelineLogs.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setShowAllLogs(!showAllLogs)}
                  >
                    {showAllLogs ? 'Menos' : `+${timelineLogs.length - 3}`}
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {(showAllLogs ? timelineLogs : timelineLogs.slice(0, 3)).map((log, index) => {
                  const prevLog = timelineLogs[index + 1];
                  const diff = prevLog ? log.weight_kg - prevLog.weight_kg : 0;
                  
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs">
                          {format(new Date(log.log_date), "dd/MM", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold tabular-nums">
                          {log.weight_kg.toFixed(1)}
                        </span>
                        {diff !== 0 && (
                          <span className={cn(
                            "text-[10px] tabular-nums",
                            diff > 0 ? 'text-destructive' : 'text-success'
                          )}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}