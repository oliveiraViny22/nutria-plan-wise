/**
 * Admin Settings Tab Component
 * 
 * Manages system settings grouped by category
 */

import { ReactNode } from 'react';
import { 
  Settings, 
  Bot, 
  Activity,
  Sparkles,
  Loader2,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description: string | null;
  category: string;
  is_sensitive: boolean;
}

interface AdminSettingsTabProps {
  settings: SystemSetting[];
  settingsLoading: boolean;
  savingKeys: Set<string>;
  savedKeys: Set<string>;
  errorKeys: Set<string>;
  editedSettings: Record<string, unknown>;
  onSettingChange: (key: string, value: unknown) => void;
  onSaveSetting: (key: string) => Promise<void>;
}

export function AdminSettingsTab({
  settings,
  settingsLoading,
  savingKeys,
  savedKeys,
  errorKeys,
  editedSettings,
  onSettingChange,
  onSaveSetting,
}: AdminSettingsTabProps) {
  const groupedSettings = settings.reduce((acc, setting) => {
    if (!acc[setting.category]) acc[setting.category] = [];
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, SystemSetting[]>);

  const categoryLabels: Record<string, { label: string; icon: ReactNode; description: string }> = {
    'general': { 
      label: 'Geral', 
      icon: <Settings className="h-5 w-5" />,
      description: 'Configurações gerais do sistema'
    },
    'ai': { 
      label: 'Inteligência Artificial', 
      icon: <Bot className="h-5 w-5" />,
      description: 'Configurações de modelos e recursos de IA'
    },
    'limits': { 
      label: 'Limites', 
      icon: <Activity className="h-5 w-5" />,
      description: 'Limites de uso do sistema'
    },
    'features': { 
      label: 'Recursos', 
      icon: <Sparkles className="h-5 w-5" />,
      description: 'Ativar ou desativar funcionalidades'
    },
  };

  const settingLabels: Record<string, string> = {
    'enable_chat_feature': 'Chat com IA (Legado)',
    'ai_model_default': 'Modelo de IA Padrão',
    'max_diet_plans_per_user': 'Máx. Planos por Usuário',
    'enable_meal_substitution': 'Substituição de Refeições',
    'enable_macro_adjustment': 'Ajuste de Macros',
    'enable_professional_signup': 'Cadastro de Profissionais',
    'maintenance_mode': 'Modo de Manutenção',
    'site_name': 'Nome do Site',
    'ai_meal_plan_enabled': 'Geração de Plano Alimentar',
    'ai_substitution_explanation_enabled': 'Explicação de Substituições',
    'ai_plan_suggestions_enabled': 'Sugestões de Ajustes de Plano',
    'ai_food_validation_enabled': 'Validação de Importação de Alimentos',
    'ai_food_audit_enabled': 'Auditoria de Classificação de Alimentos',
    'ai_nutritional_chat_enabled': 'Chat Nutricional',
  };

  const renderSettingEditor = (setting: SystemSetting) => {
    const value = editedSettings[setting.key] ?? setting.value;
    const isSaving = savingKeys.has(setting.key);
    const isSaved = savedKeys.has(setting.key);
    const hasError = errorKeys.has(setting.key);
    const hasChanges = editedSettings[setting.key] !== undefined;
    
    if (typeof setting.value === 'boolean' || setting.value === 'true' || setting.value === 'false') {
      const boolValue = value === true || value === 'true';
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={boolValue}
            onCheckedChange={(checked) => onSettingChange(setting.key, checked)}
            disabled={isSaving}
          />
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaved && <CheckCircle className="h-4 w-4 text-green-600" />}
          {hasError && <AlertCircle className="h-4 w-4 text-red-600" />}
          {hasChanges && (
            <Button 
              size="sm" 
              onClick={() => onSaveSetting(setting.key)}
              disabled={isSaving}
            >
              <Save className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    if (typeof value === 'number' || !isNaN(Number(value))) {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={Number(value)}
            onChange={(e) => onSettingChange(setting.key, parseFloat(e.target.value))}
            className="w-24"
            disabled={isSaving}
          />
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaved && <CheckCircle className="h-4 w-4 text-green-600" />}
          {hasError && <AlertCircle className="h-4 w-4 text-red-600" />}
          {hasChanges && (
            <Button 
              size="sm" 
              onClick={() => onSaveSetting(setting.key)}
              disabled={isSaving}
            >
              <Save className="h-3 w-3" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Input
          value={String(value || '')}
          onChange={(e) => onSettingChange(setting.key, e.target.value)}
          className="w-48"
          disabled={isSaving}
          type={setting.is_sensitive ? 'password' : 'text'}
        />
        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
        {isSaved && <CheckCircle className="h-4 w-4 text-green-600" />}
        {hasError && <AlertCircle className="h-4 w-4 text-red-600" />}
        {hasChanges && (
          <Button 
            size="sm" 
            onClick={() => onSaveSetting(setting.key)}
            disabled={isSaving}
          >
            <Save className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (Object.keys(groupedSettings).length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma configuração encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {Object.entries(groupedSettings).map(([category, categorySettings]) => {
        const categoryInfo = categoryLabels[category.toLowerCase()] || { 
          label: category.charAt(0).toUpperCase() + category.slice(1), 
          icon: <Settings className="h-5 w-5" />,
          description: `Configurações de ${category}`
        };

        return (
          <Card key={category} className="flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-primary">{categoryInfo.icon}</span>
                {categoryInfo.label}
              </CardTitle>
              <CardDescription>{categoryInfo.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              {categorySettings.map((setting) => (
                <div 
                  key={setting.key} 
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="space-y-1 flex-1 mr-4">
                    <Label className="font-medium text-sm">
                      {settingLabels[setting.key] || setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Label>
                    {setting.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{setting.description}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {renderSettingEditor(setting)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export type { SystemSetting };
