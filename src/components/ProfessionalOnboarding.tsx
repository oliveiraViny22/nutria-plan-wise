import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  Utensils, 
  BarChart3, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Users,
  FileText,
  History,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

interface ProfessionalOnboardingProps {
  onComplete: () => void;
}

export function ProfessionalOnboarding({ onComplete }: ProfessionalOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();

  const steps: OnboardingStep[] = [
    {
      id: 0,
      title: 'Bem-vindo ao Painel Profissional!',
      description: 'Vamos te guiar pelas principais funcionalidades.',
      icon: Sparkles,
      content: (
        <div className="space-y-4 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          <p className="text-muted-foreground">
            Como profissional, você tem acesso a ferramentas exclusivas para 
            gerenciar seus alunos e criar planos alimentares personalizados.
          </p>
          <p className="text-sm text-muted-foreground">
            Este guia rápido vai te mostrar como usar cada recurso.
          </p>
        </div>
      ),
    },
    {
      id: 1,
      title: 'Passo 1: Criar Alunos',
      description: 'Adicione seus pacientes à plataforma.',
      icon: UserPlus,
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10 flex-shrink-0">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Cadastrar novos alunos</h4>
              <p className="text-sm text-muted-foreground">
                Acesse a página "Gerenciar Alunos" e clique em "Adicionar Aluno". 
                Você precisará do e-mail do aluno já cadastrado na plataforma.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10 flex-shrink-0">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Vincular alunos existentes</h4>
              <p className="text-sm text-muted-foreground">
                Busque pelo e-mail e vincule o aluno à sua conta. 
                Ele aparecerá na sua lista de alunos ativos.
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium text-primary mb-1">💡 Dica</p>
            <p className="text-muted-foreground">
              Seus alunos receberão automaticamente os planos que você criar para eles.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 2,
      title: 'Passo 2: Gerar Planos Alimentares',
      description: 'Crie dietas personalizadas com IA.',
      icon: Utensils,
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-green-500/10 flex-shrink-0">
              <Utensils className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Gerar plano com IA</h4>
              <p className="text-sm text-muted-foreground">
                Clique em um aluno, acesse o perfil dele e use o botão 
                "Gerar Novo Plano" para criar uma dieta personalizada.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10 flex-shrink-0">
              <FileText className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Personalização completa</h4>
              <p className="text-sm text-muted-foreground">
                Configure calorias, macros, restrições alimentares e preferências 
                antes de gerar o plano.
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium text-primary mb-1">💡 Dica</p>
            <p className="text-muted-foreground">
              Você pode substituir alimentos e ajustar porções após gerar o plano.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 3,
      title: 'Passo 3: Acompanhar Histórico',
      description: 'Monitore o progresso dos seus alunos.',
      icon: BarChart3,
      content: (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 flex-shrink-0">
              <History className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Histórico de planos</h4>
              <p className="text-sm text-muted-foreground">
                Veja todos os planos criados para cada aluno, com data de criação 
                e informações nutricionais.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 flex-shrink-0">
              <BarChart3 className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h4 className="font-medium mb-1">Métricas e relatórios</h4>
              <p className="text-sm text-muted-foreground">
                Acompanhe o número de dietas criadas, média calórica e 
                atividade de cada aluno.
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="font-medium text-primary mb-1">💡 Dica</p>
            <p className="text-muted-foreground">
              Use o dashboard profissional para ter uma visão geral de todos os alunos.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 4,
      title: 'Tudo pronto!',
      description: 'Você está pronto para começar.',
      icon: CheckCircle2,
      content: (
        <div className="space-y-4 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <p className="text-muted-foreground">
            Agora você conhece as principais funcionalidades do painel profissional.
          </p>
          <div className="grid grid-cols-3 gap-2 pt-4">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <UserPlus className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xs text-muted-foreground">Criar Alunos</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <Utensils className="w-5 h-5 mx-auto mb-1 text-green-500" />
              <p className="text-xs text-muted-foreground">Gerar Planos</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <BarChart3 className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-xs text-muted-foreground">Acompanhar</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (user) {
      await supabase
        .from('profiles')
        .update({ professional_onboarding_completed: true })
        .eq('user_id', user.id);
    }
    onComplete();
  };

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-xl border-primary/20">
          <CardContent className="pt-6">
            {/* Progress */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                <span>Passo {currentStep + 1} de {steps.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Step Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-foreground">
                    {currentStepData.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentStepData.description}
                  </p>
                </div>

                <div className="min-h-[280px]">
                  {currentStepData.content}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </Button>

              {isLastStep ? (
                <Button onClick={handleComplete} className="gap-2">
                  Começar a usar
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleNext} className="gap-2">
                  Próximo
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Skip */}
            {!isLastStep && (
              <div className="text-center mt-3">
                <button
                  onClick={handleComplete}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular tutorial
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
