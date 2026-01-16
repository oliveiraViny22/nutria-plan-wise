import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Crown, 
  Check, 
  Users, 
  LineChart, 
  Utensils,
  ArrowLeft,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const PLANS = [
  {
    id: 'monthly',
    name: 'Mensal',
    price: 'R$ 99',
    period: '/mês',
    description: 'Ideal para começar',
    features: [
      'Até 10 alunos ativos',
      'Acesso aos planos dos alunos',
      'Gestão de progresso',
      'Suporte por email',
    ],
    maxStudents: 10,
    popular: false,
  },
  {
    id: 'annual',
    name: 'Anual',
    price: 'R$ 79',
    period: '/mês',
    description: '2 meses grátis',
    features: [
      'Até 50 alunos ativos',
      'Acesso aos planos dos alunos',
      'Gestão de progresso',
      'Suporte prioritário',
      'Relatórios avançados',
    ],
    maxStudents: 50,
    popular: true,
  },
];

const BENEFITS = [
  {
    icon: Users,
    title: 'Gerencie seus alunos',
    description: 'Adicione e acompanhe todos os seus alunos em um só lugar.',
  },
  {
    icon: Utensils,
    title: 'Planos personalizados',
    description: 'Visualize e ajuste os planos alimentares de cada aluno.',
  },
  {
    icon: LineChart,
    title: 'Acompanhe o progresso',
    description: 'Monitore a evolução e aderência de cada aluno.',
  },
];

export default function BecomeProfessional() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const handleActivateLicense = async () => {
    if (!user || !selectedPlan) return;

    setIsActivating(true);
    try {
      const plan = PLANS.find(p => p.id === selectedPlan);
      if (!plan) throw new Error('Plano não encontrado');

      // Redirect to Stripe checkout for payment - license/role activation 
      // is handled securely via stripe-webhook after successful payment
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan_type: 'professional',
          billing_cycle: selectedPlan === 'annual' ? 'annual' : 'monthly',
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Checkout URL not received');

      // Open Stripe checkout in new tab
      window.open(data.url, '_blank');

      toast({
        title: 'Redirecionando para pagamento',
        description: 'Complete o pagamento para ativar sua licença profissional.',
      });
    } catch (error) {
      console.error('Error initiating checkout:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível iniciar o pagamento. Tente novamente.',
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-lg font-semibold">Seja Profissional</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Gerencie seus alunos com o NutriAI
          </h1>
          <p className="text-lg text-muted-foreground">
            Torne-se um profissional e tenha controle total sobre os planos alimentares dos seus alunos, acompanhando seu progresso em tempo real.
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {BENEFITS.map((benefit, index) => (
            <Card key={index} className="card-elevated">
              <CardContent className="pt-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Pricing */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-6"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Escolha seu plano</h2>
            <p className="text-muted-foreground">
              Selecione o plano que melhor se adapta às suas necessidades
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <Card 
                key={plan.id}
                className={`relative cursor-pointer transition-all ${
                  selectedPlan === plan.id 
                    ? 'ring-2 ring-primary border-primary' 
                    : 'hover:border-primary/50'
                } ${plan.popular ? 'md:-mt-4 md:mb-4' : ''}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                      Mais Popular
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    {selectedPlan === plan.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <Button 
            size="lg" 
            className="min-w-[200px]"
            disabled={!selectedPlan || isActivating}
            onClick={handleActivateLicense}
          >
            {isActivating ? (
              'Ativando...'
            ) : (
              <>
                <Calendar className="h-4 w-4 mr-2" />
                Ativar Licença
              </>
            )}
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            * Em ambiente de demonstração, a licença é ativada instantaneamente.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
