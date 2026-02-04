/**
 * Admin Documentation Tab Component
 * 
 * Provides access to technical and commercial documentation
 */

import { 
  BookOpen, 
  FileText, 
  Briefcase,
  Code,
  Sparkles,
  Download,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdminDocsTabProps {
  downloadingDoc: string | null;
  onDownloadDocumentation: (type: 'technical' | 'commercial') => void;
  onDownloadCode: () => void;
}

export function AdminDocsTab({
  downloadingDoc,
  onDownloadDocumentation,
  onDownloadCode,
}: AdminDocsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Documentação do Sistema
          </CardTitle>
          <CardDescription>
            Acesse a documentação técnica e comercial do NutriaPlan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Documentação Técnica
                </CardTitle>
                <CardDescription>
                  Arquitetura, banco de dados, edge functions, fluxos técnicos e regras de negócio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => onDownloadDocumentation('technical')}
                  disabled={downloadingDoc === 'technical'}
                  className="w-full"
                >
                  {downloadingDoc === 'technical' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Baixar Documentação Técnica
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-green-500" />
                  Documentação Comercial
                </CardTitle>
                <CardDescription>
                  Proposta de valor, públicos-alvo, planos, funcionalidades e modelo de negócio.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => onDownloadDocumentation('commercial')}
                  disabled={downloadingDoc === 'commercial'}
                  variant="secondary"
                  className="w-full"
                >
                  {downloadingDoc === 'commercial' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Baixar Documentação Comercial
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-purple-500" />
                  Código Fonte
                </CardTitle>
                <CardDescription>
                  Estrutura completa do projeto, componentes, hooks, páginas e edge functions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={onDownloadCode}
                  disabled={downloadingDoc === 'code'}
                  variant="outline"
                  className="w-full"
                >
                  {downloadingDoc === 'code' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Baixar Código Fonte (TXT)
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Rebalanceador de Macros
                </CardTitle>
                <CardDescription>
                  Código completo do serviço de rebalanceamento de macros (core, hooks, componentes e edge function).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a 
                  href="/exports/rebalancer-service-code.txt"
                  download="rebalancer-service-code.txt"
                  className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Baixar Código do Rebalanceador (TXT)
                </a>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Outras Documentações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              A documentação técnica e comercial consolidada (v2.0) contém todas as informações necessárias para:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Entender a arquitetura do sistema</li>
              <li>Consultar regras de negócio e fluxos</li>
              <li>Verificar estrutura do banco de dados</li>
              <li>Conhecer integrações (Stripe, IA)</li>
              <li>Apresentar a plataforma para investidores e parceiros</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
