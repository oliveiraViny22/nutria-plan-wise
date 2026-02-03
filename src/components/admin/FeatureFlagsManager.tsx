/**
 * Painel de Gerenciamento de Feature Flags
 * 
 * Permite ativar/desativar funcionalidades e controlar rollouts percentuais
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Flag, 
  ToggleLeft, 
  ToggleRight, 
  Percent, 
  Save, 
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FeatureFlag {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

// Metadados das flags conhecidas
const FLAG_METADATA: Record<string, { 
  name: string; 
  description: string; 
  type: 'boolean' | 'percent';
  category: 'core' | 'ai' | 'experimental';
}> = {
  'rebalancer_v2_enabled': {
    name: 'Rebalanceador v2',
    description: 'Ativa nova versão do motor de rebalanceamento nutricional',
    type: 'boolean',
    category: 'core',
  },
  'supplements_v2_enabled': {
    name: 'Suplementos v2',
    description: 'Ativa novo sistema de substituição de suplementos',
    type: 'boolean',
    category: 'core',
  },
  'shadow_mode_enabled': {
    name: 'Modo Shadow',
    description: 'Executa lógica nova em paralelo sem afetar usuários',
    type: 'boolean',
    category: 'experimental',
  },
  'openai_circuit_breaker_enabled': {
    name: 'Circuit Breaker OpenAI',
    description: 'Proteção contra falhas em cascata de chamadas AI',
    type: 'boolean',
    category: 'ai',
  },
  'detailed_metrics_enabled': {
    name: 'Métricas Detalhadas',
    description: 'Coleta métricas granulares de performance',
    type: 'boolean',
    category: 'experimental',
  },
  'generator_v58_rollout_percent': {
    name: 'Rollout Gerador v5.8',
    description: 'Percentual de usuários usando nova versão do gerador',
    type: 'percent',
    category: 'core',
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  ai: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  experimental: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
};

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  ai: 'IA',
  experimental: 'Experimental',
};

export function FeatureFlagsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>({});
  
  // Buscar todas as flags
  const { data: flags, isLoading, refetch } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('id, key, value, description, updated_at')
        .eq('category', 'feature_flags')
        .order('key');
      
      if (error) throw error;
      return (data || []) as FeatureFlag[];
    },
  });

  // Mutation para atualizar flag
  const updateFlagMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await supabase
        .from('system_settings')
        .update({ 
          value: value as never,
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)
        .eq('category', 'feature_flags');
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      
      // Limpar valor editado
      setEditedValues(prev => {
        const updated = { ...prev };
        delete updated[variables.key];
        return updated;
      });
      
      toast({
        title: 'Flag atualizada',
        description: `${FLAG_METADATA[variables.key]?.name || variables.key} foi alterada com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  // Mutation para criar nova flag
  const createFlagMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: unknown; description: string }) => {
      const { error } = await supabase
        .from('system_settings')
        .insert({
          key,
          value: value as never,
          description,
          category: 'feature_flags',
          is_sensitive: false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      toast({ title: 'Flag criada', description: 'Nova feature flag adicionada.' });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (key: string, currentValue: unknown) => {
    const isEnabled = currentValue === true || currentValue === 'true';
    updateFlagMutation.mutate({ key, value: !isEnabled });
  };

  const handlePercentChange = (key: string, value: number[]) => {
    setEditedValues(prev => ({ ...prev, [key]: value[0] }));
  };

  const handleSavePercent = (key: string) => {
    const value = editedValues[key];
    if (value !== undefined) {
      updateFlagMutation.mutate({ key, value });
    }
  };

  const getValue = (flag: FeatureFlag): unknown => {
    if (editedValues[flag.key] !== undefined) {
      return editedValues[flag.key];
    }
    return flag.value;
  };

  const isEnabled = (value: unknown): boolean => {
    return value === true || value === 'true';
  };

  const getPercent = (value: unknown): number => {
    if (typeof value === 'number') return value;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Agrupar flags por categoria
  const groupedFlags = flags?.reduce((acc, flag) => {
    const meta = FLAG_METADATA[flag.key];
    const category = meta?.category || 'experimental';
    if (!acc[category]) acc[category] = [];
    acc[category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>) || {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Feature Flags
          </h3>
          <p className="text-sm text-muted-foreground">
            Controle funcionalidades em tempo real sem deploy
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Alert informativo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Alterações em feature flags são aplicadas imediatamente. Use com cautela em produção.
        </AlertDescription>
      </Alert>

      {/* Flags agrupadas por categoria */}
      {Object.entries(groupedFlags).map(([category, categoryFlags]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={CATEGORY_COLORS[category] || CATEGORY_COLORS.experimental}
              >
                {CATEGORY_LABELS[category] || category}
              </Badge>
              <span className="text-muted-foreground">
                ({categoryFlags.length} {categoryFlags.length === 1 ? 'flag' : 'flags'})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryFlags.map((flag) => {
              const meta = FLAG_METADATA[flag.key];
              const isPercent = meta?.type === 'percent';
              const currentValue = getValue(flag);
              const hasChanges = editedValues[flag.key] !== undefined;
              
              return (
                <div 
                  key={flag.key}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {meta?.name || flag.key}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded cursor-help">
                              {flag.key}
                            </code>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Chave da flag no código</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {meta?.description || flag.description || 'Sem descrição'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Atualizado: {new Date(flag.updated_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4 ml-4">
                    {isPercent ? (
                      // Controle de percentual
                      <div className="flex items-center gap-3">
                        <div className="w-32">
                          <Slider
                            value={[getPercent(currentValue)]}
                            onValueChange={(value) => handlePercentChange(flag.key, value)}
                            max={100}
                            step={5}
                            className="cursor-pointer"
                          />
                        </div>
                        <span className="text-sm font-mono w-12 text-right">
                          {getPercent(currentValue)}%
                        </span>
                        {hasChanges && (
                          <Button
                            size="sm"
                            onClick={() => handleSavePercent(flag.key)}
                            disabled={updateFlagMutation.isPending}
                          >
                            {updateFlagMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      // Toggle boolean
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isEnabled(currentValue)}
                          onCheckedChange={() => handleToggle(flag.key, currentValue)}
                          disabled={updateFlagMutation.isPending}
                        />
                        <span className={`text-sm font-medium ${
                          isEnabled(currentValue) ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {isEnabled(currentValue) ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" /> ON
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> OFF
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Estado vazio */}
      {(!flags || flags.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Flag className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhuma feature flag configurada</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
