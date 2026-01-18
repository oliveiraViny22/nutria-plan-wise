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
import { Logo } from '@/components/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

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
  const { isProfessional, hasActiveLicense } = useUserRole();
  const { accountType, isSubscribed } = useSubscription();

  const showProfessionalLinks = 
    (isSubscribed && accountType === 'professional') || 
    (isProfessional && hasActiveLicense);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login');
  };

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <Home className="h-5 w-5" />,
      show: true,
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
      label: 'Seja Profissional',
      href: '/become-professional',
      icon: <Crown className="h-5 w-5" />,
      show: !showProfessionalLinks,
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
      show: true,
    },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden h-9 w-9"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center justify-between">
            <Logo size="sm" />
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
          
          <div className="border-t mt-4 pt-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
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
