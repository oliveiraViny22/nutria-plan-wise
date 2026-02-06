import { motion } from 'framer-motion';
import { AdherenceStreak } from '@/components/AdherenceStreak';
import { GamificationPreview } from '@/components/GamificationPreview';
import { ProgressCard } from '@/components/dashboard/ProgressCard';

interface DashboardGamificationProps {
  hasPlan: boolean;
  planType?: string;
}

export function DashboardGamification({
  hasPlan,
  planType,
}: DashboardGamificationProps) {
  if (!hasPlan) return null;

  const isPaidUser = planType && planType !== 'gratuito';

  return (
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
  );
}
