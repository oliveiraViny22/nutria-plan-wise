import { motion } from 'framer-motion';
import { HelpCircle } from 'lucide-react';

interface DashboardFooterProps {
  onOpenTutorial: () => void;
}

export function DashboardFooter({ onOpenTutorial }: DashboardFooterProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="text-center px-4 py-6 space-y-3"
    >
      <button
        onClick={onOpenTutorial}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Ver tutorial do sistema
      </button>
      <p className="text-xs text-muted-foreground">
        Este aplicativo oferece educação nutricional e não substitui um
        profissional de saúde. Consulte um nutricionista para orientação
        personalizada.
      </p>
    </motion.section>
  );
}
