import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Crown, Zap, Users, MessageCircle, ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Tabs removed - professional options hidden from free/paid users
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plan, PLAN_DESCRIPTIONS, PLAN_DISPLAY_NAMES } from '@/lib/subscription-types';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommercialPlan } from '@/lib/types';

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { plans, currentPlan, loading, createCheckout, isLinkedToProfessional } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Check if user is on free plan (no current plan or gratuito)
  // Also treat unauthenticated users as "free" for display purposes
  const isFreePlan = !user || !currentPlan || currentPlan.name === 'gratuito';
  
  // Check if user is on a paid personal plan
  const isPaidPersonalPlan = currentPlan?.type === 'plano_pessoal_pago';

  // Filter plans based on user's current plan
  // Free and paid personal users should NOT see professional plans
  const filteredPlans = plans.filter(p => {
    // Never show professional plans to free or paid personal users
    if (p.type === 'profissional') {
      return false;
    }
    
    // Free users can ONLY see the paid personal plan as upgrade option
    if (isFreePlan) {
      return p.type === 'plano_pessoal_pago' && p.name !== 'Premium';
    }

    // Premium is a special plan for students linked to professionals
    if (p.name === 'Premium') {
      return isLinkedToProfessional;
    }
    
    // Paid personal users see only personal plans (gratuito and plano_pessoal_pago)
    if (isPaidPersonalPlan) {
      const personalPlanTypes: string[] = ['gratuito', 'plano_pessoal_pago'];
      return personalPlanTypes.includes(p.type);
    }
    
    return true;
  });

  const handleSubscribe = async (plan: Plan) => {
    // Require authentication before checkout
    if (!user) {
      toast({
        title: 'Autenticação necessária',
        description: 'Faça login para assinar um plano.',
        variant: 'destructive',
      });
      navigate('/login', { state: { from: { pathname: '/pricing' } } });
      return;
    }

    if (plan.name === 'gratuito') {
      toast({ title: 'Você já está no plano gratuito!' });
      return;
    }

    // Block Premium subscription if not linked to professional
    if (plan.name === 'premium' && !isLinkedToProfessional) {
      toast({
        title: 'Plano exclusivo',
        description: 'O plano Premium é exclusivo para alunos vinculados a um profissional. Peça ao seu nutricionista para vincular sua conta.',
        variant: 'destructive',
      });
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
    
    // Only show limits that are > 0 to avoid confusing "0 dietas"
    if (plan.diet_limit > 0) {
      features.push(`${plan.diet_limit} ${plan.diet_limit === 1 ? 'dieta' : 'dietas'} por mês`);
    }
    
    if (plan.substitution_limit > 0) {
      features.push(`${plan.substitution_limit} ${plan.substitution_limit === 1 ? 'substituição' : 'substituições'}`);
    }
    
    if (plan.adjustment_limit > 0) {
      features.push(`${plan.adjustment_limit} ${plan.adjustment_limit === 1 ? 'ajuste automático' : 'ajustes automáticos'}`);
    }
    
    if (plan.has_chat && plan.chat_messages_per_day > 0) {
      features.push(`${plan.chat_messages_per_day} ${plan.chat_messages_per_day === 1 ? 'mensagem' : 'mensagens'} de chat/dia`);
    } else if (plan.has_chat) {
      features.push('Chat com IA educacional');
    }
    
    if (plan.patients_limit > 0) {
      features.push(`${plan.patients_limit} ${plan.patients_limit === 1 ? 'paciente' : 'pacientes'}`);
    }
    
    if (plan.history_days === 9999) {
      features.push('Histórico ilimitado');
    } else if (plan.history_days > 0) {
      features.push(`${plan.history_days} dias de histórico`);
    }
    
    // Add feature descriptions for gratuito plan
    if (plan.name === 'gratuito') {
      if (features.length === 0) {
        features.push('Visualização do plano alimentar');
        features.push('Acompanhamento básico');
      }
      features.push('IA educacional básica');
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
          <div className="flex items-center gap-2">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
          <h1 className="text-lg sm:text-xl font-bold">Planos e Preços</h1>
          <ThemeToggle />
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

        {/* Account Type Tabs - Removed: free and paid personal users should not see professional options */}

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
                    <CardTitle className="text-2xl">
                      {PLAN_DISPLAY_NAMES[plan.name as CommercialPlan] || plan.name}
                    </CardTitle>
                    <CardDescription className="text-sm min-h-[40px]">
                      {PLAN_DESCRIPTIONS[plan.name as CommercialPlan] || plan.description || 'Plano de nutrição'}
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
      </main>
    </div>
  );
}
