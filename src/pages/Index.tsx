import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Leaf, Target, RefreshCw, MessageCircle, UserPlus, ClipboardList, Utensils, TrendingUp, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  
  // Main scroll progress for the entire page
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Hero section parallax
  const { scrollYProgress: heroScrollProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  // Features section parallax
  const { scrollYProgress: featuresScrollProgress } = useScroll({
    target: featuresRef,
    offset: ["start end", "end start"],
  });

  // Steps section parallax
  const { scrollYProgress: stepsScrollProgress } = useScroll({
    target: stepsRef,
    offset: ["start end", "end start"],
  });

  // Smooth spring physics for scroll values
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  
  // Hero parallax transforms
  const heroY = useTransform(heroScrollProgress, [0, 1], [0, 200]);
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.6], [1, 0]);
  const heroScale = useTransform(heroScrollProgress, [0, 0.5], [1, 0.95]);
  const heroImageY = useTransform(heroScrollProgress, [0, 1], [0, 80]);
  const heroTextY = useTransform(heroScrollProgress, [0, 1], [0, 50]);
  
  // Background orbs parallax (different speeds for depth)
  const orb1Y = useTransform(heroScrollProgress, [0, 1], [0, 250]);
  const orb2Y = useTransform(heroScrollProgress, [0, 1], [0, 180]);
  const orb3Y = useTransform(heroScrollProgress, [0, 1], [0, 300]);
  const orb1Scale = useTransform(heroScrollProgress, [0, 0.5], [1, 1.2]);
  const orb2Scale = useTransform(heroScrollProgress, [0, 0.5], [1, 0.8]);

  // Features section parallax
  const featuresY = useTransform(featuresScrollProgress, [0, 1], [100, -50]);
  const featuresOpacity = useTransform(featuresScrollProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0.8]);

  // Steps section parallax
  const stepsBackgroundY = useTransform(stepsScrollProgress, [0, 1], [50, -50]);

  // Floating icons parallax
  const floatingIcon1Y = useTransform(smoothProgress, [0, 1], [0, -100]);
  const floatingIcon2Y = useTransform(smoothProgress, [0, 1], [0, -150]);

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

  return (
    <div ref={containerRef} className="min-h-screen overflow-x-hidden">
      {/* Fixed Header with blur on scroll */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
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
        </div>
      </motion.header>

      {/* Spacer for fixed header */}
      <div className="h-14 sm:h-16" />

      {/* Hero Section with Enhanced Parallax */}
      <section ref={heroRef} className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 dark:from-primary/10 dark:via-primary/5 dark:to-background" />
        
        {/* Parallax Background Orbs */}
        <motion.div 
          style={{ y: orb1Y, scale: orb1Scale }}
          className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-60" 
        />
        <motion.div 
          style={{ y: orb2Y, scale: orb2Scale }}
          className="absolute bottom-10 right-10 w-96 h-96 bg-accent/30 rounded-full blur-3xl opacity-40" 
        />
        <motion.div 
          style={{ y: orb3Y }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl opacity-30" 
        />

        {/* Floating decorative elements */}
        <motion.div
          style={{ y: floatingIcon1Y }}
          className="absolute top-40 right-[20%] hidden lg:block"
        >
          <div className="w-8 h-8 rounded-full bg-accent/20 backdrop-blur-sm flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
        </motion.div>
        <motion.div
          style={{ y: floatingIcon2Y }}
          className="absolute bottom-40 left-[15%] hidden lg:block"
        >
          <div className="w-6 h-6 rounded-full bg-primary/20 backdrop-blur-sm" />
        </motion.div>
        
        <motion.main 
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="container mx-auto px-4 py-8 sm:py-12 lg:py-16 relative z-10"
        >
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Text Content with Parallax */}
            <motion.div 
              style={{ y: heroTextY }}
              className="text-center lg:text-left"
            >
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div 
                  variants={itemVariants}
                  className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-primary/20"
                >
                  <Leaf className="w-3 h-3 sm:w-4 sm:h-4" /> Planejamento alimentar com IA
                </motion.div>
                <motion.h1 
                  variants={itemVariants}
                  className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-foreground mb-4 sm:mb-6 leading-tight"
                >
                  Nutrição inteligente para seus <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">objetivos</span>
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
                    <Button variant="hero" size="lg" className="text-sm sm:text-base w-full sm:w-auto group">
                      Começar agora 
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <a href="#como-funciona">
                    <Button variant="outline" size="lg" className="text-sm sm:text-base w-full sm:w-auto group">
                      Como funciona 
                      <ChevronDown className="w-4 h-4 ml-2 group-hover:translate-y-1 transition-transform" />
                    </Button>
                  </a>
                </motion.div>
              </motion.div>
            </motion.div>
            
            {/* Hero Image with Parallax */}
            <motion.div
              style={{ y: heroImageY }}
              className="relative order-first lg:order-last"
            >
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                className="relative"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <img 
                  src={heroImage} 
                  alt="NutriPlan - Planejamento alimentar inteligente" 
                  className="w-full h-auto max-w-xs sm:max-w-sm lg:max-w-lg mx-auto drop-shadow-2xl"
                />
                {/* Floating elements with enhanced parallax */}
                <motion.div
                  style={{ y: floatingIcon1Y }}
                  animate={{ 
                    rotate: [0, 5, 0, -5, 0],
                  }}
                  transition={{ 
                    duration: 6, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -top-4 -right-4 w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-accent to-accent/60 rounded-2xl shadow-lg flex items-center justify-center backdrop-blur-sm"
                >
                  <Target className="w-8 h-8 sm:w-10 sm:h-10 text-accent-foreground" />
                </motion.div>
                <motion.div
                  style={{ y: floatingIcon2Y }}
                  animate={{ 
                    rotate: [0, -5, 0, 5, 0],
                  }}
                  transition={{ 
                    duration: 7, 
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1
                  }}
                  className="absolute -bottom-4 -left-4 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-primary to-primary/60 rounded-xl shadow-lg flex items-center justify-center backdrop-blur-sm"
                >
                  <Leaf className="w-6 h-6 sm:w-8 sm:h-8 text-primary-foreground" />
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.main>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1.5 h-2.5 bg-muted-foreground/50 rounded-full"
            />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Grid with Parallax */}
      <section ref={featuresRef} className="relative py-16 sm:py-24 overflow-hidden">
        {/* Background decoration */}
        <motion.div
          style={{ y: featuresY }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        </motion.div>

        <motion.div
          style={{ opacity: featuresOpacity }}
          className="container mx-auto px-4 relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Recursos inteligentes
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              Ferramentas poderosas para transformar sua alimentação
            </p>
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto"
          >
            {features.map((f, index) => (
              <motion.div 
                key={f.title} 
                variants={itemVariants}
                custom={index}
                whileHover={{ 
                  y: -12, 
                  scale: 1.03,
                  transition: { type: "spring", stiffness: 400 }
                }}
                className="card-elevated rounded-2xl p-4 sm:p-6 text-left cursor-pointer backdrop-blur-sm bg-card/80 border border-border/50 hover:border-primary/30 transition-colors"
              >
                <motion.div 
                  whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                  transition={{ duration: 0.5 }}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-3 sm:mb-4"
                >
                  <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </motion.div>
                <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">{f.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works Section with Parallax */}
      <section ref={stepsRef} id="como-funciona" className="relative py-16 sm:py-24 overflow-hidden">
        {/* Parallax Background */}
        <motion.div
          style={{ y: stepsBackgroundY }}
          className="absolute inset-0 bg-muted/30"
        />
        
        {/* Decorative elements */}
        <motion.div
          style={{ y: useTransform(stepsScrollProgress, [0, 1], [0, -80]) }}
          className="absolute top-20 right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl"
        />
        <motion.div
          style={{ y: useTransform(stepsScrollProgress, [0, 1], [0, -120]) }}
          className="absolute bottom-20 left-10 w-60 h-60 bg-accent/10 rounded-full blur-3xl"
        />

        <div className="container mx-auto px-4 relative z-10">
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
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, type: "spring", stiffness: 100 }}
                whileHover={{ y: -8 }}
                className="relative"
              >
                {/* Connector Line - Hidden on mobile and last item */}
                {i < steps.length - 1 && (
                  <motion.div 
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 + 0.3, duration: 0.5 }}
                    className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-primary/10 origin-left" 
                  />
                )}
                
                <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-border/50 h-full relative z-10 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-4 mb-4">
                    <motion.div 
                      whileHover={{ rotate: 360 }}
                      transition={{ duration: 0.6 }}
                      className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md"
                    >
                      <step.icon className="w-6 h-6" />
                    </motion.div>
                    <span className="text-4xl font-bold text-primary/20">{step.number}</span>
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.6 }}
            className="text-center mt-12"
          >
            <Link to="/signup">
              <Button variant="hero" size="lg" className="group">
                Criar minha conta grátis 
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border">
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
