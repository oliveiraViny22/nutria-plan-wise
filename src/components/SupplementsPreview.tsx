import { 
  Pill, 
  Lock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface SupplementsPreviewProps {
  isLocked: boolean;
}

/**
 * Compact locked preview for supplementation feature
 * Shows minimal teaser without taking too much space
 */
export function SupplementsPreview({ isLocked }: SupplementsPreviewProps) {
  const navigate = useNavigate();

  if (!isLocked) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-500/5 via-background to-purple-500/5">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Pill className="w-4 h-4 text-purple-400" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-background border border-purple-500/50 flex items-center justify-center">
              <Lock className="w-2.5 h-2.5 text-purple-400" />
            </div>
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">
                Suplementação Personalizada
              </span>
              <Badge 
                variant="outline" 
                className="shrink-0 text-[10px] px-1.5 py-0 h-4 border-purple-500/50 text-purple-400 bg-purple-500/10"
              >
                Pro
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Recomendações baseadas nas suas lacunas nutricionais
            </p>
          </div>
        </div>

        {/* Right: CTA */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/pricing')}
          className="shrink-0 gap-1 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
        >
          <Sparkles className="w-3 h-3" />
          <span className="hidden sm:inline">Desbloquear</span>
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>

      {/* Subtle animated glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-purple-500/10 via-transparent to-transparent opacity-50 animate-pulse" 
          style={{ animationDuration: '3s' }}
        />
      </div>
    </div>
  );
}
