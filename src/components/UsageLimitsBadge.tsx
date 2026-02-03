import { motion } from 'framer-motion';
import { Infinity, AlertTriangle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { cn } from '@/lib/utils';

interface UsageLimitsBadgeProps {
  feature: 'diet' | 'substitution' | 'adjustment' | 'chat';
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

const FEATURE_LABELS = {
  diet: { singular: 'dieta', plural: 'dietas', icon: '🍽️' },
  substitution: { singular: 'substituição', plural: 'substituições', icon: '🔄' },
  adjustment: { singular: 'ajuste', plural: 'ajustes', icon: '⚡' },
  chat: { singular: 'mensagem', plural: 'mensagens', icon: '💬' },
};

export function UsageLimitsBadge({ 
  feature, 
  showLabel = true, 
  compact = false,
  className 
}: UsageLimitsBadgeProps) {
  const { usage, loading, isAdmin } = useUsageLimits();
  
  if (loading || !usage) return null;

  const featureData = {
    diet: usage.diets,
    substitution: usage.substitutions,
    adjustment: usage.adjustments,
    chat: usage.chat,
  }[feature];

  const labels = FEATURE_LABELS[feature];
  const percentage = featureData.isUnlimited 
    ? 0 
    : Math.min((featureData.used / featureData.limit) * 100, 100);
  const isAtLimit = !featureData.isUnlimited && featureData.remaining <= 0;
  const isNearLimit = !featureData.isUnlimited && percentage >= 80 && percentage < 100;

  const getStatusColor = () => {
    if (featureData.isUnlimited) return 'text-primary';
    if (isAtLimit) return 'text-destructive';
    if (isNearLimit) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (featureData.isUnlimited) return 'outline';
    if (isAtLimit) return 'destructive';
    if (isNearLimit) return 'secondary';
    return 'outline';
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={getBadgeVariant()} className={cn("gap-1 cursor-help", className)}>
              {featureData.isUnlimited ? (
                <>
                  <Infinity className="h-3 w-3" />
                  <span className="sr-only">Ilimitado</span>
                </>
              ) : (
                <>
                  {isAtLimit && <AlertTriangle className="h-3 w-3" />}
                  <span>{featureData.remaining}</span>
                </>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            {featureData.isUnlimited ? (
              <span>Uso ilimitado de {labels.plural}</span>
            ) : (
              <span>
                {featureData.used}/{featureData.limit} {labels.plural} usadas
                {isAtLimit && ' - Limite atingido!'}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex flex-col gap-1.5 p-3 rounded-lg border bg-card/50",
        isAtLimit && "border-destructive/50 bg-destructive/5",
        isNearLimit && "border-yellow-500/50 bg-yellow-500/5",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium flex items-center gap-1.5">
          <span>{labels.icon}</span>
          {showLabel && (
            <span className="capitalize">{labels.plural}</span>
          )}
        </span>
        <span className={cn("text-xs font-semibold flex items-center gap-1", getStatusColor())}>
          {featureData.isUnlimited ? (
            <>
              <Infinity className="h-3 w-3" />
              <span>Ilimitado</span>
            </>
          ) : (
            <>
              {isAtLimit && <AlertTriangle className="h-3 w-3" />}
              <span>{featureData.used}/{featureData.limit}</span>
            </>
          )}
        </span>
      </div>
      
      {!featureData.isUnlimited && (
        <Progress 
          value={percentage} 
          className={cn(
            "h-1.5",
            isAtLimit && "[&>div]:bg-destructive",
            isNearLimit && "[&>div]:bg-yellow-500"
          )}
        />
      )}
      
      {!featureData.isUnlimited && featureData.remaining > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {featureData.remaining} {featureData.remaining === 1 ? labels.singular : labels.plural} restante{featureData.remaining === 1 ? '' : 's'}
        </p>
      )}
      
      {isAtLimit && (
        <p className="text-[10px] text-destructive font-medium flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Faça upgrade para continuar
        </p>
      )}
    </motion.div>
  );
}
