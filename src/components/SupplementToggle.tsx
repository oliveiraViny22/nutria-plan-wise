import { useState, useEffect } from 'react';
import { Pill, Info, Sparkles, Lock, Crown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface SupplementToggleProps {
  initialValue?: boolean;
  onToggle?: (value: boolean) => void;
  compact?: boolean;
  locked?: boolean;
}

export function SupplementToggle({ initialValue = false, onToggle, compact = false, locked = false }: SupplementToggleProps) {
  const { user, refreshProfile, profile } = useAuth();
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  // Sync with profile changes
  useEffect(() => {
    if (profile && (profile as any).include_supplements !== undefined) {
      setEnabled((profile as any).include_supplements);
    }
  }, [profile]);

  const handleToggle = async (checked: boolean) => {
    if (!user || locked) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ include_supplements: checked })
        .eq('user_id', user.id);

      if (error) throw error;

      setEnabled(checked);
      onToggle?.(checked);
      await refreshProfile();
      
      toast.success(
        checked 
          ? 'Sugestões de suplementos habilitadas' 
          : 'Sugestões de suplementos desabilitadas'
      );
    } catch (error) {
      console.error('Error updating supplement preference:', error);
      toast.error('Erro ao salvar preferência');
    } finally {
      setSaving(false);
    }
  };

  if (compact) {
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-lg ${locked ? 'bg-muted/50 border border-border' : 'bg-purple-500/5 border border-purple-500/20'}`}>
        <div className="flex items-center gap-2">
          <Pill className={`h-4 w-4 ${locked ? 'text-muted-foreground' : 'text-purple-500'}`} />
          <span className={`text-sm font-medium ${locked ? 'text-muted-foreground' : ''}`}>Suplementação</span>
          {locked ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/pricing" className="inline-flex group">
                    <Badge variant="outline" className="shimmer-badge-subtle gap-1 text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20 cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-sm hover:shadow-amber-500/20">
                      <Crown className="h-3 w-3 group-hover:animate-pulse" />
                      Pro
                    </Badge>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs p-3">
                  <p className="text-sm font-medium mb-1">Recurso Premium</p>
                  <p className="text-sm text-muted-foreground">
                    Sugestões de suplementação estão disponíveis nos planos pagos. 
                    Toque para ver opções de upgrade.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs p-3">
                  <p className="text-sm font-medium mb-1">Como funciona?</p>
                  <p className="text-sm text-muted-foreground">
                    A IA sugere suplementos personalizados baseados no seu objetivo. 
                    <strong className="text-foreground"> Suplementos são complementares</strong> e 
                    não alteram os macros do seu plano alimentar principal.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {locked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Switch
            id="supplements-toggle-compact"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        )}
      </div>
    );
  }

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Pill className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="supplements-toggle" className="font-medium cursor-pointer">
                  Incluir suplementação
                </Label>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  IA
                </Badge>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs p-3">
                      <p className="text-sm font-medium mb-1">Como funciona?</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        A inteligência artificial analisa seu objetivo e perfil nutricional 
                        para sugerir suplementos relevantes de forma autônoma.
                      </p>
                      <p className="text-sm font-medium mb-1">Impacto no plano:</p>
                      <p className="text-sm text-muted-foreground">
                        Os suplementos são <strong className="text-foreground">100% complementares</strong>. 
                        Eles não modificam as calorias ou macros das suas refeições, 
                        nem interferem no gerador ou rebalanceador do plano.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sugestões personalizadas de suplementos baseadas no seu objetivo
              </p>
            </div>
          </div>
          
          <Switch
            id="supplements-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        {/* Explanatory Note */}
        <div className="mt-3 pt-3 border-t border-purple-500/20">
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-400" />
            <span>
              <strong className="text-foreground">Importante:</strong> Suplementos são sugestões complementares 
              geradas por IA e não substituem orientação profissional. Eles não afetam as metas 
              calóricas ou de macronutrientes do seu plano alimentar.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
