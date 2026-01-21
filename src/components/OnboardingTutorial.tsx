import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Sparkles, Target, Utensils, RefreshCw, MessageCircle, BarChart3, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface TutorialStep {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  features?: string[];
  highlight?: 'free' | 'paid';
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Bem-vindo ao NutriPlan! 🎉',
    description: 'Seu assistente de nutrição inteligente que vai te ajudar a alcançar seus objetivos de saúde. Vamos conhecer as funcionalidades?',
  },
  {
    id: 'goals',
    icon: Target,
    title: 'Metas Personalizadas',
    description: 'Com base no seu perfil (peso, altura, idade, objetivo), calculamos automaticamente suas necessidades calóricas e de macronutrientes usando a fórmula Mifflin-St Jeor.',
    features: [
      'Cálculo automático de calorias diárias',
      'Distribuição ideal de proteínas, carboidratos e gorduras',
      'Ajuste por nível de atividade física',
    ],
    highlight: 'free',
  },
  {
    id: 'meal-plan',
    icon: Utensils,
    title: 'Plano Alimentar com IA',
    description: 'Nossa inteligência artificial cria um plano alimentar completo e personalizado, respeitando suas preferências e restrições alimentares.',
    features: [
      'Refeições balanceadas para o dia todo',
      'Opções variadas para cada refeição',
      'Quantidades calculadas em gramas',
    ],
    highlight: 'free',
  },
  {
    id: 'substitution',
    icon: RefreshCw,
    title: 'Substituição Inteligente',
    description: 'Não gostou de algum alimento? Troque por outro equivalente e veja o impacto nutricional em tempo real. Mantenha os macros equilibrados!',
    features: [
      'Sugestões de substituições equivalentes',
      'Visualização do impacto nos macros',
      'Manutenção do equilíbrio nutricional',
    ],
    highlight: 'paid',
  },
  {
    id: 'chat',
    icon: MessageCircle,
    title: 'Chat com IA Nutricional',
    description: 'Tire suas dúvidas sobre nutrição com nosso assistente inteligente. Ele conhece seu plano e pode dar orientações personalizadas.',
    features: [
      'Respostas baseadas no seu perfil',
      'Dicas de alimentação saudável',
      'Esclarecimento de dúvidas nutricionais',
    ],
    highlight: 'paid',
  },
  {
    id: 'tracking',
    icon: BarChart3,
    title: 'Acompanhe seu Progresso',
    description: 'Confirme suas refeições diariamente e acompanhe sua aderência ao plano. Visualize estatísticas e evolução ao longo do tempo.',
    features: [
      'Confirmação de refeições consumidas',
      'Gráficos de aderência ao plano',
      'Histórico de consumo',
    ],
    highlight: 'free',
  },
  {
    id: 'done',
    icon: CheckCircle2,
    title: 'Pronto para começar!',
    description: 'Você já conhece as principais funcionalidades. Agora é só completar seu perfil no onboarding e seu primeiro plano alimentar será gerado automaticamente!',
  },
];

interface OnboardingTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingTutorial({ onComplete, onSkip }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const isLastStep = currentStep === tutorialSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    setIsVisible(false);
    setTimeout(onSkip, 300);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep]);

  const Icon = step.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header with close button */}
            <div className="absolute top-4 right-4 z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSkip}
                className="h-8 w-8 rounded-full hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress bar */}
            <div className="px-6 pt-6">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {currentStep + 1} de {tutorialSteps.length}
              </p>
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-6 pt-4"
              >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                    step.highlight === 'paid' 
                      ? 'bg-gradient-to-br from-amber-500/20 to-orange-500/20' 
                      : 'bg-primary/10'
                  }`}>
                    <Icon className={`w-8 h-8 ${
                      step.highlight === 'paid' ? 'text-amber-500' : 'text-primary'
                    }`} />
                  </div>
                </div>

                {/* Badge for paid features */}
                {step.highlight === 'paid' && (
                  <div className="flex justify-center mb-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      ✨ Recurso Premium
                    </span>
                  </div>
                )}

                {step.highlight === 'free' && (
                  <div className="flex justify-center mb-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                      ✓ Disponível no plano gratuito
                    </span>
                  </div>
                )}

                {/* Title & Description */}
                <h2 className="text-xl font-bold text-foreground text-center mb-2">
                  {step.title}
                </h2>
                <p className="text-muted-foreground text-center text-sm leading-relaxed mb-4">
                  {step.description}
                </p>

                {/* Features list */}
                {step.features && (
                  <ul className="space-y-2 mb-4">
                    {step.features.map((feature, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="px-6 pb-6 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={isFirstStep}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>

              <Button
                variant="default"
                onClick={handleNext}
                className="flex-1"
              >
                {isLastStep ? 'Começar!' : 'Próximo'}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>

            {/* Skip link */}
            <div className="px-6 pb-4 text-center">
              <button
                onClick={handleSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Pular tutorial (ESC)
              </button>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-1.5 pb-6">
              {tutorialSteps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentStep 
                      ? 'bg-primary w-6' 
                      : index < currentStep 
                        ? 'bg-primary/50' 
                        : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
