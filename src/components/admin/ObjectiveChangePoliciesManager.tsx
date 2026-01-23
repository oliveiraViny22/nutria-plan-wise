import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, Loader2, Clock, Settings2, AlertCircle, Wand2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useObjectiveChangePolicies, ObjectiveChangePolicy } from '@/hooks/useObjectiveChangePolicies';
import { toast } from 'sonner';

const PROFILE_TYPES = [
  { value: 'gratuito', label: 'Gratuito', description: 'Usuários sem assinatura ativa' },
  { value: 'plano_pessoal_pago', label: 'Plano Pessoal Pago', description: 'Assinantes do plano pessoal' },
  { value: 'profissional', label: 'Profissional', description: 'Nutricionistas e profissionais' },
  { value: 'aluno_vinculado', label: 'Aluno Vinculado', description: 'Alunos sob gestão de profissional' },
];

const DEFAULT_COOLDOWNS: Record<string, Array<{ changeNumber: number; days: number }>> = {
  gratuito: [
    { changeNumber: 1, days: 30 },
    { changeNumber: 2, days: 60 },
    { changeNumber: 3, days: 90 },
  ],
  plano_pessoal_pago: [
    { changeNumber: 1, days: 14 },
    { changeNumber: 2, days: 30 },
    { changeNumber: 3, days: 60 },
    { changeNumber: 4, days: 90 },
  ],
  profissional: [
    { changeNumber: 1, days: 7 },
    { changeNumber: 2, days: 14 },
    { changeNumber: 3, days: 30 },
    { changeNumber: 4, days: 60 },
  ],
  aluno_vinculado: [], // Alunos não podem alterar diretamente, precisam solicitar
};

export function ObjectiveChangePoliciesManager() {
  const { loading, policies, createPolicy, updatePolicy, deletePolicy, fetchPolicies } = useObjectiveChangePolicies();
  
  const [newPolicy, setNewPolicy] = useState({
    profileType: '',
    changeNumber: 1,
    cooldownDays: 30,
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  // Verificar se já existe essa combinação de perfil + nº de alteração
  const isDuplicate = useMemo(() => {
    if (!newPolicy.profileType) return false;
    return policies.some(
      p => p.profile_type === newPolicy.profileType && p.change_number === newPolicy.changeNumber
    );
  }, [policies, newPolicy.profileType, newPolicy.changeNumber]);

  // Perfis que ainda não têm nenhuma política configurada
  const missingProfiles = useMemo(() => {
    const configuredProfiles = new Set(policies.map(p => p.profile_type));
    return PROFILE_TYPES.filter(
      pt => !configuredProfiles.has(pt.value) && DEFAULT_COOLDOWNS[pt.value]?.length > 0
    );
  }, [policies]);

  const handleCreate = async () => {
    if (!newPolicy.profileType) return;
    if (isDuplicate) {
      toast.error('Já existe uma política para este perfil e número de alteração');
      return;
    }
    
    const success = await createPolicy(
      newPolicy.profileType,
      newPolicy.changeNumber,
      newPolicy.cooldownDays
    );
    
    if (success) {
      setNewPolicy({ profileType: '', changeNumber: 1, cooldownDays: 30 });
    }
  };

  const handleSeedDefaults = async (profileType: string) => {
    setSeedingDefaults(true);
    const defaults = DEFAULT_COOLDOWNS[profileType];
    if (!defaults?.length) {
      toast.info('Este perfil não possui políticas padrão');
      setSeedingDefaults(false);
      return;
    }

    let successCount = 0;
    for (const rule of defaults) {
      const exists = policies.some(
        p => p.profile_type === profileType && p.change_number === rule.changeNumber
      );
      if (!exists) {
        const success = await createPolicy(profileType, rule.changeNumber, rule.days);
        if (success) successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} regra(s) padrão criada(s) para ${getProfileLabel(profileType)}`);
    } else {
      toast.info('Todas as regras padrão já existem');
    }
    setSeedingDefaults(false);
  };

  const handleSaveEdit = async (id: string) => {
    await updatePolicy(id, editValue);
    setEditingId(null);
  };

  const startEdit = (policy: ObjectiveChangePolicy) => {
    setEditingId(policy.id);
    setEditValue(policy.cooldown_days);
  };

  const getProfileLabel = (type: string) => {
    return PROFILE_TYPES.find(p => p.value === type)?.label || type;
  };

  const getProfileDescription = (type: string) => {
    return PROFILE_TYPES.find(p => p.value === type)?.description || '';
  };

  // Agrupar políticas por perfil
  const groupedPolicies = policies.reduce((acc, policy) => {
    if (!acc[policy.profile_type]) {
      acc[policy.profile_type] = [];
    }
    acc[policy.profile_type].push(policy);
    return acc;
  }, {} as Record<string, ObjectiveChangePolicy[]>);

  return (
    <div className="space-y-6">
      {/* Adicionar nova política */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nova Política de Cooldown
          </CardTitle>
          <CardDescription>
            Defina regras de cooldown progressivo por perfil de usuário
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alerta de duplicata */}
          {isDuplicate && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Já existe uma regra para a {newPolicy.changeNumber}ª alteração do perfil "{getProfileLabel(newPolicy.profileType)}". 
                Edite a regra existente ou escolha outro número de alteração.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Perfil</Label>
              <Select
                value={newPolicy.profileType}
                onValueChange={(value) => setNewPolicy(prev => ({ ...prev, profileType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex flex-col">
                        <span>{type.label}</span>
                        <span className="text-xs text-muted-foreground">{type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nº da Alteração</Label>
              <Input
                type="number"
                min={1}
                value={newPolicy.changeNumber}
                onChange={(e) => setNewPolicy(prev => ({ ...prev, changeNumber: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Dias de Cooldown</Label>
              <Input
                type="number"
                min={1}
                value={newPolicy.cooldownDays}
                onChange={(e) => setNewPolicy(prev => ({ ...prev, cooldownDays: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={loading || !newPolicy.profileType || isDuplicate}
                className="w-full"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Botões para aplicar regras padrão */}
          {missingProfiles.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                <Wand2 className="h-4 w-4 inline mr-1" />
                Aplicar regras padrão para perfis não configurados:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingProfiles.map((profile) => (
                  <Button
                    key={profile.value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSeedDefaults(profile.value)}
                    disabled={seedingDefaults}
                  >
                    {seedingDefaults ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    {profile.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerta para aluno vinculado */}
      {groupedPolicies['aluno_vinculado']?.length > 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Alunos vinculados a profissionais não podem alterar objetivo diretamente. 
            Eles devem solicitar a alteração ao profissional responsável via sistema de solicitações.
          </AlertDescription>
        </Alert>
      )}

      {/* Políticas existentes por perfil */}
      {Object.entries(groupedPolicies).map(([profileType, profilePolicies]) => (
        <motion.div
          key={profileType}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                {getProfileLabel(profileType)}
              </CardTitle>
              <CardDescription>
                {profilePolicies.length} regra(s) de cooldown configurada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alteração</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profilePolicies
                    .sort((a, b) => a.change_number - b.change_number)
                    .map((policy) => (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {policy.change_number}ª alteração
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {editingId === policy.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                value={editValue}
                                onChange={(e) => setEditValue(parseInt(e.target.value) || 1)}
                                className="w-24"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveEdit(policy.id)}
                                disabled={loading}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                              onClick={() => startEdit(policy)}
                            >
                              <Clock className="h-4 w-4" />
                              {policy.cooldown_days} dias
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover política?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. A regra de cooldown para
                                  a {policy.change_number}ª alteração será removida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePolicy(policy.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {policies.length === 0 && !loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma política de cooldown configurada.</p>
            <p className="text-sm">Adicione regras para controlar alterações de objetivo.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
