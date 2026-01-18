import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertCircle,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AISuggestion {
  id: string;
  suggestion_type: string;
  hypothesis: string;
  rationale: string;
  proposed_changes: any;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDITED';
  created_at: string;
  reviewed_at?: string;
  review_notes?: string;
}

interface AISuggestionsReviewProps {
  studentId: string;
  dietPlanId: string;
  onSuggestionApplied?: () => void;
}

const SUGGESTION_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ADD_OPTION: { label: 'Adicionar Opção', icon: <Sparkles className="h-4 w-4" />, color: 'bg-green-500/10 text-green-600' },
  REMOVE_OPTION: { label: 'Remover Opção', icon: <X className="h-4 w-4" />, color: 'bg-red-500/10 text-red-600' },
  SIMPLIFY_OPTION: { label: 'Simplificar Plano', icon: <Edit2 className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-600' },
  ADJUST_SCHEDULE: { label: 'Revisar Horários', icon: <Clock className="h-4 w-4" />, color: 'bg-orange-500/10 text-orange-600' },
  REDUCE_MEALS: { label: 'Avaliar Refeição', icon: <AlertCircle className="h-4 w-4" />, color: 'bg-yellow-500/10 text-yellow-600' },
  REORGANIZE_MEALS: { label: 'Reorganizar Plano', icon: <RefreshCw className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-600' },
  CONTEXTUAL_OPTION: { label: 'Adicionar Alternativa', icon: <Lightbulb className="h-4 w-4" />, color: 'bg-cyan-500/10 text-cyan-600' },
};

// Função para formatar mudanças propostas de forma amigável e orientada à ação
const formatProposedChanges = (changes: any): string => {
  if (!changes) return '';
  
  const lines: string[] = [];
  
  // Prioriza a recomendação se existir
  if (changes.recommendation) {
    lines.push(`**Recomendação:** ${changes.recommendation}`);
  }
  
  if (changes.meal_name) {
    lines.push(`**Refeição:** ${changes.meal_name}`);
  }
  
  // Lista opções não utilizadas explicitamente
  if (changes.unused_options && Array.isArray(changes.unused_options)) {
    if (changes.unused_options.length === 1) {
      lines.push(`**Opção não utilizada:** ${changes.unused_options[0]}`);
    } else {
      lines.push(`**Opções não utilizadas:**`);
      changes.unused_options.forEach((opt: string) => {
        lines.push(`  • ${opt}`);
      });
    }
  }
  
  // Opção preferida pelo paciente
  if (changes.preferred_option) {
    lines.push(`**Opção preferida:** ${changes.preferred_option}`);
  }
  
  if (changes.redistribute_calories) {
    lines.push('• As calorias serão redistribuídas entre as demais refeições');
  }
  
  if (changes.target_meals) {
    lines.push(`• Sugestão: ${changes.target_meals} refeições principais`);
  }
  
  if (changes.target_options_per_meal) {
    lines.push(`• Sugestão: ${changes.target_options_per_meal} opção por refeição`);
  }
  
  if (changes.late_confirmation_rate) {
    lines.push(`• ${changes.late_confirmation_rate}% das confirmações foram tardias`);
  }
  
  if (changes.context === 'practical_alternative') {
    lines.push('• Adicionar opção mais prática para o dia a dia');
  }
  
  if (changes.details && typeof changes.details === 'string') {
    lines.push(`\n${changes.details}`);
  }
  
  return lines.join('\n');
};

export function AISuggestionsReview({ studentId, dietPlanId, onSuggestionApplied }: AISuggestionsReviewProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'EDIT' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_suggestions')
        .select('*')
        .eq('user_id', studentId)
        .eq('diet_plan_id', dietPlanId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions((data as AISuggestion[]) || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as sugestões.',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-plan-suggestions', {
        body: { studentId, dietPlanId },
      });

      if (error) throw error;

      toast({
        title: 'Sugestões geradas!',
        description: `${data.suggestions?.length || 0} sugestões baseadas nos padrões de adesão.`,
      });

      await fetchSuggestions();
    } catch (error: any) {
      console.error('Error generating suggestions:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível gerar sugestões.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleReview = async () => {
    if (!reviewingId || !reviewAction) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('review-suggestion', {
        body: {
          suggestionId: reviewingId,
          action: reviewAction,
          reviewNotes: reviewNotes || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: data.message,
      });

      setReviewingId(null);
      setReviewAction(null);
      setReviewNotes('');
      await fetchSuggestions();
      
      if (reviewAction === 'APPROVE' && onSuggestionApplied) {
        onSuggestionApplied();
      }
    } catch (error: any) {
      console.error('Error reviewing suggestion:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível processar a revisão.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewDialog = (suggestionId: string, action: 'APPROVE' | 'REJECT' | 'EDIT') => {
    setReviewingId(suggestionId);
    setReviewAction(action);
    setReviewNotes('');
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'PENDING');
  const reviewedSuggestions = suggestions.filter(s => s.status !== 'PENDING');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões da IA
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Propostas baseadas em padrões de adesão
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateSuggestions}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-2">
              {generating ? 'Analisando...' : 'Analisar'}
            </span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma sugestão disponível</p>
            <p className="text-xs mt-1">Clique em "Analisar" para gerar sugestões</p>
          </div>
        ) : (
          <>
            {/* Pending Suggestions */}
            {pendingSuggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
                    {pendingSuggestions.length}
                  </Badge>
                  Pendentes de Revisão
                </h4>

                <AnimatePresence mode="popLayout">
                  {pendingSuggestions.map((suggestion, index) => {
                    const typeInfo = SUGGESTION_TYPE_LABELS[suggestion.suggestion_type] || {
                      label: suggestion.suggestion_type,
                      icon: <Sparkles className="h-4 w-4" />,
                      color: 'bg-gray-500/10 text-gray-600',
                    };
                    const isExpanded = expandedId === suggestion.id;

                    return (
                      <motion.div
                        key={suggestion.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Collapsible open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : suggestion.id)}>
                          <Card className="border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10">
                            <CollapsibleTrigger asChild>
                              <CardContent className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                                    {typeInfo.icon}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge variant="secondary" className="text-[10px]">
                                        {typeInfo.label}
                                      </Badge>
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDate(suggestion.created_at)}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium line-clamp-2">
                                      {suggestion.hypothesis}
                                    </p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </CollapsibleTrigger>

                            <CollapsibleContent>
                              <CardContent className="pt-0 space-y-4">
                                <div className="border-t pt-3">
                                  <h5 className="text-xs font-medium text-muted-foreground mb-2">
                                    Fundamentação
                                  </h5>
                                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                                    {suggestion.rationale}
                                  </p>
                                </div>

                                {suggestion.proposed_changes && (
                                  <div>
                                    <h5 className="text-xs font-medium text-muted-foreground mb-2">
                                      Mudanças Propostas
                                    </h5>
                                    <div className="text-sm bg-muted p-3 rounded-lg space-y-1">
                                      {formatProposedChanges(suggestion.proposed_changes).split('\n').map((line, idx) => (
                                        <p key={idx} className="text-foreground/80">
                                          {line.startsWith('**') ? (
                                            <span>
                                              <strong className="text-foreground">{line.replace(/\*\*/g, '').split(':')[0]}:</strong>
                                              {line.replace(/\*\*/g, '').split(':').slice(1).join(':')}
                                            </span>
                                          ) : line.startsWith('•') ? (
                                            <span className="text-muted-foreground">{line}</span>
                                          ) : (
                                            line
                                          )}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="flex-1"
                                    onClick={() => openReviewDialog(suggestion.id, 'APPROVE')}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Aprovar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => openReviewDialog(suggestion.id, 'REJECT')}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Rejeitar
                                  </Button>
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Reviewed Suggestions */}
            {reviewedSuggestions.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {reviewedSuggestions.length}
                      </Badge>
                      Sugestões Revisadas
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {reviewedSuggestions.map((suggestion) => {
                    const typeInfo = SUGGESTION_TYPE_LABELS[suggestion.suggestion_type] || {
                      label: suggestion.suggestion_type,
                      icon: <Sparkles className="h-4 w-4" />,
                      color: 'bg-gray-500/10 text-gray-600',
                    };

                    return (
                      <Card 
                        key={suggestion.id} 
                        className={`opacity-60 ${
                          suggestion.status === 'APPROVED' ? 'border-green-200' :
                          suggestion.status === 'REJECTED' ? 'border-red-200' : ''
                        }`}
                      >
                        <CardContent className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={suggestion.status === 'APPROVED' ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {suggestion.status === 'APPROVED' ? 'Aprovada' :
                               suggestion.status === 'REJECTED' ? 'Rejeitada' : 'Editada'}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex-1 truncate">
                              {suggestion.hypothesis}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </CardContent>

      {/* Review Dialog */}
      <Dialog open={!!reviewingId} onOpenChange={() => setReviewingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'APPROVE' ? 'Aprovar Sugestão' :
               reviewAction === 'REJECT' ? 'Rejeitar Sugestão' : 'Editar Sugestão'}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === 'APPROVE' 
                ? 'Ao aprovar, as mudanças serão aplicadas e uma nova versão do plano será criada.'
                : reviewAction === 'REJECT'
                ? 'A sugestão será marcada como rejeitada e não será aplicada.'
                : 'Você pode editar as mudanças propostas antes de aplicar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                Observações (opcional)
              </label>
              <Textarea
                placeholder="Adicione notas sobre sua decisão..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewingId(null)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              variant={reviewAction === 'APPROVE' ? 'default' : 'secondary'}
              onClick={handleReview}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : reviewAction === 'APPROVE' ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              {reviewAction === 'APPROVE' ? 'Confirmar Aprovação' :
               reviewAction === 'REJECT' ? 'Confirmar Rejeição' : 'Aplicar Edição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
