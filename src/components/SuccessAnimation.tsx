import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface SuccessAnimationProps {
  show: boolean;
  message?: string;
}

// Confetti particle component
const ConfettiParticle = ({ delay, x, color }: { delay: number; x: number; color: string }) => (
  <motion.div
    className="absolute w-2 h-2 rounded-full"
    style={{ backgroundColor: color, left: '50%' }}
    initial={{ opacity: 0, y: 0, x: 0, scale: 0 }}
    animate={{
      opacity: [0, 1, 1, 0],
      y: [0, -60, -80, -100],
      x: [0, x, x * 1.5, x * 2],
      scale: [0, 1, 0.8, 0.5],
      rotate: [0, 180, 360, 540],
    }}
    transition={{
      duration: 1.2,
      delay,
      ease: 'easeOut',
    }}
  />
);

export function SuccessAnimation({ show, message = 'Sucesso!' }: SuccessAnimationProps) {
  if (!show) return null;

  const confettiColors = [
    'hsl(var(--primary))',
    'hsl(142, 76%, 36%)', // green
    'hsl(45, 93%, 47%)',  // yellow/gold
    'hsl(217, 91%, 60%)', // blue
    'hsl(280, 87%, 65%)', // purple
  ];

  const confettiParticles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    delay: 0.1 + (i * 0.05),
    x: (i % 2 === 0 ? 1 : -1) * (20 + Math.random() * 40),
    color: confettiColors[i % confettiColors.length],
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-6 relative"
    >
      {/* Confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="relative w-full h-full flex items-center justify-center">
          {confettiParticles.map((particle) => (
            <ConfettiParticle
              key={particle.id}
              delay={particle.delay}
              x={particle.x}
              color={particle.color}
            />
          ))}
        </div>
      </div>

      {/* Animated check circle */}
      <motion.div
        className="relative"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          delay: 0.1,
        }}
      >
        {/* Outer ring pulse */}
        <motion.div
          className="absolute inset-0 rounded-full bg-green-500/20"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{
            duration: 0.8,
            delay: 0.2,
            ease: 'easeOut',
          }}
          style={{ width: 80, height: 80, margin: -4 }}
        />
        
        {/* Second ring pulse */}
        <motion.div
          className="absolute inset-0 rounded-full bg-green-500/30"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.3,
            ease: 'easeOut',
          }}
          style={{ width: 80, height: 80, margin: -4 }}
        />

        {/* Main circle */}
        <motion.div
          className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg"
          initial={{ rotate: -180, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 15,
            delay: 0.15,
          }}
        >
          {/* Check icon with draw animation */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 20,
              delay: 0.35,
            }}
          >
            <Check className="w-9 h-9 text-white stroke-[3]" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Success message */}
      <motion.p
        className="mt-4 text-lg font-semibold text-green-600 dark:text-green-400"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        {message}
      </motion.p>
    </motion.div>
  );
}
