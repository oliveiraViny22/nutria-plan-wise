/**
 * Sistema de Recomendação de Suplementação Personalizada
 * 
 * Gera recomendações baseadas em:
 * 1. Objetivo do usuário (emagrecer, manter, ganhar massa)
 * 2. Gaps nutricionais detectados no plano alimentar
 */

export type UserGoal = 'lose_weight' | 'maintain' | 'gain_muscle';

export interface Supplement {
  name: string;
  dosage: string;
  timing: string;
  priority: 'essential' | 'recommended' | 'optional';
  reason: string;
}

export interface SupplementPeriod {
  period: string;
  emoji: string;
  supplements: Supplement[];
}

export interface NutritionalGaps {
  lowProtein: boolean;      // < 90% da meta
  lowCarbs: boolean;        // < 80% da meta
  lowFat: boolean;          // < 70% da meta (raro)
  highFat: boolean;         // > 110% da meta
  lowCalories: boolean;     // < 90% da meta
}

export interface PlanMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ProfileTargets {
  daily_calories: number | null;
  protein_target: number | null;
  carbs_target: number | null;
  fat_target: number | null;
}

/**
 * Detecta gaps nutricionais comparando plano com metas do perfil
 */
export function detectNutritionalGaps(
  planMacros: PlanMacros,
  profileTargets: ProfileTargets
): NutritionalGaps {
  const proteinRatio = profileTargets.protein_target 
    ? planMacros.protein / profileTargets.protein_target 
    : 1;
  const carbsRatio = profileTargets.carbs_target 
    ? planMacros.carbs / profileTargets.carbs_target 
    : 1;
  const fatRatio = profileTargets.fat_target 
    ? planMacros.fat / profileTargets.fat_target 
    : 1;
  const calorieRatio = profileTargets.daily_calories 
    ? planMacros.calories / profileTargets.daily_calories 
    : 1;

  return {
    lowProtein: proteinRatio < 0.90,
    lowCarbs: carbsRatio < 0.80,
    lowFat: fatRatio < 0.70,
    highFat: fatRatio > 1.10,
    lowCalories: calorieRatio < 0.90,
  };
}

/**
 * Suplementos base por objetivo
 */
const GOAL_SUPPLEMENTS: Record<UserGoal, SupplementPeriod[]> = {
  lose_weight: [
    {
      period: 'Manhã',
      emoji: '🌅',
      supplements: [
        { 
          name: 'Whey Protein Isolado', 
          dosage: '25g', 
          timing: 'Em jejum ou pós-treino',
          priority: 'essential',
          reason: 'Preserva massa magra durante déficit calórico'
        },
        { 
          name: 'Cafeína', 
          dosage: '100-200mg', 
          timing: 'Antes do treino',
          priority: 'recommended',
          reason: 'Aumenta metabolismo e energia'
        },
        { 
          name: 'Multivitamínico', 
          dosage: '1 cápsula', 
          timing: 'Com o café da manhã',
          priority: 'recommended',
          reason: 'Compensa restrição calórica'
        },
      ]
    },
    {
      period: 'Tarde',
      emoji: '☀️',
      supplements: [
        { 
          name: 'L-Carnitina', 
          dosage: '1-2g', 
          timing: 'Antes do treino',
          priority: 'optional',
          reason: 'Auxilia na oxidação de gorduras'
        },
      ]
    },
    {
      period: 'Noite',
      emoji: '🌙',
      supplements: [
        { 
          name: 'Ômega-3', 
          dosage: '1000mg', 
          timing: 'Com o jantar',
          priority: 'essential',
          reason: 'Anti-inflamatório, saúde cardiovascular'
        },
        { 
          name: 'Vitamina D3', 
          dosage: '2000 UI', 
          timing: 'Com gordura',
          priority: 'recommended',
          reason: 'Suporte hormonal e imunológico'
        },
      ]
    },
  ],
  
  maintain: [
    {
      period: 'Manhã',
      emoji: '🌅',
      supplements: [
        { 
          name: 'Multivitamínico', 
          dosage: '1 cápsula', 
          timing: 'Com o café da manhã',
          priority: 'recommended',
          reason: 'Prevenção e saúde geral'
        },
      ]
    },
    {
      period: 'Noite',
      emoji: '🌙',
      supplements: [
        { 
          name: 'Ômega-3', 
          dosage: '1000mg', 
          timing: 'Com o jantar',
          priority: 'essential',
          reason: 'Saúde cardiovascular e cognitiva'
        },
        { 
          name: 'Vitamina D3', 
          dosage: '1000-2000 UI', 
          timing: 'Com gordura',
          priority: 'recommended',
          reason: 'Imunidade e saúde óssea'
        },
        { 
          name: 'Magnésio', 
          dosage: '200-400mg', 
          timing: 'Antes de dormir',
          priority: 'optional',
          reason: 'Relaxamento muscular e sono'
        },
      ]
    },
  ],
  
  gain_muscle: [
    {
      period: 'Manhã',
      emoji: '🌅',
      supplements: [
        { 
          name: 'Creatina Monohidratada', 
          dosage: '5g', 
          timing: 'Dose única diária',
          priority: 'essential',
          reason: 'Aumenta força e volume muscular'
        },
        { 
          name: 'Whey Protein', 
          dosage: '30g', 
          timing: 'Pós café da manhã',
          priority: 'essential',
          reason: 'Síntese proteica muscular'
        },
        { 
          name: 'Multivitamínico', 
          dosage: '1 cápsula', 
          timing: 'Com o café da manhã',
          priority: 'recommended',
          reason: 'Suporte metabólico'
        },
      ]
    },
    {
      period: 'Tarde',
      emoji: '☀️',
      supplements: [
        { 
          name: 'Whey Protein', 
          dosage: '30g', 
          timing: 'Pós-treino ou lanche',
          priority: 'essential',
          reason: 'Janela anabólica pós-treino'
        },
        { 
          name: 'BCAA', 
          dosage: '5-10g', 
          timing: 'Intra ou pós-treino',
          priority: 'optional',
          reason: 'Recuperação muscular'
        },
      ]
    },
    {
      period: 'Noite',
      emoji: '🌙',
      supplements: [
        { 
          name: 'Ômega-3', 
          dosage: '1000-2000mg', 
          timing: 'Com o jantar',
          priority: 'recommended',
          reason: 'Anti-inflamatório, recuperação'
        },
        { 
          name: 'ZMA', 
          dosage: 'Conforme rótulo', 
          timing: 'Antes de dormir',
          priority: 'optional',
          reason: 'Recuperação noturna e testosterona'
        },
      ]
    },
    {
      period: 'Antes de Dormir',
      emoji: '😴',
      supplements: [
        { 
          name: 'Caseína', 
          dosage: '30g', 
          timing: '30 min antes de dormir',
          priority: 'recommended',
          reason: 'Proteína de absorção lenta (8h)'
        },
      ]
    },
  ],
};

/**
 * Suplementos adicionais para cobrir gaps nutricionais
 */
function getGapSupplements(gaps: NutritionalGaps): Supplement[] {
  const supplements: Supplement[] = [];

  if (gaps.lowProtein) {
    supplements.push({
      name: 'Whey Protein Extra',
      dosage: '+20-30g',
      timing: 'Entre refeições',
      priority: 'essential',
      reason: '⚠️ Proteína abaixo da meta - adicione mais 1 dose'
    });
  }

  if (gaps.lowCarbs) {
    supplements.push({
      name: 'Maltodextrina ou Waxy Maize',
      dosage: '30-50g',
      timing: 'Pré ou pós-treino',
      priority: 'recommended',
      reason: '⚠️ Carboidratos baixos - energia para treino'
    });
  }

  if (gaps.lowCalories) {
    supplements.push({
      name: 'Hipercalórico ou Pasta de Amendoim',
      dosage: '1 porção',
      timing: 'Lanche da tarde',
      priority: 'recommended',
      reason: '⚠️ Calorias abaixo da meta - adicione calorias densas'
    });
  }

  return supplements;
}

/**
 * Gera recomendações personalizadas completas
 */
export function generateSupplementRecommendations(
  goal: UserGoal,
  planMacros: PlanMacros,
  profileTargets: ProfileTargets
): {
  periods: SupplementPeriod[];
  gaps: NutritionalGaps;
  gapSupplements: Supplement[];
} {
  const gaps = detectNutritionalGaps(planMacros, profileTargets);
  const gapSupplements = getGapSupplements(gaps);
  const basePeriods = GOAL_SUPPLEMENTS[goal] || GOAL_SUPPLEMENTS.maintain;

  return {
    periods: basePeriods,
    gaps,
    gapSupplements,
  };
}

/**
 * Formata prioridade para exibição
 */
export function getPriorityBadge(priority: Supplement['priority']): {
  label: string;
  variant: 'default' | 'secondary' | 'outline';
} {
  switch (priority) {
    case 'essential':
      return { label: 'Essencial', variant: 'default' };
    case 'recommended':
      return { label: 'Recomendado', variant: 'secondary' };
    case 'optional':
      return { label: 'Opcional', variant: 'outline' };
  }
}
