import { Link } from 'react-router-dom';
import { Lock, Send, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useUserRole } from '@/hooks/useUserRole';

interface BlockedActionCTAProps {
  action: string;
  onRequestClick?: () => void;
}

export function BlockedActionCTA({ action, onRequestClick }: BlockedActionCTAProps) {
  const { user_type, is_linked_to_professional, can_send_requests } = useAccountPermissions();
  const { isProfessional, isAdmin } = useUserRole();
  
  // Admin e Profissional não veem CTAs de upgrade
  if (isAdmin || isProfessional) {
    return null;
  }
  
  // Aluno vinculado a profissional
  if (user_type === 'aluno' && is_linked_to_professional) {
    return (
      <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
        <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">
          Você não pode {action}. Seu plano é gerenciado pelo seu nutricionista.
        </p>
        {can_send_requests && onRequestClick && (
          <Button variant="outline" size="sm" onClick={onRequestClick}>
            <Send className="w-4 h-4 mr-2" />
            Enviar solicitação
          </Button>
        )}
      </div>
    );
  }
  
  // Usuário comum - mostra opção de upgrade
  return (
    <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
      <Crown className="w-8 h-8 text-primary mx-auto mb-2" />
      <p className="text-sm text-muted-foreground mb-3">
        Faça upgrade do seu plano para {action}.
      </p>
      <Link to="/pricing">
        <Button variant="hero" size="sm">
          Ver planos
        </Button>
      </Link>
    </div>
  );
}
