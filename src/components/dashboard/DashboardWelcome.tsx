import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { FadeInView } from '@/components/ui-kit';
import { GOALS } from '@/lib/types';

interface DashboardWelcomeProps {
  userName?: string;
  goal?: string | null;
  isLinkedStudent: boolean;
}

export function DashboardWelcome({ userName, goal, isLinkedStudent }: DashboardWelcomeProps) {
  return (
    <>
      {/* Linked Student Read-Only Notice */}
      {isLinkedStudent && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted/50 border border-border rounded-lg sm:rounded-xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3"
        >
          <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-medium text-foreground">Modo Visualização</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              Seu plano alimentar é gerenciado pelo seu nutricionista.
            </p>
          </div>
        </motion.div>
      )}

      {/* Welcome Section */}
      <FadeInView direction="up">
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-sans font-bold text-foreground tracking-tight">
            Olá, {userName?.split(' ')[0] || 'Usuário'}! 👋
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-light">
            {goal
              ? `Objetivo: ${GOALS[goal as keyof typeof GOALS]?.label}`
              : 'Acompanhe seu plano alimentar personalizado'}
          </p>
        </section>
      </FadeInView>
    </>
  );
}
