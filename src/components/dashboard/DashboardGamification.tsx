import { motion } from 'framer-motion';
import { DailyLogCTA } from '@/components/DailyLogCTA';
import { AdherenceStreak } from '@/components/AdherenceStreak';
import { GamificationPreview } from '@/components/GamificationPreview';

interface DashboardGamificationProps {
  hasPlan: boolean;
  planType?: string;
  mealsLogged: number;
  totalMeals: number;
}

export function DashboardGamification({
  hasPlan,
  planType,
  mealsLogged,
  totalMeals,
}: DashboardGamificationProps) {
  if (!hasPlan) return null;

  const isPaidUser = planType !== 'gratuito';

  return (
    <>
      {/* Daily Log CTA - only for paid users with a plan */}
      {isPaidUser && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <DailyLogCTA 
            mealsLogged={mealsLogged}
            totalMeals={totalMeals}
          />
        </motion.section>
      )}

      {/* Gamification Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        {!isPaidUser ? (
          <GamificationPreview isLocked={true} />
        ) : (
          <AdherenceStreak />
        )}
      </motion.section>
    </>
  );
}
