import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, Clock, Zap, Save, RotateCcw, AlertTriangle } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  bucketName: string;
  description?: string;
}

// Default configurations matching the edge function defaults
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  'ai-rebalance': {
    windowSeconds: 60,
    maxRequests: 5,
    bucketName: 'ai-rebalance',
    description: 'Rebalanceamento automático de macros',
  },
  'nutritional-chat': {
    windowSeconds: 2,
    maxRequests: 1,
    bucketName: 'nutritional-chat',
    description: 'Chat com IA nutricional',
  },
  'explain-substitution': {
    windowSeconds: 10,
    maxRequests: 3,
    bucketName: 'explain-substitution',
    description: 'Explicação de substituições',
  },
  'generate-meal-plan': {
    windowSeconds: 60,
    maxRequests: 3,
    bucketName: 'generate-meal-plan',
    description: 'Geração de plano alimentar',
  },
};

const FUNCTION_ICONS: Record<string, typeof Shield> = {
  'ai-rebalance': Zap,
  'nutritional-chat': Shield,
  'explain-substitution': Clock,
  'generate-meal-plan': Shield,
};

export function RateLimitsManager() {
  const queryClient = useQueryClient();
  const [editedConfigs, setEditedConfigs] = useState<Record<string, RateLimitConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current rate limit configurations from system_settings
  const { data: savedConfigs, isLoading } = useQuery({
    queryKey: ['rate-limit-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('key, value')
        .eq('category', 'rate_limit_config');

      if (error) throw error;

      const configs: Record<string, RateLimitConfig> = {};
      
      for (const item of data || []) {
        const functionName = item.key.replace('rate_limit_config:', '');
        if (item.value && typeof item.value === 'object' && !Array.isArray(item.value)) {
          const val = item.value as Record<string, unknown>;
          if ('windowSeconds' in val && 'maxRequests' in val && 'bucketName' in val) {
            configs[functionName] = val as unknown as RateLimitConfig;
          }
        }
      }

      return configs;
    },
  });

  // Merge saved configs with defaults
  const mergedConfigs = Object.keys(DEFAULT_RATE_LIMITS).reduce((acc, key) => {
    acc[key] = {
      ...DEFAULT_RATE_LIMITS[key],
      ...(savedConfigs?.[key] || {}),
      ...(editedConfigs[key] || {}),
    };
    return acc;
  }, {} as Record<string, RateLimitConfig>);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (configs: Record<string, RateLimitConfig>) => {
      for (const [functionName, config] of Object.entries(configs)) {
        const settingKey = `rate_limit_config:${functionName}`;
        
        // Check if exists
        const { data: existing } = await supabase
          .from('system_settings')
          .select('id')
          .eq('key', settingKey)
          .maybeSingle();
        // Convert config to JSON-compatible object
        const configJson = JSON.parse(JSON.stringify(config));
        
        if (existing) {
          // Update
          const { error } = await supabase
            .from('system_settings')
            .update({
              value: configJson,
              description: `Rate limit configuration for ${functionName}`,
            })
            .eq('key', settingKey);
          
          if (error) throw new Error(error.message);
        } else {
          // Insert with array syntax for proper typing
          const { error } = await supabase
            .from('system_settings')
            .insert([{
              key: settingKey,
              category: 'rate_limit_config',
              value: configJson,
              is_sensitive: false,
              description: `Rate limit configuration for ${functionName}`,
            }]);
          
          if (error) throw new Error(error.message);
        }
      }
    },
    onSuccess: () => {
      toast.success('Configurações de rate limit salvas com sucesso');
      setEditedConfigs({});
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['rate-limit-configs'] });
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const handleConfigChange = (
    functionName: string, 
    field: 'windowSeconds' | 'maxRequests', 
    value: number
  ) => {
    setEditedConfigs(prev => ({
      ...prev,
      [functionName]: {
        ...mergedConfigs[functionName],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(mergedConfigs);
  };

  const handleReset = () => {
    setEditedConfigs({});
    setHasChanges(false);
  };

  const formatWindow = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rate Limiting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Rate Limiting
            </CardTitle>
            <CardDescription>
              Configure limites de requisições por função para proteger o sistema
            </CardDescription>
          </div>
          {hasChanges && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-muted-foreground">
            Alterações aqui requerem redeploy das Edge Functions para tomar efeito.
            Os valores atuais são usados como fallback se não houver configuração salva.
          </span>
        </div>

        <div className="grid gap-4">
          {Object.entries(mergedConfigs).map(([functionName, config]) => {
            const Icon = FUNCTION_ICONS[functionName] || Shield;
            const isEdited = !!editedConfigs[functionName];
            const defaultConfig = DEFAULT_RATE_LIMITS[functionName];
            
            return (
              <div
                key={functionName}
                className={`p-4 border rounded-lg transition-colors ${
                  isEdited ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{functionName}</span>
                    {isEdited && (
                      <Badge variant="secondary" className="text-xs">
                        Modificado
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {config.maxRequests} req / {formatWindow(config.windowSeconds)}
                  </Badge>
                </div>
                
                {config.description && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {config.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`${functionName}-window`} className="text-xs">
                      Janela (segundos)
                    </Label>
                    <Input
                      id={`${functionName}-window`}
                      type="number"
                      min={1}
                      max={3600}
                      value={config.windowSeconds}
                      onChange={(e) => handleConfigChange(
                        functionName, 
                        'windowSeconds', 
                        parseInt(e.target.value) || defaultConfig.windowSeconds
                      )}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${functionName}-max`} className="text-xs">
                      Máx. requisições
                    </Label>
                    <Input
                      id={`${functionName}-max`}
                      type="number"
                      min={1}
                      max={100}
                      value={config.maxRequests}
                      onChange={(e) => handleConfigChange(
                        functionName, 
                        'maxRequests', 
                        parseInt(e.target.value) || defaultConfig.maxRequests
                      )}
                      className="h-9"
                    />
                  </div>
                </div>

                {isEdited && defaultConfig && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Padrão: {defaultConfig.maxRequests} req / {formatWindow(defaultConfig.windowSeconds)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
