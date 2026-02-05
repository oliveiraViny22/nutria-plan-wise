import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Flame, Target, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MetricCard } from '@/components/ui-kit';
import { HydrationCard } from '@/components/HydrationCard';
import type { UserGoal } from '@/lib/hydration-recommendations';
import { cn } from '@/lib/utils';

interface MetabolicData {
  bmr: number;
  tdee: number;
}

interface CollapsibleMetricsProps {
  metabolicData: MetabolicData | null;
  weight?: number | null;
  goal?: string | null;
  className?: string;
}

const STORAGE_KEY = 'nutriplan-metrics-collapsed';

export function CollapsibleMetrics({
  metabolicData,
  weight,
  goal,
  className,
}: CollapsibleMetricsProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  if (!metabolicData) return null;

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Metabolismo Base
          </h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[250px]">
                <p className="text-xs">
                  Valores calculados com base no seu perfil usando a fórmula Mifflin-St Jeor.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCollapse}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {isCollapsed ? (
            <>
              <span className="hidden sm:inline mr-1">Expandir</span>
              <ChevronDown className="h-4 w-4" />
            </>
          ) : (
            <>
              <span className="hidden sm:inline mr-1">Recolher</span>
              <ChevronUp className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>

      {/* Collapsed summary */}
      <AnimatePresence mode="wait">
        {isCollapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-4 px-3 py-2 bg-muted/30 rounded-lg text-sm"
          >
            <div className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-calories" />
              <span className="text-muted-foreground">TMB:</span>
              <span className="font-medium">{metabolicData.bmr} kcal</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-success" />
              <span className="text-muted-foreground">TDEE:</span>
              <span className="font-medium">{metabolicData.tdee} kcal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">💧</span>
              <span className="font-medium">{((weight || 70) * 0.04).toFixed(1)}L</span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <MetricCard
                        label="Taxa Metabólica Basal"
                        value={metabolicData.bmr}
                        unit="kcal"
                        icon={<Flame className="h-4 w-4" />}
                        color="calories"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] p-3">
                    <p className="font-semibold mb-1">TMB - Taxa Metabólica Basal</p>
                    <p className="text-sm">Calorias que seu corpo queima em repouso para manter funções vitais.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <MetricCard
                        label="Gasto Energético Total"
                        value={metabolicData.tdee}
                        unit="kcal"
                        icon={<Target className="h-4 w-4" />}
                        color="success"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] p-3">
                    <p className="font-semibold mb-1">TDEE - Gasto Energético Total</p>
                    <p className="text-sm">Total de calorias que você gasta por dia, incluindo atividades físicas.</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <HydrationCard 
                        weight={weight} 
                        goal={(goal as UserGoal) || 'maintain'}
                        variant="metric"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[300px] p-3">
                    <p className="font-semibold mb-1">💧 Hidratação Personalizada</p>
                    <p className="text-sm mb-2">
                      Calculado com base no seu peso ({weight || 70}kg × 35ml) 
                      {goal === 'lose_weight' && ' + 15% para metabolismo.'}
                      {goal === 'gain_muscle' && ' + 20% para recuperação.'}
                      {goal === 'maintain' && ' para equilíbrio hídrico.'}
                    </p>
                    <p className="text-xs text-muted-foreground italic">
                      Ajuste conforme atividade física e clima.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
