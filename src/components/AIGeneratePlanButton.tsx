import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AIGeneratePlanButtonProps {
  onSuccess?: () => void;
}

interface GenerationResult {
  success: boolean;
  planId?: string;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  mealsCount?: number;
  error?: string;
  validationErrors?: string[];
  aiAnalysis?: string;
}

export function AIGeneratePlanButton({ onSuccess }: AIGeneratePlanButtonProps) {
  const { profile } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const handleGenerate = async () => {
    if (!profile) {
      toast.error('Perfil não encontrado');
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      const response = await supabase.functions.invoke('generate-meal-plan-v4-experimental', {
        body: {
          profile: {
            daily_calories: profile.daily_calories,
            protein_target: profile.protein_target,
            carbs_target: profile.carbs_target,
            fat_target: profile.fat_target,
            preferences: profile.preferences,
            restrictions: profile.restrictions,
            preferred_foods: profile.preferred_foods || [],
            avoided_foods: profile.avoided_foods || [],
            goal: profile.goal,
            meals_per_day: profile.meals_per_day || 4,
          },
        },
      });

      if (response.error) {
        throw response.error;
      }

      const data = response.data as GenerationResult;
      setResult(data);
      setShowResults(true);

      if (data.success) {
        toast.success('Plano gerado com sucesso!');
        onSuccess?.();
      } else {
        toast.error('Falha na validação do plano');
      }
    } catch (error: any) {
      console.error('Error generating plan:', error);
      setResult({
        success: false,
        error: error.message || 'Erro ao gerar plano',
      });
      setShowResults(true);
      toast.error('Erro ao gerar plano com IA');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={generating}
        className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Gerando com IA...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Gerar Plano com IA (Teste)
          </>
        )}
      </Button>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.success ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  Plano Gerado com Sucesso
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Falha na Geração
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Resultados da geração experimental com IA
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4">
              {result.success ? (
                <>
                  {/* Resumo do plano */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Calorias</p>
                      <p className="text-lg font-bold">{result.totalCalories} kcal</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Proteína</p>
                      <p className="text-lg font-bold">{result.totalProtein}g</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Carboidratos</p>
                      <p className="text-lg font-bold">{result.totalCarbs}g</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Gorduras</p>
                      <p className="text-lg font-bold">{result.totalFat}g</p>
                    </div>
                  </div>

                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Refeições</p>
                    <p className="text-lg font-bold">{result.mealsCount} refeições</p>
                  </div>

                  {/* Análise da IA (se disponível) */}
                  {result.aiAnalysis && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        Análise da IA
                      </p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {result.aiAnalysis}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Erro geral */}
                  {result.error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <p className="text-sm font-medium text-destructive mb-1">Erro:</p>
                      <p className="text-sm text-muted-foreground">{result.error}</p>
                    </div>
                  )}

                  {/* Erros de validação */}
                  {result.validationErrors && result.validationErrors.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Erros de validação:</p>
                      <ul className="space-y-1">
                        {result.validationErrors.map((err, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            {err}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Botão para fechar */}
              <Button
                onClick={() => setShowResults(false)}
                variant="outline"
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
