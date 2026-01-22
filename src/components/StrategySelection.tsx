// =====================================================
// COMPONENTE DE SELEÇÃO DE ESTRATÉGIAS
// =====================================================
// Exibe as estratégias sugeridas pela IA para o usuário
// escolher. Cada estratégia é apresentada de forma clara
// e com impacto esperado.
// =====================================================

import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Shuffle,
  Plus,
  Clock,
  User,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { AIStrategy, AIStrategiesResponse } from '@/lib/rebalancer-types';

// =====================================================
// ÍCONES E CORES POR TIPO DE ESTRATÉGIA
// =====================================================

const STRATEGY_ICONS: Record<string, typeof RefreshCw> = {
  redistribute_meals: RefreshCw,
  substitute_within_category: Shuffle,
  add_complementary_option: Plus,
  reduce_meal_complexity: Clock,
  adjust_meal_timing: Clock,
  professional_guidance: User,
};

const STRATEGY_COLORS: Record<string, string> = {
  redistribute_meals: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  substitute_within_category: 'bg-green-500/10 text-green-600 border-green-500/20',
  add_complementary_option: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  reduce_meal_complexity: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  adjust_meal_timing: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  professional_guidance: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
};

const IMPACT_BADGES: Record<string, { label: string; className: string }> = {
  low: { label: 'Impacto Baixo', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  medium: { label: 'Impacto Médio', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  high: { label: 'Impacto Alto', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

// =====================================================
// COMPONENTE DE CARD DE ESTRATÉGIA
// =====================================================

interface StrategyCardProps {
  strategy: AIStrategy;
  index: number;
  onSelect: (strategy: AIStrategy) => void;
  disabled?: boolean;
}

function StrategyCard({ strategy, index, onSelect, disabled }: StrategyCardProps) {
  const Icon = STRATEGY_ICONS[strategy.type] || RefreshCw;
  const colorClass = STRATEGY_COLORS[strategy.type] || STRATEGY_COLORS.redistribute_meals;
  const impactBadge = IMPACT_BADGES[strategy.expectedImpact] || IMPACT_BADGES.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/50 ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
        onClick={() => !disabled && onSelect(strategy)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className={`p-2 rounded-lg border ${colorClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex gap-2">
              {strategy.requiresSupplement && (
                <Badge variant="outline" className="text-xs">
                  Suplemento
                </Badge>
              )}
              <Badge className={`text-xs ${impactBadge.className}`}>
                {impactBadge.label}
              </Badge>
            </div>
          </div>
          <CardTitle className="text-base mt-2">{strategy.title}</CardTitle>
          <CardDescription className="text-sm">
            {strategy.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Considerações */}
          {strategy.considerations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Considerações
              </p>
              <ul className="space-y-1">
                {strategy.considerations.map((consideration, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    {consideration}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Refeições afetadas */}
          {strategy.targetMeals && strategy.targetMeals.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {strategy.targetMeals.map((meal) => (
                <Badge key={meal} variant="secondary" className="text-xs">
                  {meal}
                </Badge>
              ))}
            </div>
          )}

          {/* Botão de seleção */}
          <Button 
            className="w-full mt-4 gap-2" 
            variant="outline"
            disabled={disabled || strategy.requiresProfessional}
          >
            {strategy.requiresProfessional ? (
              <>
                <User className="w-4 h-4" />
                Requer Profissional
              </>
            ) : (
              <>
                Selecionar Estratégia
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

interface StrategySelectionProps {
  strategies: AIStrategiesResponse;
  onSelectStrategy: (strategy: AIStrategy) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function StrategySelection({
  strategies,
  onSelectStrategy,
  onCancel,
  loading,
}: StrategySelectionProps) {
  return (
    <div className="space-y-4">
      {/* Análise da falha */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {strategies.failureAnalysis}
        </AlertDescription>
      </Alert>

      {/* Se não há estratégia viável */}
      {strategies.noViableStrategy && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Nenhuma estratégia automática viável</p>
            <p className="text-sm">{strategies.noViableReason}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Lista de estratégias */}
      <AnimatePresence>
        <div className="grid gap-4">
          {strategies.strategies.map((strategy, index) => (
            <StrategyCard
              key={strategy.type}
              strategy={strategy}
              index={index}
              onSelect={onSelectStrategy}
              disabled={loading}
            />
          ))}
        </div>
      </AnimatePresence>

      {/* Recomendação geral */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
        <CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Recomendação: </span>
          {strategies.recommendation}
        </p>
      </div>

      {/* Botão cancelar */}
      <Button 
        variant="ghost" 
        className="w-full" 
        onClick={onCancel}
        disabled={loading}
      >
        Cancelar
      </Button>
    </div>
  );
}
