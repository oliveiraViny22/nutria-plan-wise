import { motion } from 'framer-motion';
import { 
  Flame, 
  Trophy,
  Star,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LockedFeaturePreview } from './LockedFeaturePreview';

/**
 * Mock/preview version of AdherenceStreak for free users
 * Shows what the feature looks like with blur overlay
 */
function MockAdherenceStreak() {
  return (
    <Card className="card-elevated overflow-hidden">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500">
            <Flame className="w-7 h-7 text-white" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-orange-500 flex items-center justify-center">
              <span className="text-xs font-bold text-orange-500">7</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">7 dias seguidos</h3>
              <Badge variant="secondary" className="text-xs text-orange-500 bg-background/50">
                <Flame className="w-3 h-3 mr-1" />
                Constante
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Mais 7 dias para "Dedicado"
            </p>
            <div className="flex items-center gap-1 mt-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Ativo hoje!</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Mock/preview version of WeeklyAdherenceChart for free users
 */
function MockWeeklyChart() {
  const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const mockData = [100, 85, 100, 70, 100, 50, 0]; // Example percentages
  
  return (
    <Card className="card-elevated">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">Adesão Semanal</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            <Calendar className="w-3 h-3 mr-1" />
            Esta semana
          </Badge>
        </div>
        
        <div className="flex items-end justify-between gap-2 h-24">
          {days.map((day, i) => {
            const height = mockData[i];
            const isComplete = height >= 70;
            
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse h-16">
                  <div 
                    className={`w-full rounded-t-sm transition-all ${
                      isComplete 
                        ? 'bg-gradient-to-t from-green-500 to-green-400' 
                        : height > 0 
                          ? 'bg-gradient-to-t from-amber-500 to-amber-400'
                          : 'bg-muted'
                    }`}
                    style={{ height: `${Math.max(height, 10)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {day}
                </span>
              </div>
            );
          })}
        </div>
        
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm text-foreground font-medium">85% de adesão</span>
          </div>
          <span className="text-xs text-muted-foreground">17/20 refeições</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface GamificationPreviewProps {
  isLocked: boolean;
}

export function GamificationPreview({ isLocked }: GamificationPreviewProps) {
  if (!isLocked) {
    // This shouldn't be used when unlocked - use actual components
    return null;
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:grid lg:grid-cols-2">
      <LockedFeaturePreview
        featureName="Sequência de Adesão"
        featureKey="gamification_streak"
        description="Acompanhe sua consistência e ganhe conquistas"
      >
        <MockAdherenceStreak />
      </LockedFeaturePreview>
      
      <LockedFeaturePreview
        featureName="Gráfico Semanal"
        featureKey="gamification_weekly_chart"
        description="Visualize seu progresso ao longo da semana"
      >
        <MockWeeklyChart />
      </LockedFeaturePreview>
    </div>
  );
}
