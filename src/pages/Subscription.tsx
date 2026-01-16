import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, AlertTriangle, Check, ExternalLink, ArrowLeft, Users, BarChart3, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { BILLING_CYCLE_LABELS } from '@/lib/subscription-types';

export default function Subscription() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscriptionInfo, currentPlan, usage, loading, openCustomerPortal, refresh } = useSubscription();
  const { isProfessional } = useUserRole();
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir o portal de gerenciamento.',
        variant: 'destructive',
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Ativa</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500">Período de Teste</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Pagamento Pendente</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Cancelada</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expirada</Badge>;
      default:
        return <Badge variant="secondary">Sem assinatura</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Minha Assinatura</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Current Plan Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Plano Atual</CardTitle>
                {getStatusBadge(subscriptionInfo?.subscription?.status)}
              </div>
              <CardDescription>
                {currentPlan ? (
                  <span className="capitalize text-lg font-medium text-foreground">
                    {currentPlan.name} ({currentPlan.type === 'personal' ? 'Pessoal' : 'Profissional'})
                  </span>
                ) : (
                  'Nenhum plano ativo'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionInfo?.subscription && (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Ciclo de Cobrança</p>
                      <p className="font-medium">
                        {BILLING_CYCLE_LABELS[subscriptionInfo.subscription.billingCycle as keyof typeof BILLING_CYCLE_LABELS] || 'Mensal'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Próxima Renovação</p>
                      <p className="font-medium">
                        {new Date(subscriptionInfo.subscription.periodEnd).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  {subscriptionInfo.subscription.cancelAtPeriodEnd && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <p className="text-sm text-yellow-600 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Sua assinatura será cancelada em {new Date(subscriptionInfo.subscription.periodEnd).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )}
                </>
              )}

              {subscriptionInfo?.subscription?.status === 'past_due' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Seu pagamento está pendente. Atualize sua forma de pagamento.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                {currentPlan?.name !== 'gratuito' && subscriptionInfo?.subscription && (
                  <Button 
                    variant="outline" 
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                  >
                    {portalLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    Gerenciar Pagamento
                  </Button>
                )}
                <Button onClick={() => navigate('/pricing')}>
                  {currentPlan?.name === 'gratuito' ? 'Fazer Upgrade' : 'Alterar Plano'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Usage Card */}
        {currentPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Uso do Período</CardTitle>
                <CardDescription>
                  Consumo de recursos no período atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <UsageItem
                    label="Dietas Geradas"
                    used={usage?.diets_used || 0}
                    limit={currentPlan.diet_limit}
                  />
                  <UsageItem
                    label="Substituições"
                    used={usage?.substitutions_used || 0}
                    limit={currentPlan.substitution_limit}
                  />
                  <UsageItem
                    label="Ajustes"
                    used={usage?.adjustments_used || 0}
                    limit={currentPlan.adjustment_limit}
                  />
                  {currentPlan.has_chat && (
                    <UsageItem
                      label="Mensagens Hoje"
                      used={usage?.chat_messages_today || 0}
                      limit={currentPlan.chat_messages_per_day}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Plan Features */}
        {currentPlan && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Recursos do Plano</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  <FeatureItem
                    text={`${currentPlan.diet_limit} dietas por mês`}
                    included
                  />
                  <FeatureItem
                    text={`${currentPlan.substitution_limit} substituições`}
                    included
                  />
                  <FeatureItem
                    text={`${currentPlan.adjustment_limit} ajustes automáticos`}
                    included={currentPlan.adjustment_limit > 0}
                  />
                  <FeatureItem
                    text={`Chat com IA (${currentPlan.chat_messages_per_day} msgs/dia)`}
                    included={currentPlan.has_chat}
                  />
                  {currentPlan.patients_limit > 0 && (
                    <FeatureItem
                      text={`${currentPlan.patients_limit} pacientes`}
                      included
                    />
                  )}
                  <FeatureItem
                    text={currentPlan.history_days === 9999 
                      ? 'Histórico ilimitado' 
                      : `${currentPlan.history_days} dias de histórico`}
                    included
                  />
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Professional Quick Actions */}
        {isProfessional && currentPlan?.type === 'professional' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Gestão Profissional
                </CardTitle>
                <CardDescription>
                  Acesse as ferramentas exclusivas para profissionais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  onClick={() => navigate('/professional')}
                >
                  <BarChart3 className="h-4 w-4 mr-3" />
                  Painel Profissional
                  <span className="ml-auto text-muted-foreground text-sm">
                    Visão geral e métricas
                  </span>
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/students')}
                >
                  <Users className="h-4 w-4 mr-3" />
                  Gerenciar Alunos
                  <span className="ml-auto text-muted-foreground text-sm">
                    Adicionar, remover e visualizar
                  </span>
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => navigate('/students')}
                >
                  <UserPlus className="h-4 w-4 mr-3" />
                  Adicionar Novo Aluno
                  <span className="ml-auto text-muted-foreground text-sm">
                    Vincular pelo email
                  </span>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Become Professional CTA */}
        {!isProfessional && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold">É um profissional de saúde?</h3>
                    <p className="text-sm text-muted-foreground">
                      Gerencie alunos, crie dietas personalizadas e acompanhe a evolução
                    </p>
                  </div>
                  <Button onClick={() => navigate('/become-professional')}>
                    Conhecer Plano Profissional
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <Button 
          variant="ghost" 
          className="w-full" 
          onClick={refresh}
        >
          Atualizar Status
        </Button>
      </main>
    </div>
  );
}

function UsageItem({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const isAtLimit = percentage >= 100;
  
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${isAtLimit ? 'text-destructive' : ''}`}>
        {used}<span className="text-sm font-normal text-muted-foreground">/{limit}</span>
      </p>
    </div>
  );
}

function FeatureItem({ text, included }: { text: string; included: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {included ? (
        <Check className="h-4 w-4 text-primary" />
      ) : (
        <span className="h-4 w-4 text-muted-foreground">—</span>
      )}
      <span className={included ? '' : 'text-muted-foreground'}>{text}</span>
    </li>
  );
}
