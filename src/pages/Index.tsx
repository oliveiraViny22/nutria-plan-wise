import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Leaf, Target, RefreshCw, MessageCircle, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Index() {
  const features = [
    { icon: Target, title: 'Metas Personalizadas', description: 'Calcule suas necessidades calóricas e de macros automaticamente' },
    { icon: RefreshCw, title: 'Substituição Inteligente', description: 'Troque alimentos e veja o impacto nutricional em tempo real' },
    { icon: MessageCircle, title: 'Assistente IA', description: 'Tire dúvidas nutricionais com nosso assistente inteligente' },
  ];

  return (
    <div className="min-h-screen gradient-hero overflow-x-hidden">
      {/* Header - Mobile-first responsive */}
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

      <main className="container mx-auto px-4 py-8 sm:py-12 lg:py-16 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary/10 rounded-full text-primary text-xs sm:text-sm font-medium mb-4 sm:mb-6">
            <Leaf className="w-3 h-3 sm:w-4 sm:h-4" /> Planejamento alimentar com IA
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 max-w-3xl mx-auto leading-tight px-2">
            Nutrição inteligente para seus <span className="text-primary">objetivos</span>
          </h1>
          <p className="text-sm sm:text-lg text-muted-foreground max-w-xl mx-auto mb-6 sm:mb-8 px-2">
            Crie planos alimentares personalizados, substitua alimentos e entenda o impacto de cada escolha na sua saúde.
          </p>
          <Link to="/signup">
            <Button variant="hero" size="lg" className="text-sm sm:text-base">
              Começar agora <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>

        {/* Hydration Tip - Highlighted Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          className="mt-10 sm:mt-12 max-w-md mx-auto"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-blue-600/10 border border-blue-500/20 p-4 sm:p-5">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex items-center gap-3 sm:gap-4">
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Droplets className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="text-xs sm:text-sm font-semibold text-blue-500 mb-0.5">Dica de Saúde</p>
                <p className="text-sm sm:text-base text-foreground font-medium">
                  Beba pelo menos <span className="text-blue-500 font-bold">2 litros</span> de água por dia
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  A hidratação adequada melhora seu metabolismo e resultados
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features Grid - Mobile: 1 col, Tablet: 2 col, Desktop: 3 col */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ delay: 0.3 }} 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12 lg:mt-16 max-w-4xl mx-auto"
        >
          {features.map((f, i) => (
            <motion.div 
              key={f.title} 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: 0.4 + i * 0.1 }} 
              className="card-elevated rounded-2xl p-4 sm:p-6 text-left"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                <f.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">{f.title}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

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
