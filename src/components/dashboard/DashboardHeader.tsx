import { Link } from 'react-router-dom';
import {
  MessageCircle,
  LogOut,
  User,
  TrendingUp,
  Users,
  CreditCard,
  LayoutDashboard,
  Shield,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FreePlanBadge } from '@/components/FeatureBadge';

interface DashboardHeaderProps {
  isAdmin: boolean;
  isProfessional: boolean;
  isLinkedStudent: boolean;
  isSubscribed: boolean;
  accountType?: string;
  planType?: string;
  onSignOut: () => void;
}

export function DashboardHeader({
  isAdmin,
  isProfessional,
  isLinkedStudent,
  isSubscribed,
  accountType,
  planType,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass border-b border-border/30">
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <MobileNav />
          <Logo />
          {isAdmin && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 gradient-primary text-primary-foreground text-xs font-medium rounded-full shadow-sm">
              <Shield className="w-3 h-3" />
              Admin
            </span>
          )}
          {!isAdmin && (!planType || planType === 'gratuito') && (
            <FreePlanBadge label="Plano Gratuito" className="hidden sm:inline-flex" />
          )}
        </div>
        
        <TooltipProvider delayDuration={300}>
          <div className="hidden md:flex items-center gap-1">
            {isAdmin ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link to="/admin">
                    <Button variant="ghost" size="icon" className="w-10 h-10">
                      <Shield className="w-5 h-5 text-primary" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Painel Admin</TooltipContent>
              </Tooltip>
            ) : (
              <>
                {(isSubscribed && accountType === 'professional') || isProfessional ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to="/professional">
                          <Button variant="ghost" size="icon" className="w-10 h-10 relative">
                            <LayoutDashboard className="w-5 h-5" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Painel Profissional</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link to="/students">
                          <Button variant="ghost" size="icon" className="w-10 h-10">
                            <Users className="w-5 h-5" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Gerenciar Alunos</TooltipContent>
                    </Tooltip>
                </>
                ) : null}
                
                {/* Registro Diário - only for paid users (treat undefined as gratuito) */}
                {planType && planType !== 'gratuito' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/daily-log">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <ClipboardCheck className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Registro Diário</TooltipContent>
                  </Tooltip>
                )}
                
                {!isProfessional && !isLinkedStudent && planType && planType !== 'gratuito' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/subscription">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <CreditCard className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Assinatura</TooltipContent>
                  </Tooltip>
                )}
                
                {/* Progress - only for paid users */}
                {planType && planType !== 'gratuito' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/progress">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <TrendingUp className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Progresso</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/profile">
                      <Button variant="ghost" size="icon" className="w-10 h-10">
                        <User className="w-5 h-5" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Meu Perfil</TooltipContent>
                </Tooltip>
                {planType && planType !== 'gratuito' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link to="/chat">
                        <Button variant="ghost" size="icon" className="w-10 h-10">
                          <MessageCircle className="w-5 h-5" />
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Chat IA</TooltipContent>
                  </Tooltip>
                )}
              </>
            )}
            <ThemeToggle />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-10 h-10" onClick={onSignOut}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </header>
  );
}
