/**
 * Admin Policies Tab Component
 * 
 * Manages objective change policies and optimizer settings
 */

import { 
  Target, 
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ObjectiveChangePoliciesManager } from '@/components/admin/ObjectiveChangePoliciesManager';
import { OptimizerSettingsManager } from '@/components/admin/OptimizerSettingsManager';

export function AdminPoliciesTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Políticas de Cooldown de Objetivo
          </CardTitle>
          <CardDescription>
            Configure as regras de cooldown progressivo para alteração de objetivo nutricional.
            Cada perfil de usuário pode ter diferentes períodos de espera para cada tentativa de alteração.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ObjectiveChangePoliciesManager />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Como funciona o Cooldown Progressivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-3">
            <p>
              O sistema de cooldown progressivo controla quantas vezes um usuário pode alterar
              seu objetivo nutricional e o tempo de espera entre cada alteração. As regras acima
              são configuráveis e podem ser ajustadas conforme necessário.
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge variant="secondary">Gratuito</Badge>
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Usuários sem assinatura têm cooldowns mais longos para incentivar upgrade.
                </p>
                <ul className="text-xs space-y-1">
                  <li>• 1ª alteração: 30 dias</li>
                  <li>• 2ª alteração: 60 dias</li>
                  <li>• 3ª alteração: 90 dias</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge className="bg-primary">Plano Pessoal</Badge>
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Assinantes têm mais flexibilidade para ajustar objetivos.
                </p>
                <ul className="text-xs space-y-1">
                  <li>• 1ª alteração: 14 dias</li>
                  <li>• 2ª alteração: 30 dias</li>
                  <li>• 3ª alteração: 60 dias</li>
                  <li>• 4ª+ alteração: 90 dias</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge className="bg-green-500">Profissional</Badge>
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Nutricionistas têm cooldowns reduzidos para gestão ágil.
                </p>
                <ul className="text-xs space-y-1">
                  <li>• 1ª alteração: 7 dias</li>
                  <li>• 2ª alteração: 14 dias</li>
                  <li>• 3ª alteração: 30 dias</li>
                  <li>• 4ª+ alteração: 60 dias</li>
                </ul>
              </div>
              
              <div className="p-4 border rounded-lg bg-muted/30">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline">Aluno Vinculado</Badge>
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Alunos não podem alterar diretamente.
                </p>
                <p className="text-xs">
                  Devem solicitar ao profissional responsável, que avalia e aprova/rejeita via sistema de solicitações.
                </p>
              </div>
            </div>
            
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> Quando um usuário atinge o número máximo de alterações configuradas,
                o sistema aplica o cooldown da última regra para alterações subsequentes.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Optimizer Settings */}
      <OptimizerSettingsManager />
    </div>
  );
}
