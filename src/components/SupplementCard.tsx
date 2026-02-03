import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pill, ChevronDown, ChevronUp, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Supplement {
  name: string;
  dosage: string;
  timing: string;
  benefit: string;
  priority: 'essential' | 'recommended' | 'optional';
}

interface SupplementSuggestion {
  mealType: string;
  supplements: Supplement[];
  reasoning: string;
}

interface SupplementCardProps {
  mealType: string;
  goal: string;
  mealName: string;
  dailyCalories?: number;
  proteinTarget?: number;
}

const PRIORITY_STYLES = {
  essential: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  recommended: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  optional: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABELS = {
  essential: 'Essencial',
  recommended: 'Recomendado',
  optional: 'Opcional',
};

export function SupplementCard({ 
  mealType, 
  goal, 
  mealName,
  dailyCalories,
  proteinTarget,
}: SupplementCardProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<SupplementSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchSuggestions = async () => {
    if (!user || hasFetched) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('suggest-supplements', {
        body: { 
          mealType,
          goal,
          dailyCalories,
          proteinTarget,
        },
      });

      if (fnError) throw fnError;
      
      if (data?.suggestion) {
        setSuggestion(data.suggestion);
      }
      setHasFetched(true);
    } catch (err: any) {
      console.error('Error fetching supplement suggestions:', err);
      setError(err.message || 'Erro ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  };

  // Fetch when opened for the first time
  useEffect(() => {
    if (isOpen && !hasFetched && !loading) {
      fetchSuggestions();
    }
  }, [isOpen]);

  if (!goal) return null;

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Pill className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Suplementação Sugerida
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      <Sparkles className="h-3 w-3 mr-1" />
                      IA
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Complementar ao {mealName}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-6"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-purple-500 mr-2" />
                  <span className="text-sm text-muted-foreground">Gerando sugestões...</span>
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 py-4 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setHasFetched(false); fetchSuggestions(); }}>
                    Tentar novamente
                  </Button>
                </motion.div>
              ) : suggestion ? (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  {suggestion.supplements.map((supp, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-background/60 border border-border/50 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm">{supp.name}</h4>
                          <p className="text-xs text-muted-foreground">{supp.dosage}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] shrink-0 ${PRIORITY_STYLES[supp.priority]}`}
                        >
                          {PRIORITY_LABELS[supp.priority]}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="text-muted-foreground">
                          ⏰ {supp.timing}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {supp.benefit}
                      </p>
                    </div>
                  ))}

                  {suggestion.reasoning && (
                    <p className="text-xs text-muted-foreground italic pt-2 border-t">
                      💡 {suggestion.reasoning}
                    </p>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-4 text-sm text-muted-foreground"
                >
                  Nenhuma sugestão disponível para esta refeição
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
