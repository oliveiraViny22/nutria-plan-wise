import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/ui-kit';

interface CalorieRingProps {
  current: number;
  target: number;
  size?: number;
}

export function CalorieRing({ current, target, size = 180 }: CalorieRingProps) {
  const strokeWidth = size * 0.08;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((current / target) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Decorative outer ring */}
      <svg width={size} height={size} className="-rotate-90 absolute">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius + strokeWidth * 0.8}
          stroke="hsl(var(--accent) / 0.1)"
          strokeWidth={1}
          fill="none"
          strokeDasharray="4 4"
        />
      </svg>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle with gradient effect */}
        <defs>
          <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(158, 60%, 45%)" />
            <stop offset="50%" stopColor="hsl(165, 50%, 48%)" />
            <stop offset="100%" stopColor="hsl(42, 80%, 55%)" />
          </linearGradient>
        </defs>
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#calorieGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedCounter value={Math.round(current)} duration={1200} className="text-3xl font-bold text-foreground" />
        <span className="text-sm text-muted-foreground">/ {target} kcal</span>
      </div>
    </div>
  );
}
