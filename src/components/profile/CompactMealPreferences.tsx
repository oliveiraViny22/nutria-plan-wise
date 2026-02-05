import { Utensils, Moon, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CompactMealPreferencesProps {
  mealsPerDay: number;
  snackPreference: 'morning_snack' | 'afternoon_snack';
  lastEveningMeal: 'dinner' | 'supper';
  eveningMealPreference: 'full_dinner' | 'light_dinner' | 'no_preference';
  savingPreference: boolean;
  onSnackChange: (value: 'morning_snack' | 'afternoon_snack') => void;
  onEveningMealChange: (value: 'dinner' | 'supper') => void;
  onEveningPreferenceChange: (value: 'full_dinner' | 'light_dinner' | 'no_preference') => void;
}

export function CompactMealPreferences({
  mealsPerDay,
  snackPreference,
  lastEveningMeal,
  eveningMealPreference,
  savingPreference,
  onSnackChange,
  onEveningMealChange,
  onEveningPreferenceChange,
}: CompactMealPreferencesProps) {
  return (
    <div className="space-y-4">
      {/* Meals per Day Badge */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">{mealsPerDay}</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Refeições por dia</p>
          <p className="font-medium">{mealsPerDay} refeições configuradas</p>
        </div>
      </div>

      {/* Compact Preferences Grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Snack Preference - For 4 meals */}
        {mealsPerDay === 4 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Utensils className="h-3.5 w-3.5 text-primary" />
                Horário do Lanche
              </Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      <strong>☀️ Manhã:</strong> Entre café e almoço<br />
                      <strong>🌅 Tarde:</strong> Entre almoço e jantar
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={snackPreference}
              onValueChange={(v) => onSnackChange(v as 'morning_snack' | 'afternoon_snack')}
              disabled={savingPreference}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning_snack">☀️ Lanche da Manhã</SelectItem>
                <SelectItem value="afternoon_snack">🌅 Lanche da Tarde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Last Evening Meal - For 3-5 meals */}
        {mealsPerDay >= 3 && mealsPerDay <= 5 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-primary" />
                Refeição Noturna
              </Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      <strong>🍽️ Jantar:</strong> Refeição quente e completa<br />
                      <strong>🌙 Ceia:</strong> Refeição leve e prática
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={lastEveningMeal}
              onValueChange={(v) => onEveningMealChange(v as 'dinner' | 'supper')}
              disabled={savingPreference}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinner">🍽️ Jantar (completo)</SelectItem>
                <SelectItem value="supper">🌙 Ceia (leve)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Evening Distribution - For 6 meals */}
        {mealsPerDay === 6 && (
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-primary" />
                Distribuição Noturna
              </Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p className="text-sm">
                      Com 6 refeições você tem jantar E ceia. Esta escolha define 
                      como as calorias são distribuídas entre eles.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Select
              value={eveningMealPreference}
              onValueChange={(v) => onEveningPreferenceChange(v as 'full_dinner' | 'light_dinner' | 'no_preference')}
              disabled={savingPreference}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_dinner">🍽️ Jantar completo + Ceia leve</SelectItem>
                <SelectItem value="light_dinner">🌙 Jantar leve + Ceia substancial</SelectItem>
                <SelectItem value="no_preference">⚖️ Sem preferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
