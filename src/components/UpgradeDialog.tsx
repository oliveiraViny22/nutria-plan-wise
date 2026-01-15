import { useNavigate } from 'react-router-dom';
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
import { Crown, Zap, ArrowRight } from 'lucide-react';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentPlan?: string;
  limit?: number;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  feature,
  currentPlan = 'Gratuito',
  limit = 0,
}: UpgradeDialogProps) {
  const navigate = useNavigate();

  const featureLabels: Record<string, string> = {
    diet: 'dietas',
    substitution: 'substituições',
    adjustment: 'ajustes',
    chat: 'mensagens de chat',
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">
            Limite de {featureLabels[feature] || feature} atingido
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-3">
            <p>
              Você atingiu o limite de <strong>{limit}</strong>{' '}
              {featureLabels[feature] || feature} do plano{' '}
              <strong>{currentPlan}</strong>.
            </p>
            <p>
              Faça upgrade para continuar usando e desbloquear recursos
              premium!
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 my-4 space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Benefícios do upgrade:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <ArrowRight className="w-3 h-3" />
              Mais {featureLabels[feature] || feature} por mês
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="w-3 h-3" />
              Chat com nutricionista IA
            </li>
            <li className="flex items-center gap-2">
              <ArrowRight className="w-3 h-3" />
              Histórico estendido
            </li>
          </ul>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpgrade}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90"
          >
            <Crown className="w-4 h-4 mr-2" />
            Ver planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
