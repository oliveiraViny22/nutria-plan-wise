/**
 * Hydration Recommendations Engine
 * Calculates personalized water intake based on weight and goals
 */

export type UserGoal = 'lose_weight' | 'maintain' | 'gain_muscle';

interface HydrationResult {
  liters: number;
  glasses: number; // 250ml glasses
  tip: string;
  emoji: string;
}

// Base calculation: 40ml per kg of body weight (more realistic)
// Adjustments based on goal
const GOAL_MULTIPLIERS: Record<UserGoal, number> = {
  lose_weight: 1.1,  // +10% for metabolism and satiety
  maintain: 1.0,     // Standard
  gain_muscle: 1.15, // +15% for muscle recovery and performance
};

const GOAL_TIPS: Record<UserGoal, string> = {
  lose_weight: 'Beba um copo 30min antes das refeições para aumentar a saciedade',
  maintain: 'Mantenha uma garrafa de água sempre por perto durante o dia',
  gain_muscle: 'Hidrate-se bem antes, durante e após os treinos',
};

const GOAL_EMOJIS: Record<UserGoal, string> = {
  lose_weight: '🔥',
  maintain: '💧',
  gain_muscle: '💧',
};

export function calculateHydration(
  weightKg: number | null | undefined,
  goal: UserGoal = 'maintain'
): HydrationResult {
  // Default weight if not provided
  const weight = weightKg || 70;
  
  // Base: 40ml per kg (more realistic recommendation)
  const baseML = weight * 40;
  
  // Apply goal multiplier
  const adjustedML = baseML * GOAL_MULTIPLIERS[goal];
  
  // Convert to liters (rounded to 0.5L increments for practicality)
  const liters = Math.round(adjustedML / 500) * 0.5;
  
  // Ensure minimum of 2L and maximum of 5L
  const finalLiters = Math.max(2, Math.min(5, liters));
  
  // Convert to 250ml glasses
  const glasses = Math.round(finalLiters * 4);
  
  return {
    liters: finalLiters,
    glasses,
    tip: GOAL_TIPS[goal],
    emoji: GOAL_EMOJIS[goal],
  };
}

export function getHydrationLabel(goal: UserGoal): string {
  switch (goal) {
    case 'lose_weight':
      return 'Hidratação p/ Emagrecimento';
    case 'gain_muscle':
      return 'Hidratação p/ Hipertrofia';
    default:
      return 'Hidratação Diária';
  }
}
