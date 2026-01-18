import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useStudentAccess } from '@/hooks/useStudentAccess';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PasswordChangeRequired } from '@/components/PasswordChangeRequired';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
  allowedRoles?: ('admin' | 'professional' | 'student')[];
}

// Routes that students can access during grace period (read-only)
const STUDENT_READ_ONLY_ROUTES = [
  '/dashboard',
  '/meal',
  '/progress',
  '/profile',
  '/daily-log', // Added for grace period access
];

// Routes that require full access (blocked during grace period)
const FULL_ACCESS_ROUTES = [
  '/chat',
];

// Routes that require professional role
const PROFESSIONAL_ONLY_ROUTES = [
  '/students',
  '/student',
  '/professional',
];

export function ProtectedRoute({ 
  children, 
  requireOnboarding = true,
  allowedRoles 
}: ProtectedRouteProps) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { isStudent, isProfessional, isAdmin, loading: roleLoading } = useUserRole();
  const { 
    hasAccess, 
    accessLevel, 
    isLinkedStudent, 
    loading: accessLoading 
  } = useStudentAccess();
  const location = useLocation();

  if (loading || roleLoading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if password change is required (admin first login)
  if (profile?.must_change_password) {
    return (
      <PasswordChangeRequired 
        onPasswordChanged={() => {
          refreshProfile();
        }} 
      />
    );
  }

  // Check role-based access if specified
  if (allowedRoles && allowedRoles.length > 0) {
    const hasAllowedRole = 
      (allowedRoles.includes('admin') && isAdmin) ||
      (allowedRoles.includes('professional') && isProfessional) ||
      (allowedRoles.includes('student') && isStudent);
    
    if (!hasAllowedRole) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Handle linked students with suspended access
  if (isLinkedStudent && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acesso Suspenso</AlertTitle>
          <AlertDescription>
            O acesso à sua conta está temporariamente suspenso devido a problemas 
            com a assinatura do seu profissional. Entre em contato com seu 
            nutricionista para mais informações.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle linked students in grace period
  if (isLinkedStudent && accessLevel === 'read_only') {
    const currentPath = location.pathname;
    
    // Block full access routes during grace period
    const isFullAccessRoute = FULL_ACCESS_ROUTES.some(route => 
      currentPath.startsWith(route)
    );
    
    if (isFullAccessRoute) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Alert className="max-w-md border-yellow-500 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-800">Acesso Limitado</AlertTitle>
            <AlertDescription className="text-yellow-700">
              Esta funcionalidade está temporariamente indisponível. 
              Você pode continuar visualizando seu plano alimentar e histórico.
              Entre em contato com seu nutricionista se precisar de assistência.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  // Students created by professionals have restricted access
  if (isStudent && profile?.professional_id) {
    const currentPath = location.pathname;
    
    // Check if student is trying to access professional-only routes
    const isProfessionalRoute = PROFESSIONAL_ONLY_ROUTES.some(route => 
      currentPath.startsWith(route)
    );
    
    if (isProfessionalRoute) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check if onboarding is required but not completed
  if (requireOnboarding && profile && !profile.onboarding_completed && location.pathname !== '/onboarding') {
    // Students created by professionals already have completed onboarding
    if (!(isStudent && profile.professional_id)) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
