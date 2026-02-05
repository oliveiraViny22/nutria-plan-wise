import { useMemo } from 'react';
import { useMetabolicCalculations } from './useMetabolicCalculations';

interface ProfileData {
  age?: number | null;
  sex?: string | null;
  height?: number | null;
  weight?: number | null;
  goal?: string | null;
  activity_level?: string | null;
  daily_calories?: number | null;
  protein_target?: number | null;
  carbs_target?: number | null;
  fat_target?: number | null;
}

export interface ValidationIssue {
  field: 'calories' | 'protein' | 'carbs' | 'fat';
  severity: 'warning' | 'error';
  message: string;
  currentValue: number;
  recommendedValue: number;
  deviationPercent: number;
}

export interface NutritionalValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  recommendations: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } | null;
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
  };
}

// Tolerâncias de desvio aceitáveis
const TOLERANCE = {
  calories: { warning: 10, error: 25 }, // ±10% warning, ±25% error
  protein: { warning: 15, error: 30 },  // ±15% warning, ±30% error
  carbs: { warning: 20, error: 40 },    // ±20% warning, ±40% error
  fat: { warning: 20, error: 40 },      // ±20% warning, ±40% error
};

// Limites absolutos de segurança
const ABSOLUTE_LIMITS = {
  calories: { min: 1200, max: 6000 },
  protein: { minPerKg: 0.8, maxPerKg: 3.0 },
  fat: { minPercent: 15, maxPercent: 40 }, // % das calorias
};

const FIELD_LABELS: Record<string, string> = {
  calories: 'Calorias',
  protein: 'Proteína',
  carbs: 'Carboidratos',
  fat: 'Gordura',
};

/**
 * Hook que valida se as metas nutricionais do perfil estão alinhadas
 * com os valores calculados cientificamente baseados nos dados antropométricos.
 */
export function useNutritionalValidation(profile: ProfileData | null): NutritionalValidationResult {
  const metabolicData = useMetabolicCalculations(profile);

  return useMemo(() => {
    // Se não há dados suficientes para calcular, retorna válido sem issues
    if (!profile || !metabolicData) {
      return {
        isValid: true,
        issues: [],
        recommendations: null,
        summary: { totalIssues: 0, errors: 0, warnings: 0 },
      };
    }

    const issues: ValidationIssue[] = [];
    const weight = Number(profile.weight) || 70;

    // 1. Validar Calorias
    if (profile.daily_calories) {
      const calorieDeviation = calculateDeviation(profile.daily_calories, metabolicData.calories);
      
      // Verificar limites absolutos
      if (profile.daily_calories < ABSOLUTE_LIMITS.calories.min) {
        issues.push({
          field: 'calories',
          severity: 'error',
          message: `Meta calórica muito baixa (${profile.daily_calories} kcal). O mínimo seguro é ${ABSOLUTE_LIMITS.calories.min} kcal para evitar deficiências nutricionais.`,
          currentValue: profile.daily_calories,
          recommendedValue: metabolicData.calories,
          deviationPercent: calorieDeviation,
        });
      } else if (profile.daily_calories > ABSOLUTE_LIMITS.calories.max) {
        issues.push({
          field: 'calories',
          severity: 'error',
          message: `Meta calórica muito alta (${profile.daily_calories} kcal). O máximo recomendado é ${ABSOLUTE_LIMITS.calories.max} kcal.`,
          currentValue: profile.daily_calories,
          recommendedValue: metabolicData.calories,
          deviationPercent: calorieDeviation,
        });
      } else if (Math.abs(calorieDeviation) > TOLERANCE.calories.error) {
        issues.push({
          field: 'calories',
          severity: 'error',
          message: `Meta calórica ${calorieDeviation > 0 ? 'acima' : 'abaixo'} do recomendado (${Math.abs(calorieDeviation).toFixed(0)}% de desvio). Recomendado: ${metabolicData.calories} kcal.`,
          currentValue: profile.daily_calories,
          recommendedValue: metabolicData.calories,
          deviationPercent: calorieDeviation,
        });
      } else if (Math.abs(calorieDeviation) > TOLERANCE.calories.warning) {
        issues.push({
          field: 'calories',
          severity: 'warning',
          message: `Meta calórica ${calorieDeviation > 0 ? 'acima' : 'abaixo'} do recomendado (${Math.abs(calorieDeviation).toFixed(0)}% de desvio). Considere ajustar para ${metabolicData.calories} kcal.`,
          currentValue: profile.daily_calories,
          recommendedValue: metabolicData.calories,
          deviationPercent: calorieDeviation,
        });
      }
    }

    // 2. Validar Proteína
    if (profile.protein_target) {
      const proteinPerKg = profile.protein_target / weight;
      const proteinDeviation = calculateDeviation(profile.protein_target, metabolicData.protein);
      
      if (proteinPerKg < ABSOLUTE_LIMITS.protein.minPerKg) {
        issues.push({
          field: 'protein',
          severity: 'error',
          message: `Proteína muito baixa (${proteinPerKg.toFixed(1)}g/kg). O mínimo recomendado é ${ABSOLUTE_LIMITS.protein.minPerKg}g/kg para manter a massa muscular.`,
          currentValue: profile.protein_target,
          recommendedValue: metabolicData.protein,
          deviationPercent: proteinDeviation,
        });
      } else if (proteinPerKg > ABSOLUTE_LIMITS.protein.maxPerKg) {
        issues.push({
          field: 'protein',
          severity: 'error',
          message: `Proteína muito alta (${proteinPerKg.toFixed(1)}g/kg). O máximo seguro é ${ABSOLUTE_LIMITS.protein.maxPerKg}g/kg para evitar sobrecarga renal.`,
          currentValue: profile.protein_target,
          recommendedValue: metabolicData.protein,
          deviationPercent: proteinDeviation,
        });
      } else if (Math.abs(proteinDeviation) > TOLERANCE.protein.error) {
        issues.push({
          field: 'protein',
          severity: 'error',
          message: `Meta de proteína ${proteinDeviation > 0 ? 'acima' : 'abaixo'} do recomendado. Recomendado: ${metabolicData.protein}g (${(metabolicData.protein / weight).toFixed(1)}g/kg).`,
          currentValue: profile.protein_target,
          recommendedValue: metabolicData.protein,
          deviationPercent: proteinDeviation,
        });
      } else if (Math.abs(proteinDeviation) > TOLERANCE.protein.warning) {
        issues.push({
          field: 'protein',
          severity: 'warning',
          message: `Meta de proteína ligeiramente ${proteinDeviation > 0 ? 'alta' : 'baixa'}. Considere ajustar para ${metabolicData.protein}g.`,
          currentValue: profile.protein_target,
          recommendedValue: metabolicData.protein,
          deviationPercent: proteinDeviation,
        });
      }
    }

    // 3. Validar Carboidratos
    if (profile.carbs_target) {
      const carbsDeviation = calculateDeviation(profile.carbs_target, metabolicData.carbs);
      
      if (Math.abs(carbsDeviation) > TOLERANCE.carbs.error) {
        issues.push({
          field: 'carbs',
          severity: 'error',
          message: `Meta de carboidratos ${carbsDeviation > 0 ? 'acima' : 'abaixo'} do recomendado (${Math.abs(carbsDeviation).toFixed(0)}% de desvio). Recomendado: ${metabolicData.carbs}g.`,
          currentValue: profile.carbs_target,
          recommendedValue: metabolicData.carbs,
          deviationPercent: carbsDeviation,
        });
      } else if (Math.abs(carbsDeviation) > TOLERANCE.carbs.warning) {
        issues.push({
          field: 'carbs',
          severity: 'warning',
          message: `Meta de carboidratos ${carbsDeviation > 0 ? 'acima' : 'abaixo'} do recomendado. Considere ajustar para ${metabolicData.carbs}g.`,
          currentValue: profile.carbs_target,
          recommendedValue: metabolicData.carbs,
          deviationPercent: carbsDeviation,
        });
      }
    }

    // 4. Validar Gordura
    if (profile.fat_target && profile.daily_calories) {
      const fatPercent = (profile.fat_target * 9 / profile.daily_calories) * 100;
      const fatDeviation = calculateDeviation(profile.fat_target, metabolicData.fat);
      
      if (fatPercent < ABSOLUTE_LIMITS.fat.minPercent) {
        issues.push({
          field: 'fat',
          severity: 'error',
          message: `Gordura muito baixa (${fatPercent.toFixed(0)}% das calorias). O mínimo é ${ABSOLUTE_LIMITS.fat.minPercent}% para absorção de vitaminas lipossolúveis.`,
          currentValue: profile.fat_target,
          recommendedValue: metabolicData.fat,
          deviationPercent: fatDeviation,
        });
      } else if (fatPercent > ABSOLUTE_LIMITS.fat.maxPercent) {
        issues.push({
          field: 'fat',
          severity: 'error',
          message: `Gordura muito alta (${fatPercent.toFixed(0)}% das calorias). O máximo recomendado é ${ABSOLUTE_LIMITS.fat.maxPercent}%.`,
          currentValue: profile.fat_target,
          recommendedValue: metabolicData.fat,
          deviationPercent: fatDeviation,
        });
      } else if (Math.abs(fatDeviation) > TOLERANCE.fat.error) {
        issues.push({
          field: 'fat',
          severity: 'error',
          message: `Meta de gordura ${fatDeviation > 0 ? 'acima' : 'abaixo'} do recomendado. Recomendado: ${metabolicData.fat}g.`,
          currentValue: profile.fat_target,
          recommendedValue: metabolicData.fat,
          deviationPercent: fatDeviation,
        });
      } else if (Math.abs(fatDeviation) > TOLERANCE.fat.warning) {
        issues.push({
          field: 'fat',
          severity: 'warning',
          message: `Meta de gordura ligeiramente ${fatDeviation > 0 ? 'alta' : 'baixa'}. Considere ajustar para ${metabolicData.fat}g.`,
          currentValue: profile.fat_target,
          recommendedValue: metabolicData.fat,
          deviationPercent: fatDeviation,
        });
      }
    }

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    return {
      isValid: errors === 0,
      issues,
      recommendations: {
        calories: metabolicData.calories,
        protein: metabolicData.protein,
        carbs: metabolicData.carbs,
        fat: metabolicData.fat,
      },
      summary: {
        totalIssues: issues.length,
        errors,
        warnings,
      },
    };
  }, [profile, metabolicData]);
}

/**
 * Calcula o desvio percentual entre valor atual e recomendado.
 */
function calculateDeviation(current: number, recommended: number): number {
  if (recommended === 0) return 0;
  return ((current - recommended) / recommended) * 100;
}

/**
 * Retorna a label traduzida para um campo.
 */
export function getFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field;
}
