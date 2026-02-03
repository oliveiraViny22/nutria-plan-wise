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
/**
 * Suplementos base por objetivo - EXCLUINDO itens que impactam macros
 * (Whey, BCAA, Caseína, Maltodextrina, Hipercalórico são excluídos pois
 * as alternativas de refeição já contemplam suplementação proteica)
 */
const GOAL_SUPPLEMENTS: Record<UserGoal, SupplementPeriod[]> = {
  lose_weight: [
    {
      period: 'Manhã',
      emoji: '🌅',
      supplements: [
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
          name: 'Multivitamínico', 
          dosage: '1 cápsula', 
          timing: 'Com o café da manhã',
          priority: 'recommended',
          reason: 'Suporte metabólico'
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
  ],
};

/**
 * Suplementos adicionais para cobrir gaps nutricionais
 * NOTA: Itens que impactam macros (Whey, Maltodextrina, Hipercalórico) 
 * foram removidos pois as alternativas de refeição já cobrem esses gaps.
 * Mantemos apenas alertas informativos sobre os gaps detectados.
 */
function getGapSupplements(gaps: NutritionalGaps): Supplement[] {
  const supplements: Supplement[] = [];

  // Apenas alertas informativos - suplementos de macro removidos
  // Os gaps são tratados pelas alternativas de refeição (MealReplacementCard)

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
