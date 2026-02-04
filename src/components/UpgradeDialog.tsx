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
import { Crown, Zap, Check, X, Infinity, Sparkles } from 'lucide-react';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentPlan?: string;
  limit?: number;
}

const PLAN_COMPARISON = [
  {
    feature: 'Geração de Dietas',
    free: '1/mês',
    paid: 'Ilimitado',
    highlight: true,
  },
  {
    feature: 'Substituições',
    free: '3/mês',
    paid: 'Ilimitado',
    highlight: true,
  },
  {
    feature: 'Otimizações com IA',
    free: '1/mês',
    paid: 'Ilimitado',
    highlight: true,
  },
  {
    feature: 'Chat Nutricional',
    free: '3 msg/dia',
    paid: 'Ilimitado',
    highlight: false,
  },
  {
    feature: 'Opções por Refeição',
    free: '1',
    paid: '3',
    highlight: false,
  },
  {
    feature: 'Suplementação',
    free: false,
    paid: true,
    highlight: true,
  },
  {
    feature: 'Gamificação & Streak',
    free: false,
    paid: true,
    highlight: false,
  },
  {
    feature: 'Histórico de Adesão',
    free: false,
    paid: true,
    highlight: false,
  },
];

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
    objective: 'alteração de objetivo',
    supplement: 'suplementação',
    adherence: 'gamificação',
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/pricing');
  };

  const renderValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <X className="w-4 h-4 text-muted-foreground/50" />
      );
    }
    if (value === 'Ilimitado') {
      return (
        <span className="flex items-center gap-1 text-primary font-medium">
          <Infinity className="w-3.5 h-3.5" />
          {value}
        </span>
      );
    }
    return <span>{value}</span>;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/20">
            <Crown className="w-6 h-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">
            {limit > 0 
              ? `Limite de ${featureLabels[feature] || feature} atingido`
              : `Desbloqueie ${featureLabels[feature] || feature}`
            }
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {limit > 0 ? (
              <span>
                Você atingiu o limite de <strong>{limit}</strong>{' '}
                {featureLabels[feature] || feature} do plano{' '}
                <strong>{currentPlan}</strong>.
              </span>
            ) : (
              <span>
                Este recurso está disponível no plano pago.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Comparison Table */}
        <div className="border rounded-lg overflow-hidden my-4">
          <div className="grid grid-cols-3 text-xs font-medium bg-muted/50">
            <div className="p-2 border-b">Recurso</div>
            <div className="p-2 border-b border-l text-center">Gratuito</div>
            <div className="p-2 border-b border-l text-center bg-primary/5 text-primary">
              <span className="flex items-center justify-center gap-1">
                <Sparkles className="w-3 h-3" />
                Pro
              </span>
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {PLAN_COMPARISON.map((row, i) => (
              <div 
                key={row.feature}
                className={`grid grid-cols-3 text-xs ${
                  i < PLAN_COMPARISON.length - 1 ? 'border-b' : ''
                } ${row.highlight ? 'bg-primary/5' : ''}`}
              >
                <div className="p-2 flex items-center">
                  {row.feature}
                </div>
                <div className="p-2 border-l flex items-center justify-center text-muted-foreground">
                  {renderValue(row.free)}
                </div>
                <div className="p-2 border-l flex items-center justify-center">
                  {renderValue(row.paid)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-3 text-center border border-primary/20">
          <p className="text-sm font-medium text-foreground flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            A partir de R$ 29,90/mês
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Cancele quando quiser
          </p>
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpgrade}
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          >
            <Crown className="w-4 h-4 mr-2" />
            Ver planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
