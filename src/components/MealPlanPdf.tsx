 import { useState } from 'react';
 import { FileText, Download, Loader2 } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from '@/components/ui/dialog';
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
 
   const handleGeneratePdf = async () => {
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
         a.download = `plano-alimentar-executivo.html`;
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         URL.revokeObjectURL(url);
 
         toast.success('Relatório baixado', {
           description: 'Abra o arquivo HTML e use Ctrl+P para salvar como PDF.',
         });
       }
 
       setOpen(false);
 
       toast.success('PDF Executivo gerado', {
         description: 'Use Ctrl+P ou ⌘+P para salvar como PDF.',
       });
     } catch (error: any) {
       console.error('Error generating PDF:', error);
       toast.error('Erro ao gerar PDF', {
         description: error.message || 'Não foi possível gerar o relatório.',
       });
     } finally {
       setLoading(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={setOpen}>
       <DialogTrigger asChild>
         <Button variant={variant} size={size} className="gap-2">
           <FileText className="h-4 w-4" />
           PDF Executivo
         </Button>
       </DialogTrigger>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <FileText className="h-5 w-5 text-primary" />
             Gerar PDF Executivo
           </DialogTitle>
           <DialogDescription>
             Formato profissional com todas as informações do plano alimentar.
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
             <p className="text-sm font-medium mb-2">O PDF inclui:</p>
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
             O documento será gerado em formato <strong>Executivo</strong>, 
             ideal para impressão profissional.
           </p>
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