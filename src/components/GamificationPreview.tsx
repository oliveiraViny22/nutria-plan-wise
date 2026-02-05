import { 
  Flame, 
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


interface GamificationPreviewProps {
  isLocked: boolean;
}

export function GamificationPreview({ isLocked }: GamificationPreviewProps) {
  if (!isLocked) {
    // This shouldn't be used when unlocked - use actual components
    return null;
  }

  return (
    <LockedFeaturePreview
      featureName="Sequência de Adesão"
      featureKey="gamification_streak"
      description="Acompanhe sua consistência e ganhe conquistas"
    >
      <MockAdherenceStreak />
    </LockedFeaturePreview>
  );
}
