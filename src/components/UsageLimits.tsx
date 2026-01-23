import { motion } from 'framer-motion';
import { Check, X, AlertTriangle, Activity, Package } from 'lucide-react';
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

  // Usa plan.type para comparação consistente (valor em lowercase no banco)
  const isFreePlan = currentPlan.type === 'gratuito';
  // Calcula o limite efetivo de opções de refeição (override ou padrão do plano)
  // Para plano gratuito, sempre força 1 opção independente do que venha do banco
  const effectiveMealOptionsLimit = isFreePlan 
    ? 1 
    : (usage?.meal_options_override ?? currentPlan.meal_options_limit ?? 3);
  // Só exibe opções de refeição se o limite for maior que 1 (planos pagos permitem escolher entre opções)
  const showMealOptions = !isFreePlan && effectiveMealOptionsLimit > 1;

  // Usage items (counters)
  const usageItems = [
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
  ];

  if (currentPlan.has_chat) {
    usageItems.push({
      name: 'Mensagens (hoje)',
      used: usage?.chat_messages_today || 0,
      limit: currentPlan.chat_messages_per_day,
      key: 'chat',
    });
  }

  // Features/resources included
  const features = [
    { name: 'Chat com IA', available: currentPlan.has_chat },
    ...(showMealOptions ? [{ 
      name: `${effectiveMealOptionsLimit} opções por refeição`, 
      available: true 
    }] : []),
  ];

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Uso do Período */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">Uso do Período</CardTitle>
            </div>
            <Badge variant="outline" className="capitalize">
              {currentPlan.name}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usageItems.map((item) => {
            const percentage = getPercentage(item.used, item.limit);
            const isAtLimit = percentage >= 100;
            const isNearLimit = percentage >= 80;

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
                  <span className={getStatusColor(percentage)}>
                    {item.used}/{item.limit}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className={`h-2 ${getProgressColor(percentage)}`}
                />
              </motion.div>
            );
          })}

          {subscriptionInfo?.subscription?.cancelAtPeriodEnd && (
            <div className="pt-3 border-t">
              <p className="text-sm text-yellow-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Assinatura será cancelada em {subscriptionInfo.subscription.periodEnd}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recursos Inclusos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg">Recursos Inclusos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between text-sm"
            >
              <span>{feature.name}</span>
              {feature.available ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-muted-foreground" />
              )}
            </motion.div>
          ))}

          {!currentPlan.has_chat && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Chat com IA</span>
              <Badge variant="secondary" className="text-xs">Indisponível</Badge>
            </div>
          )}

          {/* Não mostra botão para profissionais ou alunos vinculados */}
          {!isProfessional && !isLinkedToProfessional && (
            <div className="pt-3 border-t">
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
    </div>
  );
}
