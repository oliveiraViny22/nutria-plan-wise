import { MessageCircle, Sparkles, Infinity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { PLAN_DISPLAY_NAMES } from '@/lib/subscription-types';
import { CommercialPlan } from '@/lib/types';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserRole } from '@/hooks/useUserRole';

// Limite especial que indica acesso ilimitado (retornado pelo banco para admins)
const UNLIMITED_LIMIT = 999999;

interface ChatUsageIndicatorProps {
  currentUsage: number;
  maxLimit: number;
  planName: string;
  compact?: boolean;
}

const PLAN_PRICES: Record<string, string> = {
  gratuito: 'R$0,00',
  premium: 'R$4,90/mês',
  plano_pessoal_pago: 'R$14,90/mês',
  profissional: 'R$99,00/mês',
};

export function ChatUsageIndicator({ 
  currentUsage, 
  maxLimit, 
  planName,
  compact = false 
}: ChatUsageIndicatorProps) {
  const navigate = useNavigate();
  const { isLinkedToProfessional } = useSubscription();
  const { isProfessional, isAdmin } = useUserRole();
  
  // Check if user has unlimited access
  const isUnlimited = isAdmin || maxLimit >= UNLIMITED_LIMIT;
  
  const remaining = isUnlimited ? UNLIMITED_LIMIT : Math.max(0, maxLimit - currentUsage);
  const percentage = isUnlimited ? 0 : (maxLimit > 0 ? (currentUsage / maxLimit) * 100 : 0);
  const isLimitReached = !isUnlimited && remaining <= 0;
  const isLow = !isUnlimited && remaining > 0 && remaining <= 3;

  const displayName = isAdmin ? 'Administrador' : (PLAN_DISPLAY_NAMES[planName as CommercialPlan] || planName);
  const price = isAdmin ? '' : (PLAN_PRICES[planName] || '');
  
  // Profissionais, admins e alunos vinculados não veem opção de upgrade
  const showUpgradeButton = !isProfessional && !isLinkedToProfessional && !isAdmin;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MessageCircle className="w-3 h-3" />
        {isUnlimited ? (
          <span className="flex items-center gap-1 text-primary">
            <Infinity className="w-3 h-3" />
            Ilimitado
          </span>
        ) : (
          <span className={isLimitReached ? 'text-destructive' : isLow ? 'text-warning' : ''}>
            {remaining}/{maxLimit} mensagens restantes
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Plano {displayName}
          </span>
          {price && (
            <span className="text-xs text-muted-foreground">
              ({price})
            </span>
          )}
        </div>
        {isUnlimited ? (
          <span className="flex items-center gap-1 text-sm text-primary font-medium">
            <Infinity className="w-4 h-4" />
            Ilimitado
          </span>
        ) : (
          <span className={`text-sm ${isLimitReached ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {remaining}/{maxLimit}
          </span>
        )}
      </div>
      
      {!isUnlimited && (
        <Progress 
          value={percentage} 
          className={`h-2 ${isLimitReached ? '[&>div]:bg-destructive' : isLow ? '[&>div]:bg-warning' : ''}`}
        />
      )}
      
      <p className="text-xs text-muted-foreground">
        {isUnlimited 
          ? 'Acesso ilimitado às mensagens'
          : isLimitReached 
            ? 'Limite diário atingido' 
            : `${remaining} mensagens restantes hoje`}
      </p>
      
      {showUpgradeButton && (isLimitReached || planName === 'gratuito') && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-2"
          onClick={() => navigate('/pricing')}
        >
          {isLimitReached ? 'Fazer Upgrade' : 'Ver Planos'}
        </Button>
      )}
    </div>
  );
}
