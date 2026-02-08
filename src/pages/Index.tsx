import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { ArrowRight, Leaf, RefreshCw, MessageCircle, UserPlus, ClipboardList, Utensils, TrendingUp, ChevronDown, Trophy, BarChart3, Flame, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { HeroImage } from '@/components/OptimizedImage';

// Hero image from Supabase storage
const heroImage = 'https://tgprvcodlwyfxjbxirgh.supabase.co/storage/v1/object/public/lovable-uploads/lovable_1770559442602_6bff4026.png';
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

// Hook to detect large screens (3xl+)
const useIsLargeScreen = () => {
  const [isLarge, setIsLarge] = useState(false);
  
  useEffect(() => {
    const checkLarge = () => setIsLarge(window.innerWidth >= 1920);
    checkLarge();
    window.addEventListener('resize', checkLarge);
    return () => window.removeEventListener('resize', checkLarge);
  }, []);
  
  return isLarge;
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

// Enhanced progressive reveal for large screens
const progressiveRevealVariants = {
  hidden: { 
    opacity: 0, 
    y: 60,
    scale: 0.95,
    rotateX: 8,
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    rotateX: 0,
    transition: {
      type: "spring" as const,
      stiffness: 80,
      damping: 18,
      delay: i * 0.12,
    },
  }),
};

// Staggered card reveal with 3D effect for large screens
const card3DVariants = {
  hidden: { 
    opacity: 0, 
    y: 80,
    z: -100,
    rotateY: -5,
    scale: 0.9,
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    z: 0,
    rotateY: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 60,
      damping: 15,
      delay: i * 0.15,
    },
  }),
};

export default function Index() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const isLargeScreen = useIsLargeScreen();
  
  // Feature cards refs for individual scroll tracking
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  
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

  // Smooth spring physics - lighter on mobile, enhanced on large screens
  const springConfig = isMobile 
    ? { stiffness: 100, damping: 30, mass: 0.3 }
    : isLargeScreen
    ? { stiffness: 40, damping: 25, mass: 0.8 }
    : { stiffness: 50, damping: 20, mass: 0.5 };
  
  const smoothProgress = useSpring(scrollYProgress, springConfig);
  const smoothHeroProgress = useSpring(heroScrollProgress, { stiffness: 80, damping: 25 });
  
  // Hero parallax transforms - enhanced for large screens
  const heroOpacity = useTransform(heroScrollProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(smoothHeroProgress, [0, 0.6], [1, isMobile ? 0.95 : isLargeScreen ? 0.85 : 0.9]);
  const heroImageY = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 40 : isLargeScreen ? 200 : 120]);
  const heroImageRotate = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 2 : isLargeScreen ? 8 : 5]);
  const heroTextY = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 30 : isLargeScreen ? 120 : 80]);
  
  // Multi-layer parallax orbs - more layers for large screens
  const orb1Y = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 100 : isLargeScreen ? 500 : 350]);
  const orb2Y = useTransform(smoothHeroProgress, [0, 1], [0, isMobile ? 60 : isLargeScreen ? 350 : 220]);
  const orb3Y = useTransform(smoothHeroProgress, [0, 1], [0, isLargeScreen ? 250 : 150]);
  const orb4Y = useTransform(smoothHeroProgress, [0, 1], [0, isLargeScreen ? 180 : 100]);
  const orb3Opacity = useTransform(heroScrollProgress, [0, 0.7], [isMobile ? 0.15 : isLargeScreen ? 0.5 : 0.3, 0]);

  // Features section parallax - enhanced multi-layer for large screens
  const smoothFeaturesProgress = useSpring(featuresScrollProgress, { stiffness: 60, damping: 20 });
  const featuresY = useTransform(smoothFeaturesProgress, [0, 0.5, 1], [isMobile ? 50 : isLargeScreen ? 200 : 150, 0, isMobile ? -30 : isLargeScreen ? -120 : -80]);
  const featuresOpacity = useTransform(featuresScrollProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0.7]);
  
  // Feature cards individual parallax layers (large screens only)
  const featuresLayer1Y = useTransform(smoothFeaturesProgress, [0, 1], [100, -60]);
  const featuresLayer2Y = useTransform(smoothFeaturesProgress, [0, 1], [80, -40]);
  const featuresLayer3Y = useTransform(smoothFeaturesProgress, [0, 1], [60, -20]);
  const featuresRotateX = useTransform(smoothFeaturesProgress, [0, 0.5, 1], [5, 0, -3]);

  // Steps section parallax - enhanced
  const smoothStepsProgress = useSpring(stepsScrollProgress, { stiffness: 60, damping: 20 });
  const stepsBackgroundY = useTransform(smoothStepsProgress, [0, 1], [isMobile ? 30 : isLargeScreen ? 150 : 80, isMobile ? -30 : isLargeScreen ? -150 : -80]);
  
  // Steps decorative elements parallax - enhanced multi-layer
  const stepsDecor1Y = useTransform(smoothStepsProgress, [0, 1], [0, isLargeScreen ? -200 : -120]);
  const stepsDecor2Y = useTransform(smoothStepsProgress, [0, 1], [0, isLargeScreen ? -280 : -180]);
  const stepsDecor3Y = useTransform(smoothStepsProgress, [0, 1], [50, isLargeScreen ? -180 : -100]);
  const stepsDecor4Y = useTransform(smoothStepsProgress, [0, 1], [80, isLargeScreen ? -100 : -60]);
  const stepsDecor5Y = useTransform(smoothStepsProgress, [0, 1], [30, isLargeScreen ? -220 : -140]);
  
  // Steps cards 3D rotation for large screens
  const stepsRotateY = useTransform(smoothStepsProgress, [0, 0.5, 1], [-3, 0, 3]);
  const stepsPerspective = useTransform(smoothStepsProgress, [0, 0.5, 1], [1000, 1200, 1000]);
  
  // Additional large screen hero parallax transforms (defined unconditionally to respect hook rules)
  const heroOrb5Y = useTransform(smoothHeroProgress, [0, 1], [0, 280]);
  const heroOrb6Y = useTransform(smoothHeroProgress, [0, 1], [20, 400]);
  
  // Additional large screen features parallax transforms
  const featuresFloat1Y = useTransform(smoothFeaturesProgress, [0, 1], [40, -80]);
  const featuresFloat1Rotate = useTransform(smoothFeaturesProgress, [0, 1], [0, 15]);
  const featuresFloat2Y = useTransform(smoothFeaturesProgress, [0, 1], [60, -40]);
  const featuresFloat2Rotate = useTransform(smoothFeaturesProgress, [0, 1], [0, -10]);
  
  // Additional large screen steps parallax transforms
  const stepsFloat1Y = useTransform(smoothStepsProgress, [0, 1], [0, -160]);
  const stepsFloat1Rotate = useTransform(smoothStepsProgress, [0, 1], [0, 20]);
  const stepsFloat2Y = useTransform(smoothStepsProgress, [0, 1], [20, -120]);
  const stepsFloat2Rotate = useTransform(smoothStepsProgress, [0, 1], [15, -5]);
  const stepsFloat3Y = useTransform(smoothStepsProgress, [0, 1], [40, -200]);
  const stepsFloat3Scale = useTransform(smoothStepsProgress, [0, 0.5, 1], [0.8, 1.1, 0.9]);

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
    <div ref={containerRef} className="min-h-screen overflow-x-hidden w-full max-w-full">
      {/* Fixed Header with blur on scroll */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b border-border/50"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Logo size="lg" />
          <div className="flex items-center gap-1 xs:gap-2 sm:gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-xs sm:text-sm px-2 sm:px-4 min-h-[44px] touch-manipulation">
                Entrar
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="hero" size="sm" className="text-xs sm:text-sm px-2 xs:px-3 sm:px-4 min-h-[44px] touch-manipulation">
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
        
        {/* Background Orbs - Static on mobile, multi-layer parallax on desktop/large screens */}
        {isMobile ? (
          <>
            <div className="absolute top-10 left-4 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-40" />
            <div className="absolute bottom-10 right-4 w-40 h-40 bg-accent/30 rounded-full blur-3xl opacity-30" />
          </>
        ) : (
          <>
            {/* Layer 1 - Fastest moving, deepest background - constrained within viewport */}
            <motion.div 
              style={{ y: orb1Y }}
              className="absolute top-20 left-[2%] w-72 3xl:w-96 h-72 3xl:h-96 bg-primary/20 rounded-full blur-3xl opacity-60" 
            />
            {/* Layer 2 - Medium speed - constrained within viewport */}
            <motion.div 
              style={{ y: orb2Y }}
              className="absolute bottom-10 right-[2%] w-80 3xl:w-[400px] h-80 3xl:h-[400px] bg-accent/30 rounded-full blur-3xl opacity-40" 
            />
            {/* Layer 3 - Center glow - contained size */}
            <motion.div 
              style={{ opacity: orb3Opacity, y: orb3Y }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] 3xl:w-[700px] h-[500px] 3xl:h-[700px] bg-gradient-radial from-primary/10 to-transparent rounded-full blur-3xl" 
            />
            {/* Layer 4 - Large screens only - additional depth layers */}
            {isLargeScreen && (
              <>
                <motion.div 
                  style={{ y: orb4Y }}
                  className="absolute top-1/4 right-[15%] w-40 h-40 bg-primary/15 rounded-full blur-2xl opacity-50" 
                />
                <motion.div 
                  style={{ y: heroOrb5Y }}
                  className="absolute bottom-1/4 left-[20%] w-56 h-56 bg-accent/20 rounded-full blur-3xl opacity-35" 
                />
                <motion.div 
                  style={{ y: heroOrb6Y }}
                  className="absolute top-1/3 left-[15%] w-28 h-28 bg-primary/25 rounded-full blur-xl opacity-45" 
                />
              </>
            )}
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
                <h1 className="text-2xl xs:text-3xl font-bold text-foreground mb-4 leading-tight">
                  Nutrição inteligente para seus <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">objetivos</span>
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-6">
                  Crie planos alimentares personalizados, substitua alimentos e entenda o impacto de cada escolha na sua saúde.
                </p>
                <div className="flex flex-col xs:flex-row gap-3 justify-center">
                  <Link to="/signup">
                    <Button variant="hero" size="lg" className="text-sm w-full xs:w-auto min-h-[48px] group">
                      Começar agora 
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <a href="#como-funciona">
                    <Button variant="outline" size="lg" className="text-sm w-full xs:w-auto min-h-[48px] group">
                      Como funciona 
                      <ChevronDown className="w-4 h-4 ml-2 group-hover:translate-y-1 transition-transform" />
                    </Button>
                  </a>
                </div>
              </div>
              
              {/* Hero Image - Static on mobile, optimized loading */}
              <div className="relative order-first">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/4 h-3/4 bg-primary/30 rounded-full blur-2xl opacity-50" />
                </div>
                <HeroImage 
                  src={heroImage} 
                  alt="NutriPlan - Planejamento alimentar inteligente" 
                  className="w-full h-auto max-w-[280px] xs:max-w-xs sm:max-w-sm mx-auto drop-shadow-xl relative z-10"
                />
              </div>
            </div>
          </main>
        ) : (
          <motion.main 
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="container max-w-7xl 2xl:max-w-[1400px] 3xl:max-w-[1600px] 4xl:max-w-[1920px] mx-auto px-4 sm:px-6 py-12 md:py-16 lg:py-20 relative z-10"
          >
            {/* Centered Badge */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center mb-8 lg:mb-12"
            >
              <motion.div 
                variants={itemVariants}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full text-primary text-sm font-medium border border-primary/20"
              >
                <Leaf className="w-4 h-4" /> Planejamento alimentar com IA
              </motion.div>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 xl:gap-24 3xl:gap-32 items-center">
              {/* Text Content with Parallax - aligned to the left next to image */}
              <motion.div 
                style={{ y: heroTextY }}
                className="text-center md:text-left"
              >
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.h1 
                    variants={itemVariants}
                    className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-foreground mb-6 md:mb-8 leading-tight"
                  >
                    Nutrição inteligente para seus <span className="text-primary bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">objetivos</span>
                  </motion.h1>
                  <motion.p 
                    variants={itemVariants}
                    className="text-base md:text-lg xl:text-xl text-muted-foreground max-w-2xl mx-auto md:mx-0 mb-8 md:mb-10"
                  >
                    Crie planos alimentares personalizados, substitua alimentos e entenda o impacto de cada escolha na sua saúde.
                  </motion.p>
                  <motion.div 
                    variants={itemVariants}
                    className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start"
                  >
                    <Link to="/signup">
                      <Button variant="hero" size="lg" className="text-base w-full sm:w-auto min-h-[48px] xl:min-h-[52px] xl:px-8 group">
                        Começar agora 
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    <a href="#como-funciona">
                      <Button variant="outline" size="lg" className="text-base w-full sm:w-auto min-h-[48px] xl:min-h-[52px] group">
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
                className="relative order-first md:order-last"
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
                  <HeroImage 
                    src={heroImage} 
                    alt="NutriPlan - Planejamento alimentar inteligente" 
                    className="w-full h-auto max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl 2xl:max-w-3xl mx-auto drop-shadow-2xl relative z-10"
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

      {/* Features Grid - No parallax on mobile, enhanced multi-layer on large screens */}
      <section ref={featuresRef} className="relative py-20 sm:py-32 3xl:py-40 overflow-hidden bg-muted/30">
        {/* Background decoration with multi-layer parallax - desktop only */}
        {!isMobile && (
          <>
            {/* Layer 1 - Base background movement */}
            <motion.div
              style={{ y: featuresY }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute top-0 left-1/4 w-64 3xl:w-96 h-64 3xl:h-96 bg-primary/5 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-80 3xl:w-[450px] h-80 3xl:h-[450px] bg-accent/5 rounded-full blur-3xl" />
            </motion.div>
            
            {/* Large screen multi-layer parallax decorations */}
            {isLargeScreen && (
              <>
                {/* Layer 2 - Slower moving elements - contained positions */}
                <motion.div
                  style={{ y: featuresLayer1Y }}
                  className="absolute top-20 right-[5%] w-36 h-36 bg-primary/8 rounded-full blur-2xl pointer-events-none"
                />
                <motion.div
                  style={{ y: featuresLayer2Y }}
                  className="absolute bottom-32 left-[4%] w-48 h-48 bg-accent/8 rounded-full blur-2xl pointer-events-none"
                />
                {/* Layer 3 - Subtle floating elements - contained positions */}
                <motion.div
                  style={{ y: featuresLayer3Y }}
                  className="absolute top-1/2 right-[25%] w-20 h-20 bg-primary/10 rounded-full blur-xl pointer-events-none"
                />
                <motion.div
                  style={{ 
                    y: featuresFloat1Y,
                    rotate: featuresFloat1Rotate
                  }}
                  className="absolute bottom-1/4 right-[3%] w-16 h-16 border border-primary/20 rounded-2xl pointer-events-none"
                />
                <motion.div
                  style={{ 
                    y: featuresFloat2Y,
                    rotate: featuresFloat2Rotate
                  }}
                  className="absolute top-1/4 left-[5%] w-14 h-14 border border-accent/15 rounded-xl pointer-events-none"
                />
              </>
            )}
          </>
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

            <div className="grid grid-cols-2 gap-4 max-w-5xl mx-auto">
              {features.map((f) => (
                <div 
                  key={f.title}
                  className="card-elevated rounded-xl p-3 xs:p-4 text-left backdrop-blur-sm bg-card/80 border border-border/50"
                >
                  <div className="w-8 h-8 xs:w-10 xs:h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-2">
                    <f.icon className="w-4 h-4 xs:w-5 xs:h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 text-xs xs:text-sm leading-tight">{f.title}</h3>
                  <p className="text-[11px] xs:text-xs text-muted-foreground leading-snug line-clamp-3">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            style={{ opacity: featuresOpacity }}
            className="container max-w-7xl 2xl:max-w-[1400px] 3xl:max-w-[1600px] 4xl:max-w-[1920px] mx-auto px-4 sm:px-6 relative z-10"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12 md:mb-16 3xl:mb-20"
            >
              <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-5xl 3xl:text-6xl font-bold text-foreground mb-4 md:mb-6">
                Recursos inteligentes
              </h2>
              <p className="text-muted-foreground max-w-3xl 3xl:max-w-4xl mx-auto text-base md:text-lg xl:text-xl 3xl:text-2xl">
                Ferramentas poderosas para transformar sua alimentação
              </p>
            </motion.div>

            {/* Feature cards with progressive reveal and 3D effects on large screens */}
            <motion.div 
              style={isLargeScreen ? { 
                perspective: 1200,
                rotateX: featuresRotateX 
              } : undefined}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 xl:gap-10 3xl:gap-12 4xl:gap-16"
            >
              {features.map((f, index) => (
                <motion.div 
                  key={f.title} 
                  ref={(el) => (featureRefs.current[index] = el)}
                  variants={isLargeScreen ? card3DVariants : itemVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  custom={index}
                  whileHover={isLargeScreen ? { 
                    y: -12,
                    scale: 1.02,
                    rotateY: 2,
                    transition: { type: "spring", stiffness: 300, damping: 20 }
                  } : { y: -8 }}
                  className="card-elevated rounded-2xl p-6 md:p-8 xl:p-10 3xl:p-12 text-left backdrop-blur-sm bg-card/80 border border-border/50 transform-gpu"
                  style={{ transformStyle: isLargeScreen ? "preserve-3d" : undefined }}
                >
                  <motion.div 
                    className="w-14 h-14 xl:w-16 xl:h-16 3xl:w-20 3xl:h-20 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6"
                    whileHover={isLargeScreen ? { rotate: 5, scale: 1.1 } : undefined}
                    transition={{ type: "spring", stiffness: 400 }}
                  >
                    <f.icon className="w-7 h-7 xl:w-8 xl:h-8 3xl:w-10 3xl:h-10 text-primary" />
                  </motion.div>
                  <h3 className="font-semibold text-foreground mb-2 text-lg xl:text-xl 3xl:text-2xl leading-tight">{f.title}</h3>
                  <p className="text-base 3xl:text-lg text-muted-foreground leading-relaxed">{f.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </section>

      {/* How It Works Section - No parallax on mobile, enhanced multi-layer on large screens */}
      <section ref={stepsRef} id="como-funciona" className="relative py-20 sm:py-32 3xl:py-40 overflow-hidden">
        {/* Background - Static on mobile, multi-layer parallax on desktop */}
        {isMobile ? (
          <div className="absolute inset-0 bg-muted/30" />
        ) : (
          <>
            <motion.div
              style={{ y: stepsBackgroundY }}
              className="absolute inset-0 bg-muted/30"
            />
            {/* Layer 1 - Primary decorations - contained positions */}
            <motion.div
              style={{ y: stepsDecor1Y }}
              className="absolute top-20 right-[3%] w-36 3xl:w-56 h-36 3xl:h-56 bg-primary/10 rounded-full blur-3xl"
            />
            <motion.div
              style={{ y: stepsDecor2Y }}
              className="absolute bottom-20 left-[3%] w-52 3xl:w-72 h-52 3xl:h-72 bg-accent/10 rounded-full blur-3xl"
            />
            <motion.div
              style={{ y: stepsDecor3Y }}
              className="absolute top-1/2 right-[20%] w-28 3xl:w-40 h-28 3xl:h-40 bg-primary/5 rounded-full blur-2xl hidden lg:block"
            />
            
            {/* Large screen additional parallax layers - contained positions */}
            {isLargeScreen && (
              <>
                {/* Layer 2 - Slower moving geometric shapes */}
                <motion.div
                  style={{ y: stepsDecor4Y }}
                  className="absolute top-1/3 left-[15%] w-20 h-20 bg-primary/8 rounded-2xl blur-xl pointer-events-none"
                />
                <motion.div
                  style={{ y: stepsDecor5Y }}
                  className="absolute bottom-1/3 right-[12%] w-32 h-32 bg-accent/8 rounded-full blur-2xl pointer-events-none"
                />
                {/* Layer 3 - Subtle floating geometric accents */}
                <motion.div
                  style={{ 
                    y: stepsFloat1Y,
                    rotate: stepsFloat1Rotate
                  }}
                  className="absolute top-1/4 right-[5%] w-10 h-10 border-2 border-primary/15 rounded-lg pointer-events-none"
                />
                <motion.div
                  style={{ 
                    y: stepsFloat2Y,
                    rotate: stepsFloat2Rotate
                  }}
                  className="absolute bottom-1/4 left-[6%] w-8 h-8 border border-accent/20 rounded-full pointer-events-none"
                />
                <motion.div
                  style={{ 
                    y: stepsFloat3Y,
                    scale: stepsFloat3Scale
                  }}
                  className="absolute top-2/3 left-[25%] w-6 h-6 bg-primary/12 rounded-full blur-sm pointer-events-none"
                />
              </>
            )}
          </>
        )}

        <div className="container max-w-7xl 2xl:max-w-[1400px] 3xl:max-w-[1600px] 4xl:max-w-[1920px] mx-auto px-4 sm:px-6 relative z-10">
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

              <div className="grid grid-cols-2 gap-4 max-w-6xl mx-auto">
                {steps.map((step) => (
                  <div key={step.number} className="relative">
                    <div className="bg-card/80 backdrop-blur-sm rounded-xl p-3 xs:p-4 shadow-lg border border-border/50 h-full relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 xs:w-12 xs:h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md">
                          <step.icon className="w-5 h-5 xs:w-6 xs:h-6 relative z-10" />
                        </div>
                        <span className="text-2xl xs:text-3xl font-bold text-primary/20">
                          {step.number}
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1 text-xs xs:text-sm leading-tight">{step.title}</h3>
                      <p className="text-[11px] xs:text-xs text-muted-foreground leading-snug line-clamp-3">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center mt-8">
                <Link to="/signup">
                  <Button variant="hero" size="lg" className="group text-sm min-h-[48px]">
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
                className="text-center mb-12 md:mb-16"
              >
                <h2 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-5xl font-bold text-foreground mb-4 md:mb-6">
                  Como funciona
                </h2>
                <p className="text-muted-foreground max-w-3xl mx-auto text-base md:text-lg xl:text-xl">
                  Em 4 passos simples, você terá um plano alimentar personalizado.
                </p>
              </motion.div>

              {/* Steps cards with progressive reveal and 3D perspective on large screens */}
              <motion.div 
                style={isLargeScreen ? { 
                  perspective: stepsPerspective,
                  rotateY: stepsRotateY 
                } : undefined}
                className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6 md:gap-8 xl:gap-10 3xl:gap-12"
              >
                {steps.map((step, i) => (
                  <motion.div
                    key={step.number}
                    ref={(el) => (stepRefs.current[i] = el)}
                    variants={isLargeScreen ? progressiveRevealVariants : undefined}
                    initial={isLargeScreen ? "hidden" : { opacity: 0, y: 30 }}
                    whileInView={isLargeScreen ? "visible" : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    custom={i}
                    transition={!isLargeScreen ? { delay: i * 0.15, type: "spring", stiffness: 120 } : undefined}
                    whileHover={isLargeScreen ? { 
                      y: -16, 
                      scale: 1.03,
                      rotateX: -3,
                      rotateY: 3,
                      transition: { type: "spring", stiffness: 300, damping: 20 }
                    } : { y: -8 }}
                    className="relative transform-gpu"
                    style={{ transformStyle: isLargeScreen ? "preserve-3d" : undefined }}
                  >
                    {/* Connector Line - Desktop only with enhanced animation */}
                    {i < steps.length - 1 && (
                      <motion.div 
                        initial={{ scaleX: 0, opacity: 0 }}
                        whileInView={{ scaleX: 1, opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ 
                          delay: i * 0.15 + 0.3, 
                          duration: isLargeScreen ? 0.8 : 0.5,
                          ease: "easeOut"
                        }}
                        className="hidden lg:block absolute top-12 3xl:top-14 left-[60%] w-full h-0.5 3xl:h-1 bg-gradient-to-r from-primary/50 to-primary/10 origin-left" 
                      />
                    )}
                    
                    <motion.div 
                      className="bg-card/80 backdrop-blur-sm rounded-2xl p-8 xl:p-10 3xl:p-12 shadow-lg border border-border/50 h-full relative z-10 hover:border-primary/30 hover:shadow-xl transition-all duration-300"
                      whileHover={isLargeScreen ? { 
                        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        borderColor: "rgba(var(--primary), 0.4)"
                      } : undefined}
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <motion.div 
                          className="w-16 h-16 xl:w-18 xl:h-18 3xl:w-20 3xl:h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground shadow-md relative overflow-hidden"
                          whileHover={isLargeScreen ? { rotate: 5, scale: 1.1 } : undefined}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <step.icon className="w-7 h-7 xl:w-8 xl:h-8 3xl:w-9 3xl:h-9 relative z-10" />
                        </motion.div>
                        <motion.span 
                          className="text-5xl xl:text-6xl 3xl:text-7xl font-bold text-primary/20"
                          whileHover={isLargeScreen ? { scale: 1.1, color: "rgba(var(--primary), 0.35)" } : undefined}
                        >
                          {step.number}
                        </motion.span>
                      </div>
                      <h3 className="font-semibold text-foreground mb-3 text-xl xl:text-2xl 3xl:text-3xl leading-tight">{step.title}</h3>
                      <p className="text-base 3xl:text-lg text-muted-foreground leading-relaxed">{step.description}</p>
                    </motion.div>
                  </motion.div>
                ))}
              </motion.div>

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
      <footer className="container mx-auto px-4 py-4 pb-safe border-t border-border">
        <div className="flex flex-col xs:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground text-center xs:text-left">
            © 2026 NutriPlan. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-3 xs:gap-4">
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-primary transition-colors min-h-[44px] flex items-center">
              Termos de Uso
            </Link>
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-primary transition-colors min-h-[44px] flex items-center">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
