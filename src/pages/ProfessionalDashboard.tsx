import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Utensils, 
  ArrowLeft, 
  Plus, 
  Eye,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  BarChart3,
  Calendar,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ProfessionalRequestsPanel } from '@/components/ProfessionalRequestsPanel';

import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  goal: string | null;
  daily_calories: number | null;
  latest_diet_date: string | null;
  total_diets: number;
}

export default function ProfessionalDashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isProfessional, loading: roleLoading } = useUserRole();
  
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [metrics, setMetrics] = useState({
    totalDiets: 0,
    dietsThisMonth: 0,
    studentsWithActiveDiets: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !isProfessional) return;
    fetchData();
  }, [user, isProfessional]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // In v2, professional_students table doesn't exist
      // For now, professionals see only their own data or we would need a different approach
      // This is a simplified version - in production you'd implement proper student management
      
      // Fetch diet metrics for the professional's own account
      const { data: diets, error } = await supabase
        .from('diet_plans')
        .select('id, created_at, total_calories')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate metrics
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const dietsThisMonth = diets?.filter(d => 
        new Date(d.created_at) >= startOfMonth
      ).length || 0;

      setMetrics({
        totalDiets: diets?.length || 0,
        dietsThisMonth,
        studentsWithActiveDiets: 0, // No students in v2 simplified version
      });

      // No students to display in v2 simplified version
      setStudents([]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
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

  if (roleLoading) {
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

  return (
    <div className="min-h-screen bg-background theme-professional">
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
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Button size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => navigate('/students')}>
              <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline">Gerenciar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24">
        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 sm:py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm sm:text-base">Área Profissional</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Gerencie seus planos alimentares e acompanhe seu progresso.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="card-professional">
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-success/10">
                    <Utensils className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold stats-professional">{metrics.totalDiets}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Total de Dietas</p>
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
            <Card className="card-professional">
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold stats-professional">{metrics.dietsThisMonth}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Dietas este Mês</p>
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
            <Card className="card-professional">
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-accent/10">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xl sm:text-2xl font-bold stats-professional">{metrics.studentsWithActiveDiets}</p>
                    <p className="text-[10px] sm:text-sm text-muted-foreground">Planos Ativos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2"
              onClick={() => navigate('/dashboard')}
            >
              <Utensils className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm">Ver Meu Plano</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 sm:py-4 flex-col gap-1.5 sm:gap-2"
              onClick={() => navigate('/progress')}
            >
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-xs sm:text-sm">Ver Progresso</span>
            </Button>
          </div>
        </motion.div>

        {/* Student Objective Change Requests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ProfessionalRequestsPanel />
        </motion.div>

        {/* Student Management Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Gerenciamento de Alunos</CardTitle>
              <CardDescription>Acesse a página de alunos para gerenciamento completo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 space-y-3">
                <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Gerencie seus alunos, crie planos e acompanhe o progresso.
                </p>
                <Button onClick={() => navigate('/students')}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Gerenciar Alunos
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
