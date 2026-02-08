import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, Check } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Compact sync status badge for navigation/header
 * Shows pending count and sync state
 */
export function SyncStatusBadge() {
  const { pendingCount, isSyncing, syncNow, syncStatus } = useOfflineSync();

  if (pendingCount === 0 && !isSyncing) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'relative h-8 px-2 gap-1.5',
            isSyncing && 'cursor-wait'
          )}
          onClick={() => !isSyncing && syncNow()}
          disabled={isSyncing}
        >
          <AnimatePresence mode="wait">
            {isSyncing ? (
              <motion.div
                key="syncing"
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="h-4 w-4 text-primary" />
              </motion.div>
            ) : pendingCount > 0 ? (
              <motion.div
                key="pending"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
              >
                <CloudOff className="h-4 w-4 text-amber-500" />
              </motion.div>
            ) : (
              <motion.div
                key="synced"
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
              >
                <Cloud className="h-4 w-4 text-green-500" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {pendingCount > 0 && (
            <span className="text-xs font-medium text-muted-foreground">
              {pendingCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isSyncing ? (
          <p>Sincronizando...</p>
        ) : pendingCount > 0 ? (
          <p>{pendingCount} registro(s) aguardando sincronização</p>
        ) : (
          <p>Tudo sincronizado</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Full sync status indicator with details
 */
export function SyncStatusCard() {
  const { pendingCount, isSyncing, syncNow, syncStatus } = useOfflineSync();

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Nunca';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 60000) return 'Agora mesmo';
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}min atrás`;
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
      <div className={cn(
        'flex items-center justify-center w-10 h-10 rounded-full',
        isSyncing && 'bg-primary/10',
        !isSyncing && pendingCount > 0 && 'bg-amber-500/10',
        !isSyncing && pendingCount === 0 && 'bg-green-500/10'
      )}>
        <AnimatePresence mode="wait">
          {isSyncing ? (
            <motion.div
              key="syncing"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <RefreshCw className="h-5 w-5 text-primary" />
            </motion.div>
          ) : pendingCount > 0 ? (
            <CloudOff className="h-5 w-5 text-amber-500" />
          ) : (
            <Check className="h-5 w-5 text-green-500" />
          )}
        </AnimatePresence>
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {isSyncing 
            ? 'Sincronizando...' 
            : pendingCount > 0 
              ? `${pendingCount} pendente(s)` 
              : 'Sincronizado'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          Última sync: {formatLastSync(syncStatus.lastSyncAt)}
        </p>
      </div>

      {pendingCount > 0 && !isSyncing && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={syncNow}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Sincronizar
        </Button>
      )}
    </div>
  );
}
