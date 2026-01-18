import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search, 
  ArrowLeft,
  MoreVertical,
  UserMinus,
  Eye,
  Mail,
  Target,
  Flame,
  Crown,
  Calendar,
  AlertCircle,
  UserCheck,
  UserX,
  UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { CreateStudentForm } from '@/components/CreateStudentForm';
import { useProfessionalStudents } from '@/hooks/useProfessionalStudents';
import { useUserRole } from '@/hooks/useUserRole';
import { GOALS } from '@/lib/types';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Students() {
  const navigate = useNavigate();
  const { students, license, loading, studentCount, isLicenseActive, removeStudent, updateStudentStatus, refresh } = useProfessionalStudents();
  const { isProfessional, loading: roleLoading } = useUserRole();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<string | null>(null);

  // Filter students by search
  const filteredStudents = students.filter(student => {
    const name = student.profile?.name?.toLowerCase() || '';
    const email = student.profile?.email?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  const handleStudentCreated = () => {
    setIsCreateDialogOpen(false);
    refresh();
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;
    await removeStudent(studentToRemove);
    setStudentToRemove(null);
  };

  const getDaysRemaining = () => {
    if (!license) return 0;
    return differenceInDays(new Date(license.expires_at), new Date());
  };

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isProfessional) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6">
            <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Área Profissional</h2>
            <p className="text-muted-foreground mb-4">
              Esta área é exclusiva para profissionais com licença ativa.
            </p>
            <Button onClick={() => navigate('/dashboard')}>
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-sm sm:text-lg font-semibold truncate">Gestão de Alunos</h1>
          <div className="w-9 sm:w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* License Status */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className={`border-l-4 ${isLicenseActive ? 'border-l-primary' : 'border-l-destructive'}`}>
            <CardContent className="py-3 sm:py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 rounded-full ${isLicenseActive ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                    <Crown className={`h-4 w-4 sm:h-5 sm:w-5 ${isLicenseActive ? 'text-primary' : 'text-destructive'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">
                      Licença {license?.license_type === 'annual' ? 'Anual' : 'Mensal'}
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {isLicenseActive 
                        ? `${getDaysRemaining()} dias restantes`
                        : 'Licença expirada'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm ml-8 sm:ml-0">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                    <span>{studentCount} / {license?.max_students || 0}</span>
                  </div>
                  {license && (
                    <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Expira em {format(new Date(license.expires_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Actions Bar - stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar aluno..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                disabled={!isLicenseActive || studentCount >= (license?.max_students || 0)}
                className="w-full sm:w-auto text-sm h-10"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Cadastrar Aluno
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-4 sm:mx-0 max-w-lg max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle className="text-base sm:text-lg">Cadastrar Novo Aluno</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Preencha todos os dados do aluno. Ele receberá as credenciais de acesso para entrar na plataforma.
                </DialogDescription>
              </DialogHeader>
              <CreateStudentForm
                onSuccess={handleStudentCreated}
                onCancel={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* License Warning */}
        {!isLicenseActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="py-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <p className="text-sm">
                  Sua licença expirou. Renove para continuar gerenciando seus alunos e acessando seus planos.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Students List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredStudents.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery 
                    ? 'Tente buscar com outros termos'
                    : 'Comece cadastrando seus alunos'}
                </p>
                {!searchQuery && isLicenseActive && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Cadastrar Primeiro Aluno
                  </Button>
                )}
              </motion.div>
            ) : (
              filteredStudents.map((student, index) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="card-interactive">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-primary font-semibold">
                              {(student.profile?.name || 'A')[0].toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-medium truncate">
                                {student.profile?.name || 'Aluno sem nome'}
                              </h3>
                              <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                                {student.status === 'active' ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {student.profile?.email || 'Email não informado'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          {/* Stats */}
                          <div className="hidden md:flex items-center gap-4 text-sm">
                            {student.profile?.goal && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Target className="h-4 w-4" />
                                <span>{GOALS[student.profile.goal as keyof typeof GOALS]?.label || student.profile.goal}</span>
                              </div>
                            )}
                            {student.profile?.daily_calories && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Flame className="h-4 w-4" />
                                <span>{student.profile.daily_calories} kcal</span>
                              </div>
                            )}
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/student/${student.student_id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Plano
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.location.href = `mailto:${student.profile?.email}`}>
                                <Mail className="h-4 w-4 mr-2" />
                                Enviar Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {student.status === 'active' ? (
                                <DropdownMenuItem onClick={() => updateStudentStatus(student.student_id, 'inactive')}>
                                  <UserX className="h-4 w-4 mr-2" />
                                  Marcar como Inativo
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => updateStudentStatus(student.student_id, 'active')}>
                                  <UserCheck className="h-4 w-4 mr-2" />
                                  Marcar como Ativo
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => setStudentToRemove(student.student_id)}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remover Aluno
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Remove Student Confirmation */}
      <AlertDialog open={!!studentToRemove} onOpenChange={() => setStudentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Aluno</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este aluno? Ele perderá o vínculo com você e não poderá mais ser gerenciado pela sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveStudent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
