import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Leaf, RefreshCw, MessageCircle, UserPlus, ClipboardList, Utensils, TrendingUp, ChevronDown, Trophy, BarChart3, Flame, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import heroImage from '@/assets/hero-nutrition.png';
import { useRef, useEffect, useState } from 'react';

// Hook to detect mobile devices
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};

// Animation variants for staggered children - optimized for mobile
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 14,
    },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 120,
      damping: 16,
    },
  },
};

export default function Index() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  
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

  // Smooth spring physics - lighter on mobile
  const springConfig = isMobile 
    ? { stiffness: 100, damping: 30, mass: 0.3 }
    : { stiffness: 50, damping: 20, mass: 0.5 };
  
  const smoothProgress = useSpring(scrollYProgress, springConfig);
  const smoothHeroProgress = useSpring(heroScrollProgress, { stiffness: 80, damping: 25 });
  
  // Hero parallax transforms - reduced on mobile for performance
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(smoothHeroProgress, [0, 0.6], [1, isMobile ? 0.95 : 0.9]);
  const heroImageY = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 40 : 120]);
  const heroImageRotate = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 2 : 5]);
  const heroTextY = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 30 : 80]);
  
  // Background orbs parallax - minimal on mobile
  const orb1Y = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 100 : 350]);
  const orb2Y = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 60 : 220]);
  const orb3Opacity = useTransform(heroScrollProgress, [0, 0.7], [isMobile ? 0.15 : 0.3, 0]);

  // Features section parallax - smoother entrance
  const smoothFeaturesProgress = useSpring(featuresScrollProgress, { stiffness: 60, damping: 20 });
  const featuresY = useTransform(smoothFeaturesProgress, [0, 0.5, 1], [isMobile ? 50 : 150, 0, isMobile ? -30 : -80]);
  const featuresOpacity = useTransform(featuresScrollProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.7]);

  // Steps section parallax - enhanced
  const smoothStepsProgress = useSpring(stepsScrollProgress, { stiffness: 60, damping: 20 });
  const stepsBackgroundY = useTransform(smoothStepsProgress, [0, 1], [isMobile ? 30 : 80, isMobile ? -30 : -80]);
  
  // Steps decorative elements parallax - defined at top level to avoid hooks rules violation
  const stepsDecor1Y = useTransform(smoothStepsProgress, [0, 1], [0, -120]);
  const stepsDecor2Y = useTransform(smoothStepsProgress, [0, 1], [0, -180]);
  const stepsDecor3Y = useTransform(smoothStepsProgress, [0, 1], [50, -100]);

  const features = [
    { icon: Target, title: 'Metas Personalizadas', description: 'Calcule suas necessidades calóricas e de macros automaticamente' },
    { icon: RefreshCw, title: 'Substituição Inteligente', description: 'Troque alimentos e veja o impacto nutricional em tempo real' },
    { icon: MessageCircle, title: 'Assistente IA', description: 'Tire dúvidas nutricionais com nosso assistente inteligente' },
    { icon: BarChart3, title: 'Relatórios de Progresso', description: 'Acompanhe sua evolução de peso e medidas com gráficos detalhados' },
    { icon: Trophy, title: 'Gamificação', description: 'Mantenha a motivação com streaks de adesão e conquistas' },
    { icon: Flame, title: 'Registro Diário', description: 'Confirme suas refeições e monitore sua adesão ao plano' },
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

      {/* Hero Section with Mobile-Optimized Parallax */}
      <section ref={heroRef} className="relative overflow-hidden min-h-[85vh] sm:min-h-[90vh] flex items-center py-4 sm:py-0">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 dark:from-primary/10 dark:via-primary/5 dark:to-background" />
        
        {/* Background Orbs - Static on mobile, parallax on desktop */}
        {isMobile ? (
          <>
            <div className="absolute top-10 left-4 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-40" />
            <div className="absolute bottom-10 right-4 w-40 h-40 bg-accent/30 rounded-full blur-3xl opacity-30" />
          </>
        ) : (
          <>
            <motion.div 
              style={{ y: orb1Y }}
              className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl opacity-60" 
            />
            <motion.div 
              style={{ y: orb2Y }}
              className="absolute bottom-10 right-10 w-96 h-96 bg-accent/30 rounded-full blur-3xl opacity-40" 
            />
            <motion.div 
              style={{ opacity: orb3Opacity }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl" 
            />
          </>
        )}

        {/* Main Content - No parallax on mobile */}
        {isMobile ? (
          <main className="container mx-auto px-4 py-6 relative z-10">
            <div className="grid gap-6 items-center">
              {/* Text Content - Static on mobile */}
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-xs font-medium mb-4 border border-primary/20">
                  <Leaf className="w-3 h-3" /> Planejamento alimentar com IA
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-4 leading-tight">
                  Nutrição inteligente para seus <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">objetivos</span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6">
                  Crie planos alimentares personalizados, substitua alimentos e entenda o impacto de cada escolha na sua saúde.
                </p>
                <div className="flex flex-col gap-3 justify-center">
                  <Link to="/signup">
                    <Button variant="hero" size="lg" className="text-sm w-full group">
                      Começar agora 
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <a href="#como-funciona">
                    <Button variant="outline" size="lg" className="text-sm w-full group">
                      Como funciona 
                      <ChevronDown className="w-4 h-4 ml-2 group-hover:translate-y-1 transition-transform" />
                    </Button>
                  </a>
                </div>
              </div>
              
              {/* Hero Image - Static on mobile */}
              <div className="relative order-first">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-3/4 bg-primary/30 rounded-full blur-2xl opacity-50" />
                </div>
                <img 
                  src={heroImage} 
                  alt="NutriPlan - Planejamento alimentar inteligente" 
                  className="w-full h-auto max-w-[280px] mx-auto drop-shadow-xl relative z-10"
                />
              </div>
            </div>
          </main>
        ) : (
          <motion.main 
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="container mx-auto px-6 lg:px-12 xl:px-20 py-16 lg:py-20 relative z-10"
          >
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 xl:gap-24 items-center max-w-7xl mx-auto">
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium mb-6 border border-primary/20"
                  >
                    <Leaf className="w-4 h-4" /> Planejamento alimentar com IA
                  </motion.div>
                  <motion.h1 
                    variants={itemVariants}
                    className="text-4xl lg:text-5xl xl:text-7xl font-bold text-foreground mb-8 leading-tight"
                  >
                    Nutrição inteligente para seus <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">objetivos</span>
                  </motion.h1>
                  <motion.p 
                    variants={itemVariants}
                    className="text-lg xl:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10"
                  >
                    Crie planos alimentares personalizados, substitua alimentos e entenda o impacto de cada escolha na sua saúde.
                  </motion.p>
                  <motion.div 
                    variants={itemVariants}
                    className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
                  >
                    <Link to="/signup">
                      <Button variant="hero" size="lg" className="text-base w-full sm:w-auto group">
                        Começar agora 
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <a href="#como-funciona">
                      <Button variant="outline" size="lg" className="text-base w-full sm:w-auto group">
                        Como funciona 
                        <ChevronDown className="w-4 h-4 ml-2 group-hover:translate-y-1 transition-transform" />
                      </Button>
                    </a>
                  </motion.div>
                </motion.div>
              </motion.div>
              
              {/* Hero Image with Parallax */}
              <motion.div
                style={{ y: heroImageY, rotate: heroImageRotate }}
                className="relative order-first lg:order-last"
              >
                <motion.div 
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  animate={{ 
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.8, 0.4]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="w-4/5 h-4/5 bg-primary/40 rounded-full blur-3xl" />
                </motion.div>
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
                    className="w-full h-auto max-w-lg lg:max-w-xl xl:max-w-3xl mx-auto drop-shadow-2xl relative z-10"
                  />
                </motion.div>
              </motion.div>
            </div>
          </motion.main>
        )}

        {/* Scroll indicator - hidden on mobile */}
        {!isMobile && (
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
        )}
      </section>

      {/* Features Grid - No parallax on mobile */}
      <section ref={featuresRef} className="relative py-20 sm:py-32 overflow-hidden bg-muted/30">
        {/* Background decoration with parallax - desktop only */}
        {!isMobile && (
          <motion.div
            style={{ y: featuresY }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
          </motion.div>
        )}

        {isMobile ? (
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-foreground mb-3">
                Recursos inteligentes
              </h2>
              <p className="text-muted-foreground text-xs px-2">
                Ferramentas poderosas para transformar sua alimentação
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-5xl mx-auto">
              {features.map((f) => (
                <div 
                  key={f.title}
                  className="card-elevated rounded-xl p-3 text-left backdrop-blur-sm bg-card/80 border border-border/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-2">
                    <f.icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 text-xs leading-tight">{f.title}</h3>
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            style={{ opacity: featuresOpacity }}
            className="container mx-auto px-6 lg:px-12 xl:px-20 relative z-10"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-6">
                Recursos inteligentes
              </h2>
              <p className="text-muted-foreground max-w-3xl mx-auto text-lg xl:text-xl">
                Ferramentas poderosas para transformar sua alimentação
              </p>
            </motion.div>

            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 xl:gap-10 max-w-7xl mx-auto"
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
                  className="card-elevated rounded-2xl p-8 xl:p-10 text-left cursor-pointer backdrop-blur-sm bg-card/80 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="w-14 h-14 xl:w-16 xl:h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
                    <f.icon className="w-7 h-7 xl:w-8 xl:h-8 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg xl:text-xl leading-tight">{f.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{f.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </section>

      {/* How It Works Section - No parallax on mobile */}
      <section ref={stepsRef} id="como-funciona" className="relative py-20 sm:py-32 overflow-hidden">
        {/* Background - Static on mobile, parallax on desktop */}
        {isMobile ? (
          <div className="absolute inset-0 bg-muted/30" />
        ) : (
          <>
            <motion.div
              style={{ y: stepsBackgroundY }}
              className="absolute inset-0 bg-muted/30"
            />
            <motion.div
              style={{ y: stepsDecor1Y }}
              className="absolute top-20 right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl"
            />
            <motion.div
              style={{ y: stepsDecor2Y }}
              className="absolute bottom-20 left-10 w-60 h-60 bg-accent/10 rounded-full blur-3xl"
            />
            <motion.div
              style={{ y: stepsDecor3Y }}
              className="absolute top-1/2 right-1/4 w-32 h-32 bg-primary/5 rounded-full blur-2xl hidden lg:block"
            />
          </>
        )}

        <div className="container mx-auto px-6 lg:px-12 xl:px-20 relative z-10">
          {isMobile ? (
            <>
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-foreground mb-3">
                  Como funciona
                </h2>
                <p className="text-muted-foreground text-xs px-2">
                  Em 4 passos simples, você terá um plano alimentar personalizado.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-6xl mx-auto">
                {steps.map((step) => (
                  <div key={step.number} className="relative">
                    <div className="bg-card/80 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-border/50 h-full relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md">
                          <step.icon className="w-5 h-5 relative z-10" />
                        </div>
                        <span className="text-2xl font-bold text-primary/20">
                          {step.number}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1 text-xs leading-tight">{step.title}</h3>
                      <p className="text-[10px] text-muted-foreground leading-snug line-clamp-3">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center mt-8">
                <Link to="/signup">
                  <Button variant="hero" size="lg" className="group text-sm">
                    Criar minha conta grátis 
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16"
              >
                <h2 className="text-3xl lg:text-4xl xl:text-5xl font-bold text-foreground mb-6">
                  Como funciona
                </h2>
                <p className="text-muted-foreground max-w-3xl mx-auto text-lg xl:text-xl">
                  Em 4 passos simples, você terá um plano alimentar personalizado.
                </p>
              </motion.div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 xl:gap-10 max-w-7xl mx-auto">
                {steps.map((step, i) => (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15, type: "spring", stiffness: 120 }}
                    whileHover={{ y: -8 }}
                    className="relative"
                  >
                    {/* Connector Line - Desktop only */}
                    {i < steps.length - 1 && (
                      <motion.div 
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.15 + 0.3, duration: 0.5 }}
                        className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-primary/10 origin-left" 
                      />
                    )}
                    
                    <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 xl:p-10 shadow-lg border border-border/50 h-full relative z-10 hover:border-primary/30 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 xl:w-18 xl:h-18 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md relative overflow-hidden">
                          <step.icon className="w-7 h-7 xl:w-8 xl:h-8 relative z-10" />
                        </div>
                        <span className="text-5xl xl:text-6xl font-bold text-primary/20">
                          {step.number}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-3 text-xl xl:text-2xl leading-tight">{step.title}</h3>
                      <p className="text-base text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="text-center mt-16"
              >
                <Link to="/signup">
                  <Button variant="hero" size="lg" className="group text-lg px-8 py-6">
                    Criar minha conta grátis 
                    <ArrowRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </motion.div>
            </>
          )}
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
