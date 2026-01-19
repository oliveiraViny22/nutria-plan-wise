/**
 * Hook for student access - simplified for v2 schema
 */
export interface StudentAccessLevel {
  hasAccess: boolean;
  accessLevel: 'full' | 'read_only' | 'suspended';
  isLinkedStudent: boolean;
  loading: boolean;
}

export function useStudentAccess(): StudentAccessLevel {
  return {
    hasAccess: true,
    accessLevel: 'full',
    isLinkedStudent: false,
    loading: false,
  };
}
