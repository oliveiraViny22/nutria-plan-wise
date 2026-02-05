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

    // =====================================================
    // CÁLCULO DE PROTEÍNA BASEADO EM g/kg DE PESO CORPORAL
    // =====================================================
    // Referência científica: 1.6-2.2g/kg para hipertrofia
    // - lose_weight: 2.0g/kg (preservar massa magra em déficit)
    // - gain_muscle: 2.0g/kg (suporte à hipertrofia)
    // - maintain: 1.8g/kg (manutenção)
    // LIMITE DE SEGURANÇA: Máximo 3.0g/kg (evitar sobrecarga renal)
    // =====================================================
    const MAX_PROTEIN_PER_KG = 3.0; // Limite máximo de segurança
    const weightNum = Number(weight);
    
    let proteinPerKg = 1.8; // default
    let fatRatio = 0.25; // 25% das calorias para gordura
    
    if (normalizedGoal === 'gain_muscle') {
      proteinPerKg = 2.0;
      fatRatio = 0.20; // menos gordura, mais carbs para energia
    } else if (normalizedGoal === 'lose_weight') {
      proteinPerKg = 2.0; // maior proteína para preservar massa magra
      fatRatio = 0.30; // mais gordura para saciedade
    }

    // Proteína em gramas baseada no peso corporal (com limite de segurança)
    const rawProtein = weightNum * proteinPerKg;
    const maxProtein = weightNum * MAX_PROTEIN_PER_KG;
    const protein = Math.round(Math.min(rawProtein, maxProtein));
    const proteinCalories = protein * 4;
    
    // Gordura baseada em percentual das calorias
    const fat = Math.round((calories * fatRatio) / 9);
    const fatCalories = fat * 9;
    
    // Carboidratos preenchem o restante das calorias
    const remainingCalories = calories - proteinCalories - fatCalories;
    const carbs = Math.max(0, Math.round(remainingCalories / 4));

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calories,
      protein,
      carbs,
      fat,
    };
  }, [profile]);
}
