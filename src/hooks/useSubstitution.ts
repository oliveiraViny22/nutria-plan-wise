// =====================================================
// HOOK DE SUBSTITUIÇÃO INTELIGENTE
// =====================================================
// Wrapper React para o serviço de substituição canônico
// Gerencia estado, validação e integração com UI
// =====================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAccountPermissions } from './useAccountPermissions';
import { toast } from 'sonner';
import { Food } from '@/lib/types';
import {
  substituteItem,
  createSubstituteProposal,
  canBeSubstituted,
  formatProposalMessage,
  getImpactLevel,
  needsRebalance,
  SubstituteProposal,
  SubstituteCandidate,
  SubstituteError,
  GovernanceContext,
} from '@/lib/substitution-service';

export interface UseSubstitutionOptions {
  onSuccess?: (proposal: SubstituteProposal) => void;
  onError?: (error: SubstituteError) => void;
}

export interface UseSubstitutionReturn {
  // Estado
  isLoading: boolean;
  isConfirming: boolean;
  proposal: SubstituteProposal | null;
  candidates: SubstituteCandidate[];
  error: SubstituteError | null;
  showAll: boolean;
  includeProteinGroup: boolean;
  
  // Ações
  findCandidates: (sourceFood: Food, sourceGrams: number, availableFoods: Food[], excludeFoodIds?: string[]) => void;
  selectCandidate: (candidateId: string) => void;
  confirmSubstitution: (mealOptionFoodId: string, optionId: string) => Promise<boolean>;
  reset: () => void;
  setShowAll: (showAll: boolean) => void;
  setIncludeProteinGroup: (value: boolean) => void;
  
  // Helpers
  canSubstitute: (food: Food) => boolean;
  getProposalMessage: () => string | null;
  getImpact: () => 'low' | 'medium' | 'high' | null;
  requiresRebalance: () => boolean;
  isProteinCategory: (food: Food) => boolean;
}

const ERROR_MESSAGES: Record<SubstituteError, string> = {
  PLAN_LOCKED: 'Este plano está bloqueado e não pode ser modificado.',
  ITEM_NOT_FOUND: 'Item não encontrado na refeição.',
  INVALID_CATEGORY: 'Categoria do alimento não é válida para substituição.',
  INVALID_PROCESSING_LEVEL: 'Este alimento é processado e não pode ser substituído automaticamente.',
  SUPPLEMENT_NOT_SUBSTITUTABLE: 'Suplementos não podem ser substituídos automaticamente.',
  NO_PERMISSION: 'Você não tem permissão para fazer substituições.',
  NO_CANDIDATES: 'Nenhum alimento disponível para substituição nesta categoria.',
  INVALID_PORTION: 'Porção calculada está fora do limite permitido.',
};

export function useSubstitution(options?: UseSubstitutionOptions): UseSubstitutionReturn {
  const { can_substitute } = useAccountPermissions();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [proposal, setProposal] = useState<SubstituteProposal | null>(null);
  const [candidates, setCandidates] = useState<SubstituteCandidate[]>([]);
  const [error, setError] = useState<SubstituteError | null>(null);
  const [sourceData, setSourceData] = useState<{ food: Food; grams: number; availableFoods: Food[]; excludeFoodIds?: string[] } | null>(null);
  const [showAll, setShowAllState] = useState(false);
  const [includeProteinGroup, setIncludeProteinGroupState] = useState(false);

  /**
   * Busca candidatos para substituição
   * @param excludeFoodIds - IDs de alimentos já presentes na opção (para evitar duplicatas)
   */
  const findCandidates = useCallback((
    sourceFood: Food,
    sourceGrams: number,
    availableFoods: Food[],
    excludeFoodIds?: string[]
  ) => {
    setIsLoading(true);
    setError(null);
    setProposal(null);
    
    try {
      // Criar contexto de governança
      const governanceContext: GovernanceContext = {
        planStatus: 'active', // Assumir ativo - verificação real no confirm
        userHasPermission: can_substitute,
      };
      
      const result = substituteItem(
        sourceFood,
        sourceGrams,
        availableFoods,
        undefined, // targetFoodId - será selecionado pelo usuário
        governanceContext,
        excludeFoodIds 
          ? { excludeFoodIds, showAll, includeProteinGroup } 
          : { showAll, includeProteinGroup }
      );
      
      if (!result.success) {
        setError(result.error || 'NO_CANDIDATES');
        setCandidates([]);
        options?.onError?.(result.error || 'NO_CANDIDATES');
        return;
      }
      
      setCandidates(result.candidates || []);
      setSourceData({ food: sourceFood, grams: sourceGrams, availableFoods, excludeFoodIds });
      
      // NÃO definir proposta automaticamente - deixar o usuário escolher
      // A proposta só será criada quando o usuário selecionar um candidato
      setProposal(null);
    } catch (err) {
      console.error('Error finding candidates:', err);
      setError('NO_CANDIDATES');
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, [can_substitute, options, showAll, includeProteinGroup]);

  /**
   * Seleciona um candidato específico
   */
  const selectCandidate = useCallback((candidateId: string) => {
    if (!sourceData) return;
    
    const selectedCandidate = candidates.find(c => c.food.id === candidateId);
    if (!selectedCandidate) return;
    
    const newProposal = createSubstituteProposal(
      sourceData.food,
      sourceData.grams,
      selectedCandidate.food
    );
    
    setProposal(newProposal);
  }, [candidates, sourceData]);

  /**
   * Confirma e executa a substituição
   * Esta é a ÚNICA função que persiste dados
   * IMPORTANTE: Valida limite de uso no backend ANTES de persistir
   */
  const confirmSubstitution = useCallback(async (
    mealOptionFoodId: string,
    optionId: string
  ): Promise<boolean> => {
    if (!proposal) {
      toast.error('Nenhuma proposta de substituição selecionada.');
      return false;
    }
    
    setIsConfirming(true);
    
    try {
      const { to } = proposal;
      
      // 1. VALIDAR LIMITE NO BACKEND antes de persistir
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Sessão expirada. Faça login novamente.');
        return false;
      }
      
      const validateResponse = await supabase.functions.invoke('validate-usage', {
        body: { feature: 'substitution', increment: false },
      });
      
      if (validateResponse.error || !validateResponse.data?.allowed) {
        const errorMessage = validateResponse.data?.error || 'Limite de substituições atingido.';
        toast.error(errorMessage);
        return false;
      }
      
      // 2. Atualizar meal_option_food com novo alimento e quantidade
      const { error: updateError } = await supabase
        .from('meal_option_foods')
        .update({
          food_id: to.food.id,
          quantity_grams: to.portionGrams,
        })
        .eq('id', mealOptionFoodId);
      
      if (updateError) {
        throw updateError;
      }
      
      // 3. Recalcular totais da opção
      const { data: updatedOptionFoods, error: fetchError } = await supabase
        .from('meal_option_foods')
        .select(`*, food:foods(*)`)
        .eq('meal_option_id', optionId);
      
      if (fetchError) {
        throw fetchError;
      }
      
      // 4. Calcular novos totais
      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      
      if (updatedOptionFoods) {
        for (const mof of updatedOptionFoods) {
          const food = mof.food as Food;
          const baseGrams = parseServingSize(food.serving_size);
          const multiplier = mof.quantity_grams / baseGrams;
          
          totalCalories += Math.round(food.calories * multiplier);
          totalProtein += Math.round(food.protein * multiplier * 10) / 10;
          totalCarbs += Math.round(food.carbs * multiplier * 10) / 10;
          totalFat += Math.round(food.fat * multiplier * 10) / 10;
        }
      }
      
      // 5. Atualizar meal_option com novos totais
      const { error: optionError } = await supabase
        .from('meal_options')
        .update({
          total_calories: totalCalories,
          total_protein: totalProtein,
          total_carbs: totalCarbs,
          total_fat: totalFat,
        })
        .eq('id', optionId);
      
      if (optionError) {
        throw optionError;
      }
      
      // 6. Incrementar uso de substituição via backend (mais seguro)
      await supabase.functions.invoke('validate-usage', {
        body: { feature: 'substitution', increment: true },
      });
      
      toast.success('Alimento substituído com sucesso!');
      options?.onSuccess?.(proposal);
      
      return true;
    } catch (err: any) {
      console.error('Error confirming substitution:', err);
      
      if (err.code === '42501') {
        toast.error('Sem permissão para modificar esta refeição.');
      } else if (err.code === '23503') {
        toast.error('Alimento selecionado não está mais disponível.');
      } else {
        toast.error(`Erro ao substituir: ${err.message || 'Tente novamente'}`);
      }
      
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [proposal, options]);

  /**
   * Reseta estado do hook
   */
  const reset = useCallback(() => {
    setProposal(null);
    setCandidates([]);
    setError(null);
    setSourceData(null);
    setIsLoading(false);
    setIsConfirming(false);
    setShowAllState(false);
    setIncludeProteinGroupState(false);
  }, []);

  /**
   * Alterna modo "Ver todos" e re-busca candidatos
   */
  const setShowAll = useCallback((value: boolean) => {
    setShowAllState(value);
    
    // Re-buscar candidatos se temos dados de origem
    if (sourceData) {
      setIsLoading(true);
      setError(null);
      setProposal(null);
      
      try {
        const governanceContext: GovernanceContext = {
          planStatus: 'active',
          userHasPermission: can_substitute,
        };
        
        const result = substituteItem(
          sourceData.food,
          sourceData.grams,
          sourceData.availableFoods,
          undefined,
          governanceContext,
          { excludeFoodIds: sourceData.excludeFoodIds, showAll: value }
        );
        
        if (!result.success) {
          setError(result.error || 'NO_CANDIDATES');
          setCandidates([]);
          return;
        }
        
        setCandidates(result.candidates || []);
      } catch (err) {
        console.error('Error finding candidates:', err);
        setError('NO_CANDIDATES');
        setCandidates([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [sourceData, can_substitute]);

  /**
   * Alterna modo "incluir grupo de proteínas" e re-busca candidatos
   */
  const setIncludeProteinGroup = useCallback((value: boolean) => {
    setIncludeProteinGroupState(value);
    
    // Re-buscar candidatos se temos dados de origem
    if (sourceData) {
      setIsLoading(true);
      setError(null);
      setProposal(null);
      
      try {
        const governanceContext: GovernanceContext = {
          planStatus: 'active',
          userHasPermission: can_substitute,
        };
        
        const result = substituteItem(
          sourceData.food,
          sourceData.grams,
          sourceData.availableFoods,
          undefined,
          governanceContext,
          { excludeFoodIds: sourceData.excludeFoodIds, showAll, includeProteinGroup: value }
        );
        
        if (!result.success) {
          setError(result.error || 'NO_CANDIDATES');
          setCandidates([]);
          return;
        }
        
        setCandidates(result.candidates || []);
      } catch (err) {
        console.error('Error finding candidates:', err);
        setError('NO_CANDIDATES');
        setCandidates([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [sourceData, can_substitute, showAll]);

  /**
   * Verifica se um alimento pode ser substituído
   */
  const canSubstitute = useCallback((food: Food): boolean => {
    return canBeSubstituted(food);
  }, []);

  /**
   * Verifica se um alimento pertence ao grupo de proteínas intercambiáveis
   */
  const isProteinCategory = useCallback((food: Food): boolean => {
    const proteinCategories = ['proteinas', 'peixes', 'frutos_do_mar', 'ovos'];
    const normalized = food.category?.toLowerCase().trim();
    return proteinCategories.includes(normalized || '');
  }, []);

  /**
   * Retorna mensagem formatada da proposta
   */
  const getProposalMessage = useCallback((): string | null => {
    if (!proposal) return null;
    return formatProposalMessage(proposal);
  }, [proposal]);

  /**
   * Retorna nível de impacto da proposta
   */
  const getImpact = useCallback((): 'low' | 'medium' | 'high' | null => {
    if (!proposal) return null;
    return getImpactLevel(proposal);
  }, [proposal]);

  /**
   * Verifica se proposta requer rebalanceamento
   */
  const requiresRebalance = useCallback((): boolean => {
    if (!proposal) return false;
    return needsRebalance(proposal);
  }, [proposal]);

  return {
    isLoading,
    isConfirming,
    proposal,
    candidates,
    error,
    showAll,
    includeProteinGroup,
    findCandidates,
    selectCandidate,
    confirmSubstitution,
    reset,
    setShowAll,
    setIncludeProteinGroup,
    canSubstitute,
    isProteinCategory,
    getProposalMessage,
    getImpact,
    requiresRebalance,
  };
}

// Helper para parsing de serving_size
function parseServingSize(servingSize: string): number {
  const match = servingSize.match(/(\d+)\s*(g|ml)/i);
  if (match) return parseInt(match[1], 10);
  const parenMatch = servingSize.match(/\((\d+)(g|ml)\)/i);
  if (parenMatch) return parseInt(parenMatch[1], 10);
  return 100;
}

// Re-exportar tipos úteis
export type { 
  SubstituteProposal, 
  SubstituteCandidate, 
  SubstituteError,
};
