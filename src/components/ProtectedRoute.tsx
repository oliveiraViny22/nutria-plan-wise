import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
  allowedRoles?: ('admin' | 'professional' | 'student')[];
}

// Routes that students created by professionals can access (read-only)
const STUDENT_ALLOWED_ROUTES = [
  '/dashboard',
  '/meal',
  '/progress',
  '/profile',
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
  const { user, profile, loading } = useAuth();
  const { isStudent, isProfessional, isAdmin, loading: roleLoading } = useUserRole();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
