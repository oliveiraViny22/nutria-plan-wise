import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Loader2,
  Utensils,
  Trash2,
  AlertTriangle,
  Lock,
  Apple,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
import { ObjectiveChangeWizard } from '@/components/ObjectiveChangeWizard';
import { StudentObjectiveRequestDialog } from '@/components/StudentObjectiveRequestDialog';
import { UpgradeDialog } from '@/components/UpgradeDialog';
import { FoodPreferencesManager } from '@/components/FoodPreferencesManager';
import { SupplementToggle } from '@/components/SupplementToggle';
import { useLinkedStudent } from '@/hooks/useLinkedStudent';
import { useSubscription } from '@/hooks/useSubscription';

import {
  CompactProfileData,
  CompactObjectiveDisplay,
  CompactMealPreferences,
  InlineBadgeList,
} from '@/components/profile';

const ADMIN_EMAIL = "admin@nutriaplan.com";

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showObjectiveWizard, setShowObjectiveWizard] = useState(false);
  const [showStudentRequestDialog, setShowStudentRequestDialog] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  
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
      toast.success('Preferência noturna atualizada!');
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
      toast.success('Refeição noturna atualizada!');
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
      toast.success('Preferência de lanche atualizada!');
      await refreshProfile();
    } catch (error: any) {
      console.error('Error saving snack preference:', error);
      toast.error(error.message || 'Erro ao salvar preferência');
    } finally {
      setSavingPreference(false);
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
          description="Gerencie suas informações e preferências"
          icon={<User className="w-5 h-5" />}
          backTo="/dashboard"
          backLabel="Dashboard"
          className="mb-4"
        />

        <Tabs defaultValue="personal" className="space-y-4">
          {/* Tabs */}
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="personal" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
              <User className="h-4 w-4 mr-1.5" />
              <span>Dados Pessoais</span>
            </TabsTrigger>
            <TabsTrigger value="diet" className="text-xs sm:text-sm py-2 px-2 sm:px-4">
              <Utensils className="h-4 w-4 mr-1.5" />
              <span>Dieta & Alimentos</span>
            </TabsTrigger>
          </TabsList>

          {/* Personal Data Tab */}
          <TabsContent value="personal">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Compact Personal Info Card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Informações Pessoais
                    </CardTitle>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                            <Lock className="h-3 w-3" />
                            <span className="hidden sm:inline">Somente leitura</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs p-3">
                          <p className="font-semibold mb-1">Por que não posso alterar?</p>
                          <p className="text-sm text-muted-foreground">
                            Os dados pessoais são fixados no cadastro para garantir a precisão 
                            do seu histórico e evolução nutricional.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </CardHeader>
                <CardContent>
                  <CompactProfileData
                    name={formData.name}
                    age={formData.age}
                    sex={formData.sex}
                    height={formData.height}
                    weight={formData.weight}
                  />
                </CardContent>
              </Card>

              {/* Compact Objective Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />
                    Objetivo & Atividade
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CompactObjectiveDisplay
                    goal={formData.goal}
                    activityLevel={formData.activity_level}
                    isLinkedStudent={isLinkedStudent}
                    isPaidUser={isPaidUser}
                    onRequestChange={() => setShowObjectiveWizard(true)}
                    onStudentRequest={() => setShowStudentRequestDialog(true)}
                    onUpgrade={() => setShowUpgradeDialog(true)}
                  />
                </CardContent>
              </Card>

              {/* Collapsible Delete Account Section */}
              {!isAdmin && (
                <Collapsible open={dangerZoneOpen} onOpenChange={setDangerZoneOpen}>
                  <Card className="border-destructive/20">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Zona de Perigo
                          </CardTitle>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dangerZoneOpen ? 'rotate-180' : ''}`} />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="w-full sm:w-auto">
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
                                  Esta ação é <strong>irreversível</strong>. Todos os seus dados serão excluídos:
                                </p>
                                <ul className="list-disc list-inside text-sm space-y-1">
                                  <li>Perfil e informações pessoais</li>
                                  <li>Planos alimentares e histórico</li>
                                  <li>Registros de refeições e adesão</li>
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
                                  'Sim, excluir'
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
            </motion.div>
          </TabsContent>

          {/* Diet & Foods Tab */}
          <TabsContent value="diet">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Diet Configuration Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Utensils className="h-4 w-4 text-primary" />
                    Configuração da Dieta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CompactMealPreferences
                    mealsPerDay={formData.meals_per_day}
                    snackPreference={formData.snack_preference}
                    lastEveningMeal={formData.last_evening_meal}
                    eveningMealPreference={formData.evening_meal_preference}
                    savingPreference={savingPreference}
                    onSnackChange={handleSaveSnackPreference}
                    onEveningMealChange={handleSaveLastEveningMeal}
                    onEveningPreferenceChange={handleSaveEveningPreference}
                  />

                  {/* Inline Preferences & Restrictions */}
                  <div className="pt-3 border-t border-border/50 space-y-2">
                    <InlineBadgeList
                      title="Preferências"
                      items={formData.preferences}
                      variant="secondary"
                      emptyText="Nenhuma"
                    />
                    <InlineBadgeList
                      title="Restrições"
                      items={formData.restrictions}
                      variant="destructive"
                      emptyText="Nenhuma"
                    />
                  </div>

                  {/* Supplement Toggle - Only for paid users */}
                  {isPaidUser && (
                    <div className="pt-3 border-t border-border/50">
                      <SupplementToggle 
                        initialValue={(profile as any)?.include_supplements || false}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Food Preferences Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Apple className="h-4 w-4 text-primary" />
                    Alimentos Favoritos e Evitados
                  </CardTitle>
                  <CardDescription className="text-xs">Personalize seu plano alimentar</CardDescription>
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
          onSuccess={async (action) => {
            await refreshProfile();
            if (action === 'generate') {
              navigate('/meal-plan?action=generate');
            } else if (action === 'rebalance') {
              navigate('/meal-plan?action=rebalance');
            }
          }}
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
