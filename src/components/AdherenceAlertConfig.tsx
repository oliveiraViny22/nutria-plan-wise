import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Save, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AlertConfig {
  id?: string;
  threshold_low: number;
  threshold_warning: number;
  check_period_days: number;
  notify_on_low: boolean;
  notify_on_warning: boolean;
  is_active: boolean;
}

export function AdherenceAlertConfig() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({
    threshold_low: 50,
    threshold_warning: 70,
    check_period_days: 7,
    notify_on_low: true,
    notify_on_warning: false,
    is_active: true,
  });

  useEffect(() => {
    if (user) {
      fetchConfig();
    }
  }, [user]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('adherence_alert_configs')
        .select('*')
        .eq('professional_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching alert config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('adherence_alert_configs')
        .upsert({
          ...config,
          professional_id: user.id,
        }, {
          onConflict: 'professional_id',
        });

      if (error) throw error;

      toast({
        title: 'Configurações salvas',
        description: 'Suas preferências de alertas foram atualizadas.',
      });
    } catch (error: any) {
      console.error('Error saving config:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                Alertas de Adesão
              </CardTitle>
              <CardDescription>
                Configure quando receber alertas sobre a adesão dos seus alunos
              </CardDescription>
            </div>
            <Switch
              checked={config.is_active}
              onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!config.is_active && (
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <BellOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Os alertas automáticos estão desativados
              </p>
            </div>
          )}

          <div className={config.is_active ? '' : 'opacity-50 pointer-events-none'}>
            {/* Threshold Low (Critical) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-destructive" />
                  Limite Crítico
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.notify_on_low}
                    onCheckedChange={(checked) => setConfig({ ...config, notify_on_low: checked })}
                  />
                  <span className="text-sm text-muted-foreground w-12">
                    {config.threshold_low}%
                  </span>
                </div>
              </div>
              <Slider
                value={[config.threshold_low]}
                onValueChange={([value]) => setConfig({ ...config, threshold_low: value })}
                max={100}
                min={10}
                step={5}
                disabled={!config.notify_on_low}
              />
              <p className="text-xs text-muted-foreground">
                Alertar quando a adesão cair abaixo de {config.threshold_low}%
              </p>
            </div>

            {/* Threshold Warning */}
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  Limite de Atenção
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.notify_on_warning}
                    onCheckedChange={(checked) => setConfig({ ...config, notify_on_warning: checked })}
                  />
                  <span className="text-sm text-muted-foreground w-12">
                    {config.threshold_warning}%
                  </span>
                </div>
              </div>
              <Slider
                value={[config.threshold_warning]}
                onValueChange={([value]) => setConfig({ ...config, threshold_warning: Math.max(value, config.threshold_low + 5) })}
                max={100}
                min={config.threshold_low + 5}
                step={5}
                disabled={!config.notify_on_warning}
              />
              <p className="text-xs text-muted-foreground">
                Alertar quando a adesão estiver entre {config.threshold_low}% e {config.threshold_warning}%
              </p>
            </div>

            {/* Check Period */}
            <div className="space-y-2 mt-6">
              <Label>Período de Análise</Label>
              <Select
                value={config.check_period_days.toString()}
                onValueChange={(value) => setConfig({ ...config, check_period_days: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Últimos 3 dias</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="14">Últimos 14 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Considerar a adesão dos últimos {config.check_period_days} dias para gerar alertas
              </p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
