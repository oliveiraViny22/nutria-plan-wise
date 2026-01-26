import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook for professional students management
 * Uses professional_students table in v2 schema
 */
export interface StudentWithProfile {
  id: string;
  student_id: string;
  professional_id: string;
  status: 'active' | 'inactive' | 'pending';
  student_confirmed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profile: {
    name: string | null;
    email: string | null;
    goal: string | null;
    daily_calories: number | null;
  } | null;
}

export function useProfessionalStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState<StudentWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch professional's students
      const { data: studentRelations, error } = await supabase
        .from('professional_students')
        .select('*')
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for each student
      const studentsWithProfiles: StudentWithProfile[] = [];
      
      for (const relation of studentRelations || []) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email, goal, daily_calories')
          .eq('user_id', relation.student_id)
          .single();

        studentsWithProfiles.push({
          id: relation.id,
          student_id: relation.student_id,
          professional_id: relation.professional_id,
          status: relation.status as 'active' | 'inactive' | 'pending',
          student_confirmed: relation.student_confirmed ?? false,
          notes: relation.notes,
          created_at: relation.created_at,
          updated_at: relation.updated_at,
          profile: profile || null,
        });
      }

      setStudents(studentsWithProfiles);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast.error('Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const addStudent = async (studentEmail: string): Promise<boolean> => {
    if (!user) return false;

    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', studentEmail)
        .single();

      if (profileError || !profile) {
        toast.error('Aluno não encontrado com esse email');
        return false;
      }

      // Check if already linked
      const existingStudent = students.find(s => s.student_id === profile.user_id);
      if (existingStudent) {
        toast.error('Este aluno já está vinculado a você');
        return false;
      }

      // Add student
      const { error } = await supabase
        .from('professional_students')
        .insert({
          professional_id: user.id,
          student_id: profile.user_id,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Aluno adicionado com sucesso');
      await fetchStudents();
      return true;
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error('Erro ao adicionar aluno');
      return false;
    }
  };

  const removeStudent = async (relationId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('professional_students')
        .delete()
        .eq('id', relationId)
        .eq('professional_id', user.id);

      if (error) throw error;

      toast.success('Aluno removido com sucesso');
      await fetchStudents();
      return true;
    } catch (error) {
      console.error('Error removing student:', error);
      toast.error('Erro ao remover aluno');
      return false;
    }
  };

  const updateStudentStatus = async (
    relationId: string, 
    status: 'active' | 'inactive' | 'pending'
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('professional_students')
        .update({ status })
        .eq('id', relationId)
        .eq('professional_id', user.id);

      if (error) throw error;

      toast.success('Status atualizado com sucesso');
      await fetchStudents();
      return true;
    } catch (error) {
      console.error('Error updating student status:', error);
      toast.error('Erro ao atualizar status');
      return false;
    }
  };

  return {
    students,
    loading,
    studentCount: students.length,
    isLicenseActive: true, // Simplified - no license system in v2
    license: null,
    addStudent,
    removeStudent,
    updateStudentStatus,
    refresh: fetchStudents,
  };
}
