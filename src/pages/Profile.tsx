import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  User, 
  Save, 
  Loader2,
  Target,
  Activity,
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
  const [hasChanges, setHasChanges] = useState(false);
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

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const togglePreference = (pref: string) => {
    handleChange('preferences', 
      formData.preferences.includes(pref)
        ? formData.preferences.filter((p) => p !== pref)
        : [...formData.preferences, pref]
    );
  };

  const toggleRestriction = (rest: string) => {
    handleChange('restrictions',
      formData.restrictions.includes(rest)
        ? formData.restrictions.filter((r) => r !== rest)
        : [...formData.restrictions, rest]
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const targets = calculateTargets();
      const previousGoal = profile?.goal;
      const goalChanged = previousGoal !== formData.goal;
      
      // Dados pessoais são somente leitura - só salvamos o que pode ser alterado
      const updateData: any = {
        goal: formData.goal || null,
        activity_level: formData.activity_level || null,
        meals_per_day: formData.meals_per_day,
        preferences: formData.preferences,
        restrictions: formData.restrictions,
      };

      // Recalculate targets if goal or activity changed
      if (targets) {
        updateData.daily_calories = targets.calories;
        updateData.protein_target = targets.protein;
        updateData.carbs_target = targets.carbs;
        updateData.fat_target = targets.fat;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();
      setHasChanges(false);
      toast.success('Perfil atualizado com sucesso!');

      // Suggest regenerating plan if goal changed
      if (goalChanged) {
        toast.info('Objetivo alterado! Recomendamos gerar um novo plano alimentar.', {
          duration: 5000,
          action: {
            label: 'Ir para Dashboard',
            onClick: () => navigate('/dashboard'),
          },
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
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
            <Button 
              size="sm" 
              onClick={handleSave} 
              disabled={loading || !hasChanges}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              {loading ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />}
              <span className="hidden xs:inline">Salvar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-20 sm:pb-24 max-w-4xl">
        <Tabs defaultValue="goals" className="space-y-4 sm:space-y-6">
          {/* Tabs */}
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="goals" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <Target className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Objetivo</span>
            </TabsTrigger>
            <TabsTrigger value="diet" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <Utensils className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Dieta</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="text-xs sm:text-sm py-2 sm:py-2.5 px-1 sm:px-3">
              <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Dados</span>
            </TabsTrigger>
          </TabsList>

          {/* Goals Tab - Now first and improved */}
          <TabsContent value="goals">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Objective Selection */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Objetivo Principal
                  </CardTitle>
                  <CardDescription>Escolha seu objetivo para calcularmos suas metas nutricionais</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(Object.entries(GOALS) as [keyof typeof GOALS, typeof GOALS[keyof typeof GOALS]][]).map(
                      ([key, value]) => {
                        const isSelected = formData.goal === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleChange('goal', key)}
                            className={`relative p-5 rounded-xl border-2 text-center transition-all group ${
                              isSelected
                                ? 'border-primary bg-primary/10 shadow-md'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            <span className="text-3xl mb-2 block">
                              {GOAL_ICONS[key]}
                            </span>
                            <span className={`font-semibold block ${isSelected ? 'text-primary' : ''}`}>
                              {value.label}
                            </span>
                            <span className="text-xs text-muted-foreground mt-1 block">
                              {value.calorieAdjustment > 0 ? '+' : ''}{value.calorieAdjustment} kcal
                            </span>
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                                <span className="text-primary-foreground text-xs">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Level Selection */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Nível de Atividade Física
                  </CardTitle>
                  <CardDescription>Quanto exercício você pratica na semana?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {(Object.entries(ACTIVITY_LEVELS) as [keyof typeof ACTIVITY_LEVELS, typeof ACTIVITY_LEVELS[keyof typeof ACTIVITY_LEVELS]][]).map(
                      ([key, value]) => {
                        const isSelected = formData.activity_level === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleChange('activity_level', key)}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            <span className="text-2xl w-10 text-center shrink-0">
                              {ACTIVITY_ICONS[key]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className={`font-medium block ${isSelected ? 'text-primary' : ''}`}>
                                {value.label}
                              </span>
                              <span className="text-sm text-muted-foreground">{value.description}</span>
                            </div>
                            {isSelected && (
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shrink-0">
                                <span className="text-primary-foreground text-sm">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      }
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Calculated Targets Preview */}
              {targets && (
                <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Suas Metas Diárias Calculadas
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

          {/* Diet Preferences Tab */}
          <TabsContent value="diet">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-primary" />
                    Refeições por Dia
                  </CardTitle>
                  <CardDescription>Quantas refeições você costuma fazer?</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    {[2, 3, 4, 5, 6].map((num) => {
                      const isSelected = formData.meals_per_day === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleChange('meals_per_day', num)}
                          className={`h-14 sm:h-16 rounded-xl border-2 text-xl font-bold transition-all ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Preferências Alimentares</CardTitle>
                  <CardDescription>Selecione os tipos de alimentos que você prefere</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {FOOD_PREFERENCES.map((pref) => {
                      const isSelected = formData.preferences.includes(pref);
                      return (
                        <button
                          key={pref}
                          type="button"
                          onClick={() => togglePreference(pref)}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted hover:bg-muted/80 hover:shadow-sm'
                          }`}
                        >
                          {pref}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-4">
                  <CardTitle>Restrições Alimentares</CardTitle>
                  <CardDescription>Selecione alimentos que você não pode ou não quer consumir</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {FOOD_RESTRICTIONS.map((rest) => {
                      const isSelected = formData.restrictions.includes(rest);
                      return (
                        <button
                          key={rest}
                          type="button"
                          onClick={() => toggleRestriction(rest)}
                          className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-destructive text-destructive-foreground shadow-sm'
                              : 'bg-muted hover:bg-muted/80 hover:shadow-sm'
                          }`}
                        >
                          {rest}
                        </button>
                      );
                    })}
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
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
