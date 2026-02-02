import { useMemo } from 'react';
import { ACTIVITY_LEVELS, GOALS } from '@/lib/types';

interface ProfileData {
  age?: number | null;
  sex?: string | null;
  height?: number | null;
  weight?: number | null;
  goal?: string | null;
  activity_level?: string | null;
}

interface MetabolicResults {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Calcula TMB (Taxa Metabólica Basal) usando a fórmula de Mifflin-St Jeor
 * e TDEE (Gasto Energético Total Diário)
 */
export function useMetabolicCalculations(profile: ProfileData | null): MetabolicResults | null {
  return useMemo(() => {
    if (!profile) return null;
    
    const { age, sex, height, weight, goal, activity_level } = profile;
    
    if (!age || !sex || !height || !weight || !activity_level) {
      return null;
    }

    // Mifflin-St Jeor Formula
    const bmr = sex === 'male' || sex === 'M'
      ? 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + 5
      : 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) - 161;

    const activityMultiplier = ACTIVITY_LEVELS[activity_level as keyof typeof ACTIVITY_LEVELS]?.multiplier || 1.55;
    const tdee = bmr * activityMultiplier;
    
    // Map goal to normalized key
    const normalizedGoal = goal === 'lose' ? 'lose_weight' : goal === 'gain' ? 'gain_muscle' : goal;
    const calorieAdjustment = normalizedGoal ? GOALS[normalizedGoal as keyof typeof GOALS]?.calorieAdjustment || 0 : 0;
    const calories = Math.round(tdee + calorieAdjustment);

    // Macro ratios based on goal
    let proteinRatio = 0.3;
    let carbsRatio = 0.4;
    let fatRatio = 0.3;

    if (normalizedGoal === 'gain_muscle') {
      proteinRatio = 0.35;
      carbsRatio = 0.45;
      fatRatio = 0.2;
    } else if (normalizedGoal === 'lose_weight') {
      proteinRatio = 0.35;
      carbsRatio = 0.35;
      fatRatio = 0.3;
    }

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calories,
      protein: Math.round((calories * proteinRatio) / 4),
      carbs: Math.round((calories * carbsRatio) / 4),
      fat: Math.round((calories * fatRatio) / 9),
    };
  }, [profile]);
}
