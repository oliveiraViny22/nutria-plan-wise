import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ProfessionalStudent, ProfessionalLicense } from '@/lib/professional-types';
import { toast } from '@/hooks/use-toast';

interface StudentProfile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  goal: string | null;
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
  onboarding_completed: boolean | null;
}

interface StudentWithProfile extends ProfessionalStudent {
  profile: StudentProfile | null;
}

export function useProfessionalStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [license, setLicense] = useState<ProfessionalLicense | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(0);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch students linked to this professional
      const { data: studentsData, error: studentsError } = await supabase
        .from('professional_students')
        .select('*')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });

      if (studentsError) {
        throw studentsError;
      }

      // Fetch profiles for each student
      if (studentsData && studentsData.length > 0) {
        const studentIds = studentsData.map(s => s.student_id);
        
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, user_id, name, email, goal, daily_calories, protein_target, carbs_target, fat_target, onboarding_completed')
          .in('user_id', studentIds);

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        }

        const studentsWithProfiles: StudentWithProfile[] = studentsData.map(student => ({
          ...student,
          status: student.status as 'active' | 'inactive' | 'pending',
          profile: profilesData?.find(p => p.user_id === student.student_id) || null,
        }));

        setStudents(studentsWithProfiles);
        setStudentCount(studentsData.filter(s => s.status === 'active').length);
      } else {
        setStudents([]);
        setStudentCount(0);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os alunos.',
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchLicense = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('professional_licenses')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching license:', error);
    }

    setLicense(data as ProfessionalLicense | null);
  }, [user]);

  useEffect(() => {
    fetchStudents();
    fetchLicense();
  }, [fetchStudents, fetchLicense]);

  const addStudent = async (studentEmail: string) => {
    if (!user || !license) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você precisa de uma licença ativa para adicionar alunos.',
      });
      return false;
    }

    // Check license limits
    if (studentCount >= license.max_students) {
      toast({
        variant: 'destructive',
        title: 'Limite atingido',
        description: `Sua licença permite até ${license.max_students} alunos.`,
      });
      return false;
    }

    try {
      // Find user by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', studentEmail.toLowerCase())
        .single();

      if (profileError || !profileData) {
        toast({
          variant: 'destructive',
          title: 'Aluno não encontrado',
          description: 'Não encontramos um usuário com esse email. Ele precisa se cadastrar primeiro.',
        });
        return false;
      }

      // Check if already linked
      const { data: existingLink } = await supabase
        .from('professional_students')
        .select('id')
        .eq('professional_id', user.id)
        .eq('student_id', profileData.user_id)
        .single();

      if (existingLink) {
        toast({
          variant: 'destructive',
          title: 'Aluno já vinculado',
          description: 'Este aluno já está na sua lista.',
        });
        return false;
      }

      // Add student link
      const { error: insertError } = await supabase
        .from('professional_students')
        .insert({
          professional_id: user.id,
          student_id: profileData.user_id,
          status: 'active',
        });

      if (insertError) {
        throw insertError;
      }

      // Add student role to the user
      await supabase
        .from('user_roles')
        .upsert({
          user_id: profileData.user_id,
          role: 'student',
        }, { onConflict: 'user_id,role' });

      // Update student's profile with professional_id
      await supabase
        .from('profiles')
        .update({ professional_id: user.id })
        .eq('user_id', profileData.user_id);

      toast({
        title: 'Aluno adicionado',
        description: 'O aluno foi vinculado à sua conta com sucesso.',
      });

      await fetchStudents();
      return true;
    } catch (error) {
      console.error('Error adding student:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível adicionar o aluno.',
      });
      return false;
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('professional_students')
        .delete()
        .eq('professional_id', user.id)
        .eq('student_id', studentId);

      if (error) throw error;

      // Remove professional_id from student's profile
      await supabase
        .from('profiles')
        .update({ professional_id: null })
        .eq('user_id', studentId);

      toast({
        title: 'Aluno removido',
        description: 'O aluno foi desvinculado da sua conta.',
      });

      await fetchStudents();
      return true;
    } catch (error) {
      console.error('Error removing student:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível remover o aluno.',
      });
      return false;
    }
  };

  const updateStudentStatus = async (studentId: string, status: 'active' | 'inactive') => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('professional_students')
        .update({ status })
        .eq('professional_id', user.id)
        .eq('student_id', studentId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `O aluno foi marcado como ${status === 'active' ? 'ativo' : 'inativo'}.`,
      });

      await fetchStudents();
      return true;
    } catch (error) {
      console.error('Error updating student status:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o status do aluno.',
      });
      return false;
    }
  };

  const isLicenseActive = license ? new Date(license.expires_at) > new Date() : false;

  return {
    students,
    license,
    loading,
    studentCount,
    isLicenseActive,
    addStudent,
    removeStudent,
    updateStudentStatus,
    refresh: fetchStudents,
  };
}
