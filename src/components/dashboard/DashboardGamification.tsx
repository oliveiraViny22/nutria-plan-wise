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
      {/* Daily Log CTA - shown for all users, locked for free */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <DailyLogCTA 
          mealsLogged={mealsLogged}
          totalMeals={totalMeals}
          locked={!isPaidUser}
        />
      </motion.section>

      {/* Gamification Section - shown for all users */}
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
