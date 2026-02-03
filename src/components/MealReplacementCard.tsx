/**
 * Componente que exibe substituições de refeição com suplementos + alimentos
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, 
  ChevronUp, 
  Pill, 
  Apple, 
  CheckCircle2,
  AlertCircle,
  Flame,
  Beef,
  Wheat,
  Droplets,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  calculateMealReplacement, 
  getAccuracyStatus,
  type MacroTarget,
  type MealReplacement,
} from '@/lib/meal-replacement-calculator';

interface MealReplacementCardProps {
  mealName: string;
  mealMacros: MacroTarget;
  userGoal: 'lose_weight' | 'maintain' | 'gain_muscle';
  defaultExpanded?: boolean;
}

export function MealReplacementCard({ 
  mealName, 
  mealMacros, 
  userGoal, 
  defaultExpanded = false 
}: MealReplacementCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const replacement = useMemo(
    () => calculateMealReplacement(mealMacros, userGoal),
    [mealMacros, userGoal]
  );

  const calorieStatus = getAccuracyStatus(replacement.accuracy.calories);
  const proteinStatus = getAccuracyStatus(replacement.accuracy.protein);

  const supplementCount = replacement.items.filter(i => i.type === 'supplement').length;
  const foodCount = replacement.items.filter(i => i.type === 'food').length;

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Pill className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Alternativa: {mealName}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-sm">
                            <strong>⚠️ Substitui a refeição inteira.</strong> Use esta alternativa 
                            EM VEZ da refeição planejada, não como complemento. 
                            Os macros são equivalentes à refeição original.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                      Substitui 100%
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-purple-500/10">
                      {supplementCount} suplemento{supplementCount !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-green-500/10">
                      {foodCount} alimento{foodCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Alerta de substituição */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Esta é uma alternativa completa.</strong> Consuma EM VEZ 
                de {mealName.toLowerCase()}, não junto. Os valores nutricionais são equivalentes.
              </p>
            </div>

            {/* Comparação de macros */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-background/60 border border-border/50">
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium line-through opacity-60">❌ Refeição Original</p>
                <div className="space-y-1 text-sm opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-500" /> Calorias</span>
                    <span className="font-medium">{mealMacros.calories} kcal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Beef className="w-3 h-3 text-blue-500" /> Proteína</span>
                    <span className="font-medium">{mealMacros.protein}g</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Wheat className="w-3 h-3 text-yellow-500" /> Carbos</span>
                    <span className="font-medium">{mealMacros.carbs}g</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-orange-500" /> Gordura</span>
                    <span className="font-medium">{mealMacros.fat}g</span>
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium text-green-600 dark:text-green-400">✅ Alternativa</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-amber-500" /> Calorias</span>
                    <span className="font-medium flex items-center gap-1">
                      {replacement.totalMacros.calories} kcal
                      <Badge variant={calorieStatus.variant} className="text-[8px] px-1">
                        {replacement.accuracy.calories}%
                      </Badge>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Beef className="w-3 h-3 text-blue-500" /> Proteína</span>
                    <span className="font-medium flex items-center gap-1">
                      {replacement.totalMacros.protein}g
                      <Badge variant={proteinStatus.variant} className="text-[8px] px-1">
                        {replacement.accuracy.protein}%
                      </Badge>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Wheat className="w-3 h-3 text-yellow-500" /> Carbos</span>
                    <span className="font-medium">{replacement.totalMacros.carbs}g</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-orange-500" /> Gordura</span>
                    <span className="font-medium">{replacement.totalMacros.fat}g</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de itens */}
            <div className="space-y-2">
              <p className="text-sm font-medium mb-2">Ingredientes da Substituição:</p>
              
              <AnimatePresence>
                {replacement.items.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border/50"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      item.type === 'supplement' ? 'bg-purple-500/20' : 'bg-green-500/20'
                    }`}>
                      {item.type === 'supplement' ? (
                        <Pill className="w-4 h-4 text-purple-500" />
                      ) : (
                        <Apple className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{item.name}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {item.quantity}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">
                          {item.macros.calories} kcal
                        </span>
                        <span className="text-[10px] text-blue-500">
                          P: {item.macros.protein}g
                        </span>
                        <span className="text-[10px] text-yellow-500">
                          C: {item.macros.carbs}g
                        </span>
                        <span className="text-[10px] text-orange-500">
                          G: {item.macros.fat}g
                        </span>
                      </div>
                      
                      {item.reason && (
                        <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                          <p className="text-[10px] font-medium text-primary">
                            {item.reason}
                          </p>
                        </div>
                      )}
                      
                      {item.notes && !item.reason && (
                        <p className="text-[10px] text-muted-foreground mt-1 italic">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Dicas */}
            {replacement.tips.length > 0 && (
              <div className="space-y-1 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {replacement.tips.map((tip, idx) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    {tip}
                  </p>
                ))}
              </div>
            )}

            {/* Modo de preparo */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs font-medium mb-1">🥤 Modo de Preparo Sugerido:</p>
              <p className="text-xs text-muted-foreground">
                {supplementCount > 0 ? (
                  <>
                    Bata o whey com o leite em um liquidificador ou coqueteleira. 
                    {foodCount > 0 && ' Adicione os alimentos sólidos (banana, aveia) e bata até ficar homogêneo.'}
                    {replacement.items.some(i => i.name.includes('Pasta de Amendoim')) && ' Acrescente a pasta de amendoim por cima ou misture.'}
                  </>
                ) : (
                  'Combine os alimentos em um bowl ou consuma separadamente conforme preferência.'
                )}
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/**
 * Container para exibir todas as substituições de refeição
 */
interface MealReplacementSectionProps {
  meals: Array<{
    name: string;
    macros: MacroTarget;
  }>;
  userGoal: 'lose_weight' | 'maintain' | 'gain_muscle';
}

export function MealReplacementSection({ meals, userGoal }: MealReplacementSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (meals.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Pill className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-semibold">Alternativas de Refeição</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                <strong>Opções para substituir refeições inteiras</strong> quando você não conseguir 
                consumir a refeição planejada. Use EM VEZ da refeição, não como complemento.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="space-y-3">
        {meals.map((meal, idx) => (
          <MealReplacementCard
            key={idx}
            mealName={meal.name}
            mealMacros={meal.macros}
            userGoal={userGoal}
            defaultExpanded={expandedIndex === idx}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground italic mt-4">
        ⚠️ <strong>Use estas alternativas EM VEZ da refeição planejada</strong>, não como complemento. 
        São aproximações nutricionais. Consulte um nutricionista para personalizações específicas.
      </p>
    </div>
  );
}
