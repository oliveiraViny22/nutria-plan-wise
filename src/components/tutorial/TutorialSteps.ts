import { 
  Sparkles, 
  Target, 
  Utensils, 
  RefreshCw, 
  MessageCircle, 
  BarChart3, 
  CheckCircle2,
  Calendar,
  Zap,
  Scale,
  type LucideIcon,
} from 'lucide-react';

export interface TutorialStep {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  features?: string[];
  highlight?: 'free' | 'paid';
}

export const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Bem-vindo ao NutriPlan! 🎉',
    description: 'Seu assistente de nutrição com inteligência artificial. Vamos descobrir como o sistema pode te ajudar a alcançar seus objetivos de forma simples e eficiente.',
  },
  {
    id: 'goals',
    icon: Target,
    title: 'Metas Personalizadas',
    description: 'Com base no seu perfil (peso, altura, idade, objetivo), calculamos automaticamente suas necessidades calóricas e de macronutrientes usando a fórmula científica Mifflin-St Jeor.',
    features: [
      'Cálculo automático de calorias diárias (TMB + TDEE)',
      'Distribuição ideal de proteínas, carboidratos e gorduras',
      'Ajuste por nível de atividade física',
      'Recomendação de hidratação personalizada',
    ],
    highlight: 'free',
  },
  {
    id: 'meal-plan',
    icon: Utensils,
    title: 'Plano Alimentar com IA',
    description: 'Nossa IA cria um plano alimentar completo e personalizado. O sistema usa templates de refeições otimizados e respeita suas preferências alimentares.',
    features: [
      'Refeições balanceadas para o dia todo',
      'Múltiplas opções para cada refeição',
      'Quantidades calculadas em gramas e unidades naturais',
      'Validação nutricional automática',
    ],
    highlight: 'free',
  },
  {
    id: 'optimization',
    icon: Zap,
    title: 'Otimização Inteligente',
    description: 'Se o plano gerado não estiver perfeitamente alinhado com suas metas, a IA Rebalanceadora ajusta automaticamente as quantidades para convergir aos valores ideais.',
    features: [
      'Rebalanceamento automático de macros',
      'Ajuste fino de porções',
      'Múltiplas iterações até convergência',
      'Feedback visual do progresso',
    ],
    highlight: 'paid',
  },
  {
    id: 'substitution',
    icon: RefreshCw,
    title: 'Substituição Inteligente',
    description: 'Não gostou de algum alimento? Troque por outro equivalente mantendo o equilíbrio nutricional. Veja o impacto nos macros em tempo real!',
    features: [
      'Sugestões de alimentos equivalentes',
      'Visualização do impacto nos macros',
      'Manutenção do equilíbrio nutricional',
      'Explicação da IA sobre a substituição',
    ],
    highlight: 'paid',
  },
  {
    id: 'daily-log',
    icon: Calendar,
    title: 'Registro Diário',
    description: 'Confirme as refeições que você consumiu durante o dia. O sistema calcula sua aderência e mostra estatísticas detalhadas do seu progresso.',
    features: [
      'Confirmação simples de refeições',
      'Escolha entre opções do plano',
      'Registro de refeições fora do plano',
      'Histórico completo de consumo',
    ],
    highlight: 'paid',
  },
  {
    id: 'chat',
    icon: MessageCircle,
    title: 'Chat com IA Nutricional',
    description: 'Tire suas dúvidas sobre nutrição com nosso assistente inteligente. Ele conhece seu plano e perfil para dar orientações personalizadas.',
    features: [
      'Respostas baseadas no seu perfil',
      'Dicas de alimentação saudável',
      'Esclarecimento de dúvidas nutricionais',
      'Sugestões de ajustes no plano',
    ],
    highlight: 'paid',
  },
  {
    id: 'progress',
    icon: Scale,
    title: 'Acompanhe seu Progresso',
    description: 'Registre seu peso e medidas corporais para visualizar sua evolução ao longo do tempo com gráficos detalhados.',
    features: [
      'Registro de peso com histórico',
      'Medidas corporais (cintura, quadril, etc.)',
      'Gráficos de evolução',
      'Análise de tendências',
    ],
    highlight: 'paid',
  },
  {
    id: 'done',
    icon: CheckCircle2,
    title: 'Pronto para começar!',
    description: 'Você já conhece as principais funcionalidades. Complete seu perfil no onboarding e seu primeiro plano alimentar será gerado automaticamente. Boa jornada! 💪',
  },
];
