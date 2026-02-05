import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Loader2,
  Target,
  Utensils,
  Trash2,
  AlertTriangle,
  Lock,
  Calendar,
  Ruler,
  Weight,
  UserCircle,
  Apple,
  Info,
  Moon,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { PageHeader, BreadcrumbNav } from '@/components/ui-kit';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ACTIVITY_LEVELS,
  GOALS,
} from '@/lib/types';
import { ObjectiveChangeWizard } from '@/components/ObjectiveChangeWizard';
import { StudentObjectiveRequestDialog } from '@/components/StudentObjectiveRequestDialog';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { FoodPreferencesManager } from '@/components/FoodPreferencesManager';
import { SupplementToggle } from '@/components/SupplementToggle';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useSubscription } from '@/hooks/useSubscription';

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
  const [showObjectiveWizard, setShowObjectiveWizard] = useState(false);
  const [showStudentRequestDialog, setShowStudentRequestDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  
  const { isLinkedStudent, professionalId } = useLinkedStudent();
  const { subscriptionInfo } = useSubscription();
  const isPaidUser = subscriptionInfo?.plan?.type !== 'gratuito';

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    meals_per_day: 4,
    snack_preference: 'afternoon_snack' as 'morning_snack' | 'afternoon_snack',
    last_evening_meal: 'dinner' as 'dinner' | 'supper',
    evening_meal_preference: 'no_preference' as 'full_dinner' | 'light_dinner' | 'no_preference',
    preferences: [] as string[],
    restrictions: [] as string[],
  });

  const [savingPreference, setSavingPreference] = useState(false);

  // Opções de preferência noturna (para 6 refeições - distribuição)
  const EVENING_MEAL_OPTIONS = [
    { 
      value: 'full_dinner' as const, 
      label: 'Jantar completo + Ceia leve',
      description: 'Jantar com 3-5 itens, ceia com 2-3 itens',
      icon: '🍽️'
    },
    { 
      value: 'light_dinner' as const, 
      label: 'Jantar leve + Ceia substancial',
      description: 'Jantar com 2-3 itens, ceia com 3-5 itens',
      icon: '🌙'
    },
    { 
      value: 'no_preference' as const, 
      label: 'Sem preferência',
      description: 'O sistema decide a melhor distribuição',
      icon: '⚖️'
    },
  ];

  // Opções de tipo de refeição noturna única (para 3-5 refeições)
  const LAST_EVENING_MEAL_OPTIONS = [
    { 
      value: 'dinner' as const, 
      label: '🍽️ Jantar',
      description: 'Refeição quente e completa com proteína, carboidrato e vegetais',
      examples: 'Ex: Frango grelhado, arroz, feijão e salada'
    },
    { 
      value: 'supper' as const, 
      label: '🌙 Ceia',
      description: 'Refeição leve e prática, ideal para quem prefere algo mais leve à noite',
      examples: 'Ex: Sanduíche natural, iogurte com frutas, omelete'
    },
  ];

  // Opções de preferência de lanche (para 4 refeições)
  const SNACK_PREFERENCE_OPTIONS = [
    { 
      value: 'morning_snack' as const, 
      label: '☀️ Lanche da Manhã',
      description: 'Entre café da manhã e almoço, ideal para quem acorda cedo',
      examples: 'Ex: Frutas, iogurte, castanhas'
    },
    { 
      value: 'afternoon_snack' as const, 
      label: '🌅 Lanche da Tarde',
      description: 'Entre almoço e jantar, ideal para manter a energia',
      examples: 'Ex: Sanduíche, smoothie, mix de frutas'
    },
  ];

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

      const mapEveningPreference = (pref: string | null): 'full_dinner' | 'light_dinner' | 'no_preference' => {
        if (pref === 'full_dinner') return 'full_dinner';
        if (pref === 'light_dinner') return 'light_dinner';
        return 'no_preference';
      };

      const mapLastEveningMeal = (meal: string | null): 'dinner' | 'supper' => {
        if (meal === 'supper') return 'supper';
        return 'dinner';
      };

      const mapSnackPreference = (pref: string | null): 'morning_snack' | 'afternoon_snack' => {
        if (pref === 'morning_snack') return 'morning_snack';
        return 'afternoon_snack';
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
        snack_preference: mapSnackPreference((profile as any).snack_preference),
        last_evening_meal: mapLastEveningMeal((profile as any).last_evening_meal),
        evening_meal_preference: mapEveningPreference((profile as any).evening_meal_preference),
        preferences: profile.preferences || [],
        restrictions: profile.restrictions || [],
      });
    }
  }, [profile]);

  const handleDeleteAccount = async () => {
    if (!user || user.email === ADMIN_EMAIL) return;
    if (deleteConfirmText !== 'EXCLUIR') {
      toast.error('Digite EXCLUIR para confirmar');
      return;
    }

    setDeleting(true);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Sua sessão expirou. Faça login novamente.');
          await signOut();
          navigate('/login');
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão inválida. Faça login novamente.');
        navigate('/login');
        return;
      }

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

  const handleSaveEveningPreference = async (value: 'full_dinner' | 'light_dinner' | 'no_preference') => {
    if (!user) return;
    
    setSavingPreference(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          evening_meal_preference: value,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, evening_meal_preference: value }));
      toast.success('Preferência noturna atualizada!', {
        description: 'A alteração será aplicada ao gerar um novo plano.'
      });
      await refreshProfile();
    } catch (error: any) {
      console.error('Error saving evening preference:', error);
      toast.error(error.message || 'Erro ao salvar preferência');
    } finally {
      setSavingPreference(false);
    }
  };

  const handleSaveLastEveningMeal = async (value: 'dinner' | 'supper') => {
    if (!user) return;
    
    setSavingPreference(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          last_evening_meal: value,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, last_evening_meal: value }));
      toast.success('Tipo de refeição noturna atualizado!', {
        description: value === 'dinner' 
          ? 'Seu plano terá Jantar como refeição noturna.' 
          : 'Seu plano terá Ceia como refeição noturna.'
      });
      await refreshProfile();
    } catch (error: any) {
      console.error('Error saving last evening meal:', error);
      toast.error(error.message || 'Erro ao salvar preferência');
    } finally {
      setSavingPreference(false);
    }
  };

  const handleSaveSnackPreference = async (value: 'morning_snack' | 'afternoon_snack') => {
    if (!user) return;
    
    setSavingPreference(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          snack_preference: value,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;

      setFormData(prev => ({ ...prev, snack_preference: value }));
      toast.success('Preferência de lanche atualizada!', {
        description: value === 'morning_snack' 
          ? 'Seu lanche será no meio da manhã.' 
          : 'Seu lanche será no meio da tarde.'
      });
      await refreshProfile();
    } catch (error: any) {
      console.error('Error saving snack preference:', error);
      toast.error(error.message || 'Erro ao salvar preferência');
    } finally {
      setSavingPreference(false);
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

  const breadcrumbItems = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Meu Perfil' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden theme-patient">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Logo size="sm" />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-24 max-w-4xl">
        {/* Breadcrumb Navigation */}
        <BreadcrumbNav items={breadcrumbItems} className="mb-4" />
        
        {/* Page Header */}
        <PageHeader
          title="Meu Perfil"
          description="Gerencie suas informações pessoais e preferências alimentares"
          icon={<User className="w-5 h-5" />}
          backTo="/dashboard"
          backLabel="Dashboard"
          className="mb-6"
        />
        <Tabs defaultValue="personal" className="space-y-4 sm:space-y-6">
          {/* Tabs - Consolidated to 2 tabs */}
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="personal" className="text-xs sm:text-sm py-2.5 sm:py-3 px-2 sm:px-4">
              <User className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span>Dados Pessoais</span>
            </TabsTrigger>
            <TabsTrigger value="diet" className="text-xs sm:text-sm py-2.5 sm:py-3 px-2 sm:px-4">
              <Utensils className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span>Dieta & Alimentos</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Data Tab - Includes Objective */}
          <TabsContent value="personal">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Personal Info Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-primary" />
                        Informações Pessoais
                      </CardTitle>
                      <CardDescription>Definidas no cadastro</CardDescription>
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
                        do seu histórico e evolução nutricional.
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

              {/* Objective Card - Moved from Goals tab */}
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
                        do seu plano alimentar e histórico de adesão.
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
                    {isLinkedStudent && professionalId ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowStudentRequestDialog(true)}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Solicitar Alteração ao Profissional
                      </Button>
                    ) : isPaidUser ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowObjectiveWizard(true)}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Alterar Objetivo
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowUpgradeDialog(true)}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Alterar Objetivo
                        <Badge variant="secondary" className="ml-2 text-xs">Pro</Badge>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delete Account Section */}
              {!isAdmin && (
                <Card className="border-destructive/30 bg-destructive/5">
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
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Excluindo...
                              </>
                            ) : (
                              'Sim, excluir minha conta'
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Diet & Foods Tab - Consolidated */}
          <TabsContent value="diet">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Diet Configuration Card */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Utensils className="h-5 w-5 text-primary" />
                        Configuração da Dieta
                      </CardTitle>
                      <CardDescription>Preferências de refeições</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
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

                  {/* Supplement Toggle - Only for paid users */}
                  {isPaidUser && (
                    <div className="mb-6">
                      <p className="text-sm font-medium mb-3">Suplementação</p>
                      <SupplementToggle 
                        initialValue={(profile as any)?.include_supplements || false}
                      />
                    </div>
                  )}

                  {/* Snack Preference Choice - For 4 meals */}
                  {formData.meals_per_day === 4 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Utensils className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium">Horário do Lanche</p>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3">
                              <p className="font-semibold mb-2">Lanche da Manhã vs Tarde</p>
                              <ul className="text-sm space-y-2">
                                <li><strong>☀️ Manhã:</strong> Entre café da manhã e almoço.</li>
                                <li><strong>🌅 Tarde:</strong> Entre almoço e jantar.</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid gap-2">
                        {SNACK_PREFERENCE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={savingPreference}
                            onClick={() => handleSaveSnackPreference(option.value)}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                              formData.snack_preference === option.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            } ${savingPreference ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className="font-medium text-foreground text-sm block">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              {option.description}
                            </span>
                            {formData.snack_preference === option.value && (
                              <Check className="w-5 h-5 text-primary absolute top-3 right-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last Evening Meal Choice - For 3-5 meals */}
                  {formData.meals_per_day >= 3 && formData.meals_per_day <= 5 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Moon className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium">Tipo de Refeição Noturna</p>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3">
                              <p className="font-semibold mb-2">Jantar vs Ceia</p>
                              <ul className="text-sm space-y-2">
                                <li><strong>🍽️ Jantar:</strong> Refeição quente e completa.</li>
                                <li><strong>🌙 Ceia:</strong> Refeição leve e prática.</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid gap-2">
                        {LAST_EVENING_MEAL_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={savingPreference}
                            onClick={() => handleSaveLastEveningMeal(option.value)}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                              formData.last_evening_meal === option.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            } ${savingPreference ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className="font-medium text-foreground text-sm block">
                              {option.label}
                            </span>
                            <span className="text-xs text-muted-foreground block">
                              {option.description}
                            </span>
                            {formData.last_evening_meal === option.value && (
                              <Check className="w-5 h-5 text-primary absolute top-3 right-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evening Meal Preference - Only for 6 meals */}
                  {formData.meals_per_day === 6 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Moon className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium">Distribuição Noturna</p>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3">
                              <p className="font-semibold mb-2">Como isso afeta seu plano?</p>
                              <p className="text-sm">
                                Com 6 refeições você tem jantar E ceia. Esta escolha define 
                                como as calorias são distribuídas entre eles.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid gap-2">
                        {EVENING_MEAL_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={savingPreference}
                            onClick={() => handleSaveEveningPreference(option.value)}
                            className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                              formData.evening_meal_preference === option.value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            } ${savingPreference ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className="text-xl">{option.icon}</span>
                            <div className="flex-1">
                              <span className="font-medium text-foreground text-sm block">
                                {option.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            </div>
                            {formData.evening_meal_preference === option.value && (
                              <Check className="w-5 h-5 text-primary shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Food Preferences Card - Moved from Foods tab */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Apple className="h-5 w-5 text-primary" />
                    Alimentos Favoritos e Evitados
                  </CardTitle>
                  <CardDescription>Personalize seu plano alimentar</CardDescription>
                </CardHeader>
                <CardContent>
                  <FoodPreferencesManager
                    preferredFoods={profile?.preferred_foods || []}
                    avoidedFoods={profile?.avoided_foods || []}
                    onUpdate={() => refreshProfile()}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Dialogs */}
      {showObjectiveWizard && (
        <ObjectiveChangeWizard
          open={showObjectiveWizard}
          onOpenChange={setShowObjectiveWizard}
          currentGoal={formData.goal || 'maintain'}
          onSuccess={refreshProfile}
        />
      )}

      {showStudentRequestDialog && professionalId && (
        <StudentObjectiveRequestDialog
          open={showStudentRequestDialog}
          onOpenChange={setShowStudentRequestDialog}
          currentGoal={formData.goal || 'maintain'}
          professionalId={professionalId}
        />
      )}

      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        feature="objective_change"
      />
    </div>
  );
}