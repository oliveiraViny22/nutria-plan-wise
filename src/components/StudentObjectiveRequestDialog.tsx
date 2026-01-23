import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Send, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useObjectiveChangeRequests, ObjectiveChangeRequest } from '@/hooks/useObjectiveChangeRequests';
import { GOALS } from '@/lib/types';

interface StudentObjectiveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGoal: string | null;
  professionalId: string;
}

export function StudentObjectiveRequestDialog({
  open,
  onOpenChange,
  currentGoal,
  professionalId,
}: StudentObjectiveRequestDialogProps) {
  const { loading, createRequest, getPendingRequest } = useObjectiveChangeRequests();
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [pendingRequest, setPendingRequest] = useState<ObjectiveChangeRequest | null>(null);
  const [checkingPending, setCheckingPending] = useState(true);

  useEffect(() => {
    if (open) {
      setSelectedGoal('');
      setJustification('');
      setCheckingPending(true);
      
      getPendingRequest().then((request) => {
        setPendingRequest(request);
        setCheckingPending(false);
      });
    }
  }, [open, getPendingRequest]);

  const handleSubmit = async () => {
    if (!selectedGoal || !justification.trim() || !currentGoal) return;

    const success = await createRequest(
      professionalId,
      currentGoal,
      selectedGoal,
      justification.trim()
    );

    if (success) {
      onOpenChange(false);
    }
  };

  const availableGoals = Object.entries(GOALS).filter(([key]) => key !== currentGoal);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Aprovada</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitada</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Solicitar Alteração de Objetivo
          </DialogTitle>
          <DialogDescription>
            Envie uma solicitação ao seu profissional para alterar seu objetivo.
          </DialogDescription>
        </DialogHeader>

        {checkingPending ? (
          <div className="flex flex-col items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Verificando solicitações...</p>
          </div>
        ) : pendingRequest ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>Solicitação pendente</AlertTitle>
              <AlertDescription>
                Você já possui uma solicitação aguardando resposta do profissional.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(pendingRequest.status)}
              </div>
              
              <div className="space-y-1">
                <span className="text-sm font-medium">Objetivo solicitado</span>
                <p className="text-sm text-muted-foreground">
                  {GOALS[pendingRequest.requested_goal as keyof typeof GOALS]?.label || pendingRequest.requested_goal}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-sm font-medium">Justificativa</span>
                <p className="text-sm text-muted-foreground">
                  {pendingRequest.justification}
                </p>
              </div>

              <div className="text-xs text-muted-foreground">
                Enviada em {new Date(pendingRequest.created_at).toLocaleDateString('pt-BR')}
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Objetivo atual</Label>
              <p className="text-sm font-medium text-primary">
                {currentGoal ? GOALS[currentGoal as keyof typeof GOALS]?.label : 'Não definido'}
              </p>
            </div>

            <div className="space-y-3">
              <Label>Novo objetivo desejado</Label>
              <RadioGroup value={selectedGoal} onValueChange={setSelectedGoal}>
                {availableGoals.map(([key, goal]) => (
                  <div
                    key={key}
                    className="flex items-center space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => setSelectedGoal(key)}
                  >
                    <RadioGroupItem value={key} id={`student-${key}`} />
                    <Label htmlFor={`student-${key}`} className="flex-1 cursor-pointer">
                      <span className="font-medium">{goal.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justification">
                Justificativa <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="justification"
                placeholder="Explique por que deseja alterar seu objetivo..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Descreva o motivo da alteração para ajudar seu profissional a avaliar.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedGoal || !justification.trim() || loading}
                onClick={handleSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar Solicitação
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
