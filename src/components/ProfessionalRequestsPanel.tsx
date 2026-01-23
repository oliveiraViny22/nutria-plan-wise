import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useObjectiveChangeRequests, ObjectiveChangeRequest } from '@/hooks/useObjectiveChangeRequests';
import { GOALS } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StudentProfile {
  name: string | null;
  email: string | null;
}

interface RequestWithStudent extends ObjectiveChangeRequest {
  student?: StudentProfile;
}

export function ProfessionalRequestsPanel() {
  const { loading, fetchProfessionalRequests, respondToRequest } = useObjectiveChangeRequests();
  const [requests, setRequests] = useState<RequestWithStudent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    setRefreshing(true);
    const data = await fetchProfessionalRequests();
    
    // Fetch student profiles for each request
    const enrichedRequests = await Promise.all(
      data.map(async (request) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('user_id', request.student_id)
          .single();
        
        return {
          ...request,
          student: profile || undefined,
        };
      })
    );
    
    setRequests(enrichedRequests);
    setRefreshing(false);
  };

  const handleResponse = async (requestId: string, status: 'approved' | 'rejected') => {
    setProcessingId(requestId);
    
    const success = await respondToRequest(
      requestId,
      status,
      responseText[requestId] || undefined
    );
    
    if (success) {
      await loadRequests();
      setExpandedId(null);
      setResponseText((prev) => ({ ...prev, [requestId]: '' }));
    }
    
    setProcessingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" />Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejeitada</Badge>;
      default:
        return null;
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const historyRequests = requests.filter(r => r.status !== 'pending');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Solicitações de Alteração
            </CardTitle>
            <CardDescription>
              Gerencie as solicitações de alteração de objetivo dos seus alunos
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadRequests}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && requests.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pendingRequests.length === 0 && historyRequests.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">Nenhuma solicitação encontrada</p>
            <p className="text-sm text-muted-foreground/70">
              As solicitações de alteração de objetivo dos seus alunos aparecerão aqui
            </p>
          </div>
        ) : (
          <>
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Pendentes ({pendingRequests.length})
                </h3>
                
                <AnimatePresence>
                  {pendingRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Collapsible
                        open={expandedId === request.id}
                        onOpenChange={(open) => setExpandedId(open ? request.id : null)}
                      >
                        <Card className="border-amber-500/30 bg-amber-500/5">
                          <CollapsibleTrigger className="w-full">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>
                                    {getInitials(request.student?.name)}
                                  </AvatarFallback>
                                </Avatar>
                                
                                <div className="flex-1 text-left">
                                  <p className="font-medium">
                                    {request.student?.name || 'Aluno'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {GOALS[request.current_goal as keyof typeof GOALS]?.label || request.current_goal}
                                    {' → '}
                                    <span className="font-medium text-primary">
                                      {GOALS[request.requested_goal as keyof typeof GOALS]?.label || request.requested_goal}
                                    </span>
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(request.status)}
                                  {expandedId === request.id ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="px-4 pb-4 pt-0 space-y-4 border-t">
                              <div className="pt-4 space-y-3">
                                <div>
                                  <p className="text-sm font-medium mb-1">Justificativa do aluno:</p>
                                  <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                                    {request.justification}
                                  </p>
                                </div>
                                
                                <div>
                                  <p className="text-sm font-medium mb-1 flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    Sua resposta (opcional):
                                  </p>
                                  <Textarea
                                    value={responseText[request.id] || ''}
                                    onChange={(e) => setResponseText((prev) => ({
                                      ...prev,
                                      [request.id]: e.target.value,
                                    }))}
                                    placeholder="Adicione uma mensagem para o aluno..."
                                    rows={2}
                                  />
                                </div>
                                
                                <div className="flex gap-2">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        className="flex-1 text-destructive hover:text-destructive"
                                        disabled={processingId === request.id}
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Rejeitar
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Rejeitar solicitação?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          O aluno será notificado que sua solicitação de alteração de objetivo foi rejeitada.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleResponse(request.id, 'rejected')}
                                          className="bg-destructive text-destructive-foreground"
                                        >
                                          Rejeitar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                  
                                  <Button
                                    className="flex-1"
                                    onClick={() => handleResponse(request.id, 'approved')}
                                    disabled={processingId === request.id}
                                  >
                                    {processingId === request.id ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                    )}
                                    Aprovar
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* History */}
            {historyRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Histórico ({historyRequests.length})
                </h3>
                
                <div className="space-y-2">
                  {historyRequests.slice(0, 5).map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(request.student?.name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {request.student?.name || 'Aluno'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(request.updated_at), "dd 'de' MMM", { locale: ptBR })}
                        </p>
                      </div>
                      
                      {getStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
