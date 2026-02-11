/**
 * Admin Documentation & Data Export Tab Component
 */

import { useState } from 'react';
import { 
  BookOpen, 
  FileText, 
  Briefcase,
  Code,
  Sparkles,
  Download,
  Loader2,
  Database,
  Users,
  ClipboardList,
  CreditCard,
  Scale,
  Activity,
  Settings,
  UserCheck,
  FileDown,
  Copy,
  Check,
  TableProperties,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AdminDocsTabProps {
  downloadingDoc: string | null;
  onDownloadDocumentation: (type: 'technical' | 'commercial') => void;
  onDownloadCode: () => void;
}

const EXPORT_ENTITIES = [
  { id: 'profiles', label: 'Usuários', icon: Users, description: 'Perfis e dados cadastrais' },
  { id: 'foods', label: 'Alimentos', icon: Database, description: 'Base completa de alimentos' },
  { id: 'diet_plans', label: 'Planos Alimentares', icon: ClipboardList, description: 'Dietas geradas' },
  { id: 'subscriptions', label: 'Assinaturas', icon: CreditCard, description: 'Planos e status' },
  { id: 'user_usage', label: 'Uso dos Usuários', icon: Activity, description: 'Contadores de uso' },
  { id: 'audit_logs', label: 'Logs de Auditoria', icon: FileText, description: 'Ações administrativas' },
  { id: 'ai_usage', label: 'Logs de IA', icon: Sparkles, description: 'Chamadas e custos de IA' },
  { id: 'weight_logs', label: 'Registros de Peso', icon: Scale, description: 'Histórico de pesagens' },
  { id: 'plans', label: 'Planos (Config)', icon: Settings, description: 'Configuração dos planos' },
  { id: 'system_settings', label: 'Configurações', icon: Settings, description: 'Parâmetros do sistema' },
  { id: 'professional_students', label: 'Profissionais/Alunos', icon: UserCheck, description: 'Vínculos profissionais' },
];

export function AdminDocsTab({
  downloadingDoc,
  onDownloadDocumentation,
  onDownloadCode,
}: AdminDocsTabProps) {
  const { toast } = useToast();
  const [exportingEntity, setExportingEntity] = useState<string | null>(null);
  const [schemaSql, setSchemaSql] = useState<string | null>(null);
  const [dataSql, setDataSql] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleExportCSV = async (entity: string) => {
    setExportingEntity(entity);
    try {
      const { data, error } = await supabase.functions.invoke('export-data', {
        body: { entity },
      });

      if (error) throw error;

      if (entity === 'all') {
        const blob = new Blob([JSON.stringify(data.tables, null, 2)], { type: 'application/json' });
        downloadBlob(blob, data.filename);
      } else {
        const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, data.filename);
      }

      toast({ title: 'Exportação concluída', description: `Arquivo ${data.filename} baixado.` });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Erro na exportação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setExportingEntity(null);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadSchema = async () => {
    setSchemaLoading(true);
    try {
      const res = await fetch('/docs/database-schema-export.sql');
      if (!res.ok) throw new Error('Arquivo não encontrado');
      const text = await res.text();
      setSchemaSql(text);
    } catch {
      // Try loading from the docs folder via import
      try {
        const { data, error } = await supabase.functions.invoke('export-data', {
          body: { entity: 'system_settings' },
        });
        // Fallback: show a message
        setSchemaSql('-- Erro ao carregar o schema. Verifique o arquivo docs/database-schema-export.sql');
      } catch {
        setSchemaSql('-- Erro ao carregar o schema SQL');
      }
    } finally {
      setSchemaLoading(false);
    }
  };

  const handleCopyText = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
    toast({ title: 'Copiado!', description: `SQL de ${label} copiado para a área de transferência.` });
  };

  const handleLoadData = async () => {
    setDataLoading(true);
    try {
      const res = await fetch('/docs/database-data-export.sql');
      if (!res.ok) throw new Error('Arquivo não encontrado');
      const text = await res.text();
      setDataSql(text);
    } catch {
      setDataSql('-- Erro ao carregar o SQL de dados. Verifique o arquivo docs/database-data-export.sql');
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            Exportação de Dados (CSV)
          </CardTitle>
          <CardDescription>
            Exporte os dados do sistema em formato CSV para análise e compartilhamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXPORT_ENTITIES.map((entity) => {
              const Icon = entity.icon;
              const isExporting = exportingEntity === entity.id;
              return (
                <Button
                  key={entity.id}
                  variant="outline"
                  className="h-auto py-3 px-4 flex items-start gap-3 justify-start text-left"
                  disabled={!!exportingEntity}
                  onClick={() => handleExportCSV(entity.id)}
                >
                  {isExporting ? (
                    <Loader2 className="h-5 w-5 mt-0.5 shrink-0 animate-spin text-primary" />
                  ) : (
                    <Icon className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm">{entity.label}</div>
                    <div className="text-xs text-muted-foreground">{entity.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>

          <div className="pt-2 border-t">
            <Button
              variant="default"
              className="w-full"
              disabled={!!exportingEntity}
              onClick={() => handleExportCSV('all')}
            >
              {exportingEntity === 'all' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Exportar Tudo (JSON)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SQL Schema Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableProperties className="h-5 w-5 text-primary" />
            SQL do Schema (Migração de Tabelas)
          </CardTitle>
          <CardDescription>
            Carregue o SQL completo das tabelas do sistema para copiar e migrar para outro ambiente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!schemaSql ? (
            <Button
              onClick={handleLoadSchema}
              disabled={schemaLoading}
              variant="outline"
              className="w-full"
            >
              {schemaLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Carregar SQL das Tabelas
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {schemaSql.split('\n').length} linhas
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopyText(schemaSql, 'schema')}
                >
                  {copied === 'schema' ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied === 'schema' ? 'Copiado!' : 'Copiar SQL'}
                </Button>
              </div>
              <Textarea
                value={schemaSql}
                readOnly
                className="font-mono text-xs min-h-[400px] max-h-[600px] resize-y"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* SQL Data Export/Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            SQL de Dados (Exportação / Importação)
          </CardTitle>
          <CardDescription>
            SQL com os dados semente do sistema (configurações, planos, alimentos). 
            Use para importar dados em outro ambiente executando o SQL no editor SQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!dataSql ? (
            <Button
              onClick={handleLoadData}
              disabled={dataLoading}
              variant="outline"
              className="w-full"
            >
              {dataLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Carregar SQL de Dados
            </Button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {dataSql.split('\n').length} linhas
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopyText(dataSql, 'dados')}
                >
                  {copied === 'dados' ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied === 'dados' ? 'Copiado!' : 'Copiar SQL'}
                </Button>
              </div>
              <Textarea
                value={dataSql}
                readOnly
                className="font-mono text-xs min-h-[400px] max-h-[600px] resize-y"
              />
            </>
          )}
          
          <div className="rounded-md border p-4 bg-muted/30 space-y-2">
            <h4 className="text-sm font-medium">Como migrar os dados:</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Execute primeiro o <strong>SQL do Schema</strong> (seção acima) para criar as tabelas</li>
              <li>Em seguida, execute o <strong>SQL de Dados</strong> para inserir as configurações e dados semente</li>
              <li>Para importar alimentos separadamente, baixe o arquivo <code>foods-import.sql</code> abaixo</li>
            </ol>
            <a 
              href="/docs/foods-import.sql"
              download="foods-import.sql"
              className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted transition-colors"
            >
              <Download className="h-3 w-3" />
              Baixar foods-import.sql
            </a>
          </div>
        </CardContent>
      </Card>

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
                  <Code className="h-4 w-4 text-emerald-500" />
                  Gerador de Planos v5.17
                </CardTitle>
                <CardDescription>
                  Documentação completa: contratos, regras operacionais e código fonte do motor de geração.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a 
                  href="/exports/generator-v5-documentation.txt"
                  download="generator-v5-documentation.txt"
                  className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Baixar Documentação do Gerador (TXT)
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Rebalanceador v2
                </CardTitle>
                <CardDescription>
                  Documentação completa: contratos, pipeline de 5 etapas e código fonte do motor de rebalanceamento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a 
                  href="/exports/rebalancer-v2-documentation.txt"
                  download="rebalancer-v2-documentation.txt"
                  className="inline-flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium border rounded-md hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Baixar Documentação do Rebalanceador (TXT)
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
