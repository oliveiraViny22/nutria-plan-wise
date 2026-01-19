import { useState } from 'react';

/**
 * Hook for professional students management
 * Simplified for v2 schema - professional_students table doesn't exist
 */
export interface StudentWithProfile {
  id: string;
  student_id: string;
  professional_id: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  profile: {
    name: string | null;
    email: string | null;
  } | null;
}

export function useProfessionalStudents() {
  const [students] = useState<StudentWithProfile[]>([]);
  const [loading] = useState(false);

  return {
    students,
    license: null,
    loading,
    studentCount: 0,
    isLicenseActive: false,
    addStudent: async (_email: string) => false,
    removeStudent: async (_studentId: string) => false,
    updateStudentStatus: async (_studentId: string, _status: 'active' | 'inactive') => false,
    refresh: async () => {},
  };
}
