import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
}

interface FoodTemplate {
  headers: string[];
  exampleRow: string[];
  validCategories: string[];
  validProcessingLevels: string[];
  csvContent: string;
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
      return { valid: false, errors: [message], validRows: [] };
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
    fetchSettings,
    updateSetting,
    fetchFoodImports,
    validateFoodCSV,
    importFoods,
    fetchAuditLogs,
    getFoodTemplate,
    downloadTemplate,
    seedTestData,
  };
}
