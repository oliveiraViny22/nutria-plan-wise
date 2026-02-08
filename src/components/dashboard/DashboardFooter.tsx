import { motion } from 'framer-motion';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardFooterProps {
  onOpenTutorial: () => void;
  onResetTutorials?: () => void;
}

export function DashboardFooter({ onOpenTutorial, onResetTutorials }: DashboardFooterProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="text-center px-4 py-6 space-y-3"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs text-primary gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Ajuda e Tutorial
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={onOpenTutorial}>
            <HelpCircle className="w-4 h-4 mr-2" />
            Ver tutorial do sistema
          </DropdownMenuItem>
          {onResetTutorials && (
            <DropdownMenuItem onClick={onResetTutorials}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Resetar dicas e guias
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      
      <p className="text-xs text-muted-foreground">
        Este aplicativo oferece educação nutricional e não substitui um
        profissional de saúde. Consulte um nutricionista para orientação
        personalizada. © 2026 NutriaPlan.
      </p>
    </motion.section>
  );
}
