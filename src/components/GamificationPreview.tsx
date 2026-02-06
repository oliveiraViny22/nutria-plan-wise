import { 
  Flame,
  TrendingUp,
  Scale,
  Ruler,
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
    <Card className="card-elevated overflow-hidden h-full">
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
 * Mock/preview version of Progress Tracking for free users
 */
function MockProgressTracking() {
  return (
    <Card className="card-elevated overflow-hidden h-full">
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-cyan-500">
            <TrendingUp className="w-7 h-7 text-white" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-blue-500 flex items-center justify-center">
              <Scale className="w-3 h-3 text-blue-500" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Progresso</h3>
              <Badge variant="secondary" className="text-xs text-blue-500 bg-background/50">
                <Ruler className="w-3 h-3 mr-1" />
                Medidas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              -2.5kg nas últimas 4 semanas
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-full" />
              </div>
              <span className="text-xs text-muted-foreground">75%</span>
            </div>
          </div>
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
      <LockedFeaturePreview
        featureName="Sequência de Adesão"
        featureKey="gamification_streak"
        description="Acompanhe sua consistência e ganhe conquistas"
      >
        <MockAdherenceStreak />
      </LockedFeaturePreview>
      
      <LockedFeaturePreview
        featureName="Registro de Progresso"
        featureKey="progress_tracking"
        description="Acompanhe peso, medidas e evolução corporal"
      >
        <MockProgressTracking />
      </LockedFeaturePreview>
    </div>
  );
}
