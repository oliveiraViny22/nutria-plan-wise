import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, RotateCcw, Zap, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OptimizerSettings {
  protein_floor: number;      // Minimum % of protein target (e.g., 95)
  protein_ceiling: number;    // Maximum % of protein target (e.g., 110)
  carbs_floor: number;        // Minimum % of carbs target
  carbs_ceiling: number;      // Maximum % of carbs target
  fat_floor: number;          // Minimum % of fat target
  fat_ceiling: number;        // Maximum % of fat target
  calories_tolerance: number; // Tolerance % for calories (e.g., 5)
  protein_weight: number;     // Weight in error calculation
  carbs_weight: number;
  fat_weight: number;
  calories_weight: number;
}

const DEFAULT_SETTINGS: OptimizerSettings = {
  protein_floor: 95,
  protein_ceiling: 120,
  carbs_floor: 80,
  carbs_ceiling: 120,
  fat_floor: 80,
  fat_ceiling: 120,
  calories_tolerance: 5,
  protein_weight: 3.0,
  carbs_weight: 1.0,
  fat_weight: 1.0,
  calories_weight: 1.5,
};

const SETTING_KEY = 'optimizer_macro_settings';

export function OptimizerSettingsManager() {
  const [settings, setSettings] = useState<OptimizerSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<OptimizerSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      if (data?.value) {
        const loaded = { ...DEFAULT_SETTINGS, ...(data.value as object) };
        setSettings(loaded);
        setOriginalSettings(loaded);
      }
    } catch (error) {
      console.error('Error loading optimizer settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Check if setting exists first
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .eq('key', SETTING_KEY)
        .maybeSingle();

      const settingData = {
        key: SETTING_KEY,
        value: settings as any,
        category: 'optimizer',
        description: 'Configurações de pisos e tetos de macros para o otimizador bruto',
        is_sensitive: false,
        updated_at: new Date().toISOString(),
      };

      let error: any;
      if (existing) {
        const result = await supabase
          .from('system_settings')
          .update(settingData)
          .eq('key', SETTING_KEY);
        error = result.error;
      } else {
        const result = await supabase
          .from('system_settings')
          .insert(settingData);
        error = result.error;
      }

      if (error) throw error;

      setOriginalSettings(settings);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving optimizer settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const updateSetting = <K extends keyof OptimizerSettings>(key: K, value: OptimizerSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle>Configurações do Otimizador</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefaults}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar Padrões
            </Button>
            <Button
              size="sm"
              onClick={saveSettings}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
        <CardDescription>
          Configure os limites mínimos e máximos de macros para o otimizador de planos alimentares
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            O otimizador ajusta quantidades de alimentos para atingir metas. Valores abaixo do piso
            recebem penalidade pesada, impedindo que o algoritmo sacrifique esse macro.
          </AlertDescription>
        </Alert>

        {/* Protein Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-red-500">Proteína</Badge>
            <span className="text-sm text-muted-foreground">
              Piso: {settings.protein_floor}% | Teto: {settings.protein_ceiling}%
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Piso Mínimo (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.protein_floor]}
                  onValueChange={([v]) => updateSetting('protein_floor', v)}
                  min={70}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.protein_floor}
                  onChange={(e) => updateSetting('protein_floor', Number(e.target.value))}
                  className="w-20"
                  min={70}
                  max={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teto Máximo (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.protein_ceiling]}
                  onValueChange={([v]) => updateSetting('protein_ceiling', v)}
                  min={100}
                  max={150}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.protein_ceiling}
                  onChange={(e) => updateSetting('protein_ceiling', Number(e.target.value))}
                  className="w-20"
                  min={100}
                  max={150}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Carbs Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-amber-500">Carboidratos</Badge>
            <span className="text-sm text-muted-foreground">
              Piso: {settings.carbs_floor}% | Teto: {settings.carbs_ceiling}%
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Piso Mínimo (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.carbs_floor]}
                  onValueChange={([v]) => updateSetting('carbs_floor', v)}
                  min={50}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.carbs_floor}
                  onChange={(e) => updateSetting('carbs_floor', Number(e.target.value))}
                  className="w-20"
                  min={50}
                  max={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teto Máximo (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.carbs_ceiling]}
                  onValueChange={([v]) => updateSetting('carbs_ceiling', v)}
                  min={100}
                  max={150}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.carbs_ceiling}
                  onChange={(e) => updateSetting('carbs_ceiling', Number(e.target.value))}
                  className="w-20"
                  min={100}
                  max={150}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fat Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-blue-500">Gordura</Badge>
            <span className="text-sm text-muted-foreground">
              Piso: {settings.fat_floor}% | Teto: {settings.fat_ceiling}%
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Piso Mínimo (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.fat_floor]}
                  onValueChange={([v]) => updateSetting('fat_floor', v)}
                  min={50}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.fat_floor}
                  onChange={(e) => updateSetting('fat_floor', Number(e.target.value))}
                  className="w-20"
                  min={50}
                  max={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Teto Máximo (%)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[settings.fat_ceiling]}
                  onValueChange={([v]) => updateSetting('fat_ceiling', v)}
                  min={100}
                  max={150}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={settings.fat_ceiling}
                  onChange={(e) => updateSetting('fat_ceiling', Number(e.target.value))}
                  className="w-20"
                  min={100}
                  max={150}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Calories Tolerance */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">Calorias</Badge>
            <span className="text-sm text-muted-foreground">
              Tolerância: ±{settings.calories_tolerance}%
            </span>
          </div>
          <div className="space-y-2">
            <Label>Tolerância de Calorias (%)</Label>
            <div className="flex items-center gap-4">
              <Slider
                value={[settings.calories_tolerance]}
                onValueChange={([v]) => updateSetting('calories_tolerance', v)}
                min={1}
                max={15}
                step={1}
                className="flex-1 max-w-md"
              />
              <Input
                type="number"
                value={settings.calories_tolerance}
                onChange={(e) => updateSetting('calories_tolerance', Number(e.target.value))}
                className="w-20"
                min={1}
                max={15}
              />
            </div>
          </div>
        </div>

        {/* Weights */}
        <div className="space-y-4">
          <h4 className="font-medium">Pesos no Cálculo de Erro</h4>
          <p className="text-sm text-muted-foreground">
            Quanto maior o peso, mais o algoritmo prioriza esse macro na otimização.
          </p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Proteína</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.protein_weight}
                onChange={(e) => updateSetting('protein_weight', Number(e.target.value))}
                min={0.1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Carboidratos</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.carbs_weight}
                onChange={(e) => updateSetting('carbs_weight', Number(e.target.value))}
                min={0.1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Gordura</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.fat_weight}
                onChange={(e) => updateSetting('fat_weight', Number(e.target.value))}
                min={0.1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Calorias</Label>
              <Input
                type="number"
                step="0.1"
                value={settings.calories_weight}
                onChange={(e) => updateSetting('calories_weight', Number(e.target.value))}
                min={0.1}
                max={10}
              />
            </div>
          </div>
        </div>

        {hasChanges && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertDescription className="text-yellow-600 dark:text-yellow-400">
              Você tem alterações não salvas. Clique em "Salvar" para aplicar.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export default OptimizerSettingsManager;
