import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  UserCircle,
  Apple,
  Info,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  ACTIVITY_LEVELS,
  GOALS,
  FOOD_PREFERENCES,
  FOOD_RESTRICTIONS,
} from '@/lib/types';
import { ObjectiveChangeWizard } from '@/components/ObjectiveChangeWizard';
import { StudentObjectiveRequestDialog } from '@/components/StudentObjectiveRequestDialog';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { FoodPreferencesManager } from '@/components/FoodPreferencesManager';
import { SupplementToggle } from '@/components/SupplementToggle';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useSubscription } from '@/hooks/useSubscription';
import { useMetabolicCalculations } from '@/hooks/useMetabolicCalculations';

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
  
  // Metabolic calculations
  const metabolicData = useMetabolicCalculations(profile);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '' as 'male' | 'female' | 'other' | '',
    height: '',
    weight: '',
    goal: '' as 'lose_weight' | 'maintain' | 'gain_muscle' | '',
    activity_level: '' as 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active' | '',
    meals_per_day: 4,
    snack_preference: 'afternoon_snack' as 'morning_snack' | 'afternoon_snack', // Para 4 refeições
    last_evening_meal: 'dinner' as 'dinner' | 'supper', // Para 3-5 refeições
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
      // Refresh session before critical operation to ensure valid token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        // If refresh fails, try getting current session as fallback
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Sua sessão expirou. Faça login novamente.');
          await signOut();
          navigate('/login');
          return;
        }
      }

      // Get the fresh session after refresh
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
          <TabsList className="grid w-full grid-cols-4 h-auto">
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
            <TabsTrigger value="foods" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <Apple className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Alimentos</span>
            </TabsTrigger>
          </TabsList>


          <TabsContent value="goals">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Saved Targets from Profile - Uses actual saved values */}
              {(profile?.daily_calories || profile?.protein_target || profile?.carbs_target || profile?.fat_target) && (
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
                        <p className="text-2xl font-bold text-primary">{profile?.daily_calories || '-'}</p>
                        <p className="text-xs text-muted-foreground">kcal/dia</p>
                      </div>
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-protein/20 flex items-center justify-center">
                          <span className="text-protein font-bold text-sm">P</span>
                        </div>
                        <p className="text-2xl font-bold text-protein">{profile?.protein_target || '-'}g</p>
                        <p className="text-xs text-muted-foreground">Proteína</p>
                      </div>
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-carbs/20 flex items-center justify-center">
                          <span className="text-carbs font-bold text-sm">C</span>
                        </div>
                        <p className="text-2xl font-bold text-carbs">{profile?.carbs_target || '-'}g</p>
                        <p className="text-xs text-muted-foreground">Carboidratos</p>
                      </div>
                      <div className="bg-background/60 rounded-xl p-4 text-center">
                        <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-fat/20 flex items-center justify-center">
                          <span className="text-fat font-bold text-sm">G</span>
                        </div>
                        <p className="text-2xl font-bold text-fat">{profile?.fat_target || '-'}g</p>
                        <p className="text-xs text-muted-foreground">Gordura</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* TMB & TDEE Card with Tooltips and Goal Comparison */}
              {metabolicData && (
                <TooltipProvider delayDuration={200}>
                  <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/10">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Flame className="h-5 w-5 text-amber-500" />
                        Metabolismo Base
                      </CardTitle>
                      <CardDescription>
                        Calculado pela fórmula de Mifflin-St Jeor
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* TMB with Tooltip */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="bg-background/60 rounded-xl p-4 text-center cursor-help hover:bg-background/80 transition-colors">
                              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-amber-500/20 flex items-center justify-center relative">
                                <Flame className="h-4 w-4 text-amber-500" />
                                <Info className="h-3 w-3 text-muted-foreground absolute -top-1 -right-1" />
                              </div>
                              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metabolicData.bmr}</p>
                              <p className="text-xs text-muted-foreground">TMB (kcal/dia)</p>
                              <p className="text-[10px] text-muted-foreground mt-1">Taxa Metabólica Basal</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs p-3">
                            <p className="font-semibold mb-1">O que é TMB?</p>
                            <p className="text-sm">
                              A Taxa Metabólica Basal é a quantidade de calorias que seu corpo queima 
                              <strong> apenas para manter as funções vitais</strong> (respiração, batimentos 
                              cardíacos, temperatura corporal) enquanto você está em repouso absoluto.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        
                        {/* TDEE with Tooltip */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="bg-background/60 rounded-xl p-4 text-center cursor-help hover:bg-background/80 transition-colors">
                              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-orange-500/20 flex items-center justify-center relative">
                                <TrendingUp className="h-4 w-4 text-orange-500" />
                                <Info className="h-3 w-3 text-muted-foreground absolute -top-1 -right-1" />
                              </div>
                              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{metabolicData.tdee}</p>
                              <p className="text-xs text-muted-foreground">TDEE (kcal/dia)</p>
                              <p className="text-[10px] text-muted-foreground mt-1">Gasto Total Diário</p>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs p-3">
                            <p className="font-semibold mb-1">O que é TDEE?</p>
                            <p className="text-sm">
                              O Gasto Energético Total Diário inclui a TMB mais todas as calorias 
                              que você queima com <strong>atividades físicas e digestão</strong>. 
                              É o total que você gasta em um dia normal.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      {/* TDEE vs Goal Comparison */}
                      {profile?.daily_calories && (
                        <div className="bg-background/80 rounded-xl p-4 border border-border/50">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium">Comparação com sua Meta</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs p-3">
                                <p className="text-sm">
                                  Comparamos seu TDEE (gasto real) com a meta calórica do seu plano 
                                  para verificar se está alinhado ao seu objetivo.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          
                          {(() => {
                            const diff = profile.daily_calories - metabolicData.tdee;
                            const diffPercent = Math.round((diff / metabolicData.tdee) * 100);
                            const normalizedGoal = formData.goal || 'maintain';
                            
                            const getExpectedRange = () => {
                              switch (normalizedGoal) {
                                case 'lose_weight':
                                  return { min: -25, max: -10, label: 'déficit de 10-25%', expected: 'abaixo' };
                                case 'gain_muscle':
                                  return { min: 10, max: 20, label: 'superávit de 10-20%', expected: 'acima' };
                                default:
                                  return { min: -5, max: 5, label: 'variação de ±5%', expected: 'igual' };
                              }
                            };
                            
                            const range = getExpectedRange();
                            const isAligned = diffPercent >= range.min && diffPercent <= range.max;
                            const goalLabel = GOALS[normalizedGoal as keyof typeof GOALS]?.label || 'Manutenção';
                            
                            return (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">TDEE (você gasta)</span>
                                  <span className="font-semibold">{metabolicData.tdee} kcal</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Meta (você consome)</span>
                                  <span className="font-semibold">{profile.daily_calories} kcal</span>
                                </div>
                                <div className="h-px bg-border" />
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Diferença</span>
                                  <div className="flex items-center gap-2">
                                    {diff > 0 ? (
                                      <ArrowUpRight className="h-4 w-4 text-primary" />
                                    ) : diff < 0 ? (
                                      <ArrowDownRight className="h-4 w-4 text-destructive" />
                                    ) : (
                                      <Minus className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className={`font-bold ${
                                      diff > 0 ? 'text-primary' : diff < 0 ? 'text-destructive' : 'text-muted-foreground'
                                    }`}>
                                      {diff > 0 ? '+' : ''}{diff} kcal ({diffPercent > 0 ? '+' : ''}{diffPercent}%)
                                    </span>
                                  </div>
                                </div>
                                
                                {/* Alignment feedback */}
                                <div className={`p-3 rounded-lg text-sm ${
                                  isAligned 
                                    ? 'bg-primary/10 border border-primary/30' 
                                    : 'bg-amber-500/10 border border-amber-500/30'
                                }`}>
                                  {isAligned ? (
                                    <p className="text-primary">
                                      ✓ <strong>Meta alinhada!</strong> Para <em>{goalLabel}</em>, 
                                      esperamos um {range.label}. Sua meta está dentro do ideal.
                                    </p>
                                  ) : (
                                    <p className="text-amber-600 dark:text-amber-400">
                                      ⚠️ Para <em>{goalLabel}</em>, esperamos um {range.label}, 
                                      mas sua meta está {diffPercent > 0 ? '+' : ''}{diffPercent}% do TDEE. 
                                      Considere revisar com um profissional.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground text-center mt-4">
                        Seu corpo queima aproximadamente <span className="font-semibold text-foreground">{metabolicData.bmr} kcal</span> em repouso 
                        e <span className="font-semibold text-foreground">{metabolicData.tdee} kcal</span> considerando sua atividade física.
                      </p>
                    </CardContent>
                  </Card>
                </TooltipProvider>
              )}

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

                  {/* Supplement Toggle - Only for paid users */}
                  {isPaidUser && (
                    <div className="mb-6">
                      <p className="text-sm font-medium mb-3">Suplementação</p>
                      <SupplementToggle 
                        initialValue={(profile as any)?.include_supplements || false}
                      />
                    </div>
                  )}

                  {/* Snack Preference Choice - For 4 meals: Morning OR Afternoon */}
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
                                <li><strong>☀️ Manhã:</strong> Entre café da manhã e almoço, ideal para quem acorda cedo.</li>
                                <li><strong>🌅 Tarde:</strong> Entre almoço e jantar, ideal para manter a energia à tarde.</li>
                              </ul>
                              <p className="text-xs text-muted-foreground mt-2">
                                A alteração será aplicada ao gerar um novo plano.
                              </p>
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
                            <span className="text-xs text-primary/80 mt-1 block">
                              {option.examples}
                            </span>
                            {formData.snack_preference === option.value && (
                              <Check className="w-5 h-5 text-primary absolute top-3 right-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last Evening Meal Choice - For 3-5 meals: Jantar OR Ceia */}
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
                                <li><strong>🍽️ Jantar:</strong> Refeição quente e completa com proteína, carboidrato e vegetais.</li>
                                <li><strong>🌙 Ceia:</strong> Refeição leve e prática, ideal para quem prefere algo mais leve à noite.</li>
                              </ul>
                              <p className="text-xs text-muted-foreground mt-2">
                                A alteração será aplicada ao gerar um novo plano.
                              </p>
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
                            className={`p-3 rounded-xl border text-left transition-all ${
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
                            <span className="text-xs text-primary/80 mt-1 block">
                              {option.examples}
                            </span>
                            {formData.last_evening_meal === option.value && (
                              <Check className="w-5 h-5 text-primary absolute top-3 right-3" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Evening Meal Preference - Only for 6 meals: distribution between dinner + supper */}
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
                                como as calorias e itens são distribuídos entre eles.
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

                  {/* Request Change Button - Only for paid users */}
                  <div className="pt-4 border-t">
                    {isPaidUser ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => toast.info('Funcionalidade de solicitação de alteração será implementada em breve.')}
                      >
                        <Utensils className="h-4 w-4 mr-2" />
                        Solicitar Alteração de Dieta
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowUpgradeDialog(true)}
                      >
                        <Lock className="h-4 w-4 mr-2" />
                        Solicitar Alteração de Dieta
                        <Badge variant="secondary" className="ml-2 text-xs">Pro</Badge>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Foods Preferences Tab */}
          <TabsContent value="foods">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FoodPreferencesManager
                preferredFoods={profile?.preferred_foods || []}
                avoidedFoods={profile?.avoided_foods || []}
                onUpdate={() => refreshProfile()}
              />
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

      {/* Objective Change Wizard for Paid Users */}
      <ObjectiveChangeWizard
        open={showObjectiveWizard}
        onOpenChange={setShowObjectiveWizard}
        currentGoal={formData.goal || null}
        onSuccess={() => refreshProfile()}
      />

      {/* Student Request Dialog for Linked Students */}
      {professionalId && (
        <StudentObjectiveRequestDialog
          open={showStudentRequestDialog}
          onOpenChange={setShowStudentRequestDialog}
          currentGoal={formData.goal || null}
          professionalId={professionalId}
        />
      )}

      {/* Upgrade Dialog for Free Users */}
      <UpgradeDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        feature="objective"
      />
    </div>
  );
}
