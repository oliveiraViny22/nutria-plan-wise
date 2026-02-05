import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { NutritionalValidationResult, getFieldLabel } from '@/hooks/useNutritionalValidation';
import { cn } from '@/lib/utils';

interface NutritionalValidationAlertProps {
  validation: NutritionalValidationResult;
  onApplyRecommendations?: () => void;
  showApplyButton?: boolean;
  className?: string;
}

export function NutritionalValidationAlert({
  validation,
  onApplyRecommendations,
  showApplyButton = true,
  className,
}: NutritionalValidationAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { isValid, issues, recommendations, summary } = validation;

  // Se não há issues, mostra sucesso
  if (issues.length === 0) {
    return (
      <Alert className={cn('border-green-500/50 bg-green-500/10', className)}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-700 dark:text-green-400">
          Metas nutricionais validadas
        </AlertTitle>
        <AlertDescription className="text-green-600 dark:text-green-300">
          Suas metas estão alinhadas com as diretrizes nutricionais recomendadas.
        </AlertDescription>
      </Alert>
    );
  }

  const hasErrors = summary.errors > 0;
  const Icon = hasErrors ? AlertCircle : AlertTriangle;
  const alertVariant = hasErrors ? 'destructive' : 'default';
  const alertBg = hasErrors 
    ? 'border-destructive/50 bg-destructive/10' 
    : 'border-yellow-500/50 bg-yellow-500/10';
  const titleColor = hasErrors 
    ? 'text-destructive' 
    : 'text-yellow-700 dark:text-yellow-400';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Alert className={cn(alertBg, className)}>
        <Icon className={cn('h-4 w-4', hasErrors ? 'text-destructive' : 'text-yellow-600')} />
        <AlertTitle className={cn('flex items-center gap-2', titleColor)}>
          {hasErrors ? 'Ajustes necessários' : 'Sugestões de melhoria'}
          <div className="flex gap-1">
            {summary.errors > 0 && (
              <Badge variant="destructive" className="text-xs">
                {summary.errors} {summary.errors === 1 ? 'erro' : 'erros'}
              </Badge>
            )}
            {summary.warnings > 0 && (
              <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700 dark:text-yellow-400">
                {summary.warnings} {summary.warnings === 1 ? 'aviso' : 'avisos'}
              </Badge>
            )}
          </div>
        </AlertTitle>
        
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            {hasErrors 
              ? 'Suas metas nutricionais precisam de ajustes para garantir uma dieta saudável.'
              : 'Suas metas estão próximas do ideal, mas podem ser otimizadas.'}
          </p>

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span>{isOpen ? 'Ocultar detalhes' : 'Ver detalhes'}</span>
              <span className="text-xs text-muted-foreground">
                {issues.length} {issues.length === 1 ? 'item' : 'itens'}
              </span>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-2">
            {issues.map((issue, index) => (
              <div 
                key={index} 
                className={cn(
                  'p-3 rounded-lg text-sm',
                  issue.severity === 'error' 
                    ? 'bg-destructive/10 border border-destructive/20' 
                    : 'bg-yellow-500/10 border border-yellow-500/20'
                )}
              >
                <div className="flex items-start gap-2">
                  {issue.severity === 'error' ? (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      <span>{getFieldLabel(issue.field)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {issue.currentValue} → {issue.recommendedValue}
                        {issue.field === 'calories' ? ' kcal' : 'g'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1">{issue.message}</p>
                  </div>
                </div>
              </div>
            ))}

            {showApplyButton && recommendations && onApplyRecommendations && (
              <div className="pt-2 border-t">
                <Button 
                  onClick={onApplyRecommendations} 
                  size="sm" 
                  className="w-full"
                  variant={hasErrors ? 'default' : 'outline'}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aplicar valores recomendados
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Calorias: {recommendations.calories} kcal | 
                  P: {recommendations.protein}g | 
                  C: {recommendations.carbs}g | 
                  G: {recommendations.fat}g
                </p>
              </div>
            )}
          </CollapsibleContent>
        </AlertDescription>
      </Alert>
    </Collapsible>
  );
}
