import { useState } from 'react';
import { Printer, Loader2, Share2, Mail, MessageCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MealPlanPdfProps {
  studentId?: string;
  dietPlanId?: string;
  studentName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function MealPlanPdf({ 
  studentId, 
  dietPlanId, 
  studentName,
  variant = 'outline',
  size = 'sm',
}: MealPlanPdfProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePrint = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-meal-plan-pdf', {
        body: {
          studentId,
          dietPlanId,
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
        a.download = `plano-alimentar.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Relatório baixado', {
          description: 'Abra o arquivo HTML e use Ctrl+P para imprimir.',
        });
      }

      setOpen(false);

      toast.success('Documento gerado', {
        description: 'Use Ctrl+P ou ⌘+P para salvar como PDF.',
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar documento', {
        description: error.message || 'Não foi possível gerar o relatório.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = () => {
    return window.location.href;
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(`Plano Alimentar${studentName ? ` - ${studentName}` : ''}`);
    const body = encodeURIComponent(`Confira o plano alimentar:\n\n${getShareUrl()}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast.success('E-mail aberto');
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Confira o plano alimentar${studentName ? ` de ${studentName}` : ''}:\n${getShareUrl()}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    toast.success('WhatsApp aberto');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar link');
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Plano Alimentar${studentName ? ` - ${studentName}` : ''}`,
          text: 'Confira o plano alimentar',
          url: getShareUrl(),
        });
        toast.success('Compartilhado!');
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          toast.error('Erro ao compartilhar');
        }
      }
    }
  };

  return (
    <div className="flex gap-1.5">
      {/* Print Button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="default" 
            size={size} 
            className="gap-2 bg-primary hover:bg-primary/90 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Imprimir Plano Alimentar
            </DialogTitle>
            <DialogDescription>
              Formato profissional otimizado para impressão A4.
            </DialogDescription>
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

            <div className="p-4 rounded-lg border border-dashed">
              <p className="text-sm font-medium mb-2">O documento inclui:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Dados pessoais (nome, idade, peso, altura)</li>
                <li>• Objetivo nutricional</li>
                <li>• Metas de calorias e macronutrientes</li>
                <li>• Balanço calórico (superávit/déficit)</li>
                <li>• Todas as refeições com opções</li>
                <li>• Dicas personalizadas para o objetivo</li>
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Use <strong>Ctrl+P</strong> (ou <strong>⌘+P</strong> no Mac) para salvar como PDF.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handlePrint} disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="secondary" 
            size={size} 
            className="gap-2 shadow-sm"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {navigator.share && (
            <DropdownMenuItem onClick={handleNativeShare} className="gap-2">
              <Share2 className="h-4 w-4" />
              Compartilhar
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={shareViaWhatsApp} className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={shareViaEmail} className="gap-2">
            <Mail className="h-4 w-4" />
            E-mail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}