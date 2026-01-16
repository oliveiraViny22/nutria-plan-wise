import { useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StudentRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REQUEST_TYPES = [
  { value: 'goal_change', label: 'Mudança de objetivo' },
  { value: 'meals_change', label: 'Ajuste de refeições' },
  { value: 'food_substitution', label: 'Substituição de alimentos' },
];

export function StudentRequestDialog({ open, onOpenChange }: StudentRequestDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requestType, setRequestType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');

  const handleSubmit = async () => {
    if (!requestType || !description.trim() || !justification.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (!profile?.professional_id) {
      toast.error('Você não está vinculado a um profissional');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('student_requests').insert({
        student_id: profile.user_id,
        professional_id: profile.professional_id,
        request_type: requestType,
        description: description.trim(),
        justification: justification.trim(),
      });

      if (error) throw error;

      toast.success('Solicitação enviada com sucesso!');
      onOpenChange(false);
      setRequestType('');
      setDescription('');
      setJustification('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Solicitação</DialogTitle>
          <DialogDescription>
            Seu nutricionista receberá sua solicitação e poderá aprovar ou rejeitar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de solicitação *</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {REQUEST_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição da solicitação *</Label>
            <Textarea
              placeholder="Descreva o que você gostaria de mudar..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Justificativa *</Label>
            <Textarea
              placeholder="Explique por que você precisa dessa mudança..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
