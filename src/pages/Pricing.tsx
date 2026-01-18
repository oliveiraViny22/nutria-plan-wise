import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Users, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { Plan } from '@/lib/subscription-types';

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { plans, currentPlan, loading, createCheckout, accountType, isLinkedToProfessional } = useSubscription();
  const [accountTab, setAccountTab] = useState<'personal' | 'professional'>(accountType);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Filter plans based on tab and Premium visibility rules
  const filteredPlans = plans.filter(p => {
    // Filter by account type tab
    if (p.type !== accountTab) return false;
    
    // Premium is only visible to users linked to a professional
    if (p.name === 'premium' && !isLinkedToProfessional) return false;
    
    return true;
  });

  const handleSubscribe = async (plan: Plan) => {
    if (plan.name === 'gratuito') {
      toast({ title: 'Você já está no plano gratuito!' });
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      // Always use monthly billing
      await createCheckout(plan.id, 'monthly');
      toast({ title: 'Redirecionando para o checkout...' });
    } catch (error) {
      toast({
        title: 'Erro ao criar checkout',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getPlanIcon = (name: string) => {
    switch (name) {
      case 'gratuito': return <Zap className="h-6 w-6" />;
      case 'plano_pessoal_pago': return <Sparkles className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      case 'profissional': return <Users className="h-6 w-6" />;
      default: return <Zap className="h-6 w-6" />;
    }
  };

  const getPlanFeatures = (plan: Plan): string[] => {
    const features: string[] = [];
    
    features.push(`${plan.diet_limit} dietas por mês`);
    features.push(`${plan.substitution_limit} substituições`);
    
    if (plan.adjustment_limit > 0) {
      features.push(`${plan.adjustment_limit} ajustes automáticos`);
    }
    
    if (plan.has_chat) {
      features.push(`${plan.chat_messages_per_day} mensagens de chat/dia`);
    }
    
    if (plan.patients_limit > 0) {
      features.push(`${plan.patients_limit} pacientes`);
    }
    
    if (plan.history_days === 9999) {
      features.push('Histórico ilimitado');
    } else {
      features.push(`${plan.history_days} dias de histórico`);
    }
    
    return features;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold">Planos e Preços</h1>
          <div className="w-9 sm:w-10" />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 sm:mb-12 px-2"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 sm:mb-4">
            Escolha o plano ideal para você
          </h2>
          <p className="text-sm sm:text-base lg:text-lg text-muted-foreground max-w-2xl mx-auto">
            Desbloqueie todo o potencial da sua jornada nutricional com nossos planos personalizados.
          </p>
        </motion.div>

        {/* Account Type Tabs */}
        <Tabs value={accountTab} onValueChange={(v) => setAccountTab(v as 'personal' | 'professional')} className="mb-6 sm:mb-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 h-auto">
            <TabsTrigger value="personal" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5">
              <Zap className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Uso </span>Pessoal
            </TabsTrigger>
            <TabsTrigger value="professional" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5">
              <Users className="h-3 w-3 sm:h-4 sm:w-4" />
              Profissional
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Plans Grid - Mobile: 1 col, Tablet: 2 col, Desktop: 2-3 col */}
        <div className={`grid gap-4 sm:gap-6 max-w-5xl mx-auto grid-cols-1 ${
          filteredPlans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'
        }`}>
          {filteredPlans.map((plan, index) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const isHighlight = plan.name === 'plano_pessoal_pago' || plan.name === 'profissional';
            const price = plan.price_monthly;
            
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`relative h-full flex flex-col ${
                  isHighlight ? 'border-primary shadow-lg shadow-primary/20' : ''
                } ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
                  {isHighlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        {plan.name === 'profissional' ? 'Profissional' : 'Mais Popular'}
                      </Badge>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <Badge variant="outline" className="bg-background">
                        Seu Plano
                      </Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center ${
                      isHighlight ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {getPlanIcon(plan.name)}
                    </div>
                    <CardTitle className="text-2xl capitalize">
                      {plan.name === 'plano_pessoal_pago' ? 'Pessoal' : 
                       plan.name === 'profissional' ? 'Profissional' :
                       plan.name === 'premium' ? 'Premium' : 'Gratuito'}
                    </CardTitle>
                    <CardDescription>
                      {plan.description || 'Plano de nutrição'}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="text-center mb-6">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold">
                          R$ {price.toFixed(2).replace('.', ',')}
                        </span>
                        <span className="text-muted-foreground">/mês</span>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {getPlanFeatures(plan).map((feature, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isHighlight ? 'default' : 'outline'}
                      disabled={isCurrentPlan || checkoutLoading === plan.id}
                      onClick={() => handleSubscribe(plan)}
                    >
                      {checkoutLoading === plan.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                      ) : isCurrentPlan ? (
                        'Plano Atual'
                      ) : plan.name === 'gratuito' ? (
                        'Plano Gratuito'
                      ) : (
                        'Assinar Agora'
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* FAQ or Features Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 sm:mt-16 text-center px-2"
        >
          <h3 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Dúvidas?</h3>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
            Todos os planos incluem suporte e atualizações. Cancele quando quiser.
          </p>
          <div className="flex justify-center gap-3 sm:gap-4">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9 sm:h-10" onClick={() => navigate('/chat')}>
              <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Falar com Suporte
            </Button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
