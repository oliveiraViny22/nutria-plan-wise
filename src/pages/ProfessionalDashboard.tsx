import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Utensils, 
  TrendingUp, 
  Clock, 
  ArrowLeft, 
  Plus, 
  Eye,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  BarChart3,
  Calendar,
  Target
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ProfessionalOnboarding } from '@/components/ProfessionalOnboarding';
import { useUserRole } from '@/hooks/useUserRole';
import { useProfessionalStudents } from '@/hooks/useProfessionalStudents';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StudentDietInfo {
  student_id: string;
  student_name: string;
  student_email: string;
  latest_diet_date: string | null;
  total_diets: number;
  status: 'active' | 'inactive' | 'pending';
  goal: string | null;
  daily_calories: number | null;
}

export default function ProfessionalDashboard() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { isProfessional, loading: roleLoading } = useUserRole();
  const { students, license, loading: studentsLoading, studentCount, isLicenseActive } = useProfessionalStudents();
  
  const [studentDiets, setStudentDiets] = useState<StudentDietInfo[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [metrics, setMetrics] = useState({
    totalDiets: 0,
    dietsThisMonth: 0,
    averageCalories: 0,
    studentsWithActiveDiets: 0,
  });
  const [loading, setLoading] = useState(true);

  // Check if professional onboarding is needed
  useEffect(() => {
    if (profile && isProfessional && !roleLoading) {
      // Show onboarding if not completed
      const onboardingCompleted = (profile as any).professional_onboarding_completed;
      if (!onboardingCompleted) {
        setShowOnboarding(true);
      }
    }
  }, [profile, isProfessional, roleLoading]);

  useEffect(() => {
    if (!user || !isProfessional) return;
    fetchDietData();
  }, [user, isProfessional, students]);

  const fetchDietData = async () => {
    if (!students || students.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const studentIds = students.map(s => s.student_id);
      
      // Fetch diet plans for all students
      const { data: diets, error } = await supabase
        .from('diet_plans')
        .select('user_id, created_at, total_calories')
        .in('user_id', studentIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate metrics
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const dietsThisMonth = diets?.filter(d => 
        new Date(d.created_at) >= startOfMonth
      ).length || 0;

      const studentsWithDiets = new Set(diets?.map(d => d.user_id)).size;
      const avgCalories = diets?.length 
        ? Math.round(diets.reduce((sum, d) => sum + (d.total_calories || 0), 0) / diets.length)
        : 0;

      setMetrics({
        totalDiets: diets?.length || 0,
        dietsThisMonth,
        averageCalories: avgCalories,
        studentsWithActiveDiets: studentsWithDiets,
      });

      // Build student diet info
      const studentDietMap = new Map<string, { count: number; latest: string | null }>();
      diets?.forEach(d => {
        const existing = studentDietMap.get(d.user_id);
        if (!existing) {
          studentDietMap.set(d.user_id, { count: 1, latest: d.created_at });
        } else {
          studentDietMap.set(d.user_id, { 
            count: existing.count + 1, 
            latest: d.created_at > (existing.latest || '') ? d.created_at : existing.latest 
          });
        }
      });

      const dietInfos: StudentDietInfo[] = students.map(s => ({
        student_id: s.student_id,
        student_name: s.profile?.name || 'Sem nome',
        student_email: s.profile?.email || '',
        latest_diet_date: studentDietMap.get(s.student_id)?.latest || null,
        total_diets: studentDietMap.get(s.student_id)?.count || 0,
        status: s.status as 'active' | 'inactive' | 'pending',
        goal: s.profile?.goal || null,
        daily_calories: s.profile?.daily_calories || null,
      }));

      // Sort by most recent activity
      dietInfos.sort((a, b) => {
        if (!a.latest_diet_date && !b.latest_diet_date) return 0;
        if (!a.latest_diet_date) return 1;
        if (!b.latest_diet_date) return -1;
        return new Date(b.latest_diet_date).getTime() - new Date(a.latest_diet_date).getTime();
      });

      setStudentDiets(dietInfos);
    } catch (error) {
      console.error('Error fetching diet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getGoalLabel = (goal: string | null) => {
    const goals: Record<string, string> = {
      lose_weight: 'Emagrecer',
      maintain: 'Manter',
      gain_muscle: 'Ganhar massa',
    };
    return goal ? goals[goal] || goal : 'Não definido';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (roleLoading || studentsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isProfessional) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6 space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Este dashboard é exclusivo para profissionais.
            </p>
            <Button onClick={() => navigate('/become-professional')}>
              Tornar-se Profissional
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    await refreshProfile();
  };

  const activeStudents = students?.filter(s => s.status === 'active').length || 0;
  const licenseUsage = license?.max_students ? (studentCount / license.max_students) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Professional Onboarding */}
      {showOnboarding && (
        <ProfessionalOnboarding onComplete={handleOnboardingComplete} />
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b pt-safe">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-sm sm:text-lg font-semibold truncate hidden xs:block">Painel Profissional</h1>
          <Button size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => navigate('/students')}>
            <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Gerenciar</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24">
        {/* License Warning */}
        {!isLicenseActive && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-destructive/50 bg-destructive/10">
              <CardContent className="py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                    <div>
                      <p className="font-medium text-destructive text-sm sm:text-base">Licença Inativa ou Expirada</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Renove sua licença para continuar gerenciando alunos.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="destructive" className="w-full sm:w-auto" onClick={() => navigate('/become-professional')}>
                    Renovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{activeStudents}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Alunos Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                    <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.totalDiets}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Total de Dietas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.dietsThisMonth}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Dietas este Mês</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold">{metrics.studentsWithActiveDiets}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Planos Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* License Usage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Target className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Uso da Licença
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6">
              <div className="flex justify-between text-xs sm:text-sm">
                <span>Alunos vinculados</span>
                <span className="font-medium">{studentCount} / {license?.max_students || 0}</span>
              </div>
              <Progress value={licenseUsage} className="h-1.5 sm:h-2" />
              {license?.expires_at && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Licença válida até {new Date(license.expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2"
              onClick={() => navigate('/students')}
            >
              <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm">Adicionar Aluno</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2"
              onClick={() => navigate('/students')}
            >
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm">Ver Todos Alunos</span>
            </Button>
          </div>
        </motion.div>

        {/* Students List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Visão Geral dos Alunos</CardTitle>
                  <CardDescription>Acompanhe as dietas e progresso</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/students')}>
                  Ver todos
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {studentDiets.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhum aluno vinculado ainda</p>
                  <Button onClick={() => navigate('/students')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Aluno
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentDiets.slice(0, 5).map((student, index) => (
                    <motion.div
                      key={student.student_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * index }}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/student/${student.student_id}`)}
                    >
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(student.student_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{student.student_name}</p>
                          {student.status === 'active' ? (
                            <Badge variant="secondary" className="bg-green-500/10 text-green-600 text-xs">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {student.status === 'inactive' ? 'Inativo' : 'Pendente'}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {getGoalLabel(student.goal)}
                          </span>
                          {student.daily_calories && (
                            <span>{student.daily_calories} kcal</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Utensils className="h-3 w-3" />
                          <span className="font-medium">{student.total_diets}</span>
                          <span className="text-muted-foreground">dietas</span>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(student.latest_diet_date)}
                        </p>
                      </div>

                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                  
                  {studentDiets.length > 5 && (
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => navigate('/students')}
                    >
                      Ver mais {studentDiets.length - 5} alunos
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Students Needing Attention */}
        {studentDiets.filter(s => !s.latest_diet_date || s.status !== 'active').length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card className="border-yellow-500/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Alunos que Precisam de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {studentDiets
                    .filter(s => !s.latest_diet_date || s.status !== 'active')
                    .slice(0, 3)
                    .map(student => (
                      <div 
                        key={student.student_id}
                        className="flex items-center justify-between p-2 rounded-lg bg-yellow-500/5"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(student.student_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{student.student_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {!student.latest_diet_date 
                                ? 'Sem dieta criada'
                                : `Inativo - última dieta ${formatDate(student.latest_diet_date)}`}
                            </p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => navigate(`/student/${student.student_id}`)}
                        >
                          Ver
                        </Button>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}
