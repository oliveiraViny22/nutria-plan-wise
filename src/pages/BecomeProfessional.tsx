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
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggleSimple } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
  const { accountType, isSubscribed, openCustomerPortal } = useSubscription();
  const isProfessionalActive = isSubscribed && accountType === 'professional';

  const [isActivating, setIsActivating] = useState(false);

  const handleActivateLicense = async () => {
    if (isProfessionalActive) {
      toast({
        title: 'Assinatura já ativa',
        description: 'Sua assinatura profissional já está ativa. Você pode acessar o painel ou gerenciar sua assinatura.',
      });
      return;
    }

    if (!user) return;

    setIsActivating(true);
    try {
      // Redirect to Stripe checkout for payment - always monthly
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          plan_type: 'professional',
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
      <header className="sticky top-0 z-50 glass border-b pt-safe">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold truncate">Seja Profissional</h1>
          <ThemeToggleSimple />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-8 sm:space-y-12 pb-safe">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-2xl mx-auto"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 mb-4 sm:mb-6">
            <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
            Gerencie seus alunos com o NutriAI
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground px-2">
            Torne-se um profissional e tenha controle total sobre os planos alimentares dos seus alunos, acompanhando seu progresso em tempo real.
          </p>
        </motion.div>

        {/* Benefits */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6"
        >
          {BENEFITS.map((benefit, index) => (
            <Card key={index} className="card-elevated">
              <CardContent className="pt-5 sm:pt-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <benefit.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5 sm:mb-2 text-sm sm:text-base">{benefit.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{benefit.description}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Pricing - Single Monthly Plan */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4 sm:space-y-6"
        >
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2">Plano Profissional</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Comece a gerenciar seus alunos hoje mesmo
            </p>
          </div>

          <Card className="max-w-md mx-auto border-primary shadow-lg shadow-primary/20">
            <CardHeader className="text-center pb-3 sm:pb-4">
              <CardTitle className="text-lg sm:text-xl">Mensal</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Até 50 alunos ativos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
              <div className="text-center">
                <span className="text-3xl sm:text-4xl font-bold">R$ 99,00</span>
                <span className="text-muted-foreground text-sm sm:text-base">/mês</span>
              </div>
              <ul className="space-y-2 sm:space-y-3">
                {[
                  'Até 50 alunos ativos',
                  'Acesso aos planos dos alunos',
                  'Gestão de progresso',
                  'Suporte prioritário',
                  'Relatórios avançados',
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs sm:text-sm">
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          {isProfessionalActive ? (
            <Card className="card-elevated max-w-xl mx-auto text-left">
              <CardContent className="pt-6 space-y-4">
                <h3 className="text-lg font-semibold">Sua assinatura profissional está ativa</h3>
                <p className="text-sm text-muted-foreground">
                  Acesse agora o Painel Profissional para gerenciar alunos e acompanhar dietas.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" onClick={() => navigate('/professional')}>
                    Ir para o Painel
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await openCustomerPortal();
                      } catch {
                        toast({
                          variant: 'destructive',
                          title: 'Erro',
                          description: 'Não foi possível abrir o gerenciamento da assinatura.',
                        });
                      }
                    }}
                  >
                    Gerenciar assinatura
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Button 
                size="lg" 
                className="min-w-[200px]"
                disabled={isActivating}
                onClick={handleActivateLicense}
              >
                {isActivating ? (
                  'Ativando...'
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    Ativar Licença - R$ 99/mês
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                * Complete o pagamento para ativar sua licença profissional.
              </p>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
