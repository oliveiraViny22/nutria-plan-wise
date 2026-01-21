import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
  allowedRoles?: ('admin' | 'professional' | 'student')[];
}

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

  // Check if user is trying to access professional-only routes
  const currentPath = location.pathname;
  const isProfessionalRoute = PROFESSIONAL_ONLY_ROUTES.some(route => 
    currentPath.startsWith(route)
  );
  
  if (isProfessionalRoute && !isProfessional && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Admins skip onboarding entirely
  if (isAdmin && location.pathname === '/onboarding') {
    return <Navigate to="/admin" replace />;
  }

  // Check if onboarding is required but not completed (skip for admins)
  if (requireOnboarding && profile && !profile.onboarding_completed && !isAdmin && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
