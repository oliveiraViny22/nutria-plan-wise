import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Save, Loader2, Clock, Settings2 } from 'lucide-react';
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
import { useObjectiveChangePolicies, ObjectiveChangePolicy } from '@/hooks/useObjectiveChangePolicies';

const PROFILE_TYPES = [
  { value: 'plano_pessoal_pago', label: 'Plano Pessoal Pago' },
  { value: 'profissional', label: 'Profissional' },
];

export function ObjectiveChangePoliciesManager() {
  const { loading, policies, createPolicy, updatePolicy, deletePolicy } = useObjectiveChangePolicies();
  
  const [newPolicy, setNewPolicy] = useState({
    profileType: '',
    changeNumber: 1,
    cooldownDays: 30,
  });
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  const handleCreate = async () => {
    if (!newPolicy.profileType) return;
    
    const success = await createPolicy(
      newPolicy.profileType,
      newPolicy.changeNumber,
      newPolicy.cooldownDays
    );
    
    if (success) {
      setNewPolicy({ profileType: '', changeNumber: 1, cooldownDays: 30 });
    }
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
        <CardContent>
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
                      {type.label}
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
                disabled={loading || !newPolicy.profileType}
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
        </CardContent>
      </Card>

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
