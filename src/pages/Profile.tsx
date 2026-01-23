import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  User, 
  Loader2,
  Target,
  Utensils,
  Flame,
  TrendingUp,
  Trash2,
  AlertTriangle,
  Lock,
  Calendar,
  Ruler,
  Weight,
  UserCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ACTIVITY_LEVELS,
  GOALS,
  FOOD_PREFERENCES,
  FOOD_RESTRICTIONS,
} from '@/lib/types';

const ADMIN_EMAIL = "admin@nutriaplan.com";

// Ícones para objetivos
const GOAL_ICONS = {
  lose_weight: '🔥',
  maintain: '⚖️',
  gain_muscle: '💪',
};

// Ícones para níveis de atividade
const ACTIVITY_ICONS = {
  sedentary: '🛋️',
  light: '🚶',
  moderate: '🏃',
  active: '🏋️',
  very_active: '🏆',
};

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    meals_per_day: 4,
    preferences: [] as string[],
    restrictions: [] as string[],
  });

  useEffect(() => {
    if (profile) {
      const mapSex = (dbSex: string | null): 'male' | 'female' | 'other' | '' => {
        if (dbSex === 'M' || dbSex === 'male') return 'male';
        if (dbSex === 'F' || dbSex === 'female') return 'female';
        if (dbSex === 'other') return 'other';
        return '';
      };
      
      const mapGoal = (dbGoal: string | null): 'lose_weight' | 'maintain' | 'gain_muscle' | '' => {
        if (dbGoal === 'lose' || dbGoal === 'lose_weight') return 'lose_weight';
        if (dbGoal === 'gain' || dbGoal === 'gain_muscle') return 'gain_muscle';
        if (dbGoal === 'maintain') return 'maintain';
        return '';
      };
      
      setFormData({
        name: profile.name || '',
        age: profile.age?.toString() || '',
        sex: mapSex(profile.sex),
        height: profile.height?.toString() || '',
        weight: profile.weight?.toString() || '',
        goal: mapGoal(profile.goal),
        activity_level: (profile.activity_level as any) || '',
        meals_per_day: (profile as any).meals_per_day || 4,
        preferences: profile.preferences || [],
        restrictions: profile.restrictions || [],
      });
    }
  }, [profile]);

  const calculateTargets = () => {
    const { age, sex, height, weight, goal, activity_level } = formData;
    
    if (!age || !sex || !height || !weight || !activity_level) {
      return null;
    }

    const bmr = sex === 'male'
      ? 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + 5
      : 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) - 161;

    const activityMultiplier = ACTIVITY_LEVELS[activity_level as keyof typeof ACTIVITY_LEVELS]?.multiplier || 1.55;
    const tdee = bmr * activityMultiplier;
    
    const calorieAdjustment = goal ? GOALS[goal as keyof typeof GOALS]?.calorieAdjustment || 0 : 0;
    const calories = Math.round(tdee + calorieAdjustment);

    let proteinRatio = 0.3;
    let carbsRatio = 0.4;
    let fatRatio = 0.3;

    if (goal === 'gain_muscle') {
      proteinRatio = 0.35;
      carbsRatio = 0.45;
      fatRatio = 0.2;
    } else if (goal === 'lose_weight') {
      proteinRatio = 0.35;
      carbsRatio = 0.35;
      fatRatio = 0.3;
    }

    return {
      calories,
      protein: Math.round((calories * proteinRatio) / 4),
      carbs: Math.round((calories * carbsRatio) / 4),
      fat: Math.round((calories * fatRatio) / 9),
    };
  };

  const handleDeleteAccount = async () => {
    if (!user || user.email === ADMIN_EMAIL) return;
    if (deleteConfirmText !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão inválida');

      const response = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;

      toast.success('Conta excluída com sucesso');
      await signOut();
      navigate('/');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Erro ao excluir conta');
    } finally {
      setDeleting(false);
      setDeleteConfirmText('');
    }
  };

  const getSexLabel = (sex: string) => {
    switch (sex) {
      case 'male': return 'Masculino';
      case 'female': return 'Feminino';
      case 'other': return 'Outro';
      default: return '-';
    }
  };

  const isAdmin = user?.email === ADMIN_EMAIL;
  const targets = calculateTargets();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex w-9 h-9 sm:w-10 sm:h-10" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-base sm:text-lg font-semibold hidden xs:block">Meu Perfil</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-24 max-w-4xl">
        <Tabs defaultValue="personal" className="space-y-4 sm:space-y-6">
          {/* Tabs */}
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="personal" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Dados</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Objetivo</span>
            </TabsTrigger>
            <TabsTrigger value="diet" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <Utensils className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Dieta</span>
            </TabsTrigger>
          </TabsList>

          {/* Goals Tab - Read-only */}
          <TabsContent value="goals">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Objective Display - Read-only */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Objetivo Principal
                      </CardTitle>
                      <CardDescription>Definido no cadastro</CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Somente leitura
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Info Banner */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Por que não posso alterar?</p>
                      <p>
                        O objetivo e nível de atividade são fixados para manter a consistência 
                        do seu plano alimentar e histórico de adesão. Para solicitar uma alteração, 
                        use o botão abaixo.
                      </p>
                    </div>
                  </div>

                  {/* Goal Display */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Current Goal */}
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                          {formData.goal ? GOAL_ICONS[formData.goal as keyof typeof GOAL_ICONS] : '🎯'}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Objetivo</p>
                          <p className="font-semibold text-lg">
                            {formData.goal ? GOALS[formData.goal as keyof typeof GOALS]?.label : '-'}
                          </p>
                          {formData.goal && (
                            <p className="text-xs text-muted-foreground">
                              {GOALS[formData.goal as keyof typeof GOALS]?.calorieAdjustment > 0 ? '+' : ''}
                              {GOALS[formData.goal as keyof typeof GOALS]?.calorieAdjustment} kcal/dia
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Current Activity Level */}
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                          {formData.activity_level ? ACTIVITY_ICONS[formData.activity_level as keyof typeof ACTIVITY_ICONS] : '🏃'}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Nível de Atividade</p>
                          <p className="font-semibold text-lg">
                            {formData.activity_level ? ACTIVITY_LEVELS[formData.activity_level as keyof typeof ACTIVITY_LEVELS]?.label : '-'}
                          </p>
                          {formData.activity_level && (
                            <p className="text-xs text-muted-foreground">
                              {ACTIVITY_LEVELS[formData.activity_level as keyof typeof ACTIVITY_LEVELS]?.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Request Change Button */}
                  <div className="mt-6 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => toast.info('Funcionalidade de solicitação de alteração será implementada em breve.')}
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Solicitar Alteração de Objetivo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Calculated Targets Preview */}
              {targets && (
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Suas Metas Diárias Atuais
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <Flame className="h-6 w-6 mx-auto text-primary mb-2" />
                        <p className="text-2xl font-bold text-primary">{targets.calories}</p>
                        <p className="text-xs text-muted-foreground">kcal/dia</p>
                      </div>
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-protein/20 flex items-center justify-center">
                          <span className="text-protein font-bold text-sm">P</span>
                        </div>
                        <p className="text-2xl font-bold text-protein">{targets.protein}g</p>
                        <p className="text-xs text-muted-foreground">Proteína</p>
                      </div>
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-carbs/20 flex items-center justify-center">
                          <span className="text-carbs font-bold text-sm">C</span>
                        </div>
                        <p className="text-2xl font-bold text-carbs">{targets.carbs}g</p>
                        <p className="text-xs text-muted-foreground">Carboidratos</p>
                      </div>
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-fat/20 flex items-center justify-center">
                          <span className="text-fat font-bold text-sm">G</span>
                        </div>
                        <p className="text-2xl font-bold text-fat">{targets.fat}g</p>
                        <p className="text-xs text-muted-foreground">Gordura</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Diet Preferences Tab - Read-only */}
          <TabsContent value="diet">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-primary" />
                        Configuração da Dieta
                      </CardTitle>
                      <CardDescription>Definida no cadastro</CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Somente leitura
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Info Banner */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Por que não posso alterar?</p>
                      <p>
                        A configuração de refeições e preferências está vinculada ao seu plano 
                        alimentar atual. Alterações requerem a geração de um novo plano para 
                        manter a coerência nutricional.
                      </p>
                    </div>
                  </div>

                  {/* Meals per Day Display */}
                  <div className="p-4 rounded-xl bg-muted/30 border mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{formData.meals_per_day}</span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Refeições por Dia</p>
                        <p className="font-semibold text-lg">{formData.meals_per_day} refeições</p>
                      </div>
                    </div>
                  </div>

                  {/* Preferences Display */}
                  <div className="mb-6">
                    <p className="text-sm font-medium mb-3">Preferências Alimentares</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.preferences.length > 0 ? (
                        formData.preferences.map((pref) => (
                          <Badge key={pref} variant="secondary" className="px-3 py-1.5">
                            {pref}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhuma preferência definida</span>
                      )}
                    </div>
                  </div>

                  {/* Restrictions Display */}
                  <div className="mb-6">
                    <p className="text-sm font-medium mb-3">Restrições Alimentares</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.restrictions.length > 0 ? (
                        formData.restrictions.map((rest) => (
                          <Badge key={rest} variant="destructive" className="px-3 py-1.5">
                            {rest}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhuma restrição definida</span>
                      )}
                    </div>
                  </div>

                  {/* Request Change Button */}
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => toast.info('Funcionalidade de solicitação de alteração será implementada em breve.')}
                    >
                      <Utensils className="h-4 w-4 mr-2" />
                      Solicitar Alteração de Dieta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Personal Data Tab - Read-only */}
          <TabsContent value="personal">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-primary" />
                        Dados Pessoais
                      </CardTitle>
                      <CardDescription>Informações definidas no cadastro</CardDescription>
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Somente leitura
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Info Banner */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-6 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground mb-1">Por que não posso alterar?</p>
                      <p>
                        Os dados pessoais são fixados no cadastro para garantir a precisão 
                        do seu histórico e evolução nutricional. Alterações nesses dados 
                        poderiam distorcer suas métricas de progresso.
                      </p>
                    </div>
                  </div>

                  {/* Personal Data Display */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Name */}
                    <div className="col-span-full p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Nome</p>
                          <p className="font-semibold text-lg">{formData.name || '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Age */}
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Idade</p>
                          <p className="font-semibold text-lg">{formData.age ? `${formData.age} anos` : '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Sex */}
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <UserCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sexo</p>
                          <p className="font-semibold text-lg">{getSexLabel(formData.sex)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Height */}
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Ruler className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Altura</p>
                          <p className="font-semibold text-lg">{formData.height ? `${formData.height} cm` : '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Weight */}
                    <div className="p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Weight className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">Peso</p>
                          <p className="font-semibold text-lg">{formData.weight ? `${formData.weight} kg` : '-'}</p>
                        </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              {/* Delete Account Section */}
              {!isAdmin && (
                <Card className="border-destructive/30 bg-destructive/5 mt-6">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Zona de Perigo
                    </CardTitle>
                    <CardDescription>
                      Ações irreversíveis para sua conta
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full sm:w-auto">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir minha conta
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Excluir conta permanentemente?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3">
                            <p>
                              Esta ação é <strong>irreversível</strong>. Todos os seus dados serão excluídos permanentemente:
                            </p>
                            <ul className="list-disc list-inside text-sm space-y-1">
                              <li>Perfil e informações pessoais</li>
                              <li>Planos alimentares e histórico</li>
                              <li>Registros de refeições e adesão</li>
                              <li>Conversas com o chat nutricional</li>
                            </ul>
                            <div className="pt-2">
                              <Label htmlFor="confirm-delete" className="text-sm font-medium">
                                Digite <strong>EXCLUIR</strong> para confirmar:
                              </Label>
                              <Input
                                id="confirm-delete"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                                placeholder="EXCLUIR"
                                className="mt-2"
                              />
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirmText !== 'EXCLUIR' || deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deleting ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Excluir permanentemente
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
