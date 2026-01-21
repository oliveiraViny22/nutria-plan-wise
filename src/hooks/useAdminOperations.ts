import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import * as XLSX from 'xlsx';

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
}

export interface UserProfile {
  user_id: string;
  name: string | null;
  email: string | null;
  onboarding_completed: boolean | null;
  created_at: string | null;
  roles: string[];
  subscription_status?: string;
  plan_name?: string;
}

export interface UserUsage {
  user_id: string;
  diets_used: number;
  substitutions_used: number;
  adjustments_used: number;
  chat_messages_today: number;
  period_start: string;
  period_end: string;
  last_chat_reset: string;
}

export interface Plan {
  id: string;
  name: string;
  type: 'gratuito' | 'plano_pessoal_pago' | 'profissional';
  description: string | null;
  is_active: boolean;
  price_monthly: number | null;
  stripe_price_monthly: string | null;
  stripe_product_id: string | null;
  diet_limit: number;
  substitution_limit: number;
  adjustment_limit: number;
  has_chat: boolean;
  chat_messages_per_day: number;
  meal_options_limit: number;
}

export interface AISettings {
  enabled: boolean;
  modelDefault: string;
}

export interface DeleteUserPreview {
  user: {
    name: string | null;
    email: string | null;
    created_at: string;
  };
  records: Record<string, number>;
  totalRecords: number;
}

export interface Food {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  serving_size: string | null;
  category: string | null;
  processing_level: string | null;
  unit_name: string | null;
  unit_weight_grams: number | null;
  unit_increment: number | null;
  unit_enabled: boolean;
  created_at: string;
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
  
  // Foods state
  const [foods, setFoods] = useState<Food[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [foodsTotal, setFoodsTotal] = useState(0);
  
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
      const { data, error } = await supabase.functions.invoke('admin-operations', {
        body: { action: 'get_settings', category }
      });
      
      if (error) {
        throw new Error(error.message || 'Erro ao carregar configurações');
      }
      
      console.log('[Admin] fetchSettings response:', data);
      setSettings(data?.settings || []);
      return data?.settings || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar configurações';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return [];
    } finally {
      setSettingsLoading(false);
    }
  }, [toast]);

  const updateSetting = useCallback(async (key: string, value: unknown) => {
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
      
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value, updated_at: new Date().toISOString() } : s));
      
      setSavedKeys(prev => new Set(prev).add(key));
      
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
      const importRecord = await invokeAdmin('create_import_record', { 
        filename, 
        totalRows: foods.length 
      });

      const result = await invokeAdmin('import_foods', { 
        importId: importRecord.import.id, 
        foods 
      });

      toast({ 
        title: 'Importação concluída', 
        description: `${result.imported} alimentos importados, ${result.failed} falharam.` 
      });

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

    // Criar planilha Excel
    const wb = XLSX.utils.book_new();
    const wsData = [
      template.headers,
      template.exampleRow,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Ajustar larguras das colunas
    ws['!cols'] = template.headers.map(() => ({ wch: 20 }));
    
    XLSX.utils.book_append_sheet(wb, ws, 'Alimentos');
    
    // Baixar arquivo
    XLSX.writeFile(wb, 'modelo_alimentos.xlsx');
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
    search?: string
  ) => {
    setUsersLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('user_id, name, email, onboarding_completed, created_at', { count: 'exact' })
        .neq('email', 'admin@nutriai.app')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: profiles, error: profilesError, count } = await query;

      if (profilesError) throw profilesError;

      const userIds = profiles?.map(p => p.user_id) || [];
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('user_id, status, plan_id, plans(name)')
        .in('user_id', userIds);

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
    updates: Partial<Pick<UserProfile, 'name'>>
  ) => {
    setSavingKeys(prev => new Set(prev).add(`user_${userId}`));
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', userId);

      if (error) throw error;

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

  const toggleUserRole = useCallback(async (userId: string, role: AppRole, add: boolean) => {
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
      const message = error instanceof Error ? error.message : 'Erro ao alterar papel';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(`role_${userId}_${role}`));
      setTimeout(() => {
        setErrorKeys(prev => {
          const next = new Set(prev);
          next.delete(`role_${userId}_${role}`);
          return next;
        });
      }, 3000);
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`role_${userId}_${role}`);
        return next;
      });
    }
  }, [toast]);

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await invokeAdmin('delete_user', { userId });
      
      setUsers(prev => prev.filter(u => u.user_id !== userId));
      setUsersTotal(prev => prev - 1);
      
      toast({ 
        title: 'Usuário excluído', 
        description: `${result.deletedRecords} registros removidos.` 
      });
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir usuário';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  }, [invokeAdmin, toast]);

  const previewDeleteUser = useCallback(async (userId: string): Promise<DeleteUserPreview | null> => {
    try {
      const data = await invokeAdmin('preview_delete_user', { userId });
      return data as DeleteUserPreview;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao verificar usuário';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    }
  }, [invokeAdmin, toast]);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

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

  const updatePlan = useCallback(async (
    planId: string,
    updates: Partial<Pick<Plan, 'diet_limit' | 'substitution_limit' | 'adjustment_limit' | 'chat_messages_per_day' | 'has_chat' | 'is_active' | 'price_monthly' | 'meal_options_limit'>>
  ) => {
    setSavingKeys(prev => new Set(prev).add(`plan_${planId}`));
    try {
      const data = await invokeAdmin('update_plan', { planId, updates });
      
      setPlans(prev => prev.map(p => 
        p.id === planId ? { ...p, ...updates } : p
      ));

      setSavedKeys(prev => new Set(prev).add(`plan_${planId}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`plan_${planId}`);
          return next;
        });
      }, 2000);
      
      toast({ title: 'Plano atualizado' });
      return data.plan;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar plano';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(`plan_${planId}`));
      setTimeout(() => {
        setErrorKeys(prev => {
          const next = new Set(prev);
          next.delete(`plan_${planId}`);
          return next;
        });
      }, 3000);
      throw error;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`plan_${planId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  const getUserUsage = useCallback(async (targetUserId: string): Promise<UserUsage | null> => {
    try {
      const data = await invokeAdmin('get_user_usage', { userId: targetUserId });
      return data.usage as UserUsage;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar uso';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    }
  }, [invokeAdmin, toast]);

  const updateUserUsage = useCallback(async (
    targetUserId: string,
    updates: Partial<Pick<UserUsage, 'diets_used' | 'substitutions_used' | 'adjustments_used' | 'chat_messages_today'>>
  ): Promise<boolean> => {
    setSavingKeys(prev => new Set(prev).add(`usage_${targetUserId}`));
    try {
      await invokeAdmin('update_user_usage', { targetUserId, updates });
      
      setSavedKeys(prev => new Set(prev).add(`usage_${targetUserId}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`usage_${targetUserId}`);
          return next;
        });
      }, 2000);
      
      toast({ title: 'Cotas atualizadas' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar cotas';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(`usage_${targetUserId}`));
      setTimeout(() => {
        setErrorKeys(prev => {
          const next = new Set(prev);
          next.delete(`usage_${targetUserId}`);
          return next;
        });
      }, 3000);
      return false;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`usage_${targetUserId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  // Foods management
  const fetchFoods = useCallback(async (search: string = '', page: number = 0, pageSize: number = 20) => {
    setFoodsLoading(true);
    try {
      let query = supabase
        .from('foods')
        .select('*', { count: 'exact' });
      
      if (search.trim()) {
        query = query.ilike('name', `%${search.trim()}%`);
      }
      
      const { data, count, error } = await query
        .order('name', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw error;
      
      setFoods(data as Food[]);
      setFoodsTotal(count || 0);
      return { foods: data as Food[], total: count || 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar alimentos';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return { foods: [], total: 0 };
    } finally {
      setFoodsLoading(false);
    }
  }, [toast]);

  const updateFood = useCallback(async (foodId: string, updates: Partial<Food>): Promise<boolean> => {
    setSavingKeys(prev => new Set(prev).add(`food_${foodId}`));
    try {
      await invokeAdmin('update_food', { foodId, updates });
      
      setFoods(prev => prev.map(f => f.id === foodId ? { ...f, ...updates } : f));
      
      setSavedKeys(prev => new Set(prev).add(`food_${foodId}`));
      setTimeout(() => {
        setSavedKeys(prev => {
          const next = new Set(prev);
          next.delete(`food_${foodId}`);
          return next;
        });
      }, 2000);
      
      toast({ title: 'Alimento atualizado' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar alimento';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      setErrorKeys(prev => new Set(prev).add(`food_${foodId}`));
      setTimeout(() => {
        setErrorKeys(prev => {
          const next = new Set(prev);
          next.delete(`food_${foodId}`);
          return next;
        });
      }, 3000);
      return false;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`food_${foodId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  const deleteFood = useCallback(async (foodId: string): Promise<boolean> => {
    setSavingKeys(prev => new Set(prev).add(`food_${foodId}`));
    try {
      await invokeAdmin('delete_food', { foodId });
      
      setFoods(prev => prev.filter(f => f.id !== foodId));
      setFoodsTotal(prev => prev - 1);
      
      toast({ title: 'Alimento excluído' });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir alimento';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return false;
    } finally {
      setSavingKeys(prev => {
        const next = new Set(prev);
        next.delete(`food_${foodId}`);
        return next;
      });
    }
  }, [invokeAdmin, toast]);

  const normalizeFoodNames = useCallback(async (): Promise<{ normalized: number; total: number } | null> => {
    setLoading(true);
    try {
      const data = await invokeAdmin('normalize_food_names');
      toast({ title: 'Nomes normalizados', description: `${data.normalized} de ${data.total} alimentos atualizados` });
      return data as { normalized: number; total: number };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao normalizar nomes';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
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
    foods,
    foodsLoading,
    foodsTotal,
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
    deleteUser,
    previewDeleteUser,
    fetchPlans,
    updatePlan,
    getUserUsage,
    updateUserUsage,
    fetchFoods,
    updateFood,
    deleteFood,
    normalizeFoodNames,
  };
}
