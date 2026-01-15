export type LicenseType = 'monthly' | 'annual';

export interface ProfessionalLicense {
  id: string;
  user_id: string;
  license_type: LicenseType;
  starts_at: string;
  expires_at: string;
  max_students: number;
  created_at: string;
  updated_at: string;
}

export interface ProfessionalStudent {
  id: string;
  professional_id: string;
  student_id: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
  // Joined data
  student_profile?: {
    name: string | null;
    email: string | null;
    goal: string | null;
    daily_calories: number | null;
  };
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'professional' | 'student';
  created_at: string;
}

export interface StudentWithProfile extends ProfessionalStudent {
  profile: {
    id: string;
    name: string | null;
    email: string | null;
    goal: string | null;
    daily_calories: number | null;
    protein_target: number | null;
    carbs_target: number | null;
    fat_target: number | null;
    onboarding_completed: boolean;
  } | null;
}
