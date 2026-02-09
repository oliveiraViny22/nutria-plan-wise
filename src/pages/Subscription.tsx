import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  AlertTriangle, 
  Check, 
  ArrowLeft, 
  Users, 
  BarChart3, 
  UserPlus, 
  Lock,
  Sparkles,
  TrendingUp,
  MessageCircle,
  RefreshCw,
  Utensils,
  ArrowRightLeft,
  Settings2,
  Calendar,
  Crown,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { BILLING_CYCLE_LABELS, PLAN_DISPLAY_NAMES } from '@/lib/subscription-types';
import { CommercialPlan } from '@/lib/types';

export default function Subscription() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscriptionInfo, currentPlan, usage, loading, openCustomerPortal, refresh, isLinkedToProfessional } = useSubscription();
  const { isProfessional, isAdmin } = useUserRole();
  const [portalLoading, setPortalLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const isLinkedStudent = isLinkedToProfessional;

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Carregando assinatura...</p>
        </div>
      </div>
    );
  }

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'active':
        return { label: 'Ativa', variant: 'default' as const, className: 'bg-emerald-500 hover:bg-emerald-600' };
      case 'trial':
        return { label: 'Período de Teste', variant: 'default' as const, className: 'bg-blue-500 hover:bg-blue-600' };
      case 'past_due':
        return { label: 'Pagamento Pendente', variant: 'destructive' as const, className: '' };
      case 'canceled':
        return { label: 'Cancelada', variant: 'secondary' as const, className: '' };
      case 'expired':
        return { label: 'Expirada', variant: 'destructive' as const, className: '' };
      default:
        return { label: 'Plano Gratuito', variant: 'secondary' as const, className: '' };
    }
  };

  const statusConfig = getStatusConfig(subscriptionInfo?.subscription?.status);
  const displayName = currentPlan ? (PLAN_DISPLAY_NAMES[currentPlan.type as CommercialPlan] || currentPlan.name) : 'Gratuito';
  const isFreePlan = !currentPlan || currentPlan.type === 'gratuito';

  const usageItems = [
    {
      icon: Utensils,
      label: 'Dietas',
      used: usage?.diets_used || 0,
      limit: currentPlan?.diet_limit || 1,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      icon: ArrowRightLeft,
      label: 'Substituições',
      used: usage?.substitutions_used || 0,
      limit: currentPlan?.substitution_limit || 3,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Settings2,
      label: 'Ajustes',
      used: usage?.adjustments_used || 0,
      limit: currentPlan?.adjustment_limit || 1,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
    ...(currentPlan?.has_chat ? [{
      icon: MessageCircle,
      label: 'Mensagens hoje',
      used: usage?.chat_messages_today || 0,
      limit: currentPlan.chat_messages_per_day,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 overflow-x-hidden">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          <h1 className="text-lg font-semibold">Minha Assinatura</h1>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {/* Hero Card - Current Plan */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className={`h-2 ${isFreePlan ? 'bg-muted' : 'bg-gradient-to-r from-primary to-primary/60'}`} />
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isFreePlan ? 'bg-muted' : 'bg-primary/10'}`}>
                    {isFreePlan ? (
                      <Sparkles className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <Crown className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{displayName}</CardTitle>
                    <CardDescription className="mt-0.5">
                      {currentPlan?.type === 'profissional' ? 'Conta Profissional' : 'Conta Pessoal'}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={statusConfig.variant} className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-5">
              {/* Subscription Details */}
              {subscriptionInfo?.subscription && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Ciclo</span>
                    </div>
                    <p className="font-semibold">
                      {BILLING_CYCLE_LABELS[subscriptionInfo.subscription.billingCycle as keyof typeof BILLING_CYCLE_LABELS] || 'Mensal'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-xs font-medium uppercase tracking-wide">Renovação</span>
                    </div>
                    <p className="font-semibold">
                      {new Date(subscriptionInfo.subscription.periodEnd).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              )}

              {/* Alerts */}
              {subscriptionInfo?.subscription?.cancelAtPeriodEnd && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-600 dark:text-amber-400">Cancelamento Agendado</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Sua assinatura será cancelada em {new Date(subscriptionInfo.subscription.periodEnd).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              )}

              {subscriptionInfo?.subscription?.status === 'past_due' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Pagamento Pendente</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Atualize sua forma de pagamento para continuar usando todos os recursos.
                    </p>
                  </div>
                </div>
              )}

              {/* Linked Student Notice */}
              {isLinkedStudent && (
                <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Sua assinatura é gerenciada pelo seu nutricionista.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {!isLinkedStudent && !isAdmin && !isProfessional && (
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {!isFreePlan && subscriptionInfo?.subscription && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
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
                  <Button className="flex-1" onClick={() => navigate('/pricing')}>
                    <Zap className="h-4 w-4 mr-2" />
                    {isFreePlan ? 'Fazer Upgrade' : 'Alterar Plano'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Free Plan Upgrade CTA */}
        {isFreePlan && !isLinkedStudent && (
          <UpgradePrompt source="subscription_page" variant="card" />
        )}

        {/* Usage Stats & Plan Features - Side by Side (paid users only) */}
        {currentPlan && !isFreePlan && (
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="h-full"
            >
              <Card className="h-full">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Uso do Período
                  </CardTitle>
                  <CardDescription>
                    Consumo de recursos no período atual
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {usageItems.map((item, index) => {
                      const Icon = item.icon;
                      const percentage = item.limit > 0 ? Math.min((item.used / item.limit) * 100, 100) : 0;
                      const isAtLimit = percentage >= 100;
                      const isNearLimit = percentage >= 80 && percentage < 100;
                      
                      return (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + index * 0.05 }}
                          className="bg-muted/30 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-lg ${item.bgColor}`}>
                                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                              </div>
                              <span className="font-medium text-sm">{item.label}</span>
                            </div>
                            <span className={`text-sm font-semibold ${isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-500' : 'text-foreground'}`}>
                              {item.used}/{item.limit}
                            </span>
                          </div>
                          <Progress 
                            value={percentage} 
                            className={`h-1.5 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-amber-500' : ''}`}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="h-full"
            >
              <Card className="h-full">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Recursos Inclusos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    <FeatureItem
                      text={`${currentPlan.diet_limit} dieta${currentPlan.diet_limit > 1 ? 's' : ''} por mês`}
                      included
                    />
                    <FeatureItem
                      text={`${currentPlan.substitution_limit} substituições`}
                      included
                    />
                    <FeatureItem
                      text={`${currentPlan.adjustment_limit} ajuste${currentPlan.adjustment_limit > 1 ? 's' : ''} automático${currentPlan.adjustment_limit > 1 ? 's' : ''}`}
                      included={currentPlan.adjustment_limit > 0}
                    />
                    <FeatureItem
                      text={`Chat IA (${currentPlan.chat_messages_per_day} msgs/dia)`}
                      included={currentPlan.has_chat}
                    />
                    {currentPlan.patients_limit > 0 && (
                      <FeatureItem
                        text={`Até ${currentPlan.patients_limit} pacientes`}
                        included
                      />
                    )}
                    <FeatureItem
                      text={currentPlan.history_days === 9999 
                        ? 'Histórico ilimitado' 
                        : `${currentPlan.history_days} dias de histórico`}
                      included
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Professional Quick Actions */}
        {isProfessional && currentPlan?.type === 'profissional' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-primary/20 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
              <CardHeader className="pb-4">
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
                  className="w-full justify-between h-auto py-3" 
                  onClick={() => navigate('/professional')}
                >
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">Painel Profissional</p>
                      <p className="text-xs opacity-80">Visão geral e métricas</p>
                    </div>
                  </div>
                </Button>
                <Button 
                  className="w-full justify-between h-auto py-3" 
                  variant="outline"
                  onClick={() => navigate('/students')}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">Gerenciar Alunos</p>
                      <p className="text-xs text-muted-foreground">Adicionar, remover e visualizar</p>
                    </div>
                  </div>
                </Button>
                <Button 
                  className="w-full justify-between h-auto py-3" 
                  variant="outline"
                  onClick={() => navigate('/students')}
                >
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-5 w-5" />
                    <div className="text-left">
                      <p className="font-medium">Adicionar Novo Aluno</p>
                      <p className="text-xs text-muted-foreground">Vincular pelo email</p>
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

      </main>
    </div>
  );
}

function FeatureItem({ text, included }: { text: string; included: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${included ? 'bg-primary/5' : 'bg-muted/30'}`}>
      {included ? (
        <div className="p-1 rounded-full bg-primary/10">
          <Check className="h-3.5 w-3.5 text-primary" />
        </div>
      ) : (
        <div className="p-1 rounded-full bg-muted">
          <span className="block h-3.5 w-3.5 text-center text-muted-foreground text-xs">—</span>
        </div>
      )}
      <span className={`text-sm ${included ? 'text-foreground' : 'text-muted-foreground'}`}>{text}</span>
    </div>
  );
}
