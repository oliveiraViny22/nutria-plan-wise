import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  User,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export default function StudentView() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isProfessional, loading: roleLoading } = useUserRole();

  if (roleLoading) {
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
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-4">
              Apenas profissionais podem visualizar dados de alunos.
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
    <div className="min-h-screen bg-background theme-professional">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b pt-safe">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav />
            <Button variant="ghost" size="icon" className="hidden md:flex h-9 w-9 sm:h-10 sm:w-10" onClick={() => navigate('/students')}>
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Logo size="sm" />
          </div>
          <h1 className="text-sm sm:text-lg font-semibold truncate max-w-[140px] sm:max-w-[200px]">
            Visualização de Aluno
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-safe">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Funcionalidade em Desenvolvimento</h2>
              <p className="text-muted-foreground mb-4">
                O gerenciamento de alunos estará disponível em breve.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Esta funcionalidade está sendo atualizada para a nova versão do sistema.
              </p>
              <Button onClick={() => navigate('/professional-dashboard')}>
                Voltar ao Painel Profissional
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
