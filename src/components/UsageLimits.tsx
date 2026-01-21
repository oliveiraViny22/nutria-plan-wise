import { motion } from 'framer-motion';
import { Check, X, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserRole } from '@/hooks/useUserRole';
import { useNavigate } from 'react-router-dom';

export function UsageLimits() {
  const navigate = useNavigate();
  const { subscriptionInfo, currentPlan, usage, loading, isLinkedToProfessional } = useSubscription();
  const { isProfessional } = useUserRole();

  if (loading || !currentPlan) {
    return null;
  }

  // Calcula o limite efetivo de opções de refeição (override ou padrão do plano)
  const effectiveMealOptionsLimit = usage?.meal_options_override ?? currentPlan.meal_options_limit ?? 3;

  const limits = [
    {
      name: 'Dietas',
      used: usage?.diets_used || 0,
      limit: currentPlan.diet_limit,
      key: 'diet',
    },
    {
      name: 'Substituições',
      used: usage?.substitutions_used || 0,
      limit: currentPlan.substitution_limit,
      key: 'substitution',
    },
    {
      name: 'Ajustes',
      used: usage?.adjustments_used || 0,
      limit: currentPlan.adjustment_limit,
      key: 'adjustment',
    },
    {
      name: 'Opções por refeição',
      used: effectiveMealOptionsLimit,
      limit: effectiveMealOptionsLimit,
      key: 'meal_options',
      isStatic: true, // Não é um contador de uso, é um limite
    },
  ];

  if (currentPlan.has_chat) {
    limits.push({
      name: 'Mensagens (hoje)',
      used: usage?.chat_messages_today || 0,
      limit: currentPlan.chat_messages_per_day,
      key: 'chat',
    });
  }

  const getPercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-destructive';
    if (percentage >= 80) return 'text-yellow-500';
    return 'text-primary';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-destructive';
    if (percentage >= 80) return 'bg-yellow-500';
    return '';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Uso do Plano</CardTitle>
          <Badge variant="outline" className="capitalize">
            {currentPlan.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {limits.map((item) => {
          const isStatic = 'isStatic' in item && item.isStatic;
          const percentage = isStatic ? 100 : getPercentage(item.used, item.limit);
          const isAtLimit = !isStatic && percentage >= 100;
          const isNearLimit = !isStatic && percentage >= 80;

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {item.name}
                  {isAtLimit && (
                    <X className="h-3 w-3 text-destructive" />
                  )}
                  {isNearLimit && !isAtLimit && (
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                  )}
                </span>
                <span className={isStatic ? 'text-primary' : getStatusColor(percentage)}>
                  {isStatic ? item.limit : `${item.used}/${item.limit}`}
                </span>
              </div>
              {!isStatic && (
                <Progress 
                  value={percentage} 
                  className={`h-2 ${getProgressColor(percentage)}`}
                />
              )}
            </motion.div>
          );
        })}

        {!currentPlan.has_chat && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <span>Chat com IA</span>
            <Badge variant="secondary">Não disponível</Badge>
          </div>
        )}

        {subscriptionInfo?.subscription?.cancelAtPeriodEnd && (
          <div className="pt-3 border-t">
            <p className="text-sm text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Assinatura será cancelada em {subscriptionInfo.subscription.periodEnd}
            </p>
          </div>
        )}

        {/* Não mostra botão para profissionais ou alunos vinculados */}
        {!isProfessional && !isLinkedToProfessional && (
          <div className="pt-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate('/pricing')}
            >
              {currentPlan.name === 'gratuito' ? 'Fazer Upgrade' : 'Gerenciar Plano'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
