import { Droplet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { calculateHydration, getHydrationLabel, type UserGoal } from '@/lib/hydration-recommendations';
import { cn } from '@/lib/utils';

interface HydrationCardProps {
  weight?: number | null;
  goal?: UserGoal;
  variant?: 'card' | 'compact' | 'metric';
  className?: string;
}

export function HydrationCard({ 
  weight, 
  goal = 'maintain',
  variant = 'card',
  className 
}: HydrationCardProps) {
  const hydration = calculateHydration(weight, goal);

  if (variant === 'metric') {
    return (
      <Card className={cn("bg-gradient-to-br from-card to-muted/20 border-border/30 h-full", className)}>
        <CardContent className="p-4 h-full flex flex-col items-center justify-center text-center">
          <div className="p-2 rounded-lg shrink-0 bg-sky-500/10 text-sky-500 mb-2">
            <Droplet className="h-4 w-4" />
          </div>
          <p className="text-sm text-muted-foreground">Hidratação</p>
          <div className="flex items-baseline gap-1 justify-center">
            <span className="text-2xl font-bold tabular-nums">{hydration.liters}</span>
            <span className="text-sm text-muted-foreground">L</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {hydration.glasses} copos {hydration.emoji}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn("text-center p-3 rounded-lg bg-background/60", className)}>
        <Droplet className="w-5 h-5 mx-auto mb-1 text-sky-500" />
        <p className="text-2xl font-bold">{hydration.liters}L</p>
        <p className="text-xs text-muted-foreground">Água</p>
      </div>
    );
  }

  // Full card variant
  return (
    <Card className={cn("border-sky-500/20 bg-gradient-to-br from-sky-500/5 to-transparent", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <Droplet className="w-4 h-4 text-sky-500" />
            </div>
            <div>
              <p className="font-medium text-sm">{getHydrationLabel(goal)}</p>
              <p className="text-xs text-muted-foreground">Recomendação diária</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {hydration.liters}L
            </p>
            <p className="text-xs text-muted-foreground">
              ~{hydration.glasses} copos
            </p>
          </div>
        </div>
        
        {/* Visual representation */}
        <div className="flex justify-center gap-1 mb-3">
          {Array.from({ length: Math.min(hydration.glasses, 12) }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-6 rounded-sm bg-sky-500/20 relative overflow-hidden"
            >
              <div 
                className="absolute bottom-0 left-0 right-0 bg-sky-500 animate-pulse"
                style={{ 
                  height: '100%',
                  animationDelay: `${i * 100}ms`,
                  animationDuration: '2s'
                }}
              />
            </div>
          ))}
          {hydration.glasses > 12 && (
            <span className="text-xs text-muted-foreground self-center ml-1">
              +{hydration.glasses - 12}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          {hydration.emoji} {hydration.tip}
        </p>
      </CardContent>
    </Card>
  );
}

// Simple inline display for PDF/print
export function HydrationInline({ 
  weight, 
  goal = 'maintain' 
}: { 
  weight?: number | null; 
  goal?: UserGoal;
}) {
  const hydration = calculateHydration(weight, goal);
  
  return (
    <div className="flex items-center gap-2 text-sm">
      <Droplet className="w-4 h-4 text-sky-500" />
      <span className="font-medium">{hydration.liters}L de água</span>
      <span className="text-muted-foreground">({hydration.glasses} copos)</span>
    </div>
  );
}
