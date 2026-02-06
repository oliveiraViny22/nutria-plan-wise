import { motion } from 'framer-motion';
import { DailyLogCTA } from '@/components/DailyLogCTA';
import { AdherenceStreak } from '@/components/AdherenceStreak';
import { GamificationPreview } from '@/components/GamificationPreview';
import { ProgressCard } from '@/components/dashboard/ProgressCard';

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
      {/* Daily Log CTA - smaller, centered */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="flex justify-center"
      >
        <div className="w-full max-w-xs">
          <DailyLogCTA 
            mealsLogged={mealsLogged}
            totalMeals={totalMeals}
            locked={!isPaidUser}
          />
        </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <AdherenceStreak />
            <ProgressCard />
          </div>
        )}
      </motion.section>
    </>
  );
}
