import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Palette, 
  Type, 
  Square, 
  ToggleLeft,
  Bell,
  BarChart3,
  Layers,
  Copy,
  Check,
  Sun,
  Moon,
  Utensils,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Navigation,
  Sparkles,
  TrendingUp,
  LayoutGrid,
  ChevronRight,
  FileText,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

// UI Kit Components
import { 
  NutritionCard, 
  MealCard, 
  MetricCard,
  MacroBadge,
  MacroBar,
  MacroSummary,
  StatusBadge,
  StreakBadge,
  PlanBadge,
  // Navigation
  PageHeader,
  NavTabs,
  BreadcrumbNav,
  StepIndicator,
  QuickActions,
  // Data Visualization
  ProgressRing,
  MiniBarChart,
  Sparkline,
  StatComparison,
  DonutChart,
  // Micro-Interactions
  PulseDot,
  SkeletonLoader,
  AnimatedCounter,
  SuccessCheckmark,
  LoadingSpinner,
  InlineStatus,
  HoverScale,
  FadeInView,
  ConfettiBurst,
} from '@/components/ui-kit';

export default function UIKit() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(null), 2000);
  };

  const ColorSwatch = ({ name, cssVar, className }: { name: string; cssVar: string; className: string }) => (
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-lg border ${className}`} />
      <div>
        <p className="font-medium text-sm">{name}</p>
        <button 
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          onClick={() => copyToClipboard(cssVar, name)}
        >
          {cssVar}
          {copied === name ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );

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
            <Badge variant="outline" className="hidden sm:flex">UI Kit v1.0</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              {theme === 'dark' ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <h1 className="text-4xl font-bold tracking-tight">
            NutriPlan <span className="text-gradient">UI Kit</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sistema de design premium para aplicações de nutrição e saúde. 
            Componentes reutilizáveis, consistência visual e escalabilidade.
          </p>
        </motion.section>

        <Tabs defaultValue="colors" className="space-y-8">
          <TabsList className="flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="colors" className="gap-2">
              <Palette className="h-4 w-4" /> Cores
            </TabsTrigger>
            <TabsTrigger value="typography" className="gap-2">
              <Type className="h-4 w-4" /> Tipografia
            </TabsTrigger>
            <TabsTrigger value="buttons" className="gap-2">
              <Square className="h-4 w-4" /> Botões
            </TabsTrigger>
            <TabsTrigger value="forms" className="gap-2">
              <ToggleLeft className="h-4 w-4" /> Formulários
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-2">
              <Layers className="h-4 w-4" /> Cards
            </TabsTrigger>
            <TabsTrigger value="navigation" className="gap-2">
              <Navigation className="h-4 w-4" /> Navegação
            </TabsTrigger>
            <TabsTrigger value="dataviz" className="gap-2">
              <BarChart3 className="h-4 w-4" /> Dados
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2">
              <Bell className="h-4 w-4" /> Feedback
            </TabsTrigger>
            <TabsTrigger value="micro" className="gap-2">
              <Sparkles className="h-4 w-4" /> Micro-Interações
            </TabsTrigger>
            <TabsTrigger value="nutrition" className="gap-2">
              <Utensils className="h-4 w-4" /> Nutrição
            </TabsTrigger>
          </TabsList>

          {/* COLORS TAB */}
          <TabsContent value="colors" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Paleta de Cores</CardTitle>
                <CardDescription>Cores semânticas do sistema baseadas em HSL</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Primary Colors */}
                <div>
                  <h3 className="font-semibold mb-4">Cores Principais</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorSwatch name="Primary" cssVar="--primary" className="bg-primary" />
                    <ColorSwatch name="Secondary" cssVar="--secondary" className="bg-secondary" />
                    <ColorSwatch name="Accent" cssVar="--accent" className="bg-accent" />
                    <ColorSwatch name="Muted" cssVar="--muted" className="bg-muted" />
                  </div>
                </div>

                {/* Status Colors */}
                <div>
                  <h3 className="font-semibold mb-4">Cores de Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorSwatch name="Success" cssVar="--success" className="bg-success" />
                    <ColorSwatch name="Warning" cssVar="--warning" className="bg-warning" />
                    <ColorSwatch name="Destructive" cssVar="--destructive" className="bg-destructive" />
                  </div>
                </div>

                {/* Macro Colors */}
                <div>
                  <h3 className="font-semibold mb-4">Cores de Macros</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorSwatch name="Proteína" cssVar="--macro-protein" className="bg-protein" />
                    <ColorSwatch name="Carboidratos" cssVar="--macro-carbs" className="bg-carbs" />
                    <ColorSwatch name="Gordura" cssVar="--macro-fat" className="bg-fat" />
                  </div>
                </div>

                {/* Gradients */}
                <div>
                  <h3 className="font-semibold mb-4">Gradientes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-20 rounded-lg gradient-primary flex items-center justify-center text-white font-medium">
                      gradient-primary
                    </div>
                    <div className="h-20 rounded-lg gradient-accent flex items-center justify-center text-foreground font-medium">
                      gradient-accent
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TYPOGRAPHY TAB */}
          <TabsContent value="typography" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Tipografia</CardTitle>
                <CardDescription>Escala tipográfica com Plus Jakarta Sans</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-5xl font-bold">Heading 1</span>
                    <code className="text-xs text-muted-foreground">text-5xl font-bold</code>
                  </div>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-4xl font-bold">Heading 2</span>
                    <code className="text-xs text-muted-foreground">text-4xl font-bold</code>
                  </div>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-3xl font-semibold">Heading 3</span>
                    <code className="text-xs text-muted-foreground">text-3xl font-semibold</code>
                  </div>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-2xl font-semibold">Heading 4</span>
                    <code className="text-xs text-muted-foreground">text-2xl font-semibold</code>
                  </div>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-xl font-medium">Heading 5</span>
                    <code className="text-xs text-muted-foreground">text-xl font-medium</code>
                  </div>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-base">Body Text</span>
                    <code className="text-xs text-muted-foreground">text-base</code>
                  </div>
                  <div className="flex items-baseline justify-between border-b pb-2">
                    <span className="text-sm text-muted-foreground">Small / Caption</span>
                    <code className="text-xs text-muted-foreground">text-sm text-muted-foreground</code>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold mb-4">Números Tabulares</h3>
                  <p className="text-muted-foreground mb-2">Use <code className="text-xs">tabular-nums</code> para dados numéricos:</p>
                  <div className="flex gap-4 text-2xl font-bold tabular-nums">
                    <span>1,234</span>
                    <span>5,678</span>
                    <span>9,012</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUTTONS TAB */}
          <TabsContent value="buttons" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Botões</CardTitle>
                <CardDescription>Variantes e estados de botões</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Variants */}
                <div>
                  <h3 className="font-semibold mb-4">Variantes</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="link">Link</Button>
                  </div>
                </div>

                {/* Sizes */}
                <div>
                  <h3 className="font-semibold mb-4">Tamanhos</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm">Small</Button>
                    <Button size="default">Default</Button>
                    <Button size="lg">Large</Button>
                    <Button size="icon"><Flame className="h-4 w-4" /></Button>
                  </div>
                </div>

                {/* States */}
                <div>
                  <h3 className="font-semibold mb-4">Estados</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button>Default</Button>
                    <Button disabled>Disabled</Button>
                    <Button className="opacity-80">Loading...</Button>
                  </div>
                </div>

                {/* With Icons */}
                <div>
                  <h3 className="font-semibold mb-4">Com Ícones</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button><Utensils className="h-4 w-4 mr-2" /> Gerar Plano</Button>
                    <Button variant="outline"><BarChart3 className="h-4 w-4 mr-2" /> Ver Progresso</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FORMS TAB */}
          <TabsContent value="forms" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Formulários</CardTitle>
                <CardDescription>Inputs, selects, checkboxes e switches</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Inputs */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Input Default</Label>
                    <Input placeholder="Digite aqui..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Input Disabled</Label>
                    <Input placeholder="Desabilitado" disabled />
                  </div>
                </div>

                <Separator />

                {/* Checkboxes & Switches */}
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="font-semibold">Checkboxes</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="check1" />
                      <Label htmlFor="check1">Opção 1</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="check2" defaultChecked />
                      <Label htmlFor="check2">Opção 2 (checked)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="check3" disabled />
                      <Label htmlFor="check3" className="text-muted-foreground">Opção 3 (disabled)</Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold">Switches</h3>
                    <div className="flex items-center space-x-2">
                      <Switch id="switch1" />
                      <Label htmlFor="switch1">Incluir suplementos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="switch2" defaultChecked />
                      <Label htmlFor="switch2">Notificações ativas</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CARDS TAB */}
          <TabsContent value="cards" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Cards</CardTitle>
                <CardDescription>Variantes de cards para diferentes contextos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Nutrition Cards */}
                <div>
                  <h3 className="font-semibold mb-4">Nutrition Cards</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <NutritionCard
                      variant="default"
                      title="Card Padrão"
                      description="Descrição do card"
                      icon={<Layers className="h-5 w-5" />}
                    >
                      <p className="text-sm text-muted-foreground">Conteúdo do card</p>
                    </NutritionCard>

                    <NutritionCard
                      variant="meal"
                      title="Card de Refeição"
                      description="Hover para ver o efeito"
                      icon={<Utensils className="h-5 w-5" />}
                    >
                      <p className="text-sm text-muted-foreground">350 kcal</p>
                    </NutritionCard>

                    <NutritionCard
                      variant="highlight"
                      title="Card Destaque"
                      description="Para informações importantes"
                      icon={<Bell className="h-5 w-5" />}
                    >
                      <p className="text-sm text-muted-foreground">Atenção!</p>
                    </NutritionCard>
                  </div>
                </div>

                {/* Metric Cards */}
                <div>
                  <h3 className="font-semibold mb-4">Metric Cards</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                      label="Proteína"
                      value={120}
                      unit="g"
                      icon={<Beef className="h-5 w-5" />}
                      color="protein"
                    />
                    <MetricCard
                      label="Carboidratos"
                      value={250}
                      unit="g"
                      icon={<Wheat className="h-5 w-5" />}
                      color="carbs"
                    />
                    <MetricCard
                      label="Gordura"
                      value={65}
                      unit="g"
                      icon={<Droplets className="h-5 w-5" />}
                      color="fat"
                    />
                    <MetricCard
                      label="Calorias"
                      value={2100}
                      unit="kcal"
                      icon={<Flame className="h-5 w-5" />}
                      color="calories"
                      trend="up"
                      trendValue="+5%"
                    />
                  </div>
                </div>

                {/* Meal Cards */}
                <div>
                  <h3 className="font-semibold mb-4">Meal Cards</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <MealCard
                      mealName="Café da Manhã"
                      mealTime="07:00"
                      calories={450}
                      status="confirmed"
                      optionsCount={3}
                    />
                    <MealCard
                      mealName="Almoço"
                      mealTime="12:00"
                      calories={650}
                      status="pending"
                      optionsCount={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NAVIGATION TAB */}
          <TabsContent value="navigation" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Componentes de Navegação</CardTitle>
                <CardDescription>Headers, breadcrumbs, tabs e indicadores de passo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Page Header */}
                <div>
                  <h3 className="font-semibold mb-4">Page Header</h3>
                  <div className="border rounded-lg p-4 bg-muted/20">
                    <PageHeader
                      title="Meu Plano Alimentar"
                      description="Gerencie suas refeições e acompanhe seu progresso"
                      icon={<Utensils className="h-6 w-6" />}
                      badge={<Badge variant="secondary">Ativo</Badge>}
                      actions={
                        <Button size="sm">
                          <FileText className="h-4 w-4 mr-2" /> Exportar
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Breadcrumb */}
                <div>
                  <h3 className="font-semibold mb-4">Breadcrumb</h3>
                  <BreadcrumbNav
                    items={[
                      { label: 'Dashboard', to: '/dashboard' },
                      { label: 'Plano Alimentar', to: '/meal-plan' },
                      { label: 'Café da Manhã' },
                    ]}
                  />
                </div>

                {/* Nav Tabs Variants */}
                <div>
                  <h3 className="font-semibold mb-4">Nav Tabs (Variantes)</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Default</p>
                      <NavTabs
                        variant="default"
                        items={[
                          { label: 'Visão Geral', to: '/ui-kit', end: true },
                          { label: 'Refeições', to: '/ui-kit/meals' },
                          { label: 'Progresso', to: '/ui-kit/progress' },
                        ]}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Pills</p>
                      <NavTabs
                        variant="pills"
                        items={[
                          { label: 'Semanal', to: '/ui-kit', end: true, icon: <LayoutGrid className="h-4 w-4" /> },
                          { label: 'Mensal', to: '/ui-kit/monthly' },
                        ]}
                      />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Underline</p>
                      <NavTabs
                        variant="underline"
                        items={[
                          { label: 'Alunos', to: '/ui-kit', end: true, icon: <Users className="h-4 w-4" /> },
                          { label: 'Planos', to: '/ui-kit/plans' },
                          { label: 'Relatórios', to: '/ui-kit/reports' },
                        ]}
                      />
                    </div>
                  </div>
                </div>

                {/* Step Indicator */}
                <div>
                  <h3 className="font-semibold mb-4">Step Indicator</h3>
                  <StepIndicator
                    steps={['Perfil', 'Preferências', 'Objetivos', 'Confirmar']}
                    currentStep={2}
                  />
                </div>

                {/* Quick Actions */}
                <div>
                  <h3 className="font-semibold mb-4">Quick Actions</h3>
                  <QuickActions
                    actions={[
                      { label: 'Novo Plano', icon: <Utensils className="h-4 w-4" />, onClick: () => toast.info('Novo plano'), variant: 'primary' },
                      { label: 'Exportar', icon: <FileText className="h-4 w-4" />, onClick: () => toast.info('Exportar') },
                      { label: 'Progresso', icon: <TrendingUp className="h-4 w-4" />, onClick: () => toast.info('Ver progresso') },
                    ]}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DATA VISUALIZATION TAB */}
          <TabsContent value="dataviz" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Visualização de Dados</CardTitle>
                <CardDescription>Gráficos, rings de progresso e sparklines</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Progress Rings */}
                <div>
                  <h3 className="font-semibold mb-4">Progress Rings</h3>
                  <div className="flex flex-wrap items-end gap-6">
                    <ProgressRing value={75} size="sm" color="primary" />
                    <ProgressRing value={60} size="md" color="success" label="Meta" />
                    <ProgressRing value={85} size="lg" color="protein" label="Proteína" />
                    <ProgressRing value={45} max={100} size="xl" color="warning" />
                  </div>
                </div>

                {/* Mini Bar Chart */}
                <div>
                  <h3 className="font-semibold mb-4">Mini Bar Chart</h3>
                  <div className="max-w-sm">
                    <MiniBarChart
                      data={[
                        { value: 80, label: 'Seg', color: 'success' },
                        { value: 60, label: 'Ter', color: 'success' },
                        { value: 90, label: 'Qua', color: 'success' },
                        { value: 45, label: 'Qui', color: 'warning' },
                        { value: 70, label: 'Sex', color: 'success' },
                        { value: 85, label: 'Sáb', color: 'success' },
                        { value: 55, label: 'Dom', color: 'warning' },
                      ]}
                      height={64}
                      showLabels
                    />
                  </div>
                </div>

                {/* Sparklines */}
                <div>
                  <h3 className="font-semibold mb-4">Sparklines</h3>
                  <div className="flex flex-wrap gap-8">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Calorias</p>
                      <Sparkline data={[1800, 2100, 1950, 2200, 2050, 1900, 2150]} color="primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Proteína</p>
                      <Sparkline data={[80, 95, 110, 105, 120, 115, 125]} color="success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Adesão</p>
                      <Sparkline data={[70, 85, 90, 75, 95, 100, 85]} color="warning" showArea={false} />
                    </div>
                  </div>
                </div>

                {/* Stat Comparison */}
                <div>
                  <h3 className="font-semibold mb-4">Stat Comparison</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatComparison label="Calorias" current={2100} previous={1950} unit="kcal" />
                    <StatComparison label="Proteína" current={125} previous={110} unit="g" />
                    <StatComparison label="Adesão" current={85} previous={90} format="percent" />
                    <StatComparison label="Sequência" current={7} previous={7} unit="dias" />
                  </div>
                </div>

                {/* Donut Chart */}
                <div>
                  <h3 className="font-semibold mb-4">Donut Chart</h3>
                  <div className="flex flex-wrap gap-8">
                    <DonutChart
                      segments={[
                        { value: 120, color: 'protein', label: 'Proteína' },
                        { value: 250, color: 'carbs', label: 'Carbos' },
                        { value: 65, color: 'fat', label: 'Gordura' },
                      ]}
                      centerValue="2100"
                      centerLabel="kcal"
                    />
                    <DonutChart
                      segments={[
                        { value: 75, color: 'success' },
                        { value: 25, color: 'warning' },
                      ]}
                      size={80}
                      strokeWidth={12}
                      centerValue="75%"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEEDBACK TAB */}
          <TabsContent value="feedback" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Feedback & Status</CardTitle>
                <CardDescription>Badges, alertas e indicadores de progresso</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Status Badges */}
                <div>
                  <h3 className="font-semibold mb-4">Status Badges</h3>
                  <div className="flex flex-wrap gap-3">
                    <StatusBadge status="pending" />
                    <StatusBadge status="confirmed" />
                    <StatusBadge status="skipped" />
                    <StatusBadge status="out_of_plan" />
                    <StatusBadge status="complete" />
                    <StatusBadge status="partial" />
                  </div>
                </div>

                {/* Plan Badges */}
                <div>
                  <h3 className="font-semibold mb-4">Plan Badges</h3>
                  <div className="flex flex-wrap gap-3">
                    <PlanBadge plan="gratuito" />
                    <PlanBadge plan="plano_pessoal_pago" />
                    <PlanBadge plan="profissional" />
                  </div>
                </div>

                {/* Streak Badges */}
                <div>
                  <h3 className="font-semibold mb-4">Streak Badges</h3>
                  <div className="flex flex-wrap gap-3">
                    <StreakBadge days={3} size="sm" />
                    <StreakBadge days={7} size="md" />
                    <StreakBadge days={30} size="lg" milestone />
                  </div>
                </div>

                <Separator />

                {/* Alerts */}
                <div>
                  <h3 className="font-semibold mb-4">Alertas</h3>
                  <div className="space-y-4">
                    <Alert>
                      <Bell className="h-4 w-4" />
                      <AlertTitle>Informação</AlertTitle>
                      <AlertDescription>
                        Este é um alerta informativo padrão.
                      </AlertDescription>
                    </Alert>
                    <Alert variant="destructive">
                      <Bell className="h-4 w-4" />
                      <AlertTitle>Erro</AlertTitle>
                      <AlertDescription>
                        Este é um alerta de erro.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <h3 className="font-semibold mb-4">Progress Bars</h3>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <p className="text-sm mb-1">25%</p>
                      <Progress value={25} />
                    </div>
                    <div>
                      <p className="text-sm mb-1">50%</p>
                      <Progress value={50} />
                    </div>
                    <div>
                      <p className="text-sm mb-1">100%</p>
                      <Progress value={100} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MICRO-INTERACTIONS TAB */}
          <TabsContent value="micro" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Micro-Interações</CardTitle>
                <CardDescription>Animações, loaders e feedback visual</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Pulse Dots */}
                <div>
                  <h3 className="font-semibold mb-4">Pulse Dots</h3>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <PulseDot color="primary" size="sm" />
                      <span className="text-sm">Ativo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PulseDot color="success" size="md" />
                      <span className="text-sm">Online</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PulseDot color="warning" size="lg" />
                      <span className="text-sm">Atenção</span>
                    </div>
                  </div>
                </div>

                {/* Loading States */}
                <div>
                  <h3 className="font-semibold mb-4">Loading States</h3>
                  <div className="flex flex-wrap items-center gap-6">
                    <LoadingSpinner size="sm" />
                    <LoadingSpinner size="md" label="Carregando..." />
                    <LoadingSpinner size="lg" />
                  </div>
                </div>

                {/* Skeleton Loaders */}
                <div>
                  <h3 className="font-semibold mb-4">Skeleton Loaders</h3>
                  <div className="flex flex-wrap items-center gap-4">
                    <SkeletonLoader variant="circular" width={48} height={48} />
                    <div className="space-y-2">
                      <SkeletonLoader variant="text" width={120} />
                      <SkeletonLoader variant="text" width={200} />
                    </div>
                    <SkeletonLoader variant="card" width={200} height={100} />
                  </div>
                </div>

                {/* Animated Counter */}
                <div>
                  <h3 className="font-semibold mb-4">Animated Counter</h3>
                  <div className="text-4xl font-bold">
                    <AnimatedCounter value={2147} duration={1500} />
                    <span className="text-lg text-muted-foreground ml-2">kcal</span>
                  </div>
                </div>

                {/* Inline Status */}
                <div>
                  <h3 className="font-semibold mb-4">Inline Status</h3>
                  <div className="flex flex-wrap gap-3">
                    <InlineStatus status="success" message="Plano salvo com sucesso!" />
                    <InlineStatus status="error" message="Erro ao processar" />
                    <InlineStatus status="warning" message="Limite próximo" />
                    <InlineStatus status="info" message="Nova atualização" />
                    <InlineStatus status="loading" message="Gerando plano..." />
                  </div>
                </div>

                {/* Success Checkmark */}
                <div>
                  <h3 className="font-semibold mb-4">Success Checkmark</h3>
                  <div className="flex items-center gap-6">
                    <SuccessCheckmark show={true} size="sm" />
                    <SuccessCheckmark show={true} size="md" />
                    <SuccessCheckmark show={true} size="lg" />
                  </div>
                </div>

                {/* Hover Scale */}
                <div>
                  <h3 className="font-semibold mb-4">Hover Scale</h3>
                  <div className="flex gap-4">
                    <HoverScale>
                      <div className="p-4 bg-muted rounded-lg">
                        Hover me (sutil)
                      </div>
                    </HoverScale>
                    <HoverScale scale={1.05}>
                      <div className="p-4 bg-primary/10 rounded-lg">
                        Hover me (maior)
                      </div>
                    </HoverScale>
                  </div>
                </div>

                {/* Fade In View */}
                <div>
                  <h3 className="font-semibold mb-4">Fade In View</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <FadeInView delay={0}>
                      <div className="p-4 bg-muted rounded-lg text-center">1</div>
                    </FadeInView>
                    <FadeInView delay={0.1}>
                      <div className="p-4 bg-muted rounded-lg text-center">2</div>
                    </FadeInView>
                    <FadeInView delay={0.2}>
                      <div className="p-4 bg-muted rounded-lg text-center">3</div>
                    </FadeInView>
                    <FadeInView delay={0.3}>
                      <div className="p-4 bg-muted rounded-lg text-center">4</div>
                    </FadeInView>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NUTRITION TAB */}
          <TabsContent value="nutrition" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Componentes de Nutrição</CardTitle>
                <CardDescription>Badges e barras específicas para dados nutricionais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Macro Badges */}
                <div>
                  <h3 className="font-semibold mb-4">Macro Badges</h3>
                  <div className="flex flex-wrap gap-3">
                    <MacroBadge macro="protein" value={120} variant="text" />
                    <MacroBadge macro="carbs" value={250} variant="pill" />
                    <MacroBadge macro="fat" value={65} variant="card" showIcon />
                    <MacroBadge macro="calories" value={2100} variant="pill" />
                  </div>
                </div>

                {/* Macro Bars */}
                <div>
                  <h3 className="font-semibold mb-4">Macro Bars</h3>
                  <div className="max-w-md space-y-4">
                    <MacroBar macro="protein" current={95} target={120} />
                    <MacroBar macro="carbs" current={200} target={250} />
                    <MacroBar macro="fat" current={70} target={65} />
                    <MacroBar macro="calories" current={1800} target={2100} />
                  </div>
                </div>

                {/* Macro Summary */}
                <div>
                  <h3 className="font-semibold mb-4">Macro Summary</h3>
                  <div className="max-w-md">
                    <MacroSummary
                      protein={{ current: 95, target: 120 }}
                      carbs={{ current: 200, target: 250 }}
                      fat={{ current: 55, target: 65 }}
                      calories={{ current: 1800, target: 2100 }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
