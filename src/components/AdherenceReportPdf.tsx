import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AdherenceReportPdfProps {
  studentId?: string;
  dietPlanId: string;
  studentName?: string;
}

export function AdherenceReportPdf({ studentId, dietPlanId, studentName }: AdherenceReportPdfProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getPeriodDates = () => {
    if (period === 'custom') {
      return {
        periodStart: customStart,
        periodEnd: customEnd,
      };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    return {
      periodStart: startDate.toISOString().split('T')[0],
      periodEnd: endDate.toISOString().split('T')[0],
    };
  };

  const handleGeneratePdf = async () => {
    const { periodStart, periodEnd } = getPeriodDates();

    if (!periodStart || !periodEnd) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Selecione o período para gerar o relatório.',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-adherence-pdf', {
        body: {
          studentId,
          dietPlanId,
          periodStart,
          periodEnd,
        },
      });

      if (error) throw error;

      if (!data?.html) {
        throw new Error('Nenhum conteúdo gerado');
      }

      // Open print dialog with HTML content
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      } else {
        // Fallback: download as HTML
        const blob = new Blob([data.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-adesao-${periodStart}-${periodEnd}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Relatório baixado',
          description: 'Abra o arquivo HTML e use Ctrl+P para salvar como PDF.',
        });
      }

      setOpen(false);

      toast({
        title: 'Relatório gerado',
        description: 'Use Ctrl+P ou ⌘+P para salvar como PDF.',
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message || 'Não foi possível gerar o relatório.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Relatório de Adesão
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {studentName && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm">
                <span className="text-muted-foreground">Aluno:</span>{' '}
                <span className="font-medium">{studentName}</span>
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="14">Últimos 14 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="custom">Período personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  max={customEnd || new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              O relatório será gerado com base exclusivamente nos registros reais de consumo.
              Após gerado, os dados são imutáveis (snapshot do período).
            </AlertDescription>
          </Alert>

          <Card className="border-dashed">
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>O relatório inclui:</strong></p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Taxa de adesão geral com barra visual</li>
                  <li>Resumo numérico de refeições</li>
                  <li>Gráficos de adesão por refeição*</li>
                  <li>Distribuição de estados (confirmada, pulada, etc.)*</li>
                  <li>Insights automáticos*</li>
                  <li>Comparativo de períodos*</li>
                  <li>Sugestões práticas*</li>
                </ul>
                <p className="text-[10px] italic mt-2">
                  * Disponibilidade varia conforme o plano
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleGeneratePdf} disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Gerar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
