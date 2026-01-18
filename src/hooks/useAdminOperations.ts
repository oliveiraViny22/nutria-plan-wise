import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AccountType = Database['public']['Enums']['account_type'];
type UserType = Database['public']['Enums']['user_type'];
type AppRole = Database['public']['Enums']['app_role'];

interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  category: string;
  description: string | null;
  is_sensitive: boolean;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

interface FoodImport {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  errors: string[];
  imported_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface FoodRow {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size?: string;
  category?: string;
  processing_level?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  validRows: FoodRow[];
  warnings?: string[];
}

interface FoodTemplate {
  headers: string[];
  exampleRow: string[];
  validCategories: string[];
  validProcessingLevels: string[];
  csvContent: string;
}

export interface UserProfile {
  user_id: string;
  name: string | null;
  email: string | null;
  account_type: AccountType;
  user_type: UserType | null;
  is_test: boolean | null;
  onboarding_completed: boolean | null;
  professional_id: string | null;
  created_at: string | null;
  roles: string[];
  subscription_status?: string;
  plan_name?: string;
}

interface UserProfileUpdate {
  name?: string | null;
  account_type?: AccountType;
  user_type?: UserType | null;
  is_test?: boolean | null;
}

export interface Plan {
  id: string;
  name: string;
  type: 'personal' | 'professional';
  description: string | null;
  is_active: boolean;
  price_monthly: number | null;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_annual: number | null;
  stripe_price_monthly: string | null;
  stripe_price_quarterly: string | null;
  stripe_price_semiannual: string | null;
  stripe_price_annual: string | null;
  stripe_product_id: string | null;
  diet_limit: number;
  substitution_limit: number;
  adjustment_limit: number;
  patients_limit: number;
  history_days: number;
  has_chat: boolean;
  chat_messages_per_day: number;
}

export interface DeleteUserPreview {
  user: {
    name: string | null;
    email: string | null;
    account_type: string;
    user_type: string | null;
    professional_id: string | null;
    created_at: string;
  };
  records: Record<string, number>;
  totalRecords: number;
}

export function useAdminOperations() {
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [foodImports, setFoodImports] = useState<FoodImport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const { toast } = useToast();

  const invokeAdmin = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action, ...params }
    });

    if (error) {
      throw new Error(error.message || 'Erro na operação administrativa');
    }

    return data;
  }, []);

  const fetchSettings = useCallback(async (category?: string) => {
    setSettingsLoading(true);
    try {
      const data = await invokeAdmin('get_settings', { category });
      setSettings(data.settings || []);
      return data.settings;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar configurações';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return [];
    } finally {
      setSettingsLoading(false);
    }
  }, [invokeAdmin, toast]);

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    // Add to saving state
    setSavingKeys(prev => new Set(prev).add(key));
    setSavedKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setErrorKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    try {
      const data = await invokeAdmin('update_setting', { key, value });
      
      // Update local state
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value, updated_at: new Date().toISOString() } : s));
      
      // Mark as saved
      setSavedKeys(prev => new Set(prev).add(key));
      
      // Clear saved indicator after 2 seconds
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
      
      return data.setting;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar configuração';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(key));
      
      // Clear error indicator after 3 seconds
      setTimeout(() => {
        setErrorKeys(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 3000);
      
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  const fetchFoodImports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAdmin('get_food_imports');
      setFoodImports(data.imports || []);
      return data.imports;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar importações';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return [];
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin, toast]);

  const validateFoodCSV = useCallback(async (rows: Record<string, unknown>[]): Promise<ValidationResult> => {
    try {
      const data = await invokeAdmin('validate_food_csv', { rows });
      return data as ValidationResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao validar arquivo';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return { valid: false, errors: [message], validRows: [], warnings: [] };
    }
  }, [invokeAdmin, toast]);

  const importFoods = useCallback(async (filename: string, foods: FoodRow[]) => {
    setLoading(true);
    try {
      // Create import record first
      const importRecord = await invokeAdmin('create_import_record', { 
        filename, 
        totalRows: foods.length 
      });

      // Then import foods
      const result = await invokeAdmin('import_foods', { 
        importId: importRecord.import.id, 
        foods 
      });

      toast({ 
        title: 'Importação concluída', 
        description: `${result.imported} alimentos importados, ${result.failed} falharam.` 
      });

      // Refresh imports list
      await fetchFoodImports();

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro na importação';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin, toast, fetchFoodImports]);

  const fetchAuditLogs = useCallback(async (limit = 50, offset = 0) => {
    setLoading(true);
    try {
      const data = await invokeAdmin('get_audit_logs', { limit, offset });
      setAuditLogs(data.logs || []);
      setAuditTotal(data.total || 0);
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar logs';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return { logs: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin, toast]);

  const getFoodTemplate = useCallback(async (): Promise<FoodTemplate | null> => {
    try {
      const data = await invokeAdmin('get_food_template');
      return data as FoodTemplate;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao obter template';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    }
  }, [invokeAdmin, toast]);

  const downloadTemplate = useCallback(async () => {
    const template = await getFoodTemplate();
    if (!template) return;

    const blob = new Blob([template.csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_alimentos.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }, [getFoodTemplate]);

  const seedTestData = useCallback(async (): Promise<Record<string, unknown>> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-test-data');
      
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      
      return data.results || {};
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar dados de teste';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersTotal, setUsersTotal] = useState(0);

  const fetchUsers = useCallback(async (
    limit = 50, 
    offset = 0, 
    search?: string,
    filters?: { account_type?: AccountType; is_test?: boolean }
  ) => {
    setUsersLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('user_id, name, email, account_type, user_type, is_test, onboarding_completed, professional_id, created_at', { count: 'exact' })
        .neq('email', 'admin@nutriai.app') // Hide system admin account
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (filters?.account_type) {
        query = query.eq('account_type', filters.account_type);
      }
      if (filters?.is_test !== undefined) {
        query = query.eq('is_test', filters.is_test);
      }

      const { data: profiles, error: profilesError, count } = await query;

      if (profilesError) throw profilesError;

      // Fetch roles for each user
      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Fetch subscriptions
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('user_id, status, plan_id, plans(name)')
        .in('user_id', userIds);

      // Map profiles with roles and subscription
      const enrichedUsers: UserProfile[] = (profiles || []).map(profile => {
        const userRoles = rolesData?.filter(r => r.user_id === profile.user_id).map(r => r.role) || [];
        const userSub = subsData?.find(s => s.user_id === profile.user_id);
        return {
          ...profile,
          roles: userRoles,
          subscription_status: userSub?.status,
          plan_name: (userSub?.plans as { name: string } | null)?.name,
        };
      });

      setUsers(enrichedUsers);
      setUsersTotal(count || 0);
      return { users: enrichedUsers, total: count || 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar usuários';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return { users: [], total: 0 };
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  const updateUser = useCallback(async (
    userId: string, 
    updates: Partial<Pick<UserProfile, 'name' | 'account_type' | 'user_type' | 'is_test'>>
  ) => {
    setSavingKeys(prev => new Set(prev).add(`user_${userId}`));
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setUsers(prev => prev.map(u => 
        u.user_id === userId ? { ...u, ...updates } : u
      ));

      setSavedKeys(prev => new Set(prev).add(`user_${userId}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`user_${userId}`);
          return next;
        });
      }, 2000);
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar usuário';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(`user_${userId}`));
      setTimeout(() => {
        setErrorKeys(prev => {
          const next = new Set(prev);
          next.delete(`user_${userId}`);
          return next;
        });
      }, 3000);
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`user_${userId}`);
        return next;
      });
    }
  }, [toast]);

  const toggleUserRole = useCallback(async (userId: string, role: 'admin' | 'professional' | 'student', add: boolean) => {
    setSavingKeys(prev => new Set(prev).add(`role_${userId}_${role}`));
    try {
      if (add) {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);
        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.user_id !== userId) return u;
        const newRoles = add 
          ? [...u.roles, role] 
          : u.roles.filter(r => r !== role);
        return { ...u, roles: newRoles };
      }));

      setSavedKeys(prev => new Set(prev).add(`role_${userId}_${role}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`role_${userId}_${role}`);
          return next;
        });
      }, 2000);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar role';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`role_${userId}_${role}`);
        return next;
      });
    }
  }, [toast]);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const changeUserPassword = useCallback(async (targetUserId: string, newPassword: string) => {
    setSavingKeys(prev => new Set(prev).add(`password_${targetUserId}`));
    try {
      const data = await invokeAdmin('change_user_password', { targetUserId, newPassword });
      
      setSavedKeys(prev => new Set(prev).add(`password_${targetUserId}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`password_${targetUserId}`);
          return next;
        });
      }, 2000);
      
      toast({ title: 'Sucesso', description: 'Senha alterada com sucesso.' });
      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao alterar senha';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`password_${targetUserId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  const previewDeleteUser = useCallback(async (targetUserId: string): Promise<DeleteUserPreview> => {
    try {
      const data = await invokeAdmin('preview_delete_user', { targetUserId });
      return data as DeleteUserPreview;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar preview';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw error;
    }
  }, [invokeAdmin, toast]);

  const deleteUser = useCallback(async (targetUserId: string) => {
    setSavingKeys(prev => new Set(prev).add(`delete_${targetUserId}`));
    try {
      await invokeAdmin('delete_user', { targetUserId });
      
      // Remove from local state
      setUsers(prev => prev.filter(u => u.user_id !== targetUserId));
      setUsersTotal(prev => prev - 1);
      
      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso.' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir usuário';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`delete_${targetUserId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const data = await invokeAdmin('get_plans');
      setPlans(data.plans || []);
      return data.plans;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar planos';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return [];
    } finally {
      setPlansLoading(false);
    }
  }, [invokeAdmin, toast]);

  const updatePlan = useCallback(async (planId: string, updates: Partial<Plan>) => {
    setSavingKeys(prev => new Set(prev).add(`plan_${planId}`));
    try {
      const data = await invokeAdmin('update_plan', { planId, updates });
      
      // Update local state
      setPlans(prev => prev.map(p => p.id === planId ? { ...p, ...updates } : p));
      
      setSavedKeys(prev => new Set(prev).add(`plan_${planId}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`plan_${planId}`);
          return next;
        });
      }, 2000);
      
      toast({ title: 'Sucesso', description: 'Plano atualizado com sucesso.' });
      return data.plan;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar plano';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(`plan_${planId}`));
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`plan_${planId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  return {
    loading,
    settingsLoading,
    savingKeys,
    savedKeys,
    errorKeys,
    settings,
    foodImports,
    auditLogs,
    auditTotal,
    users,
    usersLoading,
    usersTotal,
    plans,
    plansLoading,
    fetchSettings,
    updateSetting,
    fetchFoodImports,
    validateFoodCSV,
    importFoods,
    fetchAuditLogs,
    getFoodTemplate,
    downloadTemplate,
    seedTestData,
    fetchUsers,
    updateUser,
    toggleUserRole,
    changeUserPassword,
    previewDeleteUser,
    deleteUser,
    fetchPlans,
    updatePlan,
  };
}
