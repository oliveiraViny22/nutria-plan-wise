import { motion } from 'framer-motion';
import { DailyLogCTA } from '@/components/DailyLogCTA';
import { WeeklyAdherenceChart } from '@/components/WeeklyAdherenceChart';
import { AdherenceStreak } from '@/components/AdherenceStreak';
import { GamificationPreview } from '@/components/GamificationPreview';
import { SupplementToggle } from '@/components/SupplementToggle';

interface DashboardGamificationProps {
  hasPlan: boolean;
  planType?: string;
  isLinkedStudent: boolean;
  mealsLogged: number;
  totalMeals: number;
  includeSupplements?: boolean;
}

export function DashboardGamification({
  hasPlan,
  planType,
  isLinkedStudent,
  mealsLogged,
  totalMeals,
  includeSupplements = false,
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0">
              <AdherenceStreak />
            </div>
            <div className="min-w-0">
              <WeeklyAdherenceChart />
            </div>
          </div>
        )}
      </motion.section>

      {/* Supplement Toggle */}
      {!isLinkedStudent && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <SupplementToggle 
            initialValue={includeSupplements}
            compact
            locked={!isPaidUser}
          />
        </motion.section>
      )}
    </>
  );
}
