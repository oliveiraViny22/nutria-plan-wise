import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  User,
  TrendingUp,
  MessageCircle,
  CreditCard,
  Crown,
  Users,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  ClipboardCheck,
  Shield,
  Moon,
  Sun,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { useAccountPermissions } from '@/hooks/useAccountPermissions';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FreePlanBadge } from '@/components/PremiumBadge';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  show?: boolean;
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isProfessional, isAdmin, loading: roleLoading } = useUserRole();
  const { accountType, isSubscribed } = useSubscription();
  const permissions = useAccountPermissions();
  const isPaidUser = permissions.plan_name.toLowerCase() !== 'gratuito';

  const showProfessionalLinks = 
    (isSubscribed && accountType === 'professional') || 
    isProfessional;

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login');
  };

  // Admin vê apenas opções administrativas
  const adminNavItems: NavItem[] = [
    {
      label: 'Painel Admin',
      href: '/admin',
      icon: <Shield className="h-5 w-5" />,
      show: true,
    },
  ];

  // Itens de navegação padrão
  const standardNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <Home className="h-5 w-5" />,
      show: true,
    },
    {
      label: 'Registro Diário',
      href: '/daily-log',
      icon: <ClipboardCheck className="h-5 w-5" />,
      show: isPaidUser,
    },
    {
      label: 'Painel Profissional',
      href: '/professional',
      icon: <LayoutDashboard className="h-5 w-5" />,
      show: showProfessionalLinks,
    },
    {
      label: 'Gerenciar Alunos',
      href: '/students',
      icon: <Users className="h-5 w-5" />,
      show: showProfessionalLinks,
    },
    {
      label: 'Progresso',
      href: '/progress',
      icon: <TrendingUp className="h-5 w-5" />,
      show: true,
    },
    {
      label: 'Meu Perfil',
      href: '/profile',
      icon: <User className="h-5 w-5" />,
      show: true,
    },
    {
      label: 'Chat IA',
      href: '/chat',
      icon: <MessageCircle className="h-5 w-5" />,
      show: true,
    },
    {
      label: 'Assinatura',
      href: '/subscription',
      icon: <CreditCard className="h-5 w-5" />,
      show: !isProfessional && isPaidUser, // Gratuito já tem badge clicável para preços
    },
  ];

  // Escolhe os itens de navegação baseado no papel
  const navItems = isAdmin ? adminNavItems : standardNavItems;

  const isActive = (href: string) => location.pathname === href;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden h-9 w-9 relative"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Logo size="sm" />
              {isAdmin ? (
                <Badge variant="outline" className="gap-1 bg-primary/10 text-primary border-primary/20">
                  <Shield className="w-3 h-3" />
                  Admin
                </Badge>
              ) : !isPaidUser && (
                <FreePlanBadge 
                  size="sm"
                  onClick={() => setOpen(false)}
                />
              )}
            </div>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </SheetClose>
          </SheetTitle>
        </SheetHeader>
        
        <nav className="flex flex-col py-4">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors",
                  "hover:bg-muted/50",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </Link>
            ))}
          
          <div className="border-t mt-4 pt-4 space-y-1">
            <ThemeToggleItem />
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full touch-manipulation"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function ThemeToggleItem() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full touch-manipulation"
    >
      {theme === 'dark' ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
      <span className="flex-1 text-left">{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
      <ChevronRight className="h-4 w-4 opacity-50" />
    </button>
  );
}
