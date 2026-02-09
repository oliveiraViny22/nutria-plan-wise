/**
 * Admin Users Tab Component
 * 
 * Manages user accounts, roles, and quotas
 */

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Edit2, 
  Trash2, 
  BarChart3,
  Loader2,
  Save,
  X,
  UserPlus,
  KeyRound,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserProfile, DeleteUserPreview, UserUsage, Plan } from '@/hooks/useAdminOperations';

interface AdminUsersTabProps {
  users: UserProfile[];
  usersLoading: boolean;
  usersTotal: number;
  savingKeys: Set<string>;
  fetchUsers: (limit: number, offset: number, search: string) => void;
  updateUser: (userId: string, data: Partial<Pick<UserProfile, 'name'>>) => Promise<boolean>;
  toggleUserRole: (userId: string, role: string, add: boolean) => void;
  previewDeleteUser: (userId: string) => Promise<DeleteUserPreview | null>;
  deleteUser: (userId: string) => Promise<boolean>;
  getUserUsage: (userId: string) => Promise<UserUsage | null>;
  updateUserUsage: (userId: string, data: Partial<UserUsage>) => Promise<boolean>;
  createUser: (email: string, password: string, name: string, planId?: string) => Promise<{ userId: string; email: string; name: string } | null>;
  changeUserPassword: (targetUserId: string, newPassword: string) => Promise<boolean>;
  changeUserPlan: (targetUserId: string, planId: string) => Promise<boolean>;
  plans: Plan[];
  fetchPlans: () => Promise<Plan[]>;
}

export function AdminUsersTab({
  users,
  usersLoading,
  usersTotal,
  savingKeys,
  fetchUsers,
  updateUser,
  toggleUserRole,
  previewDeleteUser,
  deleteUser,
  getUserUsage,
  updateUserUsage,
  createUser,
  changeUserPassword,
  changeUserPlan,
  plans,
  fetchPlans,
}: AdminUsersTabProps) {
  const { toast } = useToast();
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(0);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editedUserData, setEditedUserData] = useState<Partial<UserProfile>>({});
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);
  const [deletePreview, setDeletePreview] = useState<DeleteUserPreview | null>(null);
  const [loadingDeletePreview, setLoadingDeletePreview] = useState(false);
  const [editingQuotaUser, setEditingQuotaUser] = useState<UserProfile | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);
  const [editedQuotas, setEditedQuotas] = useState<Partial<UserUsage>>({});
  const [loadingUserUsage, setLoadingUserUsage] = useState(false);

  // New dialogs state
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', planId: '' });
  const [creatingUser, setCreatingUser] = useState(false);

  const [passwordUser, setPasswordUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [planUser, setPlanUser] = useState<UserProfile | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  // Fetch plans when plan dialog opens
  useEffect(() => {
    if (planUser || showCreateUser) {
      if (plans.length === 0) fetchPlans();
    }
  }, [planUser, showCreateUser, plans.length, fetchPlans]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Gestão de Usuários
          </CardTitle>
          <CardDescription>
            Visualize e edite as contas de usuários ({usersTotal} total).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setUserPage(0);
                    fetchUsers(50, 0, userSearch);
                  }
                }}
                className="pl-9"
              />
            </div>
            <Button onClick={() => {
              setUserPage(0);
              fetchUsers(50, 0, userSearch);
            }}>
              <Search className="h-4 w-4 mr-1" />
              Buscar
            </Button>
            <Button onClick={() => setShowCreateUser(true)} variant="default">
              <UserPlus className="h-4 w-4 mr-1" />
              Criar Usuário
            </Button>
          </div>

          <ScrollArea className="h-[500px] border rounded-lg">
            {usersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : users.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Clique em "Buscar" para carregar os usuários</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name || 'Sem nome'}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge 
                              key={role} 
                              variant={role === 'admin' ? 'destructive' : role === 'professional' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {role}
                            </Badge>
                          ))}
                          {user.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{user.plan_name || '-'}</span>
                          {user.subscription_status && (
                            <Badge 
                              variant={user.subscription_status === 'active' ? 'default' : 'secondary'}
                              className="text-xs w-fit mt-0.5"
                            >
                              {user.subscription_status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                              setEditingQuotaUser(user);
                              setUserUsage(null);
                              setEditedQuotas({});
                              setLoadingUserUsage(true);
                              try {
                                const usage = await getUserUsage(user.user_id);
                                setUserUsage(usage);
                                if (usage) {
                                  setEditedQuotas({
                                    diets_used: usage.diets_used,
                                    substitutions_used: usage.substitutions_used,
                                    adjustments_used: usage.adjustments_used,
                                    chat_messages_today: usage.chat_messages_today,
                                    meal_options_override: usage.meal_options_override,
                                  });
                                }
                              } finally {
                                setLoadingUserUsage(false);
                              }
                            }}
                            title="Editar cotas"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setPasswordUser(user);
                              setNewPassword('');
                            }}
                            title="Alterar senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setPlanUser(user);
                              setSelectedPlanId('');
                            }}
                            title="Alterar plano"
                          >
                            <CreditCard className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingUser(user);
                              setEditedUserData({ name: user.name });
                            }}
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async () => {
                              setDeleteConfirmUser(user);
                              setDeletePreview(null);
                              setLoadingDeletePreview(true);
                              try {
                                const preview = await previewDeleteUser(user.user_id);
                                setDeletePreview(preview);
                              } finally {
                                setLoadingDeletePreview(false);
                              }
                            }}
                            className="text-destructive hover:text-destructive"
                            title="Excluir usuário"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>

          {usersTotal > 50 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Mostrando {userPage * 50 + 1} - {Math.min((userPage + 1) * 50, usersTotal)} de {usersTotal}
              </span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={userPage === 0}
                  onClick={() => {
                    const newPage = userPage - 1;
                    setUserPage(newPage);
                    fetchUsers(50, newPage * 50, userSearch);
                  }}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={(userPage + 1) * 50 >= usersTotal}
                  onClick={() => {
                    const newPage = userPage + 1;
                    setUserPage(newPage);
                    fetchUsers(50, newPage * 50, userSearch);
                  }}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5" />
              Editar Usuário
            </DialogTitle>
            <DialogDescription>
              {editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editedUserData.name || ''}
                  onChange={(e) => setEditedUserData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do usuário"
                />
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {(['admin', 'professional', 'user'] as const).map((role) => {
                    const hasRole = editingUser.roles.includes(role);
                    const isSaving = savingKeys.has(`role_${editingUser.user_id}_${role}`);
                    return (
                      <Button
                        key={role}
                        variant={hasRole ? 'default' : 'outline'}
                        size="sm"
                        disabled={isSaving}
                        onClick={() => toggleUserRole(editingUser.user_id, role, !hasRole)}
                        className="gap-1"
                      >
                        {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                        {role}
                        {hasRole && <X className="h-3 w-3 ml-1" />}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingUser) return;
                    try {
                      await updateUser(editingUser.user_id, { name: editedUserData.name });
                      toast({ title: 'Usuário atualizado' });
                      setEditingUser(null);
                    } catch {
                      // Error handled in hook
                    }
                  }}
                  disabled={savingKeys.has(`user_${editingUser.user_id}`)}
                >
                  {savingKeys.has(`user_${editingUser.user_id}`) ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmUser(null);
          setDeletePreview(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o usuário {deleteConfirmUser?.name || deleteConfirmUser?.email}?
              
              {loadingDeletePreview && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}
              
              {deletePreview && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <p className="font-medium text-destructive">
                    {deletePreview.totalRecords} registros serão excluídos
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteConfirmUser) return;
                await deleteUser(deleteConfirmUser.user_id);
                setDeleteConfirmUser(null);
                fetchUsers(50, userPage * 50, userSearch);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Quotas Dialog */}
      <Dialog open={!!editingQuotaUser} onOpenChange={(open) => {
        if (!open) {
          setEditingQuotaUser(null);
          setUserUsage(null);
          setEditedQuotas({});
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Editar Cotas de Uso
            </DialogTitle>
            <DialogDescription>
              {editingQuotaUser?.name || editingQuotaUser?.email}
            </DialogDescription>
          </DialogHeader>

          {loadingUserUsage ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dietas usadas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.diets_used ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, diets_used: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Substituições usadas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.substitutions_used ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, substitutions_used: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ajustes usados</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.adjustments_used ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, adjustments_used: parseInt(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mensagens hoje</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editedQuotas.chat_messages_today ?? 0}
                    onChange={(e) => setEditedQuotas(prev => ({ ...prev, chat_messages_today: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* Opções por Refeição Override */}
              <div className="space-y-2 pt-4 border-t">
                <Label className="flex items-center gap-2">
                  Opções por Refeição (Override)
                  <Badge variant="outline" className="text-xs font-normal">Individual</Badge>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    placeholder="Usar limite do plano"
                    value={editedQuotas.meal_options_override ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setEditedQuotas(prev => ({ ...prev, meal_options_override: null }));
                      } else {
                        const num = parseInt(value) || 1;
                        setEditedQuotas(prev => ({ ...prev, meal_options_override: Math.max(1, Math.min(10, num)) }));
                      }
                    }}
                    className="flex-1"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setEditedQuotas(prev => ({ ...prev, meal_options_override: null }))}
                    disabled={editedQuotas.meal_options_override === null || editedQuotas.meal_options_override === undefined}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para usar o limite definido no plano. Defina um valor para sobrescrever individualmente.
                </p>
              </div>

              {userUsage && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p>Período: {new Date(userUsage.period_start).toLocaleDateString('pt-BR')} - {new Date(userUsage.period_end).toLocaleDateString('pt-BR')}</p>
                  <p>Último reset de chat: {new Date(userUsage.last_chat_reset).toLocaleDateString('pt-BR')}</p>
                  {userUsage.meal_options_override !== null && userUsage.meal_options_override !== undefined && (
                    <p className="text-primary mt-1">Override de opções ativo: {userUsage.meal_options_override} opções</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditingQuotaUser(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingQuotaUser) return;
                    const success = await updateUserUsage(editingQuotaUser.user_id, editedQuotas);
                    if (success) {
                      setEditingQuotaUser(null);
                    }
                  }}
                  disabled={savingKeys.has(`usage_${editingQuotaUser?.user_id}`)}
                >
                  {savingKeys.has(`usage_${editingQuotaUser?.user_id}`) ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showCreateUser} onOpenChange={(open) => {
        if (!open) {
          setShowCreateUser(false);
          setNewUser({ email: '', password: '', name: '', planId: '' });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Criar Novo Usuário
            </DialogTitle>
            <DialogDescription>
              Crie uma conta com email e senha. O email será confirmado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do usuário"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="text"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Plano (opcional)</Label>
              <Select value={newUser.planId} onValueChange={(v) => setNewUser(prev => ({ ...prev, planId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Plano gratuito (padrão)" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCreateUser(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  setCreatingUser(true);
                  try {
                    const result = await createUser(
                      newUser.email, newUser.password, newUser.name,
                      newUser.planId || undefined
                    );
                    if (result) {
                      setShowCreateUser(false);
                      setNewUser({ email: '', password: '', name: '', planId: '' });
                      fetchUsers(50, userPage * 50, userSearch);
                    }
                  } finally {
                    setCreatingUser(false);
                  }
                }}
                disabled={creatingUser || !newUser.email || !newUser.password || !newUser.name || newUser.password.length < 8}
              >
                {creatingUser ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1" />}
                Criar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Alterar Senha
            </DialogTitle>
            <DialogDescription>
              {passwordUser?.name || passwordUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPasswordUser(null)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!passwordUser) return;
                  const ok = await changeUserPassword(passwordUser.user_id, newPassword);
                  if (ok) setPasswordUser(null);
                }}
                disabled={savingKeys.has(`pwd_${passwordUser?.user_id}`) || newPassword.length < 8}
              >
                {savingKeys.has(`pwd_${passwordUser?.user_id}`) ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!planUser} onOpenChange={(open) => !open && setPlanUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Alterar Plano
            </DialogTitle>
            <DialogDescription>
              {planUser?.name || planUser?.email} — Plano atual: <Badge variant="secondary">{planUser?.plan_name || 'Gratuito'}</Badge>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Novo Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPlanUser(null)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!planUser || !selectedPlanId) return;
                  const ok = await changeUserPlan(planUser.user_id, selectedPlanId);
                  if (ok) setPlanUser(null);
                }}
                disabled={savingKeys.has(`plan_${planUser?.user_id}`) || !selectedPlanId}
              >
                {savingKeys.has(`plan_${planUser?.user_id}`) ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
