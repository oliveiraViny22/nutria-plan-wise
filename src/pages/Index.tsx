import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Leaf, Target, RefreshCw, MessageCircle, UserPlus, ClipboardList, Utensils, TrendingUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImage from '@/assets/hero-nutrition.png';
import { useRef } from 'react';

// Animation variants for staggered children
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 12,
    },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function Index() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const features = [
    { icon: Target, title: 'Metas Personalizadas', description: 'Calcule suas necessidades calóricas e de macros automaticamente' },
    { icon: RefreshCw, title: 'Substituição Inteligente', description: 'Troque alimentos e veja o impacto nutricional em tempo real' },
    { icon: MessageCircle, title: 'Assistente IA', description: 'Tire dúvidas nutricionais com nosso assistente inteligente' },
  ];

  const steps = [
    { 
      number: '01', 
      icon: UserPlus, 
      title: 'Crie sua conta', 
      description: 'Cadastre-se gratuitamente e preencha seu perfil com dados como peso, altura e objetivo.' 
    },
    { 
      number: '02', 
      icon: ClipboardList, 
      title: 'Receba seu plano', 
      description: 'Nossa IA gera um plano alimentar personalizado com base nos seus dados e preferências.' 
    },
    { 
      number: '03', 
      icon: Utensils, 
      title: 'Siga e adapte', 
      description: 'Acompanhe suas refeições, faça substituições inteligentes e registre seu progresso.' 
    },
    { 
      number: '04', 
      icon: TrendingUp, 
      title: 'Alcance resultados', 
      description: 'Monitore sua evolução e ajuste seu objetivo conforme atinge suas metas.' 
    },
  ];

  const faqs = [
    {
      question: 'O NutriPlan é gratuito?',
      answer: 'Sim! Oferecemos um plano gratuito que permite criar planos alimentares personalizados. Para recursos avançados como substituições ilimitadas e assistente IA, temos planos pagos acessíveis.'
    },
    {
      question: 'Preciso de acompanhamento de nutricionista?',
      answer: 'O NutriPlan é uma ferramenta de planejamento alimentar e não substitui o acompanhamento profissional. Para condições de saúde específicas, recomendamos sempre consultar um nutricionista.'
    },
    {
      question: 'Como funciona a substituição de alimentos?',
      answer: 'Você pode trocar qualquer alimento do seu plano por opções equivalentes nutricionalmente. O sistema mostra o impacto da troca nos seus macros em tempo real.'
    },
    {
      question: 'Posso usar em dispositivos móveis?',
      answer: 'Sim! O NutriPlan é totalmente responsivo e pode ser instalado como um app no seu celular para acesso rápido e offline.'
    },
    {
      question: 'Como a IA personaliza meu plano?',
      answer: 'Nossa IA considera seu peso, altura, idade, nível de atividade, objetivo (emagrecer, manter ou ganhar massa) e preferências alimentares para criar um plano único para você.'
    },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="container mx-auto px-4 py-4 sm:py-6 flex items-center justify-between gap-2">
        <Logo size="lg" />
        <div className="flex items-center gap-1 sm:gap-3">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-4 touch-manipulation">
              Entrar
            </Button>
          </Link>
          <Link to="/signup">
            <Button variant="hero" size="sm" className="text-xs sm:text-sm px-2 sm:px-4 touch-manipulation">
              <span className="hidden xs:inline">Começar grátis</span>
              <span className="xs:hidden">Começar</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section with Gradient and Parallax */}
      <section ref={heroRef} className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 dark:from-primary/10 dark:via-primary/5 dark:to-background" />
        <motion.div 
          style={{ y: heroY }}
          className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-60" 
        />
        <motion.div 
          style={{ y: heroY }}
          className="absolute bottom-10 right-10 w-96 h-96 bg-accent/30 rounded-full blur-3xl opacity-40" 
        />
        
        <motion.main 
          style={{ opacity: heroOpacity }}
          className="container mx-auto px-4 py-8 sm:py-12 lg:py-16 relative z-10"
        >
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text Content */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center lg:text-left"
            >
              <motion.div 
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary/10 rounded-full text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6"
              >
                <Leaf className="w-3 h-3 sm:w-4 sm:h-4" /> Planejamento alimentar com IA
              </motion.div>
              <motion.h1 
                variants={itemVariants}
                className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight"
              >
                Nutrição inteligente para seus <span className="text-primary">objetivos</span>
              </motion.h1>
              <motion.p 
                variants={itemVariants}
                className="text-sm sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-6 sm:mb-8"
              >
                Crie planos alimentares personalizados, substitua alimentos e entenda o impacto de cada escolha na sua saúde.
              </motion.p>
              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
              >
                <Link to="/signup">
                  <Button variant="hero" size="lg" className="text-sm sm:text-base w-full sm:w-auto">
                    Começar agora <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
                  </Button>
                </Link>
                <a href="#como-funciona">
                  <Button variant="outline" size="lg" className="text-sm sm:text-base w-full sm:w-auto">
                    Como funciona <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              </motion.div>
            </motion.div>
            
            {/* Hero Image - Now visible on all devices */}
            <motion.div
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              className="relative order-first lg:order-last"
            >
              <motion.div 
                className="relative"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <img 
                  src={heroImage} 
                  alt="NutriPlan - Planejamento alimentar inteligente" 
                  className="w-full h-auto max-w-xs sm:max-w-sm lg:max-w-lg mx-auto drop-shadow-2xl"
                />
                {/* Floating elements for depth */}
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 2, 0]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -top-4 -right-4 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-accent to-accent/60 rounded-2xl shadow-lg flex items-center justify-center"
                >
                  <Target className="w-8 h-8 sm:w-10 sm:h-10 text-accent-foreground" />
                </motion.div>
                <motion.div
                  animate={{ 
                    y: [0, 10, 0],
                    rotate: [0, -2, 0]
                  }}
                  transition={{ 
                    duration: 5, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                  className="absolute -bottom-4 -left-4 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-primary/60 rounded-xl shadow-lg flex items-center justify-center"
                >
                  <Leaf className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.main>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto"
        >
          {features.map((f) => (
            <motion.div 
              key={f.title} 
              variants={itemVariants}
              whileHover={{ 
                y: -8, 
                scale: 1.02,
                transition: { type: "spring", stiffness: 300 }
              }}
              className="card-elevated rounded-2xl p-4 sm:p-6 text-left cursor-pointer"
            >
              <motion.div 
                whileHover={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4"
              >
                <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </motion.div>
              <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">{f.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* How It Works Section */}
      <section id="como-funciona" className="bg-muted/30 py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Como funciona
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              Em 4 passos simples, você terá um plano alimentar personalizado e pronto para seguir.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 max-w-6xl mx-auto">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {/* Connector Line - Hidden on mobile and last item */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-primary/10" />
                )}
                
                <div className="bg-card rounded-2xl p-6 shadow-lg border h-full relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md">
                      <step.icon className="w-6 h-6" />
                    </div>
                    <span className="text-4xl font-bold text-primary/20">{step.number}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mt-12"
          >
            <Link to="/signup">
              <Button variant="hero" size="lg">
                Criar minha conta grátis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Perguntas frequentes
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              Tire suas dúvidas sobre o NutriPlan e como ele pode ajudar você.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="max-w-3xl mx-auto"
          >
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, i) => (
                <AccordionItem 
                  key={i} 
                  value={`item-${i}`}
                  className="bg-card border rounded-xl px-6 shadow-sm"
                >
                  <AccordionTrigger className="text-left font-medium text-sm sm:text-base py-5 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-primary to-primary/80 py-16 sm:py-20">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
              Pronto para transformar sua alimentação?
            </h2>
            <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8 text-sm sm:text-base">
              Junte-se a milhares de pessoas que já estão alcançando seus objetivos com o NutriPlan.
            </p>
            <Link to="/signup">
              <Button 
                size="lg" 
                className="bg-background text-primary hover:bg-background/90 font-semibold shadow-lg"
              >
                Começar agora — é grátis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-8 border-t border-border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 NutriPlan. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
