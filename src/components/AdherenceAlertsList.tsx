import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  BellRing, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdherenceAlert {
  id: string;
  student_id: string;
  diet_plan_id: string;
  alert_type: string;
  adherence_rate: number;
  threshold_used: number;
  message: string;
  is_read: boolean;
  created_at: string;
  profiles?: {
    name: string;
  } | null;
}

export function AdherenceAlertsBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AdherenceAlert[]>([]);

  const fetchAlerts = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('adherence_alerts')
        .select('*')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setAlerts((data || []) as AdherenceAlert[]);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Subscribe to new alerts
    const channel = supabase
      .channel('adherence_alerts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'adherence_alerts',
          filter: `professional_id=eq.${user?.id}`,
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('adherence_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.map(a => 
        a.id === alertId ? { ...a, is_read: true } : a
      ));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id);
      
      const { error } = await supabase
        .from('adherence_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unreadIds);

      if (error) throw error;

      setAlerts(alerts.map(a => ({ ...a, is_read: true })));
      
      toast({
        title: 'Alertas marcados como lidos',
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'low':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'recovered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'low':
        return <Badge variant="destructive" className="text-[10px]">Crítico</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500 text-[10px]">Atenção</Badge>;
      case 'recovered':
        return <Badge variant="default" className="bg-green-500 text-[10px]">Recuperado</Badge>;
      default:
        return null;
    }
  };

  const handleAlertClick = (alert: AdherenceAlert) => {
    markAsRead(alert.id);
    setOpen(false);
    navigate(`/student/${alert.student_id}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <>
              <BellRing className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : (
            <Bell className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas de Adesão
          </h4>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchAlerts}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllAsRead}>
                Marcar todas
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhum alerta de adesão ainda
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure os alertas nas configurações
              </p>
            </div>
          ) : (
            <div className="divide-y">
              <AnimatePresence>
                {alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      !alert.is_read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleAlertClick(alert)}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getAlertBadge(alert.alert_type)}
                          {!alert.is_read && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm line-clamp-2">{alert.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(alert.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
