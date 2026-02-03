import { useState } from 'react';
import { Pill, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SupplementToggleProps {
  initialValue?: boolean;
  onToggle?: (value: boolean) => void;
}

export function SupplementToggle({ initialValue = false, onToggle }: SupplementToggleProps) {
  const { user, refreshProfile } = useAuth();
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  const handleToggle = async (checked: boolean) => {
    if (!user) return;
    
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

  return (
    <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-purple-500/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Pill className="h-5 w-5 text-purple-500" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="supplements-toggle" className="font-medium cursor-pointer">
                  Incluir suplementação
                </Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs p-3">
                      <p className="text-sm">
                        Quando habilitado, você receberá sugestões de suplementos 
                        personalizadas baseadas no seu objetivo. Os suplementos são 
                        <strong> complementares</strong> ao plano alimentar e não 
                        afetam os macros das refeições.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Receba sugestões de suplementos baseadas no seu objetivo
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
      </CardContent>
    </Card>
  );
}
