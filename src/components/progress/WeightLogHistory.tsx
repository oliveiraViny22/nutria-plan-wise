import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit2, Check, X, Loader2, Scale, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WeightLog {
  id: string;
  weight_kg: number;
  log_date: string;
}

interface WeightLogHistoryProps {
  logs: WeightLog[];
  userId: string;
  onUpdate: () => void;
}

export function WeightLogHistory({ logs, userId, onUpdate }: WeightLogHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEdit = (log: WeightLog) => {
    setEditingId(log.id);
    setEditValue(log.weight_kg.toString());
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleSaveEdit = async (logId: string) => {
    const weightValue = parseFloat(editValue);
    if (isNaN(weightValue) || weightValue <= 0 || weightValue > 500) {
      toast.error('Por favor, insira um peso válido');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('weight_logs')
        .update({ weight_kg: weightValue })
        .eq('id', logId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Peso atualizado com sucesso!');
      setEditingId(null);
      setEditValue('');
      onUpdate();
    } catch (error) {
      console.error('Error updating weight:', error);
      toast.error('Erro ao atualizar peso');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (logId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('weight_logs')
        .delete()
        .eq('id', logId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Registro excluído com sucesso!');
      onUpdate();
    } catch (error) {
      console.error('Error deleting weight:', error);
      toast.error('Erro ao excluir registro');
    } finally {
      setLoading(false);
    }
  };

  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  );

  return (
    <Card className="backdrop-blur-md bg-card/80 border-border/40 shadow-lg">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" />
          Histórico de Peso
        </CardTitle>
        <CardDescription>
          Gerencie seus registros de peso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Important info alert */}
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            <strong>Dica:</strong> Para ver o gráfico de evolução, registre seu peso em <strong>datas diferentes</strong>. 
            Quanto mais registros você tiver, mais preciso será o acompanhamento do seu progresso.
          </AlertDescription>
        </Alert>

        {logs.length === 0 ? (
          <div className="text-center py-8">
            <Scale className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhum registro de peso encontrado
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Registre seu peso regularmente para acompanhar sua evolução
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            <AnimatePresence>
              {sortedLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center justify-between py-3 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Scale className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {format(new Date(log.log_date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                      </p>
                      {editingId === log.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            step="0.1"
                            min="20"
                            max="500"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-20 h-7 text-sm"
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground">kg</span>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {log.weight_kg.toFixed(1)} kg
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {editingId === log.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={handleCancelEdit}
                          disabled={loading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSaveEdit(log.id)}
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleEdit(log)}
                          disabled={loading}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir o registro de peso de{' '}
                                <strong>{log.weight_kg.toFixed(1)} kg</strong> do dia{' '}
                                <strong>{format(new Date(log.log_date), "dd/MM/yyyy", { locale: ptBR })}</strong>?
                                <br /><br />
                                Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(log.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        
        {logs.length === 1 && (
          <Alert className="bg-warning/10 border-warning/30">
            <Info className="h-4 w-4 text-warning" />
            <AlertDescription className="text-sm text-warning-foreground">
              Você tem apenas <strong>1 registro</strong>. Adicione mais registros em datas diferentes para visualizar o gráfico de evolução do seu peso.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
