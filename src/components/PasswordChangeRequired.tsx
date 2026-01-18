import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { validatePassword, getPasswordStrengthColor } from '@/lib/password-validation';

interface PasswordChangeRequiredProps {
  onPasswordChanged: () => void;
}

export function PasswordChangeRequired({ onPasswordChanged }: PasswordChangeRequiredProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validation = validatePassword(newPassword);
  const strengthColor = getPasswordStrengthColor(validation.strength);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (!validation.isValid) {
      toast.error('A senha não atende aos requisitos mínimos');
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (passwordError) throw passwordError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não encontrado');

      // Update must_change_password flag
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      toast.success('Senha alterada com sucesso!');
      onPasswordChanged();
    } catch (error) {
      console.error('Password change error:', error);
      toast.error('Erro ao alterar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Alteração de Senha Obrigatória</CardTitle>
          <CardDescription>
            Por segurança, você deve alterar sua senha temporária antes de acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite sua nova senha"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${strengthColor}`}
                        style={{ width: `${(validation.strength / 4) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {validation.strength === 1 && 'Fraca'}
                      {validation.strength === 2 && 'Média'}
                      {validation.strength === 3 && 'Boa'}
                      {validation.strength === 4 && 'Forte'}
                    </span>
                  </div>
                  
                  <ul className="text-xs space-y-1">
                    {validation.errors.map((error, i) => (
                      <li key={i} className="text-destructive flex items-center gap-1">
                        <span>•</span> {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua nova senha"
                required
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">As senhas não coincidem</p>
              )}
            </div>

            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Após alterar a senha, a senha temporária será invalidada permanentemente.
              </AlertDescription>
            </Alert>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !validation.isValid || newPassword !== confirmPassword}
            >
              {loading ? 'Alterando...' : 'Alterar Senha e Continuar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
